import { describe, expect, it } from 'vitest'
import type { SyncInput, TestResult } from '../reminders/src/schedule.ts'
import { handleRequest, type GateEnv } from './gate.ts'
import { createMemoryKv } from './memoryKv.ts'
import {
  handleReminders,
  isPushEndpoint,
  MAX_AHEAD_MS,
  MAX_BEHIND_MS,
  NOT_SET_UP,
  type RemindersEnv,
  type RemindersService,
} from './reminders.ts'
import { createSessionValue, deriveSessionKey } from './session.ts'

const ORIGIN = 'https://friend.example'
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)

/** Valid base64url keys of the right sizes: a 65-byte P-256 point (starting 0x04) and a 16-byte secret. */
const P256DH = `B${'A'.repeat(86)}`
const AUTH = 'A'.repeat(22)

const SUBSCRIPTION = { endpoint: 'https://web.push.apple.com/QGuQyavXutnMH-endpoint', keys: { p256dh: P256DH, auth: AUTH } }
const REMINDERS = [{ at: NOW + 86_400_000, friendId: '8f14e45f-ceea-467f-a0e6-b5c1e0f4a1d2' }]

/** A stand-in for the Worker's RPC methods that records every call. */
function fakeService(testResult: TestResult = 'sent', fail = false) {
  const calls: { method: string; input?: SyncInput }[] = []
  const service: RemindersService = {
    sync: async (input) => {
      calls.push({ method: 'sync', input })
      if (fail) throw new Error('Worker exception')
    },
    clear: async () => {
      calls.push({ method: 'clear' })
      if (fail) throw new Error('Worker exception')
    },
    sendTest: async () => {
      calls.push({ method: 'sendTest' })
      if (fail) throw new Error('Worker exception')
      return testResult
    },
  }
  return { env: { REMINDERS: service } as RemindersEnv, calls }
}

interface RequestOptions {
  body?: unknown
  headers?: Record<string, string>
  /** The browser's Sec-Fetch-Site header, or null for none. */
  site?: string | null
}

function request(method: string, path = '/__reminders', { body, headers = {}, site = 'same-origin' }: RequestOptions = {}) {
  const text = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  const fetchSite: Record<string, string> = site === null ? {} : { 'Sec-Fetch-Site': site }
  return new Request(`${ORIGIN}${path}`, {
    method,
    body: text,
    headers: { ...fetchSite, 'Content-Type': 'application/json', ...headers },
  })
}

function put(body: unknown, headers: Record<string, string> = {}, site: string | null = 'same-origin') {
  return request('PUT', '/__reminders', { body, headers, site })
}

async function statusOf(req: Request, env: RemindersEnv): Promise<number> {
  return (await handleReminders(req, env, NOW)).status
}

describe('the website gate in front of /__reminders', () => {
  const PASSWORD = 'maple otter lantern river'
  const SECRET = 'test-secret-0123456789-abcdefghijklmnop'
  const gateEnv: GateEnv = { SITE_PASSWORD: PASSWORD, SESSION_SECRET: SECRET, LOGIN_ATTEMPTS: createMemoryKv() }

  it('refuses every reminders request without a session', async () => {
    for (const req of [put({ subscription: SUBSCRIPTION, reminders: REMINDERS }), request('DELETE'), request('POST', '/__reminders/test')]) {
      const result = await handleRequest(req, gateEnv, NOW)
      expect(result instanceof Response && result.status).toBe(401)
    }
  })

  it('passes signed-in requests on to the function', async () => {
    const cookie = `__Host-ft_session=${await createSessionValue(await deriveSessionKey(SECRET, PASSWORD), NOW)}`
    for (const req of [
      put({ subscription: SUBSCRIPTION, reminders: REMINDERS }, { Cookie: cookie }),
      request('DELETE', '/__reminders', { headers: { Cookie: cookie } }),
      request('POST', '/__reminders/test', { headers: { Cookie: cookie } }),
    ]) {
      expect(await handleRequest(req, gateEnv, NOW)).toBe('next')
    }
  })
})

