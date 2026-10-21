import { liveQuery } from 'dexie'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, resetDatabase } from './db'
import { ValidationError } from './errors'
import { addFriend, deleteFriend } from './friends'
import {
  addMeetup,
  deleteMeetup,
  firstPhotoThumb,
  forgetPhotoThumbs,
  meetupIdsWithPhotos,
  meetupIdsWithPhotosAmong,
  photoCount,
  photoThumbs,
  restoreMeetup,
  updateDay,
  updateMeetup,
  type DayInput,
  type MeetupInput,
  NO_PHOTO_CHANGES,
  type NewPhoto,
} from './meetups'

const base: MeetupInput = { date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], activities: [] }

beforeEach(async () => {
  await resetDatabase()
  forgetPhotoThumbs()
})

describe('addMeetup', () => {
  it('saves a meetup with unique friends and nothing written about the day yet', async () => {
    const meetup = await addMeetup({ ...base, friendIds: ['alex', 'sam', 'alex'] })
    expect(meetup.friendIds).toEqual(['alex', 'sam'])
    expect(meetup).toMatchObject({ note: '', weather: [], mood: null, feelings: '' })
    expect(await db.meetups.get(meetup.id)).toEqual(meetup)
  })

  it('requires at least one friend', async () => {
    await expect(addMeetup({ ...base, friendIds: [] })).rejects.toThrow(ValidationError)
  })

  it('rejects an invalid date', async () => {
    await expect(addMeetup({ ...base, date: '2026-02-30' })).rejects.toThrow('Please pick a valid date.')
  })

  it('cleans activities like likes, keeping the order picked', async () => {
    const meetup = await addMeetup({ ...base, activities: [' Board   games ', 'Karaoke', 'board games', ' ', 'karaoke'] })
    expect(meetup.activities).toEqual(['Board games', 'Karaoke'])
    expect((await db.meetups.get(meetup.id))?.activities).toEqual(['Board games', 'Karaoke'])
  })

  it('refuses an activity over 60 characters or more than 20 activities, and saves nothing', async () => {
    await expect(addMeetup({ ...base, activities: ['x'.repeat(61)] })).rejects.toThrow(
      'Keep each activity under 60 characters.',
    )
    const tooMany = Array.from({ length: 21 }, (_, i) => `Activity ${i + 1}`)
    await expect(addMeetup({ ...base, activities: tooMany })).rejects.toThrow('A meetup can have up to 20 activities.')
    expect(await db.meetups.count()).toBe(0)
  })
})

describe('updateMeetup', () => {
  it('changes the stored fields', async () => {
    const meetup = await addMeetup(base)
    await updateMeetup(meetup.id, { ...base, date: '2026-09-05', typeId: 'type-meal' })
    expect(await db.meetups.get(meetup.id)).toMatchObject({ date: '2026-09-05', typeId: 'type-meal' })
  })

  it('replaces the activities with the cleaned list', async () => {
    const meetup = await addMeetup({ ...base, activities: ['Walk'] })
    await updateMeetup(meetup.id, { ...base, activities: ['Movie ', ' movie', 'Walk'] })
    expect((await db.meetups.get(meetup.id))?.activities).toEqual(['Movie', 'Walk'])
  })

  it('refuses too many activities and keeps the old ones', async () => {
    const meetup = await addMeetup({ ...base, activities: ['Walk'] })
    const tooMany = Array.from({ length: 21 }, (_, i) => `Activity ${i + 1}`)
    await expect(updateMeetup(meetup.id, { ...base, activities: tooMany })).rejects.toThrow(
      'A meetup can have up to 20 activities.',
    )
    expect((await db.meetups.get(meetup.id))?.activities).toEqual(['Walk'])
  })
})

