// The browser side of reminders: notification permission and the push subscription, which belongs
// to the service worker. On iPhone only the installed Home Screen app has Web Push.

import { isStandalone } from '../lib/platform'
import { scheduleApi } from './api'
import type { PushPort, ReminderDeps } from './reminderStore'
import type { PushSupport } from './types'

/** The service worker gets this long to be ready, so a missing worker can't leave a tap hanging. */
const READY_TIMEOUT_MS = 10_000

function registration(): Promise<ServiceWorkerRegistration> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('The service worker is not ready.')), READY_TIMEOUT_MS)
    navigator.serviceWorker.ready.then(
      (ready) => {
        window.clearTimeout(timer)
        resolve(ready)
      },
      (error: unknown) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export const browserPush: PushPort = {
  support(): PushSupport {
    const hasPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!isStandalone() || !hasPush) return 'unavailable'
    return Notification.permission === 'denied' ? 'denied' : 'available'
  },
  requestPermission: () => Notification.requestPermission(),
  getSubscription: async () => (await registration()).pushManager.getSubscription(),
  subscribe: async (applicationServerKey) =>
    (await registration()).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }),
}

export const browserReminderDeps: ReminderDeps = { push: browserPush, api: scheduleApi(), now: () => Date.now() }
