import { afterEach, describe, expect, it, vi } from 'vitest'
import { browserPush, PUSH_TIMEOUT_MS, withTimeout } from './browserPush'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('withTimeout', () => {
  it('passes on the result', async () => {
    await expect(withTimeout(() => Promise.resolve(7))).resolves.toBe(7)
  })

  it('passes on a failure, and a throw', async () => {
    await expect(withTimeout(() => Promise.reject(new Error('nope')))).rejects.toThrow('nope')
    await expect(
      withTimeout(() => {
        throw new TypeError('no service worker')
      }),
    ).rejects.toThrow('no service worker')
  })

  it('rejects when the work hangs', async () => {
    vi.useFakeTimers()
    const result = withTimeout(() => new Promise<never>(() => {}))
    const rejected = expect(result).rejects.toThrow('did not answer in time')
    await vi.advanceTimersByTimeAsync(PUSH_TIMEOUT_MS)
    await rejected
  })

  it('leaves no timer behind once the work is done', async () => {
    vi.useFakeTimers()
    await withTimeout(() => Promise.resolve(1))
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('browserPush', () => {
  it('fails instead of hanging when the service worker never gets ready', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { serviceWorker: { ready: new Promise(() => {}) } })
    const rejected = expect(browserPush.getSubscription()).rejects.toThrow('did not answer in time')
    await vi.advanceTimersByTimeAsync(PUSH_TIMEOUT_MS)
    await rejected
  })

  it('fails when subscribing hangs, and when unsubscribing hangs', async () => {
    vi.useFakeTimers()
    const hanging = {
      options: { applicationServerKey: null },
      toJSON: () => ({}),
      unsubscribe: () => new Promise<boolean>(() => {}),
    }
    const pushManager = {
      getSubscription: () => Promise.resolve(hanging),
      subscribe: () => new Promise<never>(() => {}),
    }
    vi.stubGlobal('navigator', { serviceWorker: { ready: Promise.resolve({ pushManager }) } })

    const subscribing = expect(browserPush.subscribe(new Uint8Array(65))).rejects.toThrow('did not answer in time')
    await vi.advanceTimersByTimeAsync(PUSH_TIMEOUT_MS)
    await subscribing

    const subscription = await browserPush.getSubscription()
    const unsubscribing = expect(subscription?.unsubscribe()).rejects.toThrow('did not answer in time')
    await vi.advanceTimersByTimeAsync(PUSH_TIMEOUT_MS)
    await unsubscribing
  })
})
