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

export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  if (!isValidPin(pin)) return false
  const actual = await derive(pin, base64ToBytes(stored.salt), stored.iterations)
  return constantTimeEqual(actual, base64ToBytes(stored.hash))
}
