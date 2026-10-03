import { useEffect } from 'react'

let locks = 0

/** Stops the page behind a sheet from scrolling. Counts nested sheets. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    locks += 1
    document.documentElement.classList.add('scroll-locked')
    return () => {
      locks -= 1
      if (locks === 0) document.documentElement.classList.remove('scroll-locked')
    }
  }, [active])
}
