import { activitiesProblem } from '../lib/activities'
import { isISODate, type ISODate } from '../lib/dates'
import { FEELINGS_MAX, normalizeLineBreaks, TOO_LONG_FEELINGS } from '../lib/dayText'
import { newId } from '../lib/ids'
import { INVALID_MOOD, isMood } from '../lib/moods'
import { isValidPhotoData, MAX_PHOTOS, TOO_MANY_PHOTOS } from '../lib/photos'
import { cleanItems } from '../lib/preferences'
import { cleanWeather } from '../lib/weather'
import type { Meetup, MeetupPhoto } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

export interface MeetupInput {
  date: ISODate
  typeId: string
  friendIds: string[]
  /** In the order picked. Cleaned like likes: empties and repeats are dropped. */
  activities: string[]
}

/** The day page's fields. Only the fields given are written. */
export type DayInput = Partial<Pick<Meetup, 'note' | 'weather' | 'mood' | 'feelings'>>

/** A photo the meetup sheet has resized and is adding. Its id is chosen up front, so `order` can place it. */
export type NewPhoto = Pick<MeetupPhoto, 'id' | 'full' | 'thumb' | 'width' | 'height'>

/** Photo changes saved together with a meetup, in the same transaction. */
export interface PhotoChanges {
  add: readonly NewPhoto[]
  /** Photos of this meetup to delete. Ids of other meetups' photos are ignored. */
  removeIds: readonly string[]
  /** Photo ids in their new order. Photos left out keep their order after these. */
  order: readonly string[]
}

export const NO_PHOTO_CHANGES: PhotoChanges = Object.freeze({
  add: Object.freeze([]),
  removeIds: Object.freeze([]),
  order: Object.freeze([]),
})

const PHOTO_NOT_SAVED = "A photo couldn't be saved."

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
  return { date: input.date, typeId: input.typeId, friendIds, activities }
}

/**
 * The day's fields as they are kept: line breaks normalized and weather cleaned, with your words otherwise
 * exactly as typed. An unknown mood or feelings over 4,000 characters are refused (only code can reach either).
 */
function cleanDay(input: DayInput): DayInput {
  const day: DayInput = {}
  if (input.note !== undefined) day.note = normalizeLineBreaks(input.note)
  if (input.weather !== undefined) day.weather = cleanWeather(input.weather)
  if (input.mood !== undefined) {
    if (input.mood !== null && !isMood(input.mood)) throw new ValidationError(INVALID_MOOD)
    day.mood = input.mood
  }
  if (input.feelings !== undefined) {
    const feelings = normalizeLineBreaks(input.feelings)
    if (feelings.length > FEELINGS_MAX) throw new ValidationError(TOO_LONG_FEELINGS)
    day.feelings = feelings
  }
  return day
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
  const meetup: Meetup = {
    id: newId(),
    ...clean(input),
    note: '',
    weather: [],
    mood: null,
    feelings: '',
    createdAt: new Date().toISOString(),
  }
  checkPhotos(photos)
  await db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
    await db.meetups.add(meetup)
    await applyPhotoChanges(meetup.id, photos, meetup.createdAt)
  })
  return meetup
}

/**
 * Saves the sheet's fields and photo changes. It never reads or writes the day's fields, so an Edit
 * meetup save can't overwrite a day being written on the day page.
 */
export async function updateMeetup(id: string, input: MeetupInput, photos: PhotoChanges = NO_PHOTO_CHANGES): Promise<void> {
  const { date, typeId, friendIds, activities } = clean(input)
  checkPhotos(photos)
  await db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
    if (!(await db.meetups.get(id))) throw new ValidationError('This meetup no longer exists.')
    await db.meetups.update(id, { date, typeId, friendIds, activities })
    await applyPhotoChanges(id, photos, new Date().toISOString())
  })
  forgetThumbs(photos.removeIds)
}

/**
 * Saves the day page's fields: only the fields given, and never the date, type, friends or activities.
 * Resolves false, and never throws for this, when the meetup is gone (a partial update, never a put, so a
 * deleted meetup can't come back).
 */
export async function updateDay(id: string, input: DayInput): Promise<boolean> {
  const fields = cleanDay(input)
  return db.transaction('rw', db.meetups, async () => {
    if (!(await db.meetups.get(id))) return false
    await db.meetups.update(id, fields)
    return true
  })
}

