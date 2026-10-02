import { newId } from '../lib/ids'
import type { Friend } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

export interface FriendInput {
  name: string
  groupId: string | null
  photo: string | null
  notes: string
}

function clean(input: FriendInput): FriendInput {
  const name = input.name.trim()
  if (!name) throw new ValidationError('Please enter a name.')
  return { name, groupId: input.groupId, photo: input.photo, notes: input.notes.trim() }
}

export async function addFriend(input: FriendInput): Promise<Friend> {
  const friend: Friend = { id: newId(), ...clean(input), createdAt: new Date().toISOString() }
  await db.friends.add(friend)
  return friend
}

export async function updateFriend(id: string, input: FriendInput): Promise<void> {
  await db.friends.update(id, clean(input))
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
