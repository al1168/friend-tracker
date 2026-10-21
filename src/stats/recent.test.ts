import { describe, expect, it } from 'vitest'
import { friend, meetup, TODAY } from '../test/fixtures'
import { recentFriends } from './recent'

const friends = [friend('alex', 'Alex'), friend('bea', 'bea'), friend('cal', 'Cal'), friend('dee', 'Dee')]
const meetups = [
  meetup('m1', '2026-09-30', ['alex']),
  meetup('m2', '2026-06-01', ['cal']),
  meetup('m3', '2025-01-01', ['dee']),
]

describe('recentFriends', () => {
  it('lists recently seen friends first, then never-seen friends by name', () => {
    expect(recentFriends(friends, meetups, TODAY).map((f) => f.id)).toEqual(['alex', 'cal', 'dee', 'bea'])
  })

  it('lists every friend when no limit is given, however many there are', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => friend(`f${i + 1}`, `Friend ${String(i + 1).padStart(2, '0')}`))
    const seen = [meetup('m1', '2026-09-30', ['f12']), meetup('m2', '2026-09-01', ['f7'])]
    expect(recentFriends(twelve, seen, TODAY).map((f) => f.id)).toEqual([
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

  it('caps the list', () => {
    expect(recentFriends(friends, meetups, TODAY, 2).map((f) => f.id)).toEqual(['alex', 'cal'])
  })

  it('treats friends with only future meetups as never seen', () => {
    const result = recentFriends([friend('b', 'Bob'), friend('a', 'Ann')], [meetup('m1', '2026-12-01', ['b'])], TODAY)
    expect(result.map((f) => f.id)).toEqual(['a', 'b'])
  })
})
