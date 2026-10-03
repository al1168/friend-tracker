import { useRef, useState } from 'react'
import { InsetGroup, Row } from '../components/InsetGroup'
import { useToast } from '../components/Toast'
import { ChangePinSheet, TurnOffLockSheet, TurnOnLockSheet } from './LockSheets'
import { setPasskey } from './lockStore'
import { registerPasskey } from './passkey'
import type { AppLock } from './types'

type LockSheet = 'on' | 'change' | 'off'

interface AppLockSectionProps {
  lock: AppLock
  /** Whether this device can use Face ID here. */
  passkeyAvailable: boolean
}

/** The "App lock" group on the Settings screen. */
export function AppLockSection({ lock, passkeyAvailable }: AppLockSectionProps) {
  const toast = useToast()
  const [sheet, setSheet] = useState<LockSheet | null>(null)
  const [sheetKey, setSheetKey] = useState(0)
  const faceIdBusy = useRef(false)

  const open = (next: LockSheet) => {
    setSheetKey((key) => key + 1)
    setSheet(next)
  }
  const close = () => setSheet(null)

  // Registering a passkey has to start from this tap, so it can't wait behind a sheet.
  async function toggleFaceId() {
    if (faceIdBusy.current) return
    faceIdBusy.current = true
    try {
      if (lock.passkeyId) {
        await setPasskey(null)
        toast({ message: 'Face ID is off', tone: 'plain' })
        return
      }
      const passkeyId = await registerPasskey()
      if (!passkeyId) {
        toast({ message: "Face ID wasn't turned on.", tone: 'plain' })
        return
      }
      await setPasskey(passkeyId)
      toast({ message: 'Face ID is on' })
    } catch {
      toast({ message: "Couldn't save. Please try again.", tone: 'plain' })
    } finally {
      faceIdBusy.current = false
    }
  }

  const footer = passkeyAvailable
    ? 'Locks the app after 15 minutes away. Unlock with your PIN, Face ID or your iPhone passcode.'
    : 'Locks the app after 15 minutes away. Unlock with your PIN.'

  return (
    <>
      <InsetGroup title="App lock" footer={footer}>
        {lock.enabled ? (
          <>
            {(passkeyAvailable || lock.passkeyId) && (
              <Row title="Face ID" trailing={lock.passkeyId ? 'On' : 'Off'} onClick={toggleFaceId} />
            )}
            <Row title="Change PIN" accent onClick={() => open('change')} />
            <Row title="Turn off app lock" destructive onClick={() => open('off')} />
          </>
        ) : (
          <Row title="Turn on app lock" accent onClick={() => open('on')} />
        )}
      </InsetGroup>
      <TurnOnLockSheet
        key={`on-${sheetKey}`}
        open={sheet === 'on'}
        onClose={close}
        passkeyAvailable={passkeyAvailable}
      />
      <ChangePinSheet key={`change-${sheetKey}`} open={sheet === 'change'} onClose={close} />
      <TurnOffLockSheet key={`off-${sheetKey}`} open={sheet === 'off'} onClose={close} passkeyId={lock.passkeyId} />
    </>
  )
}