describe('the day', () => {
  const day: DayInput = {
    note: '@Blue willow 3:30  \nJessie paid  ',
    weather: ['rainy'],
    mood: 'okay',
    feelings: 'It was an ok day.  ',
  }

  it('is left alone by an Edit meetup save, trailing spaces included', async () => {
    const meetup = await addMeetup({ ...base, activities: ['Walk'] })
    expect(await updateDay(meetup.id, day)).toBe(true)
    await updateMeetup(meetup.id, { ...base, date: '2026-09-05', activities: ['Movie'] })
    expect(await db.meetups.get(meetup.id)).toMatchObject({ ...day, date: '2026-09-05', activities: ['Movie'] })
  })

  it('saves only the fields given, and never the date, type, friends or activities', async () => {
    const meetup = await addMeetup({ ...base, activities: ['Walk'] })
    await updateDay(meetup.id, day)
    const sneaky = { mood: 'good', date: '2030-01-01', typeId: 'type-meal', friendIds: [], activities: [] }
    expect(await updateDay(meetup.id, sneaky as DayInput)).toBe(true)
    expect(await db.meetups.get(meetup.id)).toEqual({ ...meetup, ...day, mood: 'good' })
  })

  it('resolves false for a meetup that is gone, and creates nothing', async () => {
    expect(await updateDay('nope', { note: 'Tacos' })).toBe(false)
    expect(await db.meetups.count()).toBe(0)
  })

  it('refuses an unknown mood or long feelings, and writes nothing', async () => {
    const meetup = await addMeetup(base)
    await expect(updateDay(meetup.id, { note: 'New', mood: 'amazing' } as unknown as DayInput)).rejects.toThrow(
      'Please pick a mood from the list.',
    )
    await expect(updateDay(meetup.id, { note: 'New', feelings: 'x'.repeat(4_001) })).rejects.toThrow(
      'Keep how it felt under 4,000 characters.',
    )
    expect(await db.meetups.get(meetup.id)).toEqual(meetup)
    expect(await updateDay(meetup.id, { feelings: 'x'.repeat(4_000), mood: null })).toBe(true)
  })

  it('saves a day of any length', async () => {
    const meetup = await addMeetup(base)
    const long = 'Walked along the river.\n'.repeat(1_250)
    expect(long.length).toBe(30_000)
    await updateDay(meetup.id, { note: long })
    expect((await db.meetups.get(meetup.id))?.note).toBe(long)
  })

  it('normalizes line breaks and cleans the weather', async () => {
    const meetup = await addMeetup(base)
    const weather = ['windy', 'fog', 'rainy', 'rainy'] as unknown as DayInput['weather']
    await updateDay(meetup.id, { note: 'One\r\nTwo\rThree', feelings: 'Good\r\nday', weather })
    expect(await db.meetups.get(meetup.id)).toMatchObject({
      note: 'One\nTwo\nThree',
      feelings: 'Good\nday',
      weather: ['rainy', 'windy'],
    })
  })

  it('is saved with a new meetup from the sheet, exactly as typed but for line breaks', async () => {
    const meetup = await addMeetup({ ...base, note: '@Blue willow 3:30  \r\nJessie paid  ' })
    expect(meetup.note).toBe('@Blue willow 3:30  \nJessie paid  ')
    expect(await db.meetups.get(meetup.id)).toMatchObject({ note: '@Blue willow 3:30  \nJessie paid  ', mood: null })
  })

  it('is written by an Edit meetup save that gives it, and the rest of the day is left alone', async () => {
    const meetup = await addMeetup(base)
    await updateDay(meetup.id, day)
    await updateMeetup(meetup.id, { ...base, date: '2026-09-05', note: 'Tacos\r\nThen karaoke ' })
    expect(await db.meetups.get(meetup.id)).toMatchObject({ ...day, date: '2026-09-05', note: 'Tacos\nThen karaoke ' })
  })

  it('rolls back with the meetup when a photo write fails', async () => {
    const meetup = await addMeetup({ ...base, note: 'Before' }, { add: [newPhoto('a')], removeIds: [], order: [] })
    const sameIdAgain = { add: [newPhoto('a')], removeIds: [], order: [] }
    await expect(updateMeetup(meetup.id, { ...base, note: 'After' }, sameIdAgain)).rejects.toThrow()
    expect((await db.meetups.get(meetup.id))?.note).toBe('Before')
  })

  it('is kept by delete and Undo', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const meetup = await addMeetup({ ...base, friendIds: [alex.id] })
    await updateDay(meetup.id, day)
    const deleted = await deleteMeetup(meetup.id)
    expect(await restoreMeetup(deleted!)).toBe(true)
    expect(await db.meetups.get(meetup.id)).toEqual({ ...meetup, ...day })
  })
})

describe('updateMeetup on a missing meetup', () => {
  it('rejects', async () => {
    await expect(updateMeetup('nope', base)).rejects.toThrow('This meetup no longer exists.')
  })
})

const friendInput = (name: string) => ({ name, groupId: null, photo: null, notes: '', birthday: null })

