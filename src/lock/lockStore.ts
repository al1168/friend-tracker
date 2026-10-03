// Reads and writes the app lock settings. PINs are only ever stored as hashes.

import { getSetting, setSetting } from '../db/settings'
import { hashPin, verifyPin } from './pin'
import { addFailure, waitRemainingMs } from './policy'
import { LOCK_OFF, NO_FAILURES, type LockFailures } from './types'

export type PinCheck =
  | { result: 'ok' }
  | { result: 'wrong'; failures: LockFailures }
  | { result: 'wait'; failures: LockFailures }

export async function turnOnLock(pin: string): Promise<void> {
  const hash = await hashPin(pin)
  await setSetting('appLock', { enabled: true, pin: hash, passkeyId: null })
  await setSetting('appLockFailures', NO_FAILURES)
}

/** Replaces the PIN (keeps Face ID) and clears any wrong-PIN wait. */
export async function changePin(pin: string): Promise<void> {
  const hash = await hashPin(pin)
  const lock = await getSetting('appLock')
  await setSetting('appLock', { ...lock, enabled: true, pin: hash })
  await setSetting('appLockFailures', NO_FAILURES)
}

export async function setPasskey(passkeyId: string | null): Promise<void> {
  const lock = await getSetting('appLock')
  await setSetting('appLock', { ...lock, passkeyId })
}

export async function turnOffLock(): Promise<void> {
  await setSetting('appLock', LOCK_OFF)
  await setSetting('appLockFailures', NO_FAILURES)
}

export async function resetFailures(): Promise<void> {
  await setSetting('appLockFailures', NO_FAILURES)
}

/** Checks a PIN, counting wrong ones. During a wait it doesn't check at all. */
export async function checkPin(pin: string, now: number): Promise<PinCheck> {
  const [lock, failures] = await Promise.all([getSetting('appLock'), getSetting('appLockFailures')])
  if (waitRemainingMs(failures, now) > 0) return { result: 'wait', failures }
  if (lock.pin !== null && (await verifyPin(pin, lock.pin))) {
    await setSetting('appLockFailures', NO_FAILURES)
    return { result: 'ok' }
  }
  const next = addFailure(failures, now)
  await setSetting('appLockFailures', next)
  return { result: waitRemainingMs(next, now) > 0 ? 'wait' : 'wrong', failures: next }
}
