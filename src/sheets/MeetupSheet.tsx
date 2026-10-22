import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useConfirmDiscard } from '../components/ActionSheet'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { GrowField } from '../components/GrowField'
import { IconCalendar, IconCheck, IconClose, IconSearch } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import type { NavState } from '../components/Page'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useFriends, useMeetupPhotoThumbs, useMeetups, useMeetupTypes } from '../data/hooks'
import { ValidationError } from '../db/errors'
import {
  addMeetup,
  deleteMeetup,
  NO_PHOTO_CHANGES,
  restoreMeetup,
  updateMeetup,
  type MeetupInput,
  type PhotoChanges,
} from '../db/meetups'
import { useToday } from '../hooks/useToday'
import { activitySuggestions } from '../lib/activities'
import { addDays, formatDate, isISODate, todayISO } from '../lib/dates'
import { BOX_FULL, DAY_MAX_TYPED } from '../lib/dayText'
import { isPlainEnter } from '../lib/keys'
import { askToKeepData } from '../lib/persist'
import { compareNames, formatNameList } from '../lib/text'
import { revealOffset } from '../lib/viewport'
import { friendsToPick } from '../stats/friendsToPick'
import { suggestMeetupType } from '../stats/suggestType'
import type { Friend } from '../types'
import { MeetupActivities } from './MeetupActivities'
import { MeetupPhotos, type DraftPhoto } from './MeetupPhotos'
import type { MeetupSheetRequest } from './sheetsContext'
import './MeetupSheet.css'

interface MeetupSheetProps {
  request: MeetupSheetRequest | null
  onClose: () => void
}

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (isPlainEnter(event)) event.currentTarget.blur()
}

const UNDO_FAILED = "Couldn't undo. Please try again."

/** Up to this many friends fill a still grid four across; more make a strip two rows high that swipes sideways. */
const STILL_GRID_MAX = 8

