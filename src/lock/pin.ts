import { base64ToBytes, bytesToBase64 } from '../lib/base64'
import type { PinHash } from './types'

export const PIN_LENGTH = 6
export const PIN_ITERATIONS = 210_000

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin)
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256)
  return new Uint8Array(bits)
}

/** Compares every byte, so the time taken doesn't reveal where two hashes differ. */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let difference = 0
  for (let i = 0; i < a.length; i += 1) difference |= a[i] ^ b[i]
  return difference === 0
}

export async function hashPin(pin: string): Promise<PinHash> {
  if (!isValidPin(pin)) throw new Error('A PIN is exactly 6 digits.')
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(pin, salt, PIN_ITERATIONS)
  return { hash: bytesToBase64(hash), salt: bytesToBase64(salt), iterations: PIN_ITERATIONS }
}

// 210k is deliberate (fast enough for a phone); with only 10^6 possible PINs the iteration count isn't the real
// protection, the wrong-PIN backoff is.
const MIN_STORED_ITERATIONS = 100_000
const MAX_STORED_ITERATIONS = 5_000_000

export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  if (!isValidPin(pin)) return false
  // A damaged stored hash must not make this hang (huge count) or run unchecked (tiny count). It throws (rather
  // than returning false) so the caller doesn't count it as a wrong PIN.
  if (
    !Number.isInteger(stored.iterations) ||
    stored.iterations < MIN_STORED_ITERATIONS ||
    stored.iterations > MAX_STORED_ITERATIONS
  ) {
    throw new Error('The stored PIN hash is unreadable.')
  }
  const actual = await derive(pin, base64ToBytes(stored.salt), stored.iterations)
  return constantTimeEqual(actual, base64ToBytes(stored.hash))
}
