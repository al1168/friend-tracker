import { LOCK_OFF, NO_FAILURES, type AppLock, type LockFailures } from '../lock/types'
import { REMINDERS_OFF, type BirthdayReminders } from '../reminders/types'
import { db } from './db'

export interface Settings {
  lastBackupAt: string | null
  /** When Settings was last opened while its tab showed the backup dot (src/backup/nudge.ts). */
  backupNudgeSeenAt: string | null
  installHintDismissed: boolean
  appLock: AppLock
  appLockFailures: LockFailures
  birthdayReminders: BirthdayReminders
}

export const DEFAULT_SETTINGS: Settings = {
  lastBackupAt: null,
  backupNudgeSeenAt: null,
  installHintDismissed: false,
  appLock: LOCK_OFF,
  appLockFailures: NO_FAILURES,
  birthdayReminders: REMINDERS_OFF,
}

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const row = await db.settings.get(key)
  return row === undefined ? DEFAULT_SETTINGS[key] : (row.value as Settings[K])
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value })
}
