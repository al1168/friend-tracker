// The website password gate. Pure request handling: everything it needs comes in as arguments.

import { clearFailures, isLockedOut, recordFailure, type KVLike } from './attempts.ts'
import { loginPage } from './loginPage.ts'
import { checkPassword } from './password.ts'
import { SESSION_COOKIE, createSessionValue, readCookie, sessionCookie, verifySessionValue } from './session.ts'

export interface GateEnv {
  SITE_PASSWORD?: string
  SESSION_SECRET?: string
  LOGIN_ATTEMPTS?: KVLike
}

export const LOGIN_PATH = '/__login'
export const VERIFY_PATH = '/__verify-password'

export const MESSAGES = {
  wrongPassword: "That password didn't work.",
  tooManyAttempts: 'Too many attempts. Try again in 15 minutes.',
  notSetUp: "Friend Tracker isn't set up yet.",
} as const

const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
}

const PAGE_CSP = "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"

function respond(status: number, body: string | null = null, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers: { ...SECURITY_HEADERS, ...headers } })
}

function page(status: number, next: string, error: string | null): Response {
  return respond(status, loginPage({ next, error }), {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': PAGE_CSP,
  })
}

/** Only same-site paths survive: they start with one "/", and have no backslash or control characters. */
export function sanitizeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return '/'
  if (/[\u0000-\u001f\u007f]/.test(next)) return '/'
  return next
}

function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown'
}

async function hasSession(request: Request, secret: string, now: number): Promise<boolean> {
  const value = readCookie(request.headers.get('Cookie'), SESSION_COOKIE)
  return value !== null && (await verifySessionValue(secret, value, now))
}

function isNavigation(request: Request): boolean {
  if (request.headers.get('Sec-Fetch-Mode') === 'navigate') return true
  return (request.headers.get('Accept') ?? '').includes('text/html')
}

async function readForm(request: Request): Promise<{ password: string; next: string | null }> {
  try {
    const form = await request.formData()
    const password = form.get('password')
    const next = form.get('next')
    return { password: typeof password === 'string' ? password : '', next: typeof next === 'string' ? next : null }
  } catch {
    return { password: '', next: null }
  }
}

async function readJsonPassword(request: Request): Promise<string | null> {
  try {
    const body: unknown = await request.json()
    if (typeof body === 'object' && body !== null && 'password' in body && typeof body.password === 'string') {
      return body.password
    }
  } catch {
    // Not JSON.
  }
  return null
}

/** Returns the response to send, or 'next' to serve the requested file as usual. */
export async function handleRequest(request: Request, env: GateEnv, now: number): Promise<Response | 'next'> {
  const password = env.SITE_PASSWORD
  const secret = env.SESSION_SECRET
  const attempts = env.LOGIN_ATTEMPTS
  // Fail closed: a missing secret or binding must never open the site.
  if (!password || !secret || secret.length < 32 || !attempts) {
    return respond(500, MESSAGES.notSetUp, { 'Content-Type': 'text/plain; charset=utf-8' })
  }

  const url = new URL(request.url)
  const signedIn = await hasSession(request, secret, now)

  if (url.pathname === LOGIN_PATH) {
    if (request.method === 'GET') {
      if (signedIn) return respond(303, null, { Location: '/' })
      return page(200, sanitizeNext(url.searchParams.get('next')), null)
    }
    if (request.method === 'POST') {
      const form = await readForm(request)
      const next = sanitizeNext(form.next)
      const ip = clientIp(request)
      if (await isLockedOut(attempts, ip, now)) return page(429, next, MESSAGES.tooManyAttempts)
      if (await checkPassword(secret, password, form.password)) {
        await clearFailures(attempts, ip)
        const cookie = sessionCookie(await createSessionValue(secret, now))
        return respond(303, null, { Location: next, 'Set-Cookie': cookie })
      }
      await recordFailure(attempts, ip, now)
      return page(401, next, MESSAGES.wrongPassword)
    }
    return respond(405, null, { Allow: 'GET, POST' })
  }

  if (url.pathname === VERIFY_PATH) {
    if (request.method !== 'POST') return respond(405, null, { Allow: 'POST' })
    if (!signedIn) return respond(403)
    const ip = clientIp(request)
    if (await isLockedOut(attempts, ip, now)) return respond(429)
    const submitted = await readJsonPassword(request)
    if (submitted === null) return respond(400)
    if (await checkPassword(secret, password, submitted)) {
      await clearFailures(attempts, ip)
      return respond(204)
    }
    await recordFailure(attempts, ip, now)
    return respond(401)
  }

  if (signedIn) return 'next'
  if (isNavigation(request)) {
    return respond(302, null, { Location: `${LOGIN_PATH}?next=${encodeURIComponent(url.pathname + url.search)}` })
  }
  return respond(401)
}
