/** A PBKDF2-SHA256 hash of the PIN. `hash` and `salt` are base64. */
export interface PinHash {
  hash: string
  salt: string
  iterations: number
}

/** Stored in the `settings` table, which is never exported or imported. */
export interface AppLock {
  enabled: boolean
  pin: PinHash | null
  /** WebAuthn credential id (base64url) for Face ID, or null. */
  passkeyId: string | null
}

export interface LockFailures {
  /** Wrong PINs in a row. */
  count: number
  /** ms timestamp until which PIN entry is paused, or null. */
  lockedUntil: number | null
}

export const LOCK_OFF: AppLock = { enabled: false, pin: null, passkeyId: null }

export const NO_FAILURES: LockFailures = { count: 0, lockedUntil: null }
