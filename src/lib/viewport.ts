/** A vertical stretch of the screen, in CSS pixels from the top of the layout viewport. */
export interface Span {
  top: number
  bottom: number
}

/** Which end of a field to show when it is taller than the view: its top or its bottom (see caretEdge). */
export type CaretEdge = 'start' | 'end'

/** A text box's caret and size, as an HTMLTextAreaElement has them. */
export interface TextBox {
  value: string
  selectionEnd: number | null
  scrollHeight: number
  clientHeight: number
}

/** The room kept around a field the app scrolls into view when its CSS sets none it can read. */
const DEFAULT_REVEAL_MARGIN = 12

/**
 * The room to keep between a revealed field and the edges of the visible area: the field's own scroll margin
 * (a computed length such as "17.25px"), so the CSS that also guides the browser's own focus scrolling is the
 * one source at every text size. 12px when it can't be read.
 */
export function revealMargin(scrollMargin: string): number {
  const margin = parseFloat(scrollMargin)
  return Number.isNaN(margin) ? DEFAULT_REVEAL_MARGIN : margin
}

/** How much shorter than the layout viewport the visual viewport must be before it counts as the keyboard. */
const KEYBOARD_MIN_HEIGHT = 50

/**
 * How much of the bottom of the layout viewport (`layoutHeight`, window.innerHeight) the on-screen
 * keyboard covers. iOS keeps the layout viewport full height and shrinks only the visual viewport.
 * For placing things above the keyboard only: it drops to 0 when iOS pans the visual viewport down.
 */
export function keyboardInset(layoutHeight: number, viewport: { height: number; offsetTop: number }): number {
  return Math.round(Math.max(0, layoutHeight - viewport.height - viewport.offsetTop))
}

/**
 * Whether the on-screen keyboard is up: the visual viewport, at normal zoom, is more than 50px shorter
 * than the layout viewport. Unlike keyboardInset this ignores offsetTop, since iOS pans the visual
 * viewport to show a field while the keyboard stays up. False without a visual viewport at all.
 * Normal zoom is a scale within 0.01 of 1, since a floating-point scale can come back as 1.0000001.
 */
export function keyboardIsUp(
  layoutHeight: number,
  viewport: { height: number; scale: number } | null | undefined,
): boolean {
  return (
    viewport != null && Math.abs(viewport.scale - 1) < 0.01 && layoutHeight - viewport.height > KEYBOARD_MIN_HEIGHT
  )
}

/**
 * Which end of a text box to show when the box is taller than the view: the end only when the caret
 * (`selectionEnd`, null when it has none) reaches the last character or past it and the text runs past
 * the box, since only then does the end of the text sit at the bottom of the box. Otherwise the top,
 * where text that fits begins and an empty box has its caret. A pixel of rounding between scrollHeight
 * and clientHeight is not overflow.
 */
export function caretEdge(box: TextBox): CaretEdge {
  const overflows = box.scrollHeight > box.clientHeight + 1
  const atEnd = box.selectionEnd !== null && box.selectionEnd >= box.value.length - 1
  return overflows && atEnd ? 'end' : 'start'
}

/**
 * How far to scroll a box whose visible area is `port` so that `target` shows with `margin` to spare,
 * moving as little as possible (like scrollIntoView's "nearest"). Positive scrolls down. The margin
 * shrinks to whatever room there is, so a field that fits always shows whole. A field taller than
 * the view shows its top edge, or its bottom edge when the `caret` is at its end; one that already
 * fills the view stays put unless that end is hidden. Whole pixels, a little further rather than short,
 * since scrollTop drops a fraction and would leave a sliver of the field out.
 */
export function revealOffset(port: Span, target: Span, margin: number, caret: CaretEdge = 'start'): number {
  const room = port.bottom - port.top - (target.bottom - target.top)
  const spare = Math.max(0, Math.min(margin, room / 2))
  const top = port.top + spare
  const bottom = port.bottom - spare
  const above = target.top < top
  const below = target.bottom > bottom
  if (room < 0) {
    if (caret === 'end') return wholePixels(target.bottom - bottom)
    return above && below ? 0 : wholePixels(target.top - top)
  }
  if (above) return wholePixels(target.top - top)
  if (below) return wholePixels(target.bottom - bottom)
  return 0
}

/**
 * How far to scroll a box whose visible area is `port` so that `target`'s top sits `margin` below the top of it,
 * wherever the target is now: the friend search goes there so its results fill the room below. Positive scrolls
 * down. Whole pixels, and 0 within a pixel, so a field already there is never nudged.
 */
export function topOffset(port: Span, target: Span, margin: number): number {
  const offset = Math.round(target.top - (port.top + margin))
  return offset === 0 ? 0 : offset
}

/** Rounds away from zero. */
function wholePixels(offset: number): number {
  return offset > 0 ? Math.ceil(offset) : Math.floor(offset)
}
