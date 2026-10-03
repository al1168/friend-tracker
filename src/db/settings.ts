import { LOCK_OFF, NO_FAILURES, type AppLock, type LockFailures } from '../lock/types'
import { db } from './db'

export interface Settings {
  lastBackupAt: string | null
  installHintDismissed: boolean
  appLock: AppLock
  appLockFailures: LockFailures
}

export const DEFAULT_SETTINGS: Settings = {
  lastBackupAt: null,
  installHintDismissed: false,
  appLock: LOCK_OFF,
  appLockFailures: NO_FAILURES,
}

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const row = await db.settings.get(key)
  return row === undefined ? DEFAULT_SETTINGS[key] : (row.value as Settings[K])
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value })
}
