import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { ValidationError } from './errors'
import { addFriend, deleteFriend } from './friends'
import { addMeetup, deleteMeetup, restoreMeetup, updateMeetup, type MeetupInput } from './meetups'

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
})
