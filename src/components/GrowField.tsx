import { useMemo, type CSSProperties, type Ref, type TextareaHTMLAttributes } from 'react'
import { placeRuns } from '../lib/dayHighlight'
import './GrowField.css'

interface GrowFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> {
  ref?: Ref<HTMLTextAreaElement>
  value: string
  /** How many lines tall the box is at least. */
  minLines: number
  /** Tints each line that reads as a place (an "@" line) behind its words: The day boxes. */
  highlightPlaces?: boolean
}

/**
 * A text box that grows with its text and never scrolls inside itself. The textarea and a copy of its text share
 * one grid cell (the replicated-value technique), so the box is always as tall as what's in it, with no height
 * measuring and no jump in the scroll.
 *
 * With `highlightPlaces`, the copy also sits behind the box as a backdrop: its glyphs are transparent, the box's
 * own background is too, and each place line's words are wrapped in a tinted `mark.day-place` that shows through
 * under the box's text. The copy lays out its text exactly as the box does, so the tints land on their lines; if
 * the two ever disagree by a pixel, only a tint shifts, and the text is never doubled or hidden.
 */
export function GrowField({ ref, value, minLines, highlightPlaces = false, className, ...props }: GrowFieldProps) {
  const runs = useMemo(() => (highlightPlaces ? placeRuns(value) : null), [highlightPlaces, value])
  return (
    <div
      className={highlightPlaces ? 'grow-field grow-field--places' : 'grow-field'}
      style={{ '--min-lines': minLines } as CSSProperties}
    >
      {/* Before the box, so it paints beneath it. A trailing space keeps a last empty line in the copy as tall as it
          is in the box. */}
      <div className="grow-field__copy" aria-hidden="true">
        {runs
          ? runs.map((run, index) =>
              run.place ? (
                <mark key={index} className="day-place">
                  {run.text}
                </mark>
              ) : (
                run.text
              ),
            )
          : value}{' '}
      </div>
      <textarea ref={ref} className={className ? `grow-field__box ${className}` : 'grow-field__box'} value={value} {...props} />
    </div>
  )
}
