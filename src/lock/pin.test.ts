import { describe, expect, it } from 'vitest'
import { base64ToBytes } from '../lib/base64'
import { PIN_ITERATIONS, constantTimeEqual, hashPin, isValidPin, verifyPin } from './pin'

describe('PIN', () => {
  it('accepts exactly six digits', () => {
    expect(isValidPin('012345')).toBe(true)
    for (const bad of ['', '12345', '1234567', '12345a', ' 12345', '１２３４５６']) {
      expect(isValidPin(bad)).toBe(false)
    }
  })

  it('hashes with PBKDF2, a fresh 16-byte salt and a 32-byte result', async () => {
    const stored = await hashPin('123456')
    expect(stored.iterations).toBe(PIN_ITERATIONS)
    expect(PIN_ITERATIONS).toBe(210_000)
    expect(base64ToBytes(stored.salt)).toHaveLength(16)
    expect(base64ToBytes(stored.hash)).toHaveLength(32)
    expect(JSON.stringify(stored)).not.toContain('123456')
    const again = await hashPin('123456')
    expect(again.salt).not.toBe(stored.salt)
    expect(again.hash).not.toBe(stored.hash)
  })

  it('verifies the right PIN only', async () => {
    const stored = await hashPin('123456')
    expect(await verifyPin('123456', stored)).toBe(true)
    expect(await verifyPin('123457', stored)).toBe(false)
    expect(await verifyPin('12345', stored)).toBe(false)
  })

  it('refuses a stored iteration count outside 100,000 to 5,000,000', async () => {
    const stored = await hashPin('123456')
    for (const iterations of [1.5, 0, 99_999, 5_000_001, 10_000_000, Number.NaN]) {
      expect(await verifyPin('123456', { ...stored, iterations })).toBe(false)
    }
  })

  it('refuses to hash an invalid PIN', async () => {
    await expect(hashPin('1234')).rejects.toThrow('A PIN is exactly 6 digits.')
  })

  it('compares bytes', () => {
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
    expect(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false)
    expect(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3]))).toBe(false)
  })
})
