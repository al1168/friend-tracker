import { beforeEach, describe, expect, it } from 'vitest'
import type { Birthday } from '../types'
import { db, resetDatabase } from './db'
import { ValidationError } from './errors'
import { addFriend, deleteFriend, updateFriend, type FriendInput } from './friends'
import { addMeetup, type NewPhoto } from './meetups'

const input = (overrides: Partial<FriendInput> = {}): FriendInput => ({
  name: 'Alex',
  groupId: null,
  photo: null,
  notes: '',
  birthday: null,
  ...overrides,
})

/** Birthdays the data layer refuses: no Feb 30, no Feb 29 in 2023, nothing before 1900 or after today. */
const INVALID_BIRTHDAYS: Birthday[] = [
  { month: 2, day: 30, year: null },
  { month: 2, day: 29, year: 2023 },
  { month: 12, day: 31, year: 1899 },
  { month: 1, day: 1, year: 2999 },
]

beforeEach(resetDatabase)

describe('addFriend', () => {
  it('saves a trimmed friend', async () => {
    const friend = await addFriend(input({ name: '  Alex Smith ', notes: ' Likes jazz ' }))
    expect(friend.name).toBe('Alex Smith')
    expect(friend.notes).toBe('Likes jazz')
    expect(await db.friends.get(friend.id)).toEqual(friend)
  })

  it('rejects an empty name', async () => {
    await expect(addFriend(input({ name: '   ' }))).rejects.toThrow(ValidationError)
  })

  it('starts with empty likes and dislikes', async () => {
    const friend = await addFriend(input())
    expect(friend).toMatchObject({ likes: [], dislikes: [] })
  })

  it('saves a birthday, or none', async () => {
    const alex = await addFriend(input({ birthday: { month: 3, day: 14, year: 1996 } }))
    const sam = await addFriend(input({ name: 'Sam', birthday: { month: 2, day: 29, year: null } }))
    const kim = await addFriend(input({ name: 'Kim' }))
    expect((await db.friends.get(alex.id))?.birthday).toEqual({ month: 3, day: 14, year: 1996 })
    expect((await db.friends.get(sam.id))?.birthday).toEqual({ month: 2, day: 29, year: null })
    expect((await db.friends.get(kim.id))?.birthday).toBeNull()
  })

  it('stores only the birthday fields', async () => {
    const birthday = { month: 3, day: 14, year: null, sign: 'Pisces' }
    const friend = await addFriend(input({ birthday }))
    expect((await db.friends.get(friend.id))?.birthday).toEqual({ month: 3, day: 14, year: null })
  })

  it('rejects an invalid birthday and saves nothing', async () => {
    for (const birthday of INVALID_BIRTHDAYS) {
      const attempt = addFriend(input({ birthday }))
      await expect(attempt).rejects.toThrow(ValidationError)
      await expect(attempt).rejects.toThrow('Pick a valid birthday.')
    }
    expect(await db.friends.count()).toBe(0)
  })
})

describe('updateFriend', () => {
  it('changes the stored fields', async () => {
    const friend = await addFriend(input())
    await updateFriend(friend.id, input({ name: 'Alexandra', notes: 'Moved to Austin' }))
    expect(await db.friends.get(friend.id)).toMatchObject({ name: 'Alexandra', notes: 'Moved to Austin' })
  })

  it('leaves likes and dislikes alone', async () => {
    const friend = await addFriend(input())
    await db.friends.update(friend.id, { likes: ['Sushi'], dislikes: ['Cilantro'] })
    await updateFriend(friend.id, input({ name: 'Alexandra' }))
    expect(await db.friends.get(friend.id)).toMatchObject({ likes: ['Sushi'], dislikes: ['Cilantro'] })
  })

  it('sets, changes and clears the birthday', async () => {
    const friend = await addFriend(input())
    const stored = async () => (await db.friends.get(friend.id))?.birthday
    await updateFriend(friend.id, input({ birthday: { month: 3, day: 14, year: 1996 } }))
    expect(await stored()).toEqual({ month: 3, day: 14, year: 1996 })
    await updateFriend(friend.id, input({ birthday: { month: 2, day: 29, year: null } }))
    expect(await stored()).toEqual({ month: 2, day: 29, year: null })
    await updateFriend(friend.id, input({ birthday: null }))
    expect(await stored()).toBeNull()
  })

  it('rejects an invalid birthday and keeps the old one', async () => {
    const friend = await addFriend(input({ birthday: { month: 3, day: 14, year: 1996 } }))
    for (const birthday of INVALID_BIRTHDAYS) {
      await expect(updateFriend(friend.id, input({ name: 'Alexandra', birthday }))).rejects.toThrow('Pick a valid birthday.')
    }
    expect(await db.friends.get(friend.id)).toMatchObject({ name: 'Alex', birthday: { month: 3, day: 14, year: 1996 } })
  })
})

describe('deleteFriend', () => {
  it('removes the friend from shared meetups and deletes their solo meetups', async () => {
    const alex = await addFriend(input({ name: 'Alex' }))
    const sam = await addFriend(input({ name: 'Sam' }))
    const solo = await addMeetup({
      date: '2026-09-01',
      typeId: 'type-coffee',
      friendIds: [alex.id],
      activities: [],
    })
    const shared = await addMeetup({
      date: '2026-09-02',
      typeId: 'type-meal',
      friendIds: [alex.id, sam.id],
      activities: [],
    })

    await deleteFriend(alex.id)

    expect(await db.friends.get(alex.id)).toBeUndefined()
    expect(await db.meetups.get(solo.id)).toBeUndefined()
    expect((await db.meetups.get(shared.id))?.friendIds).toEqual([sam.id])
  })

  it('deletes the photos of the meetups it deletes, and keeps the others', async () => {
    const alex = await addFriend(input({ name: 'Alex' }))
    const sam = await addFriend(input({ name: 'Sam' }))
    const photo = (id: string): NewPhoto => ({
      id,
      full: 'data:image/jpeg;base64,FULL',
      thumb: 'data:image/jpeg;base64,THUMB',
      width: 4,
      height: 3,
    })
    const meetup = { date: '2026-09-01', typeId: 'type-coffee', activities: [] }
    const solo = await addMeetup(
      { ...meetup, friendIds: [alex.id] },
      { add: [photo('a'), photo('b')], removeIds: [], order: [] },
    )
    const shared = await addMeetup(
      { ...meetup, friendIds: [alex.id, sam.id] },
      { add: [photo('c')], removeIds: [], order: [] },
    )

    await deleteFriend(alex.id)

    expect(await db.meetupPhotos.where('meetupId').equals(solo.id).count()).toBe(0)
    expect((await db.meetupPhotos.where('meetupId').equals(shared.id).toArray()).map((p) => p.id)).toEqual(['c'])
  })
})

describe('updateFriend on a missing friend', () => {
  it('rejects', async () => {
    await expect(updateFriend('nope', input())).rejects.toThrow('This friend no longer exists.')
  })
})
