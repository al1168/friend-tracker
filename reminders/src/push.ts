// Sends one Web Push: the payload is encrypted as RFC 8291 (aes128gcm) and the request is signed
// with VAPID (RFC 8292), both by @block65/webcrypto-web-push. The payload is only
// {"kind":"birthday"} or {"kind":"test"}: the phone looks up who it's for in its own data.

import { buildPushPayload } from '@block65/webcrypto-web-push'
import type { PushKind, SendPush } from './schedule.ts'

export interface VapidEnv {
  /** The application server key: an uncompressed P-256 point, base64url. Not secret. */
  VAPID_PUBLIC_KEY: string
  /** The matching private key as a JWK (a secret). */
  VAPID_PRIVATE_KEY: string
  /** Who runs this sender: an https: or mailto: URL. Apple refuses pushes without one. */
  VAPID_SUBJECT: string
}

/** A phone that's off or offline gets the push if it's back within 3 hours. */
export const PUSH_TTL_SECONDS = 10_800

/** A push service that hasn't answered by then counts as no answer (the alarm tries again). */
const SEND_TIMEOUT_MS = 15_000

function base64urlToBytes(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The keys in the form the library takes. Throws when the secret is missing or isn't the public key's pair. */
export function vapidKeys(env: VapidEnv): { subject: string; publicKey: string; privateKey: string } {
  const jwk = JSON.parse(env.VAPID_PRIVATE_KEY) as JsonWebKey
  const publicKey = base64urlToBytes(env.VAPID_PUBLIC_KEY)
  const matches =
    jwk.kty === 'EC' &&
    jwk.crv === 'P-256' &&
    typeof jwk.d === 'string' &&
    publicKey.length === 65 &&
    jwk.x === bytesToBase64url(publicKey.slice(1, 33)) &&
    jwk.y === bytesToBase64url(publicKey.slice(33, 65))
  if (!matches) throw new Error('VAPID_PRIVATE_KEY is not the private key for VAPID_PUBLIC_KEY.')
  if (!/^(https:|mailto:)/.test(env.VAPID_SUBJECT)) throw new Error('VAPID_SUBJECT must be an https: or mailto: URL.')
  return { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: jwk.d as string }
}

/** A SendPush that posts to the subscription's push service. */
export function pushSender(env: VapidEnv, fetcher: typeof fetch = fetch): SendPush {
  return async (subscription, kind: PushKind) => {
    const request = await buildPushPayload(
      { data: { kind }, options: { ttl: PUSH_TTL_SECONDS, urgency: 'high' } },
      { endpoint: subscription.endpoint, expirationTime: null, keys: subscription.keys },
      vapidKeys(env),
    )
    const response = await fetcher(subscription.endpoint, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    // Only the status matters. Not reading the body frees the connection.
    await response.body?.cancel().catch(() => {})
    return response.status
  }
}
