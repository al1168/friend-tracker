import { activitiesProblem } from '../lib/activities'
import { isISODate, type ISODate } from '../lib/dates'
import { newId } from '../lib/ids'
import { isValidPhotoData, MAX_PHOTOS, TOO_MANY_PHOTOS } from '../lib/photos'
import { cleanItems } from '../lib/preferences'
import type { Meetup, MeetupPhoto } from '../types'
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

/** A photo the meetup sheet has resized and is adding. Its id is chosen up front, so `order` can place it. */
export type NewPhoto = Pick<MeetupPhoto, 'id' | 'full' | 'thumb' | 'width' | 'height'>

/** Photo changes saved together with a meetup, in the same transaction. */
export interface PhotoChanges {
  add: NewPhoto[]
  /** Photos of this meetup to delete. Ids of other meetups' photos are ignored. */
  removeIds: string[]
  /** Photo ids in their new order. Photos left out keep their order after these. */
  order: string[]
}

export const NO_PHOTO_CHANGES: PhotoChanges = { add: [], removeIds: [], order: [] }

export const PHOTO_NOT_SAVED = "A photo couldn't be saved."

/** A deleted meetup and its photos, kept so Undo can put both back. */
export interface DeletedMeetup {
  meetup: Meetup
  photos: MeetupPhoto[]
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

function checkPhotos(changes: PhotoChanges) {
  if (!changes.add.every((photo) => photo.id && isValidPhotoData(photo))) throw new ValidationError(PHOTO_NOT_SAVED)
}

/**
 * Applies a photo change set to one meetup's photos. Runs inside the caller's transaction, so if
 * anything here fails, the meetup write rolls back with it.
 */
async function applyPhotoChanges(meetupId: string, changes: PhotoChanges, createdAt: string): Promise<void> {
  const { add, removeIds, order } = changes
  if (add.length === 0 && removeIds.length === 0 && order.length === 0) return
  const existing = await db.meetupPhotos.where('meetupId').equals(meetupId).sortBy('order')
  const removing = new Set(removeIds)
  const kept = existing.filter((photo) => !removing.has(photo.id))
  if (kept.length + add.length > MAX_PHOTOS) throw new ValidationError(TOO_MANY_PHOTOS)

  // Listed ids first, in the listed order; then the rest, kept photos before added ones.
  const position = new Map(order.map((id, index) => [id, index] as const))
  const finalOrder = [...kept, ...add]
    .map((photo, index) => ({ id: photo.id, rank: position.get(photo.id) ?? order.length + index }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ id }) => id)
  const orderOf = new Map(finalOrder.map((id, index) => [id, index] as const))

  const removed = existing.filter((photo) => removing.has(photo.id)).map((photo) => photo.id)
  if (removed.length > 0) await db.meetupPhotos.bulkDelete(removed)
  for (const photo of kept) {
    const newOrder = orderOf.get(photo.id)!
    if (photo.order !== newOrder) await db.meetupPhotos.update(photo.id, { order: newOrder })
  }
  await db.meetupPhotos.bulkAdd(
    add.map(({ id, full, thumb, width, height }) => ({
      id,
      meetupId,
      order: orderOf.get(id)!,
      full,
      thumb,
      width,
      height,
      createdAt,
    })),
  )
}

export async function addMeetup(input: MeetupInput, photos: PhotoChanges = NO_PHOTO_CHANGES): Promise<Meetup> {
  const meetup: Meetup = { id: newId(), ...clean(input), createdAt: new Date().toISOString() }
  checkPhotos(photos)
  await db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
    await db.meetups.add(meetup)
    await applyPhotoChanges(meetup.id, photos, meetup.createdAt)
  })
  return meetup
}

export async function updateMeetup(id: string, input: MeetupInput, photos: PhotoChanges = NO_PHOTO_CHANGES): Promise<void> {
  const { date, typeId, friendIds, note, activities } = clean(input)
  checkPhotos(photos)
  await db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
    if (!(await db.meetups.get(id))) throw new ValidationError('This meetup no longer exists.')
    await db.meetups.update(id, { date, typeId, friendIds, note, activities })
    await applyPhotoChanges(id, photos, new Date().toISOString())
  })
}

/** Deletes a meetup and its photos, and returns them so `restoreMeetup` can put them back (Undo). */
export async function deleteMeetup(id: string): Promise<DeletedMeetup | undefined> {
  return db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
    const meetup = await db.meetups.get(id)
    if (!meetup) return undefined
    const photos = await db.meetupPhotos.where('meetupId').equals(id).sortBy('order')
    await db.meetupPhotos.bulkDelete(photos.map((photo) => photo.id))
    await db.meetups.delete(id)
    return { meetup, photos }
  })
}

/**
 * Undo: puts a meetup and its photos back, dropping friends who were deleted since.
 * Does nothing if it would be empty or its type is gone.
 */
export async function restoreMeetup({ meetup, photos }: DeletedMeetup): Promise<boolean> {
  return db.transaction('rw', [db.meetups, db.meetupPhotos, db.friends, db.meetupTypes], async () => {
    const existing = await db.friends.bulkGet(meetup.friendIds)
    const friendIds = meetup.friendIds.filter((_, i) => existing[i] !== undefined)
    if (friendIds.length === 0) return false
    if (!(await db.meetupTypes.get(meetup.typeId))) return false
    await db.meetups.put({ ...meetup, friendIds })
    await db.meetupPhotos.bulkPut(photos)
    return true
  })
}

/** How many meetup photos are stored, across all meetups. */
export function photoCount(): Promise<number> {
  return db.meetupPhotos.count()
}