/** Deletes a meetup and its photos, and returns them so `restoreMeetup` can put them back (Undo). */
export async function deleteMeetup(id: string): Promise<DeletedMeetup | undefined> {
  const deleted = await db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
    const meetup = await db.meetups.get(id)
    if (!meetup) return undefined
    const photos = await db.meetupPhotos.where('meetupId').equals(id).sortBy('order')
    await db.meetupPhotos.bulkDelete(photos.map((photo) => photo.id))
    await db.meetups.delete(id)
    return { meetup, photos }
  })
  if (deleted) forgetThumbs(deleted.photos.map((photo) => photo.id))
  return deleted
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

/** The most thumbnails kept in memory: past it, the least recently used goes first. */
const THUMB_CACHE_SIZE = 300

/**
 * Thumbnails by photo id, least recently used first (a Map keeps insertion order). A photo's thumbnail never
 * changes (an edit only changes `order`, and Undo puts back the same ids with the same thumbnails), so its id is
 * enough. In memory only: nothing is stored.
 */
const thumbCache = new Map<string, string>()

function cachedThumb(id: string): string | undefined {
  const thumb = thumbCache.get(id)
  if (thumb !== undefined) {
    // Used again: move it to the newest end.
    thumbCache.delete(id)
    thumbCache.set(id, thumb)
  }
  return thumb
}

function cacheThumb(id: string, thumb: string) {
  thumbCache.delete(id)
  thumbCache.set(id, thumb)
  if (thumbCache.size > THUMB_CACHE_SIZE) {
    const oldest = thumbCache.keys().next()
    if (!oldest.done) thumbCache.delete(oldest.value)
  }
}

function forgetThumbs(ids: readonly string[]) {
  for (const id of ids) thumbCache.delete(id)
}

/** Empties the thumbnail cache (a backup restore replaces every photo). */
export function forgetPhotoThumbs() {
  thumbCache.clear()
}

/**
 * The thumbnail of a meetup's first photo, or null when it has none. Reads the first photo's id through the
 * [meetupId+order] index without loading it, so a live query still follows photos added, removed or reordered,
 * then takes the thumbnail from the cache, or reads that one photo once and keeps only its thumbnail.
 */
export async function firstPhotoThumb(meetupId: string): Promise<string | null> {
  // Key-only, then get: Dexie's live-query cache keeps whole rows of record queries, full images included.
  const [id] = await db.meetupPhotos
    .where('[meetupId+order]')
    .between([meetupId, -Infinity], [meetupId, Infinity])
    .limit(1)
    .primaryKeys()
  if (!id) return null
  const cached = cachedThumb(id)
  if (cached !== undefined) return cached
  // IndexedDB can't read part of a record, so this reads the full image too, and drops it at once.
  const thumb = (await db.meetupPhotos.get(id))?.thumb
  if (thumb === undefined) return null
  cacheThumb(id, thumb)
  return thumb
}

/** The ids of the meetups that have photos, each once: a key-only walk of the meetupId index, reading no image. */
export async function meetupIdsWithPhotos(): Promise<string[]> {
  return (await db.meetupPhotos.orderBy('meetupId').uniqueKeys()) as string[]
}

/** A meetup's photos as ids and thumbnails, in order. Never returns a full image (see firstPhotoThumb). */
export async function photoThumbs(meetupId: string): Promise<Pick<MeetupPhoto, 'id' | 'thumb'>[]> {
  const ids = await db.meetupPhotos.where('meetupId').equals(meetupId).primaryKeys()
  const rows = await db.meetupPhotos.bulkGet(ids)
  return rows
    .filter((row): row is MeetupPhoto => !!row)
    .sort((a, b) => a.order - b.order)
    .map(({ id, thumb }) => ({ id, thumb }))
}

/** One photo with its full image, or null: the viewer reads only the photo it shows. */
export async function photoById(id: string): Promise<MeetupPhoto | null> {
  return (await db.meetupPhotos.get(id)) ?? null
}

/** How many meetup photos are stored, across all meetups. */
export function photoCount(): Promise<number> {
  return db.meetupPhotos.count()
}
