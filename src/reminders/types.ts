/** Whether this app can get push notifications: only the installed Home Screen app can on iPhone. */
export type PushSupport = 'available' | 'unavailable' | 'denied'

/**
 * What went wrong last, for the Settings footer and the next sync:
 * - `sync`: sending the schedule failed (reminders stay on; the next sync tries again).
 * - `revoked`: iOS dropped the subscription, or notifications were turned off, so reminders stopped.
 * - `delete`: reminders were turned off, but deleting the server's schedule failed (the next sync tries again).
 */
export type ReminderProblem = 'sync' | 'revoked' | 'delete'

/** Stored in the `settings` table, which is never exported or imported. */
export interface BirthdayReminders {
  enabled: boolean
  /** scheduleHash of what the server last accepted. */
  lastSyncedHash: string | null
  /** ISO time the server last accepted the schedule. */
  lastSyncedAt: string | null
  lastError: ReminderProblem | null
}

// Frozen: a shared default, so nothing may change it in place (copy with a spread instead).
export const REMINDERS_OFF: BirthdayReminders = Object.freeze({
  enabled: false,
  lastSyncedHash: null,
  lastSyncedAt: null,
  lastError: null,
})
