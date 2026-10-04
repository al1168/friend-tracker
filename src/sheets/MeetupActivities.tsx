import { useEffect, useId, useRef, useState } from 'react'
import { Chip } from '../components/Chip'
import { IconPlus } from '../components/icons'
import { MAX_ACTIVITIES, TOO_MANY_ACTIVITIES } from '../lib/activities'
import { isPlainEnter } from '../lib/keys'
import { cleanItem, indexOfItem, MAX_ITEM_LENGTH } from '../lib/preferences'

/** How many suggestions show before "More". */
const ACTIVITIES_SHOWN = 12

interface MeetupActivitiesProps {
  /** Every suggestion, best first (see `activitySuggestions`). */
  suggestions: string[]
  /** The meetup's activities, in the order picked. */
  selected: string[]
  onChange: (activities: string[]) => void
  /** The text in the "+ New" field, or null while it's closed. */
  draft: string | null
  onDraftChange: (draft: string | null) => void
}

/** The meetup sheet's Activities section: suggestion chips, "More", and "+ New" with an inline field. */
export function MeetupActivities({ suggestions, selected, onChange, draft, onDraftChange }: MeetupActivitiesProps) {
  const labelId = useId()
  const messageId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const [showAll, setShowAll] = useState(false)
  // The chips after the suggestions, in the order they appeared. Kept when tapped off, so a chip never
  // vanishes or moves under the finger.
  const [extras, setExtras] = useState<string[]>([])
  const [message, setMessage] = useState<{ text: string; n: number } | null>(null)
  // Where focus goes after the next render: a chip by position, or the "+ New" chip.
  const pendingFocus = useRef<number | 'new' | null>(null)
  const [focusTick, setFocusTick] = useState(0)

  const shown = showAll ? suggestions : suggestions.slice(0, ACTIVITIES_SHOWN)
  // An activity on this meetup always shows, even when it isn't among the suggestions shown.
  const chips = [...shown]
  for (const name of [...extras, ...selected]) if (indexOfItem(chips, name) === -1) chips.push(name)
  const hasMore = !showAll && suggestions.slice(ACTIVITIES_SHOWN).some((name) => indexOfItem(chips, name) === -1)

  useEffect(() => {
    const target = pendingFocus.current
    const list = listRef.current
    if (target === null || !list) return
    pendingFocus.current = null
    const buttons = list.querySelectorAll<HTMLButtonElement>('button')
    const button = target === 'new' ? buttons[buttons.length - 1] : buttons[target]
    button?.focus({ preventScroll: true })
  }, [focusTick])

  function focusAfterRender(target: number | 'new') {
    pendingFocus.current = target
    setFocusTick((tick) => tick + 1)
  }

  function showMessage(text: string | null) {
    setMessage((current) => (text === null ? null : { text, n: (current?.n ?? 0) + 1 }))
  }

  /** Freezes the chips after the suggestions where they are now, before the selection changes. */
  function keepExtras(added?: string) {
    const current = chips.slice(shown.length)
    setExtras(added && indexOfItem(chips, added) === -1 ? [...current, added] : current)
  }

  function toggle(name: string) {
    const index = indexOfItem(selected, name)
    if (index === -1 && selected.length >= MAX_ACTIVITIES) {
      showMessage(TOO_MANY_ACTIVITIES)
      return
    }
    keepExtras()
    onChange(index === -1 ? [...selected, name] : selected.filter((_, i) => i !== index))
    showMessage(null)
  }

  function showMore() {
    // The first chip that was hidden takes focus, since "More" goes away.
    focusAfterRender(ACTIVITIES_SHOWN)
    setShowAll(true)
  }

  function closeField() {
    onDraftChange(null)
    showMessage(null)
    focusAfterRender('new')
  }

  /** Add or Enter: selects the typed activity (spelled like a chip when one matches) and closes the field. */
  function add() {
    const name = cleanItem(draft ?? '')
    if (name === '') {
      closeField()
      return
    }
    const known = [...chips, ...suggestions]
    const spelling = known[indexOfItem(known, name)] ?? name
    if (indexOfItem(selected, spelling) === -1) {
      if (selected.length >= MAX_ACTIVITIES) {
        showMessage(TOO_MANY_ACTIVITIES)
        return
      }
      keepExtras(spelling)
      onChange([...selected, spelling])
    }
    closeField()
  }

  return (
    <section className="form-section" aria-labelledby={labelId}>
      <h3 id={labelId} className="form-section__label">
        Activities
      </h3>
      <div ref={listRef} className="chip-wrap" role="group" aria-labelledby={labelId}>
        {chips.map((name) => (
          <Chip
            key={name.toLocaleLowerCase()}
            wrap
            selected={indexOfItem(selected, name) !== -1}
            onClick={() => toggle(name)}
          >
            {name}
          </Chip>
        ))}
        {hasMore && (
          <Chip ariaLabel="More activities" onClick={showMore}>
            More
          </Chip>
        )}
        {draft === null && (
          <Chip ariaLabel="New activity" onClick={() => onDraftChange('')}>
            <IconPlus size={16} strokeWidth={2.4} />
            New
          </Chip>
        )}
      </div>
      {draft !== null && (
        <div className="activity-new">
          <input
            className="field"
            value={draft}
            placeholder="Activity"
            aria-label="New activity"
            aria-describedby={message ? messageId : undefined}
            autoFocus
            autoCapitalize="sentences"
            enterKeyHint="done"
            maxLength={MAX_ITEM_LENGTH}
            onChange={(event) => {
              onDraftChange(event.target.value)
              showMessage(null)
            }}
            onKeyDown={(event) => {
              if (isPlainEnter(event)) {
                event.preventDefault()
                add()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                closeField()
              }
            }}
          />
          <button type="button" className="button button--secondary" onClick={add}>
            Add
          </button>
        </div>
      )}
      {message && (
        <p key={message.n} id={messageId} className="field-hint" role="alert">
          {message.text}
        </p>
      )}
    </section>
  )
}
