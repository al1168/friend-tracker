import { describe, expect, it } from 'vitest'
import { pushSender, PUSH_TTL_SECONDS, vapidKeys, type VapidEnv } from './push.ts'
import type { Subscription } from './schedule.ts'

const SUBJECT = 'https://friend.aldenlu.com'
const ENDPOINT = 'https://web.push.apple.com/QGuQyavXutnMH-endpoint'

function toBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, data))
}

const text = (value: string) => new TextEncoder().encode(value)

/**
 * Decrypts an RFC 8291 (aes128gcm) push message the way the phone does, with the subscription's
 * private key and auth secret. Checked against the RFC's own example below, so it can check the
 * messages this Worker sends.
 */
async function decryptPush(body: Uint8Array<ArrayBuffer>, uaPrivate: CryptoKey, uaPublic: Uint8Array<ArrayBuffer>, auth: Uint8Array<ArrayBuffer>) {
  const salt = body.slice(0, 16)
  const idLength = body[20]
  const asPublic = body.slice(21, 21 + idLength)
  const ciphertext = body.slice(21 + idLength)
  const senderKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: senderKey }, uaPrivate, 256))
  const prkKey = await hmac(auth, ecdhSecret)
  const ikm = (await hmac(prkKey, concat(text('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])))).slice(0, 32)
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, concat(text('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16)
  const nonce = (await hmac(prk, concat(text('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext))
  // The last record ends with a 0x02 delimiter, then zero padding.
  const end = padded.lastIndexOf(2)
  return new TextDecoder().decode(padded.slice(0, end))
}

/** The phone's side of a subscription: an ECDH key pair and an auth secret. */
async function phoneSubscription() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const auth = crypto.getRandomValues(new Uint8Array(16))
  const subscription: Subscription = { endpoint: ENDPOINT, keys: { p256dh: toBase64url(publicKey), auth: toBase64url(auth) } }
  return { subscription, privateKey: pair.privateKey, publicKey, auth }
}

/** A fresh VAPID key pair, as scripts/make-vapid-keys.ts makes it. */
async function vapidEnv(): Promise<{ env: VapidEnv; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return {
    env: { VAPID_PUBLIC_KEY: toBase64url(raw), VAPID_PRIVATE_KEY: JSON.stringify(jwk), VAPID_SUBJECT: SUBJECT },
    publicKey: pair.publicKey,
  }
}

/** A fetch that records what it was asked and answers with `status`. */
function fakeFetch(status = 201) {
  const requests: { url: string; init: RequestInit }[] = []
  const fetcher = (async (url: string, init: RequestInit) => {
    requests.push({ url, init })
    return new Response(null, { status })
  }) as unknown as typeof fetch
  return { fetcher, requests }
}

describe('decryptPush (the test helper)', () => {
  it("reads RFC 8291's example message", async () => {
    // RFC 8291, Appendix A.
    const uaPublic = fromBase64url('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4')
    const uaPrivate = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        d: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
        x: toBase64url(uaPublic.slice(1, 33)),
        y: toBase64url(uaPublic.slice(33, 65)),
      },
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    )
    const auth = fromBase64url('BTBZMqHH6r4Tts7J_aSIgg')
    const body = fromBase64url(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    )
    expect(await decryptPush(body, uaPrivate, uaPublic, auth)).toBe('When I grow up, I want to be a watermelon')
  })
})

describe('pushSender', () => {
  it('posts an encrypted {"kind"} payload that the phone can read, and nothing else', async () => {
    const phone = await phoneSubscription()
    const { env } = await vapidEnv()
    const { fetcher, requests } = fakeFetch(201)
    expect(await pushSender(env, fetcher)(phone.subscription, 'birthday')).toBe(201)
    expect(requests).toHaveLength(1)
    const { url, init } = requests[0]
    expect(url).toBe(ENDPOINT)
    expect(init.method).toBe('POST')
    const body = init.body as Uint8Array<ArrayBuffer>
    expect(await decryptPush(body, phone.privateKey, phone.publicKey, phone.auth)).toBe('{"kind":"birthday"}')
  })

  it('sends the push headers Apple needs', async () => {
    const phone = await phoneSubscription()
    const { env } = await vapidEnv()
    const { fetcher, requests } = fakeFetch(201)
    await pushSender(env, fetcher)(phone.subscription, 'test')
    const headers = new Headers(requests[0].init.headers)
    expect(headers.get('TTL')).toBe(String(PUSH_TTL_SECONDS))
    expect(headers.get('Urgency')).toBe('high')
    expect(headers.get('Content-Encoding')).toBe('aes128gcm')
    expect(headers.get('Content-Type')).toBe('application/octet-stream')
    expect(headers.get('Authorization')).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${env.VAPID_PUBLIC_KEY}$`))
  })

  it('signs a VAPID token for the push service, valid for at most 12 hours', async () => {
    const phone = await phoneSubscription()
    const { env, publicKey } = await vapidEnv()
    const { fetcher, requests } = fakeFetch(201)
    const before = Math.floor(Date.now() / 1000)
    await pushSender(env, fetcher)(phone.subscription, 'birthday')
    const token = /^vapid t=([^,]+), k=/.exec(new Headers(requests[0].init.headers).get('Authorization') ?? '')![1]
    const [header, payload, signature] = token.split('.')
    const decode = (part: string) => JSON.parse(new TextDecoder().decode(fromBase64url(part)))
    expect(decode(header)).toEqual({ typ: 'JWT', alg: 'ES256' })
    const claims = decode(payload)
    expect(claims.aud).toBe('https://web.push.apple.com')
    expect(claims.sub).toBe(SUBJECT)
    expect(claims.exp).toBeGreaterThan(before)
    expect(claims.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 12 * 3600)
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      fromBase64url(signature),
      text(`${header}.${payload}`),
    )
    expect(valid).toBe(true)
  })

  it("passes on the push service's answer", async () => {
    const phone = await phoneSubscription()
    const { env } = await vapidEnv()
    for (const status of [404, 410, 429, 503]) {
      expect(await pushSender(env, fakeFetch(status).fetcher)(phone.subscription, 'birthday')).toBe(status)
    }
  })
})

describe('vapidKeys', () => {
  it('takes the private key from the JWK', async () => {
    const { env } = await vapidEnv()
    const jwk = JSON.parse(env.VAPID_PRIVATE_KEY) as JsonWebKey
    expect(vapidKeys(env)).toEqual({ subject: SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: jwk.d })
  })

  it('refuses keys that do not belong together, a missing secret, or a bad subject', async () => {
    const one = await vapidEnv()
    const two = await vapidEnv()
    expect(() => vapidKeys({ ...one.env, VAPID_PRIVATE_KEY: two.env.VAPID_PRIVATE_KEY })).toThrow(
      'VAPID_PRIVATE_KEY is not the private key for VAPID_PUBLIC_KEY.',
    )
    expect(() => vapidKeys({ ...one.env, VAPID_PRIVATE_KEY: '' })).toThrow()
    expect(() => vapidKeys({ ...one.env, VAPID_SUBJECT: 'friend.aldenlu.com' })).toThrow(
      'VAPID_SUBJECT must be an https: or mailto: URL.',
    )
  })
})
