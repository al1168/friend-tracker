import { describe, expect, it } from 'vitest'
import { friend, meetup, TODAY } from '../test/fixtures'
import type { Friend, Meetup } from '../types'
import { friendsToPick, OFTEN_DAYS, TOGETHER_DAYS } from './friendsToPick'

// TODAY is Fri, Oct 2, 2026. The last 90 days start on Jul 5; the last 12 months on Oct 3, 2025.

const ids = (friends: Friend[]) => friends.map((f) => f.id)
const people = (...names: string[]) => names.map((name) => friend(name.toLowerCase(), name))

describe('friendsToPick', () => {
  it('looks back 90 days for how often, and 12 months for who you see together', () => {
    expect(OFTEN_DAYS).toBe(90)
    expect(TOGETHER_DAYS).toBe(365)
  })

  it('puts the friends you met most in the last 90 days first, then the most recently seen, then the rest by name', () => {
    const friends = people('Ann', 'Bo', 'Cy', 'Di', 'Ed', 'al')
    const meetups = [
      meetup('m1', '2026-09-01', ['bo']),
      meetup('m2', '2026-08-15', ['bo']),
      meetup('m3', '2026-07-10', ['bo']),
      meetup('m4', '2026-10-01', ['ann']),
      meetup('m5', '2026-09-20', ['cy']),
      // Seen, but not in the last 90 days: after everyone met lately, before anyone never seen.
      meetup('m6', '2025-12-01', ['di']),
    ]
    expect(ids(friendsToPick(friends, meetups, TODAY))).toEqual(['bo', 'ann', 'cy', 'di', 'al', 'ed'])
  })

  it('counts a meetup 89 days ago as within the 90 days, and one 90 days ago as not', () => {
    const friends = people('Pat', 'Quin', 'Rae')
    const meetups = [
      meetup('p1', '2026-07-05', ['pat']),
      meetup('p2', '2026-09-01', ['pat']),
      meetup('q1', '2026-09-30', ['quin']),
      meetup('r1', '2026-07-04', ['rae']),
      meetup('r2', '2026-09-01', ['rae']),
    ]
    // Pat: 2 lately. Quin: 1, on Sep 30. Rae: 1 lately (Jul 4 is too long ago), on Sep 1.
    expect(ids(friendsToPick(friends, meetups, TODAY))).toEqual(['pat', 'quin', 'rae'])
  })

  it('breaks a tie of counts and dates by name', () => {
    const friends = people('Zoe', 'amy')
    const meetups = [meetup('m1', '2026-09-01', ['zoe', 'amy'])]
    expect(ids(friendsToPick(friends, meetups, TODAY))).toEqual(['amy', 'zoe'])
  })

  it('treats friends with only future meetups as never seen', () => {
    const friends = people('Bob', 'Ann')
    expect(ids(friendsToPick(friends, [meetup('m1', '2026-12-01', ['bob'])], TODAY))).toEqual(['ann', 'bob'])
  })

  it('lists every friend, however many there are', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => friend(`f${i + 1}`, `Friend ${String(i + 1).padStart(2, '0')}`))
    const seen = [meetup('m1', '2026-09-30', ['f12']), meetup('m2', '2026-09-01', ['f7'])]
    expect(ids(friendsToPick(twelve, seen, TODAY))).toEqual([
      'f12',
      'f7',
      'f1',
      'f2',
      'f3',
      'f4',
      'f5',
      'f6',
      'f8',
      'f9',
      'f10',
      'f11',
    ])
  })

  describe('opened from a friend’s page', () => {
    const friends = people('Alex', 'Bo', 'Cy', 'Di', 'Ed', 'Fay')
    const meetups: Meetup[] = [
      // With Alex in the last 12 months: Bo twice, Cy once lately, Di once earlier.
      meetup('a1', '2026-06-01', ['alex', 'bo']),
      meetup('a2', '2026-03-01', ['bo', 'alex']),
      meetup('a3', '2026-09-01', ['alex', 'cy']),
      meetup('a4', '2025-11-01', ['alex', 'di']),
      // With Alex, but 12 months ago or more: not counted together.
      meetup('a5', '2025-10-02', ['alex', 'ed']),
      meetup('a6', '2025-06-01', ['alex', 'ed']),
      // Fay is seen most of all, never with Alex.
      meetup('f1', '2026-09-28', ['fay']),
      meetup('f2', '2026-09-20', ['fay']),
      meetup('f3', '2026-09-10', ['fay']),
      // Planned with Alex: not seen together yet.
      meetup('u1', '2026-12-01', ['alex', 'fay']),
    ]

    it('puts the friends most often seen with them first, then the most recent together, then everyone else', () => {
      // Everyone else, in the general order: Fay (3 lately), Alex (1 lately), Ed (seen longest ago).
      expect(ids(friendsToPick(friends, meetups, TODAY, 'alex'))).toEqual(['bo', 'cy', 'di', 'fay', 'alex', 'ed'])
    })

    it('keeps the general order without a friend, or for a friend seen with no one', () => {
      expect(ids(friendsToPick(friends, meetups, TODAY))).toEqual(['fay', 'alex', 'cy', 'bo', 'di', 'ed'])
      expect(ids(friendsToPick(friends, meetups, TODAY, 'nobody'))).toEqual(ids(friendsToPick(friends, meetups, TODAY)))
    })

    it('keeps the general order between companions seen together as often and as recently', () => {
      // Di and Ed were each with Alex once, on the same day; Ed is seen more in general, so Ed comes first.
      const together = meetup('t1', '2026-09-01', ['alex', 'ed', 'di'])
      const order = ids(friendsToPick(friends, [together, meetup('e1', '2026-09-15', ['ed'])], TODAY, 'alex'))
      expect(order.slice(0, 2)).toEqual(['ed', 'di'])
    })
  })
})
