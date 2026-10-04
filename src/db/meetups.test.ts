import { liveQuery } from 'dexie'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, resetDatabase } from './db'
import { ValidationError } from './errors'
import { addFriend, deleteFriend } from './friends'
import {
  addMeetup,
  deleteMeetup,
  firstPhotoThumb,
  photoCount,
  photoThumbs,
  restoreMeetup,
  updateMeetup,
  type MeetupInput,
  NO_PHOTO_CHANGES,
  type NewPhoto,
} from './meetups'

const base: MeetupInput = { date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], note: '', activities: [] }

beforeEach(resetDatabase)

describe('addMeetup', () => {
  it('saves a meetup with unique friends and a trimmed note', async () => {
    const meetup = await addMeetup({ ...base, friendIds: ['alex', 'sam', 'alex'], note: ' Tacos ' })
    expect(meetup.friendIds).toEqual(['alex', 'sam'])
    expect(meetup.note).toBe('Tacos')
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
    await updateMeetup(meetup.id, { ...base, date: '2026-09-05', note: 'Pizza' })
    expect(await db.meetups.get(meetup.id)).toMatchObject({ date: '2026-09-05', note: 'Pizza' })
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
      { ...base, note: 'Pizza' },
      { add: [newPhoto('d')], removeIds: ['b'], order: ['d', 'c', 'a'] },
    )
    expect(await photoIds(meetup.id)).toEqual(['d', 'c', 'a'])
    const orders = (await db.meetupPhotos.where('meetupId').equals(meetup.id).sortBy('order')).map((p) => p.order)
    expect(orders).toEqual([0, 1, 2])
    expect(await db.meetupPhotos.get('b')).toBeUndefined()
    expect(await db.meetups.get(meetup.id)).toMatchObject({ note: 'Pizza' })
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
    await updateMeetup(meetup.id, { ...base, note: 'Pizza' })
    expect(await photoIds(meetup.id)).toEqual(['a', 'b'])
  })

  it('rolls the meetup back when a photo write fails', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a')], removeIds: [], order: [] })
    // Adding a photo id that is already stored fails inside the transaction.
    const sameIdAgain = { add: [newPhoto('a')], removeIds: [], order: [] }
    await expect(updateMeetup(meetup.id, { ...base, note: 'Pizza' }, sameIdAgain)).rejects.toThrow()
    expect(await db.meetups.get(meetup.id)).toMatchObject({ note: '' })
    expect(await photoIds(meetup.id)).toEqual(['a'])

    await expect(addMeetup(base, sameIdAgain)).rejects.toThrow()
    expect(await db.meetups.count()).toBe(1)
  })

  it('refuses more than 20 photos and changes nothing', async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => newPhoto(`p${i}`))
    const meetup = await addMeetup(base, { add: twenty, removeIds: [], order: [] })
    const oneMore = { add: [newPhoto('one-more')], removeIds: [], order: [] }
    await expect(updateMeetup(meetup.id, { ...base, note: 'Pizza' }, oneMore)).rejects.toThrow(
      'A meetup can have up to 20 photos.',
    )
    expect(await db.meetups.get(meetup.id)).toMatchObject({ note: '' })
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
