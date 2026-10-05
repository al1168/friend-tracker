import type { Friend } from '../types'

// Who paid is a plain fact on one place, in your words: never totaled, counted or compared (the No Ledger Rule).
// These only put names on the "Who paid?" chips and a face beside a paid line.

type Named = Pick<Friend, 'name'>

function firstName(friend: Named): string {
  return friend.name.trim().split(/\s+/)[0]
}

/** How the "Who paid?" row names a friend on the meetup: the first name, or the full name when two of them share it. */
export function payerLabel(friend: Named, people: readonly Named[]): string {
  const first = firstName(friend).toLowerCase()
  const sharing = people.filter((other) => firstName(other).toLowerCase() === first).length
  return sharing > 1 ? friend.name.trim() : firstName(friend)
}

/**
 * The friend a paid line names, when its words match exactly one friend on the meetup (their first or full name,
 * ignoring case). Null for a shared bill, "I paid", or a name that matches no one or more than one: the face is
 * only decoration, so a rename just loses it.
 */
export function paidBy<T extends Named>(who: string | null, people: readonly T[]): T | null {
  if (who === null) return null
  const name = who.trim().toLowerCase()
  const matches = people.filter(
    (friend) => friend.name.trim().toLowerCase() === name || firstName(friend).toLowerCase() === name,
  )
  return matches.length === 1 ? matches[0] : null
}
