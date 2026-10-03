import { useEffect, useRef } from 'react'
import { resetFailures } from './lockStore'
import { verifyPasskey } from './passkey'
import { PinMessage, PinPad } from './PinPad'
import type { AppLock } from './types'
import { usePinCheck } from './usePinCheck'
import './LockScreen.css'

const PROMPT = 'Enter your PIN'

export function LockScreen({ lock, onUnlock }: { lock: AppLock; onUnlock: () => void }) {
  const entry = usePinCheck(onUnlock)
  const faceIdBusy = useRef(false)
  const titleRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    document.title = 'Friend Tracker'
    // VoiceOver starts at "Friend Tracker is locked".
    titleRef.current?.focus()
  }, [])

  async function unlockWithFaceId() {
    if (!lock.passkeyId || faceIdBusy.current) return
    faceIdBusy.current = true
    try {
      if (await verifyPasskey(lock.passkeyId)) {
        // A storage error must not block a successful Face ID.
        await resetFailures().catch(() => {})
        onUnlock()
        return
      }
      // The keypad is disabled during a wait, so don't tell them to use it.
      entry.setMessage(entry.waitMs > 0 ? "Face ID didn't work." : "Face ID didn't work. Use your PIN.")
    } finally {
      faceIdBusy.current = false
    }
  }

  return (
    <div className="lock-screen">
      <div className="lock-screen__head">
        <svg className="lock-screen__mark" viewBox="0 0 120 80" aria-hidden="true">
          <circle cx="48" cy="40" r="28" className="lock-screen__circle-a" />
          <circle cx="72" cy="40" r="28" className="lock-screen__circle-b" />
        </svg>
        <h1 ref={titleRef} tabIndex={-1} className="lock-screen__title">Friend Tracker is locked</h1>
        <p className="lock-screen__hint">{PROMPT}</p>
      </div>
      {lock.passkeyId && (
        <button type="button" className="button button--primary lock-screen__face-id" onClick={unlockWithFaceId}>
          Unlock with Face ID
        </button>
      )}
      <PinPad
        label={PROMPT}
        {...entry.pinPad}
        status={<PinMessage message={entry.message} waitMs={entry.waitMs} announceKey={entry.messageKey} />}
      />
    </div>
  )
}
