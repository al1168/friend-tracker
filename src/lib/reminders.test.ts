import { describe, expect, it } from 'vitest'
import { friend } from '../test/fixtures'
import type { Birthday } from '../types'
import {
  birthdayNotice,
  birthdaysOn,
  buildReminders,
  fallbackNotice,
  MAX_REMINDERS,
  pushKind,
  reminderTime,
  reminderTimes,
  scheduleHash,
  TEST_NOTICE,
  type PushSubscriptionData,
} from './reminders'

// Tests run in America/Los_Angeles (see vitest.config.ts): PDT is UTC-7, PST is UTC-8.
// In 2026, daylight saving starts on Mar 8 and ends on Nov 1.

/** A local time in the test time zone, as ms. Months are 1 to 12. */
function local(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  return new Date(year, month - 1, day, hour, minute, second).getTime()
}

function bday(month: number, day: number, year: number | null = null): Birthday {
  return { month, day, year }
}

function withBirthday(id: string, name: string, birthday: Birthday | null) {
  return { ...friend(id, name), birthday }
}

describe('reminderTime', () => {
  it('is 11:55 PM local time on the night before', () => {
    const at = reminderTime(bday(10, 14), 2026)
    expect(at).toBe(local(2026, 10, 13, 23, 55))
    expect(new Date(at).toISOString()).toBe('2026-10-14T06:55:00.000Z')
  })

  it('falls on the last day of the month before for the 1st', () => {
    expect(reminderTime(bday(3, 1), 2026)).toBe(local(2026, 2, 28, 23, 55))
    expect(reminderTime(bday(3, 1), 2028)).toBe(local(2028, 2, 29, 23, 55))
    expect(reminderTime(bday(5, 1), 2026)).toBe(local(2026, 4, 30, 23, 55))
    expect(new Date(reminderTime(bday(1, 1), 2027)).toISOString()).toBe('2027-01-01T07:55:00.000Z')
    expect(reminderTime(bday(1, 1), 2027)).toBe(local(2026, 12, 31, 23, 55))
  })

  it('moves Feb 29 to Feb 28 in years without one', () => {
    expect(reminderTime(bday(2, 29), 2027)).toBe(local(2027, 2, 27, 23, 55))
    expect(reminderTime(bday(2, 29), 2028)).toBe(local(2028, 2, 28, 23, 55))
  })

  it('stays at 11:55 PM across daylight saving changes', () => {
    const times = {
      beforeSpring: reminderTime(bday(3, 8), 2026),
      afterSpring: reminderTime(bday(3, 9), 2026),
      beforeFall: reminderTime(bday(11, 1), 2026),
      afterFall: reminderTime(bday(11, 2), 2026),
    }
    expect(new Date(times.beforeSpring).toISOString()).toBe('2026-03-08T07:55:00.000Z')
    expect(new Date(times.afterSpring).toISOString()).toBe('2026-03-09T06:55:00.000Z')
    expect(new Date(times.beforeFall).toISOString()).toBe('2026-11-01T06:55:00.000Z')
    expect(new Date(times.afterFall).toISOString()).toBe('2026-11-02T07:55:00.000Z')
    // The night the clocks spring forward is 23 hours long; the night they fall back is 25.
    expect(times.afterSpring - times.beforeSpring).toBe(23 * 3_600_000)
    expect(times.afterFall - times.beforeFall).toBe(25 * 3_600_000)
    for (const at of Object.values(times)) {
      expect([new Date(at).getHours(), new Date(at).getMinutes()]).toEqual([23, 55])
    }
  })
})

describe('reminderTimes', () => {
  const now = local(2026, 10, 2, 12, 0)

  it('gives the next two, skipping ones already past', () => {
    expect(reminderTimes(bday(10, 14), now)).toEqual([local(2026, 10, 13, 23, 55), local(2027, 10, 13, 23, 55)])
    // Today's birthday was reminded of last night, so the next two are next year's and the year after's.
    expect(reminderTimes(bday(10, 2), now)).toEqual([local(2027, 10, 1, 23, 55), local(2028, 10, 1, 23, 55)])
  })

  it('skips a reminder at exactly now', () => {
    expect(reminderTimes(bday(10, 3), local(2026, 10, 2, 23, 55))).toEqual([
      local(2027, 10, 2, 23, 55),
      local(2028, 10, 2, 23, 55),
    ])
    expect(reminderTimes(bday(10, 3), local(2026, 10, 2, 23, 54, 59))[0]).toBe(local(2026, 10, 2, 23, 55))
  })

  it('crosses the new year', () => {
    expect(reminderTimes(bday(1, 1), local(2026, 12, 31, 23, 0))).toEqual([
      local(2026, 12, 31, 23, 55),
      local(2027, 12, 31, 23, 55),
    ])
    expect(reminderTimes(bday(1, 1), local(2026, 12, 31, 23, 58))).toEqual([
      local(2027, 12, 31, 23, 55),
      local(2028, 12, 31, 23, 55),
    ])
    expect(reminderTimes(bday(12, 31), local(2026, 12, 31, 12, 0))).toEqual([
      local(2027, 12, 30, 23, 55),
      local(2028, 12, 30, 23, 55),
    ])
  })

  it('reminds of a Feb 29 birthday on Feb 27 or Feb 28', () => {
    expect(reminderTimes(bday(2, 29), now)).toEqual([local(2027, 2, 27, 23, 55), local(2028, 2, 28, 23, 55)])
  })

  it('never reminds of the day they were born', () => {
    // Possible only with a clock or time zone a day off: a Jan 1 birth date while the phone is still on Dec 31.
    expect(reminderTimes(bday(1, 1, 2027), local(2026, 12, 31, 23, 0))).toEqual([
      local(2027, 12, 31, 23, 55),
      local(2028, 12, 31, 23, 55),
    ])
  })
})

