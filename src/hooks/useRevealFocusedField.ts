import { useEffect, type RefObject } from 'react'
import { keyboardInset, revealOffset } from '../lib/viewport'

/** Room kept between a revealed field and the edges of the sheet's visible area. */
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

function keyboardIsUp() {
  const viewport = window.visualViewport
  return viewport !== null && keyboardInset(window.innerHeight, viewport) > 0
}

/**
 * Keeps the focused field on screen inside a sheet's scrolling body. iOS shows a tapped field while
 * the sheet is still full height; then the keyboard comes up and the sheet shrinks above it (see
 * useKeyboardInset), which left a field low in the sheet out of sight until the first keystroke.
 * Only the body scrolls, and only when its size or the focused field changes: never the locked page
 * or the visual viewport, and never while someone is just scrolling the sheet.
 */
export function useRevealFocusedField(active: boolean, bodyRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const body = bodyRef.current
    if (!active || !body) return

    const reveal = () => {
      const field = document.activeElement
      if (!isEditable(field) || !body.contains(field)) return
      const top = body.getBoundingClientRect().top + body.clientTop
      const offset = revealOffset({ top, bottom: top + body.clientHeight }, field.getBoundingClientRect(), MARGIN)
      if (offset !== 0) body.scrollTop += offset
    }

    // The body changes size when the keyboard opens or closes, as the sheet follows --keyboard-inset
    // and --viewport-height. This runs after that layout and before paint, so the field never shows hidden.
    const observer = new ResizeObserver(reveal)
    observer.observe(body)

    // Moving to another field with the keyboard already up changes no size. Wait a frame so the
    // browser's own scrolling for the focus goes first, then only make up the difference.
    let frame = 0
    const onFocusIn = () => {
      if (!keyboardIsUp()) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(reveal)
    }
    body.addEventListener('focusin', onFocusIn)

    return () => {
      observer.disconnect()
      body.removeEventListener('focusin', onFocusIn)
      cancelAnimationFrame(frame)
    }
  }, [active, bodyRef])
}
