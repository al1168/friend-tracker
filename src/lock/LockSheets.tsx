import { useEffect, useRef, useState, type ComponentProps } from 'react'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { changePin, setPasskey, turnOffLock, turnOnLock } from './lockStore'
import { registerPasskey, verifyPasskey } from './passkey'
import { PinMessage, PinPad } from './PinPad'
import { useNewPin } from './useNewPin'
import { usePinCheck } from './usePinCheck'
import './LockSheets.css'

const SAVE_FAILED = "Couldn't save. Please try again."
const FACE_ID_QUESTION = 'Use Face ID or your iPhone passcode to unlock?'

/** A ref for a step's heading: it takes focus whenever `step` changes (and when it first appears), so VoiceOver reads it. */
function useStepFocus<T extends HTMLElement>(step: string) {
  const ref = useRef<T>(null)
  useEffect(() => {
    // After the sheet has moved focus to itself (children's effects run before the sheet's).
    queueMicrotask(() => ref.current?.focus({ preventScroll: true }))
  }, [step])
  return ref
}

interface PinStepProps {
  prompt: string
  pinPad: Omit<ComponentProps<typeof PinPad>, 'label' | 'status'>
  message: string
  waitMs?: number
  /** Changes with each new message, so an identical one is announced again. */
  messageKey?: number
}

/** One step of a PIN sheet: the prompt (focused and announced when it changes), the dots, the message and the keys. */
export function PinStep({ prompt, pinPad, message, waitMs, messageKey }: PinStepProps) {
  const promptRef = useStepFocus<HTMLParagraphElement>(prompt)
  return (
    <div className="lock-sheet">
      <p ref={promptRef} tabIndex={-1} className="lock-sheet__prompt">
        {prompt}
      </p>
      <PinPad
        label={prompt}
        {...pinPad}
        status={<PinMessage message={message} waitMs={waitMs} announceKey={messageKey ?? pinPad.shake} />}
      />
    </div>
  )
}

/** The "Use Face ID or your iPhone passcode to unlock?" step. Its buttons are the sheet's footer (see FaceIdFooter). */
function FaceIdQuestion({ error }: { error: { text: string; n: number } | null }) {
  const promptRef = useStepFocus<HTMLParagraphElement>(FACE_ID_QUESTION)
  return (
    <div className="lock-sheet">
      <p ref={promptRef} tabIndex={-1} className="lock-sheet__prompt">
        {FACE_ID_QUESTION}
      </p>
      <p className="lock-sheet__note">Your PIN still works any time.</p>
      {error && (
        <p key={error.n} className="field-error" role="alert">
          {error.text}
        </p>
      )}
    </div>
  )
}

interface FaceIdFooterProps {
  busy: boolean
  onSetUp: () => void
  onSkip: () => void
}

function FaceIdFooter({ busy, onSetUp, onSkip }: FaceIdFooterProps) {
  return (
    <>
      <button type="button" className="button button--primary button--block" onClick={onSetUp} disabled={busy}>
        Use Face ID
      </button>
      <button type="button" className="button button--secondary button--block" onClick={onSkip}>
        Not now
      </button>
    </>
  )
}

/** Registering Face ID. `setUpFaceId` must run straight from a tap: registerPasskey() is its first await. */
function useFaceIdSetup(onEnabled: () => void) {
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ text: string; n: number } | null>(null)

  const fail = (text: string) => setError((previous) => ({ text, n: (previous?.n ?? 0) + 1 }))

  async function setUpFaceId() {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const passkeyId = await registerPasskey()
      if (passkeyId) {
        await setPasskey(passkeyId)
        onEnabled()
      } else {
        fail("Face ID couldn't be set up. Try again, or tap Not now.")
      }
    } catch {
      fail(SAVE_FAILED)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return { busy, error, setUpFaceId }
}

interface SheetProps {
  open: boolean
  /** Cancelled or dismissed: the control that opened the sheet is still there, so focus goes back to it. */
  onClose: () => void
}

