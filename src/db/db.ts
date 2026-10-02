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

// Runs once, when the database is first created on this device.
db.on('populate', (tx) => {
  tx.table('meetupTypes').bulkAdd(DEFAULT_MEETUP_TYPES)
})

/** Test helper: delete the database and recreate it (re-running the seed). */
export async function resetDatabase(): Promise<void> {
  await db.delete()
  await db.open()
}
