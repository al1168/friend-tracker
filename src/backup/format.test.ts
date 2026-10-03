import { describe, expect, it } from 'vitest'
import { friend, group, meetup, meetupType } from '../test/fixtures'
import { backupFileName, createBackup, parseBackup, type BackupData } from './format'

const sample: BackupData = {
  groups: [group('g1', 'College')],
  meetupTypes: [meetupType('t1', 'Coffee', 0, '☕')],
  friends: [friend('f1', 'Alex', 'g1'), { ...friend('f2', 'Sam'), photo: 'data:image/jpeg;base64,AAAA', notes: 'Likes jazz' }],
  meetups: [{ ...meetup('m1', '2026-09-01', ['f1', 'f2'], 't1'), note: 'Tacos' }],
}

function jsonCopy(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function broken(change: (file: Record<string, unknown>) => void): unknown {
  const file = jsonCopy(createBackup(sample, new Date('2026-10-02T09:00:00Z')))
  change(file)
  return file
}

function list(file: Record<string, unknown>, key: string): Record<string, unknown>[] {
  return file[key] as Record<string, unknown>[]
}

function expectError(raw: unknown, message: string) {
  const result = parseBackup(raw)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error).toContain(message)
}

describe('createBackup and parseBackup', () => {
  it('accepts a backup it created', () => {
    const file = createBackup(sample, new Date('2026-10-02T09:00:00Z'))
    expect(file).toMatchObject({ app: 'friend-tracker', version: 1, exportedAt: '2026-10-02T09:00:00.000Z' })
    expect(parseBackup(jsonCopy(file))).toEqual({ ok: true, data: sample })
  })

  it('drops fields it does not know about', () => {
    const file = broken((f) => {
      f.extra = true
      list(f, 'friends')[0].color = 'red'
    })
    expect(parseBackup(file)).toEqual({ ok: true, data: sample })
  })
})

describe('parseBackup cleanup', () => {
  it('dedupes repeated friend ids within a meetup', () => {
    const file = broken((f) => (list(f, 'meetups')[0].friendIds = ['f1', 'f1', 'f2']))
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.meetups[0].friendIds).toEqual(['f1', 'f2'])
  })
})

describe('parseBackup rejects bad files', () => {
  it('rejects things that are not backups', () => {
    expectError('hello', "This isn't a Friend Tracker backup file.")
    expectError(broken((f) => (f.app = 'other')), "This isn't a Friend Tracker backup file.")
  })

  it('rejects other versions', () => {
    expectError(broken((f) => (f.version = 2)), 'different version')
  })

  it('rejects missing lists', () => {
    expectError(broken((f) => delete f.meetups), 'missing its "meetups" list')
  })

  it('rejects a friend without a name', () => {
    expectError(broken((f) => (list(f, 'friends')[0].name = ' ')), 'Friend 1 has a missing or invalid "name"')
  })

  it('rejects an invalid photo', () => {
    expectError(broken((f) => (list(f, 'friends')[0].photo = 'https://example.com/a.jpg')), 'Friend 1 has an invalid photo')
  })

  it('rejects a bad date or an empty friend list', () => {
    expectError(broken((f) => (list(f, 'meetups')[0].date = '2026-02-30')), 'Meetup 1 has an invalid date')
    expectError(broken((f) => (list(f, 'meetups')[0].friendIds = [])), 'Meetup 1 has a missing or invalid "friendIds"')
  })

  it('rejects broken references', () => {
    expectError(broken((f) => (list(f, 'meetups')[0].friendIds = ['f1', 'ghost'])), "Meetup 1 includes a friend who isn't in the backup")
    expectError(broken((f) => (list(f, 'meetups')[0].typeId = 'nope')), "Meetup 1 has a type that isn't in the backup")
    expectError(broken((f) => (list(f, 'friends')[0].groupId = 'nope')), "Friend 1 belongs to a group that isn't in the backup")
  })

  it('rejects duplicate ids', () => {
    expectError(broken((f) => list(f, 'friends').push(list(f, 'friends')[0])), 'two friends with the same id')
  })

  it('rejects a backup with no meetup types', () => {
    expectError(
      broken((f) => {
        f.meetupTypes = []
        f.meetups = []
      }),
      'no meetup types',
    )
  })
})

describe('backupFileName', () => {
  it('includes the date', () => {
    expect(backupFileName('2026-10-02')).toBe('friend-tracker-backup-2026-10-02.json')
  })
})
