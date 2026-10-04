import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from '../db/db'
import { getSetting, setSetting } from '../db/settings'
import { base64urlToBytes } from '../lib/base64'
import { buildReminders, scheduleHash } from '../lib/reminders'
import { friend } from '../test/fixtures'
import type { ScheduleApi, ScheduleBody, TestAnswer } from './api'
import {
  REFRESH_MS,
  sendTestNotification,
  syncReminders,
  turnOffReminders,
  turnOnReminders,
  type PushPort,
  type ReminderDeps,
  type SubscriptionLike,
} from './reminderStore'
import { REMINDERS_OFF, type BirthdayReminders, type PushSupport } from './types'
import { VAPID_PUBLIC_KEY } from './vapidKey'

beforeEach(resetDatabase)

/** Noon on Oct 2, 2026, in the test time zone. */
const NOW = new Date(2026, 9, 2, 12, 0).getTime()

const ENDPOINT = 'https://web.push.apple.com/QGuQyavXutnMH-endpoint'
const KEYS = { p256dh: 'p256dh-key', auth: 'auth-secret' }
const APP_KEY = base64urlToBytes(VAPID_PUBLIC_KEY)

/** A push subscription made with `key` that records when it's dropped. */
function fakeSubscription(key: Uint8Array = APP_KEY) {
  const state = { unsubscribed: false }
  const subscription: SubscriptionLike = {
    options: { applicationServerKey: new Uint8Array(key).buffer },
    toJSON: () => ({ endpoint: ENDPOINT, expirationTime: null, keys: KEYS }),
    unsubscribe: async () => {
      state.unsubscribed = true
      return true
    },
  }
  return { subscription, state }
}

interface PushOptions {
  support?: PushSupport
  answer?: NotificationPermission
  existing?: SubscriptionLike | null
}

/** The browser: permission, and one subscription that subscribe() replaces. */
function fakePush({ support = 'available', answer = 'granted', existing = null }: PushOptions = {}) {
  const calls: string[] = []
  const state = { current: existing, subscribedWith: null as Uint8Array | null, made: null as ReturnType<typeof fakeSubscription> | null }
  const push: PushPort = {
    support: () => support,
    requestPermission: () => {
      calls.push('requestPermission')
      return Promise.resolve(answer)
    },
    getSubscription: async () => state.current,
    subscribe: async (key) => {
      calls.push('subscribe')
      state.subscribedWith = key
      state.made = fakeSubscription(key)
      state.current = state.made.subscription
      return state.current
    },
  }
  return { push, calls, state }
}

/** The server: records each call and answers as told. */
function fakeApi(answers: { put?: boolean[]; remove?: boolean[]; test?: TestAnswer[] } = {}) {
  const calls: { method: string; body?: ScheduleBody }[] = []
  const api: ScheduleApi = {
    putSchedule: async (body) => {
      calls.push({ method: 'PUT', body })
      return answers.put?.shift() ?? true
    },
    deleteSchedule: async () => {
      calls.push({ method: 'DELETE' })
      return answers.remove?.shift() ?? true
    },
    sendTest: async () => {
      calls.push({ method: 'TEST' })
      return answers.test?.shift() ?? 'sent'
    },
  }
  return { api, calls }
}

function deps(push: PushPort, api: ScheduleApi, now = NOW): ReminderDeps {
  return { push, api, now: () => now }
}

async function addAlex() {
  await db.friends.add({ ...friend('alex', 'Alex'), birthday: { month: 10, day: 14, year: null } })
}

async function expectedSchedule() {
  const subscription = { endpoint: ENDPOINT, keys: KEYS }
  const reminders = buildReminders(await db.friends.toArray(), NOW)
  return { body: { subscription, reminders }, hash: await scheduleHash(subscription, reminders) }
}

/** Reminders already on and in step with the server, as of `syncedAt`. */
async function seedOn(syncedAt = NOW, change: Partial<BirthdayReminders> = {}) {
  const { hash } = await expectedSchedule()
  await setSetting('birthdayReminders', {
    enabled: true,
    lastSyncedHash: hash,
    lastSyncedAt: new Date(syncedAt).toISOString(),
    lastError: null,
    ...change,
  })
}

