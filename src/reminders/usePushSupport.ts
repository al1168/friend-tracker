import { useCallback, useEffect, useState } from 'react'
import type { PushPort } from './reminderStore'
import type { PushSupport } from './types'

/**
 * Whether push works here, checked again whenever the app comes back to the foreground (the owner
 * may have changed notifications in the iPhone's Settings). The second value checks again now.
 */
export function usePushSupport(push: PushPort): [PushSupport, () => void] {
  const [support, setSupport] = useState(() => push.support())
  const recheck = useCallback(() => setSupport(push.support()), [push])
  useEffect(() => {
    document.addEventListener('visibilitychange', recheck)
    return () => document.removeEventListener('visibilitychange', recheck)
  }, [recheck])
  return [support, recheck]
}
