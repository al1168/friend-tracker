import { useEffect, useRef, useState } from 'react'
import { InsetGroup, Row } from '../components/InsetGroup'
import { useToast } from '../components/Toast'
import { ChangePinSheet, TurnOffLockSheet, TurnOnFaceIdSheet, TurnOnLockSheet } from './LockSheets'
import { setPasskey } from './lockStore'
import type { AppLock } from './types'

type LockSheet = 'on' | 'faceId' | 'change' | 'off'

/** Longer than the sheet's exit animation. */
const EXIT_MS = 400

/** How long after a tap on the Face ID switch (once its write is done) that further taps are ignored. */
const FACE_ID_TAP_GUARD_MS = 300

interface AppLockSectionProps {
  lock: AppLock
  /** Whether this device can use Face ID here. */
  passkeyAvailable: boolean
}

/** The "App lock" group on the Settings screen. */
export function AppLockSection({ lock, passkeyAvailable }: AppLockSectionProps) {
  const toast = useToast()
  // One sheet at a time. It stays mounted while it slides away, and a new key gives the next one a clean start.
  const [shown, setShown] = useState<{ kind: LockSheet; key: number; open: boolean } | null>(null)
  const [headingFocus, setHeadingFocus] = useState(0)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const faceIdBusy = useRef(false)
  // Same rule as LockGate: the lock is on only when a PIN is stored.
  const lockOn = lock.enabled && lock.pin !== null

  const open = (kind: LockSheet) => setShown((previous) => ({ kind, key: (previous?.key ?? 0) + 1, open: true }))
  const close = () => setShown((previous) => previous && { ...previous, open: false })
  // For a sheet that replaced the control that opened it: focus has nowhere to return to, so it goes to the heading.
  const done = () => {
    close()
    setHeadingFocus((count) => count + 1)
  }

  const exiting = shown !== null && !shown.open
  useEffect(() => {
    if (!exiting) return
    const timer = window.setTimeout(() => setShown((current) => (current && !current.open ? null : current)), EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [exiting])

  // Runs after the sheet has given focus back, so the heading wins.
  useEffect(() => {
    if (headingFocus > 0) titleRef.current?.focus({ preventScroll: true })
  }, [headingFocus])

  // Turning Face ID off is one tap. Turning it on asks for the PIN first (in a sheet).
  async function toggleFaceId() {
    // A double tap on "On" must not turn it off and then open "Turn on Face ID", and a double tap on "Off" must not
    // hit the sheet that opens behind the second tap.
    if (faceIdBusy.current) return
    faceIdBusy.current = true
    // Taps are ignored until the write (if any) is done, plus a moment for a second tap of a double tap.
    const release = () => {
      window.setTimeout(() => {
        faceIdBusy.current = false
      }, FACE_ID_TAP_GUARD_MS)
    }
    if (!lock.passkeyId) {
      open('faceId')
      release()
      return
    }
    try {
      await setPasskey(null)
      toast({ message: 'Face ID is off', tone: 'plain' })
    } catch {
      toast({ message: "Couldn't save. Please try again.", tone: 'plain' })
    } finally {
      release()
    }
  }

  const footer = passkeyAvailable
    ? 'Locks the app after 15 minutes away. Unlock with your PIN, Face ID or your iPhone passcode.'
    : 'Locks the app after 15 minutes away. Unlock with your PIN.'

  const sheetKey = shown ? `${shown.kind}-${shown.key}` : undefined

  return (
    <>
      <InsetGroup title="App lock" footer={footer} titleRef={titleRef}>
        {lockOn ? (
          <>
            {(passkeyAvailable || lock.passkeyId) && (
              <Row title="Face ID" switchOn={lock.passkeyId !== null} onClick={toggleFaceId} />
            )}
            <Row title="Change PIN" accent onClick={() => open('change')} />
            <Row title="Turn off app lock" destructive onClick={() => open('off')} />
          </>
        ) : (
          <Row title="Turn on app lock" accent onClick={() => open('on')} />
        )}
      </InsetGroup>
      {shown?.kind === 'on' && (
        <TurnOnLockSheet
          key={sheetKey}
          open={shown.open}
          onClose={close}
          onDone={done}
          passkeyAvailable={passkeyAvailable}
        />
      )}
      {shown?.kind === 'faceId' && <TurnOnFaceIdSheet key={sheetKey} open={shown.open} onClose={close} />}
      {shown?.kind === 'change' && <ChangePinSheet key={sheetKey} open={shown.open} onClose={close} />}
      {shown?.kind === 'off' && (
        <TurnOffLockSheet key={sheetKey} open={shown.open} onClose={close} onDone={done} passkeyId={lock.passkeyId} />
      )}
    </>
  )
}
