import { describe, expect, it } from 'vitest'
import { friend, meetup, meetupPhoto, meetupType } from '../test/fixtures'
import type { BackupData } from './format'
import { describeImport, type AppNow } from './importSummary'

const TODAY = '2026-10-21'
/** Exported on Wed, Sep 2, 2026, at 9 AM on the phone's clock. */
const SEP_2 = new Date(2026, 8, 2, 9).toISOString()

/** A backup with `friends` friends (f0, f1, ...), `meetups` meetups (m0, ...) and `photos` photos of the first meetup. */
function backup(friends: number, meetups: number, photos = 0): BackupData {
  return {
    friends: Array.from({ length: friends }, (_, i) => friend(`f${i}`, `Friend ${i}`)),
    groups: [],
    meetupTypes: [meetupType('t1', 'Coffee', 0)],
    meetups: Array.from({ length: meetups }, (_, i) => meetup(`m${i}`, '2026-09-01', ['f0'], 't1')),
    meetupPhotos: Array.from({ length: photos }, (_, i) => meetupPhoto(`p${i}`, 'm0', i)),
  }
}

/** What the app holds now: the given ids, and `photos` photos. */
function app(friendIds: string[], meetupIds: string[], photos = 0): AppNow {
  return { friends: friendIds.length, meetups: meetupIds.length, photos, friendIds, meetupIds }
}

function ids(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i}`)
}

describe('describeImport', () => {
  it('compares a dated backup with the app, photos on both sides', () => {
    expect(describeImport(backup(15, 30, 6), SEP_2, app(ids('f', 15), ids('m', 39), 9), TODAY).split('\n')).toEqual([
      'Backup from Wed, Sep 2: 15 friends, 30 meetups, 6 photos.',
      'In the app now: 15 friends, 39 meetups, 9 photos.',
      "9 meetups in the app now aren't in this backup.",
      'Everything in the app now will be replaced.',
    ])
  })

  it('says "This backup" without a date it can read, and gives last year’s with its year', () => {
    expect(describeImport(backup(1, 1), null, app(['f0'], ['m0']), TODAY).split('\n')[0]).toBe(
      'This backup: 1 friend, 1 meetup.',
    )
    const lastYear = new Date(2025, 8, 2, 9).toISOString()
    expect(describeImport(backup(1, 1), lastYear, app(['f0'], ['m0']), TODAY).split('\n')[0]).toBe(
      'Backup from Tue, Sep 2, 2025: 1 friend, 1 meetup.',
    )
  })

  it('into an empty app: nothing to lose or replace', () => {
    expect(describeImport(backup(15, 30, 6), SEP_2, app([], []), TODAY)).toBe(
      'Backup from Wed, Sep 2: 15 friends, 30 meetups, 6 photos.\nNo friends or meetups in the app yet.',
    )
  })

  it('leaves out photo counts when neither side has any, and keeps them when one does', () => {
    expect(describeImport(backup(2, 3), SEP_2, app(ids('f', 2), ids('m', 3)), TODAY).split('\n').slice(0, 2)).toEqual([
      'Backup from Wed, Sep 2: 2 friends, 3 meetups.',
      'In the app now: 2 friends, 3 meetups.',
    ])
    expect(describeImport(backup(2, 3), SEP_2, app(ids('f', 2), ids('m', 3), 1), TODAY).split('\n').slice(0, 2)).toEqual(
      ['Backup from Wed, Sep 2: 2 friends, 3 meetups, 0 photos.', 'In the app now: 2 friends, 3 meetups, 1 photo.'],
    )
  })

  it('names what in the app isn’t in the backup: meetups, friends and meetups, or friends', () => {
    const line = (friendIds: string[], meetupIds: string[]) =>
      describeImport(backup(2, 2), SEP_2, app(friendIds, meetupIds), TODAY).split('\n')[2]
    expect(line(['f0', 'f1'], ['m0', 'm1', 'x1'])).toBe("1 meetup in the app now isn't in this backup.")
    expect(line(['f0', 'x1'], ['m0', 'x1', 'x2'])).toBe("1 friend and 2 meetups in the app now aren't in this backup.")
    expect(line(['f0', 'x1', 'x2'], ['m0'])).toBe("2 friends in the app now aren't in this backup.")
    expect(line(['x1'], ['m0'])).toBe("1 friend in the app now isn't in this backup.")
    // Nothing missing: straight on to the last line.
    expect(line(['f0'], ['m0'])).toBe('Everything in the app now will be replaced.')
  })
})
