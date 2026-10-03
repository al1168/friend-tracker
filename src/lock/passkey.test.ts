import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { bytesToBase64url } from '../lib/base64'
import { registerPasskey, verifyPasskey } from './passkey'

// Stand-ins for the browser classes the wrapper checks with instanceof.
class FakeAssertionResponse {
  authenticatorData: ArrayBuffer
  constructor(authenticatorData: ArrayBuffer) {
    this.authenticatorData = authenticatorData
  }
}

class FakeCredential {
  rawId: ArrayBuffer
  response: unknown
  constructor(rawId: ArrayBuffer, response: unknown = {}) {
    this.rawId = rawId
    this.response = response
  }
}

const RAW_ID = new Uint8Array([9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 255, 254, 253, 252, 251, 250]).buffer
const PASSKEY_ID = bytesToBase64url(new Uint8Array(RAW_ID))

function authenticatorData(flags: number): ArrayBuffer {
  const bytes = new Uint8Array(37)
  bytes[32] = flags
  return bytes.buffer
}

function stubCredentials(create: () => unknown, get: () => unknown = create) {
  const credentials = { create: vi.fn(async () => create()), get: vi.fn(async () => get()) }
  vi.stubGlobal('navigator', { credentials })
  return credentials
}

function domError(name: string): Error {
  const error = new Error(name)
  error.name = name
  return error
}

beforeEach(() => {
  vi.stubGlobal('PublicKeyCredential', FakeCredential)
  vi.stubGlobal('AuthenticatorAssertionResponse', FakeAssertionResponse)
  vi.stubGlobal('location', { hostname: 'friend-tracker.pages.dev' })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('registerPasskey', () => {
  it('returns the new passkey id', async () => {
    const credentials = stubCredentials(() => new FakeCredential(RAW_ID))
    expect(await registerPasskey()).toBe(PASSKEY_ID)
    const call = credentials.create.mock.calls[0] as unknown as [{ publicKey: { user: { id: Uint8Array } } }]
    // The same user handle every time, so iOS replaces the old passkey.
    expect(new TextDecoder().decode(call[0].publicKey.user.id)).toBe('friend-tracker-owner')
  })

  it('returns null when the person cancels or it is aborted', async () => {
    for (const name of ['NotAllowedError', 'AbortError']) {
      stubCredentials(() => {
        throw domError(name)
      })
      expect(await registerPasskey()).toBeNull()
    }
  })

  it('returns null when no passkey comes back', async () => {
    stubCredentials(() => null)
    expect(await registerPasskey()).toBeNull()
    stubCredentials(() => ({ rawId: RAW_ID }))
    expect(await registerPasskey()).toBeNull()
  })
})

describe('verifyPasskey', () => {
  it('accepts the saved passkey with the user verified', async () => {
    stubCredentials(() => new FakeCredential(RAW_ID, new FakeAssertionResponse(authenticatorData(0x05))))
    expect(await verifyPasskey(PASSKEY_ID)).toBe(true)
  })

  it('returns false when it fails or is cancelled', async () => {
    for (const name of ['NotAllowedError', 'AbortError', 'SecurityError']) {
      stubCredentials(() => {
        throw domError(name)
      })
      expect(await verifyPasskey(PASSKEY_ID)).toBe(false)
    }
  })

  it('returns false when the user was not verified', async () => {
    stubCredentials(() => new FakeCredential(RAW_ID, new FakeAssertionResponse(authenticatorData(0x01))))
    expect(await verifyPasskey(PASSKEY_ID)).toBe(false)
  })

  it('returns false for a different passkey', async () => {
    stubCredentials(() => new FakeCredential(new Uint8Array([1, 2, 3]).buffer, new FakeAssertionResponse(authenticatorData(0x05))))
    expect(await verifyPasskey(PASSKEY_ID)).toBe(false)
  })

  it('returns false for a response that is not an assertion, or no credential', async () => {
    stubCredentials(() => new FakeCredential(RAW_ID, {}))
    expect(await verifyPasskey(PASSKEY_ID)).toBe(false)
    stubCredentials(() => null)
    expect(await verifyPasskey(PASSKEY_ID)).toBe(false)
  })
})
