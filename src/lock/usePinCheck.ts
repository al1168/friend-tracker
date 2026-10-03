import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { getSetting } from '../db/settings'
import { checkPin, normalizeFailures } from './lockStore'
import { waitRemainingMs } from './policy'

export const WRONG_PIN = 'Wrong PIN. Try again.'

/** ms left until `until`, re-rendering twice a second while there's a wait. */
export function useWaitRemaining(until: number | null): number {
  const [, setTick] = useState(0)
  const remaining = until === null ? 0 : Math.max(0, until - Date.now())
  const waiting = remaining > 0
  useEffect(() => {
    if (!waiting) return
    const timer = window.setInterval(() => setTick((tick) => tick + 1), 500)
    return () => window.clearInterval(timer)
  }, [waiting])
  return remaining
}

/** State for entering the current PIN, with wrong-PIN counting and the wait after too many. */
export function usePinCheck(onSuccess: () => void) {
  const failures = useLiveQuery(() => getSetting('appLockFailures'))
  const waitMs = useWaitRemaining(failures?.lockedUntil ?? null)
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState('')
  const [shake, setShake] = useState(0)
  const [checking, setChecking] = useState(false)

  // A stored wait longer than the failure count allows (a damaged setting, or a clock that moved) is cut back
  // when this opens and whenever the app comes back to the foreground, so the countdown never overstates it.
  useEffect(() => {
    const normalize = () => {
      normalizeFailures().catch(() => {
        // Storage unavailable: checkPin still cuts the wait back when a PIN is tried.
      })
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') normalize()
    }
    normalize()
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  async function submit(value: string) {
    setChecking(true)
    let unlocked = false
    try {
      const outcome = await checkPin(value, Date.now())
      if (outcome.result === 'ok') {
        unlocked = true
      } else {
        // During a wait the countdown (PinMessage) says it; no text is kept that could outlive the wait.
        setMessage(waitRemainingMs(outcome.failures, Date.now()) > 0 ? '' : WRONG_PIN)
        setShake((count) => count + 1)
      }
    } catch {
      setMessage("Couldn't check your PIN. Please try again.")
    }
    setPin('')
    setChecking(false)
    if (unlocked) onSuccess()
  }

  function change(value: string) {
    setPin(value)
    if (value.length > 0) setMessage('')
  }

  return {
    pinPad: {
      value: pin,
      onChange: change,
      onComplete: submit,
      disabled: waitMs > 0,
      busy: checking,
      shake,
    },
    message,
    setMessage,
    waitMs,
  }
}
