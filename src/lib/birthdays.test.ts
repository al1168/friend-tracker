import { describe, expect, it } from 'vitest'
import { friend, TODAY } from '../test/fixtures'
import type { Birthday } from '../types'
import {
  ageOnNextBirthday,
  birthdayFromFields,
  birthdayProblem,
  daysUntilBirthday,
  describeNextBirthday,
  EMPTY_BIRTHDAY_FIELDS,
  formatBirthday,
  isLeapYear,
  isValidBirthday,
  maxDay,
  nextBirthday,
  upcomingBirthdays,
} from './birthdays'

// TODAY is 2026-10-02.
function bday(month: number, day: number, year: number | null = null): Birthday {
  return { month, day, year }
}

describe('isLeapYear', () => {
  it('follows the calendar rules', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2000)).toBe(true)
    expect(isLeapYear(2026)).toBe(false)
    expect(isLeapYear(1900)).toBe(false)
  })
})

describe('maxDay', () => {
  it('gives each month its length, 29 for February and 31 with no month', () => {
    expect(maxDay(1)).toBe(31)
    expect(maxDay(2)).toBe(29)
    expect(maxDay(4)).toBe(30)
    expect(maxDay(12)).toBe(31)
    expect(maxDay(null)).toBe(31)
  })
})

describe('birthdayProblem', () => {
  it('accepts a real month and day, with or without a year', () => {
    expect(birthdayProblem(bday(3, 14), TODAY)).toBeNull()
    expect(birthdayProblem(bday(3, 14, 1996), TODAY)).toBeNull()
    expect(birthdayProblem(bday(12, 31), TODAY)).toBeNull()
  })

  it('rejects a month or day out of range', () => {
    for (const birthday of [bday(0, 1), bday(13, 1), bday(1, 0), bday(1, 32), bday(4, 31), bday(2, 30), bday(1.5, 1), bday(1, 2.5), bday(Number.NaN, 1)]) {
      expect(birthdayProblem(birthday, TODAY)).toBe("That date doesn't exist.")
    }
  })

  it('allows Feb 29 without a year, or with a leap year', () => {
    expect(birthdayProblem(bday(2, 29), TODAY)).toBeNull()
    expect(birthdayProblem(bday(2, 29, 2024), TODAY)).toBeNull()
    expect(birthdayProblem(bday(2, 29, 2000), TODAY)).toBeNull()
    expect(birthdayProblem(bday(2, 29, 2023), TODAY)).toBe("That date doesn't exist.")
    expect(birthdayProblem(bday(2, 29, 1900), TODAY)).toBe("That date doesn't exist.")
  })

  it('accepts years from 1900 up to today', () => {
    expect(birthdayProblem(bday(1, 1, 1900), TODAY)).toBeNull()
    expect(birthdayProblem(bday(12, 31, 1899), TODAY)).toBe("That date doesn't exist.")
    expect(birthdayProblem(bday(1, 1, 1900.5), TODAY)).toBe("That date doesn't exist.")
    expect(birthdayProblem(bday(10, 2, 2026), TODAY)).toBeNull()
  })

  it('rejects a date after today', () => {
    expect(birthdayProblem(bday(10, 3, 2026), TODAY)).toBe('That date is in the future.')
    expect(birthdayProblem(bday(1, 1, 2027), TODAY)).toBe('That date is in the future.')
    expect(birthdayProblem(bday(1, 1, 10000), TODAY)).toBe('That date is in the future.')
  })
})

describe('isValidBirthday', () => {
  it('accepts a valid birthday, ignoring extra fields', () => {
    expect(isValidBirthday({ month: 3, day: 14, year: null }, TODAY)).toBe(true)
    expect(isValidBirthday({ month: 3, day: 14, year: 1996, sign: 'Pisces' }, TODAY)).toBe(true)
  })

  it('rejects anything else', () => {
    const bad = [
      null,
      undefined,
      'March 14',
      [3, 14],
      {},
      { month: 3, day: 14 },
      { month: '3', day: 14, year: null },
      { month: 3, day: 14, year: '1996' },
      { month: 2, day: 29, year: 2023 },
      { month: 10, day: 3, year: 2026 },
    ]
    for (const value of bad) expect(isValidBirthday(value, TODAY)).toBe(false)
  })
})

