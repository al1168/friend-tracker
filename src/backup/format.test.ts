import { describe, expect, it } from 'vitest'
import { MAX_FULL_LENGTH, MAX_THUMB_LENGTH } from '../lib/photos'
import { OWNER_DAY_TYPED, OWNER_FEELINGS } from '../test/dayFixtures'
import { friend, group, meetup, meetupPhoto, meetupType } from '../test/fixtures'
import type { Meetup } from '../types'
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
  meetups: [
    { ...meetup('m1', '2026-09-01', ['f1', 'f2'], 't1'), note: 'Tacos', activities: ['Karaoke', 'Board games'] },
    meetup('m2', '2026-09-08', ['f1'], 't1'),
  ],
  meetupPhotos: [meetupPhoto('p1', 'm1', 0), meetupPhoto('p2', 'm1', 1)],
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
    expect(file).toMatchObject({ app: 'friend-tracker', version: 5, exportedAt: '2026-10-02T09:00:00.000Z' })
    expect(parseBackup(jsonCopy(file))).toEqual({ ok: true, data: sample })
  })

  it('drops fields it does not know about', () => {
    const file = broken((f) => {
      f.extra = true
      list(f, 'friends')[0].color = 'red'
      ;(list(f, 'friends')[1].birthday as Record<string, unknown>).sign = 'Pisces'
      list(f, 'meetupPhotos')[0].caption = 'Hi'
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

  it('cleans activities, quietly dropping empties and repeats', () => {
    const file = broken((f) => (list(f, 'meetups')[0].activities = [' Karaoke ', 'karaoke', '', 'Board \n games']))
    const result = parseBackup(file)
    expect(result.ok && result.data.meetups[0].activities).toEqual(['Karaoke', 'Board games'])
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
      expect(result.data.meetups.map((m) => m.activities)).toEqual([[], []])
      expect(result.data.meetups.map((m) => [m.weather, m.mood, m.feelings])).toEqual([
        [[], null, ''],
        [[], null, ''],
      ])
      expect(result.data.meetupPhotos).toEqual([])
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
      expect(result.data.meetups.map((m) => m.activities)).toEqual([[], []])
      expect(result.data.meetups.map((m) => [m.weather, m.mood, m.feelings])).toEqual([
        [[], null, ''],
        [[], null, ''],
      ])
      expect(result.data.meetupPhotos).toEqual([])
    }
  })
})

describe('parseBackup reads version 3 backups', () => {
  it('keeps birthdays and gives every meetup no activities and no photos', () => {
    // Version 3 had no activities or photos, so any in a version 3 file are ignored.
    const file = broken((f) => (f.version = 3))
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.friends[1].birthday).toEqual({ month: 3, day: 14, year: 1996 })
      expect(result.data.meetups.map((m) => m.activities)).toEqual([[], []])
      expect(result.data.meetups.map((m) => [m.weather, m.mood, m.feelings])).toEqual([
        [[], null, ''],
        [[], null, ''],
      ])
      expect(result.data.meetupPhotos).toEqual([])
    }
    const withoutLists = broken((f) => {
      f.version = 3
      delete f.meetupPhotos
      for (const meetup of list(f, 'meetups')) delete meetup.activities
    })
    expect(parseBackup(withoutLists).ok).toBe(true)
  })
})

describe('parseBackup reads version 4 backups', () => {
  it('keeps activities, photos and the note byte for byte, and gives every meetup an empty day', () => {
    // Version 4 had no weather, mood or feelings, so any in a version 4 file are ignored.
    const note = 'Tacos\r\nThen karaoke  '
    const file = broken((f) => {
      f.version = 4
      list(f, 'meetups')[0].note = note
      list(f, 'meetups')[0].mood = 'okay'
      delete list(f, 'meetups')[1].weather
      delete list(f, 'meetups')[1].mood
      delete list(f, 'meetups')[1].feelings
    })
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.meetups[0]).toMatchObject({
        note,
        activities: ['Karaoke', 'Board games'],
        weather: [],
        mood: null,
        feelings: '',
      })
      expect(result.data.meetups[1]).toMatchObject({ weather: [], mood: null, feelings: '' })
      expect(result.data.meetupPhotos).toEqual(sample.meetupPhotos)
    }
  })
})

describe('parseBackup reads version 5 backups', () => {
  const ownersDay: Meetup = {
    ...meetup('m3', '2026-10-03', ['f1', 'f2'], 't1'),
    note: OWNER_DAY_TYPED,
    activities: ['Movie', 'Shopping'],
    weather: ['rainy'],
    mood: 'okay',
    feelings: OWNER_FEELINGS,
  }
  const withDay: BackupData = {
    ...sample,
    meetups: [...sample.meetups, ownersDay],
    meetupPhotos: [...sample.meetupPhotos, meetupPhoto('p3', 'm3', 0)],
  }

  it('keeps the owner’s day, its weather, mood and feelings, and every activity and photo', () => {
    const file = jsonCopy(createBackup(withDay, new Date('2026-10-04T05:00:00Z')))
    expect(file.version).toBe(5)
    const result = parseBackup(file)
    expect(result).toEqual({ ok: true, data: withDay })
    if (result.ok) {
      expect(result.data.meetups[2].note).toBe(OWNER_DAY_TYPED)
      expect(result.data.meetups[2].activities).toEqual(['Movie', 'Shopping'])
      expect(result.data.meetups[1].mood).toBeNull()
      expect(result.data.meetupPhotos.map((photo) => photo.id)).toEqual(['p1', 'p2', 'p3'])
    }
  })

  it('drops repeated weather quietly and puts it in chip order', () => {
    const file = broken((f) => (list(f, 'meetups')[0].weather = ['windy', 'rainy', 'windy']))
    const result = parseBackup(file)
    expect(result.ok && result.data.meetups[0].weather).toEqual(['rainy', 'windy'])
  })

  it('keeps a note of any length exactly', () => {
    const note = 'Walked.\r\n'.repeat(5_000)
    const result = parseBackup(broken((f) => (list(f, 'meetups')[0].note = note)))
    expect(result.ok && result.data.meetups[0].note).toBe(note)
  })
})

