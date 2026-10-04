import { describe, expect, it } from 'vitest'
import wranglerConfig from '../../reminders/wrangler.jsonc?raw'
import { base64urlToBytes } from '../lib/base64'
import { VAPID_PUBLIC_KEY } from './vapidKey'

describe('VAPID_PUBLIC_KEY', () => {
  it('is an uncompressed P-256 public key in unpadded base64url', async () => {
    expect(VAPID_PUBLIC_KEY).toMatch(/^[A-Za-z0-9_-]{87}$/)
    const bytes = base64urlToBytes(VAPID_PUBLIC_KEY)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(4)
    // WebCrypto refuses a point that isn't on the curve.
    await expect(crypto.subtle.importKey('raw', bytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])).resolves.toBeDefined()
  })

  it('is the key the reminders Worker signs with', () => {
    expect(wranglerConfig).toContain(`"VAPID_PUBLIC_KEY": "${VAPID_PUBLIC_KEY}"`)
  })
})
