import { hmacKey } from './session.ts'

const encoder = new TextEncoder()
const MAX_LENGTH = 1024

/**
 * Compares HMAC(secret, submitted) with HMAC(secret, expected). Both digests are 32 bytes and
 * `crypto.subtle.verify` compares them in constant time, so timing leaks neither length nor prefix.
 */
export async function checkPassword(secret: string, expected: string, submitted: string): Promise<boolean> {
  if (expected.length === 0 || submitted.length === 0 || submitted.length > MAX_LENGTH) return false
  const key = await hmacKey(secret)
  const expectedDigest = await crypto.subtle.sign('HMAC', key, encoder.encode(expected))
  return crypto.subtle.verify('HMAC', key, expectedDigest, encoder.encode(submitted))
}
