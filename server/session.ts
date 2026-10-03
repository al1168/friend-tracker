// Signed session cookie: `v1.<expiresAt>.<sig>`, where sig = base64url(HMAC-SHA256(sessionKey, "v1.<expiresAt>")).
// Keys are derived from SESSION_SECRET with HMAC labels, so the cookie key and the password-check key differ,
// and the cookie key also depends on SITE_PASSWORD: changing the password signs everyone out.

export const SESSION_COOKIE = '__Host-ft_session'
/** One year, in seconds. */
export const SESSION_MAX_AGE = 31_536_000

const encoder = new TextEncoder()
const VALUE_PATTERN = /^v1\.(\d{1,12})\.([A-Za-z0-9_-]{43})$/

export function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

async function deriveKey(secret: string, label: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(label))
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/** Key that signs the session cookie: HMAC(SESSION_SECRET, "ft-session\0" + SITE_PASSWORD). */
export function deriveSessionKey(secret: string, password: string): Promise<CryptoKey> {
  return deriveKey(secret, `ft-session\0${password}`)
}

/** Key for the constant-time password comparison: HMAC(SESSION_SECRET, "ft-password-check"). */
export function derivePasswordKey(secret: string): Promise<CryptoKey> {
  return deriveKey(secret, 'ft-password-check')
}

function toBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** A new cookie value that expires SESSION_MAX_AGE seconds after `nowMs`. */
export async function createSessionValue(key: CryptoKey, nowMs: number): Promise<string> {
  const payload = `v1.${Math.floor(nowMs / 1000) + SESSION_MAX_AGE}`
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return `${payload}.${toBase64url(new Uint8Array(signature))}`
}

/** True when the value parses, hasn't expired, and its signature checks out (compared in constant time). */
export async function verifySessionValue(key: CryptoKey, value: string, nowMs: number): Promise<boolean> {
  const match = VALUE_PATTERN.exec(value)
  if (!match) return false
  if (Number(match[1]) <= Math.floor(nowMs / 1000)) return false
  let signature: Uint8Array<ArrayBuffer>
  try {
    signature = fromBase64url(match[2])
  } catch {
    return false
  }
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(`v1.${match[1]}`))
}

export function sessionCookie(value: string): string {
  return `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`
}

/** The values of every cookie with this name in a `Cookie` request header (a browser can send duplicates). */
export function readCookies(header: string | null, name: string): string[] {
  const values: string[] = []
  if (!header) return values
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index !== -1 && part.slice(0, index).trim() === name) values.push(part.slice(index + 1).trim())
  }
  return values
}