import { useId, type KeyboardEvent, type Ref, type SyntheticEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { IconChevronDown, IconClose } from '../components/icons'
import { isPlainEnter } from '../lib/keys'
import type { Friend } from '../types'

/** Which row the helper bar shows. */
export type HelperRow = 'helpers' | 'place' | 'paid'

/** One "Who paid?" chip: what it shows, its name for VoiceOver, and the line it writes. */
export interface Payer {
  key: string
  label: string
  name: string
  line: string
  friend?: Friend
}

interface DayHelperBarProps {
  row: HelperRow
  /** While the How it felt box has focus, only "Hide keyboard" shows: the helpers write into The day. */
  feelingsFocused: boolean
  /** The current time as you'd type it ("9:52 PM"), when the meetup is today; null otherwise. */
  now: string | null
  payers: Payer[]
  placeRef: Ref<HTMLInputElement>
  placeDraft: string
  onPlaceDraftChange: (text: string) => void
  onOpenPlace: () => void
  onAddPlace: () => void
  onClosePlace: () => void
  onNow: () => void
  onNowInPlace: () => void
  onOpenPaid: () => void
  onPaid: (line: string) => void
  onClosePaid: () => void
  onHideKeyboard: () => void
}

/** Keeps focus where it is (and the keyboard up) when a helper is tapped. */
function keepFocus(event: SyntheticEvent) {
  event.preventDefault()
}

const keepFocusProps = { onPointerDown: keepFocus, onMouseDown: keepFocus }

/**
 * The day page's helper bar, riding on the keyboard: "@ Place", "Now" (today only) and "Paid", or the Place field,
 * or the "Who paid?" chips, with "Hide keyboard" pinned at the end while the keyboard is up (see DayScreen.css).
 */
export function DayHelperBar(props: DayHelperBarProps) {
  const { row, feelingsFocused, now, payers, placeRef, placeDraft } = props
  const paidLabelId = useId()

  function onPlaceKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (isPlainEnter(event)) {
      event.preventDefault()
      props.onAddPlace()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      props.onClosePlace()
    }
  }

  return (
    <div className="day-helpers" role="group" aria-label="Writing helpers">
      <div className="day-helpers__row">
        {row === 'helpers' && !feelingsFocused && (
          <>
            <button type="button" className="chip" aria-label="Add a place" {...keepFocusProps} onClick={props.onOpenPlace}>
              @ Place
            </button>
            {now !== null && (
              <button type="button" className="chip" aria-label={`Add the time, ${now}`} {...keepFocusProps} onClick={props.onNow}>
                Now
              </button>
            )}
            <button type="button" className="chip" aria-expanded={false} {...keepFocusProps} onClick={props.onOpenPaid}>
              Paid
            </button>
          </>
        )}

        {row === 'place' && (
          <>
            <input
              ref={placeRef}
              className="field day-place"
              aria-label="Place and time"
              placeholder="Place, then a time if you like"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              value={placeDraft}
              onChange={(event) => props.onPlaceDraftChange(event.target.value)}
              onKeyDown={onPlaceKeyDown}
            />
            {now !== null && (
              <button type="button" className="chip" aria-label={`Add the time, ${now}`} {...keepFocusProps} onClick={props.onNowInPlace}>
                Now
              </button>
            )}
            {placeDraft.trim() !== '' && (
              <button type="button" className="text-button day-helpers__add" {...keepFocusProps} onClick={props.onAddPlace}>
                Add
              </button>
            )}
            <button type="button" className="icon-button" aria-label="Close" {...keepFocusProps} onClick={props.onClosePlace}>
              <IconClose size={20} />
            </button>
          </>
        )}

        {row === 'paid' && (
          <div className="day-helpers__paid" role="group" aria-labelledby={paidLabelId}>
            <span id={paidLabelId} className="day-helpers__label">
              Who paid?
            </span>
            {payers.map((payer) => (
              <button
                key={payer.key}
                type="button"
                className="chip"
                aria-label={payer.name === payer.label ? undefined : payer.name}
                {...keepFocusProps}
                onClick={() => props.onPaid(payer.line)}
              >
                {payer.friend && (
                  <Avatar name={payer.friend.name} photo={payer.friend.photo} seed={payer.friend.id} size={24} />
                )}
                {payer.label}
              </button>
            ))}
            <button type="button" className="icon-button" aria-label="Close" {...keepFocusProps} onClick={props.onClosePaid}>
              <IconClose size={20} />
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        className="icon-button day-helpers__hide"
        aria-label="Hide keyboard"
        {...keepFocusProps}
        onClick={props.onHideKeyboard}
      >
        <IconChevronDown size={24} strokeWidth={2.2} />
      </button>
    </div>
  )
}
