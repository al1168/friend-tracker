import { useEffect } from 'react'
import { keyboardInset, keyboardIsUp } from '../lib/viewport'

/** How many sheets and pages are publishing the keyboard right now, like useScrollLock's count. */
let users = 0
let stopListening: (() => void) | null = null

/**
 * Starts publishing the on-screen keyboard for one more user (a sheet, the day page) and returns that user's
 * stop. The first user starts listening to the visual viewport; only the last one to stop resets
 * --keyboard-inset, removes --viewport-height and drops `keyboard-open`, so a sheet still closing can't
 * clear them while the day page is using them.
 */
export function startKeyboardInset(): () => void {
  const viewport = window.visualViewport
  if (!viewport) return () => {}
  users += 1
  if (users === 1) {
    const root = document.documentElement
    const update = () => {
      root.style.setProperty('--keyboard-inset', `${keyboardInset(window.innerHeight, viewport)}px`)
      root.style.setProperty('--viewport-height', `${Math.round(viewport.height)}px`)
      root.classList.toggle('keyboard-open', keyboardIsUp(window.innerHeight, viewport))
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    stopListening = () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      root.style.setProperty('--keyboard-inset', '0px')
      root.style.removeProperty('--viewport-height')
      root.classList.remove('keyboard-open')
    }
  }
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    users -= 1
    if (users === 0) {
      stopListening?.()
      stopListening = null
    }
  }
}

/**
 * Publishes the on-screen keyboard height as --keyboard-inset and the visual viewport's height as
 * --viewport-height, so sheets and the day page stay above it, and marks <html> with `keyboard-open` while
 * the keyboard is up (it covers the home indicator then).
 */
export function useKeyboardInset(active: boolean) {
  useEffect(() => (active ? startKeyboardInset() : undefined), [active])
}
