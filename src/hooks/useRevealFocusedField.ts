import { useEffect, type RefObject } from 'react'
import { caretLineSpan } from '../lib/caret'
import { caretEdge, keyboardIsUp, revealMargin, revealOffset, type CaretEdge, type Span } from '../lib/viewport'

/** Input types that type no text and open no picker, so they bring up no keyboard. */
const NO_KEYBOARD = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'])

function isEditable(element: Element | null): element is HTMLElement {
  if (element instanceof HTMLInputElement) return !NO_KEYBOARD.has(element.type)
  return (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  )
}

/**
 * Keeps the focused field on screen inside a sheet's (or the day page's) scrolling body. iOS shows a tapped
 * field while the sheet is still full height; then the keyboard comes up and the sheet shrinks above it (see
 * useKeyboardInset), which left a field low in the sheet out of sight until the first keystroke. A text box
 * taller than the view shows the line with the caret instead, and follows it as you type and move the caret.
 * Only the body scrolls, and only when it shrinks, focus moves, or the caret's line is hidden: never the
 * locked page or the visual viewport, and never while someone is just scrolling.
 */
export function useRevealFocusedField(active: boolean, bodyRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const body = bodyRef.current
    if (!active || !body) return

    /**
     * Scrolls the focused field into view with its scroll margin to spare (var(--space-3) in the CSS, so the
     * browser's own focus scrolling and this agree at every text size); `onlyIfHidden` leaves it while all of
     * it shows.
     */
    const reveal = (onlyIfHidden: boolean) => {
      const field = document.activeElement
      if (!isEditable(field) || !body.contains(field)) return
      const top = body.getBoundingClientRect().top + body.clientTop
      const port = { top, bottom: top + body.clientHeight }
      let target: Span = field.getBoundingClientRect()
      let caret: CaretEdge = 'start'
      if (field instanceof HTMLTextAreaElement) {
        if (field.scrollHeight > field.clientHeight + 1) {
          // A box that scrolls inside itself (the friend sheet's Notes) shows the end you're typing at, when its
          // text runs to the bottom.
          caret = caretEdge(field)
        } else if (target.bottom - target.top > port.bottom - port.top) {
          // A box grown to fit its text never overflows, so its caret can't be read from its scroll: show the
          // caret's line, measured with a mirror of the box.
          target = caretLineSpan(field)
        }
      }
      if (onlyIfHidden && revealOffset(port, target, 0, caret) === 0) return
      const offset = revealOffset(port, target, revealMargin(getComputedStyle(field).scrollMarginBottom), caret)
      if (offset !== 0) body.scrollTop += offset
    }

    // The body shrinks when the keyboard opens, as the sheet follows --keyboard-inset and
    // --viewport-height. This runs after that layout and before paint, so the field never shows hidden.
    // Growing (the keyboard closing, the Save bar's note going away) reveals nothing, so it never pulls
    // the sheet back to a field someone has scrolled away from.
    let lastHeight: number | null = null
    const observer = new ResizeObserver(() => {
      const height = body.clientHeight
      const shrank = lastHeight !== null && height < lastHeight
      lastHeight = height
      if (shrank) reveal(false)
    })
    observer.observe(body)

    // Moving to another field with the keyboard already up changes no size, and neither does typing or moving
    // the caret. Wait a frame so the browser's own scrolling and the text's layout go first, then only act if
    // they left the field (or, in a tall box, the caret's line) out of view: one just in view, close to an edge,
    // is not nudged. Acting, it leaves the same margin as above. Scrolling moves no caret, so it is left alone.
    let frame = 0
    const onChange = () => {
      if (!keyboardIsUp(window.innerHeight, window.visualViewport)) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => reveal(true))
    }
    body.addEventListener('focusin', onChange)
    body.addEventListener('input', onChange)
    document.addEventListener('selectionchange', onChange)

    return () => {
      observer.disconnect()
      body.removeEventListener('focusin', onChange)
      body.removeEventListener('input', onChange)
      document.removeEventListener('selectionchange', onChange)
      cancelAnimationFrame(frame)
    }
  }, [active, bodyRef])
}
