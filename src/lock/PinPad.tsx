import type { ReactNode } from 'react'
import { IconDelete } from '../components/icons'
import { PIN_LENGTH } from './pin'
import { formatWait } from './policy'
import './PinPad.css'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

interface PinPadProps {
  /** Digits entered so far. */
  value: string
  onChange: (value: string) => void
  /** Called with the whole PIN as soon as the 6th digit is entered. */
  onComplete: (pin: string) => void
  /** What the PIN is for, read out with the dots, e.g. "Enter your PIN". */
  label: string
  /** Pauses the whole keypad (the wait after too many wrong PINs). */
  disabled?: boolean
  /** A PIN is being checked: only Delete is blocked, so the digits don't dim and flicker. */
  busy?: boolean
  /** Each change shakes the dots once (skipped with Reduce Motion). */
  shake?: number
  /** Shown between the dots and the keys (see PinMessage). */
  status?: ReactNode
}

export function PinPad({ value, onChange, onComplete, label, disabled = false, busy = false, shake = 0, status }: PinPadProps) {
  function press(digit: string) {
    if (disabled || value.length >= PIN_LENGTH) return
    const next = value + digit
    onChange(next)
    if (next.length === PIN_LENGTH) onComplete(next)
  }

  function remove() {
    if (!disabled && !busy) onChange(value.slice(0, -1))
  }

  return (
    <div className="pin-pad">
      <div
        key={shake}
        className={shake > 0 ? 'pin-dots pin-dots--shake' : 'pin-dots'}
        role="img"
        aria-label={`${label}, ${value.length} of ${PIN_LENGTH} digits entered`}
      >
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <span key={index} className={index < value.length ? 'pin-dot pin-dot--filled' : 'pin-dot'} />
        ))}
      </div>
      <span className="visually-hidden" aria-live="polite">
        {value.length > 0 ? `${value.length} of ${PIN_LENGTH} entered` : ''}
      </span>
      {status}
      <div className="pin-keys">
        {DIGITS.map((digit) => (
          <button key={digit} type="button" className="pin-key" onClick={() => press(digit)} disabled={disabled}>
            {digit}
          </button>
        ))}
        <span aria-hidden="true" />
        <button type="button" className="pin-key" onClick={() => press('0')} disabled={disabled}>
          0
        </button>
        <button
          type="button"
          className="pin-key pin-key--quiet"
          onClick={remove}
          disabled={disabled || busy || value.length === 0}
          aria-label="Delete"
        >
          <IconDelete size={28} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}

/**
 * The line under the dots: an announced message, plus a quiet countdown while PIN entry is paused.
 * The wait is shown only while `waitMs > 0`, so no countdown text outlives it. The alert says it once
 * (the countdown itself is a timer, not announced every second); a real `message` (such as a failed
 * Face ID) stays visible during the wait too.
 */
export function PinMessage({ message, waitMs = 0 }: { message: string; waitMs?: number }) {
  const waiting = waitMs > 0
  return (
    <div className="pin-message">
      <p role="alert" className={waiting && !message ? 'visually-hidden' : undefined}>
        {message || (waiting ? 'Too many wrong PINs. Wait, then try again.' : '')}
      </p>
      {waiting && <p role="timer">Try again in {formatWait(waitMs)}</p>}
    </div>
  )
}
