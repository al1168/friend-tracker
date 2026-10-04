import { useEffect } from 'react'
import { keyboardInset } from '../lib/viewport'

/** Publishes the on-screen keyboard height as --keyboard-inset so sheets stay above it. */
export function useKeyboardInset(active: boolean) {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!active || !viewport) return
    const root = document.documentElement
    const update = () => {
      root.style.setProperty('--keyboard-inset', `${keyboardInset(window.innerHeight, viewport)}px`)
      root.style.setProperty('--viewport-height', `${Math.round(viewport.height)}px`)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      root.style.setProperty('--keyboard-inset', '0px')
      root.style.removeProperty('--viewport-height')
    }
  }, [active])
}
