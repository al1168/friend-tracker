// Turning birthday reminders on and off, and keeping the server's schedule in step with the
// friends' birthdays. The browser (permission, subscription) and the network come in as `deps`,
// so all of this is tested with fakes. Calls run one at a time, so a sync still waiting on the
// network can't finish after "turn off" and undo it.

import { db } from '../db/db'
import { getSetting, setSetting } from '../db/settings'
import { base64urlToBytes, bytesToBase64url } from '../lib/base64'
import { buildReminders, scheduleHash, type PushSubscriptionData } from '../lib/reminders'
import type { ScheduleApi } from './api'
import { REMINDERS_OFF, type BirthdayReminders, type PushSupport } from './types'
import { VAPID_PUBLIC_KEY } from './vapidKey'

/** The parts of a PushSubscription this code uses. */
export interface SubscriptionLike {
  readonly options: { readonly applicationServerKey: ArrayBuffer | null }
  toJSON(): PushSubscriptionJSON
  unsubscribe(): Promise<boolean>
}

/** Notification permission and the push subscription (see browserPush.ts). */
export interface PushPort {
  support(): PushSupport
  requestPermission(): Promise<NotificationPermission>
  getSubscription(): Promise<SubscriptionLike | null>
  subscribe(applicationServerKey: Uint8Array<ArrayBuffer>): Promise<SubscriptionLike>
}

export interface ReminderDeps {
  push: PushPort
  api: ScheduleApi
  /** The current time in ms. */
  now: () => number
}

/** The schedule is sent again after a week even when nothing changed, in case the server lost it. */
export const REFRESH_MS = 7 * 86_400_000

let queue: Promise<unknown> = Promise.resolve()

function exclusive<T>(run: () => Promise<T>): Promise<T> {
  const result = queue.then(run, run)
  queue = result.catch(() => {})
  return result
}

/** Applies `change` to the stored setting in one transaction. `change` returns null to leave it alone. */
async function updateReminders(change: (current: BirthdayReminders) => BirthdayReminders | null): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const next = change(await getSetting('birthdayReminders'))
    if (next) await setSetting('birthdayReminders', next)
  })
}

function synced(hash: string, now: number): BirthdayReminders {
  return { enabled: true, lastSyncedHash: hash, lastSyncedAt: new Date(now).toISOString(), lastError: null }
}

function subscriptionData(subscription: SubscriptionLike): PushSubscriptionData {
  const { endpoint, keys } = subscription.toJSON()
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('The push subscription has no keys.')
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }
}

/** Whether the subscription was made with this app's key (pushes signed with another key are refused). */
function hasAppKey(subscription: SubscriptionLike): boolean {
  const key = subscription.options.applicationServerKey
  // A browser that doesn't say is trusted.
  return key === null || bytesToBase64url(new Uint8Array(key)) === VAPID_PUBLIC_KEY
}

async function subscribeWithAppKey(push: PushPort): Promise<SubscriptionLike> {
  const existing = await push.getSubscription()
  if (existing && hasAppKey(existing)) return existing
  // A subscription made with another key can't be reused, and a new one can't be made while it exists.
  await existing?.unsubscribe()
  return push.subscribe(base64urlToBytes(VAPID_PUBLIC_KEY))
}

async function buildSchedule(subscription: SubscriptionLike, now: number) {
  const data = subscriptionData(subscription)
  const reminders = buildReminders(await db.friends.toArray(), now)
  return { body: { subscription: data, reminders }, hash: await scheduleHash(data, reminders) }
}

export type TurnOnResult = 'on' | 'denied' | 'failed'

/**
 * Turns reminders on, from a tap: asks for permission (right away, while iOS still counts the tap),
 * subscribes, and sends the schedule. If anything fails, reminders stay off.
 */
