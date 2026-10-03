// Pure checks on WebAuthn results, kept apart from the browser calls so they can be unit tested.

import { bytesToBase64url } from '../lib/base64'

/** Authenticator data: 32-byte RP ID hash, 1 flags byte, 4-byte sign counter, then optional parts. */
const FLAGS_OFFSET = 32
const MIN_LENGTH = 37
const USER_VERIFIED = 0x04

/** True when the authenticator says the user was verified (Face ID, Touch ID or the device passcode). */
export function hasUserVerification(authenticatorData: ArrayBuffer): boolean {
  const bytes = new Uint8Array(authenticatorData)
  return bytes.length >= MIN_LENGTH && (bytes[FLAGS_OFFSET] & USER_VERIFIED) !== 0
}

/** True when an assertion came from the saved passkey and the user was verified. */
export function isExpectedAssertion(rawId: ArrayBuffer, authenticatorData: ArrayBuffer, passkeyId: string): boolean {
  return bytesToBase64url(new Uint8Array(rawId)) === passkeyId && hasUserVerification(authenticatorData)
}
