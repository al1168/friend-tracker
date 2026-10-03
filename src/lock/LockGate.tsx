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
    // The only way to record activity: lock if the gap since the last record is too long (a frozen page
    // can skip pings), otherwise record now. Never record without this check first.
    const check = () => {
      if (shouldLock({ enabled, lastActiveAt: readLastActive(), now: Date.now() })) setState('locked')
      else markActive()
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) check()
    }
    const onVisibilityChange = () => check()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') check()
    }, ACTIVE_PING_MS)
    check()
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', check)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('focus', check)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', check)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('focus', check)
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
