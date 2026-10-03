import { parseLastActive } from './policy'

/** localStorage key for the last time the app was open and in use (ms timestamp). */
export const LAST_ACTIVE_KEY = 'ft:lastActiveAt'

export function readLastActive(): number | null {
  try {
    return parseLastActive(localStorage.getItem(LAST_ACTIVE_KEY))
  } catch {
    return null
  }
}

export function markActive(now = Date.now()): void {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(now))
  } catch {
    // Storage unavailable: the next launch reads nothing, and a locked app stays locked.
  }
}
