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
      redirect: 'manual',
    })
  })

  it('gives up after a time limit and reports it as offline', async () => {
    const { fetcher, calls } = respondWith(204)
    await verifySitePassword('x', fetcher)
    const signal = calls[0].init?.signal
    expect(signal).toBeInstanceOf(AbortSignal)
    expect(signal?.aborted).toBe(false)
    // What fetch throws when that signal's timeout fires.
    const timedOut = (async () => {
      throw new DOMException('The operation timed out.', 'TimeoutError')
    }) as typeof fetch
    expect(await verifySitePassword('x', timedOut)).toBe('offline')
  })

  it('still sends the request, without a time limit, where AbortSignal.timeout is missing', async () => {
    const original = AbortSignal.timeout
    Object.defineProperty(AbortSignal, 'timeout', { value: undefined, configurable: true })
    try {
      const { fetcher, calls } = respondWith(204)
      expect(await verifySitePassword('x', fetcher)).toBe('ok')
      expect(calls[0].init?.signal).toBeUndefined()
    } finally {
      Object.defineProperty(AbortSignal, 'timeout', { value: original, configurable: true, writable: true })
    }
  })

  it('never trusts a redirect, even one that ends in a 204', async () => {
    const redirected = (async () => ({ status: 204, type: 'basic', redirected: true })) as unknown as typeof fetch
    const opaque = (async () => ({ status: 0, type: 'opaqueredirect', redirected: false })) as unknown as typeof fetch
    const disguised = (async () => ({ status: 204, type: 'opaqueredirect', redirected: false })) as unknown as typeof fetch
    expect(await verifySitePassword('x', redirected)).toBe('error')
    expect(await verifySitePassword('x', opaque)).toBe('error')
    expect(await verifySitePassword('x', disguised)).toBe('error')
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