describe('parseBackup rejects bad files', () => {
  it('rejects things that are not backups', () => {
    expectError('hello', "This isn't a Friend Tracker backup file.")
    expectError(broken((f) => (f.app = 'other')), "This isn't a Friend Tracker backup file.")
  })

  it('rejects other versions', () => {
    expectError(broken((f) => (f.version = 6)), 'This backup was made by a different version of Friend Tracker.')
    expectError(broken((f) => (f.version = '5')), 'This backup was made by a different version of Friend Tracker.')
    expectError(broken((f) => (f.version = 0)), 'This backup was made by a different version of Friend Tracker.')
  })

  it('rejects a missing or invalid activities list', () => {
    const message = 'Meetup 1 has an invalid "activities" list.'
    expectError(broken((f) => delete list(f, 'meetups')[0].activities), message)
    expectError(broken((f) => (list(f, 'meetups')[0].activities = 'Karaoke')), message)
    expectError(broken((f) => (list(f, 'meetups')[0].activities = ['Karaoke', 7])), message)
    expectError(broken((f) => (list(f, 'meetups')[0].activities = ['x'.repeat(61)])), message)
    const tooMany = Array.from({ length: 21 }, (_, i) => `Activity ${i + 1}`)
    expectError(
      broken((f) => (list(f, 'meetups')[1].activities = tooMany)),
      'Meetup 2 has an invalid "activities" list.',
    )
  })

  it('rejects a version 5 meetup with an invalid weather list, mood or feelings', () => {
    const meetupTwo = (change: (meetup: Record<string, unknown>) => void) => broken((f) => change(list(f, 'meetups')[1]))
    for (const weather of ['rainy', ['fog'], ['rainy', 3], null]) {
      expectError(meetupTwo((m) => (m.weather = weather)), 'Meetup 2 has an invalid "weather" list.')
    }
    expectError(meetupTwo((m) => delete m.weather), 'Meetup 2 has an invalid "weather" list.')
    for (const mood of ['Good', 'amazing', 3, '']) {
      expectError(meetupTwo((m) => (m.mood = mood)), 'Meetup 2 has an invalid "mood".')
    }
    expectError(meetupTwo((m) => delete m.mood), 'Meetup 2 has an invalid "mood".')
    for (const feelings of ['x'.repeat(4_001), 3, null]) {
      expectError(meetupTwo((m) => (m.feelings = feelings)), 'Meetup 2 has a missing or invalid "feelings".')
    }
    expectError(meetupTwo((m) => delete m.feelings), 'Meetup 2 has a missing or invalid "feelings".')
    expect(parseBackup(meetupTwo((m) => (m.feelings = 'x'.repeat(4_000)))).ok).toBe(true)
  })

  it('rejects an invalid photo', () => {
    const jpeg = 'data:image/jpeg;base64,'
    const changes: ((photo: Record<string, unknown>) => void)[] = [
      (p) => delete p.id,
      (p) => (p.id = ' '),
      (p) => delete p.meetupId,
      (p) => (p.order = -1),
      (p) => (p.order = 1.5),
      (p) => (p.full = 'https://example.com/a.jpg'),
      (p) => (p.full = 'data:image/gif;base64,AAAA'),
      (p) => (p.full = `${jpeg}${'A'.repeat(MAX_FULL_LENGTH)}`),
      (p) => (p.thumb = `${jpeg}${'A'.repeat(MAX_THUMB_LENGTH)}`),
      (p) => (p.thumb = null),
      (p) => (p.width = 0),
      (p) => (p.height = '3'),
      (p) => delete p.createdAt,
    ]
    for (const change of changes) {
      expectError(broken((f) => change(list(f, 'meetupPhotos')[1])), 'Photo 2 is invalid.')
    }
    expectError(broken((f) => ((f.meetupPhotos as unknown[])[0] = 'photo.jpg')), 'Photo 1 is invalid.')
  })

  it('accepts a PNG photo', () => {
    const file = broken((f) => (list(f, 'meetupPhotos')[0].full = 'data:image/png;base64,AAAA'))
    expect(parseBackup(file).ok).toBe(true)
  })

  it('rejects a photo of a meetup that is not in the backup, or a 21st photo', () => {
    expectError(broken((f) => (list(f, 'meetupPhotos')[1].meetupId = 'ghost')), 'Photo 2 is invalid.')
    // Meetup 2 has no photos yet: its 21st is the file's 23rd photo.
    const twentyOne = Array.from({ length: 21 }, (_, i) => ({ ...meetupPhoto(`x${i}`, 'm2', i) }))
    expectError(broken((f) => list(f, 'meetupPhotos').push(...twentyOne)), 'Photo 23 is invalid.')
    const twenty = twentyOne.slice(0, 20)
    expect(parseBackup(broken((f) => list(f, 'meetupPhotos').push(...twenty))).ok).toBe(true)
  })

  it('rejects duplicate photo ids or a missing photo list', () => {
    expectError(
      broken((f) => list(f, 'meetupPhotos').push(list(f, 'meetupPhotos')[0])),
      'two photos with the same id',
    )
    expectError(broken((f) => delete f.meetupPhotos), 'missing its "meetupPhotos" list')
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
