import { useRef, useState, type ComponentProps } from 'react'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { changePin, setPasskey, turnOffLock, turnOnLock } from './lockStore'
import { registerPasskey, verifyPasskey } from './passkey'
import { PinMessage, PinPad } from './PinPad'
import { useNewPin } from './useNewPin'
import { usePinCheck } from './usePinCheck'
import './LockSheets.css'

const SAVE_FAILED = "Couldn't save. Please try again."

interface PinStepProps {
  prompt: string
  pinPad: Omit<ComponentProps<typeof PinPad>, 'label' | 'status'>
  message: string
  waitMs?: number
}

/** One step of a PIN sheet: the prompt (announced when it changes), the dots, the message and the keys. */
export function PinStep({ prompt, pinPad, message, waitMs }: PinStepProps) {
  return (
    <div className="lock-sheet">
      <p className="lock-sheet__prompt" aria-live="polite">
        {prompt}
      </p>
      <PinPad label={prompt} {...pinPad} status={<PinMessage message={message} waitMs={waitMs} />} />
    </div>
  )
}

interface SheetProps {
  open: boolean
  onClose: () => void
}

export function TurnOnLockSheet({ open, onClose, passkeyAvailable }: SheetProps & { passkeyAvailable: boolean }) {
  const toast = useToast()
  const [askFaceId, setAskFaceId] = useState(false)
  const [faceIdError, setFaceIdError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  function finish() {
    onClose()
    toast({ message: 'App lock is on' })
  }

  const newPin = useNewPin(async (pin) => {
    await turnOnLock(pin)
    if (passkeyAvailable) setAskFaceId(true)
    else finish()
  })

  async function useFaceId() {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const passkeyId = await registerPasskey()
      if (passkeyId) {
        await setPasskey(passkeyId)
        finish()
      } else {
        setFaceIdError("Face ID couldn't be set up. Try again, or tap Not now.")
      }
    } catch {
      setFaceIdError(SAVE_FAILED)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <Sheet open={open} title="Turn on app lock" onRequestClose={askFaceId ? finish : onClose}>
      {askFaceId ? (
        <div className="lock-sheet">
          <p className="lock-sheet__prompt" aria-live="polite">
            Use Face ID or your iPhone passcode to unlock?
          </p>
          <p className="lock-sheet__note">Your PIN still works any time.</p>
          {faceIdError && (
            <p className="field-error" role="alert">
              {faceIdError}
            </p>
          )}
          <div className="lock-sheet__actions">
            <button type="button" className="button button--primary button--block" onClick={useFaceId} disabled={busy}>
              Use Face ID
            </button>
            <button type="button" className="button button--secondary button--block" onClick={finish}>
              Not now
            </button>
          </div>
        </div>
      ) : (
        <PinStep prompt={newPin.prompt} pinPad={newPin.pinPad} message={newPin.message} />
      )}
    </Sheet>
  )
}

export function ChangePinSheet({ open, onClose }: SheetProps) {
  const toast = useToast()
  const [verified, setVerified] = useState(false)
  const current = usePinCheck(() => setVerified(true))
  const newPin = useNewPin(async (pin) => {
    await changePin(pin)
    onClose()
    toast({ message: 'PIN changed' })
  })

  return (
    <Sheet open={open} title="Change PIN" onRequestClose={onClose}>
      {verified ? (
        <PinStep prompt={newPin.prompt} pinPad={newPin.pinPad} message={newPin.message} />
      ) : (
        <PinStep
          prompt="Enter your current PIN"
          pinPad={current.pinPad}
          message={current.message}
          waitMs={current.waitMs}
        />
      )}
    </Sheet>
  )
}

export function TurnOffLockSheet({ open, onClose, passkeyId }: SheetProps & { passkeyId: string | null }) {
  const toast = useToast()
  const faceIdBusy = useRef(false)
  const entry = usePinCheck(() => void turnOff())

  async function turnOff() {
    try {
      await turnOffLock()
    } catch {
      entry.setMessage(SAVE_FAILED)
      return
    }
    onClose()
    toast({ message: 'App lock is off', tone: 'plain' })
  }

  async function useFaceId() {
    if (!passkeyId || faceIdBusy.current) return
    faceIdBusy.current = true
    try {
      if (await verifyPasskey(passkeyId)) await turnOff()
      else entry.setMessage(entry.waitMs > 0 ? "Face ID didn't work." : "Face ID didn't work. Use your PIN.")
    } finally {
      faceIdBusy.current = false
    }
  }

  return (
    <Sheet open={open} title="Turn off app lock" onRequestClose={onClose}>
      <PinStep
        prompt="Enter your PIN to turn off app lock"
        pinPad={entry.pinPad}
        message={entry.message}
        waitMs={entry.waitMs}
      />
      {passkeyId && (
        <button type="button" className="button button--secondary button--block" onClick={useFaceId}>
          Use Face ID
        </button>
      )}
    </Sheet>
  )
}
