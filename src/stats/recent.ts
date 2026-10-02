import type { ISODate } from '../lib/dates'
import { compareNames } from '../lib/text'
import type { Friend, Meetup } from '../types'
import { lastSeenByFriend } from './lastSeen'

/** Friends for one-tap picking: most recently seen first, then never-seen friends by name. */
export function recentFriends(friends: Friend[], meetups: Meetup[], today: ISODate, limit = 8): Friend[] {
  const lastSeen = lastSeenByFriend(meetups, today)
  const seen = friends
    .filter((friend) => lastSeen.has(friend.id))
    .sort((a, b) => {
      const seenA = lastSeen.get(a.id)!
      const seenB = lastSeen.get(b.id)!
      if (seenA !== seenB) return seenA > seenB ? -1 : 1
      return compareNames(a.name, b.name)
    })
  const neverSeen = friends.filter((friend) => !lastSeen.has(friend.id)).sort((a, b) => compareNames(a.name, b.name))
  return [...seen, ...neverSeen].slice(0, limit)
}
