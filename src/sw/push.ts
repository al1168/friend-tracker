// What the service worker does with a push, and with a tap on its notification. Kept apart from
// src/sw.ts so it can be tested in Node: the browser objects come in as arguments.
// Runs in the service worker, so nothing here (or in what it imports) may touch window or document.

import { db } from '../db/db'
import { birthdayNotice, fallbackNotice, pushKind, TEST_NOTICE, type Notice } from '../lib/reminders'
import type { Friend } from '../types'

/** Reading the friends gives up after this long, so a push still shows something in time. */
export const READ_TIMEOUT_MS = 5000

/** The parts of a PushEvent this code uses. */
export interface PushEventLike {
  readonly data: { json(): unknown } | null
  waitUntil(promise: Promise<unknown>): void
}

/** The parts of a ServiceWorkerRegistration this code uses. */
export interface NotifierLike {
  showNotification(title: string, options: NotificationOptions): Promise<void>
}

export interface PushOptions {
  registration: NotifierLike
  /** Reads every friend. Defaults to the app's database. */
  readFriends?: () => Promise<Friend[]>
  /** The current time in ms. Defaults to Date.now. */
  now?: () => number
  timeoutMs?: number
}

function readPayload(data: PushEventLike['data']): unknown {
  try {
    return data ? data.json() : null
  } catch {
    // Not JSON: counts as a birthday reminder.
    return null
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timed out')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function noticeFor(payload: unknown, options: PushOptions, now: number): Promise<Notice> {
  if (pushKind(payload) === 'test') return TEST_NOTICE
  try {
    const readFriends = options.readFriends ?? (() => db.friends.toArray())
    return birthdayNotice(await withTimeout(readFriends(), options.timeoutMs ?? READ_TIMEOUT_MS), now)
  } catch {
    return fallbackNotice(now)
  }
}

async function showFor(payload: unknown, options: PushOptions, now: number): Promise<void> {
  const notice = await noticeFor(payload, options, now)
  await options.registration.showNotification(notice.title, {
    body: notice.body,
    tag: notice.tag,
    data: { url: notice.url },
  })
}

/**
 * Handles a push. iOS stops sending pushes to an app that receives them without showing a
 * notification, so this always shows exactly one, inside waitUntil, even when the friends
 * can't be read.
 */
export function onPush(event: PushEventLike, options: PushOptions): void {
  const now = (options.now ?? Date.now)()
  event.waitUntil(showFor(readPayload(event.data), options, now))
}

/** The parts of a WindowClient this code uses. */
export interface WindowClientLike {
  focus(): Promise<WindowClientLike>
  navigate(url: string): Promise<WindowClientLike | null>
}

/** The parts of the service worker's `clients` this code uses. */
export interface ClientsLike {
  matchAll(options: { type: 'window'; includeUncontrolled: boolean }): Promise<readonly WindowClientLike[]>
  openWindow(url: string): Promise<unknown>
}

/** The parts of a NotificationEvent this code uses. */
export interface NotificationClickLike {
  readonly notification: { readonly data: unknown; close(): void }
  waitUntil(promise: Promise<unknown>): void
}

/** Where a tapped notification goes: its `data.url`, on this site only, else the Friends tab. */
export function clickTarget(data: unknown, scope: string): string {
  const home = new URL('/#/', scope).href
  const url = typeof data === 'object' && data !== null ? (data as { url?: unknown }).url : undefined
  if (typeof url !== 'string') return home
  const target = new URL(url, scope)
  return target.origin === new URL(scope).origin ? target.href : home
}

/** Brings an open window to the front and takes it to `url`, or opens the app there. */
export async function openApp(url: string, clients: ClientsLike): Promise<void> {
  for (const client of await clients.matchAll({ type: 'window', includeUncontrolled: true })) {
    try {
      const focused = await client.focus()
      // If it can't be moved, it's in front anyway, showing where the owner left it.
      await focused.navigate(url).catch(() => null)
      return
    } catch {
      // This window can't be focused; try the next, or open a new one.
    }
  }
  await clients.openWindow(url)
}

export function onNotificationClick(event: NotificationClickLike, clients: ClientsLike, scope: string): void {
  event.notification.close()
  event.waitUntil(openApp(clickTarget(event.notification.data, scope), clients))
}
