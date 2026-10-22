import Dexie, { type EntityTable, type Table } from 'dexie'
import { isMood } from '../lib/moods'
import { cleanWeather } from '../lib/weather'
import type { Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'
import { DEFAULT_MEETUP_TYPES } from './defaults'

export interface SettingRow {
  key: string
  value: unknown
}

/** The tables a backup holds, and a restore replaces. */
export type DataTable = 'friends' | 'groups' | 'meetupTypes' | 'meetups' | 'meetupPhotos'

/** One row of what the app held just before a backup was restored, so the restore can be undone. */
export interface RestoreUndoRow {
  table: DataTable
  id: string
  row: unknown
}

export type FriendTrackerDB = Dexie & {
  friends: EntityTable<Friend, 'id'>
  groups: EntityTable<Group, 'id'>
  meetupTypes: EntityTable<MeetupType, 'id'>
  meetups: EntityTable<Meetup, 'id'>
  meetupPhotos: EntityTable<MeetupPhoto, 'id'>
  settings: EntityTable<SettingRow, 'key'>
  restoreUndo: Table<RestoreUndoRow, [DataTable, string]>
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

// Version 3 adds the meetup photos table. Photos never live inside meetups, so everything that
// loads every meetup (stats, history, last seen) stays light. `[meetupId+order]` finds a meetup's
// first photo without reading the others. No other store changes, so there is no upgrade step:
// meetups get their activities from the reading hook below.
// (The service worker opens this database too, so nothing here may touch window or document.)
db.version(3).stores({
  friends: 'id, groupId',
  groups: 'id',
  meetupTypes: 'id, order',
  meetups: 'id, date, typeId, *friendIds',
  settings: 'key',
  meetupPhotos: 'id, meetupId, [meetupId+order]',
})

// Version 4 adds restoreUndo: what the app held just before a backup was restored, kept 7 days so the restore can
// be undone (src/backup/storage.ts). Rows are { table, id, row }, keyed by [table+id]. Never read by backups or lists.
// No other store changes, so there is no upgrade step. Older code that is still running (the service worker until it
// updates, a second tab) opens this version too: Dexie 4 opens a database newer than it declares (tested).
db.version(4).stores({
  friends: 'id, groupId',
  groups: 'id',
  meetupTypes: 'id, order',
  meetups: 'id, date, typeId, *friendIds',
  settings: 'key',
  meetupPhotos: 'id, meetupId, [meetupId+order]',
  restoreUndo: '[table+id]',
})

// The version 2 upgrade runs once, but older code that is still running (a second tab, or a
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

// Meetups saved before activities existed have none. The day's fields came without a version bump
// (no index changed), so older meetups get empty ones here, and anything that isn't a known weather
// or mood (from older code in a second tab, or a rollback) reads as none.
db.meetups.hook('reading', (meetup) => {
  if (meetup) {
    meetup.activities ??= []
    meetup.weather = cleanWeather(meetup.weather)
    if (!isMood(meetup.mood)) meetup.mood = null
    if (typeof meetup.feelings !== 'string') meetup.feelings = ''
  }
  return meetup
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
