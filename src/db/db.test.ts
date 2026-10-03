import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { DEFAULT_MEETUP_TYPES } from './defaults'
import { getSetting, setSetting } from './settings'

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
      await v1.table('friends').add(v1Friend)
    } finally {
      v1.close()
    }

    await db.open()

    expect(await db.friends.get('f1')).toEqual({ ...v1Friend, likes: [], dislikes: [] })
    expect(db.verno).toBe(2)
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
