import { useEffect } from 'react'
import { forgetOldRestore } from './storage'

/** Lets a restore's snapshot go once it's 7 days old, each time the app starts. Mounted once inside App. */
export function RestoreUndoCleanup(): null {
  useEffect(() => {
    // Best effort: a snapshot left over is deleted next time, and Settings never offers one past its 7 days.
    forgetOldRestore(new Date()).catch(() => {})
  }, [])
  return null
}
