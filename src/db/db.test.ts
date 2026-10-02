import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { DEFAULT_MEETUP_TYPES } from './defaults'
import { getSetting, setSetting } from './settings'

beforeEach(resetDatabase)

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
