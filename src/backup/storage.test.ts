import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from '../db/db'
import { addFriend } from '../db/friends'
import { getSetting, setSetting } from '../db/settings'
import { addGroup } from '../db/groups'
import { addMeetup, firstPhotoThumb } from '../db/meetups'
import { addPreferences } from '../db/preferences'
import type { AppLock, LockFailures } from '../lock/types'
import type { BirthdayReminders } from '../reminders/types'
import { OWNER_DAY_TYPED, OWNER_FEELINGS } from '../test/dayFixtures'
import { friend, meetup, meetupPhoto, meetupType } from '../test/fixtures'
import { createBackup, type BackupData } from './format'
import { parseBackupFile, readAllData, readAllPhotos, replaceAllData } from './storage'

beforeEach(resetDatabase)

function sortById(data: BackupData): BackupData {
  const byId = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id))
  return {
    friends: byId(data.friends),
    groups: byId(data.groups),
    meetupTypes: byId(data.meetupTypes),
    meetups: byId(data.meetups),
    meetupPhotos: byId(data.meetupPhotos),
  }
}

describe('backup storage', () => {
  it('round-trips everything through a backup file', async () => {
    const college = await addGroup('College')
    const alex = await addFriend({
      name: 'Alex',
      groupId: college.id,
      photo: 'data:image/jpeg;base64,AAAA',
      notes: 'Hi',
      birthday: { month: 3, day: 14, year: 1996 },
    })
    const sam = await addFriend({ name: 'Sam', groupId: null, photo: null, notes: '', birthday: null })
    await addPreferences(alex.id, 'likes', 'Sushi, Board games')
    await addPreferences(alex.id, 'dislikes', 'Early mornings')
    const tacos = await addMeetup(
      {
        date: '2026-09-01',
        typeId: 'type-meal',
        friendIds: [alex.id, sam.id],
        activities: ['Karaoke', 'Walk'],
      },
      {
        add: [
          { id: 'p1', full: 'data:image/jpeg;base64,FULL1', thumb: 'data:image/jpeg;base64,THUMB1', width: 4, height: 3 },
          { id: 'p2', full: 'data:image/jpeg;base64,FULL2', thumb: 'data:image/jpeg;base64,THUMB2', width: 3, height: 4 },
        ],
        removeIds: [],
        order: ['p2', 'p1'],
      },
    )
    const before = await readAllData()
    expect(before.meetupPhotos).toHaveLength(2)
    const text = JSON.stringify(createBackup(before, new Date()))

    await resetDatabase()
    await addFriend({ name: 'Someone else', groupId: null, photo: null, notes: '', birthday: null })
    const parsed = await parseBackupFile(new Blob([text], { type: 'application/json' }))
    if (!parsed.ok) throw new Error(parsed.error)
    await replaceAllData(parsed.data)

    expect(sortById(await readAllData())).toEqual(sortById(before))
    expect(await db.friends.get(alex.id)).toMatchObject({
      likes: ['Sushi', 'Board games'],
      dislikes: ['Early mornings'],
      birthday: { month: 3, day: 14, year: 1996 },
    })
    expect((await db.friends.get(sam.id))?.birthday).toBeNull()
    expect((await db.meetups.get(tacos.id))?.activities).toEqual(['Karaoke', 'Walk'])
    const photos = await db.meetupPhotos.where('meetupId').equals(tacos.id).sortBy('order')
    expect(photos.map((photo) => photo.id)).toEqual(['p2', 'p1'])
  })

  it('keeps the lock settings, which a backup never carries', async () => {
    const appLock: AppLock = {
      enabled: true,
      pin: { hash: 'aGFzaA==', salt: 'c2FsdA==', iterations: 600_000 },
      passkeyId: 'credential-id',
    }
    const appLockFailures: LockFailures = { count: 5, lockedUntil: 1_800_000_000_000 }
    await setSetting('appLock', appLock)
    await setSetting('appLockFailures', appLockFailures)

    await replaceAllData({ friends: [friend('f1', 'Alex')], groups: [], meetupTypes: [], meetups: [], meetupPhotos: [] })

    expect(await getSetting('appLock')).toEqual(appLock)
    expect(await getSetting('appLockFailures')).toEqual(appLockFailures)
  })

  it('keeps the reminder settings, which a backup never carries', async () => {
    const birthdayReminders: BirthdayReminders = {
      enabled: true,
      lastSyncedHash: 'hash',
      lastSyncedAt: '2026-10-03T12:00:00.000Z',
      lastError: null,
    }
    await setSetting('birthdayReminders', birthdayReminders)

    const file = createBackup(await readAllData(), new Date('2026-10-03T12:00:00.000Z'))
    expect(JSON.stringify(file)).not.toContain('birthdayReminders')
    await replaceAllData({ friends: [friend('f1', 'Alex')], groups: [], meetupTypes: [], meetups: [], meetupPhotos: [] })

    expect(await getSetting('birthdayReminders')).toEqual(birthdayReminders)
  })

  it('reports a file that is not JSON', async () => {
    expect(await parseBackupFile(new Blob(['not json']))).toEqual({
      ok: false,
      error: "This file couldn't be read. Pick a .json backup file.",
    })
  })

  it('replaces and reads meetup photos with everything else', async () => {
    await db.meetupPhotos.add(meetupPhoto('old', 'gone', 0))
    const data: BackupData = {
      friends: [friend('f1', 'Alex')],
      groups: [],
      meetupTypes: [meetupType('t1', 'Coffee', 0)],
      meetups: [meetup('m1', '2026-09-01', ['f1'], 't1')],
      meetupPhotos: [meetupPhoto('p1', 'm1', 0), meetupPhoto('p2', 'm1', 1)],
    }
    await replaceAllData(data)
    expect(sortById(await readAllData())).toEqual(sortById(data))
    expect((await readAllPhotos()).map((photo) => photo.id).sort()).toEqual(['p1', 'p2'])
  })

  it('forgets the thumbnails it kept, so a restored photo shows its own', async () => {
    await db.meetupPhotos.add(meetupPhoto('p1', 'm1', 0))
    expect(await firstPhotoThumb('m1')).toBe('data:image/jpeg;base64,THUMBp1')
    const restored = { ...meetupPhoto('p1', 'm1', 0), thumb: 'data:image/jpeg;base64,RESTORED' }
    await replaceAllData({
      friends: [friend('f1', 'Alex')],
      groups: [],
      meetupTypes: [meetupType('t1', 'Coffee', 0)],
      meetups: [meetup('m1', '2026-09-01', ['f1'], 't1')],
      meetupPhotos: [restored],
    })
    expect(await firstPhotoThumb('m1')).toBe('data:image/jpeg;base64,RESTORED')
  })

  it('keeps the day’s note, weather, mood and feelings through replace and read', async () => {
    const data: BackupData = {
      friends: [friend('f1', 'Alex')],
      groups: [],
      meetupTypes: [meetupType('t1', 'Coffee', 0)],
      meetups: [
        {
          ...meetup('m1', '2026-10-03', ['f1'], 't1'),
          note: OWNER_DAY_TYPED,
          weather: ['rainy', 'windy'],
          mood: 'okay',
          feelings: OWNER_FEELINGS,
        },
        meetup('m2', '2026-10-04', ['f1'], 't1'),
      ],
      meetupPhotos: [],
    }
    await replaceAllData(data)
    expect(sortById(await readAllData())).toEqual(sortById(data))
  })

  it('leaves existing data untouched if writing fails', async () => {
    const alex = await addFriend({ name: 'Alex', groupId: null, photo: null, notes: '', birthday: null })
    await db.meetupPhotos.add(meetupPhoto('p1', 'm1', 0))
    const bad: BackupData = {
      friends: [friend('x', 'X'), friend('x', 'X again')],
      groups: [],
      meetupTypes: [meetupType('t', 'T', 0)],
      meetups: [],
      meetupPhotos: [],
    }
    await expect(replaceAllData(bad)).rejects.toThrow()
    expect((await db.friends.toArray()).map((f) => f.id)).toEqual([alex.id])
    expect((await db.meetupPhotos.toArray()).map((p) => p.id)).toEqual(['p1'])
  })
})
