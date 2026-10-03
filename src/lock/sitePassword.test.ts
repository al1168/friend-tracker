import { describe, expect, it } from 'vitest'
import { verifySitePassword } from './sitePassword'

function respondWith(status: number) {
  const calls: { url: string; init: RequestInit | undefined }[] = []
  const fetcher = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return new Response(status === 204 ? null : 'body', { status })
  }) as typeof fetch
  return { fetcher, calls }
}

describe('verifySitePassword', () => {
  it('posts the password as JSON with the sign-in cookie', async () => {
    const { fetcher, calls } = respondWith(204)
    expect(await verifySitePassword('maple otter', fetcher)).toBe('ok')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('/__verify-password')
    expect(calls[0].init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"password":"maple otter"}',
      credentials: 'same-origin',
      cache: 'no-store',
    })
  })

  it('maps each answer from the server', async () => {
    expect(await verifySitePassword('x', respondWith(401).fetcher)).toBe('wrong')
    expect(await verifySitePassword('x', respondWith(403).fetcher)).toBe('signed-out')
    expect(await verifySitePassword('x', respondWith(429).fetcher)).toBe('too-many')
  })

  it('treats anything but 204 as not verified', async () => {
    for (const status of [200, 302, 404, 405, 415, 500]) {
      expect(await verifySitePassword('x', respondWith(status).fetcher)).toBe('error')
    }
  })

  it('reports a network failure as offline', async () => {
    const fetcher = (async () => {
      throw new TypeError('Load failed')
    }) as typeof fetch
    expect(await verifySitePassword('x', fetcher)).toBe('offline')
  })
})
