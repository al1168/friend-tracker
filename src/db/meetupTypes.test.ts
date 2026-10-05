import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { ValidationError } from './errors'
import { addMeetup } from './meetups'
import {
  addMeetupType,
  countMeetupsUsingType,
  deleteMeetupType,
  moveMeetupType,
  updateMeetupType,
} from './meetupTypes'

beforeEach(resetDatabase)

async function names(): Promise<string[]> {
  return (await db.meetupTypes.orderBy('order').toArray()).map((t) => t.name)
}

describe('addMeetupType', () => {
  it('adds a type at the end', async () => {
    const type = await addMeetupType({ name: ' Hike ', emoji: '🥾' })
    expect(type).toMatchObject({ name: 'Hike', emoji: '🥾', order: 8 })
    expect((await names()).at(-1)).toBe('Hike')
  })

  it('keeps only the first emoji', async () => {
    expect((await addMeetupType({ name: 'Games', emoji: '🎲🎯' })).emoji).toBe('🎲')
  })

  it('rejects a duplicate name or a missing emoji', async () => {
    await expect(addMeetupType({ name: 'coffee', emoji: '☕' })).rejects.toThrow(ValidationError)
    await expect(addMeetupType({ name: 'Hike', emoji: ' ' })).rejects.toThrow('Please pick an emoji.')
  })
})

describe('updateMeetupType', () => {
  it('changes name and emoji', async () => {
    await updateMeetupType('type-coffee', { name: 'Café', emoji: '🥐' })
    expect(await db.meetupTypes.get('type-coffee')).toMatchObject({ name: 'Café', emoji: '🥐' })
  })
})

describe('moveMeetupType', () => {
  it('swaps with the neighbor and ignores moves past the ends', async () => {
    await moveMeetupType('type-meal', -1)
    expect((await names()).slice(0, 2)).toEqual(['Meal', 'Coffee'])
    await moveMeetupType('type-meal', -1)
    expect((await names()).slice(0, 2)).toEqual(['Meal', 'Coffee'])
    await moveMeetupType('type-other', 1)
    expect((await names()).at(-1)).toBe('Other')
  })
})

describe('deleteMeetupType', () => {
  it('refuses to delete a type that is in use', async () => {
    await addMeetup({ date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], activities: [] })
    expect(await countMeetupsUsingType('type-coffee')).toBe(1)
    await expect(deleteMeetupType('type-coffee')).rejects.toThrow('This type is used by 1 meetup')
    expect(await db.meetupTypes.get('type-coffee')).toBeDefined()
  })

  it('refuses to delete the last type', async () => {
    const ids = (await db.meetupTypes.toArray()).map((t) => t.id)
    for (const id of ids.slice(1)) await deleteMeetupType(id)
    await expect(deleteMeetupType(ids[0])).rejects.toThrow('You need at least one meetup type.')
  })

  it('deletes an unused type', async () => {
    await deleteMeetupType('type-trip')
    expect(await db.meetupTypes.get('type-trip')).toBeUndefined()
  })
})

describe('atomicity and missing records', () => {
  it('does not create duplicate types on concurrent adds', async () => {
    const results = await Promise.allSettled([
      addMeetupType({ name: 'Hike', emoji: '🥾' }),
      addMeetupType({ name: 'Hike', emoji: '🥾' }),
    ])
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
    expect((await names()).filter((n) => n === 'Hike')).toHaveLength(1)
  })

  it('rejects updating a missing type', async () => {
    await expect(updateMeetupType('nope', { name: 'X', emoji: '✨' })).rejects.toThrow(
      'This meetup type no longer exists.',
    )
  })
})