describe('turnOnReminders', () => {
  it('asks for permission before anything else, inside the tap', async () => {
    const { push, calls } = fakePush()
    const turningOn = turnOnReminders(deps(push, fakeApi().api))
    // Called synchronously: iOS only shows the prompt while the tap is still being handled.
    expect(calls).toEqual(['requestPermission'])
    expect(await turningOn).toBe('on')
  })

  it("subscribes with the app's key, sends the schedule, and saves it", async () => {
    await addAlex()
    const { push, state } = fakePush()
    const server = fakeApi()
    expect(await turnOnReminders(deps(push, server.api))).toBe('on')
    expect(state.subscribedWith).toEqual(APP_KEY)
    const { body, hash } = await expectedSchedule()
    expect(body.reminders).toHaveLength(2)
    expect(server.calls).toEqual([{ method: 'PUT', body }])
    expect(await getSetting('birthdayReminders')).toEqual({
      enabled: true,
      lastSyncedHash: hash,
      lastSyncedAt: new Date(NOW).toISOString(),
      lastError: null,
    })
  })

  it('reuses a subscription made with the app key', async () => {
    const existing = fakeSubscription()
    const { push, calls } = fakePush({ existing: existing.subscription })
    expect(await turnOnReminders(deps(push, fakeApi().api))).toBe('on')
    expect(calls).toEqual(['requestPermission'])
    expect(existing.state.unsubscribed).toBe(false)
  })

  it('replaces a subscription made with another key', async () => {
    const old = fakeSubscription(new Uint8Array(65).fill(4))
    const { push, calls } = fakePush({ existing: old.subscription })
    expect(await turnOnReminders(deps(push, fakeApi().api))).toBe('on')
    expect(old.state.unsubscribed).toBe(true)
    expect(calls).toEqual(['requestPermission', 'subscribe'])
  })

  it('stays off when notifications are denied', async () => {
    const { push, calls } = fakePush({ answer: 'denied' })
    const server = fakeApi()
    expect(await turnOnReminders(deps(push, server.api))).toBe('denied')
    expect(calls).toEqual(['requestPermission'])
    expect(server.calls).toEqual([])
    expect(await getSetting('birthdayReminders')).toEqual(REMINDERS_OFF)
  })

  it('stays off when the prompt is dismissed', async () => {
    const { push } = fakePush({ answer: 'default' })
    expect(await turnOnReminders(deps(push, fakeApi().api))).toBe('failed')
    expect(await getSetting('birthdayReminders')).toEqual(REMINDERS_OFF)
  })

  it('stays off, and drops the subscription, when the server does not save the schedule', async () => {
    const { push, state } = fakePush()
    expect(await turnOnReminders(deps(push, fakeApi({ put: [false] }).api))).toBe('failed')
    expect(state.made?.state.unsubscribed).toBe(true)
    expect(await getSetting('birthdayReminders')).toEqual(REMINDERS_OFF)
  })

  it('stays off when subscribing fails', async () => {
    const { push } = fakePush()
    push.subscribe = () => Promise.reject(new DOMException('Subscribing failed', 'AbortError'))
    const server = fakeApi()
    expect(await turnOnReminders(deps(push, server.api))).toBe('failed')
    expect(server.calls).toEqual([])
  })
})

describe('turnOffReminders', () => {
  it('drops the subscription, deletes the schedule, and saves off', async () => {
    await seedOn()
    const current = fakeSubscription()
    const server = fakeApi()
    await turnOffReminders(deps(fakePush({ existing: current.subscription }).push, server.api))
    expect(current.state.unsubscribed).toBe(true)
    expect(server.calls).toEqual([{ method: 'DELETE' }])
    expect(await getSetting('birthdayReminders')).toEqual(REMINDERS_OFF)
  })

  it('is off even when the delete fails, and remembers to retry it', async () => {
    await seedOn()
    await turnOffReminders(deps(fakePush().push, fakeApi({ remove: [false] }).api))
    expect(await getSetting('birthdayReminders')).toEqual({ ...REMINDERS_OFF, lastError: 'delete' })
  })
})

