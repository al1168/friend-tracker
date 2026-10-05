import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useConfirmDiscard } from '../components/ActionSheet'
import { Chip } from '../components/Chip'
import { GrowField } from '../components/GrowField'
import { IconChevronLeft } from '../components/icons'
import { MoodTiles } from '../components/MoodTiles'
import { useFriends, useMeetup, useMeetupTypes } from '../data/hooks'
import { updateDay } from '../db/meetups'
import { useAutosave } from '../hooks/useAutosave'
import { useKeyboardInset } from '../hooks/useKeyboardInset'
import { useRevealFocusedField } from '../hooks/useRevealFocusedField'
import { useScrollLock } from '../hooks/useScrollLock'
import { useToday } from '../hooks/useToday'
import { clockStyle, describeStopTime, typedClock } from '../lib/clock'
import { formatDate } from '../lib/dates'
import { changeBetween, insertAtCaret, insertPaidLine, insertPlaceLine, type DayEdit } from '../lib/dayEdit'
import { DAY_MAX_TYPED, FEELINGS_MAX, readDay } from '../lib/dayText'
import { feelingsApply } from '../lib/moods'
import { payerLabel } from '../lib/payers'
import { formatNameList } from '../lib/text'
import { cleanWeather, WEATHER } from '../lib/weather'
import type { Friend, Meetup, Mood, Weather } from '../types'
import { DayHelperBar, type HelperRow, type Payer } from './DayHelperBar'
import './DayScreen.css'

/** The day page's own copy of the meetup's day. */
interface DayFields {
  note: string
  weather: Weather[]
  mood: Mood | null
  feelings: string
}

const FIELDS = ['note', 'weather', 'mood', 'feelings'] as const

function fieldsOf(meetup: Meetup): DayFields {
  return { note: meetup.note, weather: meetup.weather, mood: meetup.mood, feelings: meetup.feelings }
}

function sameValue(a: DayFields[keyof DayFields], b: DayFields[keyof DayFields]): boolean {
  return Array.isArray(a) && Array.isArray(b) ? a.join() === b.join() : a === b
}

const SAVE_FAILED = "Couldn't save just now. Your words are still here, and the app will try again."

/** Minutes past midnight now, refreshed every 10 seconds (the "Now" chip's name follows the clock). */
function useMinutesNow(): number {
  const read = () => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  }
  const [minutes, setMinutes] = useState(read)
  useEffect(() => {
    const timer = window.setInterval(() => setMinutes(read()), 10_000)
    return () => window.clearInterval(timer)
  }, [])
  return minutes
}

/** The "Who paid?" chips: Me, each friend on the meetup in the meetup's order, and Split. */
function payersFor(people: Friend[]): Payer[] {
  return [
    { key: 'me', label: 'Me', name: 'I paid', line: 'I paid' },
    ...people.map((friend) => {
      const label = payerLabel(friend, people)
      return { key: friend.id, label, name: label, line: `${label} paid`, friend }
    }),
    { key: 'split', label: 'Split', name: 'We split it', line: 'We split it' },
  ]
}

/** `/meetups/:id/day`: write the whole day, comfortably, and have it saved as you go. */
export function DayScreen() {
  const { id } = useParams()
  const meetup = useMeetup(id)
  const friends = useFriends()
  const types = useMeetupTypes()
  const location = useLocation()
  const navigate = useNavigate()
  const leftRef = useRef(false)
  // From the moment the route opens (a closing Log sheet may still hold the keyboard for 260ms).
  useScrollLock(true)
  useKeyboardInset(true)

  // Deleted (Undo on the "Logged" toast, another tab) or never there: go back, like the Meetup page does.
  const leave = useCallback(() => {
    if (leftRef.current) return
    leftRef.current = true
    if (location.key === 'default') navigate('/', { replace: true })
    else navigate(-1)
  }, [location.key, navigate])

  useEffect(() => {
    if (meetup === null) leave()
  }, [meetup, leave])

  if (!meetup || !friends || !types) return null
  const typeName = types.find((type) => type.id === meetup.typeId)?.name ?? 'Meetup'
  const friendById = new Map(friends.map((friend) => [friend.id, friend] as const))
  const people = meetup.friendIds.map((friendId) => friendById.get(friendId)).filter((f): f is Friend => !!f)
  return <DayPage key={meetup.id} meetup={meetup} people={people} typeName={typeName} onGone={leave} />
}

