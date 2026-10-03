import { setSetting } from '../db/settings'
import { todayISO } from '../lib/dates'
import { backupFileName, createBackup, parseBackup, type BackupData } from './format'

export type ExportOutcome = 'shared' | 'downloaded' | 'cancelled'

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

/** Opens the iOS share sheet with the backup file (falls back to a download). */
export async function exportBackup(data: BackupData): Promise<ExportOutcome> {
  const backup = createBackup(data, new Date())
  // Self-check before sharing: never hand out a file our own importer would reject. Synchronous, so share() keeps its user gesture.
  const check = parseBackup(JSON.parse(JSON.stringify(backup)))
  if (!check.ok) throw new Error(`Backup failed validation: ${check.error}`)
  const file = new File([JSON.stringify(backup)], backupFileName(todayISO()), { type: 'application/json' })

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    let shared = false
    try {
      await navigator.share({ files: [file] })
      shared = true
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Sharing not allowed for this file: fall back to a download. Anything else is a real error.
      const notAllowed = error instanceof DOMException && error.name === 'NotAllowedError'
      if (!notAllowed && !(error instanceof TypeError)) throw error
    }
    if (shared) {
      await markBackedUp()
      return 'shared'
    }
  }

  download(file)
  await markBackedUp()
  return 'downloaded'
}
