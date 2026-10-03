import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'

function restoreScroll(y: number) {
  let tries = 0
  const attempt = () => {
    window.scrollTo(0, y)
    if (Math.abs(window.scrollY - y) > 1 && tries++ < 20) requestAnimationFrame(attempt)
  }
  attempt()
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
    if (navigationType === 'POP' && saved !== undefined) restoreScroll(saved)
    else window.scrollTo(0, 0)
  }, [location.key, navigationType])

  return null
}