describe('birthdayFromFields', () => {
  it('gives no birthday when month and day are empty, even with a year', () => {
    expect(birthdayFromFields(EMPTY_BIRTHDAY_FIELDS, TODAY)).toEqual({ ok: true, birthday: null })
    expect(birthdayFromFields({ month: null, day: null, year: 1996 }, TODAY)).toEqual({ ok: true, birthday: null })
  })

  it('asks for both a month and a day', () => {
    const error = { ok: false, error: 'Pick a month and a day.' }
    expect(birthdayFromFields({ month: 3, day: null, year: null }, TODAY)).toEqual(error)
    expect(birthdayFromFields({ month: null, day: 14, year: 1996 }, TODAY)).toEqual(error)
  })

  it('gives the birthday, or says why it cannot be saved', () => {
    expect(birthdayFromFields({ month: 3, day: 14, year: 1996 }, TODAY)).toEqual({ ok: true, birthday: bday(3, 14, 1996) })
    expect(birthdayFromFields({ month: 2, day: 29, year: null }, TODAY)).toEqual({ ok: true, birthday: bday(2, 29) })
    expect(birthdayFromFields({ month: 2, day: 29, year: 2023 }, TODAY)).toEqual({ ok: false, error: "That date doesn't exist." })
    expect(birthdayFromFields({ month: 12, day: 25, year: 2026 }, TODAY)).toEqual({ ok: false, error: 'That date is in the future.' })
  })
})

describe('nextBirthday', () => {
  it('is today on the day, later this year, or next year once it has passed', () => {
    expect(nextBirthday(bday(10, 2), TODAY)).toBe('2026-10-02')
    expect(nextBirthday(bday(10, 3), TODAY)).toBe('2026-10-03')
    expect(nextBirthday(bday(10, 1), TODAY)).toBe('2027-10-01')
    expect(nextBirthday(bday(3, 14, 1996), TODAY)).toBe('2027-03-14')
  })

  it('rolls from Dec 31 into January', () => {
    expect(nextBirthday(bday(12, 31), '2026-12-31')).toBe('2026-12-31')
    expect(nextBirthday(bday(1, 1), '2026-12-31')).toBe('2027-01-01')
    expect(nextBirthday(bday(12, 31), '2027-01-01')).toBe('2027-12-31')
  })

  it('falls on Feb 29 in leap years and on Feb 28 in other years', () => {
    expect(nextBirthday(bday(2, 29), '2028-02-01')).toBe('2028-02-29')
    expect(nextBirthday(bday(2, 29, 2000), '2026-02-01')).toBe('2026-02-28')
    expect(nextBirthday(bday(2, 29), '2026-02-28')).toBe('2026-02-28')
    expect(nextBirthday(bday(2, 29), '2026-03-01')).toBe('2027-02-28')
    expect(nextBirthday(bday(2, 29), '2027-03-01')).toBe('2028-02-29')
    expect(nextBirthday(bday(2, 29), '2028-02-29')).toBe('2028-02-29')
  })

  it('never lands before the first birthday of someone born today', () => {
    expect(nextBirthday(bday(10, 2, 2026), TODAY)).toBe('2027-10-02')
    expect(describeNextBirthday(bday(10, 2, 2026), TODAY)).toBe('In 365 days · turns 1')
    expect(describeNextBirthday(bday(3, 1, 2027), '2027-03-01')).toBe('In 366 days · turns 1')
  })
})

describe('daysUntilBirthday', () => {
  it('counts calendar days, with 0 for today', () => {
    expect(daysUntilBirthday(bday(10, 2), TODAY)).toBe(0)
    expect(daysUntilBirthday(bday(10, 14), TODAY)).toBe(12)
    expect(daysUntilBirthday(bday(1, 1), '2026-12-31')).toBe(1)
    expect(daysUntilBirthday(bday(10, 1), TODAY)).toBe(364)
    expect(daysUntilBirthday(bday(2, 29), '2026-02-20')).toBe(8)
  })
})

