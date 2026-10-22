import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useContext } from 'react'
import { db } from '../db/db'
import { getSetting } from '../db/settings'
import { useToday } from '../hooks/useToday'
import { BACKUP_NUDGE_DAYS, backupDue, daysSince, showBackupDot } from './nudge'

/** The one backup dot answer the tab bar and Settings share (BackupDotProvider): undefined while it loads. */
export const BackupDotContext = createContext<boolean | undefined>(undefined)

/**
 * Whether the Settings tab shows its backup dot, as one live query for the whole app (BackupDotProvider runs it). It
 * reads no meetup while the dot was seen in the last 30 days or the last backup is less than 30 days old; otherwise it
 * stops at the first meetup that makes a backup due (`createdAt` has no index, but meetups hold no photos). Asked
 * again as the day changes. While `active` is false (the day page, which has no tab bar) it reads nothing. `undefined`
 * while it loads.
 */
export function useBackupDotQuery(active: boolean): boolean | undefined {
  const today = useToday()
  return useLiveQuery(async () => {
    if (!active) return undefined
    const now = new Date()
    const [lastBackupAt, seenAt] = await Promise.all([getSetting('lastBackupAt'), getSetting('backupNudgeSeenAt')])
    if (!showBackupDot(true, seenAt, now)) return false
    const sinceBackup = daysSince(lastBackupAt, now)
    if (sinceBackup !== null && sinceBackup < BACKUP_NUDGE_DAYS) return false
    const first = await db.meetups.filter((meetup) => backupDue([meetup], lastBackupAt, now)).first()
    return showBackupDot(first !== undefined, seenAt, now)
  }, [today, active])
}

/** Whether the Settings tab shows its backup dot, shared from BackupDotProvider. `undefined` while it loads. */
export function useBackupDot(): boolean | undefined {
  return useContext(BackupDotContext)
}
