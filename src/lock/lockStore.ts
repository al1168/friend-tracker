// Reads and writes the app lock settings. PINs are only ever stored as hashes.
// A PIN is hashed first, then the settings are written in one transaction (never hold one across PBKDF2).

import { db } from '../db/db'
import { getSetting, setSetting } from '../db/settings'
import { hashPin, verifyPin } from './pin'
import { addFailure, backoffMs, waitRemainingMs } from './policy'
import { LOCK_OFF, NO_FAILURES, type LockFailures } from './types'

export type PinCheck =
  | { result: 'ok' }
  | { result: 'wrong'; failures: LockFailures }
  | { result: 'wait'; failures: LockFailures }

export async function turnOnLock(pin: string): Promise<void> {
  const hash = await hashPin(pin)
  await db.transaction('rw', db.settings, async () => {
    await setSetting('appLock', { enabled: true, pin: hash, passkeyId: null })
    await setSetting('appLockFailures', NO_FAILURES)
  })
}

/** Replaces the PIN (keeps Face ID) and clears any wrong-PIN wait. */
export async function changePin(pin: string): Promise<void> {
  const hash = await hashPin(pin)
  await db.transaction('rw', db.settings, async () => {
    const lock = await getSetting('appLock')
    await setSetting('appLock', { ...lock, enabled: true, pin: hash })
    await setSetting('appLockFailures', NO_FAILURES)
  })
}

export async function setPasskey(passkeyId: string | null): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const lock = await getSetting('appLock')
    await setSetting('appLock', { ...lock, passkeyId })
  })
}

export async function turnOffLock(): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    await setSetting('appLock', LOCK_OFF)
    await setSetting('appLockFailures', NO_FAILURES)
  })
}

export async function resetFailures(): Promise<void> {
  await setSetting('appLockFailures', NO_FAILURES)
}

/**
 * A wait longer than the count allows (a damaged setting, or a clock that moved) is cut back to what it should be,
 * and saved. Call it when the lock screen opens and when the app returns to the foreground.
 */
export async function normalizeFailures(now = Date.now()): Promise<LockFailures> {
  return db.transaction('rw', db.settings, async () => {
    const failures = await getSetting('appLockFailures')
    if (failures.lockedUntil === null || failures.lockedUntil - now <= backoffMs(failures.count)) return failures
    const rebased = { ...failures, lockedUntil: now + backoffMs(failures.count) }
    await setSetting('appLockFailures', rebased)
    return rebased
  })
}

/**
 * Checks a PIN, counting wrong ones. During a wait it doesn't check at all. A stored hash that can't be read
 * makes this reject (without counting a failure); a missing PIN never passes.
 */
export async function checkPin(pin: string, now: number): Promise<PinCheck> {
  const lock = await getSetting('appLock')
  const failures = await normalizeFailures(now)
  if (waitRemainingMs(failures, now) > 0) return { result: 'wait', failures }
  if (lock.pin !== null && (await verifyPin(pin, lock.pin))) {
    await setSetting('appLockFailures', NO_FAILURES)
    return { result: 'ok' }
  }
  // Re-read inside the transaction so two quick wrong PINs both count.
  const next = await db.transaction('rw', db.settings, async () => {
    const updated = addFailure(await getSetting('appLockFailures'), now)
    await setSetting('appLockFailures', updated)
    return updated
  })
  return { result: waitRemainingMs(next, now) > 0 ? 'wait' : 'wrong', failures: next }
}
