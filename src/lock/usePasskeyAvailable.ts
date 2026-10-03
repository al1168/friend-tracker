import { useEffect, useState } from 'react'
import { isPasskeyAvailable } from './passkey'

/** Whether Face ID can be used here. `undefined` until known. */
export function usePasskeyAvailable(): boolean | undefined {
  const [available, setAvailable] = useState<boolean>()
  useEffect(() => {
    let active = true
    void isPasskeyAvailable().then((value) => {
      if (active) setAvailable(value)
    })
    return () => {
      active = false
    }
  }, [])
  return available
}
