import Dexie, { type EntityTable } from 'dexie'
import type { Friend, Group, Meetup, MeetupType } from '../types'
import { DEFAULT_MEETUP_TYPES } from './defaults'

export interface SettingRow {
  key: string
  value: unknown
}

export type FriendTrackerDB = Dexie & {
  friends: EntityTable<Friend, 'id'>
  groups: EntityTable<Group, 'id'>
  meetupTypes: EntityTable<MeetupType, 'id'>
  meetups: EntityTable<Meetup, 'id'>
  settings: EntityTable<SettingRow, 'key'>
}

export const db = new Dexie('friend-tracker') as FriendTrackerDB

db.version(1).stores({
  friends: 'id, groupId',
  groups: 'id',
  meetupTypes: 'id, order',
  meetups: 'id, date, typeId, *friendIds',
  settings: 'key',
})

// Version 2 gives every friend likes and dislikes lists. Same stores, no new indexes.
db.version(2)
  .stores({
    friends: 'id, groupId',
    groups: 'id',
    meetupTypes: 'id, order',
    meetups: 'id, date, typeId, *friendIds',
    settings: 'key',
  })
  .upgrade((tx) =>
    tx
      .table('friends')
      .toCollection()
      .modify((friend: Partial<Friend>) => {
        friend.likes ??= []
        friend.dislikes ??= []
      }),
  )

// The upgrade above runs once, but older code that is still running (a second tab, or a
// rollback) can write friends without lists later. Fill them in on every read.
// Birthdays came without a version bump (no index changed), so friends saved before them
// get "no birthday" here too.
// (Dexie also calls this with undefined when `get` finds nothing, so guard for that.)
db.friends.hook('reading', (friend) => {
  if (friend) {
    friend.likes ??= []
    friend.dislikes ??= []
    friend.birthday ??= null
  }
  return friend
})

// Runs once, when the database is first created on this device.
db.on('populate', (tx) => {
  return tx.table('meetupTypes').bulkAdd(DEFAULT_MEETUP_TYPES)
})

/** Test helper: delete the database and recreate it (re-running the seed). */
export async function resetDatabase(): Promise<void> {
  await db.delete()
  await db.open()
}