describe('PUT /__reminders', () => {
  it('hands a valid schedule to the Worker, keeping only the known fields', async () => {
    const { env, calls } = fakeService()
    const body = {
      subscription: { ...SUBSCRIPTION, expirationTime: null, extra: 'x' },
      reminders: [{ ...REMINDERS[0], name: 'Alex' }],
      extra: true,
    }
    expect(await statusOf(put(body), env)).toBe(204)
    expect(calls).toEqual([{ method: 'sync', input: { subscription: SUBSCRIPTION, reminders: REMINDERS } }])
  })

  it('stores the normalized endpoint', async () => {
    const { env, calls } = fakeService()
    const raw = 'https://WEB.PUSH.APPLE.COM/QGuQ yavX'
    const body = { subscription: { ...SUBSCRIPTION, endpoint: raw }, reminders: REMINDERS }
    expect(await statusOf(put(body), env)).toBe(204)
    expect(calls[0].input?.subscription.endpoint).toBe('https://web.push.apple.com/QGuQ%20yavX')
  })

  it('accepts an empty list', async () => {
    const { env, calls } = fakeService()
    expect(await statusOf(put({ subscription: SUBSCRIPTION, reminders: [] }), env)).toBe(204)
    expect(calls).toHaveLength(1)
  })

  it('takes JSON only', async () => {
    const { env, calls } = fakeService()
    const req = put({ subscription: SUBSCRIPTION, reminders: REMINDERS }, { 'Content-Type': 'text/plain' })
    expect(await statusOf(req, env)).toBe(415)
    expect(calls).toEqual([])
  })

  it('refuses a body that is not a schedule', async () => {
    const { env, calls } = fakeService()
    const bad = ['not json', '[]', 'null', JSON.stringify({ reminders: REMINDERS }), JSON.stringify({ subscription: SUBSCRIPTION })]
    for (const body of bad) expect(await statusOf(put(body), env)).toBe(400)
    const huge = JSON.stringify({ subscription: SUBSCRIPTION, reminders: REMINDERS, padding: 'x'.repeat(200_000) })
    expect(await statusOf(put(huge), env)).toBe(400)
    expect(calls).toEqual([])
  })
})

describe('isPushEndpoint', () => {
  it('accepts the push services', () => {
    for (const endpoint of [
      'https://web.push.apple.com/QGuQyavXutnMH',
      'https://api.push.apple.com/3/device/abc',
      'https://fcm.googleapis.com/fcm/send/abc:def',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://wns2-by3p.notify.windows.com/w/?token=abc',
    ]) {
      expect(isPushEndpoint(endpoint)).toBe(true)
    }
  })

  it('refuses anywhere else', () => {
    for (const endpoint of [
      'http://web.push.apple.com/abc',
      'https://evil.example/abc',
      'https://web.push.apple.com.evil.example/abc',
      'https://evilpush.apple.com/abc',
      'https://push.apple.com/abc',
      'https://web.push.apple.com./abc',
      'https://user:pass@web.push.apple.com/abc',
      'https://web.push.apple.com:8443/abc',
      'https://169.254.169.254/latest',
      'https://localhost/abc',
      'not a url',
      `https://web.push.apple.com/${'a'.repeat(1024)}`,
    ]) {
      expect(isPushEndpoint(endpoint)).toBe(false)
    }
  })
})

describe('PUT /__reminders limits', () => {
  async function refused(change: (body: { subscription: Record<string, unknown>; reminders: unknown[] }) => void) {
    const { env, calls } = fakeService()
    const body = { subscription: structuredClone(SUBSCRIPTION) as Record<string, unknown>, reminders: structuredClone(REMINDERS) as unknown[] }
    change(body)
    const status = await statusOf(put(body), env)
    return status === 400 && calls.length === 0
  }

  it('refuses an endpoint outside the push services', async () => {
    expect(await refused((body) => (body.subscription.endpoint = 'https://evil.example/abc'))).toBe(true)
  })

  it('refuses keys of the wrong size or format', async () => {
    expect(await refused((body) => (body.subscription.keys = { p256dh: P256DH.slice(1), auth: AUTH }))).toBe(true)
    expect(await refused((body) => (body.subscription.keys = { p256dh: P256DH, auth: `${AUTH}AAAA` }))).toBe(true)
    expect(await refused((body) => (body.subscription.keys = { p256dh: `${P256DH.slice(1)}+`, auth: AUTH }))).toBe(true)
    expect(await refused((body) => (body.subscription.keys = { p256dh: P256DH }))).toBe(true)
  })

  it('refuses a 65-byte key that is not an uncompressed point (first byte not 0x04)', async () => {
    for (const first of ['C', 'A', '_']) {
      expect(await refused((body) => (body.subscription.keys = { p256dh: `${first}${P256DH.slice(1)}`, auth: AUTH }))).toBe(true)
    }
  })

  it('takes at most 1,000 reminders', async () => {
    const reminder = REMINDERS[0]
    expect(await refused((body) => (body.reminders = Array.from({ length: 1001 }, () => reminder)))).toBe(true)
    const { env } = fakeService()
    const thousand = { subscription: SUBSCRIPTION, reminders: Array.from({ length: 1000 }, () => reminder) }
    expect(await statusOf(put(thousand), env)).toBe(204)
  })

  it('takes whole-millisecond times from a day ago to two years ahead', async () => {
    for (const at of [Number.NaN, 1.5 + NOW, `${NOW}`, null, NOW - MAX_BEHIND_MS - 1, NOW + MAX_AHEAD_MS + 1]) {
      expect(await refused((body) => (body.reminders = [{ at, friendId: 'alex' }]))).toBe(true)
    }
    const { env } = fakeService()
    const edges = [
      { at: NOW - MAX_BEHIND_MS, friendId: 'alex' },
      { at: NOW + MAX_AHEAD_MS, friendId: 'sam' },
    ]
    expect(await statusOf(put({ subscription: SUBSCRIPTION, reminders: edges }), env)).toBe(204)
  })

  it('takes friend ids of 1 to 64 characters', async () => {
    for (const friendId of ['', 'x'.repeat(65), 42, null]) {
      expect(await refused((body) => (body.reminders = [{ at: NOW, friendId }]))).toBe(true)
    }
    expect(await refused((body) => (body.reminders = ['alex']))).toBe(true)
    const { env } = fakeService()
    expect(await statusOf(put({ subscription: SUBSCRIPTION, reminders: [{ at: NOW, friendId: 'x'.repeat(64) }] }), env)).toBe(204)
  })
})