export function turnOnReminders(deps: ReminderDeps): Promise<TurnOnResult> {
  let asked: Promise<NotificationPermission>
  try {
    asked = deps.push.requestPermission()
  } catch {
    return Promise.resolve('failed')
  }
  return exclusive(async () => {
    let subscription: SubscriptionLike | null = null
    try {
      const permission = await asked
      if (permission === 'denied') return 'denied'
      if (permission !== 'granted') return 'failed'
      subscription = await subscribeWithAppKey(deps.push)
      const now = deps.now()
      const { body, hash } = await buildSchedule(subscription, now)
      if (!(await deps.api.putSchedule(body))) throw new Error('The server did not save the schedule.')
      await setSetting('birthdayReminders', synced(hash, now))
      return 'on'
    } catch {
      // Leave nothing behind.
      await subscription?.unsubscribe().catch(() => false)
      return 'failed'
    }
  })
}

/** Turns reminders off: drops the subscription and deletes the server's schedule. Off even if the delete fails. */
export function turnOffReminders(deps: ReminderDeps): Promise<void> {
  return exclusive(async () => {
    try {
      await (await deps.push.getSubscription())?.unsubscribe()
    } catch {
      // Already gone, or no service worker: nothing to drop.
    }
    const deleted = await deps.api.deleteSchedule()
    await setSetting('birthdayReminders', deleted ? REMINDERS_OFF : { ...REMINDERS_OFF, lastError: 'delete' })
  })
}

/** Reminders stopped from outside the app: the subscription is gone or notifications are off. */
async function stop(deps: ReminderDeps, subscription: SubscriptionLike | null): Promise<void> {
  await updateReminders((current) => (current.enabled ? { ...REMINDERS_OFF, lastError: 'revoked' } : null))
  await subscription?.unsubscribe().catch(() => false)
  await deps.api.deleteSchedule()
}

/** Sends the schedule when it changed, is a week old, or the last try failed (or always, with `force`). */
async function syncNow(deps: ReminderDeps, force: boolean): Promise<void> {
  const settings = await getSetting('birthdayReminders')
  if (!settings.enabled) {
    // Turned off, but the server didn't hear: try the delete again.
    if (settings.lastError === 'delete' && (await deps.api.deleteSchedule())) {
      await updateReminders((current) => (!current.enabled && current.lastError === 'delete' ? REMINDERS_OFF : null))
    }
    return
  }
  const support = deps.push.support()
  if (support === 'unavailable') return
  const subscription = support === 'denied' ? null : await deps.push.getSubscription()
  if (!subscription || !hasAppKey(subscription)) {
    await stop(deps, subscription)
    return
  }
  const now = deps.now()
  const { body, hash } = await buildSchedule(subscription, now)
  const syncedAt = settings.lastSyncedAt === null ? Number.NaN : Date.parse(settings.lastSyncedAt)
  const upToDate = hash === settings.lastSyncedHash && settings.lastError === null && now - syncedAt < REFRESH_MS
  if (upToDate && !force) return
  const saved = await deps.api.putSchedule(body)
  // Turned off meanwhile: leave it off.
  await updateReminders((current) =>
    !current.enabled ? null : saved ? synced(hash, now) : { ...current, lastError: 'sync' },
  )
}

/** Keeps the server's schedule current. Never throws: a failure is saved for the Settings footer. */
export function syncReminders(deps: ReminderDeps): Promise<void> {
  return exclusive(async () => {
    try {
      await syncNow(deps, false)
    } catch {
      await updateReminders((current) => (current.enabled ? { ...current, lastError: 'sync' } : null)).catch(() => {})
    }
  })
}

export type TestOutcome = 'sent' | 'failed'

/** Asks the server for a test notification. If it lost the schedule, sends it again first. */
export function sendTestNotification(deps: ReminderDeps): Promise<TestOutcome> {
  return exclusive(async () => {
    try {
      let answer = await deps.api.sendTest()
      if (answer === 'no-subscription') {
        await syncNow(deps, true)
        answer = await deps.api.sendTest()
      }
      if (answer === 'gone') await stop(deps, await deps.push.getSubscription().catch(() => null))
      return answer === 'sent' ? 'sent' : 'failed'
    } catch {
      return 'failed'
    }
  })
}
