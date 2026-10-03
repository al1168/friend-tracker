const encoder = new TextEncoder()
const MAX_LENGTH = 1024

/**
 * Compares HMAC(key, submitted) with HMAC(key, expected), where `key` is the password-check key. Both digests are 32 bytes and
 * `crypto.subtle.verify` compares them in constant time, so timing leaks neither length nor prefix.
 */
export async function checkPassword(key: CryptoKey, expected: string, submitted: string): Promise<boolean> {
  if (expected.length === 0 || submitted.length === 0 || submitted.length > MAX_LENGTH) return false
  const expectedDigest = await crypto.subtle.sign('HMAC', key, encoder.encode(expected))
  return crypto.subtle.verify('HMAC', key, expectedDigest, encoder.encode(submitted))
}
