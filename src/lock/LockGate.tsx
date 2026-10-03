import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState, type ReactNode } from 'react'
import { getSetting } from '../db/settings'
import { markActive, readLastActive } from './activity'
import { LockScreen } from './LockScreen'
import { ACTIVE_PING_MS, shouldLock } from './policy'

type GateState = 'checking' | 'locked' | 'open'

/**
 * Renders the app only while unlocked. When locked it renders the lock screen instead, so no
 * routes, tab bar or data queries are mounted.
 */
export function LockGate({ children }: { children: ReactNode }) {
  const lock = useLiveQuery(() => getSetting('appLock'))
  const [state, setState] = useState<GateState>('checking')
  const enabled = lock !== undefined && lock.enabled && lock.pin !== null

  // At launch: decide once, from the last-active time the previous session left behind.
  if (lock !== undefined && state === 'checking') {
    setState(shouldLock({ enabled, lastActiveAt: readLastActive(), now: Date.now() }) ? 'locked' : 'open')
  }

  useEffect(() => {
    if (state !== 'open') return
    markActive()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        markActive()
      } else if (shouldLock({ enabled, lastActiveAt: readLastActive(), now: Date.now() })) {
        setState('locked')
      } else {
        markActive()
      }
    }
    const onPageHide = () => markActive()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') markActive()
    }, ACTIVE_PING_MS)
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [state, enabled])

  if (lock === undefined || state === 'checking') return null
  if (state === 'locked') {
    return (
      <LockScreen
        lock={lock}
        onUnlock={() => {
          markActive()
          setState('open')
        }}
      />
    )
  }
  return children
}