/** A resized photo as the sheet hands it over (tiny stand-in images). */
function newPhoto(id: string): NewPhoto {
  return { id, full: `data:image/jpeg;base64,FULL${id}`, thumb: `data:image/jpeg;base64,THUMB${id}`, width: 4, height: 3 }
}

/** A meetup's photo ids, in order. */
async function photoIds(meetupId: string): Promise<string[]> {
  return (await db.meetupPhotos.where('meetupId').equals(meetupId).sortBy('order')).map((photo) => photo.id)
}

describe('photos saved with a meetup', () => {
  it('adds new photos with the meetup, numbered in order', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: ['a', 'b'] })
    expect(await db.meetupPhotos.get('b')).toEqual({
      ...newPhoto('b'),
      meetupId: meetup.id,
      order: 1,
      createdAt: meetup.createdAt,
    })
    expect(await photoIds(meetup.id)).toEqual(['a', 'b'])
    // Photos are never stored inside the meetup.
    expect(await db.meetups.get(meetup.id)).toEqual(meetup)
  })

  it('adds, removes and reorders in one update', async () => {
    const meetup = await addMeetup(base, {
      add: [newPhoto('a'), newPhoto('b'), newPhoto('c')],
      removeIds: [],
      order: [],
    })
    await updateMeetup(
      meetup.id,
      { ...base, date: '2026-09-05' },
      { add: [newPhoto('d')], removeIds: ['b'], order: ['d', 'c', 'a'] },
    )
    expect(await photoIds(meetup.id)).toEqual(['d', 'c', 'a'])
    const orders = (await db.meetupPhotos.where('meetupId').equals(meetup.id).sortBy('order')).map((p) => p.order)
    expect(orders).toEqual([0, 1, 2])
    expect(await db.meetupPhotos.get('b')).toBeUndefined()
    expect(await db.meetups.get(meetup.id)).toMatchObject({ date: '2026-09-05' })
  })

  it('keeps photos left out of the order after the listed ones, and ignores other meetups photos', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: [] })
    const other = await addMeetup(base, { add: [newPhoto('x')], removeIds: [], order: [] })
    await updateMeetup(meetup.id, base, { add: [newPhoto('c')], removeIds: ['x'], order: ['b'] })
    expect(await photoIds(meetup.id)).toEqual(['b', 'a', 'c'])
    expect(await photoIds(other.id)).toEqual(['x'])
  })

  it('leaves the photos alone when nothing about them changes', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: [] })
    await updateMeetup(meetup.id, { ...base, date: '2026-09-05' })
    expect(await photoIds(meetup.id)).toEqual(['a', 'b'])
  })

  it('rolls the meetup back when a photo write fails', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a')], removeIds: [], order: [] })
    // Adding a photo id that is already stored fails inside the transaction.
    const sameIdAgain = { add: [newPhoto('a')], removeIds: [], order: [] }
    await expect(updateMeetup(meetup.id, { ...base, date: '2026-09-05' }, sameIdAgain)).rejects.toThrow()
    expect(await db.meetups.get(meetup.id)).toMatchObject({ date: '2026-09-01' })
    expect(await photoIds(meetup.id)).toEqual(['a'])

    await expect(addMeetup(base, sameIdAgain)).rejects.toThrow()
    expect(await db.meetups.count()).toBe(1)
  })

  it('refuses more than 20 photos and changes nothing', async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => newPhoto(`p${i}`))
    const meetup = await addMeetup(base, { add: twenty, removeIds: [], order: [] })
    const oneMore = { add: [newPhoto('one-more')], removeIds: [], order: [] }
    await expect(updateMeetup(meetup.id, { ...base, date: '2026-09-05' }, oneMore)).rejects.toThrow(
      'A meetup can have up to 20 photos.',
    )
    expect(await db.meetups.get(meetup.id)).toMatchObject({ date: '2026-09-01' })
    expect(await db.meetupPhotos.count()).toBe(20)

    // Removing one makes room for another in the same update.
    await updateMeetup(meetup.id, base, { ...oneMore, removeIds: ['p0'] })
    expect(await db.meetupPhotos.count()).toBe(20)
    expect(await db.meetupPhotos.get('one-more')).toMatchObject({ order: 19 })
  })

  it('refuses a photo that is not a JPEG or PNG data URL, and saves nothing', async () => {
    const bad = { ...newPhoto('a'), full: 'https://example.com/a.jpg' }
    await expect(addMeetup(base, { add: [bad], removeIds: [], order: [] })).rejects.toThrow("A photo couldn't be saved.")
    expect(await db.meetups.count()).toBe(0)
    expect(await db.meetupPhotos.count()).toBe(0)
  })

  it('rolls everything back when one add repeats a photo id', async () => {
    await expect(addMeetup(base, { add: [newPhoto('a'), newPhoto('a')], removeIds: [], order: [] })).rejects.toThrow()
    expect(await db.meetups.count()).toBe(0)
    expect(await db.meetupPhotos.count()).toBe(0)
  })

  it('shares one frozen "no changes" default', () => {
    expect(Object.isFrozen(NO_PHOTO_CHANGES)).toBe(true)
    expect(Object.isFrozen(NO_PHOTO_CHANGES.add)).toBe(true)
    expect(Object.isFrozen(NO_PHOTO_CHANGES.removeIds)).toBe(true)
    expect(Object.isFrozen(NO_PHOTO_CHANGES.order)).toBe(true)
  })

  it('finds the first photo’s thumbnail, or none', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: ['b', 'a'] })
    const other = await addMeetup(base)
    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBb')
    await updateMeetup(meetup.id, base, { add: [], removeIds: ['b'], order: ['a'] })
    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBa')
    expect(await firstPhotoThumb(other.id)).toBeNull()
  })

  it('keeps thumbnail queries live without returning full images', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a')], removeIds: [], order: ['a'] })
    const seen: Awaited<ReturnType<typeof photoThumbs>>[] = []
    const subscription = liveQuery(() => photoThumbs(meetup.id)).subscribe((value) => seen.push(value))
    await vi.waitFor(() => expect(seen.at(-1)).toEqual([{ id: 'a', thumb: 'data:image/jpeg;base64,THUMBa' }]))
    await updateMeetup(meetup.id, base, { add: [newPhoto('b')], removeIds: [], order: ['b', 'a'] })
    await vi.waitFor(() => expect(seen.at(-1)?.map((photo) => photo.id)).toEqual(['b', 'a']))
    await updateMeetup(meetup.id, base, { add: [], removeIds: ['b'], order: ['a'] })
    await vi.waitFor(() => expect(seen.at(-1)?.map((photo) => photo.id)).toEqual(['a']))
    subscription.unsubscribe()
    expect(Object.keys(seen.at(-1)?.[0] ?? {}).sort()).toEqual(['id', 'thumb'])
  })

  it('counts every stored photo', async () => {
    expect(await photoCount()).toBe(0)
    await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: [] })
    await addMeetup(base, { add: [newPhoto('c')], removeIds: [], order: [] })
    expect(await photoCount()).toBe(3)
  })
})