describe('ageOnNextBirthday', () => {
  it('is the age they turn next, or null without a year', () => {
    expect(ageOnNextBirthday(bday(10, 2, 1995), TODAY)).toBe(31)
    expect(ageOnNextBirthday(bday(10, 14, 1995), TODAY)).toBe(31)
    expect(ageOnNextBirthday(bday(10, 1, 1995), TODAY)).toBe(32)
    expect(ageOnNextBirthday(bday(2, 29, 2000), '2026-02-27')).toBe(26)
    expect(ageOnNextBirthday(bday(10, 2), TODAY)).toBeNull()
  })
})

describe('formatBirthday', () => {
  it('spells out the month, with the year when known', () => {
    expect(formatBirthday(bday(3, 14, 1996))).toBe('March 14, 1996')
    expect(formatBirthday(bday(3, 14))).toBe('March 14')
    expect(formatBirthday(bday(2, 29))).toBe('February 29')
  })
})

describe('describeNextBirthday', () => {
  it('says today, tomorrow or in how many days', () => {
    expect(describeNextBirthday(bday(10, 2), TODAY)).toBe('Today')
    expect(describeNextBirthday(bday(10, 3), TODAY)).toBe('Tomorrow')
    expect(describeNextBirthday(bday(10, 4), TODAY)).toBe('In 2 days')
    expect(describeNextBirthday(bday(2, 29), '2028-02-28')).toBe('Tomorrow')
    expect(describeNextBirthday(bday(10, 14), TODAY)).toBe('In 12 days')
  })

  it('adds the age when the year is known', () => {
    expect(describeNextBirthday(bday(10, 2, 1995), TODAY)).toBe('Today · turns 31')
    expect(describeNextBirthday(bday(10, 3, 1995), TODAY)).toBe('Tomorrow · turns 31')
    expect(describeNextBirthday(bday(10, 14, 1995), TODAY)).toBe('In 12 days · turns 31')
  })
})

describe('upcomingBirthdays', () => {
  function withBirthday(id: string, name: string, birthday: Birthday | null) {
    return { ...friend(id, name), birthday }
  }

  const friends = [
    withBirthday('zoe', 'Zoe', bday(10, 9)),
    withBirthday('alex', 'Alex', bday(10, 16)),
    withBirthday('sam', 'Sam', bday(10, 17)),
    withBirthday('kim', 'Kim', bday(10, 2, 1990)),
    withBirthday('amy', 'amy', bday(10, 9)),
    withBirthday('lee', 'Lee', null),
    withBirthday('max', 'Max', bday(10, 1)),
  ]

  it('lists today through the next 14 days, soonest first, then by name', () => {
    expect(upcomingBirthdays(friends, TODAY).map((u) => [u.friend.name, u.daysUntil])).toEqual([
      ['Kim', 0],
      ['amy', 7],
      ['Zoe', 7],
      ['Alex', 14],
    ])
  })

  it('takes another window and keeps each birthday', () => {
    expect(upcomingBirthdays(friends, TODAY, 7).map((u) => u.friend.name)).toEqual(['Kim', 'amy', 'Zoe'])
    expect(upcomingBirthdays(friends, TODAY, 0)).toEqual([{ friend: friends[3], birthday: bday(10, 2, 1990), daysUntil: 0 }])
  })

  it('looks across the new year and counts Feb 29 on Feb 28', () => {
    expect(upcomingBirthdays([withBirthday('a', 'Alex', bday(1, 3))], '2026-12-25').map((u) => u.daysUntil)).toEqual([9])
    expect(upcomingBirthdays([withBirthday('a', 'Alex', bday(2, 29))], '2026-02-20').map((u) => u.daysUntil)).toEqual([8])
  })
})
