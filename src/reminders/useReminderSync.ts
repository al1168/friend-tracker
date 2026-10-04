// Keeps the server's reminder schedule in step with the friends' birthdays: when the app opens,
// when it comes back to the foreground, and when a friend changes. Mounted once inside App, which
// only renders while the app is unlocked.

import { useEffect, useState } from 'react'
import { useFriends, useSetting } from '../data/hooks'
import { browserReminderDeps } from './browserPush'
import { syncReminders } from './reminderStore'

/** Sends this long after the last change, so a burst of edits sends once. */
const SYNC_DEBOUNCE_MS = 2000

export function useReminderSync(): void {
  const settings = useSetting('birthdayReminders')
  const friends = useFriends()
  const [wakes, setWakes] = useState(0)
  // On, or off with a delete the server hasn't heard yet.
  const active = settings !== undefined && (settings.enabled || settings.lastError === 'delete')

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') setWakes((count) => count + 1)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // `friends` and `wakes` only trigger a sync, which reads everything fresh.
  useEffect(() => {
    if (!active || friends === undefined) return
    const timer = window.setTimeout(() => void syncReminders(browserReminderDeps), SYNC_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [active, friends, wakes])
}

/** Runs useReminderSync without re-rendering anything else when the friends change. */
export function ReminderSync(): null {
  useReminderSync()
  return null
}
