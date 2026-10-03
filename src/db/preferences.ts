import { cleanItem, indexOfItem, MAX_ITEM_LENGTH, MAX_ITEMS, otherKind, splitItems, type PreferenceKind } from '../lib/preferences'
import type { Friend } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

type Lists = Pick<Friend, PreferenceKind>

export interface AddResult {
  added: string[]
  /** Typed items that were already in the list. */
  skipped: string[]
}

export const LIST_FULL = 'This list is full.'
export const ITEM_TOO_LONG = `Keep each one under ${MAX_ITEM_LENGTH} characters.`

/**
 * Runs `change` on copies of a friend's lists, then saves them, all in one transaction.
 * If `change` throws, nothing is saved.
 */
async function changeLists<T>(friendId: string, change: (lists: Lists) => T): Promise<T> {
  return db.transaction('rw', db.friends, async () => {
    const friend = await db.friends.get(friendId)
    if (!friend) throw new ValidationError('This friend no longer exists.')
    const lists: Lists = { likes: [...friend.likes], dislikes: [...friend.dislikes] }
    const result = change(lists)
    await db.friends.update(friendId, lists)
    return result
  })
}

/** Adds typed text ("sushi, hiking") to a list. Items in the other list move here, keeping the new spelling. */
export async function addPreferences(friendId: string, kind: PreferenceKind, text: string): Promise<AddResult> {
  const items = splitItems(text)
  if (items.some((item) => item.length > MAX_ITEM_LENGTH)) {
    throw new ValidationError(ITEM_TOO_LONG)
  }
  return changeLists(friendId, (lists) => {
    const list = lists[kind]
    const other = lists[otherKind(kind)]
    const result: AddResult = { added: [], skipped: [] }
    for (const item of items) {
      if (indexOfItem(list, item) !== -1) {
        result.skipped.push(item)
        continue
      }
      const elsewhere = indexOfItem(other, item)
      if (elsewhere !== -1) other.splice(elsewhere, 1)
      list.push(item)
      result.added.push(item)
    }
    if (list.length > MAX_ITEMS) throw new ValidationError(LIST_FULL)
    return result
  })
}

/** Removes an item (matched ignoring case). Returns where it was, for Undo, or -1 if it wasn't there. */
export async function removePreference(friendId: string, kind: PreferenceKind, item: string): Promise<number> {
  return changeLists(friendId, (lists) => {
    const index = indexOfItem(lists[kind], item)
    if (index !== -1) lists[kind].splice(index, 1)
    return index
  })
}

/**
 * Undo for `removePreference`: puts the item back at `index` (clamped to the list), unless it's
 * already in this list. If it has been added to the other list since, it moves back.
 */
export async function restorePreference(
  friendId: string,
  kind: PreferenceKind,
  item: string,
  index: number,
): Promise<void> {
  const cleaned = cleanItem(item)
  if (cleaned === '') return
  await changeLists(friendId, (lists) => {
    const list = lists[kind]
    if (indexOfItem(list, cleaned) !== -1) return
    if (list.length >= MAX_ITEMS) throw new ValidationError(LIST_FULL)
    const other = lists[otherKind(kind)]
    const elsewhere = indexOfItem(other, cleaned)
    if (elsewhere !== -1) other.splice(elsewhere, 1)
    list.splice(Math.min(Math.max(index, 0), list.length), 0, cleaned)
  })
}

/** Moves an item from one list to the end of the other. */
export async function movePreference(friendId: string, from: PreferenceKind, item: string): Promise<void> {
  await changeLists(friendId, (lists) => {
    const source = lists[from]
    const target = lists[otherKind(from)]
    const index = indexOfItem(source, item)
    if (index === -1) return
    const [moved] = source.splice(index, 1)
    if (indexOfItem(target, moved) !== -1) return
    if (target.length >= MAX_ITEMS) throw new ValidationError(LIST_FULL)
    target.push(moved)
  })
}
