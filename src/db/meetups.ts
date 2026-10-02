import { isISODate, type ISODate } from '../lib/dates'
import { newId } from '../lib/ids'
import type { Meetup } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

export interface MeetupInput {
  date: ISODate
  typeId: string
  friendIds: string[]
  note: string
}

function clean(input: MeetupInput): MeetupInput {
  if (!isISODate(input.date)) throw new ValidationError('Please pick a valid date.')
  if (!input.typeId) throw new ValidationError('Please pick a meetup type.')
  const friendIds = [...new Set(input.friendIds)]
  if (friendIds.length === 0) throw new ValidationError('Pick at least one friend.')
  return { date: input.date, typeId: input.typeId, friendIds, note: input.note.trim() }
}

export async function addMeetup(input: MeetupInput): Promise<Meetup> {
  const meetup: Meetup = { id: newId(), ...clean(input), createdAt: new Date().toISOString() }
  await db.meetups.add(meetup)
  return meetup
}

export async function updateMeetup(id: string, input: MeetupInput): Promise<void> {
  const { date, typeId, friendIds, note } = clean(input)
  await db.meetups.update(id, { date, typeId, friendIds, note })
}

/** Deletes a meetup and returns it, so it can be put back with `restoreMeetup` (Undo). */
export async function deleteMeetup(id: string): Promise<Meetup | undefined> {
  return db.transaction('rw', db.meetups, async () => {
    const meetup = await db.meetups.get(id)
    if (meetup) await db.meetups.delete(id)
    return meetup
  })
}

export async function restoreMeetup(meetup: Meetup): Promise<void> {
  await db.meetups.put(meetup)
}
