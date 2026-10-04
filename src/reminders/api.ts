// The app's side of /__reminders (see server/reminders.ts): sends the reminder schedule to the
// server, deletes it, and asks for a test notification.

import type { PushSubscriptionData, Reminder } from '../lib/reminders'

const REMINDERS_URL = '/__reminders'
const REMINDERS_TEST_URL = '/__reminders/test'

const TIMEOUT_MS = 15_000

/** What the server stores: where to send pushes, and when. */
export interface ScheduleBody {
  subscription: PushSubscriptionData
  reminders: Reminder[]
}

/** The server's answer to a test: sent, it has no schedule (409), or the subscription is gone (410). */
export type TestAnswer = 'sent' | 'no-subscription' | 'gone' | 'error'

export interface ScheduleApi {
  /** True when the server saved the schedule, or 'not-set-up' (503) when it has no reminders Worker yet. */
  putSchedule(body: ScheduleBody): Promise<boolean | 'not-set-up'>
  /** True when the server deleted the schedule. */
  deleteSchedule(): Promise<boolean>
  sendTest(): Promise<TestAnswer>
}

/** The answer's status, or null for no answer, a timeout, or a redirect (a captive portal, or a lost sign-in). */
async function statusOf(fetcher: typeof fetch, url: string, init: RequestInit): Promise<number | null> {
  try {
    const response = await fetcher(url, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
      // AbortSignal.timeout is missing before iOS 16: without it the request just has no time limit.
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(TIMEOUT_MS) : undefined,
    })
    if (response.type === 'opaqueredirect' || response.redirected) return null
    return response.status
  } catch {
    return null
  }
}

export function scheduleApi(fetcher: typeof fetch = fetch): ScheduleApi {
  return {
    putSchedule: async (body) => {
      const status = await statusOf(fetcher, REMINDERS_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      return status === 503 ? 'not-set-up' : status === 204
    },
    deleteSchedule: async () => (await statusOf(fetcher, REMINDERS_URL, { method: 'DELETE' })) === 204,
    sendTest: async () => {
      switch (await statusOf(fetcher, REMINDERS_TEST_URL, { method: 'POST' })) {
        case 204:
          return 'sent'
        case 409:
          return 'no-subscription'
        case 410:
          return 'gone'
        default:
          return 'error'
      }
    },
  }
}