describe('deleteMeetup and restoreMeetup', () => {
  it('deletes a meetup and restores it exactly', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const meetup = await addMeetup({ ...base, friendIds: [alex.id] })
    const deleted = await deleteMeetup(meetup.id)
    expect(await db.meetups.get(meetup.id)).toBeUndefined()
    expect(await restoreMeetup(deleted!)).toBe(true)
    expect(await db.meetups.get(meetup.id)).toEqual(meetup)
  })

  it('keeps only friends who still exist when restoring', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const sam = await addFriend(friendInput('Sam'))
    const meetup = await addMeetup({ ...base, friendIds: [alex.id, sam.id] })
    const deleted = await deleteMeetup(meetup.id)
    await deleteFriend(alex.id)
    expect(await restoreMeetup(deleted!)).toBe(true)
    expect((await db.meetups.get(meetup.id))?.friendIds).toEqual([sam.id])
  })

  it('restores nothing when no friends remain', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const meetup = await addMeetup({ ...base, friendIds: [alex.id] })
    const deleted = await deleteMeetup(meetup.id)
    await deleteFriend(alex.id)
    expect(await restoreMeetup(deleted!)).toBe(false)
    expect(await db.meetups.get(meetup.id)).toBeUndefined()
  })

  it('restores nothing when the type is gone', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const meetup = await addMeetup({ ...base, friendIds: [alex.id] })
    const deleted = await deleteMeetup(meetup.id)
    await db.meetupTypes.delete(meetup.typeId)
    expect(await restoreMeetup(deleted!)).toBe(false)
    expect(await db.meetups.get(meetup.id)).toBeUndefined()
  })

  it('returns undefined for a missing meetup', async () => {
    expect(await deleteMeetup('nope')).toBeUndefined()
  })

  it('deletes the photos with the meetup, and Undo puts them back', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const meetup = await addMeetup(
      { ...base, friendIds: [alex.id] },
      { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: ['b', 'a'] },
    )
    const before = await db.meetupPhotos.where('meetupId').equals(meetup.id).sortBy('order')
    const deleted = await deleteMeetup(meetup.id)
    expect(deleted).toEqual({ meetup, photos: before })
    expect(await db.meetupPhotos.count()).toBe(0)

    expect(await restoreMeetup(deleted!)).toBe(true)
    expect(await db.meetups.get(meetup.id)).toEqual(meetup)
    expect(await db.meetupPhotos.where('meetupId').equals(meetup.id).sortBy('order')).toEqual(before)
  })

  it('puts the photos back when only some friends are gone', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const sam = await addFriend(friendInput('Sam'))
    const meetup = await addMeetup(
      { ...base, friendIds: [alex.id, sam.id] },
      { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: [] },
    )
    const deleted = await deleteMeetup(meetup.id)
    await deleteFriend(alex.id)
    expect(await restoreMeetup(deleted!)).toBe(true)
    expect((await db.meetups.get(meetup.id))?.friendIds).toEqual([sam.id])
    expect(await photoIds(meetup.id)).toEqual(['a', 'b'])
  })

  it('puts nothing back when the type is gone', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const meetup = await addMeetup({ ...base, friendIds: [alex.id] }, { add: [newPhoto('a')], removeIds: [], order: [] })
    const deleted = await deleteMeetup(meetup.id)
    await db.meetupTypes.delete(meetup.typeId)
    expect(await restoreMeetup(deleted!)).toBe(false)
    expect(await db.meetups.get(meetup.id)).toBeUndefined()
    expect(await db.meetupPhotos.count()).toBe(0)
  })

  it('puts no photos back when the meetup cannot be restored', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const meetup = await addMeetup({ ...base, friendIds: [alex.id] }, { add: [newPhoto('a')], removeIds: [], order: [] })
    const deleted = await deleteMeetup(meetup.id)
    await deleteFriend(alex.id)
    expect(await restoreMeetup(deleted!)).toBe(false)
    expect(await db.meetupPhotos.count()).toBe(0)
  })
})

