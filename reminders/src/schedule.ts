// The reminder schedule kept by the ReminderSchedule Durable Object (see index.ts): one push
// subscription, the times to send a push, and the alarm that sends them. The platform pieces
// (storage, sending a push, the clock) come in as arguments, so this is tested in plain Node.

/** A push subscription as the app sends it. */
export interface Subscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** When to send a push (UTC ms), and the random id of the friend it's for. Never a name or a date. */
export interface Reminder {
  at: number
  friendId: string
}

export interface SyncInput {
  subscription: Subscription
  reminders: Reminder[]
}

/** What a push asks the phone to show. The payload carries nothing else. */
export type PushKind = 'birthday' | 'test'

export type TestResult = 'sent' | 'no-subscription' | 'gone' | 'failed'

/** Sends one push and resolves with the push service's HTTP status. Rejects when there's no answer. */
export type SendPush = (subscription: Subscription, kind: PushKind) => Promise<number>

/** The parts of DurableObjectStorage the schedule uses. */
export interface ScheduleStorage {
  get<T>(key: string): Promise<T | undefined>
  put<T>(entries: Record<string, T>): Promise<void>
  delete(keys: string[]): Promise<number>
  setAlarm(scheduledTime: number): Promise<void>
  deleteAlarm(): Promise<void>
}

/** A reminder this close is sent now: an alarm may fire a little early. */
export const EARLY_MS = 30_000
/** After a failed send (429, 5xx, no answer), the next try is this much later. */
export const RETRY_MS = 60_000
/** A reminder still not sent this long after its time is dropped: it would only arrive late. */
export const GIVE_UP_MS = 30 * 60_000

const SUBSCRIPTION = 'subscription'
const REMINDERS = 'reminders'

function isSent(status: number): boolean {
  return status >= 200 && status < 300
}

/** The subscription no longer exists: the push service will never accept it again. */
function isGone(status: number): boolean {
  return status === 404 || status === 410
}

function key(reminder: Reminder): string {
  return `${reminder.at}:${reminder.friendId}`
}

/** Due reminders in groups that share a minute, earliest first. Each group is one push. */
export function groupByMinute(reminders: readonly Reminder[]): Reminder[][] {
  const groups = new Map<number, Reminder[]>()
  for (const reminder of [...reminders].sort((a, b) => a.at - b.at)) {
    const minute = Math.floor(reminder.at / 60_000)
    groups.set(minute, [...(groups.get(minute) ?? []), reminder])
  }
  return [...groups.values()]
}

export class Schedule {
  private readonly storage: ScheduleStorage
  private readonly send: SendPush
  private readonly now: () => number
  /** Calls run one at a time, so a sync never interleaves with an alarm that's waiting on a push. */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(storage: ScheduleStorage, send: SendPush, now: () => number) {
    this.storage = storage
    this.send = send
    this.now = now
  }

  private exclusive<T>(run: () => Promise<T>): Promise<T> {
    const result = this.queue.then(run, run)
    this.queue = result.catch(() => {})
    return result
  }

  /** Replaces the subscription and every reminder, and sets the alarm for the earliest one. */
  sync(input: SyncInput): Promise<void> {
    return this.exclusive(async () => {
      await this.storage.put<unknown>({ [SUBSCRIPTION]: input.subscription, [REMINDERS]: input.reminders })
      await this.arm(input.reminders.map((reminder) => reminder.at))
    })
  }

  /** Forgets the subscription and every reminder, and cancels the alarm. */
  clear(): Promise<void> {
    return this.exclusive(() => this.clearNow())
  }

  /** Sends one test push now. */
  sendTest(): Promise<TestResult> {
    return this.exclusive(async () => {
      const subscription = await this.storage.get<Subscription>(SUBSCRIPTION)
      if (!subscription) return 'no-subscription'
      let status: number
      try {
        status = await this.send(subscription, 'test')
      } catch {
        return 'failed'
      }
      if (isSent(status)) return 'sent'
      if (isGone(status)) {
        await this.clearNow()
        return 'gone'
      }
      return 'failed'
    })
  }

  /**
   * The alarm: one push per minute that has reminders due, then the alarm for what's next.
   * It never throws: the platform retries a failed alarm only 6 times, so any error just tries
   * again in a minute.
   */
  alarm(): Promise<void> {
    return this.exclusive(async () => {
      try {
        await this.sendDue()
      } catch {
        await this.storage.setAlarm(this.now() + RETRY_MS).catch(() => {})
      }
    })
  }

  private async clearNow(): Promise<void> {
    await this.storage.deleteAlarm()
    await this.storage.delete([SUBSCRIPTION, REMINDERS])
  }

  /** Sets the alarm for the earliest time, or cancels it when there's none. */
  private async arm(times: readonly number[]): Promise<void> {
    if (times.length === 0) await this.storage.deleteAlarm()
    else await this.storage.setAlarm(Math.min(...times))
  }

  private async sendDue(): Promise<void> {
    const now = this.now()
    const subscription = await this.storage.get<Subscription>(SUBSCRIPTION)
    const reminders = (await this.storage.get<Reminder[]>(REMINDERS)) ?? []
    if (!subscription) {
      await this.clearNow()
      return
    }
    const done = new Set<string>()
    let retrying = false
    for (const group of groupByMinute(reminders.filter((reminder) => reminder.at <= now + EARLY_MS))) {
      if (now - group[0].at > GIVE_UP_MS) {
        for (const reminder of group) done.add(key(reminder))
        continue
      }
      let status: number | null
      try {
        status = await this.send(subscription, 'birthday')
      } catch {
        status = null
      }
      if (status !== null && isGone(status)) {
        await this.clearNow()
        return
      }
      if (status !== null && isSent(status)) {
        for (const reminder of group) done.add(key(reminder))
      } else {
        // 429, 5xx, any other answer, or none: keep them and try again in a minute.
        retrying = true
      }
    }
    const left = reminders.filter((reminder) => !done.has(key(reminder)))
    await this.storage.put({ [REMINDERS]: left })
    const upcoming = left.filter((reminder) => reminder.at > now + EARLY_MS).map((reminder) => reminder.at)
    await this.arm(retrying ? [...upcoming, now + RETRY_MS] : upcoming)
  }
}