describe('buildReminders', () => {
  const now = local(2026, 10, 2, 12, 0)

  it('lists every birthday reminder, soonest first, then by friend id', () => {
    const friends = [
      withBirthday('sam', 'Sam', bday(10, 14)),
      withBirthday('lee', 'Lee', null),
      withBirthday('alex', 'Alex', bday(10, 14, 1990)),
      withBirthday('kim', 'Kim', bday(1, 1)),
    ]
    expect(buildReminders(friends, now)).toEqual([
      { at: local(2026, 10, 13, 23, 55), friendId: 'alex' },
      { at: local(2026, 10, 13, 23, 55), friendId: 'sam' },
      { at: local(2026, 12, 31, 23, 55), friendId: 'kim' },
      { at: local(2027, 10, 13, 23, 55), friendId: 'alex' },
      { at: local(2027, 10, 13, 23, 55), friendId: 'sam' },
      { at: local(2027, 12, 31, 23, 55), friendId: 'kim' },
    ])
  })

  it('keeps the soonest 1,000', () => {
    const friends = Array.from({ length: 600 }, (_, i) => withBirthday(`f${String(i).padStart(3, '0')}`, 'Friend', bday(3, 14)))
    const reminders = buildReminders(friends, now)
    expect(reminders).toHaveLength(MAX_REMINDERS)
    expect(reminders[599]).toEqual({ at: local(2027, 3, 13, 23, 55), friendId: 'f599' })
    expect(reminders[600]).toEqual({ at: local(2028, 3, 13, 23, 55), friendId: 'f000' })
  })

  it('skips friends whose id the server would refuse', () => {
    const friends = [
      withBirthday('', 'No id', bday(10, 14)),
      withBirthday('x'.repeat(65), 'Long id', bday(10, 14)),
      withBirthday('x'.repeat(64), 'Longest id', bday(10, 14)),
      withBirthday('ok', 'Fine', bday(10, 15)),
    ]
    expect(buildReminders(friends, now).map((reminder) => reminder.friendId)).toEqual(['x'.repeat(64), 'ok', 'x'.repeat(64), 'ok'])
  })

  it('gives nothing without birthdays', () => {
    expect(buildReminders([withBirthday('lee', 'Lee', null)], now)).toEqual([])
  })
})

describe('scheduleHash', () => {
  const subscription: PushSubscriptionData = {
    endpoint: 'https://web.push.apple.com/abc',
    keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
  }
  const reminders = [{ at: 1_800_000_000_000, friendId: 'alex' }]

  it('is the same for the same schedule', async () => {
    const hash = await scheduleHash(subscription, reminders)
    expect(hash).toMatch(/^[\w-]{43}$/)
    expect(await scheduleHash({ ...subscription }, [{ ...reminders[0] }])).toBe(hash)
  })

  it('changes when anything the server stores changes', async () => {
    const hash = await scheduleHash(subscription, reminders)
    const others = await Promise.all([
      scheduleHash(subscription, []),
      scheduleHash(subscription, [{ at: 1_800_000_060_000, friendId: 'alex' }]),
      scheduleHash(subscription, [{ at: 1_800_000_000_000, friendId: 'sam' }]),
      scheduleHash({ ...subscription, endpoint: 'https://web.push.apple.com/xyz' }, reminders),
      scheduleHash({ ...subscription, keys: { ...subscription.keys, p256dh: 'new-key' } }, reminders),
      scheduleHash({ ...subscription, keys: { ...subscription.keys, auth: 'new-secret' } }, reminders),
    ])
    expect(new Set([hash, ...others]).size).toBe(7)
  })
})

describe('pushKind', () => {
  it('is "test" only when the payload says so', () => {
    expect(pushKind({ kind: 'test' })).toBe('test')
    expect(pushKind({ kind: 'birthday' })).toBe('birthday')
    for (const payload of [null, undefined, 'test', 42, {}, { kind: 'other' }, ['test']]) {
      expect(pushKind(payload)).toBe('birthday')
    }
  })
})

