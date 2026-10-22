/** A problem the user can fix. `message` is shown in the UI as-is. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

/** The names browsers give the error for running out of room to store data. */
const QUOTA_NAMES = new Set(['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'])

/**
 * Whether an error is the browser refusing to store more (the phone is full, or the site is at its quota), however
 * Dexie wrapped it: as its own QuotaExceededError, inside an AbortError (`inner`), as one of a BulkError's
 * `failures`, or as a `cause`. Looks a few levels deep at most.
 */
export function isQuotaExceeded(error: unknown, depth = 0): boolean {
  if (depth > 4 || typeof error !== 'object' || error === null) return false
  const { name, inner, cause, failures } = error as { name?: unknown; inner?: unknown; cause?: unknown; failures?: unknown }
  if (typeof name === 'string' && QUOTA_NAMES.has(name)) return true
  const nested = [inner, cause, ...(Array.isArray(failures) ? failures : [])]
  return nested.some((next) => isQuotaExceeded(next, depth + 1))
}
