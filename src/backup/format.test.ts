import { describe, expect, it } from 'vitest'
import { friend, group, meetup, meetupType } from '../test/fixtures'
import { backupFileName, createBackup, parseBackup, type BackupData } from './format'

const sample: BackupData = {
  groups: [group('g1', 'College')],
  meetupTypes: [meetupType('t1', 'Coffee', 0, '☕')],
  friends: [
    friend('f1', 'Alex', 'g1'),
    {
      ...friend('f2', 'Sam'),
      photo: 'data:image/jpeg;base64,AAAA',
      notes: 'Likes jazz',
      likes: ['Jazz', 'Board games'],
      dislikes: ['Early mornings'],
      birthday: { month: 3, day: 14, year: 1996 },
    },
  ],
  meetups: [{ ...meetup('m1', '2026-09-01', ['f1', 'f2'], 't1'), note: 'Tacos' }],
  meetupPhotos: [],
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
    expect(file).toMatchObject({ app: 'friend-tracker', version: 3, exportedAt: '2026-10-02T09:00:00.000Z' })
    expect(parseBackup(jsonCopy(file))).toEqual({ ok: true, data: sample })
  })

  it('drops fields it does not know about', () => {
    const file = broken((f) => {
      f.extra = true
      list(f, 'friends')[0].color = 'red'
      ;(list(f, 'friends')[1].birthday as Record<string, unknown>).sign = 'Pisces'
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

  it('cleans likes and dislikes, quietly dropping empties and repeats', () => {
    const file = broken((f) => {
      list(f, 'friends')[1].likes = [' Jazz ', 'jazz', '', 'Board \n games']
      list(f, 'friends')[1].dislikes = ['JAZZ', 'Early mornings', 'early mornings']
    })
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.friends[1].likes).toEqual(['Jazz', 'Board games'])
      expect(result.data.friends[1].dislikes).toEqual(['Early mornings'])
    }
  })
})

describe('parseBackup reads version 1 backups', () => {
  it('gives every friend empty likes and dislikes and no birthday', () => {
    const file = broken((f) => {
      f.version = 1
      for (const friend of list(f, 'friends')) {
        delete friend.likes
        delete friend.dislikes
        delete friend.birthday
      }
    })
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.friends.map((f) => [f.likes, f.dislikes, f.birthday])).toEqual([
        [[], [], null],
        [[], [], null],
      ])
      expect(result.data.friends[1]).toMatchObject({ name: 'Sam', notes: 'Likes jazz' })
    }
  })
})

describe('parseBackup reads version 2 backups', () => {
  it('keeps likes and dislikes and gives every friend no birthday', () => {
    // Version 2 had no birthdays, so one in a version 2 file is ignored.
    const file = broken((f) => (f.version = 2))
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.friends.map((f) => f.birthday)).toEqual([null, null])
      expect(result.data.friends[1]).toMatchObject({ likes: ['Jazz', 'Board games'], dislikes: ['Early mornings'] })
    }
  })
})

describe('parseBackup rejects bad files', () => {
  it('rejects things that are not backups', () => {
    expectError('hello', "This isn't a Friend Tracker backup file.")
    expectError(broken((f) => (f.app = 'other')), "This isn't a Friend Tracker backup file.")
  })

  it('rejects other versions', () => {
    expectError(broken((f) => (f.version = 4)), 'This backup was made by a different version of Friend Tracker.')
    expectError(broken((f) => (f.version = '3')), 'This backup was made by a different version of Friend Tracker.')
  })

  it('rejects a missing or invalid birthday', () => {
    const invalid = [
      'March 14',
      { month: 2, day: 30, year: null },
      { month: 2, day: 29, year: 2023 },
      { month: 3, day: 14 },
      { month: 3, day: 14, year: 1899 },
      { month: '3', day: 14, year: null },
    ]
    for (const birthday of invalid) {
      expectError(broken((f) => (list(f, 'friends')[1].birthday = birthday)), 'Friend 2 has an invalid birthday.')
    }
    expectError(broken((f) => delete list(f, 'friends')[0].birthday), 'Friend 1 has an invalid birthday.')
  })

  it('allows a birthday up to 2 days after the day it is read, and refuses later ones', () => {
    const on = (day: number) => broken((f) => (list(f, 'friends')[1].birthday = { month: 10, day, year: 2026 }))
    expect(parseBackup(on(4), '2026-10-02').ok).toBe(true)
    expect(parseBackup(on(5), '2026-10-02')).toEqual({ ok: false, error: 'Friend 2 has an invalid birthday.' })
  })

  it('keeps a birthday without a year', () => {
    const file = broken((f) => (list(f, 'friends')[1].birthday = { month: 2, day: 29, year: null }))
    const result = parseBackup(file, '2026-10-02')
    expect(result.ok && result.data.friends[1].birthday).toEqual({ month: 2, day: 29, year: null })
  })

  it('rejects a missing or malformed list', () => {
    expectError(broken((f) => delete list(f, 'friends')[0].likes), 'Friend 1 has an invalid "likes" list.')
    expectError(broken((f) => (list(f, 'friends')[1].dislikes = 'Mornings')), 'Friend 2 has an invalid "dislikes" list.')
    expectError(broken((f) => (list(f, 'friends')[1].likes = ['Jazz', 7])), 'Friend 2 has an invalid "likes" list.')
  })

  it('rejects an item over 60 characters or a list over 50 items', () => {
    expectError(broken((f) => (list(f, 'friends')[1].likes = ['x'.repeat(61)])), 'Friend 2 has an invalid "likes" list.')
    const tooMany = Array.from({ length: 51 }, (_, i) => `Item ${i + 1}`)
    expectError(broken((f) => (list(f, 'friends')[0].dislikes = tooMany)), 'Friend 1 has an invalid "dislikes" list.')
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
