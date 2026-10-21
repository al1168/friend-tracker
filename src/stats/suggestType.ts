import type { ISODate } from '../lib/dates'
import type { Meetup, MeetupType } from '../types'
import { newestFirst } from './history'

/** How many of the picked friends' latest meetups the suggestion looks at. */
export const SUGGEST_FROM_FRIENDS = 10
/** How many of the owner's latest meetups it looks at when the picked friends have none. */
export const SUGGEST_FROM_ALL = 30

/** The most common type among meetups listed newest first; a tie goes to the type used most recently. */
function mostCommonType(meetups: Meetup[]): string | null {
  // A Map keeps the order types were first met in, newest first, so a strict "more" keeps the newer on a tie.
  const counts = new Map<string, number>()
  for (const meetup of meetups) counts.set(meetup.typeId, (counts.get(meetup.typeId) ?? 0) + 1)
  let best: string | null = null
  for (const [typeId, count] of counts) {
    if (best === null || count > counts.get(best)!) best = typeId
  }
  return best
}

/**
 * The type a new meetup starts on until the owner taps one: the most common among the last 10 meetups with any of
 * the picked friends; with none, the owner's most-used type across their last 30 meetups; with none, the first type.
 * "Last" is newest first (by date, then when it was logged), counting only meetups dated today or earlier whose
 * type still exists. A tie goes to the type used most recently. Null only when there are no types at all.
 */
export function suggestMeetupType(
  meetups: Meetup[],
  friendIds: readonly string[],
  types: readonly MeetupType[],
  today: ISODate,
): string | null {
  const known = new Set(types.map((type) => type.id))
  const history = meetups.filter((meetup) => meetup.date <= today && known.has(meetup.typeId)).sort(newestFirst)
  const picked = new Set(friendIds)
  const withFriends = history.filter((meetup) => meetup.friendIds.some((id) => picked.has(id)))
  return (
    mostCommonType(withFriends.slice(0, SUGGEST_FROM_FRIENDS)) ??
    mostCommonType(history.slice(0, SUGGEST_FROM_ALL)) ??
    types[0]?.id ??
    null
  )
}
