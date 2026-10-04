// The browser side of reminders: notification permission and the push subscription, which belongs
// to the service worker. On iPhone only the installed Home Screen app has Web Push.

import { isStandalone } from '../lib/platform'
import { scheduleApi } from './api'
import type { PushPort, ReminderDeps, SubscriptionLike } from './reminderStore'
import type { PushSupport } from './types'

/** Each call into the service worker gets this long, so a hang can't leave a tap (or the queue behind it) waiting forever. */
export const PUSH_TIMEOUT_MS = 10_000

/** Runs `work`, and rejects if it hasn't finished in PUSH_TIMEOUT_MS (or throws at once, like a missing service worker). */
export function withTimeout<T>(work: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The service worker did not answer in time.')), PUSH_TIMEOUT_MS)
    let pending: Promise<T>
    try {
      pending = work()
    } catch (error) {
      clearTimeout(timer)
      reject(error)
      return
    }
    pending.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

const registration = () => withTimeout(() => navigator.serviceWorker.ready)

/** The same subscription, with unsubscribe on the same time limit. */
function guarded(subscription: PushSubscription | null): SubscriptionLike | null {
  if (!subscription) return null
  return {
    options: subscription.options,
    toJSON: () => subscription.toJSON(),
    unsubscribe: () => withTimeout(() => subscription.unsubscribe()),
  }
}

export const browserPush: PushPort = {
  support(): PushSupport {
    const hasPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!isStandalone() || !hasPush) return 'unavailable'
    return Notification.permission === 'denied' ? 'denied' : 'available'
  },
  requestPermission: () => Notification.requestPermission(),
  getSubscription: async () =>
    guarded(await withTimeout(async () => (await registration()).pushManager.getSubscription())),
  subscribe: async (applicationServerKey) => {
    const subscription = await withTimeout(async () =>
      (await registration()).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }),
    )
    return guarded(subscription) as SubscriptionLike
  },
}

export const browserReminderDeps: ReminderDeps = { push: browserPush, api: scheduleApi(), now: () => Date.now() }