describe('the thumbnail cache', () => {
  /** Counts the photo records read whole (full image included). */
  function countPhotoReads() {
    return vi.spyOn(db.meetupPhotos, 'get')
  }

  it('reads a thumbnail once, then keeps it', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a')], removeIds: [], order: [] })
    const reads = countPhotoReads()
    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBa')
    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBa')
    expect(reads).toHaveBeenCalledTimes(1)
    reads.mockRestore()
  })

  it('follows a new first photo after a reorder', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: ['a', 'b'] })
    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBa')
    await updateMeetup(meetup.id, base, { add: [], removeIds: [], order: ['b', 'a'] })
    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBb')
  })

  it('reads again after forgetPhotoThumbs', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a')], removeIds: [], order: [] })
    await firstPhotoThumb(meetup.id)
    const reads = countPhotoReads()
    forgetPhotoThumbs()
    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBa')
    expect(reads).toHaveBeenCalledTimes(1)
    reads.mockRestore()
  })

  it('still gives null for a meetup without photos', async () => {
    const meetup = await addMeetup(base)
    expect(await firstPhotoThumb(meetup.id)).toBeNull()
    expect(await firstPhotoThumb(meetup.id)).toBeNull()
  })

  it('forgets the photos a delete or an edit removes', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const meetup = await addMeetup(
      { ...base, friendIds: [alex.id] },
      { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: [] },
    )
    await firstPhotoThumb(meetup.id)
    const deleted = await deleteMeetup(meetup.id)
    await restoreMeetup(deleted!)
    const reads = countPhotoReads()
    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBa')
    expect(reads).toHaveBeenCalledTimes(1)
    await updateMeetup(meetup.id, { ...base, friendIds: [alex.id] }, { add: [], removeIds: ['a'], order: [] })
    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBb')
    expect(reads).toHaveBeenCalledTimes(2)
    reads.mockRestore()
    // Ids are never reused in the app; reusing one here shows the edit dropped the old entry, since a kept one
    // would still answer with the old thumbnail.
    const again = { ...newPhoto('a'), thumb: 'data:image/jpeg;base64,THUMBagain' }
    await updateMeetup(meetup.id, { ...base, friendIds: [alex.id] }, { add: [again], removeIds: [], order: ['a'] })
    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBagain')
  })

  it('keeps the 300 most recently used thumbnails', async () => {
    const meetupIds = Array.from({ length: 302 }, (_, i) => `m${i}`)
    await db.meetupPhotos.bulkAdd(
      meetupIds.map((meetupId, i) => ({
        id: `p${i}`,
        meetupId,
        order: 0,
        full: `data:image/jpeg;base64,FULL${i}`,
        thumb: `data:image/jpeg;base64,THUMB${i}`,
        width: 4,
        height: 3,
        createdAt: '2026-09-01T12:00:00.000Z',
      })),
    )
    const [a, ...others] = meetupIds
    const read = others.slice(0, 299)
    const more = others.slice(299)
    await firstPhotoThumb(a)
    for (const id of read) await firstPhotoThumb(id)
    await firstPhotoThumb(a)
    for (const id of more) await firstPhotoThumb(id)

    // 302 thumbnails were read and a was used again, so the cache holds a, the 2 more and the last 297 of the 299.
    const reads = countPhotoReads()
    expect(await firstPhotoThumb(a)).toBe('data:image/jpeg;base64,THUMB0')
    expect(reads).not.toHaveBeenCalled()
    // The oldest kept is still there, so the cache holds at least 300...
    expect(await firstPhotoThumb(read[2])).toBe('data:image/jpeg;base64,THUMB3')
    expect(reads).not.toHaveBeenCalled()
    // ...and the one before it was dropped, so it holds no more than 300.
    expect(await firstPhotoThumb(read[1])).toBe('data:image/jpeg;base64,THUMB2')
    expect(reads).toHaveBeenCalledTimes(1)
    // The first of the 299 was used least recently, so it was dropped and is read again.
    expect(await firstPhotoThumb(read[0])).toBe('data:image/jpeg;base64,THUMB1')
    expect(reads).toHaveBeenCalledTimes(2)
    reads.mockRestore()
  })
})