describe('birthdaysOn', () => {
  it('finds the friends whose birthday is that date, by name', () => {
    const friends = [
      withBirthday('sam', 'Sam', bday(10, 14)),
      withBirthday('alex', 'alex', bday(10, 14, 1990)),
      withBirthday('kim', 'Kim', bday(10, 15)),
      withBirthday('lee', 'Lee', null),
    ]
    expect(birthdaysOn(friends, '2026-10-14').map((f) => f.id)).toEqual(['alex', 'sam'])
    expect(birthdaysOn(friends, '2026-10-16')).toEqual([])
  })

  it('counts Feb 29 on Feb 28 in years without one', () => {
    const leap = [withBirthday('max', 'Max', bday(2, 29))]
    expect(birthdaysOn(leap, '2027-02-28').map((f) => f.id)).toEqual(['max'])
    expect(birthdaysOn(leap, '2028-02-28')).toEqual([])
    expect(birthdaysOn(leap, '2028-02-29').map((f) => f.id)).toEqual(['max'])
  })

  it('skips the day they were born', () => {
    expect(birthdaysOn([withBirthday('baby', 'Baby', bday(10, 14, 2026))], '2026-10-14')).toEqual([])
    expect(birthdaysOn([withBirthday('baby', 'Baby', bday(10, 14, 2026))], '2027-10-14')).toHaveLength(1)
  })
})

describe('birthdayNotice', () => {
  const alex = withBirthday('alex', 'Alex', bday(10, 14))
  const sam = withBirthday('sam', 'Sam', bday(10, 14))
  const kim = withBirthday('kim', 'Kim', bday(10, 14))
  const jo = withBirthday('jo', 'Jo', bday(10, 14))
  const lee = withBirthday('lee', 'Lee', bday(3, 2))

  it('names one friend and opens their page', () => {
    expect(birthdayNotice([alex, lee], local(2026, 10, 13, 23, 55))).toEqual({
      title: "🎂 Alex's birthday starts in 5 minutes",
      body: 'Send them a message.',
      tag: 'birthday-2026-10-14',
      url: '/#/friends/alex',
    })
  })

  it('counts a push up to 30 seconds early as the same reminder', () => {
    expect(birthdayNotice([alex], local(2026, 10, 13, 23, 54, 30)).title).toBe("🎂 Alex's birthday starts in 5 minutes")
  })

  it('says it is their birthday when the push arrives after midnight', () => {
    expect(birthdayNotice([alex], local(2026, 10, 14, 0, 20))).toMatchObject({
      title: "🎂 It's Alex's birthday",
      tag: 'birthday-2026-10-14',
    })
  })

  it('names several friends in one notification and opens the Friends tab', () => {
    expect(birthdayNotice([sam, alex, lee], local(2026, 10, 13, 23, 55))).toEqual({
      title: '🎂 Alex and Sam: birthdays at midnight',
      body: 'Send them a message.',
      tag: 'birthday-2026-10-14',
      url: '/#/',
    })
    expect(birthdayNotice([sam, alex, kim, jo], local(2026, 10, 13, 23, 55)).title).toBe(
      '🎂 Alex, Jo and 2 others: birthdays at midnight',
    )
    expect(birthdayNotice([sam, alex], local(2026, 10, 14, 1, 0)).title).toBe('🎂 Alex and Sam: birthdays today')
  })

  it('falls back when nobody matches', () => {
    expect(birthdayNotice([lee], local(2026, 10, 13, 23, 55))).toEqual(fallbackNotice(local(2026, 10, 13, 23, 55)))
    expect(birthdayNotice([], local(2026, 10, 13, 23, 55))).toEqual({
      title: '🎂 A birthday is coming up',
      body: 'Open Friend Tracker to see who.',
      tag: 'birthday-2026-10-14',
      url: '/#/',
    })
  })

  it('finds a Feb 29 birthday on Feb 28', () => {
    const max = withBirthday('max', 'Max', bday(2, 29))
    expect(birthdayNotice([max], local(2027, 2, 27, 23, 55)).title).toBe("🎂 Max's birthday starts in 5 minutes")
  })

  it('keeps the friend link safe for any id', () => {
    expect(birthdayNotice([withBirthday('a/b c', 'Alex', bday(10, 14))], local(2026, 10, 13, 23, 55)).url).toBe(
      '/#/friends/a%2Fb%20c',
    )
  })
})

describe('TEST_NOTICE', () => {
  it('says reminders work and opens Settings', () => {
    expect(TEST_NOTICE).toEqual({
      title: '🎂 Reminders work',
      body: "You'll get a note at 11:55 PM before each birthday.",
      tag: 'reminders-test',
      url: '/#/settings',
    })
  })
})
