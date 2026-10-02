import { describe, expect, it } from 'vitest'
import { meetup, TODAY } from '../test/fixtures'
import { lastSeenByFriend } from './lastSeen'

describe('lastSeenByFriend', () => {
  it('returns the most recent past meetup date for each friend', () => {
    const result = lastSeenByFriend(
      [
        meetup('m1', '2026-03-01', ['alex']),
        meetup('m2', '2026-09-20', ['alex', 'sam']),
        meetup('m3', '2026-05-05', ['sam']),
      ],
      TODAY,
    )
    expect(result.get('alex')).toBe('2026-09-20')
    expect(result.get('sam')).toBe('2026-09-20')
  })

  it('counts a meetup dated today', () => {
    expect(lastSeenByFriend([meetup('m1', TODAY, ['alex'])], TODAY).get('alex')).toBe(TODAY)
  })

  it('ignores future meetups', () => {
    const result = lastSeenByFriend(
      [
        meetup('m1', '2026-08-01', ['alex']),
        meetup('m2', '2026-10-03', ['alex']),
        meetup('m3', '2026-12-25', ['sam']),
      ],
      TODAY,
    )
    expect(result.get('alex')).toBe('2026-08-01')
    expect(result.has('sam')).toBe(false)
  })

  it('is empty with no meetups', () => {
    expect(lastSeenByFriend([], TODAY).size).toBe(0)
  })
})
