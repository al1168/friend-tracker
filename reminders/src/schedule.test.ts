import { describe, expect, it } from 'vitest'
import {
  EARLY_MS,
  GIVE_UP_MS,
  groupByMinute,
  RETRY_MS,
  Schedule,
  type PushKind,
  type Reminder,
  type ScheduleStorage,
  type Subscription,
} from './schedule.ts'

const SUBSCRIPTION: Subscription = {
  endpoint: 'https://web.push.apple.com/QGuQyavXutnMH-endpoint',
  keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
}

/** 11:55 PM in Los Angeles on Oct 13, 2026 (06:55 UTC on the 14th). */
const AT = Date.UTC(2026, 9, 14, 6, 55)
const DAY = 86_400_000

/** Durable Object storage in memory. Values are copied in and out, like the real thing. */
function fakeStorage() {
  const data = new Map<string, unknown>()
  const state = { alarm: null as number | null, failGets: false }
  const storage: ScheduleStorage = {
    get: async <T>(key: string) => {
      if (state.failGets) throw new Error('storage is unavailable')
      return structuredClone(data.get(key)) as T | undefined
    },
    put: async <T>(entries: Record<string, T>) => {
      for (const [key, value] of Object.entries(entries)) data.set(key, structuredClone(value))
    },
    delete: async (keys: string[]) => keys.filter((key) => data.delete(key)).length,
    setAlarm: async (time: number) => {
      state.alarm = time
    },
    deleteAlarm: async () => {
      state.alarm = null
    },
  }
  return { storage, data, state }
}

/** A push service that answers each push with the next status (or throws for null: no answer). */
function fakePush(...answers: (number | null)[]) {
  const sent: { endpoint: string; kind: PushKind }[] = []
  const send = async (subscription: Subscription, kind: PushKind) => {
    sent.push({ endpoint: subscription.endpoint, kind })
    const answer = answers.length > 0 ? answers.shift() : 201
    if (answer === null || answer === undefined) throw new Error('network error')
    return answer
  }
  return { send, sent }
}

function setup(answers: (number | null)[] = []) {
  const store = fakeStorage()
  const push = fakePush(...answers)
  const clock = { now: AT }
  const schedule = new Schedule(store.storage, push.send, () => clock.now)
  return { ...store, ...push, clock, schedule }
}

const reminder = (at: number, friendId: string): Reminder => ({ at, friendId })

describe('groupByMinute', () => {
  it('groups reminders that share a minute, earliest first', () => {
    const groups = groupByMinute([reminder(AT + 60_000, 'kim'), reminder(AT, 'alex'), reminder(AT + 59_000, 'sam')])
    expect(groups).toEqual([[reminder(AT, 'alex'), reminder(AT + 59_000, 'sam')], [reminder(AT + 60_000, 'kim')]])
  })
})

describe('sync', () => {
  it('stores the subscription and reminders and wakes at the earliest', async () => {
    const { schedule, data, state } = setup()
    const reminders = [reminder(AT + DAY, 'kim'), reminder(AT, 'alex')]
    await schedule.sync({ subscription: SUBSCRIPTION, reminders })
    expect(data.get('subscription')).toEqual(SUBSCRIPTION)
    expect(data.get('reminders')).toEqual(reminders)
    expect(state.alarm).toBe(AT)
  })

  it('replaces everything, and cancels the alarm when nothing is left', async () => {
    const { schedule, data, state } = setup()
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex')] })
    const other = { ...SUBSCRIPTION, endpoint: 'https://web.push.apple.com/other' }
    await schedule.sync({ subscription: other, reminders: [] })
    expect(data.get('subscription')).toEqual(other)
    expect(data.get('reminders')).toEqual([])
    expect(state.alarm).toBeNull()
  })
})

describe('clear', () => {
  it('forgets everything and cancels the alarm', async () => {
    const { schedule, data, state } = setup()
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex')] })
    await schedule.clear()
    expect([...data.keys()]).toEqual([])
    expect(state.alarm).toBeNull()
  })
})

