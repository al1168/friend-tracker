import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { ValidationError } from './errors'
import { addFriend, deleteFriend } from './friends'
import { addMeetup, deleteMeetup, restoreMeetup, updateMeetup, type MeetupInput } from './meetups'

const base: MeetupInput = { date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], note: '' }

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
})

describe('updateMeetup', () => {
  it('changes the stored fields', async () => {
    const meetup = await addMeetup(base)
    await updateMeetup(meetup.id, { ...base, date: '2026-09-05', note: 'Pizza' })
    expect(await db.meetups.get(meetup.id)).toMatchObject({ date: '2026-09-05', note: 'Pizza' })
  })
})

describe('updateMeetup on a missing meetup', () => {
  it('rejects', async () => {
    await expect(updateMeetup('nope', base)).rejects.toThrow('This meetup no longer exists.')
  })
})

const friendInput = (name: string) => ({ name, groupId: null, photo: null, notes: '' })

describe('deleteMeetup and restoreMeetup', () => {
  it('deletes a meetup and restores it exactly', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const meetup = await addMeetup({ ...base, friendIds: [alex.id] })
    const deleted = await deleteMeetup(meetup.id)
    expect(await db.meetups.get(meetup.id)).toBeUndefined()
    await restoreMeetup(deleted!)
    expect(await db.meetups.get(meetup.id)).toEqual(meetup)
  })

  it('keeps only friends who still exist when restoring', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const sam = await addFriend(friendInput('Sam'))
    const meetup = await addMeetup({ ...base, friendIds: [alex.id, sam.id] })
    const deleted = await deleteMeetup(meetup.id)
    await deleteFriend(alex.id)
    await restoreMeetup(deleted!)
    expect((await db.meetups.get(meetup.id))?.friendIds).toEqual([sam.id])
  })

  it('restores nothing when no friends remain', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const meetup = await addMeetup({ ...base, friendIds: [alex.id] })
    const deleted = await deleteMeetup(meetup.id)
    await deleteFriend(alex.id)
    await restoreMeetup(deleted!)
    expect(await db.meetups.get(meetup.id)).toBeUndefined()
  })

  it('returns undefined for a missing meetup', async () => {
    expect(await deleteMeetup('nope')).toBeUndefined()
  })
})
