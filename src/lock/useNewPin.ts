import { useRef, useState } from 'react'

export const PINS_DIFFER = "Those PINs didn't match. Try again."

/**
 * Choosing a new PIN: enter it, then enter it again. `onChosen` gets the confirmed PIN.
 * `savingRef.current` is true while it is being saved, so a sheet can refuse to close meanwhile.
 */
export function useNewPin(onChosen: (pin: string) => Promise<void>) {
  const [step, setStep] = useState<'choose' | 'confirm'>('choose')
  const [first, setFirst] = useState('')
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState('')
  const [shake, setShake] = useState(0)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  async function complete(value: string) {
    if (step === 'choose') {
      setFirst(value)
      setPin('')
      setMessage('')
      setStep('confirm')
      return
    }
    if (value !== first) {
      setFirst('')
      setPin('')
      setShake((count) => count + 1)
      setMessage(PINS_DIFFER)
      setStep('choose')
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      await onChosen(value)
    } catch {
      setPin('')
      setShake((count) => count + 1)
      setMessage("Couldn't save. Please try again.")
      savingRef.current = false
      setSaving(false)
    }
  }

  function change(value: string) {
    setPin(value)
    if (value.length > 0) setMessage('')
  }

  return {
    prompt: step === 'choose' ? 'Choose a 6-digit PIN' : 'Enter it again',
    pinPad: { value: pin, onChange: change, onComplete: complete, disabled: saving, shake },
    message,
    /** Changes with every message (each also shakes the dots), so identical ones are announced again. */
    messageKey: shake,
    savingRef,
  }
}
