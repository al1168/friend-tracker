import { useEffect, useId, useRef, useState } from 'react'
import { Sheet } from '../components/Sheet'
import { isPlainEnter } from '../lib/keys'
import { PinStep } from './LockSheets'
import { changePin } from './lockStore'
import { verifySitePassword, type PasswordCheck } from './sitePassword'
import { useNewPin } from './useNewPin'

type Kind = Exclude<PasswordCheck, 'ok'>

/** `n` changes with every failure, so an identical message replaces the old alert and is announced again. */
interface Problem {
  kind: Kind
  n: number
}

const MESSAGES: Record<Kind, string> = {
  wrong: "That password didn't work.",
  'too-many': 'Too many attempts. Try again in 15 minutes.',
  'signed-out': 'Your sign-in expired. Sign in again, then reset your PIN.',
  offline: 'You need to be online to reset your PIN.',
  error: "Couldn't check your password. Please try again.",
}

interface ResetPinSheetProps {
  open: boolean
  onClose: () => void
  /** Called once the new PIN is saved. */
  onReset: () => void
}

/** "Forgot PIN?": the website password, then a new PIN entered twice. Friends and meetups are kept. */
export function ResetPinSheet({ open, onClose, onReset }: ResetPinSheetProps) {
  const passwordId = useId()
  const errorId = useId()
  const [password, setPassword] = useState('')
  const [verified, setVerified] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [checking, setChecking] = useState(false)
  const checkingRef = useRef(false)
  const newPin = useNewPin(async (pin) => {
    await changePin(pin)
    onReset()
  })

  // Not while the new PIN is being saved (PBKDF2 takes a moment).
  const cancel = () => {
    if (!newPin.savingRef.current) onClose()
  }

  // An unfinished reset doesn't survive the app going to the background: the lock screen remounts the sheet on the
  // next open, so the password and the verified step are gone. (Once the PIN is being saved, it finishes.)
  const cancelRef = useRef(cancel)
  cancelRef.current = cancel
  useEffect(() => {
    if (!open) return
    const hide = () => cancelRef.current()
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hide()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', hide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', hide)
    }
  }, [open])

  async function submitPassword() {
    if (checkingRef.current || password.length === 0) return
    checkingRef.current = true
    setChecking(true)
    const result = await verifySitePassword(password)
    checkingRef.current = false
    setChecking(false)
    if (result === 'ok') {
      setPassword('')
      setProblem(null)
      setVerified(true)
    } else {
      setProblem((previous) => ({ kind: result, n: (previous?.n ?? 0) + 1 }))
    }
  }

  function signInAgain() {
    setPassword('')
    window.location.assign('/__login?next=%2F')
  }

  let footer = null
  if (!verified && problem?.kind === 'signed-out') {
    footer = (
      <button type="button" className="button button--primary button--block" onClick={signInAgain}>
        Sign in
      </button>
    )
  } else if (!verified) {
    footer = (
      <button
        type="button"
        className="button button--primary button--block"
        onClick={submitPassword}
        disabled={checking || password.length === 0}
      >
        {checking ? 'Checking…' : 'Continue'}
      </button>
    )
  }

  return (
    <Sheet open={open} title="Reset PIN" onRequestClose={cancel} footer={footer}>
      {verified ? (
        <PinStep prompt={newPin.prompt} pinPad={newPin.pinPad} message={newPin.message} messageKey={newPin.messageKey} />
      ) : (
        <div className="form-section">
          <p className="lock-sheet__intro">
            Enter your website password to choose a new PIN. Your friends and meetups stay as they are.
          </p>
          {/* Same name as on the sign-in page, so Keychain offers the saved password. */}
          <input
            className="visually-hidden"
            type="text"
            value="Friend Tracker"
            autoComplete="username"
            readOnly
            tabIndex={-1}
            aria-hidden="true"
          />
          <label className="field-label" htmlFor={passwordId}>
            Website password
          </label>
          <input
            id={passwordId}
            className="field"
            type="password"
            value={password}
            autoComplete="current-password"
            enterKeyHint="go"
            aria-invalid={problem?.kind === 'wrong'}
            aria-describedby={problem ? errorId : undefined}
            onKeyDown={(event) => {
              if (isPlainEnter(event)) {
                event.preventDefault()
                void submitPassword()
              }
            }}
            onChange={(event) => {
              setPassword(event.target.value)
              setProblem(null)
            }}
          />
          {problem && (
            <p key={problem.n} className="field-error" id={errorId} role="alert">
              {MESSAGES[problem.kind]}
            </p>
          )}
        </div>
      )}
    </Sheet>
  )
}
