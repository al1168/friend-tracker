/** A vertical stretch of the screen, in CSS pixels from the top of the layout viewport. */
export interface Span {
  top: number
  bottom: number
}

/**
 * How much of the bottom of the layout viewport (`layoutHeight`, window.innerHeight) the on-screen
 * keyboard covers. iOS keeps the layout viewport full height and shrinks only the visual viewport.
 */
export function keyboardInset(layoutHeight: number, viewport: { height: number; offsetTop: number }): number {
  return Math.round(Math.max(0, layoutHeight - viewport.height - viewport.offsetTop))
}

/**
 * How far to scroll a box whose visible area is `port` so that `target` shows with `margin` to spare,
 * moving as little as possible (like scrollIntoView's "nearest"). Positive scrolls down.
 */
export function revealOffset(port: Span, target: Span, margin: number): number {
  const top = port.top + margin
  const bottom = port.bottom - margin
  const above = target.top < top
  const below = target.bottom > bottom
  if (above === below) return 0 // in view, or already filling it
  const taller = target.bottom - target.top > bottom - top
  return above !== taller ? target.top - top : target.bottom - bottom
}