interface DoneSheetProps extends SheetProps {
  /** Finished: the control that opened the sheet is gone, so focus goes to the group's heading. */
  onDone: () => void
}

export function TurnOnLockSheet({
  open,
  onClose,
  onDone,
  passkeyAvailable,
}: DoneSheetProps & { passkeyAvailable: boolean }) {
  const toast = useToast()
  const [askFaceId, setAskFaceId] = useState(false)

  function finish() {
    onDone()
    toast({ message: 'App lock is on' })
  }

  const newPin = useNewPin(async (pin) => {
    await turnOnLock(pin)
    if (passkeyAvailable) setAskFaceId(true)
    else finish()
  })
  const faceId = useFaceIdSetup(finish)

  // The PIN is being saved (PBKDF2 takes a moment): Cancel, the scrim and a swipe do nothing until it is.
  const cancel = () => {
    if (!newPin.savingRef.current) onClose()
  }

  return (
    <Sheet
      open={open}
      title="Turn on app lock"
      onRequestClose={askFaceId ? finish : cancel}
      footer={askFaceId && <FaceIdFooter busy={faceId.busy} onSetUp={faceId.setUpFaceId} onSkip={finish} />}
    >
      {askFaceId ? (
        <FaceIdQuestion error={faceId.error} />
      ) : (
        <PinStep prompt={newPin.prompt} pinPad={newPin.pinPad} message={newPin.message} messageKey={newPin.messageKey} />
      )}
    </Sheet>
  )
}

/** Turning Face ID on: the PIN first, then the Face ID question. (Turning it off needs no PIN.) */
export function TurnOnFaceIdSheet({ open, onClose }: SheetProps) {
  const toast = useToast()
  const [verified, setVerified] = useState(false)
  const current = usePinCheck(() => setVerified(true))
  const faceId = useFaceIdSetup(() => {
    onClose()
    toast({ message: 'Face ID is on' })
  })

  function skip() {
    onClose()
    toast({ message: "Face ID wasn't turned on.", tone: 'plain' })
  }

  return (
    <Sheet
      open={open}
      title="Turn on Face ID"
      onRequestClose={onClose}
      footer={verified && <FaceIdFooter busy={faceId.busy} onSetUp={faceId.setUpFaceId} onSkip={skip} />}
    >
      {verified ? (
        <FaceIdQuestion error={faceId.error} />
      ) : (
        <PinStep
          prompt="Enter your PIN"
          pinPad={current.pinPad}
          message={current.message}
          waitMs={current.waitMs}
          messageKey={current.messageKey}
        />
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

  // Not while the new PIN is being saved.
  const cancel = () => {
    if (!newPin.savingRef.current) onClose()
  }

  return (
    <Sheet open={open} title="Change PIN" onRequestClose={cancel}>
      {verified ? (
        <PinStep prompt={newPin.prompt} pinPad={newPin.pinPad} message={newPin.message} messageKey={newPin.messageKey} />
      ) : (
        <PinStep
          prompt="Enter your current PIN"
          pinPad={current.pinPad}
          message={current.message}
          waitMs={current.waitMs}
          messageKey={current.messageKey}
        />
      )}
    </Sheet>
  )
}

export function TurnOffLockSheet({ open, onClose, onDone, passkeyId }: DoneSheetProps & { passkeyId: string | null }) {
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
    onDone()
    toast({ message: 'App lock is off', tone: 'plain' })
  }

  async function turnOffWithFaceId() {
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
    <Sheet
      open={open}
      title="Turn off app lock"
      onRequestClose={onClose}
      footer={
        passkeyId && (
          <button type="button" className="button button--secondary button--block" onClick={turnOffWithFaceId}>
            Use Face ID
          </button>
        )
      }
    >
      <PinStep
        prompt="Enter your PIN to turn off app lock"
        pinPad={entry.pinPad}
        message={entry.message}
        waitMs={entry.waitMs}
        messageKey={entry.messageKey}
      />
    </Sheet>
  )
}
