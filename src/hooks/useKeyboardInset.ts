import { useEffect } from 'react'
import { keyboardInset, keyboardIsUp } from '../lib/viewport'

/**
 * Publishes the on-screen keyboard height as --keyboard-inset so sheets stay above it, and marks
 * <html> with `keyboard-open` while the keyboard is up (it covers the home indicator then).
 */
export function useKeyboardInset(active: boolean) {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!active || !viewport) return
    const root = document.documentElement
    const update = () => {
      root.style.setProperty('--keyboard-inset', `${keyboardInset(window.innerHeight, viewport)}px`)
      root.style.setProperty('--viewport-height', `${Math.round(viewport.height)}px`)
      root.classList.toggle('keyboard-open', keyboardIsUp(window.innerHeight, viewport))
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      root.style.setProperty('--keyboard-inset', '0px')
      root.style.removeProperty('--viewport-height')
      root.classList.remove('keyboard-open')
    }
  }, [active])
}
