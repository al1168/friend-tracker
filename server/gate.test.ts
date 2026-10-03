import { describe, expect, it } from 'vitest'
import { MAX_ATTEMPTS, recordFailure } from './attempts.ts'
import { MESSAGES, handleRequest, sanitizeNext, type GateEnv } from './gate.ts'
import { createMemoryKv } from './memoryKv.ts'
import { createSessionValue, verifySessionValue } from './session.ts'

const ORIGIN = 'https://friend-tracker.pages.dev'
const SECRET = 'test-secret-0123456789-abcdefghijklmnop'
const PASSWORD = 'maple otter lantern river'
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)
const IP = '203.0.113.7'

function setup() {
  const kv = createMemoryKv()
  const env: GateEnv = { SITE_PASSWORD: PASSWORD, SESSION_SECRET: SECRET, LOGIN_ATTEMPTS: kv }
  return { kv, env }
}

async function signedInCookie(): Promise<string> {
  return `ft_session=${await createSessionValue(SECRET, NOW)}`
}

function get(path: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, { headers })
}

function postForm(path: string, fields: Record<string, string>, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    body: new URLSearchParams(fields),
    headers: { 'CF-Connecting-IP': IP, ...headers },
  })
}

function postJson(path: string, body: string, headers: Record<string, string> = {}): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: 'POST',
    body,
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': IP, ...headers },
  })
}

async function run(request: Request, env: GateEnv): Promise<Response> {
  const result = await handleRequest(request, env, NOW)
  if (result === 'next') throw new Error('expected the gate to answer')
  return result
}

function failureCount(kv: ReturnType<typeof createMemoryKv>, ip = IP): number {
  const entry = kv.entries.get(`fail:${ip}`)
  return entry ? (JSON.parse(entry.value) as { count: number }).count : 0
}

async function lockOut(kv: ReturnType<typeof createMemoryKv>) {
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) await recordFailure(kv, IP, NOW)
}

describe('sanitizeNext', () => {
  it('keeps same-site paths', () => {
    expect(sanitizeNext('/')).toBe('/')
    expect(sanitizeNext('/stats?year=2025')).toBe('/stats?year=2025')
  })

  it('replaces anything else with /', () => {
    for (const bad of [null, undefined, '', 'stats', 'https://evil.example/', '//evil.example', '/\\evil.example', '/a\nb']) {
      expect(sanitizeNext(bad)).toBe('/')
    }
  })
})

describe('GET /__login', () => {
  it('shows the sign-in page when signed out', async () => {
    const { env } = setup()
    const response = await run(get('/__login?next=%2Fstats'), env)
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8')
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'none'")
    const html = await response.text()
    expect(html).toContain('Enter your password to open the app.')
    expect(html).toContain('name="next" value="/stats"')
  })

  it('drops an unsafe return path', async () => {
    const { env } = setup()
    const html = await (await run(get('/__login?next=%2F%2Fevil.example'), env)).text()
    expect(html).toContain('name="next" value="/"')
  })

  it('sends a signed-in visitor to the app', async () => {
    const { env } = setup()
    const response = await run(get('/__login', { Cookie: await signedInCookie() }), env)
    expect(response.status).toBe(303)
    expect(response.headers.get('Location')).toBe('/')
  })
})

describe('POST /__login', () => {
  it('signs in with the right password', async () => {
    const { env, kv } = setup()
    await recordFailure(kv, IP, NOW)
    const response = await run(postForm('/__login', { password: PASSWORD, next: '/stats' }), env)
    expect(response.status).toBe(303)
    expect(response.headers.get('Location')).toBe('/stats')
    const cookie = response.headers.get('Set-Cookie') ?? ''
    expect(cookie).toMatch(/^ft_session=v1\.\d+\.[\w-]{43}; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=31536000$/)
    const value = cookie.slice('ft_session='.length, cookie.indexOf(';'))
    expect(await verifySessionValue(SECRET, value, NOW)).toBe(true)
    expect(failureCount(kv)).toBe(0)
  })

  it('returns to / when next is unsafe', async () => {
    const { env } = setup()
    const response = await run(postForm('/__login', { password: PASSWORD, next: '//evil.example' }), env)
    expect(response.headers.get('Location')).toBe('/')
  })

  it('rejects a wrong password and counts it', async () => {
    const { env, kv } = setup()
    const response = await run(postForm('/__login', { password: 'nope', next: '/' }), env)
    expect(response.status).toBe(401)
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(await response.text()).toContain(MESSAGES.wrongPassword.replace("'", '&#39;'))
    expect(failureCount(kv)).toBe(1)
  })

  it('refuses even the right password while locked out', async () => {
    const { env, kv } = setup()
    await lockOut(kv)
    const response = await run(postForm('/__login', { password: PASSWORD, next: '/' }), env)
    expect(response.status).toBe(429)
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(await response.text()).toContain(MESSAGES.tooManyAttempts)
  })

  it('counts failures under "unknown" when there is no client IP', async () => {
    const { env, kv } = setup()
    const request = new Request(`${ORIGIN}/__login`, { method: 'POST', body: new URLSearchParams({ password: 'x' }) })
    await run(request, env)
    expect(failureCount(kv, 'unknown')).toBe(1)
  })

  it('allows only GET and POST', async () => {
    const { env } = setup()
    const response = await run(new Request(`${ORIGIN}/__login`, { method: 'PUT' }), env)
    expect(response.status).toBe(405)
  })
})