describe('meetupIdsWithPhotos', () => {
  it('names each meetup with photos once, without reading a photo', async () => {
    const three = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b'), newPhoto('c')], removeIds: [], order: [] })
    const none = await addMeetup(base)
    const reads = vi.spyOn(db.meetupPhotos, 'get')
    expect(await meetupIdsWithPhotos()).toEqual([three.id])
    expect(reads).not.toHaveBeenCalled()
    reads.mockRestore()

    await updateMeetup(none.id, base, { add: [newPhoto('d')], removeIds: [], order: [] })
    expect((await meetupIdsWithPhotos()).sort()).toEqual([three.id, none.id].sort())
    await updateMeetup(none.id, base, { add: [], removeIds: ['d'], order: [] })
    expect(await meetupIdsWithPhotos()).toEqual([three.id])
  })
})

describe('meetupIdsWithPhotosAmong', () => {
  it('names which of the given meetups have photos, without reading a photo', async () => {
    const two = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: [] })
    const none = await addMeetup(base)
    const notAsked = await addMeetup(base, { add: [newPhoto('c')], removeIds: [], order: [] })
    const reads = vi.spyOn(db.meetupPhotos, 'get')
    expect([...(await meetupIdsWithPhotosAmong([none.id, two.id, 'gone']))]).toEqual([two.id])
    expect((await meetupIdsWithPhotosAmong([])).size).toBe(0)
    expect(reads).not.toHaveBeenCalled()
    reads.mockRestore()
    expect(await meetupIdsWithPhotosAmong([notAsked.id])).toEqual(new Set([notAsked.id]))
  })

  it('stays live: a first photo added, then the last one deleted', async () => {
    const meetup = await addMeetup(base)
    const other = await addMeetup(base, { add: [newPhoto('x')], removeIds: [], order: [] })
    const seen: ReadonlySet<string>[] = []
    const subscription = liveQuery(() => meetupIdsWithPhotosAmong([meetup.id, other.id])).subscribe((value) =>
      seen.push(value),
    )
    await vi.waitFor(() => expect(seen.at(-1)).toEqual(new Set([other.id])))
    await updateMeetup(meetup.id, base, { add: [newPhoto('a')], removeIds: [], order: [] })
    await vi.waitFor(() => expect(seen.at(-1)).toEqual(new Set([meetup.id, other.id])))
    await updateMeetup(other.id, base, { add: [], removeIds: ['x'], order: [] })
    await vi.waitFor(() => expect(seen.at(-1)).toEqual(new Set([meetup.id])))
    subscription.unsubscribe()
  })
})
