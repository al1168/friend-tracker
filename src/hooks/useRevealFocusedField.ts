import { useEffect, type RefObject } from 'react'
import { caretEdge, keyboardIsUp, revealOffset } from '../lib/viewport'

/** Room kept between a field the app scrolls into view and the edges of the sheet's visible area. */
const MARGIN = 12

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
 * Keeps the focused field on screen inside a sheet's scrolling body. iOS shows a tapped field while
 * the sheet is still full height; then the keyboard comes up and the sheet shrinks above it (see
 * useKeyboardInset), which left a field low in the sheet out of sight until the first keystroke.
 * Only the body scrolls, and only when it shrinks or focus moves to another field: never the locked
 * page or the visual viewport, and never while someone is just scrolling the sheet.
 */
export function useRevealFocusedField(active: boolean, bodyRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const body = bodyRef.current
    if (!active || !body) return

    /** Scrolls the focused field into view with MARGIN to spare; `onlyIfHidden` leaves it while all of it shows. */
    const reveal = (onlyIfHidden: boolean) => {
      const field = document.activeElement
      if (!isEditable(field) || !body.contains(field)) return
      const top = body.getBoundingClientRect().top + body.clientTop
      const port = { top, bottom: top + body.clientHeight }
      const rect = field.getBoundingClientRect()
      // A note taller than the view shows the end you're typing at, when its text runs to the bottom.
      const caret = field instanceof HTMLTextAreaElement ? caretEdge(field) : 'start'
      if (onlyIfHidden && revealOffset(port, rect, 0, caret) === 0) return
      const offset = revealOffset(port, rect, MARGIN, caret)
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

    // Moving to another field with the keyboard already up changes no size. Wait a frame so the
    // browser's own scrolling for the focus goes first, then only act if it left part of the field out of
    // view: one just in view, close to an edge, is not nudged. Acting, it leaves the same margin as above.
    let frame = 0
    const onFocusIn = () => {
      if (!keyboardIsUp(window.innerHeight, window.visualViewport)) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => reveal(true))
    }
    body.addEventListener('focusin', onFocusIn)

    return () => {
      observer.disconnect()
      body.removeEventListener('focusin', onFocusIn)
      cancelAnimationFrame(frame)
    }
  }, [active, bodyRef])
}
