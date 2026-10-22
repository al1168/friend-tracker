import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { exportBackup, shareBackupFile } from '../backup/exportBackup'
import { describeImport, describeRestoreKept, describeUndoRestore } from '../backup/importSummary'
import { meetupsSinceBackup } from '../backup/nudge'
import { parseBackupFile, readAllData, restoreBackup, restoreUndoExpired, undoRestore } from '../backup/storage'
import { useBackupDot } from '../backup/useBackupDot'
import { useConfirm } from '../components/ActionSheet'
import { InsetGroup, Row } from '../components/InsetGroup'
import { Page } from '../components/Page'
import { useToast } from '../components/Toast'
import { useFriends, useGroups, useMeetups, useMeetupTypes, usePhotoCount, useSetting } from '../data/hooks'
import { setSetting, type RestoreUndoInfo } from '../db/settings'
import { useToday } from '../hooks/useToday'
import { describeBackup } from '../lib/text'
import { AppLockSection } from '../lock/AppLockSection'
import { usePasskeyAvailable } from '../lock/usePasskeyAvailable'
import { RemindersSection } from '../reminders/RemindersSection'
import './SettingsScreen.css'

const UNDO_FAILED = "Couldn't undo. Please try again."

export function SettingsScreen() {
  const friends = useFriends()
  const groups = useGroups()
  const meetupTypes = useMeetupTypes()
  const meetups = useMeetups()
  // Settings never holds the photos themselves: only how many there are.
  const photoCount = usePhotoCount()
  const lastBackupAt = useSetting('lastBackupAt')
  const appLock = useSetting('appLock')
  const birthdayReminders = useSetting('birthdayReminders')
  const restoreUndo = useSetting('restoreUndo')
  const passkeyAvailable = usePasskeyAvailable()
  const today = useToday()
  const toast = useToast()
  const confirm = useConfirm()
  const fileInput = useRef<HTMLInputElement>(null)
  const exportingRef = useRef(false)
  const [importError, setImportError] = useState<{ message: string; n: number } | null>(null)
  const backupDot = useBackupDot()

  // Opening Settings while the tab shows the backup dot is seeing it: the dot goes, and comes back 30 days later only
  // if a backup is still due. The Backup footer keeps the facts.
  useEffect(() => {
    if (backupDot) void setSetting('backupNudgeSeenAt', new Date().toISOString())
  }, [backupDot])

  if (!friends || !groups || !meetupTypes || !meetups || lastBackupAt === undefined) return null
  if (appLock === undefined || passkeyAvailable === undefined || birthdayReminders === undefined) return null
  if (photoCount === undefined || restoreUndo === undefined) return null
  // Offered for 7 days after a restore, even before the snapshot is deleted at the next start.
  const undoable = restoreUndo !== null && !restoreUndoExpired(restoreUndo, new Date()) ? restoreUndo : null

  /** Undo for a restore: from the toast, or from "Undo restore" here. A failed one keeps the snapshot to try again. */
  const undoTheRestore = async () => {
    try {
      if (await undoRestore()) toast({ message: 'Restore undone' })
    } catch {
      toast({ message: UNDO_FAILED, tone: 'plain' })
    }
  }

  const confirmUndoRestore = async (kept: RestoreUndoInfo) => {
    const confirmed = await confirm({
      title: 'Undo the restore?',
      message: describeUndoRestore(kept, { friends: friends.length, meetups: meetups.length, photos: photoCount }, today),
      confirmLabel: 'Undo restore',
      destructive: true,
    })
    if (confirmed) await undoTheRestore()
  }

  // Shares a backup made earlier, from the fresh tap on the toast's Share action.
  const shareReadyBackup = async (file: File) => {
    try {
      const { outcome } = await shareBackupFile(file)
      if (outcome !== 'cancelled') toast({ message: 'Backup saved' })
    } catch {
      toast({ message: "Couldn't share the backup.", tone: 'plain' })
    }
  }

  // With no photos the backup is built from data that's already loaded, with no await before share(), so the
  // iOS share sheet opens straight from the tap. Photos are read only now, at tap time (Settings never keeps them
  // in memory); that await can use up the tap, so a refused share offers a "Share" action to tap again.
  const exportData = async () => {
    if (exportingRef.current) return
    exportingRef.current = true
    try {
      const hasPhotos = photoCount > 0
      // With photos, one read transaction gives a consistent snapshot (the rendered lists could be a moment old).
      const snapshot = hasPhotos ? await readAllData() : { friends, groups, meetupTypes, meetups, meetupPhotos: [] }
      const meetupIds = new Set(snapshot.meetups.map((meetup) => meetup.id))
      const data = { ...snapshot, meetupPhotos: snapshot.meetupPhotos.filter((photo) => meetupIds.has(photo.meetupId)) }
      const result = await exportBackup(data, hasPhotos)
      if (result.outcome === 'needs-tap') {
        const { file } = result
        toast({
          message: 'Backup ready',
          actionLabel: 'Share',
          tone: 'plain',
          onAction: () => void shareReadyBackup(file),
        })
      } else if (result.outcome !== 'cancelled') {
        toast({ message: 'Backup saved' })
      }
    } catch {
      toast({ message: "Couldn't create the backup.", tone: 'plain' })
    } finally {
      exportingRef.current = false
    }
  }

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const result = await parseBackupFile(file)
    if (!result.ok) {
      setImportError((previous) => ({ message: result.error, n: (previous?.n ?? 0) + 1 }))
      return
    }
    setImportError(null)
    const { data, exportedAt } = result
    const app = {
      friends: friends.length,
      meetups: meetups.length,
      photos: photoCount,
      friendIds: friends.map((friend) => friend.id),
      meetupIds: meetups.map((meetup) => meetup.id),
    }
    const confirmed = await confirm({
      title: 'Replace all data with this backup?',
      message: describeImport(data, exportedAt, app, today),
      confirmLabel: 'Replace all data',
      destructive: true,
    })
    if (!confirmed) return
    try {
      const { undoable: canUndo } = await restoreBackup(data, new Date())
      toast(
        canUndo
          ? { message: 'Backup restored', actionLabel: 'Undo', onAction: () => void undoTheRestore() }
          : { message: 'Backup restored' },
      )
    } catch {
      toast({ message: "Couldn't restore the backup. Nothing was changed.", tone: 'plain' })
    }
  }

  return (
    <Page title="Settings">
      <InsetGroup title="Organize">
        <Row to="/settings/groups" title="Groups" trailing={groups.length} chevron />
        <Row to="/settings/types" title="Meetup types" trailing={meetupTypes.length} chevron />
      </InsetGroup>

      <RemindersSection reminders={birthdayReminders} />

      <InsetGroup
        title="Backup"
        footer={describeBackup(lastBackupAt, today, photoCount, meetupsSinceBackup(meetups, lastBackupAt))}
      >
        <Row title="Export backup" accent onClick={exportData} />
        <Row title="Import backup" accent onClick={() => fileInput.current?.click()} />
        {undoable && (
          <Row
            title="Undo restore"
            subtitle={describeRestoreKept(undoable, today)}
            subtitleDescribes
            accent
            onClick={() => void confirmUndoRestore(undoable)}
          />
        )}
      </InsetGroup>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={importData}
      />
      {importError && (
        <p key={importError.n} className="field-error settings-error" role="alert">
          {importError.message}
        </p>
      )}

      <AppLockSection lock={appLock} passkeyAvailable={passkeyAvailable} />

      <InsetGroup title="About your data">
        <p className="about-text">
          Everything you add stays on this iPhone. Nothing is sent anywhere, except the times for birthday reminders
          when they're on (never names). Open the app from its Home Screen icon: anything added in a Safari tab is kept
          separately. Export a backup now and then so you can restore it on a new phone.
        </p>
      </InsetGroup>
    </Page>
  )
}
