import { describe, expect, it } from 'vitest'
import { friend, meetup, TODAY } from '../test/fixtures'
import { sortFriends } from './sortFriends'

const friends = [friend('alex', 'Alex'), friend('bea', 'bea'), friend('cal', 'Cal'), friend('dee', 'Dee')]
const meetups = [
  meetup('m1', '2026-09-30', ['alex']),
  meetup('m2', '2026-05-01', ['cal']),
  meetup('m3', '2026-06-01', ['cal']),
  meetup('m4', '2025-01-01', ['dee']),
]

describe('sortFriends', () => {
  it('sorts by longest since last seen, never-seen first', () => {
    expect(sortFriends(friends, meetups, 'lastSeen', TODAY).map((f) => f.id)).toEqual(['bea', 'dee', 'cal', 'alex'])
  })

  it('breaks last-seen ties by name', () => {
    const tied = [friend('zed', 'Zed'), friend('amy', 'Amy')]
    const result = sortFriends(tied, [meetup('m1', '2026-01-01', ['zed', 'amy'])], 'lastSeen', TODAY)
    expect(result.map((f) => f.id)).toEqual(['amy', 'zed'])
  })

  it('sorts by name ignoring case', () => {
    expect(sortFriends(friends, meetups, 'name', TODAY).map((f) => f.name)).toEqual(['Alex', 'bea', 'Cal', 'Dee'])
  })

  it('sorts by most seen this year', () => {
    expect(sortFriends(friends, meetups, 'mostThisYear', TODAY).map((f) => f.id)).toEqual(['cal', 'alex', 'bea', 'dee'])
  })

  it('does not modify the input array', () => {
    const copy = [...friends]
    sortFriends(friends, meetups, 'name', TODAY)
    expect(friends).toEqual(copy)
  })
})