export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
  const [initial] = useState(request)
  const editing = initial?.meetup
  const friends = useFriends()
  const meetups = useMeetups()
  const types = useMeetupTypes()
  const today = useToday()
  const confirmDiscard = useConfirmDiscard()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const whoId = useId()
  const whatId = useId()
  const whenId = useId()
  const dayId = useId()
  const dayHintId = useId()

  const [start] = useState(() => ({
    friendIds: editing?.friendIds ?? (initial?.presetFriendId ? [initial.presetFriendId] : []),
    typeId: editing?.typeId ?? null,
    date: editing?.date ?? todayISO(),
    activities: editing?.activities ?? [],
    note: editing?.note ?? '',
  }))
  const [friendIds, setFriendIds] = useState<string[]>(start.friendIds)
  const [typeId, setTypeId] = useState<string | null>(start.typeId)
  const [date, setDate] = useState(start.date)
  const [activities, setActivities] = useState<string[]>(start.activities)
  const [activityDraft, setActivityDraft] = useState<string | null>(null)
  const [note, setNote] = useState(start.note)
  const [query, setQuery] = useState('')
  // What the search last said aloud ("Added Kim"); `n` makes the same words a new announcement.
  const [said, setSaid] = useState({ text: '', n: 0 })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const typeRowRef = useRef<HTMLDivElement>(null)

  // Photos change only in the sheet until Save. A saved meetup's photos load once, as ids and thumbnails.
  const storedPhotos = useMeetupPhotoThumbs(editing?.id)
  const [photos, setPhotos] = useState<DraftPhoto[] | null>(null)
  const [startPhotoIds, setStartPhotoIds] = useState<string[]>([])
  const [addingPhotos, setAddingPhotos] = useState(false)
  if (photos === null && storedPhotos) {
    setPhotos(storedPhotos)
    setStartPhotoIds(storedPhotos.map((photo) => photo.id))
  }
  // Once the sheet closes, drop the full images of photos added in it: they were only waiting for Save.
  useEffect(() => {
    if (request === null) {
      setPhotos((current) =>
        current?.some((photo) => photo.added) ? current.map(({ id, thumb }) => ({ id, thumb })) : current,
      )
    }
  }, [request])
  const suggestions = useMemo(() => activitySuggestions(meetups ?? []), [meetups])
  // Errors show at the top of the sheet, which may be scrolled away: bring the body back to its top as one appears.
  // Only the body scrolls, never the locked page around it.
  useEffect(() => {
    if (error) errorRef.current?.closest('.sheet__body')?.scrollTo({ top: 0 })
  }, [error])

  // A new meetup starts on a suggested type, worked out again as friends are picked, until a type is tapped; from
  // then on the tapped one sticks. An edit keeps its own type, which typeId starts as. There's no suggestion until
  // both the types and the meetups have loaded: on the types alone it would be the first type, flipping (and moving
  // the What row) as the meetups arrive. Until then no type is picked, so Save is dimmed.
  const suggestedTypeId = useMemo(
    () => (types && meetups ? suggestMeetupType(meetups, friendIds, types, today) : null),
    [meetups, friendIds, types, today],
  )
  const effectiveTypeId = typeId ?? suggestedTypeId
  // A new suggestion's chip comes into view in the What row, as little as it takes, moving only the row's own
  // sideways scroll and never the sheet (the row may be scrolled out of sight while friends are picked).
  useLayoutEffect(() => {
    const row = typeRowRef.current
    const chip = row?.children[types?.findIndex((type) => type.id === suggestedTypeId) ?? -1]
    if (typeId !== null || !row || !(chip instanceof HTMLElement)) return
    const view = row.getBoundingClientRect()
    const target = chip.getBoundingClientRect()
    // Spans along the row: its visible part and the chip, with the row's side padding to spare.
    const margin = parseFloat(getComputedStyle(row).paddingLeft) || 0
    const offset = revealOffset({ top: view.left, bottom: view.right }, { top: target.left, bottom: target.right }, margin)
    if (offset !== 0) row.scrollLeft += offset
  }, [suggestedTypeId, typeId, types])
  const yesterday = addDays(today, -1)
  const isOtherDate = date !== today && date !== yesterday

  const friendById = useMemo(() => new Map((friends ?? []).map((f) => [f.id, f] as const)), [friends])
  const selected = friendIds.map((id) => friendById.get(id)).filter((f): f is Friend => f !== undefined)
  // Who you see most first; from a friend's page, the friends usually with them. Picking friends never reorders it.
  const presetFriendId = initial?.presetFriendId
  const toPick = useMemo(
    () => (friends && meetups ? friendsToPick(friends, meetups, today, presetFriendId) : []),
    [friends, meetups, today, presetFriendId],
  )
  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    if (!q || !friends) return []
    return friends
      .filter((f) => f.name.toLocaleLowerCase().includes(q))
      .sort((a, b) => compareNames(a.name, b.name))
      .slice(0, 20)
  }, [friends, query])

  const sameFriends = [...friendIds].sort().join() === [...start.friendIds].sort().join()
  // Only a tapped type counts as a change, and only one other than the type the sheet would show anyway: the
  // meetup's own (Edit) or the suggestion (Log). A suggestion, or tapping it, never asks "Discard changes?".
  const typeChanged = editing ? typeId !== start.typeId : typeId !== null && typeId !== suggestedTypeId
  const dirty =
    !sameFriends ||
    typeChanged ||
    date !== start.date ||
    activities.join('\n') !== start.activities.join('\n') ||
    !!activityDraft?.trim() ||
    note !== start.note ||
    (photos !== null && photos.map((photo) => photo.id).join() !== startPhotoIds.join())

  function toggleFriend(id: string) {
    setFriendIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
    setError(null)
  }

  /**
   * A friend picked from the search results is added (never removed) and the field is emptied for the next name.
   * Its chip shows just above the field; it's also said aloud, as focus stays in the field.
   */
  function pickFromSearch(friend: Friend) {
    if (!friendIds.includes(friend.id)) {
      setFriendIds((ids) => (ids.includes(friend.id) ? ids : [...ids, friend.id]))
      setSaid((last) => ({ text: `Added ${friend.name}`, n: last.n + 1 }))
    }
    setError(null)
    setQuery('')
    searchRef.current?.focus()
  }

  async function requestClose() {
    if (await confirmDiscard(dirty)) onClose()
  }

  /** Saves the sheet; with `writeDay`, a new meetup then opens its day page, over its Meetup page. */
  async function save(writeDay = false) {
    if (savingRef.current || addingPhotos) return
    if (friendIds.length === 0 || !effectiveTypeId) return
    savingRef.current = true
    setSaving(true)
    // Cleared first, so the same error again is a new alert: shown, scrolled to and said again.
    setError(null)
    try {
      // An activity typed into "+ New" but not added yet is saved too.
      const typed = activityDraft?.trim() ? [...activities, activityDraft] : activities
      const input: MeetupInput = { date, typeId: effectiveTypeId, friendIds, activities: typed }
      // An edit writes The day only when it changed, so it can't overwrite a day written elsewhere since it opened.
      if (!editing || note !== start.note) input.note = note
      const unchanged =
        !photos ||
        (photos.every((photo) => !photo.added) &&
          photos.length === startPhotoIds.length &&
          photos.every((photo, i) => photo.id === startPhotoIds[i]))
      const photoChanges: PhotoChanges = !unchanged && photos
        ? {
            add: photos.flatMap((photo) => (photo.added ? [photo.added] : [])),
            removeIds: startPhotoIds.filter((id) => !photos.some((photo) => photo.id === id)),
            order: photos.map((photo) => photo.id),
          }
        : NO_PHOTO_CHANGES
      let added: string | null = null
      if (editing) {
        await updateMeetup(editing.id, input, photoChanges)
        toast({ message: 'Saved' })
      } else {
        const meetup = await addMeetup(input, photoChanges)
        added = meetup.id
        // "Save and write about the day" confirms on the day page itself, which never shows a toast.
        if (!writeDay) {
          toast({
            message: `Logged with ${formatNameList(selected.map((f) => f.name))}`,
            actionLabel: 'Undo',
            onAction: () => {
              deleteMeetup(meetup.id).catch(() => toast({ message: UNDO_FAILED, tone: 'plain' }))
            },
          })
        }
      }
      // Photos take real space, so ask Safari to keep the data when the phone runs low (best effort).
      if (photoChanges.add.length > 0) void askToKeepData()
      onClose()
      if (writeDay && added) {
        // Back from the day lands on the new memory, whose back button says the friend's name when the sheet
        // was opened from their page.
        const presetFriend = initial?.presetFriendId ? friendById.get(initial.presetFriendId) : undefined
        const fromHere: NavState = { backLabel: presetFriend?.name, tab: (location.state as NavState | null)?.tab }
        navigate(`/meetups/${added}`, { state: fromHere })
        navigate(`/meetups/${added}/day`, { state: { logged: true } satisfies NavState })
      }
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : "Couldn't save. Please try again.")
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const saveDisabled = saving || addingPhotos || friendIds.length === 0 || effectiveTypeId === null

  async function remove() {
    if (!editing) return
    setError(null)
    let deleted
    try {
      deleted = await deleteMeetup(editing.id)
    } catch {
      setError("Couldn't delete. Please try again.")
      return
    }
    onClose()
    if (deleted) {
      toast({
        message: 'Meetup deleted',
        tone: 'plain',
        actionLabel: 'Undo',
        onAction: () => {
          restoreMeetup(deleted)
            .then((restored) => {
              if (!restored) toast({ message: "Couldn't undo: a friend or type in it was deleted.", tone: 'plain' })
            })
            .catch(() => toast({ message: UNDO_FAILED, tone: 'plain' }))
        },
      })
    }
  }

  return (
    <Sheet
      open={request !== null}
      title={editing ? 'Edit meetup' : 'Log meetup'}
      onRequestClose={requestClose}
      action={{ label: 'Save', onClick: () => void save(), disabled: saveDisabled }}
    >
      {error && (
        <p ref={errorRef} className="field-error" role="alert">
          {error}
        </p>
      )}

      <section className="form-section" aria-labelledby={whoId}>
        <h3 id={whoId} className="form-section__label">
          Who
        </h3>
        {toPick.length > 0 && (
          <div
            className="friend-strip"
            data-swipes={toPick.length > STILL_GRID_MAX}
            role="group"
            aria-label="Friends"
          >
            {toPick.map((friend) => {
              const on = friendIds.includes(friend.id)
              return (
                <button
                  key={friend.id}
                  type="button"
                  className="friend-tile"
                  aria-pressed={on}
                  onClick={() => toggleFriend(friend.id)}
                >
                  <span className="friend-tile__avatar">
                    <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={52} />
                    {on && (
                      <span className="friend-tile__check">
                        <IconCheck size={14} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="friend-tile__name">{friend.name}</span>
                </button>
              )
            })}
          </div>
        )}
        {/* The friends picked, then the search. Together they go to the top of the sheet when the search takes
            focus or its text changes, so the results get the room and a friend picked from them shows as a chip
            just above the field (useRevealFocusedField). */}
        <div className="friend-search" data-reveal="top">
          {selected.length > 0 && (
            <div className="chip-wrap" role="group" aria-label="Selected friends">
              {selected.map((friend) => (
                <Chip
                  key={friend.id}
                  active
                  onClick={() => toggleFriend(friend.id)}
                  ariaLabel={`Remove ${friend.name}`}
                >
                  <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={24} />
                  {friend.name}
                  <IconClose size={14} strokeWidth={2.6} />
                </Chip>
              ))}
            </div>
          )}
          <label className="search">
            <IconSearch size={18} />
            <input
              ref={searchRef}
              type="search"
              className="search__input"
              placeholder="Search all friends"
              aria-label="Search all friends"
              enterKeyHint="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={blurOnEnter}
              onBlur={() => setSaid((last) => (last.text ? { text: '', n: last.n } : last))}
            />
          </label>
        </div>
        {query.trim() !== '' &&
          (results.length > 0 ? (
            <div role="group" aria-label="Search results">
              <InsetGroup>
                {results.map((friend) => (
                  <Row
                    key={friend.id}
                    onClick={() => pickFromSearch(friend)}
                    leading={<Avatar name={friend.name} photo={friend.photo} seed={friend.id} />}
                    title={friend.name}
                    trailing={friendIds.includes(friend.id) ? <IconCheck size={20} /> : undefined}
                  />
                ))}
              </InsetGroup>
            </div>
          ) : (
            <p className="list-message">No friends match “{query.trim()}”.</p>
          ))}
        <p className="visually-hidden" aria-live="polite">
          <span key={said.n}>{said.text}</span>
        </p>
      </section>

      <section className="form-section" aria-labelledby={whatId}>
        <h3 id={whatId} className="form-section__label">
          What
        </h3>
        <div ref={typeRowRef} className="chip-row" role="group" aria-labelledby={whatId}>
          {(types ?? []).map((type) => (
            <Chip key={type.id} selected={type.id === effectiveTypeId} onClick={() => {
                setTypeId(type.id)
                setError(null)
              }}>
              <span aria-hidden="true">{type.emoji}</span>
              {type.name}
            </Chip>
          ))}
        </div>
      </section>

      <section className="form-section" aria-labelledby={whenId}>
        <h3 id={whenId} className="form-section__label">
          When
        </h3>
        <div className="chip-wrap" role="group" aria-labelledby={whenId}>
          <Chip selected={date === today} onClick={() => {
              setDate(today)
              setError(null)
            }}>
            Today
          </Chip>
          <Chip selected={date === yesterday} onClick={() => {
              setDate(yesterday)
              setError(null)
            }}>
            Yesterday
          </Chip>
          <label className="chip date-chip" data-selected={isOtherDate}>
            <IconCalendar size={16} />
            {isOtherDate ? formatDate(date, today) : 'Pick date'}
            <input
              type="date"
              className="date-chip__input"
              aria-label={isOtherDate ? `Date, ${formatDate(date, today)}` : 'Pick date'}
              value={date}
              onClick={(event) => {
                try {
                  event.currentTarget.showPicker()
                } catch {
                  // Older browsers open the picker on their own.
                }
              }}
              onChange={(event) => {
                if (isISODate(event.target.value)) {
                  setDate(event.target.value)
                  setError(null)
                }
              }}
            />
          </label>
        </div>
      </section>

      <section className="form-section" aria-labelledby={dayId}>
        <h3 id={dayId} className="form-section__label">
          The day
        </h3>
        <GrowField
          minLines={4}
          highlightPlaces
          aria-labelledby={dayId}
          aria-describedby={dayHintId}
          value={note}
          placeholder="What happened? Start a line with @ for a place."
          autoCapitalize="sentences"
          autoCorrect="on"
          spellCheck
          maxLength={DAY_MAX_TYPED}
          onChange={(event) => {
            setNote(event.target.value)
            setError(null)
          }}
        />
        {/* As on The day page: shown and said once the box stops taking more. */}
        {note.length >= DAY_MAX_TYPED && (
          <p className="field-hint" role="alert">
            {BOX_FULL}
          </p>
        )}
        <p id={dayHintId} className="field-hint">
          Lines that start with @ show as places.
        </p>
      </section>

      <MeetupActivities
        suggestions={suggestions}
        selected={activities}
        onChange={(next) => {
          setActivities(next)
          setError(null)
        }}
        draft={activityDraft}
        onDraftChange={setActivityDraft}
      />

      {photos && (
        <MeetupPhotos
          photos={photos}
          setPhotos={setPhotos}
          onBusyChange={setAddingPhotos}
          open={request !== null}
        />
      )}

      {/* Log meetup only: dimmed whenever Save is. */}
      {!editing && (
        <button
          type="button"
          className="button button--secondary button--block"
          onClick={() => void save(true)}
          disabled={saveDisabled}
        >
          Save and write about the day
        </button>
      )}

      {editing && (
        <InsetGroup>
          <Row title="Delete meetup" destructive onClick={remove} />
        </InsetGroup>
      )}
    </Sheet>
  )
}