describe('DELETE /__reminders', () => {
  it('clears the schedule', async () => {
    const { env, calls } = fakeService()
    expect(await statusOf(request('DELETE'), env)).toBe(204)
    expect(calls).toEqual([{ method: 'clear' }])
  })
})

describe('POST /__reminders/test', () => {
  it("passes on the Worker's answer", async () => {
    const expected: [TestResult, number][] = [
      ['sent', 204],
      ['no-subscription', 409],
      ['gone', 410],
      ['failed', 502],
    ]
    for (const [result, status] of expected) {
      const { env, calls } = fakeService(result)
      expect(await statusOf(request('POST', '/__reminders/test'), env)).toBe(status)
      expect(calls).toEqual([{ method: 'sendTest' }])
    }
  })
})

describe('every reminders request', () => {
  it('must come from this site', async () => {
    for (const site of ['cross-site', 'same-site', 'none', null]) {
      const reqs = [
        put({ subscription: SUBSCRIPTION, reminders: REMINDERS }, {}, site),
        request('DELETE', '/__reminders', { site }),
        request('POST', '/__reminders/test', { site }),
      ]
      for (const req of reqs) {
        const { env, calls } = fakeService()
        expect(await statusOf(req, env)).toBe(403)
        expect(calls).toEqual([])
      }
    }
  })

  it('fails closed when the Worker is not bound', async () => {
    for (const req of [put({ subscription: SUBSCRIPTION, reminders: REMINDERS }), request('DELETE'), request('POST', '/__reminders/test')]) {
      const response = await handleReminders(req, {}, NOW)
      expect(response.status).toBe(503)
      expect(await response.text()).toBe(NOT_SET_UP)
    }
  })

  it('answers 502 when the Worker fails', async () => {
    const { env } = fakeService('sent', true)
    expect(await statusOf(put({ subscription: SUBSCRIPTION, reminders: REMINDERS }), env)).toBe(502)
    expect(await statusOf(request('DELETE'), env)).toBe(502)
    expect(await statusOf(request('POST', '/__reminders/test'), env)).toBe(502)
  })

  it('allows only its methods', async () => {
    const { env, calls } = fakeService()
    const getList = await handleReminders(request('GET'), env, NOW)
    expect(getList.status).toBe(405)
    expect(getList.headers.get('Allow')).toBe('PUT, DELETE')
    const putTest = await handleReminders(request('PUT', '/__reminders/test', { body: {} }), env, NOW)
    expect(putTest.status).toBe(405)
    expect(putTest.headers.get('Allow')).toBe('POST')
    expect(calls).toEqual([])
  })

  it("carries the gate's security headers", async () => {
    const { env } = fakeService()
    const responses = [
      await handleReminders(put({ subscription: SUBSCRIPTION, reminders: REMINDERS }), env, NOW),
      await handleReminders(put('nope'), env, NOW),
      await handleReminders(put({}, {}, 'cross-site'), env, NOW),
      await handleReminders(request('DELETE'), {}, NOW),
    ]
    for (const response of responses) {
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
      expect(response.headers.get('Referrer-Policy')).toBe('same-origin')
    }
  })
})
