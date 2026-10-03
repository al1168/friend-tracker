// Face ID through a WebAuthn passkey on this device. A thin wrapper around navigator.credentials:
// these calls only work on a real phone, so the checks they rely on live in webauthn.ts.

import { base64urlToBytes, bytesToBase64url } from '../lib/base64'
import { isExpectedAssertion } from './webauthn'

const TIMEOUT_MS = 60_000

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length))
}

/** True when this device can unlock with Face ID (or Touch ID). */
export async function isPasskeyAvailable(): Promise<boolean> {
  try {
    if (!window.isSecureContext || typeof PublicKeyCredential === 'undefined') return false
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/** Creates a passkey on this device. Call it from a tap. Returns its id (base64url), or null if cancelled or failed. */
export async function registerPasskey(): Promise<string | null> {
  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        rp: { name: 'Friend Tracker', id: location.hostname },
        user: { id: randomBytes(16), name: 'Friend Tracker', displayName: 'Friend Tracker' },
        challenge: randomBytes(32),
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: TIMEOUT_MS,
      },
    })
    if (!(credential instanceof PublicKeyCredential)) return null
    return bytesToBase64url(new Uint8Array(credential.rawId))
  } catch {
    return null
  }
}

/** Asks for Face ID with the saved passkey. Call it from a tap. True only for that passkey with the user verified. */
export async function verifyPasskey(passkeyId: string): Promise<boolean> {
  try {
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        rpId: location.hostname,
        allowCredentials: [{ type: 'public-key', id: base64urlToBytes(passkeyId), transports: ['internal'] }],
        userVerification: 'required',
        timeout: TIMEOUT_MS,
      },
    })
    if (!(credential instanceof PublicKeyCredential)) return false
    const response = credential.response
    if (!(response instanceof AuthenticatorAssertionResponse)) return false
    return isExpectedAssertion(credential.rawId, response.authenticatorData, passkeyId)
  } catch {
    return false
  }
}
