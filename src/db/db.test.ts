import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { DEFAULT_MEETUP_TYPES } from './defaults'
import { updateFriend } from './friends'
import { addPreferences } from './preferences'
import { getSetting, setSetting } from './settings'
import type { Friend, Meetup } from '../types'

beforeEach(resetDatabase)

describe('upgrade from version 1', () => {
  it('gives existing friends empty likes and dislikes and changes nothing else', async () => {
    const v1Friend = {
      id: 'f1',
      name: 'Alex',
      groupId: 'g1',
      photo: null,
      notes: 'Moved to Austin',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const nullListsFriend = { ...v1Friend, id: 'f2', name: 'Sam', likes: null }
    // Build the database as version 1 of the app left it, under the app's own name.
    // (The next test's resetDatabase deletes it and reopens the app database fresh.)
    db.close()
    await Dexie.delete('friend-tracker')
    const v1 = new Dexie('friend-tracker')
    v1.version(1).stores({
      friends: 'id, groupId',
      groups: 'id',
      meetupTypes: 'id, order',
      meetups: 'id, date, typeId, *friendIds',
      settings: 'key',
    })
    try {
      await v1.table('friends').bulkAdd([v1Friend, nullListsFriend])
    } finally {
      v1.close()
    }

    await db.open()

    // (The reading hook adds `birthday: null`, which the upgrade doesn't store.)
    expect(await db.friends.get('f1')).toEqual({ ...v1Friend, likes: [], dislikes: [], birthday: null })
    expect(await db.friends.get('f2')).toEqual({ ...nullListsFriend, likes: [], dislikes: [], birthday: null })
    // Dexie stores the version times 10. Read it from the native database to prove the upgrades ran.
    expect(db.backendDB().version).toBe(30)
  })
})

describe('upgrade from version 2', () => {
  it('adds the meetup photos table, gives meetups empty activities and changes nothing else', async () => {
    const v2Stores = {
      friends: 'id, groupId',
      groups: 'id',
      meetupTypes: 'id, order',
      meetups: 'id, date, typeId, *friendIds',
      settings: 'key',
    }
    const v2Friend = {
      id: 'f1',
      name: 'Alex',
      groupId: null,
      photo: null,
      notes: '',
      likes: ['Sushi'],
      dislikes: [],
      birthday: { month: 3, day: 14, year: null },
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const v2Group = { id: 'g1', name: 'Work' }
    const v2Type = { id: 'type-custom', name: 'Hike', emoji: 'x', order: 7 }
    const v2Lock = { enabled: true, pin: null, passkeyId: null }
    const v2Reminders = { enabled: true, lastSyncedHash: 'abc', lastSyncedAt: '2026-10-01T00:00:00.000Z', lastError: null }
    const v2Meetup = {
      id: 'm1',
      date: '2026-09-01',
      typeId: 'type-coffee',
      friendIds: ['f1'],
      note: 'Tacos',
      createdAt: '2026-09-01T12:00:00.000Z',
    }
    // Build the database as version 2 of the app left it, under the app's own name.
    // (The next test's resetDatabase deletes it and reopens the app database fresh.)
    db.close()
    await Dexie.delete('friend-tracker')
    const v2 = new Dexie('friend-tracker')
    v2.version(2).stores(v2Stores)
    try {
      await v2.table('friends').add(v2Friend)
      await v2.table('meetups').add(v2Meetup)
      await v2.table('groups').add(v2Group)
      await v2.table('meetupTypes').add(v2Type)
      await v2.table('settings').put({ key: 'appLock', value: v2Lock })
      await v2.table('settings').put({ key: 'birthdayReminders', value: v2Reminders })
      await v2.table('settings').put({ key: 'lastBackupAt', value: '2026-10-02T10:00:00.000Z' })
    } finally {
      v2.close()
    }

    await db.open()

    // Dexie stores the version times 10. Read it from the native database to prove the upgrade ran.
    const native = db.backendDB()
    expect(native.version).toBe(30)
    expect([...native.objectStoreNames].sort()).toEqual([
      'friends',
      'groups',
      'meetupPhotos',
      'meetupTypes',
      'meetups',
      'settings',
    ])
    const photoIndexes = native.transaction('meetupPhotos').objectStore('meetupPhotos').indexNames
    expect([...photoIndexes].sort()).toEqual(['[meetupId+order]', 'meetupId'])
    const meetupIndexes = native.transaction('meetups').objectStore('meetups').indexNames
    expect([...meetupIndexes].sort()).toEqual(['date', 'friendIds', 'typeId'])
    expect(await db.meetupPhotos.count()).toBe(0)
    // The stored meetup is untouched; the reading hook gives it activities.
    expect(await db.meetups.get('m1')).toEqual({ ...v2Meetup, activities: [] })
    expect(await db.friends.get('f1')).toEqual(v2Friend)
    expect(await db.groups.get('g1')).toEqual(v2Group)
    expect(await db.meetupTypes.get('type-custom')).toEqual(v2Type)
    expect(await getSetting('lastBackupAt')).toBe('2026-10-02T10:00:00.000Z')
    expect(await getSetting('appLock')).toEqual(v2Lock)
    expect(await getSetting('birthdayReminders')).toEqual(v2Reminders)
  })
})

describe('meetups read from the database', () => {
  it('get empty activities when the stored record has none', async () => {
    await db.meetups.put({
      id: 'old',
      date: '2026-09-01',
      typeId: 'type-coffee',
      friendIds: ['alex'],
      note: '',
      createdAt: '2026-09-01T12:00:00.000Z',
    } as unknown as Meetup)
    expect(await db.meetups.get('old')).toMatchObject({ activities: [] })
    expect((await db.meetups.toArray())[0]).toMatchObject({ activities: [] })
    expect((await db.meetups.where('friendIds').equals('alex').toArray())[0]).toMatchObject({ activities: [] })
  })
})

describe('friends read from the database', () => {
  it('get empty lists when the stored record has none, and can be added to', async () => {
    await db.friends.put({
      id: 'old',
      name: 'Old',
      groupId: null,
      photo: null,
      notes: '',
      createdAt: '2026-01-01T00:00:00.000Z',
    } as unknown as Friend)
    expect(await db.friends.get('old')).toMatchObject({ likes: [], dislikes: [] })
    expect((await db.friends.toArray())[0]).toMatchObject({ likes: [], dislikes: [] })
    expect(await addPreferences('old', 'likes', 'Sushi')).toEqual({ added: ['Sushi'], skipped: [] })
    expect(await db.friends.get('old')).toMatchObject({ likes: ['Sushi'], dislikes: [] })
  })

  it('get no birthday when the stored record has none, and can be given one', async () => {
    await db.friends.put({
      id: 'old',
      name: 'Old',
      groupId: null,
      photo: null,
      notes: '',
      likes: [],
      dislikes: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    } as unknown as Friend)
    expect(await db.friends.get('old')).toMatchObject({ birthday: null })
    expect((await db.friends.toArray())[0]).toMatchObject({ birthday: null })
    await updateFriend('old', { name: 'Old', groupId: null, photo: null, notes: '', birthday: { month: 3, day: 14, year: null } })
    expect((await db.friends.get('old'))?.birthday).toEqual({ month: 3, day: 14, year: null })
  })
})

describe('database', () => {
  it('seeds the default meetup types in order', async () => {
    const types = await db.meetupTypes.orderBy('order').toArray()
    expect(types).toEqual(DEFAULT_MEETUP_TYPES)
    expect(types.map((t) => t.name)).toEqual(['Coffee', 'Meal', 'Drinks', 'Call', 'Activity', 'Party', 'Trip', 'Other'])
  })

  it('starts empty otherwise', async () => {
    expect(await db.friends.count()).toBe(0)
    expect(await db.groups.count()).toBe(0)
    expect(await db.meetups.count()).toBe(0)
    expect(await db.meetupPhotos.count()).toBe(0)
  })
})

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await getSetting('lastBackupAt')).toBeNull()
    expect(await getSetting('installHintDismissed')).toBe(false)
  })

  it('stores values', async () => {
    await setSetting('installHintDismissed', true)
    await setSetting('lastBackupAt', '2026-10-02T10:00:00.000Z')
    expect(await getSetting('installHintDismissed')).toBe(true)
    expect(await getSetting('lastBackupAt')).toBe('2026-10-02T10:00:00.000Z')
  })
})
