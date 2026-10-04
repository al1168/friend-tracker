import { setSetting } from '../db/settings'
import { todayISO } from '../lib/dates'
import { backupFileName, createBackup, parseBackup, type BackupData } from './format'

export type ExportOutcome =
  | { outcome: 'shared' | 'downloaded' | 'cancelled' }
  /** The share sheet refused because the tap's activation expired while the photos were read. Share `file` from a fresh tap with shareBackupFile. */
  | { outcome: 'needs-tap'; file: File }

type ShareAttempt = 'shared' | 'cancelled' | 'unavailable' | 'expired'

/**
 * Tries the iOS share sheet. 'unavailable' means a download is the way to go (sharing files isn't supported,
 * or isn't allowed for this file). After an async read, NotAllowedError means the tap's activation expired,
 * not that the file is refused, so it is 'expired' instead.
 */
async function attemptShare(file: File, afterAsyncRead: boolean): Promise<ShareAttempt> {
  if (typeof navigator.canShare !== 'function' || !navigator.canShare({ files: [file] })) return 'unavailable'
  try {
    await navigator.share({ files: [file] })
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    if (error instanceof DOMException && error.name === 'NotAllowedError') return afterAsyncRead ? 'expired' : 'unavailable'
    if (error instanceof TypeError) return 'unavailable'
    throw error
  }
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function markBackedUp() {
  await setSetting('lastBackupAt', new Date().toISOString())
}

/**
 * Opens the iOS share sheet with the backup file (falls back to a download).
 * Pass `afterAsyncRead` when the caller awaited something (like reading photos) after the tap: the share sheet
 * may then refuse because the tap's activation expired, which gives 'needs-tap' instead of a download.
 */
export async function exportBackup(data: BackupData, afterAsyncRead = false): Promise<ExportOutcome> {
  const backup = createBackup(data, new Date())
  // Self-check before sharing: never hand out a file our own importer would reject. Synchronous, so share() keeps its user gesture.
  const check = parseBackup(JSON.parse(JSON.stringify(backup)))
  if (!check.ok) throw new Error(`Backup failed validation: ${check.error}`)
  const file = new File([JSON.stringify(backup)], backupFileName(todayISO()), { type: 'application/json' })

  const attempt = await attemptShare(file, afterAsyncRead)
  if (attempt === 'cancelled') return { outcome: 'cancelled' }
  if (attempt === 'expired') return { outcome: 'needs-tap', file }
  if (attempt === 'shared') {
    await markBackedUp()
    return { outcome: 'shared' }
  }

  download(file)
  await markBackedUp()
  return { outcome: 'downloaded' }
}

/** Shares a backup file made earlier by exportBackup ('needs-tap'), from a fresh tap. Call it straight from the tap handler. */
export async function shareBackupFile(file: File): Promise<{ outcome: 'shared' | 'downloaded' | 'cancelled' }> {
  const attempt = await attemptShare(file, false)
  if (attempt === 'cancelled') return { outcome: 'cancelled' }
  if (attempt === 'shared') {
    await markBackedUp()
    return { outcome: 'shared' }
  }
  download(file)
  await markBackedUp()
  return { outcome: 'downloaded' }
}
