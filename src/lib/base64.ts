// Byte and text conversions for stored hashes, salts and passkey ids.

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function base64ToBytes(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** URL-safe base64 without padding, as WebAuthn uses for credential ids. */
export function bytesToBase64url(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function base64urlToBytes(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  return base64ToBytes(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
}
