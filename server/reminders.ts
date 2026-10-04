// The /__reminders endpoint. The app sends its birthday reminder schedule here, and this hands it to
// the reminders Worker (reminders/) through the REMINDERS service binding. It runs behind the
// website gate (functions/_middleware.ts), so only a signed-in session ever reaches it.
//
//   PUT    /__reminders       { subscription, reminders }  → sync     → 204
//   DELETE /__reminders                                     → clear    → 204
//   POST   /__reminders/test                                → sendTest → 204, or 409 / 410 / 502

import type { Reminder, Subscription, SyncInput, TestResult } from '../reminders/src/schedule.ts'
import { respond } from './gate.ts'

export const REMINDERS_PATH = '/__reminders'
export const REMINDERS_TEST_PATH = '/__reminders/test'

export const NOT_SET_UP = "Birthday reminders aren't set up yet."

/** The reminders Worker's RPC methods, as the service binding exposes them. */
export interface RemindersService {
  sync(input: SyncInput): Promise<void>
  clear(): Promise<void>
  sendTest(): Promise<TestResult>
}

export interface RemindersEnv {
  REMINDERS?: RemindersService
}

/** Push services the Worker may send to, so it can't be used to send requests anywhere else. */
const PUSH_HOSTS = ['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com']
const PUSH_HOST_SUFFIXES = ['.push.apple.com', '.notify.windows.com']

export const MAX_REMINDERS = 1000
export const MAX_FRIEND_ID_LENGTH = 64
const MAX_ENDPOINT_LENGTH = 1024
/** 1,000 reminders take about 70 KB. */
const MAX_BODY_LENGTH = 200_000
const DAY_MS = 86_400_000
/** Reminders reach two years ahead (with room for a leap day). */
export const MAX_AHEAD_MS = 732 * DAY_MS
/** A phone's clock can be off, so a reminder up to a day old is accepted (the Worker drops it if it's too late). */
export const MAX_BEHIND_MS = DAY_MS

const PLAIN_TEXT = { 'Content-Type': 'text/plain; charset=utf-8' }

const TEST_STATUS: Record<TestResult, number> = { sent: 204, 'no-subscription': 409, gone: 410, failed: 502 }

type Obj = Record<string, unknown>

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** An https: URL on a known push service, with no user name, password or port. */
export function isPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > MAX_ENDPOINT_LENGTH) return false
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.port !== '') return false
  const host = url.hostname
  return PUSH_HOSTS.includes(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

/** The number of bytes a base64url key decodes to, or -1 when it isn't base64url. */
function base64urlLength(text: string): number {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(text)) return -1
  const length = text.replace(/=+$/, '').length
  return length % 4 === 1 ? -1 : Math.floor((length * 3) / 4)
}

function readSubscription(value: unknown): Subscription | null {
  if (!isObj(value) || typeof value.endpoint !== 'string' || !isObj(value.keys)) return null
  const { endpoint } = value
  const { p256dh, auth } = value.keys
  if (!isPushEndpoint(endpoint)) return null
  // p256dh is an uncompressed P-256 point (65 bytes); auth is a 16-byte secret.
  if (typeof p256dh !== 'string' || base64urlLength(p256dh) !== 65) return null
  if (typeof auth !== 'string' || base64urlLength(auth) !== 16) return null
  return { endpoint, keys: { p256dh, auth } }
}

function readReminders(value: unknown, now: number): Reminder[] | null {
  if (!Array.isArray(value) || value.length > MAX_REMINDERS) return null
  const reminders: Reminder[] = []
  for (const item of value) {
    if (!isObj(item)) return null
    const { at, friendId } = item
    if (typeof at !== 'number' || !Number.isInteger(at) || at < now - MAX_BEHIND_MS || at > now + MAX_AHEAD_MS) {
      return null
    }
    if (typeof friendId !== 'string' || friendId.length === 0 || friendId.length > MAX_FRIEND_ID_LENGTH) return null
    // Only these two fields go on.
    reminders.push({ at, friendId })
  }
  return reminders
}

/** The PUT body, checked: `{ subscription, reminders }` within every limit, or null. */
export async function readSchedule(request: Request, now: number): Promise<SyncInput | null> {
  let body: unknown
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_LENGTH) return null
    body = JSON.parse(text)
  } catch {
    return null
  }
  if (!isObj(body)) return null
  const subscription = readSubscription(body.subscription)
  const reminders = readReminders(body.reminders, now)
  return subscription && reminders ? { subscription, reminders } : null
}

export async function handleReminders(request: Request, env: RemindersEnv, now: number): Promise<Response> {
  const { pathname } = new URL(request.url)
  if (pathname !== REMINDERS_PATH && pathname !== REMINDERS_TEST_PATH) return respond(404)
  const methods = pathname === REMINDERS_TEST_PATH ? ['POST'] : ['PUT', 'DELETE']
  if (!methods.includes(request.method)) return respond(405, null, { Allow: methods.join(', ') })
  // Only the app itself, on this site, may change the schedule.
  if (request.headers.get('Sec-Fetch-Site') !== 'same-origin') return respond(403, 'Forbidden', PLAIN_TEXT)
  // Fail closed: without the Worker there's nothing to talk to.
  const service = env.REMINDERS
  if (!service) return respond(503, NOT_SET_UP, PLAIN_TEXT)

  try {
    if (request.method === 'DELETE') {
      await service.clear()
      return respond(204)
    }
    if (request.method === 'POST') return respond(TEST_STATUS[await service.sendTest()] ?? 502)
    if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) return respond(415)
    const input = await readSchedule(request, now)
    if (!input) return respond(400)
    await service.sync(input)
    return respond(204)
  } catch {
    // The Worker failed or couldn't be reached.
    return respond(502)
  }
}
