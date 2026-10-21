import { addDays, type ISODate } from '../lib/dates'
import { compareNames } from '../lib/text'
import type { Friend, Meetup } from '../types'
import { lastSeenByFriend } from './lastSeen'

/** "How often you meet" counts the meetups of the 90 days ending today. */
export const OFTEN_DAYS = 90
/** From a friend's page, "seen together" counts the meetups of the 12 months (365 days) ending today. */
export const TOGETHER_DAYS = 365

/** How many meetups a friend was at, and the latest of them. */
interface Tally {
  count: number
  last: ISODate
}

/** Each friend's tally over the meetups given. */
function tallyByFriend(meetups: Meetup[], skip?: string): Map<string, Tally> {
  const tallies = new Map<string, Tally>()
  for (const meetup of meetups) {
    for (const friendId of meetup.friendIds) {
      if (friendId === skip) continue
      const tally = tallies.get(friendId)
      if (!tally) tallies.set(friendId, { count: 1, last: meetup.date })
      else {
        tally.count += 1
        if (meetup.date > tally.last) tally.last = meetup.date
      }
    }
  }
  return tallies
}

/**
 * Every friend, in the order the meetup sheet's Who shows them: the friends you met most in the last 90 days first,
 * then by their most recent meetup, then never-seen friends by name. Only meetups dated today or earlier count.
 *
 * With `presetFriendId` (the sheet opened from that friend's page), the friends most often seen together with them in
 * the last 12 months come first (more meetups together first, then the most recent together), then everyone else in
 * the order above, the preset friend included.
 */
export function friendsToPick(
  friends: Friend[],
  meetups: Meetup[],
  today: ISODate,
  presetFriendId?: string | null,
): Friend[] {
  const past = meetups.filter((meetup) => meetup.date <= today)
  const lastSeen = lastSeenByFriend(past, today)
  const oftenFrom = addDays(today, -(OFTEN_DAYS - 1))
  const often = tallyByFriend(past.filter((meetup) => meetup.date >= oftenFrom))
  const ordered = [...friends].sort((a, b) => {
    const seenA = lastSeen.get(a.id)
    const seenB = lastSeen.get(b.id)
    if (seenA === undefined || seenB === undefined) {
      if (seenA !== seenB) return seenA === undefined ? 1 : -1
      return compareNames(a.name, b.name)
    }
    const byCount = (often.get(b.id)?.count ?? 0) - (often.get(a.id)?.count ?? 0)
    if (byCount !== 0) return byCount
    if (seenA !== seenB) return seenA > seenB ? -1 : 1
    return compareNames(a.name, b.name)
  })
  if (!presetFriendId) return ordered

  const togetherFrom = addDays(today, -(TOGETHER_DAYS - 1))
  const together = tallyByFriend(
    past.filter((meetup) => meetup.date >= togetherFrom && meetup.friendIds.includes(presetFriendId)),
    presetFriendId,
  )
  // A stable sort, so companions seen together as often and as recently keep the order above.
  const companions = ordered
    .filter((friend) => together.has(friend.id))
    .sort((a, b) => {
      const withA = together.get(a.id)!
      const withB = together.get(b.id)!
      if (withA.count !== withB.count) return withB.count - withA.count
      if (withA.last !== withB.last) return withA.last > withB.last ? -1 : 1
      return 0
    })
  return [...companions, ...ordered.filter((friend) => !together.has(friend.id))]
}
