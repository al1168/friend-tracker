import { describe, expect, it } from 'vitest'
import { MAX_ATTEMPTS, clearFailures, isLockedOut, recordFailure } from './attempts.ts'
import { createMemoryKv } from './memoryKv.ts'

const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)
const IP = '203.0.113.7'

async function fail(times: number, kv = createMemoryKv(), ip = IP, now = NOW) {
  for (let i = 0; i < times; i += 1) await recordFailure(kv, ip, now)
  return kv
}

describe('sign-in lockout', () => {
  it('starts unlocked', async () => {
    expect(await isLockedOut(createMemoryKv(), IP, NOW)).toBe(false)
  })

  it('stores the count and first failure time with a 15-minute expiry', async () => {
    const kv = await fail(2)
    expect(kv.entries.get(`fail:${IP}`)).toEqual({
      value: JSON.stringify({ count: 2, firstAt: NOW }),
      expirationTtl: 900,
    })
  })

  it('locks out after 10 failures, not before', async () => {
    const kv = await fail(MAX_ATTEMPTS - 1)
    expect(await isLockedOut(kv, IP, NOW)).toBe(false)
    await recordFailure(kv, IP, NOW)
    expect(await isLockedOut(kv, IP, NOW)).toBe(true)
  })

  it('starts a new window 15 minutes after the first failure', async () => {
    const kv = await fail(MAX_ATTEMPTS)
    const later = NOW + 15 * 60_000
    expect(await isLockedOut(kv, IP, later - 1)).toBe(true)
    expect(await isLockedOut(kv, IP, later)).toBe(false)
    await recordFailure(kv, IP, later)
    expect(JSON.parse(kv.entries.get(`fail:${IP}`)!.value)).toEqual({ count: 1, firstAt: later })
  })

  it('counts each address separately', async () => {
    const kv = await fail(MAX_ATTEMPTS)
    expect(await isLockedOut(kv, '198.51.100.1', NOW)).toBe(false)
  })

  it('clears the count', async () => {
    const kv = await fail(MAX_ATTEMPTS)
    await clearFailures(kv, IP)
    expect(await isLockedOut(kv, IP, NOW)).toBe(false)
    expect(kv.entries.size).toBe(0)
  })

  it('ignores unreadable records', async () => {
    const kv = createMemoryKv()
    await kv.put(`fail:${IP}`, 'not json')
    expect(await isLockedOut(kv, IP, NOW)).toBe(false)
    await kv.put(`fail:${IP}`, JSON.stringify({ count: 'many' }))
    expect(await isLockedOut(kv, IP, NOW)).toBe(false)
  })

  it('keeps working when KV fails', async () => {
    const kv = createMemoryKv()
    kv.failing = true
    await expect(recordFailure(kv, IP, NOW)).resolves.toBeUndefined()
    await expect(clearFailures(kv, IP)).resolves.toBeUndefined()
    expect(await isLockedOut(kv, IP, NOW)).toBe(false)
  })
})
