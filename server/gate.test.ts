import { describe, expect, it } from 'vitest'
import { MAX_ATTEMPTS, recordFailure } from './attempts.ts'
import { MESSAGES, handleRequest, sanitizeNext, type GateEnv } from './gate.ts'
import { createMemoryKv } from './memoryKv.ts'
import { createSessionValue, deriveSessionKey, verifySessionValue } from './session.ts'

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

function sessionKey() {
  return deriveSessionKey(SECRET, PASSWORD)
}

async function signedInCookie(): Promise<string> {
  return `__Host-ft_session=${await createSessionValue(await sessionKey(), NOW)}`
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

  it('allows only printable ASCII', () => {
    expect(sanitizeNext('/€')).toBe('/')
    expect(sanitizeNext('/\t/evil')).toBe('/')
    expect(sanitizeNext('/a b')).toBe('/')
    expect(sanitizeNext('/a\r\nSet-Cookie: x=1')).toBe('/')
    expect(sanitizeNext('/\r\n')).toBe('/')
    // Percent-encoded text is not decoded, so it stays a harmless same-site path.
    expect(sanitizeNext('/%2F%2Fevil')).toBe('/%2F%2Fevil')
    expect(sanitizeNext('/%E2%82%AC')).toBe('/%E2%82%AC')
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

describe('non-ASCII return paths', () => {
  it('falls back to / instead of throwing', async () => {
    const { env } = setup()
    const html = await (await run(get('/__login?next=/%E2%82%AC'), env)).text()
    expect(html).toContain('name="next" value="/"')
    const response = await run(postForm('/__login', { password: PASSWORD, next: '/€' }), env)
    expect(response.status).toBe(303)
    expect(response.headers.get('Location')).toBe('/')
  })
})

describe('cross-site POSTs', () => {
  it('rejects a cross-site /__login before counting anything', async () => {
    const { env, kv } = setup()
    const response = await run(postForm('/__login', { password: 'nope' }, { 'Sec-Fetch-Site': 'cross-site' }), env)
    expect(response.status).toBe(403)
    expect(failureCount(kv)).toBe(0)
  })

  it('rejects a /__login whose Origin is another site, even with the right password', async () => {
    const { env, kv } = setup()
    const response = await run(
      postForm('/__login', { password: PASSWORD }, { Origin: 'https://evil.example' }),
      env,
    )
    expect(response.status).toBe(403)
    expect(response.headers.get('Set-Cookie')).toBeNull()
    expect(failureCount(kv)).toBe(0)
  })

  it('rejects a cross-site lockout attempt even while locked out', async () => {
    const { env, kv } = setup()
    await lockOut(kv)
    const response = await run(postForm('/__login', { password: PASSWORD }, { Origin: 'null' }), env)
    expect(response.status).toBe(403)
  })

  it('accepts same-origin and same-site requests', async () => {
    const { env } = setup()
    const same = await run(postForm('/__login', { password: PASSWORD }, { Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin' }), env)
    expect(same.status).toBe(303)
    const none = await run(postForm('/__login', { password: PASSWORD }, { 'Sec-Fetch-Site': 'none' }), env)
    expect(none.status).toBe(303)
  })

  it('rejects a cross-site /__verify-password before counting', async () => {
    const { env, kv } = setup()
    const cookie = await signedInCookie()
    const body = JSON.stringify({ password: 'nope' })
    expect((await run(postJson('/__verify-password', body, { Cookie: cookie, 'Sec-Fetch-Site': 'cross-site' }), env)).status).toBe(403)
    expect((await run(postJson('/__verify-password', body, { Cookie: cookie, Origin: 'https://evil.example' }), env)).status).toBe(403)
    expect(failureCount(kv)).toBe(0)
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
    expect(cookie).toMatch(/^__Host-ft_session=v1\.\d+\.[\w-]{43}; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=31536000$/)
    const value = cookie.slice('__Host-ft_session='.length, cookie.indexOf(';'))
    expect(await verifySessionValue(await sessionKey(), value, NOW)).toBe(true)
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

  it('answers 415 without counting when the body is not JSON', async () => {
    const { env, kv } = setup()
    const cookie = await signedInCookie()
    const body = JSON.stringify({ password: 'nope' })
    const plain = postJson('/__verify-password', body, { Cookie: cookie, 'Content-Type': 'text/plain' })
    expect((await run(plain, env)).status).toBe(415)
    const form = postForm('/__verify-password', { password: 'nope' }, { Cookie: cookie })
    expect((await run(form, env)).status).toBe(415)
    expect(failureCount(kv)).toBe(0)
  })

  it('accepts a JSON content type in any case, with parameters', async () => {
    const { env } = setup()
    const body = JSON.stringify({ password: PASSWORD })
    const headers = { Cookie: await signedInCookie(), 'Content-Type': 'Application/JSON; charset=utf-8' }
    expect((await run(postJson('/__verify-password', body, headers), env)).status).toBe(204)
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
    const forged = `__Host-ft_session=${await createSessionValue(await deriveSessionKey("another-secret-0123456789-abcdefghijk", PASSWORD), NOW)}`
    expect((await run(get('/assets/index.js', { Cookie: forged }), env)).status).toBe(401)
    const expired = `__Host-ft_session=${await createSessionValue(await sessionKey(), NOW - 366 * 24 * 3600 * 1000)}`
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

  it('accepts any valid cookie when the name appears twice', async () => {
    const { env } = setup()
    const good = await signedInCookie()
    expect(await handleRequest(get('/a.js', { Cookie: `__Host-ft_session=garbage; ${good}` }), env, NOW)).toBe('next')
    expect(await handleRequest(get('/a.js', { Cookie: `${good}; __Host-ft_session=garbage` }), env, NOW)).toBe('next')
    expect((await run(get('/a.js', { Cookie: '__Host-ft_session=garbage; __Host-ft_session=junk' }), env)).status).toBe(401)
  })

  it('does not accept the old cookie name', async () => {
    const { env } = setup()
    const old = (await signedInCookie()).replace('__Host-', '')
    expect(old.startsWith('ft_session=')).toBe(true)
    expect((await run(get('/a.js', { Cookie: old }), env)).status).toBe(401)
  })

  it('revokes sessions when the site password changes', async () => {
    const { env } = setup()
    const cookie = await signedInCookie()
    expect(await handleRequest(get('/a.js', { Cookie: cookie }), env, NOW)).toBe('next')
    const rotated: GateEnv = { ...env, SITE_PASSWORD: 'a brand new password, much longer' }
    expect((await run(get('/a.js', { Cookie: cookie }), rotated)).status).toBe(401)
  })

  it('never lets a path variant through without a session', async () => {
    const { env } = setup()
    for (const path of ['/__LOGIN', '/%5F%5Flogin', '/__login/', '//__login', '/__verify-password/', '/__VERIFY-PASSWORD']) {
      expect(await handleRequest(get(path), env, NOW)).not.toBe('next')
    }
    for (const method of ['HEAD', 'OPTIONS', 'PUT', 'DELETE', 'PATCH']) {
      expect(await handleRequest(new Request(`${ORIGIN}/`, { method }), env, NOW)).not.toBe('next')
    }
  })

  it('treats empty and oversized passwords as wrong', async () => {
    const { env, kv } = setup()
    expect((await run(postForm('/__login', { password: '' }), env)).status).toBe(401)
    expect((await run(postForm('/__login', { password: 'x'.repeat(1025) }), env)).status).toBe(401)
    expect((await run(postForm('/__login', { password: 'x'.repeat(5000) }), env)).status).toBe(401)
    expect(failureCount(kv)).toBe(3)
  })

  it('still requires the password when KV is down', async () => {
    const { env, kv } = setup()
    kv.failing = true
    expect((await run(postForm('/__login', { password: 'nope' }), env)).status).toBe(401)
    expect((await run(postForm('/__login', { password: PASSWORD }), env)).status).toBe(303)
  })

  it('stays closed when it is not set up', async () => {
    const kv = createMemoryKv()
    const broken: GateEnv[] = [
      { SITE_PASSWORD: 'fifteen chars!!', SESSION_SECRET: SECRET, LOGIN_ATTEMPTS: kv },
      { SITE_PASSWORD: '', SESSION_SECRET: SECRET, LOGIN_ATTEMPTS: kv },
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
