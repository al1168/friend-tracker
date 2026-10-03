import { describe, expect, it } from 'vitest'
import { bytesToBase64url } from '../lib/base64'
import { hasUserVerification, isExpectedAssertion } from './webauthn'

/** Minimal authenticator data with the given flags byte. */
function authenticatorData(flags: number, length = 37): ArrayBuffer {
  const bytes = new Uint8Array(length)
  bytes[32] = flags
  return bytes.buffer
}

const RAW_ID = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 255, 254, 253, 252, 251, 250]).buffer
const PASSKEY_ID = bytesToBase64url(new Uint8Array(RAW_ID))

describe('hasUserVerification', () => {
  it('reads the user-verified flag (bit 2 of byte 32)', () => {
    expect(hasUserVerification(authenticatorData(0x05))).toBe(true)
    expect(hasUserVerification(authenticatorData(0x04))).toBe(true)
    expect(hasUserVerification(authenticatorData(0x01))).toBe(false)
    expect(hasUserVerification(authenticatorData(0x00))).toBe(false)
  })

  it('rejects data that is too short', () => {
    expect(hasUserVerification(authenticatorData(0x05, 36))).toBe(false)
    expect(hasUserVerification(new ArrayBuffer(0))).toBe(false)
  })
})

describe('isExpectedAssertion', () => {
  it('accepts the saved passkey with the user verified', () => {
    expect(PASSKEY_ID).toBe('CQgHBgUEAwIBAP_-_fz7-g')
    expect(isExpectedAssertion(RAW_ID, authenticatorData(0x05), PASSKEY_ID)).toBe(true)
  })

  it('rejects another passkey or a missing verification', () => {
    expect(isExpectedAssertion(new Uint8Array([1, 2, 3]).buffer, authenticatorData(0x05), PASSKEY_ID)).toBe(false)
    expect(isExpectedAssertion(RAW_ID, authenticatorData(0x01), PASSKEY_ID)).toBe(false)
  })
})
