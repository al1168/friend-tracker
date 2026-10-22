import { useEffect, type RefObject } from 'react'
import { caretLineSpan } from '../lib/caret'
import { caretEdge, keyboardIsUp, revealMargin, revealOffset, topOffset, type CaretEdge, type Span } from '../lib/viewport'

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

/** The element marked `data-reveal="top"` around a field, if any (see useRevealFocusedField). */
function topAligned(field: Element): HTMLElement | null {
  return field.closest<HTMLElement>('[data-reveal="top"]')
}

/** Whether a field is marked `data-reveal="start"`: The day page's The day box (see useRevealFocusedField). */
function startAligned(field: Element): boolean {
  return field.closest('[data-reveal="start"]') !== null
}

/**
 * Keeps the focused field on screen inside a sheet's (or the day page's) scrolling body. iOS shows a tapped
 * field while the sheet is still full height; then the keyboard comes up and the sheet shrinks above it (see
 * useKeyboardInset), which left a field low in the sheet out of sight until the first keystroke. A text box
 * taller than the view shows the line with the caret instead, and follows it as you type and move the caret.
 * Only the body scrolls, and only when it shrinks, focus moves, or the caret's line is hidden: never the
 * locked page or the visual viewport, and never while someone is just scrolling.
 *
 * A field inside an element marked `data-reveal="top"` (the meetup sheet's picked friends and friend search) goes to
 * the top of the view instead, that element's top its scroll margin below the header, so what comes up under it (the
 * search's results) gets all the room down to the keyboard. It goes there when it takes focus and whenever its text
 * changes, keyboard or not, and when the body shrinks; moving its caret moves nothing.
 *
 * A text box marked `data-reveal="start"` (The day page's The day) goes to the top once, when the keyboard comes up
 * while it has focus: its top its scroll margin below the header, so the most of it shows, as long as the caret's line
 * still shows there (a long day tapped near its end shows the caret's line instead). Typing and moving the caret then
 * follow the caret as for any field. A helper row opening later (Who paid, Place) shrinks the body with the keyboard
 * already up, so it never moves the box.
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
    /** The part of the body on screen. */
    const view = (): Span => {
      const top = body.getBoundingClientRect().top + body.clientTop
      return { top, bottom: top + body.clientHeight }
    }

    const reveal = (onlyIfHidden: boolean) => {
      const field = document.activeElement
      if (!isEditable(field) || !body.contains(field)) return
      const port = view()
      const box = topAligned(field)
      if (box) {
        const offset = topOffset(port, box.getBoundingClientRect(), revealMargin(getComputedStyle(field).scrollMarginTop))
        if (offset !== 0) body.scrollTop += offset
        return
      }
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

    /**
     * Scrolls a "start" box's top to its scroll margin under the top of the view, if the caret's line still shows
     * there with its margin to spare. Says whether it did.
     */
    const alignStart = (field: HTMLElement): boolean => {
      const port = view()
      const style = getComputedStyle(field)
      const wanted = topOffset(port, field.getBoundingClientRect(), revealMargin(style.scrollMarginTop))
      // No further than the body can scroll.
      const offset = Math.max(-body.scrollTop, Math.min(wanted, body.scrollHeight - body.clientHeight - body.scrollTop))
      const line = field instanceof HTMLTextAreaElement ? caretLineSpan(field) : field.getBoundingClientRect()
      const moved = { top: line.top - offset, bottom: line.bottom - offset }
      if (revealOffset(port, moved, revealMargin(style.scrollMarginBottom)) !== 0) return false
      if (offset !== 0) body.scrollTop += offset
      return true
    }

    // The body shrinks when the keyboard opens, as the sheet follows --keyboard-inset and
    // --viewport-height. This runs after that layout and before paint, so the field never shows hidden.
    // Growing (the keyboard closing) reveals nothing, so it never pulls the sheet back to a field someone has
    // scrolled away from.
    let lastHeight: number | null = null
    // Whether the body has shrunk since the keyboard came up: only that first shrink can align a "start" box.
    let shrankForKeyboard = false
    const observer = new ResizeObserver(() => {
      const height = body.clientHeight
      const shrank = lastHeight !== null && height < lastHeight
      lastHeight = height
      const keyboardUp = keyboardIsUp(window.innerHeight, window.visualViewport)
      const keyboardCameUp = shrank && keyboardUp && !shrankForKeyboard
      shrankForKeyboard = keyboardUp && (shrankForKeyboard || shrank)
      if (!shrank) return
      const field = document.activeElement
      if (keyboardCameUp && isEditable(field) && body.contains(field) && startAligned(field) && alignStart(field)) return
      reveal(false)
    })
    observer.observe(body)

    // Moving to another field with the keyboard already up changes no size, and neither does typing or moving
    // the caret. Wait a frame so the browser's own scrolling and the text's layout go first, then only act if
    // they left the field (or, in a tall box, the caret's line) out of view: one just in view, close to an edge,
    // is not nudged. Acting, it leaves the same margin as above. Scrolling moves no caret, so it is left alone.
    let frame = 0
    const later = (run: () => void) => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(run)
    }
    const onChange = (event: Event) => {
      const field = document.activeElement
      if (field && body.contains(field) && topAligned(field)) {
        // Its results come and go with each letter, so it goes back to the top on focus and on every change.
        if (event.type !== 'selectionchange') later(() => reveal(false))
        return
      }
      if (!keyboardIsUp(window.innerHeight, window.visualViewport)) return
      later(() => reveal(true))
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
