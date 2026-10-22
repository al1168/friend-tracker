import { describe, expect, it } from 'vitest'
import { meetup, TODAY } from '../test/fixtures'
import {
  allTimeCountsByFriend,
  countsByFriendByDateLastYear,
  countsByFriendForYear,
  firstYear,
  monthlyCounts,
  sameDateLastYear,
  totalsByDateLastYear,
  totalsForYear,
} from './counts'

const meetups = [
  meetup('m1', '2025-12-31', ['alex']),
  meetup('m2', '2026-01-01', ['alex', 'sam']),
  meetup('m3', '2026-06-15', ['alex']),
  meetup('m4', '2026-11-01', ['alex']), // future: ignored everywhere
]

describe('countsByFriendForYear', () => {
  it('counts meetups per friend inside the calendar year', () => {
    const counts = countsByFriendForYear(meetups, 2026, TODAY)
    expect(counts.get('alex')).toBe(2)
    expect(counts.get('sam')).toBe(1)
  })

  it('puts Dec 31 in the earlier year', () => {
    const counts = countsByFriendForYear(meetups, 2025, TODAY)
    expect(counts.get('alex')).toBe(1)
    expect(counts.has('sam')).toBe(false)
  })
})

describe('duplicate friend ids', () => {
  it('counts a meetup once for a friend listed twice', () => {
    expect(countsByFriendForYear([meetup('m1', '2026-02-01', ['alex', 'alex'])], 2026, TODAY).get('alex')).toBe(1)
  })
})

describe('allTimeCountsByFriend', () => {
  it('counts every past meetup', () => {
    const counts = allTimeCountsByFriend(meetups, TODAY)
    expect(counts.get('alex')).toBe(3)
    expect(counts.get('sam')).toBe(1)
  })
})

describe('monthlyCounts', () => {
  it('counts meetups per month for one friend, including leap day', () => {
    const counts = monthlyCounts(
      'alex',
      [
        meetup('m1', '2024-01-10', ['alex']),
        meetup('m2', '2024-02-29', ['alex', 'sam']),
        meetup('m3', '2024-02-03', ['alex']),
        meetup('m4', '2024-12-31', ['sam']),
        meetup('m5', '2023-02-01', ['alex']),
      ],
      2024,
      TODAY,
    )
    expect(counts).toEqual([1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('skips future meetups', () => {
    expect(monthlyCounts('alex', [meetup('m1', '2026-10-20', ['alex'])], 2026, TODAY)[9]).toBe(0)
  })
})

describe('totalsForYear', () => {
  it('counts a group meetup once and friends distinctly', () => {
    const totals = totalsForYear(
      [
        meetup('m1', '2026-02-01', ['alex', 'sam']),
        meetup('m2', '2026-03-01', ['alex']),
        meetup('m3', '2025-03-01', ['kim']),
      ],
      2026,
      TODAY,
    )
    expect(totals).toEqual({ meetups: 2, friends: 2 })
  })

  it('is zero for an empty year', () => {
    expect(totalsForYear([], 2026, TODAY)).toEqual({ meetups: 0, friends: 0 })
  })
})

describe('sameDateLastYear', () => {
  it('gives the same month and day a year earlier', () => {
    expect(sameDateLastYear('2026-10-22')).toBe('2025-10-22')
    expect(sameDateLastYear('2026-01-01')).toBe('2025-01-01')
    expect(sameDateLastYear('2026-12-31')).toBe('2025-12-31')
    expect(sameDateLastYear('2028-03-01')).toBe('2027-03-01')
  })

  it('makes Feb 29 into Feb 28, since the year before a leap year has none', () => {
    expect(sameDateLastYear('2028-02-29')).toBe('2027-02-28')
  })
})

describe('totalsByDateLastYear', () => {
  const lastYear = [
    meetup('jan1', '2025-01-01', ['alex', 'sam']),
    meetup('same', '2025-10-22', ['alex', 'alex']),
    meetup('next', '2025-10-23', ['kim']),
    meetup('dec31', '2025-12-31', ['kim']),
    meetup('before', '2024-12-31', ['lee']),
    meetup('this', '2026-03-01', ['lee']),
  ]

  it('counts last year from Jan 1 up to and including the same date, each meetup once and friends distinctly', () => {
    expect(totalsByDateLastYear(lastYear, '2026-10-22')).toEqual({ meetups: 2, friends: 2, through: '2025-10-22' })
  })

  it('counts up to Feb 28 on Feb 29', () => {
    const meetups = [meetup('feb28', '2027-02-28', ['alex']), meetup('mar1', '2027-03-01', ['sam'])]
    expect(totalsByDateLastYear(meetups, '2028-02-29')).toEqual({ meetups: 1, friends: 1, through: '2027-02-28' })
  })

  it('counts only Jan 1 on Jan 1', () => {
    const meetups = [meetup('jan1', '2025-01-01', ['alex']), meetup('jan2', '2025-01-02', ['sam'])]
    expect(totalsByDateLastYear(meetups, '2026-01-01')).toEqual({ meetups: 1, friends: 1, through: '2025-01-01' })
  })

  it('is zero with nothing last year', () => {
    expect(totalsByDateLastYear([], '2026-10-22')).toEqual({ meetups: 0, friends: 0, through: '2025-10-22' })
  })
})

describe('countsByFriendByDateLastYear', () => {
  it('counts each friend’s meetups last year up to the same date, a friend listed twice once', () => {
    const counts = countsByFriendByDateLastYear(
      [
        meetup('m1', '2025-03-03', ['alex', 'alex']),
        meetup('m2', '2025-10-22', ['alex', 'sam']),
        meetup('m3', '2025-11-05', ['alex']),
        meetup('m4', '2026-01-05', ['alex']),
      ],
      '2026-10-22',
    )
    expect(counts.get('alex')).toBe(2)
    expect(counts.get('sam')).toBe(1)
  })
})

describe('firstYear', () => {
  it('is this year with no meetups', () => {
    expect(firstYear([], '2026-10-22')).toBe(2026)
  })

  it('is the earliest meetup’s year', () => {
    expect(firstYear([meetup('a', '2026-01-05', ['alex']), meetup('b', '2024-06-01', ['sam'])], '2026-10-22')).toBe(2024)
  })

  it('is this year when every meetup is later', () => {
    expect(firstYear([meetup('a', '2027-01-05', ['alex'])], '2026-10-22')).toBe(2026)
  })
})
