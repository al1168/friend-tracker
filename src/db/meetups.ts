import { activitiesProblem } from '../lib/activities'
import { isISODate, type ISODate } from '../lib/dates'
import { newId } from '../lib/ids'
import { cleanItems } from '../lib/preferences'
import type { Meetup } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

export interface MeetupInput {
  date: ISODate
  typeId: string
  friendIds: string[]
  note: string
  /** In the order picked. Cleaned like likes: empties and repeats are dropped. */
  activities: string[]
}

function clean(input: MeetupInput): MeetupInput {
  if (!isISODate(input.date)) throw new ValidationError('Please pick a valid date.')
  if (!input.typeId) throw new ValidationError('Please pick a meetup type.')
  const friendIds = [...new Set(input.friendIds)]
  if (friendIds.length === 0) throw new ValidationError('Pick at least one friend.')
  const activities = cleanItems(input.activities)
  const problem = activitiesProblem(activities)
  if (problem) throw new ValidationError(problem)
  return { date: input.date, typeId: input.typeId, friendIds, note: input.note.trim(), activities }
}

export async function addMeetup(input: MeetupInput): Promise<Meetup> {
  const meetup: Meetup = { id: newId(), ...clean(input), createdAt: new Date().toISOString() }
  await db.meetups.add(meetup)
  return meetup
}

export async function updateMeetup(id: string, input: MeetupInput): Promise<void> {
  const { date, typeId, friendIds, note, activities } = clean(input)
  await db.transaction('rw', db.meetups, async () => {
    if (!(await db.meetups.get(id))) throw new ValidationError('This meetup no longer exists.')
    await db.meetups.update(id, { date, typeId, friendIds, note, activities })
  })
}

/** Deletes a meetup and returns it, so it can be put back with `restoreMeetup` (Undo). */
export async function deleteMeetup(id: string): Promise<Meetup | undefined> {
  return db.transaction('rw', db.meetups, async () => {
    const meetup = await db.meetups.get(id)
    if (meetup) await db.meetups.delete(id)
    return meetup
  })
}

/** Undo: puts a meetup back, dropping friends who were deleted since. Does nothing if it would be empty. */
export async function restoreMeetup(meetup: Meetup): Promise<boolean> {
  return db.transaction('rw', db.meetups, db.friends, db.meetupTypes, async () => {
    const existing = await db.friends.bulkGet(meetup.friendIds)
    const friendIds = meetup.friendIds.filter((_, i) => existing[i] !== undefined)
    if (friendIds.length === 0) return false
    if (!(await db.meetupTypes.get(meetup.typeId))) return false
    await db.meetups.put({ ...meetup, friendIds })
    return true
  })
}
