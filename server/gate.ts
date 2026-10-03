// The website password gate. Pure request handling: everything it needs comes in as arguments.

import { clearFailures, isLockedOut, recordFailure, type KVLike } from './attempts.ts'
import { loginPage } from './loginPage.ts'
import { checkPassword } from './password.ts'
import {
  SESSION_COOKIE,
  createSessionValue,
  derivePasswordKey,
  deriveSessionKey,
  readCookies,
  sessionCookie,
  verifySessionValue,
} from './session.ts'

export interface GateEnv {
  SITE_PASSWORD?: string
  SESSION_SECRET?: string
  LOGIN_ATTEMPTS?: KVLike
}

export const LOGIN_PATH = '/__login'
export const VERIFY_PATH = '/__verify-password'

/** The shortest SITE_PASSWORD the gate accepts. Guessing is limited per address only, so the passphrase must be strong. */
export const MIN_PASSWORD_LENGTH = 16

export const MESSAGES = {
  wrongPassword: "That password didn't work.",
  tooManyAttempts: 'Too many attempts. Try again in 15 minutes.',
  notSetUp: "Friend Tracker isn't set up yet.",
} as const

const SECURITY_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  // Not 'no-referrer': with it a browser sends "Origin: null" on a form POST from the sign-in page,
  // which would make the cross-site check reject the owner's own sign-in.
  'Referrer-Policy': 'same-origin',
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

/** Only same-site paths survive: one leading "/", then printable ASCII only, and no "//" or backslash. */
export function sanitizeNext(next: string | null | undefined): string {
  if (!next || next.startsWith('//') || next.includes('\\')) return '/'
  return /^\/[\x21-\x7e]*$/.test(next) ? next : '/'
}

function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown'
}

/** Signed in when any cookie with the session name verifies (a stray duplicate can't lock the owner out). */
async function hasSession(request: Request, key: CryptoKey, now: number): Promise<boolean> {
  for (const value of readCookies(request.headers.get('Cookie'), SESSION_COOKIE).slice(0, MAX_SESSION_COOKIES)) {
    if (await verifySessionValue(key, value, now)) return true
  }
  return false
}

/**
 * True for a POST that a browser says came from another site (checked before anything is counted).
 * Sec-Fetch-Site decides when present: only "same-origin" and "none" pass. Without it (older browsers,
 * scripts), a request with an Origin header must match the site; "null" is cross-site. No Origin passes.
 */
function isCrossSite(request: Request, url: URL): boolean {
  const site = request.headers.get('Sec-Fetch-Site')
  if (site !== null) return site !== 'same-origin' && site !== 'none'
  const origin = request.headers.get('Origin')
  return origin !== null && origin !== url.origin
}

/** A browser sends at most a few cookies of one name; checking more only costs time. */
const MAX_SESSION_COOKIES = 4

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
  if (!password || password.length < MIN_PASSWORD_LENGTH || !secret || secret.length < 32 || !attempts) {
    return respond(500, MESSAGES.notSetUp, { 'Content-Type': 'text/plain; charset=utf-8' })
  }

  const url = new URL(request.url)
  const sessionKey = await deriveSessionKey(secret, password)
  const passwordKey = await derivePasswordKey(secret)
  const signedIn = await hasSession(request, sessionKey, now)

  if (url.pathname === LOGIN_PATH) {
    if (request.method === 'GET') {
      if (signedIn) return respond(303, null, { Location: '/' })
      return page(200, sanitizeNext(url.searchParams.get('next')), null)
    }
    if (request.method === 'POST') {
      if (isCrossSite(request, url)) return respond(403, 'Forbidden', { 'Content-Type': 'text/plain; charset=utf-8' })
      const form = await readForm(request)
      const next = sanitizeNext(form.next)
      const ip = clientIp(request)
      if (await isLockedOut(attempts, ip, now)) return page(429, next, MESSAGES.tooManyAttempts)
      if (await checkPassword(passwordKey, password, form.password)) {
        await clearFailures(attempts, ip)
        const cookie = sessionCookie(await createSessionValue(sessionKey, now))
        return respond(303, null, { Location: next, 'Set-Cookie': cookie })
      }
      await recordFailure(attempts, ip, now)
      return page(401, next, MESSAGES.wrongPassword)
    }
    return respond(405, null, { Allow: 'GET, POST' })
  }

  if (url.pathname === VERIFY_PATH) {
    if (request.method !== 'POST') return respond(405, null, { Allow: 'POST' })
    if (isCrossSite(request, url) || !signedIn) return respond(403)
    if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) return respond(415)
    const ip = clientIp(request)
    if (await isLockedOut(attempts, ip, now)) return respond(429)
    const submitted = await readJsonPassword(request)
    if (submitted === null) return respond(400)
    if (await checkPassword(passwordKey, password, submitted)) {
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
