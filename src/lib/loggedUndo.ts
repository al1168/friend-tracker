// The day page's "Logged" note offers Undo until the first change on the page. A change ends it for good: when the
// app lock or a reload brings the page back with its `logged` state, the note shows again but its Undo doesn't, so
// one tap can never take away a day that was written. Kept for this tab's session: in memory, and in sessionStorage
// when it can be used (a reload empties memory).

const KEY = 'friend-tracker:logged-undo-spent'
/** The most kept: only a day page just opened by "Save and write about the day" asks. */
const KEPT = 20
const spent = new Set<string>()

function readStored(): string[] {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

/** Whether a change on this meetup's day page has already ended its "Logged" note's Undo. */
export function loggedUndoSpent(meetupId: string): boolean {
  return spent.has(meetupId) || readStored().includes(meetupId)
}

/** Ends the "Logged" note's Undo for this meetup, for the rest of the session. */
export function spendLoggedUndo(meetupId: string): void {
  if (spent.has(meetupId)) return
  spent.add(meetupId)
  try {
    const ids = [...readStored().filter((id) => id !== meetupId), meetupId].slice(-KEPT)
    sessionStorage.setItem(KEY, JSON.stringify(ids))
  } catch {
    // Memory alone still covers the app lock.
  }
}