describe('syncReminders', () => {
  it('does nothing while reminders are off', async () => {
    const server = fakeApi()
    await syncReminders(deps(fakePush().push, server.api))
    expect(server.calls).toEqual([])
  })

  it('retries a delete that failed, then forgets it', async () => {
    await setSetting('birthdayReminders', { ...REMINDERS_OFF, lastError: 'delete' })
    const server = fakeApi({ remove: [false, true] })
    const { push } = fakePush()
    await syncReminders(deps(push, server.api))
    expect(await getSetting('birthdayReminders')).toEqual({ ...REMINDERS_OFF, lastError: 'delete' })
    await syncReminders(deps(push, server.api))
    expect(server.calls).toEqual([{ method: 'DELETE' }, { method: 'DELETE' }])
    expect(await getSetting('birthdayReminders')).toEqual(REMINDERS_OFF)
  })

  it('sends nothing when the schedule is unchanged and less than a week old', async () => {
    await addAlex()
    await seedOn(NOW - REFRESH_MS + 60_000)
    const server = fakeApi()
    await syncReminders(deps(fakePush({ existing: fakeSubscription().subscription }).push, server.api))
    expect(server.calls).toEqual([])
  })

  it('sends the schedule when a birthday changed', async () => {
    await seedOn()
    await addAlex()
    const server = fakeApi()
    await syncReminders(deps(fakePush({ existing: fakeSubscription().subscription }).push, server.api))
    const { body, hash } = await expectedSchedule()
    expect(server.calls).toEqual([{ method: 'PUT', body }])
    expect(await getSetting('birthdayReminders')).toMatchObject({ enabled: true, lastSyncedHash: hash, lastError: null })
  })

  it('sends it again after a week, even unchanged', async () => {
    await addAlex()
    await seedOn(NOW - REFRESH_MS)
    const server = fakeApi()
    await syncReminders(deps(fakePush({ existing: fakeSubscription().subscription }).push, server.api))
    expect(server.calls.map((call) => call.method)).toEqual(['PUT'])
    expect(await getSetting('birthdayReminders')).toMatchObject({ lastSyncedAt: new Date(NOW).toISOString() })
  })

  it('remembers a failed send, keeps reminders on, and tries again next time', async () => {
    await seedOn()
    await addAlex()
    const { push } = fakePush({ existing: fakeSubscription().subscription })
    const server = fakeApi({ put: [false, true] })
    await syncReminders(deps(push, server.api))
    const failed = await getSetting('birthdayReminders')
    expect(failed).toMatchObject({ enabled: true, lastError: 'sync' })
    await syncReminders(deps(push, server.api))
    expect(server.calls.map((call) => call.method)).toEqual(['PUT', 'PUT'])
    expect(await getSetting('birthdayReminders')).toMatchObject({ enabled: true, lastError: null })
  })

  it('turns reminders off when the subscription is gone', async () => {
    await seedOn()
    const server = fakeApi()
    await syncReminders(deps(fakePush({ existing: null }).push, server.api))
    expect(await getSetting('birthdayReminders')).toEqual({ ...REMINDERS_OFF, lastError: 'revoked' })
    expect(server.calls).toEqual([{ method: 'DELETE' }])
  })

  it('turns reminders off when notifications were turned off', async () => {
    await seedOn()
    const current = fakeSubscription()
    await syncReminders(deps(fakePush({ support: 'denied', existing: current.subscription }).push, fakeApi().api))
    expect(await getSetting('birthdayReminders')).toEqual({ ...REMINDERS_OFF, lastError: 'revoked' })
  })

  it('turns reminders off when the subscription was made with another key', async () => {
    await seedOn()
    const old = fakeSubscription(new Uint8Array(65).fill(4))
    await syncReminders(deps(fakePush({ existing: old.subscription }).push, fakeApi().api))
    expect(await getSetting('birthdayReminders')).toEqual({ ...REMINDERS_OFF, lastError: 'revoked' })
    expect(old.state.unsubscribed).toBe(true)
  })

  it('leaves everything alone where push is unavailable', async () => {
    await seedOn()
    const server = fakeApi()
    await syncReminders(deps(fakePush({ support: 'unavailable' }).push, server.api))
    expect(server.calls).toEqual([])
    expect(await getSetting('birthdayReminders')).toMatchObject({ enabled: true, lastError: null })
  })

  it('saves a failure instead of throwing', async () => {
    await seedOn()
    const { push } = fakePush()
    push.getSubscription = () => Promise.reject(new Error('The service worker is not ready.'))
    await expect(syncReminders(deps(push, fakeApi().api))).resolves.toBeUndefined()
    expect(await getSetting('birthdayReminders')).toMatchObject({ enabled: true, lastError: 'sync' })
  })

  it('never turns reminders back on when they are turned off during a send', async () => {
    await seedOn()
    await addAlex()
    const order: string[] = []
    let release: (saved: boolean) => void = () => {}
    let sending: () => void = () => {}
    const sendStarted = new Promise<void>((resolve) => (sending = resolve))
    const api: ScheduleApi = {
      putSchedule: () => {
        order.push('PUT')
        sending()
        return new Promise((resolve) => (release = resolve))
      },
      deleteSchedule: async () => {
        order.push('DELETE')
        return true
      },
      sendTest: async () => 'sent',
    }
    const { push } = fakePush({ existing: fakeSubscription().subscription })
    const sync = syncReminders(deps(push, api))
    const off = turnOffReminders(deps(push, api))
    await sendStarted
    release(true)
    await Promise.all([sync, off])
    // The delete waited for the send, so the server ends up with nothing and the switch stays off.
    expect(order).toEqual(['PUT', 'DELETE'])
    expect(await getSetting('birthdayReminders')).toEqual(REMINDERS_OFF)
  })
})

describe('sendTestNotification', () => {
  it('asks the server for a test', async () => {
    await seedOn()
    const server = fakeApi()
    expect(await sendTestNotification(deps(fakePush().push, server.api))).toBe('sent')
    expect(server.calls).toEqual([{ method: 'TEST' }])
  })

  it('sends the schedule again when the server lost it, then retries once', async () => {
    await seedOn()
    const server = fakeApi({ test: ['no-subscription', 'sent'] })
    const { push } = fakePush({ existing: fakeSubscription().subscription })
    expect(await sendTestNotification(deps(push, server.api))).toBe('sent')
    expect(server.calls.map((call) => call.method)).toEqual(['TEST', 'PUT', 'TEST'])
  })

  it('turns reminders off when the subscription is gone', async () => {
    await seedOn()
    const current = fakeSubscription()
    const server = fakeApi({ test: ['gone'] })
    expect(await sendTestNotification(deps(fakePush({ existing: current.subscription }).push, server.api))).toBe('failed')
    expect(current.state.unsubscribed).toBe(true)
    expect(await getSetting('birthdayReminders')).toEqual({ ...REMINDERS_OFF, lastError: 'revoked' })
  })

  it('reports any other failure', async () => {
    await seedOn()
    expect(await sendTestNotification(deps(fakePush().push, fakeApi({ test: ['error'] }).api))).toBe('failed')
  })
})
