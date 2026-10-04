import { describe, expect, it } from 'vitest'
import { scheduleApi, type ScheduleBody } from './api'

const BODY: ScheduleBody = {
  subscription: { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p256dh-key', auth: 'auth-secret' } },
  reminders: [{ at: 1_800_000_000_000, friendId: 'alex' }],
}

/** A fetch that records each call and answers with the next response (or throws for null: offline). */
function fakeFetch(...answers: (Response | null)[]) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const answer = answers.shift()
    if (!answer) throw new TypeError('Load failed')
    return answer
  }) as unknown as typeof fetch
  return { fetcher, calls }
}

const status = (code: number) => new Response(null, { status: code })

describe('putSchedule', () => {
  it('PUTs the schedule as JSON with the sign-in cookie, and only 204 counts', async () => {
    const { fetcher, calls } = fakeFetch(status(204))
    expect(await scheduleApi(fetcher).putSchedule(BODY)).toBe(true)
    expect(calls[0].url).toBe('/__reminders')
    expect(calls[0].init).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(BODY),
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
    })
    for (const answer of [status(200), status(400), status(503), null]) {
      expect(await scheduleApi(fakeFetch(answer).fetcher).putSchedule(BODY)).toBe(false)
    }
  })

  it('never trusts a redirect', async () => {
    const redirected = new Response(null, { status: 204 })
    Object.defineProperty(redirected, 'redirected', { value: true })
    expect(await scheduleApi(fakeFetch(redirected).fetcher).putSchedule(BODY)).toBe(false)
  })
})

describe('deleteSchedule', () => {
  it('sends DELETE, and only 204 counts', async () => {
    const { fetcher, calls } = fakeFetch(status(204))
    expect(await scheduleApi(fetcher).deleteSchedule()).toBe(true)
    expect(calls[0]).toMatchObject({ url: '/__reminders', init: { method: 'DELETE' } })
    expect(await scheduleApi(fakeFetch(status(502)).fetcher).deleteSchedule()).toBe(false)
    expect(await scheduleApi(fakeFetch(null).fetcher).deleteSchedule()).toBe(false)
  })
})

describe('sendTest', () => {
  it('POSTs to the test endpoint and reads the answer', async () => {
    const { fetcher, calls } = fakeFetch(status(204))
    expect(await scheduleApi(fetcher).sendTest()).toBe('sent')
    expect(calls[0]).toMatchObject({ url: '/__reminders/test', init: { method: 'POST' } })
    expect(await scheduleApi(fakeFetch(status(409)).fetcher).sendTest()).toBe('no-subscription')
    expect(await scheduleApi(fakeFetch(status(410)).fetcher).sendTest()).toBe('gone')
    expect(await scheduleApi(fakeFetch(status(502)).fetcher).sendTest()).toBe('error')
    expect(await scheduleApi(fakeFetch(null).fetcher).sendTest()).toBe('error')
  })
})
