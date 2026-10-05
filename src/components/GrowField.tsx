import type { CSSProperties, Ref, TextareaHTMLAttributes } from 'react'
import './GrowField.css'

interface GrowFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> {
  ref?: Ref<HTMLTextAreaElement>
  value: string
  /** How many lines tall the box is at least. */
  minLines: number
}

/**
 * A text box that grows with its text and never scrolls inside itself. The textarea and a hidden copy of its text
 * share one grid cell (the replicated-value technique), so the box is always as tall as what's in it, with no
 * height measuring and no jump in the scroll.
 */
export function GrowField({ ref, value, minLines, className, ...props }: GrowFieldProps) {
  // A trailing space keeps a last empty line in the copy as tall as it is in the box.
  return (
    <div className="grow-field" data-value={`${value} `} style={{ '--min-lines': minLines } as CSSProperties}>
      <textarea ref={ref} className={className ? `grow-field__box ${className}` : 'grow-field__box'} value={value} {...props} />
    </div>
  )
}
