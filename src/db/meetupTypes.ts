import { newId } from '../lib/ids'
import { firstGrapheme, plural, sameName } from '../lib/text'
import type { MeetupType } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

export interface MeetupTypeInput {
  name: string
  emoji: string
}

/** Must be called inside a transaction on db.meetupTypes so the check and the write are atomic. */
async function clean(input: MeetupTypeInput, exceptId?: string): Promise<MeetupTypeInput> {
  const name = input.name.trim()
  if (!name) throw new ValidationError('Please enter a name.')
  const emoji = firstGrapheme(input.emoji)
  if (!emoji) throw new ValidationError('Please pick an emoji.')
  const types = await db.meetupTypes.toArray()
  if (types.some((type) => type.id !== exceptId && sameName(type.name, name))) {
    throw new ValidationError('You already have a type with that name.')
  }
  return { name, emoji }
}

export async function addMeetupType(input: MeetupTypeInput): Promise<MeetupType> {
  return db.transaction('rw', db.meetupTypes, async () => {
    const cleaned = await clean(input)
    const last = await db.meetupTypes.orderBy('order').last()
    const type: MeetupType = { id: newId(), ...cleaned, order: (last?.order ?? -1) + 1 }
    await db.meetupTypes.add(type)
    return type
  })
}

export async function updateMeetupType(id: string, input: MeetupTypeInput): Promise<void> {
  await db.transaction('rw', db.meetupTypes, async () => {
    if (!(await db.meetupTypes.get(id))) throw new ValidationError('This meetup type no longer exists.')
    await db.meetupTypes.update(id, await clean(input, id))
  })
}

/** Swaps a type with its neighbor above (-1) or below (1). */
export async function moveMeetupType(id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.meetupTypes, async () => {
    const types = await db.meetupTypes.orderBy('order').toArray()
    const index = types.findIndex((type) => type.id === id)
    const target = index + direction
    if (index === -1 || target < 0 || target >= types.length) return
    const current = types[index]
    const neighbor = types[target]
    await db.meetupTypes.update(current.id, { order: neighbor.order })
    await db.meetupTypes.update(neighbor.id, { order: current.order })
  })
}

export async function countMeetupsUsingType(id: string): Promise<number> {
  return db.meetups.where('typeId').equals(id).count()
}

export async function deleteMeetupType(id: string): Promise<void> {
  await db.transaction('rw', db.meetupTypes, db.meetups, async () => {
    const used = await db.meetups.where('typeId').equals(id).count()
    if (used > 0) {
      throw new ValidationError(
        `This type is used by ${plural(used, 'meetup')}, so it can't be deleted. You can rename it instead.`,
      )
    }
    if ((await db.meetupTypes.count()) <= 1) throw new ValidationError('You need at least one meetup type.')
    await db.meetupTypes.delete(id)
  })
}