describe('alarm', () => {
  it('sends one push for friends who share a birthday, then wakes for the next one', async () => {
    const { schedule, data, state, sent } = setup()
    await schedule.sync({
      subscription: SUBSCRIPTION,
      reminders: [reminder(AT, 'alex'), reminder(AT, 'sam'), reminder(AT + DAY, 'kim')],
    })
    await schedule.alarm()
    expect(sent).toEqual([{ endpoint: SUBSCRIPTION.endpoint, kind: 'birthday' }])
    expect(data.get('reminders')).toEqual([reminder(AT + DAY, 'kim')])
    expect(state.alarm).toBe(AT + DAY)
  })

  it('sends a reminder up to 30 seconds early, but not before', async () => {
    const { schedule, clock, sent, state } = setup()
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex')] })
    clock.now = AT - EARLY_MS - 1
    await schedule.alarm()
    expect(sent).toEqual([])
    expect(state.alarm).toBe(AT)
    clock.now = AT - EARLY_MS
    await schedule.alarm()
    expect(sent).toHaveLength(1)
    expect(state.alarm).toBeNull()
  })

  it('sends one push per minute when several are due', async () => {
    const { schedule, clock, sent, data } = setup()
    await schedule.sync({
      subscription: SUBSCRIPTION,
      reminders: [reminder(AT, 'alex'), reminder(AT + 5 * 60_000, 'sam')],
    })
    clock.now = AT + 6 * 60_000
    await schedule.alarm()
    expect(sent).toHaveLength(2)
    expect(data.get('reminders')).toEqual([])
  })

  it('forgets everything when the subscription is gone (404 or 410)', async () => {
    for (const status of [404, 410]) {
      const { schedule, data, state } = setup([status])
      await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex'), reminder(AT + DAY, 'kim')] })
      await schedule.alarm()
      expect([...data.keys()]).toEqual([])
      expect(state.alarm).toBeNull()
    }
  })

  it('tries again in a minute after a 429, a 5xx or no answer', async () => {
    for (const answer of [429, 500, 503, null]) {
      const { schedule, data, state } = setup([answer])
      await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex'), reminder(AT + DAY, 'kim')] })
      await schedule.alarm()
      expect(data.get('reminders')).toEqual([reminder(AT, 'alex'), reminder(AT + DAY, 'kim')])
      expect(state.alarm).toBe(AT + RETRY_MS)
    }
  })

  it('sends on a later try and then moves on', async () => {
    const { schedule, clock, data, state, sent } = setup([503, 201])
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex'), reminder(AT + DAY, 'kim')] })
    await schedule.alarm()
    clock.now = AT + RETRY_MS
    await schedule.alarm()
    expect(sent).toHaveLength(2)
    expect(data.get('reminders')).toEqual([reminder(AT + DAY, 'kim')])
    expect(state.alarm).toBe(AT + DAY)
  })

  it('gives up 30 minutes after the reminder time', async () => {
    const { schedule, clock, data, state, sent } = setup([503])
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex'), reminder(AT + DAY, 'kim')] })
    clock.now = AT + GIVE_UP_MS
    await schedule.alarm()
    expect(sent).toHaveLength(1)
    expect(state.alarm).toBe(AT + GIVE_UP_MS + RETRY_MS)
    clock.now = AT + GIVE_UP_MS + 1
    await schedule.alarm()
    expect(sent).toHaveLength(1)
    expect(data.get('reminders')).toEqual([reminder(AT + DAY, 'kim')])
    expect(state.alarm).toBe(AT + DAY)
  })

  it('never throws: an error just tries again in a minute', async () => {
    const { schedule, state } = setup()
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex')] })
    state.failGets = true
    await expect(schedule.alarm()).resolves.toBeUndefined()
    expect(state.alarm).toBe(AT + RETRY_MS)
  })

  it('cleans up when there is no subscription', async () => {
    const { schedule, data, state, sent } = setup()
    await schedule.alarm()
    expect(sent).toEqual([])
    expect([...data.keys()]).toEqual([])
    expect(state.alarm).toBeNull()
  })

  it('lets a sync that arrives during a push finish after it, so the new schedule is kept', async () => {
    const store = fakeStorage()
    let answer: (status: number) => void = () => {}
    let sending: () => void = () => {}
    const sendStarted = new Promise<void>((resolve) => (sending = resolve))
    const send = () => {
      sending()
      return new Promise<number>((resolve) => (answer = resolve))
    }
    const schedule = new Schedule(store.storage, send, () => AT)
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex')] })
    const alarm = schedule.alarm()
    const fresh = [reminder(AT + DAY, 'kim')]
    const sync = schedule.sync({ subscription: SUBSCRIPTION, reminders: fresh })
    await sendStarted
    answer(201)
    await Promise.all([alarm, sync])
    expect(store.data.get('reminders')).toEqual(fresh)
    expect(store.state.alarm).toBe(AT + DAY)
  })
})

describe('sendTest', () => {
  it('sends a test push', async () => {
    const { schedule, sent } = setup()
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [] })
    expect(await schedule.sendTest()).toBe('sent')
    expect(sent).toEqual([{ endpoint: SUBSCRIPTION.endpoint, kind: 'test' }])
  })

  it('says when there is nothing to send to', async () => {
    const { schedule, sent } = setup()
    expect(await schedule.sendTest()).toBe('no-subscription')
    expect(sent).toEqual([])
  })

  it('forgets everything when the subscription is gone', async () => {
    const { schedule, data } = setup([410])
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex')] })
    expect(await schedule.sendTest()).toBe('gone')
    expect([...data.keys()]).toEqual([])
  })

  it('reports a failed push', async () => {
    for (const answer of [500, 403, null]) {
      const { schedule } = setup([answer])
      await schedule.sync({ subscription: SUBSCRIPTION, reminders: [] })
      expect(await schedule.sendTest()).toBe('failed')
    }
  })
})
