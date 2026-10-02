import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { ValidationError } from './errors'
import { addFriend, deleteFriend, updateFriend, type FriendInput } from './friends'
import { addMeetup } from './meetups'

const input = (overrides: Partial<FriendInput> = {}): FriendInput => ({
  name: 'Alex',
  groupId: null,
  photo: null,
  notes: '',
  ...overrides,
})

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
})

describe('updateFriend', () => {
  it('changes the stored fields', async () => {
    const friend = await addFriend(input())
    await updateFriend(friend.id, input({ name: 'Alexandra', notes: 'Moved to Austin' }))
    expect(await db.friends.get(friend.id)).toMatchObject({ name: 'Alexandra', notes: 'Moved to Austin' })
  })
})

describe('deleteFriend', () => {
  it('removes the friend from shared meetups and deletes their solo meetups', async () => {
    const alex = await addFriend(input({ name: 'Alex' }))
    const sam = await addFriend(input({ name: 'Sam' }))
    const solo = await addMeetup({ date: '2026-09-01', typeId: 'type-coffee', friendIds: [alex.id], note: '' })
    const shared = await addMeetup({ date: '2026-09-02', typeId: 'type-meal', friendIds: [alex.id, sam.id], note: '' })

    await deleteFriend(alex.id)

    expect(await db.friends.get(alex.id)).toBeUndefined()
    expect(await db.meetups.get(solo.id)).toBeUndefined()
    expect((await db.meetups.get(shared.id))?.friendIds).toEqual([sam.id])
  })
})
