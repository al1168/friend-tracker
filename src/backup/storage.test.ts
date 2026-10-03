import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from '../db/db'
import { addFriend } from '../db/friends'
import { getSetting, setSetting } from '../db/settings'
import { addGroup } from '../db/groups'
import { addMeetup } from '../db/meetups'
import { addPreferences } from '../db/preferences'
import type { AppLock, LockFailures } from '../lock/types'
import { friend, meetupType } from '../test/fixtures'
import { createBackup, type BackupData } from './format'
import { parseBackupFile, readAllData, replaceAllData } from './storage'

beforeEach(resetDatabase)

function sortById(data: BackupData): BackupData {
  const byId = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id))
  return {
    friends: byId(data.friends),
    groups: byId(data.groups),
    meetupTypes: byId(data.meetupTypes),
    meetups: byId(data.meetups),
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
    await addMeetup({ date: '2026-09-01', typeId: 'type-meal', friendIds: [alex.id, sam.id], note: 'Tacos' })
    const before = await readAllData()
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

    await replaceAllData({ friends: [friend('f1', 'Alex')], groups: [], meetupTypes: [], meetups: [] })

    expect(await getSetting('appLock')).toEqual(appLock)
    expect(await getSetting('appLockFailures')).toEqual(appLockFailures)
  })

  it('reports a file that is not JSON', async () => {
    expect(await parseBackupFile(new Blob(['not json']))).toEqual({
      ok: false,
      error: "This file couldn't be read. Pick a .json backup file.",
    })
  })

  it('leaves existing data untouched if writing fails', async () => {
    const alex = await addFriend({ name: 'Alex', groupId: null, photo: null, notes: '', birthday: null })
    const bad: BackupData = {
      friends: [friend('x', 'X'), friend('x', 'X again')],
      groups: [],
      meetupTypes: [meetupType('t', 'T', 0)],
      meetups: [],
    }
    await expect(replaceAllData(bad)).rejects.toThrow()
    expect((await db.friends.toArray()).map((f) => f.id)).toEqual([alex.id])
  })
})
