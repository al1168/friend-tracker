import { useRef, useState, type ChangeEvent } from 'react'
import { exportBackup } from '../backup/exportBackup'
import { parseBackupFile, replaceAllData } from '../backup/storage'
import { useConfirm } from '../components/ActionSheet'
import { InsetGroup, Row } from '../components/InsetGroup'
import { Page } from '../components/Page'
import { useToast } from '../components/Toast'
import { useFriends, useGroups, useMeetups, useMeetupTypes, useSetting } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import { describeLastBackup, plural } from '../lib/text'
import './SettingsScreen.css'

export function SettingsScreen() {
  const friends = useFriends()
  const groups = useGroups()
  const meetupTypes = useMeetupTypes()
  const meetups = useMeetups()
  const lastBackupAt = useSetting('lastBackupAt')
  const today = useToday()
  const toast = useToast()
  const confirm = useConfirm()
  const fileInput = useRef<HTMLInputElement>(null)
  const exportingRef = useRef(false)
  const [importError, setImportError] = useState<{ message: string; n: number } | null>(null)

  if (!friends || !groups || !meetupTypes || !meetups || lastBackupAt === undefined) return null

  // Uses data that's already loaded, so the iOS share sheet opens straight from the tap.
  const exportData = async () => {
    if (exportingRef.current) return
    exportingRef.current = true
    try {
      const outcome = await exportBackup({ friends, groups, meetupTypes, meetups })
      if (outcome !== 'cancelled') toast({ message: 'Backup saved' })
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
    const { data } = result
    const confirmed = await confirm({
      title: 'Replace all data with this backup?',
      message: `It has ${plural(data.friends.length, 'friend')} and ${plural(data.meetups.length, 'meetup')}. Everything in the app now will be replaced.`,
      confirmLabel: 'Replace all data',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await replaceAllData(data)
      toast({ message: 'Backup restored' })
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

      <InsetGroup title="Backup" footer={describeLastBackup(lastBackupAt, today)}>
        <Row title="Export backup" accent onClick={exportData} />
        <Row title="Import backup" accent onClick={() => fileInput.current?.click()} />
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

      <InsetGroup title="About your data">
        <p className="about-text">
          Everything you add stays on this iPhone. Nothing is sent anywhere. Open the app from its Home Screen icon:
          anything added in a Safari tab is kept separately. Export a backup now and then so you can restore it on a
          new phone.
        </p>
      </InsetGroup>
    </Page>
  )
}
