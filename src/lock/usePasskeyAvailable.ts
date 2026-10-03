import { useEffect, useState } from 'react'
import { isPasskeyAvailable } from './passkey'

/** Gives up (no Face ID) if the device doesn't answer in this long, so Settings never waits forever. */
const ANSWER_TIMEOUT_MS = 3000

/** Whether Face ID can be used here. `undefined` until known. */
export function usePasskeyAvailable(): boolean | undefined {
  const [available, setAvailable] = useState<boolean>()
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      if (active) setAvailable((known) => known ?? false)
    }, ANSWER_TIMEOUT_MS)
    void isPasskeyAvailable().then((value) => {
      if (active) setAvailable(value)
    })
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [])
  return available
}
