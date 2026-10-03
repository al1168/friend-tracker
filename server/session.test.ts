import { describe, expect, it } from 'vitest'
import {
  SESSION_MAX_AGE,
  createSessionValue,
  deriveSessionKey,
  readCookies,
  sessionCookie,
  verifySessionValue,
} from './session.ts'

const SECRET = 'test-secret-0123456789-abcdefghijklmnop'
const PASSWORD = 'maple otter lantern river'
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)

const key = (secret = SECRET, password = PASSWORD) => deriveSessionKey(secret, password)

describe('session cookie', () => {
  it('round-trips a fresh value', async () => {
    const value = await createSessionValue(await key(), NOW)
    expect(value).toMatch(/^v1\.\d+\.[A-Za-z0-9_-]{43}$/)
    expect(value.split('.')[1]).toBe(String(Math.floor(NOW / 1000) + SESSION_MAX_AGE))
    expect(await verifySessionValue(await key(), value, NOW)).toBe(true)
  })

  it('rejects a tampered signature', async () => {
    const value = await createSessionValue(await key(), NOW)
    const [, expiresAt, signature] = value.split('.')
    // Change the first signature character (the last one partly encodes padding bits).
    const first = signature[0] === 'A' ? 'B' : 'A'
    expect(await verifySessionValue(await key(), `v1.${expiresAt}.${first}${signature.slice(1)}`, NOW)).toBe(false)
  })

  it('rejects a tampered expiry', async () => {
    const value = await createSessionValue(await key(), NOW)
    const [, expiresAt, signature] = value.split('.')
    expect(await verifySessionValue(await key(), `v1.${Number(expiresAt) + 1}.${signature}`, NOW)).toBe(false)
  })

  it('rejects a value signed with another secret', async () => {
    const value = await createSessionValue(await key('another-secret-0123456789-abcdefghijk'), NOW)
    expect(await verifySessionValue(await key(), value, NOW)).toBe(false)
  })

  it('rejects a value minted before the site password changed', async () => {
    const value = await createSessionValue(await key(SECRET, 'password A with plenty of length'), NOW)
    expect(await verifySessionValue(await key(SECRET, 'password A with plenty of length'), value, NOW)).toBe(true)
    expect(await verifySessionValue(await key(SECRET, 'password B with plenty of length'), value, NOW)).toBe(false)
  })

  it('rejects an expired value', async () => {
    const value = await createSessionValue(await key(), NOW)
    const later = NOW + SESSION_MAX_AGE * 1000
    expect(await verifySessionValue(await key(), value, later - 1000)).toBe(true)
    expect(await verifySessionValue(await key(), value, later)).toBe(false)
  })

  it('rejects malformed values', async () => {
    const value = await createSessionValue(await key(), NOW)
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
      expect(await verifySessionValue(await key(), bad, NOW)).toBe(false)
    }
  })

  it('builds the cookie header with safe attributes', () => {
    expect(sessionCookie('v1.1.abc')).toBe(
      '__Host-ft_session=v1.1.abc; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000',
    )
  })

  it('reads every cookie with the same name', () => {
    expect(readCookies('a=1; ft_session=x; b=2; ft_session=y', 'ft_session')).toEqual(['x', 'y'])
    expect(readCookies(null, 'ft_session')).toEqual([])
  })
})
