import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { ValidationError } from './errors'
import { addFriend } from './friends'
import { addGroup, deleteGroup, renameGroup } from './groups'

beforeEach(resetDatabase)

describe('addGroup', () => {
  it('adds a trimmed group', async () => {
    const group = await addGroup('  College ')
    expect(group.name).toBe('College')
    expect(await db.groups.get(group.id)).toEqual(group)
  })

  it('rejects duplicate names regardless of case', async () => {
    await addGroup('College')
    await expect(addGroup('college')).rejects.toThrow('You already have a group with that name.')
  })

  it('rejects an empty name', async () => {
    await expect(addGroup('  ')).rejects.toThrow(ValidationError)
  })
})

describe('renameGroup', () => {
  it('allows changing the case of its own name', async () => {
    const group = await addGroup('college')
    await renameGroup(group.id, 'College')
    expect((await db.groups.get(group.id))?.name).toBe('College')
  })

  it('rejects taking another group’s name', async () => {
    await addGroup('Work')
    const group = await addGroup('College')
    await expect(renameGroup(group.id, 'work')).rejects.toThrow(ValidationError)
  })
})

describe('deleteGroup', () => {
  it('ungroups its friends', async () => {
    const group = await addGroup('Work')
    const kim = await addFriend({ name: 'Kim', groupId: group.id, photo: null, notes: '', birthday: null })
    await deleteGroup(group.id)
    expect(await db.groups.get(group.id)).toBeUndefined()
    expect((await db.friends.get(kim.id))?.groupId).toBeNull()
  })
})

describe('atomicity and missing records', () => {
  it('does not create duplicate groups on concurrent adds', async () => {
    const results = await Promise.allSettled([addGroup('College'), addGroup('college')])
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
    expect(await db.groups.count()).toBe(1)
  })

  it('rejects renaming a missing group', async () => {
    await expect(renameGroup('nope', 'X')).rejects.toThrow('This group no longer exists.')
  })
})
