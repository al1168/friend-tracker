import type { Friend } from '../types'
import { firstName } from './text'

// Who paid is a plain fact on one place, in your words: never totaled, counted or compared (the No Ledger Rule).
// The "Who paid?" chips name a friend by shortName (src/lib/text.ts); this only puts a face beside a paid line.

type Named = Pick<Friend, 'name'>

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
