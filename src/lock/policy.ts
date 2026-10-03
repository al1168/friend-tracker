import type { LockFailures } from './types'

/** Lock again after this long away from the app. */
export const RELOCK_AFTER_MS = 15 * 60_000
/** How often the open app records that it's still in use. */
export const ACTIVE_PING_MS = 30_000

const FREE_ATTEMPTS = 4
const FIRST_WAIT_MS = 30_000
const LONGEST_WAIT_MS = 15 * 60_000
/** A clock step back of up to this much (an NTP or carrier correction) does not lock the app. */
const CLOCK_STEP_TOLERANCE_MS = 60_000

export function shouldLock({
  enabled,
  lastActiveAt,
  now,
}: {
  enabled: boolean
  lastActiveAt: number | null
  now: number
}): boolean {
  if (!enabled) return false
  // A clock that went back by more than a minute also locks (a small NTP or carrier correction does not).
  return lastActiveAt === null || now < lastActiveAt - CLOCK_STEP_TOLERANCE_MS || now - lastActiveAt >= RELOCK_AFTER_MS
}

/** The pause after this many wrong PINs in a row: none for 1 to 4, then 30 s, doubling up to 15 minutes. */
export function backoffMs(failures: number): number {
  if (failures <= FREE_ATTEMPTS) return 0
  return Math.min(FIRST_WAIT_MS * 2 ** (failures - FREE_ATTEMPTS - 1), LONGEST_WAIT_MS)
}

export function addFailure(failures: LockFailures, now: number): LockFailures {
  const count = failures.count + 1
  const wait = backoffMs(count)
  return { count, lockedUntil: wait > 0 ? now + wait : null }
}

export function waitRemainingMs(failures: LockFailures, now: number): number {
  return failures.lockedUntil === null ? 0 : Math.max(0, failures.lockedUntil - now)
}

/** "0:30", "2:00", "15:00" (rounded up to the second). */
export function formatWait(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** The stored last-active time, or null when it's missing or unreadable (which locks the app). */
export function parseLastActive(raw: string | null): number | null {
  if (raw === null || !/^\d{1,16}$/.test(raw)) return null
  return Number(raw)
}
