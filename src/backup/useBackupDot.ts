import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { getSetting } from '../db/settings'
import { useToday } from '../hooks/useToday'
import { BACKUP_NUDGE_DAYS, backupDue, daysSince, showBackupDot } from './nudge'

/**
 * Whether the Settings tab shows its backup dot, as one live query. It reads no meetup while the dot was seen in the
 * last 30 days or the last backup is less than 30 days old; otherwise it stops at the first meetup that makes a backup
 * due (`createdAt` has no index, but meetups hold no photos). Asked again as the day changes. `undefined` while it
 * loads.
 */
export function useBackupDot(): boolean | undefined {
  const today = useToday()
  return useLiveQuery(async () => {
    const now = new Date()
    const [lastBackupAt, seenAt] = await Promise.all([getSetting('lastBackupAt'), getSetting('backupNudgeSeenAt')])
    if (!showBackupDot(true, seenAt, now)) return false
    const sinceBackup = daysSince(lastBackupAt, now)
    if (sinceBackup !== null && sinceBackup < BACKUP_NUDGE_DAYS) return false
    const first = await db.meetups.filter((meetup) => backupDue([meetup], lastBackupAt, now)).first()
    return showBackupDot(first !== undefined, seenAt, now)
  }, [today])
}
