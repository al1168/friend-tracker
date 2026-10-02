import type { ISODate } from '../lib/dates'
import type { Meetup } from '../types'

/** friendId → date of their most recent meetup on or before today. */
export function lastSeenByFriend(meetups: Meetup[], today: ISODate): Map<string, ISODate> {
  const result = new Map<string, ISODate>()
  for (const meetup of meetups) {
    if (meetup.date > today) continue
    for (const friendId of meetup.friendIds) {
      const current = result.get(friendId)
      if (current === undefined || meetup.date > current) result.set(friendId, meetup.date)
    }
  }
  return result
}
