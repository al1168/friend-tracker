import { describe, expect, it } from 'vitest'
import { meetup, meetupType, TODAY } from '../test/fixtures'
import type { Meetup } from '../types'
import { SUGGEST_FROM_ALL, SUGGEST_FROM_FRIENDS, suggestMeetupType } from './suggestType'

const types = [meetupType('coffee', 'Coffee', 0), meetupType('meal', 'Meal', 1), meetupType('drinks', 'Drinks', 2)]

/** `count` meetups of one type with these friends, one a day going back from `newest` days before Oct 2. */
function run(prefix: string, count: number, friendIds: string[], typeId: string, newest = 1): Meetup[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(2026, 9, 2 - newest - i)).toISOString().slice(0, 10)
    return meetup(`${prefix}${i}`, date, friendIds, typeId)
  })
}

describe('suggestMeetupType', () => {
  it('looks at the picked friends’ last 10 meetups, then the owner’s last 30', () => {
    expect(SUGGEST_FROM_FRIENDS).toBe(10)
    expect(SUGGEST_FROM_ALL).toBe(30)
  })

  it('suggests the type most common among the meetups with any of the picked friends', () => {
    const meetups = [...run('a', 3, ['alex'], 'meal'), ...run('s', 2, ['sam'], 'drinks'), ...run('o', 9, ['other'], 'coffee')]
    expect(suggestMeetupType(meetups, ['alex'], types, TODAY)).toBe('meal')
    expect(suggestMeetupType(meetups, ['sam'], types, TODAY)).toBe('drinks')
    expect(suggestMeetupType(meetups, ['alex', 'sam'], types, TODAY)).toBe('meal')
  })

  it('counts only the last 10 meetups with them', () => {
    // The newest 10 with Alex: 6 coffees and 4 meals. Five more meals before them don't count.
    const meetups = [...run('c', 6, ['alex'], 'coffee', 1), ...run('m', 4, ['alex'], 'meal', 7), ...run('o', 5, ['alex'], 'meal', 11)]
    expect(suggestMeetupType(meetups, ['alex'], types, TODAY)).toBe('coffee')
  })

  it('falls back to the owner’s most-used type in their last 30 meetups', () => {
    // The newest 30: 16 drinks and 14 coffees. Twenty older coffees don't count.
    const meetups = [...run('d', 16, ['sam'], 'drinks', 1), ...run('c', 14, ['kim'], 'coffee', 17), ...run('o', 20, ['kim'], 'coffee', 31)]
    expect(suggestMeetupType(meetups, ['new-friend'], types, TODAY)).toBe('drinks')
    expect(suggestMeetupType(meetups, [], types, TODAY)).toBe('drinks')
  })

  it('falls back to the first type with no meetups, and to nothing with no types', () => {
    expect(suggestMeetupType([], ['alex'], types, TODAY)).toBe('coffee')
    expect(suggestMeetupType([], [], [], TODAY)).toBeNull()
  })

  it('breaks a tie with the type used most recently', () => {
    const meetups = [
      meetup('m1', '2026-09-10', ['alex'], 'meal'),
      meetup('c1', '2026-09-01', ['alex'], 'coffee'),
      meetup('c2', '2026-08-01', ['alex'], 'coffee'),
      meetup('m2', '2026-07-01', ['alex'], 'meal'),
    ]
    expect(suggestMeetupType(meetups, ['alex'], types, TODAY)).toBe('meal')
    // On the same day, the one logged later is the more recent.
    const sameDay = [
      { ...meetup('d1', '2026-09-10', ['alex'], 'drinks'), createdAt: '2026-09-10T20:00:00.000Z' },
      { ...meetup('c3', '2026-09-10', ['alex'], 'coffee'), createdAt: '2026-09-10T09:00:00.000Z' },
    ]
    expect(suggestMeetupType(sameDay, ['alex'], types, TODAY)).toBe('drinks')
  })

  it('ignores types that no longer exist, which take none of the 10', () => {
    // Alex's 10 newest are of a deleted type, so his one Meal before them decides (not the owner's Drinks).
    const meetups = [
      ...run('g', 10, ['alex'], 'deleted-type', 1),
      meetup('m1', '2026-01-01', ['alex'], 'meal'),
      ...run('d', 2, ['sam'], 'drinks', 20),
    ]
    expect(suggestMeetupType(meetups, ['alex'], types, TODAY)).toBe('meal')
    // Only deleted types with the friend: the owner's habits decide.
    expect(suggestMeetupType([...run('g', 3, ['alex'], 'deleted-type'), ...run('d', 2, ['sam'], 'drinks')], ['alex'], types, TODAY)).toBe(
      'drinks',
    )
  })

  it('ignores meetups that haven’t happened yet', () => {
    const meetups = [...run('t', 3, ['alex'], 'drinks', -10), meetup('m1', '2026-09-01', ['alex'], 'meal')]
    expect(suggestMeetupType(meetups, ['alex'], types, TODAY)).toBe('meal')
  })
})