describe('POST /__verify-password', () => {
  it('needs a signed-in session', async () => {
    const { env, kv } = setup()
    const response = await run(postJson('/__verify-password', JSON.stringify({ password: PASSWORD })), env)
    expect(response.status).toBe(403)
    expect(failureCount(kv)).toBe(0)
  })

  it('answers 204 for the right password and clears failures', async () => {
    const { env, kv } = setup()
    await recordFailure(kv, IP, NOW)
    const body = JSON.stringify({ password: PASSWORD })
    const response = await run(postJson('/__verify-password', body, { Cookie: await signedInCookie() }), env)
    expect(response.status).toBe(204)
    expect(failureCount(kv)).toBe(0)
  })

  it('answers 401 for a wrong password and counts it', async () => {
    const { env, kv } = setup()
    const body = JSON.stringify({ password: 'nope' })
    const response = await run(postJson('/__verify-password', body, { Cookie: await signedInCookie() }), env)
    expect(response.status).toBe(401)
    expect(failureCount(kv)).toBe(1)
  })

  it('answers 429 while locked out, even for the right password', async () => {
    const { env, kv } = setup()
    await lockOut(kv)
    const body = JSON.stringify({ password: PASSWORD })
    const response = await run(postJson('/__verify-password', body, { Cookie: await signedInCookie() }), env)
    expect(response.status).toBe(429)
  })

  it('answers 400 for a malformed body without counting it', async () => {
    const { env, kv } = setup()
    const cookie = await signedInCookie()
    expect((await run(postJson('/__verify-password', 'not json', { Cookie: cookie }), env)).status).toBe(400)
    expect((await run(postJson('/__verify-password', '{"password":1}', { Cookie: cookie }), env)).status).toBe(400)
    expect(failureCount(kv)).toBe(0)
  })

  it('allows only POST', async () => {
    const { env } = setup()
    const response = await run(get('/__verify-password', { Cookie: await signedInCookie() }), env)
    expect(response.status).toBe(405)
  })
})

describe('everything else', () => {
  it('passes through with a valid session', async () => {
    const { env } = setup()
    expect(await handleRequest(get('/assets/index.js', { Cookie: await signedInCookie() }), env, NOW)).toBe('next')
  })

  it('redirects a signed-out navigation to the sign-in page', async () => {
    const { env } = setup()
    const response = await run(get('/stats?year=2025', { 'Sec-Fetch-Mode': 'navigate' }), env)
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/__login?next=%2Fstats%3Fyear%3D2025')
  })

  it('treats a request that accepts HTML as a navigation', async () => {
    const { env } = setup()
    const response = await run(get('/', { Accept: 'text/html,application/xhtml+xml' }), env)
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/__login?next=%2F')
  })

  it('answers 401 with no body for a signed-out file request', async () => {
    const { env } = setup()
    const response = await run(get('/assets/index.js'), env)
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('')
  })

  it('ignores a forged or expired session', async () => {
    const { env } = setup()
    const forged = `ft_session=${await createSessionValue('another-secret-0123456789-abcdefghijk', NOW)}`
    expect((await run(get('/assets/index.js', { Cookie: forged }), env)).status).toBe(401)
    const expired = `ft_session=${await createSessionValue(SECRET, NOW - 366 * 24 * 3600 * 1000)}`
    expect((await run(get('/assets/index.js', { Cookie: expired }), env)).status).toBe(401)
  })

  it('adds the security headers to every response it makes', async () => {
    const { env } = setup()
    const responses = [
      await run(get('/__login'), env),
      await run(postForm('/__login', { password: 'nope' }), env),
      await run(postJson('/__verify-password', '{}'), env),
      await run(get('/', { 'Sec-Fetch-Mode': 'navigate' }), env),
      await run(get('/assets/index.js'), env),
    ]
    for (const response of responses) {
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    }
  })

  it('stays closed when it is not set up', async () => {
    const kv = createMemoryKv()
    const broken: GateEnv[] = [
      { SESSION_SECRET: SECRET, LOGIN_ATTEMPTS: kv },
      { SITE_PASSWORD: PASSWORD, LOGIN_ATTEMPTS: kv },
      { SITE_PASSWORD: PASSWORD, SESSION_SECRET: 'too-short', LOGIN_ATTEMPTS: kv },
      { SITE_PASSWORD: PASSWORD, SESSION_SECRET: SECRET },
    ]
    for (const env of broken) {
      const response = await run(get('/', { Cookie: await signedInCookie() }), env)
      expect(response.status).toBe(500)
      expect(await response.text()).toBe(MESSAGES.notSetUp)
    }
  })
})
