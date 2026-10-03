import { describe, expect, it } from 'vitest'
import {
  SESSION_MAX_AGE,
  createSessionValue,
  readCookie,
  sessionCookie,
  verifySessionValue,
} from './session.ts'

const SECRET = 'test-secret-0123456789-abcdefghijklmnop'
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)

describe('session cookie', () => {
  it('round-trips a fresh value', async () => {
    const value = await createSessionValue(SECRET, NOW)
    expect(value).toMatch(/^v1\.\d+\.[A-Za-z0-9_-]{43}$/)
    expect(value.split('.')[1]).toBe(String(Math.floor(NOW / 1000) + SESSION_MAX_AGE))
    expect(await verifySessionValue(SECRET, value, NOW)).toBe(true)
  })

  it('rejects a tampered signature', async () => {
    const value = await createSessionValue(SECRET, NOW)
    const [, expiresAt, signature] = value.split('.')
    // Change the first signature character (the last one partly encodes padding bits).
    const first = signature[0] === 'A' ? 'B' : 'A'
    expect(await verifySessionValue(SECRET, `v1.${expiresAt}.${first}${signature.slice(1)}`, NOW)).toBe(false)
  })

  it('rejects a tampered expiry', async () => {
    const value = await createSessionValue(SECRET, NOW)
    const [, expiresAt, signature] = value.split('.')
    expect(await verifySessionValue(SECRET, `v1.${Number(expiresAt) + 1}.${signature}`, NOW)).toBe(false)
  })

  it('rejects a value signed with another secret', async () => {
    const value = await createSessionValue('another-secret-0123456789-abcdefghijk', NOW)
    expect(await verifySessionValue(SECRET, value, NOW)).toBe(false)
  })

  it('rejects an expired value', async () => {
    const value = await createSessionValue(SECRET, NOW)
    const later = NOW + SESSION_MAX_AGE * 1000
    expect(await verifySessionValue(SECRET, value, later - 1000)).toBe(true)
    expect(await verifySessionValue(SECRET, value, later)).toBe(false)
  })

  it('rejects malformed values', async () => {
    const value = await createSessionValue(SECRET, NOW)
    const [, expiresAt, signature] = value.split('.')
    for (const bad of [
      '',
      'v1',
      `v2.${expiresAt}.${signature}`,
      `v1.abc.${signature}`,
      `v1.${expiresAt}`,
      `v1.${expiresAt}.${signature}.extra`,
      `v1.${expiresAt}.${signature.slice(1)}`,
      `v1.${expiresAt}.${'!'.repeat(43)}`,
    ]) {
      expect(await verifySessionValue(SECRET, bad, NOW)).toBe(false)
    }
  })

  it('builds the cookie header with safe attributes', () => {
    expect(sessionCookie('v1.1.abc')).toBe(
      'ft_session=v1.1.abc; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000',
    )
  })

  it('reads one cookie from a Cookie header', () => {
    expect(readCookie('a=1; ft_session=v1.2.xyz; b=3', 'ft_session')).toBe('v1.2.xyz')
    expect(readCookie('ft_session_old=1', 'ft_session')).toBeNull()
    expect(readCookie('', 'ft_session')).toBeNull()
    expect(readCookie(null, 'ft_session')).toBeNull()
  })
})
