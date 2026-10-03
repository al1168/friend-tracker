// Signed session cookie: `v1.<expiresAt>.<sig>`, where sig = base64url(HMAC-SHA256(secret, "v1.<expiresAt>")).

export const SESSION_COOKIE = 'ft_session'
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
export async function createSessionValue(secret: string, nowMs: number): Promise<string> {
  const payload = `v1.${Math.floor(nowMs / 1000) + SESSION_MAX_AGE}`
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload))
  return `${payload}.${toBase64url(new Uint8Array(signature))}`
}

/** True when the value parses, hasn't expired, and its signature checks out (compared in constant time). */
export async function verifySessionValue(secret: string, value: string, nowMs: number): Promise<boolean> {
  const match = VALUE_PATTERN.exec(value)
  if (!match) return false
  if (Number(match[1]) <= Math.floor(nowMs / 1000)) return false
  let signature: Uint8Array<ArrayBuffer>
  try {
    signature = fromBase64url(match[2])
  } catch {
    return false
  }
  return crypto.subtle.verify('HMAC', await hmacKey(secret), signature, encoder.encode(`v1.${match[1]}`))
}

export function sessionCookie(value: string): string {
  return `${SESSION_COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE}`
}

/** The value of one cookie from a `Cookie` request header, or null. */
export function readCookie(header: string | null, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index !== -1 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim()
  }
  return null
}