interface DayPageProps {
  meetup: Meetup
  people: Friend[]
  typeName: string
  onGone: () => void
}

function DayPage({ meetup, people, typeName, onGone }: DayPageProps) {
  const today = useToday()
  const minutesNow = useMinutesNow()
  const location = useLocation()
  const navigate = useNavigate()
  const confirmDiscard = useConfirmDiscard()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const dayRef = useRef<HTMLTextAreaElement>(null)
  const placeRef = useRef<HTMLInputElement>(null)
  const weatherId = useId()
  const dayId = useId()
  const hintId = useId()
  const feltId = useId()

  // The page keeps its own copy, taken once when it opens (see the effect below for newer stored values).
  const [fields, setFields] = useState<DayFields>(() => fieldsOf(meetup))
  const fieldsRef = useRef(fields)
  const [focused, setFocused] = useState<'note' | 'feelings' | null>(null)
  const focusedRef = useRef(focused)
  // Whether The day has had focus since the page opened: until then, helpers write at the end of its text.
  const dayTouched = useRef(false)
  const [row, setRow] = useState<HelperRow>('helpers')
  const [placeDraft, setPlaceDraft] = useState('')
  const placeDraftRef = useRef(placeDraft)
  const [scrolled, setScrolled] = useState(false)
  const [announcement, setAnnouncement] = useState({ text: '', n: 0 })

  const { saver, status } = useAutosave<DayFields>((changes) => updateDay(meetup.id, changes), commitPlaceDraft)

  useRevealFocusedField(true, bodyRef)

  // Before the first paint, so VoiceOver starts at the top and a tap on a box can't lose its focus to the title.
  useLayoutEffect(() => {
    document.title = 'The day · Friend Tracker'
    titleRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (status.gone) onGone()
  }, [status.gone, onGone])

  // A newer stored value (another tab, a backup restore) only goes into a field that isn't focused and has
  // nothing waiting to save, so nothing changes under your thumb.
  useEffect(() => {
    const stored = fieldsOf(meetup)
    let next = fieldsRef.current
    for (const key of FIELDS) {
      if (focusedRef.current === key || saver.isUnsaved(key) || sameValue(stored[key], next[key])) continue
      next = { ...next, [key]: stored[key] }
    }
    if (next !== fieldsRef.current) {
      fieldsRef.current = next
      setFields(next)
    }
  }, [meetup, saver])

  function setField<K extends keyof DayFields>(key: K, value: DayFields[K], now: boolean) {
    fieldsRef.current = { ...fieldsRef.current, [key]: value }
    setFields(fieldsRef.current)
    const change: Partial<DayFields> = { [key]: value }
    if (now) saver.changeNow(change)
    else saver.change(change)
  }

  function setFocus(field: 'note' | 'feelings' | null) {
    focusedRef.current = field
    setFocused(field)
  }

  function announce(text: string) {
    setAnnouncement((current) => ({ text, n: current.n + 1 }))
  }

  function updatePlaceDraft(text: string) {
    placeDraftRef.current = text
    setPlaceDraft(text)
  }

  /** The caret in The day, or the end of its text if it hasn't had focus since the page opened. */
  function dayCaret(): { start: number; end: number } {
    const box = dayRef.current
    const length = fieldsRef.current.note.length
    if (!box || !dayTouched.current) return { start: length, end: length }
    return { start: box.selectionStart, end: box.selectionEnd }
  }

  /** Puts focus in The day, with the caret at the end if it hasn't had focus yet. */
  function focusDay() {
    const box = dayRef.current
    if (!box) return
    if (!dayTouched.current) box.setSelectionRange(box.value.length, box.value.length)
    box.focus({ preventScroll: true })
  }

  /**
   * Writes a helper's text into The day at its caret. It goes in with execCommand while The day has focus, so
   * shake to undo still works; if that's refused, setRangeText and an input event (losing only native undo).
   */
  function editDay(edit: (value: string, caret: number) => DayEdit): DayEdit {
    const box = dayRef.current!
    const value = box.value
    const { start, end } = dayCaret()
    const next = edit(value.slice(0, start) + value.slice(end), start)
    const change = changeBetween(value, next.value)
    focusDay()
    box.setSelectionRange(change.from, change.to)
    if (!document.execCommand('insertText', false, change.text)) {
      box.setRangeText(change.text, change.from, change.to, 'end')
      box.dispatchEvent(new Event('input', { bubbles: true }))
    }
    box.setSelectionRange(next.caret, next.caret)
    return next
  }

  /** "Added Blue willow, 3:30 PM.", read from the day as it now stands, so the time reads in day order. */
  function describeAddedPlace(next: DayEdit, line: string): string {
    const end = next.value.lastIndexOf(line, next.caret) + line.length
    const part = readDay(next.value.slice(0, end)).at(-1)
    const stop = part?.kind === 'timeline' ? part.stops.at(-1) : undefined
    if (!stop) return `Added ${line.slice(1)}.`
    const time = describeStopTime(stop, clockStyle())
    return time ? `Added ${stop.place}, ${time}.` : `Added ${stop.place}.`
  }

  function addPlace() {
    const text = placeDraftRef.current
    const line = insertPlaceLine('', 0, text).value.trimEnd()
    if (line === '') {
      closePlace()
      return
    }
    const next = editDay((value, caret) => insertPlaceLine(value, caret, text))
    updatePlaceDraft('')
    setRow('helpers')
    announce(describeAddedPlace(next, line))
  }

  function openPlace() {
    // The field has to be there to take focus inside this tap, so iOS raises (or keeps) the keyboard.
    flushSync(() => setRow('place'))
    placeRef.current?.focus()
  }

  function closePlace() {
    updatePlaceDraft('')
    setRow('helpers')
    focusDay()
  }

  /** Text left in the Place field joins The day as a place line (on Back, and when the app goes away). */
  function commitPlaceDraft() {
    const text = placeDraftRef.current
    if (text.trim() === '') return
    const { start, end } = dayCaret()
    const note = fieldsRef.current.note
    const next = insertPlaceLine(note.slice(0, start) + note.slice(end), start, text)
    updatePlaceDraft('')
    setRow('helpers')
    if (next.value !== note) setField('note', next.value, false)
  }

  const now = meetup.date === today ? typedClock(minutesNow, clockStyle()) : null

  function addNow() {
    if (now === null) return
    editDay((value, caret) => insertAtCaret(value, caret, now))
    announce(`Added ${now}.`)
  }

  function addNowInPlace() {
    if (now === null) return
    const draft = placeDraftRef.current
    updatePlaceDraft(`${draft}${draft === '' || /\s$/.test(draft) ? '' : ' '}${now}`)
  }

  function openPaid() {
    setRow('paid')
    announce('Pick who paid.')
  }

  function addPaid(line: string) {
    editDay((value, caret) => insertPaidLine(value, caret, line))
    setRow('helpers')
    announce(`Added ${line}.`)
  }

  function hideKeyboard() {
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  }

  function toggleWeather(key: Weather) {
    const picked = fieldsRef.current.weather
    setField('weather', cleanWeather(picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key]), true)
  }

  async function goBack() {
    commitPlaceDraft()
    await saver.flush()
    if (saver.isUnsaved()) {
      if (!(await confirmDiscard(true))) return
      saver.discard()
    }
    if (location.key === 'default') navigate(`/meetups/${meetup.id}`, { replace: true })
    else navigate(-1)
  }

  const names = people.map((friend) => friend.name)
  const context = [formatDate(meetup.date, today), names.length > 0 ? `with ${formatNameList(names)}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="day-page">
      <header className="day-page__bar" data-scrolled={scrolled}>
        <button type="button" className="text-button navbar__back" onClick={() => void goBack()}>
          <IconChevronLeft size={26} strokeWidth={2.4} />
          <span className="navbar__back-label">{typeName}</span>
        </button>
        <h1 ref={titleRef} className="day-page__title" tabIndex={-1}>
          The day
        </h1>
        {/* As wide as the back button, so the title stays centered. */}
        <span className="text-button navbar__back day-page__spacer" aria-hidden="true">
          <IconChevronLeft size={26} strokeWidth={2.4} />
          <span className="navbar__back-label">{typeName}</span>
        </span>
      </header>

      <div ref={bodyRef} className="day-page__body" onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}>
        <p className="day-page__context">{context}</p>

        <section className="day-section" aria-labelledby={weatherId}>
          <h2 id={weatherId} className="form-section__label">
            Weather
          </h2>
          <div className="chip-row" role="group" aria-labelledby={weatherId}>
            {WEATHER.map(({ key, emoji, label }) => (
              <Chip key={key} selected={fields.weather.includes(key)} onClick={() => toggleWeather(key)}>
                <span aria-hidden="true">{emoji}</span>
                {label}
              </Chip>
            ))}
          </div>
        </section>

        <section className="day-section" aria-labelledby={dayId}>
          <h2 id={dayId} className="form-section__label">
            The day
          </h2>
          <p id={hintId} className="day-section__hint">
            Start a line with @ for each place, with a time if you like. Lines under a place go with it.
          </p>
          <GrowField
            ref={dayRef}
            minLines={12}
            aria-labelledby={dayId}
            aria-describedby={hintId}
            value={fields.note}
            placeholder={'@Blue willow 3:30\nWho came, what you ate, what you talked about'}
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck
            maxLength={DAY_MAX_TYPED}
            onChange={(event) => setField('note', event.target.value, false)}
            onFocus={() => {
              dayTouched.current = true
              setFocus('note')
            }}
            onBlur={() => {
              setFocus(null)
              void saver.flush()
            }}
          />
          {fields.note.length >= DAY_MAX_TYPED && (
            <p className="field-hint" role="alert">
              This box is full.
            </p>
          )}
        </section>

        {feelingsApply(meetup, today) && (
          <section className="day-section" aria-labelledby={feltId}>
            <h2 id={feltId} className="form-section__label">
              How it felt
            </h2>
            <MoodTiles mood={fields.mood} onChange={(mood) => setField('mood', mood, true)} />
            <GrowField
              minLines={4}
              aria-label="How it felt, in your words"
              value={fields.feelings}
              placeholder="A few words, just for you"
              autoCapitalize="sentences"
              maxLength={FEELINGS_MAX}
              onChange={(event) => setField('feelings', event.target.value, false)}
              onFocus={() => setFocus('feelings')}
              onBlur={() => {
                setFocus(null)
                void saver.flush()
              }}
            />
            {fields.feelings.length >= FEELINGS_MAX && (
              <p className="field-hint" role="alert">
                This box is full.
              </p>
            )}
          </section>
        )}

        <p className="day-page__footnote">Saves as you type, and stays on this iPhone.</p>
      </div>

      <div className="day-page__footer">
        {status.failed && (
          <p className="field-error" role="alert">
            {SAVE_FAILED}
          </p>
        )}
        <DayHelperBar
          row={row}
          feelingsFocused={focused === 'feelings'}
          now={now}
          payers={payersFor(people)}
          placeRef={placeRef}
          placeDraft={placeDraft}
          onPlaceDraftChange={updatePlaceDraft}
          onOpenPlace={openPlace}
          onAddPlace={addPlace}
          onClosePlace={closePlace}
          onNow={addNow}
          onNowInPlace={addNowInPlace}
          onOpenPaid={openPaid}
          onPaid={addPaid}
          onClosePaid={() => setRow('helpers')}
          onHideKeyboard={hideKeyboard}
        />
      </div>

      <p className="visually-hidden" aria-live="polite">
        <span key={announcement.n}>{announcement.text}</span>
      </p>
    </div>
  )
}
