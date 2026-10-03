import { isValidBirthday } from '../lib/birthdays'
import { todayISO } from '../lib/dates'
import { newId } from '../lib/ids'
import type { Birthday, Friend } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

export interface FriendInput {
  name: string
  groupId: string | null
  photo: string | null
  notes: string
  birthday: Birthday | null
}

function clean(input: FriendInput): FriendInput {
  const name = input.name.trim()
  if (!name) throw new ValidationError('Please enter a name.')
  const { birthday } = input
  if (birthday !== null && !isValidBirthday(birthday, todayISO())) throw new ValidationError('Pick a valid birthday.')
  return {
    name,
    groupId: input.groupId,
    photo: input.photo,
    notes: input.notes.trim(),
    // Only the three fields are stored.
    birthday: birthday && { month: birthday.month, day: birthday.day, year: birthday.year },
  }
}

export async function addFriend(input: FriendInput): Promise<Friend> {
  const friend: Friend = { id: newId(), ...clean(input), likes: [], dislikes: [], createdAt: new Date().toISOString() }
  await db.friends.add(friend)
  return friend
}

/** Updates the fields the friend sheet edits. Likes and dislikes are left alone. */
export async function updateFriend(id: string, input: FriendInput): Promise<void> {
  const { name, groupId, photo, notes, birthday } = clean(input)
  await db.transaction('rw', db.friends, async () => {
    if (!(await db.friends.get(id))) throw new ValidationError('This friend no longer exists.')
    await db.friends.update(id, { name, groupId, photo, notes, birthday })
  })
}

/** Deletes a friend, removes them from meetups, and deletes meetups left with nobody. */
export async function deleteFriend(id: string): Promise<void> {
  await db.transaction('rw', db.friends, db.meetups, async () => {
    const affected = await db.meetups.where('friendIds').equals(id).toArray()
    for (const meetup of affected) {
      const remaining = meetup.friendIds.filter((friendId) => friendId !== id)
      if (remaining.length === 0) await db.meetups.delete(meetup.id)
      else await db.meetups.update(meetup.id, { friendIds: remaining })
    }
    await db.friends.delete(id)
  })
}
