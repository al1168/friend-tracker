import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'

const RESTORE_WINDOW_MS = 1000

/** Scrolls to `y`, retrying until the page is tall enough. Returns a cancel function. */
function restoreScroll(y: number): () => void {
  const start = performance.now()
  let frame = 0
  let finished = false

  const cancel = () => {
    if (finished) return
    finished = true
    cancelAnimationFrame(frame)
    window.removeEventListener('touchstart', cancel)
    window.removeEventListener('wheel', cancel)
  }

  const attempt = () => {
    if (finished) return
    window.scrollTo(0, y)
    if (Math.abs(window.scrollY - y) <= 1 || performance.now() - start > RESTORE_WINDOW_MS) {
      cancel()
      return
    }
    frame = requestAnimationFrame(attempt)
  }

  window.addEventListener('touchstart', cancel, { passive: true })
  window.addEventListener('wheel', cancel, { passive: true })
  attempt()
  return cancel
}

export function ScrollManager() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const currentKey = useRef(location.key)

  useEffect(() => {
    const onScroll = () => positions.current.set(currentKey.current, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    currentKey.current = location.key
    const saved = positions.current.get(location.key)
    if (navigationType === 'POP' && saved !== undefined) return restoreScroll(saved)
    window.scrollTo(0, 0)
  }, [location.key, navigationType])

  return null
}
