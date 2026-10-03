import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { DEFAULT_MEETUP_TYPES } from './defaults'
import { addPreferences } from './preferences'
import { getSetting, setSetting } from './settings'
import type { Friend } from '../types'

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

    expect(await db.friends.get('f1')).toEqual({ ...v1Friend, likes: [], dislikes: [] })
    expect(await db.friends.get('f2')).toEqual({ ...nullListsFriend, likes: [], dislikes: [] })
    // Dexie stores the version times 10. Read it from the native database to prove the upgrade ran.
    expect(db.backendDB().version).toBe(20)
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
