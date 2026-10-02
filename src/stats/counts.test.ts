import { describe, expect, it } from 'vitest'
import { meetup, TODAY } from '../test/fixtures'
import { allTimeCountsByFriend, countsByFriendForYear, monthlyCounts, totalsForYear } from './counts'

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
