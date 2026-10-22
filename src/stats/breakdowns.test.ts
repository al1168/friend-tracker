import { describe, expect, it } from 'vitest'
import { friend, group, meetup, meetupType, TODAY } from '../test/fixtures'
import { friendsNotSeenInYear, groupBreakdown, NO_GROUP_KEY, topFriends, typeBreakdown } from './breakdowns'

const types = [meetupType('coffee', 'Coffee', 0, '☕'), meetupType('meal', 'Meal', 1, '🍽'), meetupType('call', 'Call', 2, '📞')]
const groups = [group('college', 'College'), group('work', 'Work')]
const friends = [
  friend('alex', 'Alex', 'college'),
  friend('sam', 'Sam', 'college'),
  friend('kim', 'Kim', 'work'),
  friend('lee', 'Lee'),
]

describe('typeBreakdown', () => {
  it('counts each meetup once by type, with the previous year alongside', () => {
    const rows = typeBreakdown(
      [
        meetup('m1', '2026-01-05', ['alex', 'sam'], 'meal'),
        meetup('m2', '2026-02-05', ['alex'], 'meal'),
        meetup('m3', '2026-03-05', ['alex'], 'coffee'),
        meetup('m4', '2025-03-05', ['alex'], 'call'),
        meetup('m5', '2025-04-05', ['alex'], 'coffee'),
      ],
      types,
      2026,
      TODAY,
    )
    expect(rows).toEqual([
      { key: 'meal', label: 'Meal', emoji: '🍽', count: 2, previousCount: 0 },
      { key: 'coffee', label: 'Coffee', emoji: '☕', count: 1, previousCount: 1 },
      { key: 'call', label: 'Call', emoji: '📞', count: 0, previousCount: 1 },
    ])
  })

  it('leaves out types unused in both years', () => {
    expect(typeBreakdown([], types, 2026, TODAY)).toEqual([])
  })
})

describe('groupBreakdown', () => {
  it('counts a meetup once per group, even with two friends from that group', () => {
    const rows = groupBreakdown(
      [
        meetup('m1', '2026-01-05', ['alex', 'sam']),
        meetup('m2', '2026-02-05', ['alex', 'kim']),
        meetup('m3', '2026-03-05', ['lee']),
        meetup('m4', '2025-03-05', ['kim']),
      ],
      friends,
      groups,
      2026,
      TODAY,
    )
    expect(rows).toEqual([
      { key: 'college', label: 'College', emoji: null, count: 2, previousCount: 0 },
      { key: 'work', label: 'Work', emoji: null, count: 1, previousCount: 1 },
      { key: NO_GROUP_KEY, label: 'No group', emoji: null, count: 1, previousCount: 0 },
    ])
  })

  it('puts friends whose group was deleted under No group', () => {
    const rows = groupBreakdown(
      [meetup('m1', '2026-01-05', ['zed'])],
      [friend('zed', 'Zed', 'deleted-group')],
      groups,
      2026,
      TODAY,
    )
    expect(rows).toEqual([{ key: NO_GROUP_KEY, label: 'No group', emoji: null, count: 1, previousCount: 0 }])
  })

  it('ignores friends that no longer exist', () => {
    expect(groupBreakdown([meetup('m1', '2026-01-05', ['ghost'])], friends, groups, 2026, TODAY)).toEqual([])
  })
})

describe('topFriends', () => {
  it('ranks friends by meetups this year, ties by name, with last year alongside', () => {
    const rows = topFriends(
      [
        meetup('m1', '2026-01-05', ['sam', 'alex']),
        meetup('m2', '2026-02-05', ['kim']),
        meetup('m3', '2026-03-05', ['kim']),
        meetup('m4', '2025-03-05', ['alex']),
      ],
      friends,
      2026,
      TODAY,
    )
    expect(rows.map((row) => [row.friend.id, row.count, row.previousCount])).toEqual([
      ['kim', 2, 0],
      ['alex', 1, 1],
      ['sam', 1, 0],
    ])
  })

  it('respects the limit and leaves out friends not seen this year', () => {
    const rows = topFriends(
      [meetup('m1', '2026-01-05', ['alex']), meetup('m2', '2026-01-06', ['sam'])],
      friends,
      2026,
      TODAY,
      1,
    )
    expect(rows.map((row) => row.friend.id)).toEqual(['alex'])
  })
})

describe('friendsNotSeenInYear', () => {
  it('lists friends with no past meetups in the year, by name', () => {
    const result = friendsNotSeenInYear(
      [meetup('m1', '2026-01-05', ['alex']), meetup('m2', '2026-12-01', ['kim'])],
      friends,
      2026,
      TODAY,
    )
    expect(result.map((f) => f.id)).toEqual(['kim', 'lee', 'sam'])
  })

  it('leaves out friends added after the year, read on the phone’s calendar', () => {
    const later = { ...friend('new', 'New'), createdAt: '2026-03-01T12:00:00.000Z' }
    // 9 PM on Dec 31, 2025 in Los Angeles, already Jan 1 in UTC.
    const lastNight = { ...friend('eve', 'Eve'), createdAt: '2026-01-01T05:00:00.000Z' }
    const unknown = { ...friend('odd', 'Odd'), createdAt: 'not a date' }
    const result = friendsNotSeenInYear([], [later, lastNight, unknown], 2025, TODAY)
    expect(result.map((f) => f.id)).toEqual(['eve', 'odd'])
  })
})
