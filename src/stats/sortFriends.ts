import { yearOf, type ISODate } from '../lib/dates'
import { compareNames } from '../lib/text'
import type { Friend, Meetup } from '../types'
import { countsByFriendForYear } from './counts'
import { lastSeenByFriend } from './lastSeen'

export type FriendSort = 'lastSeen' | 'name' | 'mostThisYear'

export const FRIEND_SORT_LABELS: Record<FriendSort, string> = {
  lastSeen: 'Longest since last seen',
  name: 'Name',
  mostThisYear: 'Most seen this year',
}

const byName = (a: Friend, b: Friend) => compareNames(a.name, b.name)

/** Returns a new sorted array. Ties are always broken by name. */
export function sortFriends(friends: Friend[], meetups: Meetup[], sort: FriendSort, today: ISODate): Friend[] {
  const list = [...friends]
  if (sort === 'name') return list.sort(byName)

  if (sort === 'mostThisYear') {
    const counts = countsByFriendForYear(meetups, yearOf(today), today)
    return list.sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || byName(a, b))
  }

  const lastSeen = lastSeenByFriend(meetups, today)
  return list.sort((a, b) => {
    const seenA = lastSeen.get(a.id)
    const seenB = lastSeen.get(b.id)
    if (seenA === undefined && seenB === undefined) return byName(a, b)
    if (seenA === undefined) return -1
    if (seenB === undefined) return 1
    if (seenA !== seenB) return seenA < seenB ? -1 : 1
    return byName(a, b)
  })
}
