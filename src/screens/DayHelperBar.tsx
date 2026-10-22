import { useId, type KeyboardEvent, type Ref, type SyntheticEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { IconChevronDown, IconClose } from '../components/icons'
import { isPlainEnter } from '../lib/keys'
import type { Friend } from '../types'

/** Which row the helper bar shows. */
export type HelperRow = 'helpers' | 'place' | 'paid'

/** One "Who paid?" chip: what it shows (also its name), and the line it writes. */
export interface Payer {
  key: string
  label: string
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
  paidRef: Ref<HTMLButtonElement>
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
 * The day page's helper bar, riding on the keyboard: "@ Place", "Now" (today only) and "Paid", or the Place field
 * (across the whole bar, with "Now" and "Add" on a line under it), or the "Who paid?" chips. Close (for the Place and
 * Who paid rows) and "Hide keyboard" (while the keyboard is up, see DayScreen.css) are pinned at its end, outside the
 * part that scrolls, so they're always on screen.
 *
 * Every control's name starts with the word it shows, so Voice Control's "Tap Now" works: "Now" is named
 * "Now, 9:52 PM", and the "@" in "@ Place" is hidden from VoiceOver.
 */
export function DayHelperBar(props: DayHelperBarProps) {
  const { row, feelingsFocused, now, payers, placeRef, paidRef, placeDraft } = props
  const paidLabelId = useId()
  // How it felt's words are its own: no helper shows for it, and an open row waits until you're back.
  const shown: HelperRow | null = feelingsFocused ? null : row
  const empty = placeDraft.trim() === ''

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
    <div className="day-helpers" role="group" aria-label="Writing helpers" data-row={shown ?? 'none'}>
      {/* The Place field gets a line of its own, so a place and its time show whole as you type them. */}
      {shown === 'place' && (
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
      )}
      <div className="day-helpers__row">
        {shown === 'helpers' && (
          <>
            <button type="button" className="chip" {...keepFocusProps} onClick={props.onOpenPlace}>
              <span aria-hidden="true">@ </span>Place
            </button>
            {now !== null && (
              <button
                type="button"
                className="chip"
                aria-label={`Now, ${now}`}
                {...keepFocusProps}
                onClick={props.onNow}
              >
                Now
              </button>
            )}
            <button ref={paidRef} type="button" className="chip" {...keepFocusProps} onClick={props.onOpenPaid}>
              Paid
            </button>
          </>
        )}

        {shown === 'place' && (
          <>
            {now !== null && (
              <button
                type="button"
                className="chip"
                aria-label={`Now, ${now}`}
                {...keepFocusProps}
                onClick={props.onNowInPlace}
              >
                Now
              </button>
            )}
            {/* Always there, dimmed until there's a place to add, so nothing moves on the first letter. It's
                aria-disabled rather than disabled, so a tap on it still keeps focus (and the keyboard) where it is. */}
            <button
              type="button"
              className="text-button day-helpers__add"
              aria-disabled={empty}
              {...keepFocusProps}
              onClick={empty ? undefined : props.onAddPlace}
            >
              Add
            </button>
          </>
        )}

        {shown === 'paid' && (
          <div className="day-helpers__paid" role="group" aria-labelledby={paidLabelId}>
            <span id={paidLabelId} className="day-helpers__label">
              Who paid?
            </span>
            <div className="day-helpers__payers">
              {payers.map((payer) => (
                <button
                  key={payer.key}
                  type="button"
                  className="chip"
                  {...keepFocusProps}
                  onClick={() => props.onPaid(payer.line)}
                >
                  {payer.friend && (
                    <Avatar name={payer.friend.name} photo={payer.friend.photo} seed={payer.friend.id} size={24} />
                  )}
                  {payer.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {(shown === 'place' || shown === 'paid') && (
        <button
          type="button"
          className="icon-button day-helpers__close"
          aria-label="Close"
          {...keepFocusProps}
          onClick={shown === 'place' ? props.onClosePlace : props.onClosePaid}
        >
          <IconClose size={20} />
        </button>
      )}
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
