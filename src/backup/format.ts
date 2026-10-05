import { activitiesProblem } from '../lib/activities'
import { isValidBirthday } from '../lib/birthdays'
import { addDays, isISODate, todayISO, type ISODate } from '../lib/dates'
import { isPhotoDataUrl, isPixelSize, MAX_FULL_LENGTH, MAX_PHOTOS, MAX_THUMB_LENGTH } from '../lib/photos'
import { cleanItems, indexOfItem, MAX_ITEM_LENGTH, MAX_ITEMS, type PreferenceKind } from '../lib/preferences'
import type { Birthday, Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'

export interface BackupData {
  friends: Friend[]
  groups: Group[]
  meetupTypes: MeetupType[]
  meetups: Meetup[]
  meetupPhotos: MeetupPhoto[]
}

export interface BackupFile extends BackupData {
  app: 'friend-tracker'
  version: 4
  exportedAt: string
}

export type ParseResult = { ok: true; data: BackupData } | { ok: false; error: string }

export function createBackup(data: BackupData, exportedAt: Date): BackupFile {
  return { app: 'friend-tracker', version: 4, exportedAt: exportedAt.toISOString(), ...data }
}

export function backupFileName(today: ISODate): string {
  return `friend-tracker-backup-${today}.json`
}

/**
 * Validates an untrusted, already-JSON-parsed value. Never throws for bad input.
 * `today` is the phone's date. A birthday more than 2 days after it is refused (a small margin is allowed, see birthdayOf).
 */
export function parseBackup(raw: unknown, today: ISODate = todayISO()): ParseResult {
  try {
    return { ok: true, data: readBackup(raw, today) }
  } catch (error) {
    if (error instanceof BackupError) return { ok: false, error: error.message }
    throw error
  }
}

class BackupError extends Error {}

type Obj = Record<string, unknown>

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asObj(value: unknown, where: string): Obj {
  if (!isObj(value)) throw new BackupError(`${where} is not a valid record.`)
  return value
}

function list(record: Obj, key: string): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) throw new BackupError(`The backup is missing its "${key}" list.`)
  return value
}

function text(record: Obj, key: string, where: string, required = false): string {
  const value = record[key]
  if (typeof value !== 'string' || (required && value.trim() === '')) {
    throw new BackupError(`${where} has a missing or invalid "${key}".`)
  }
  return value
}

function nullableText(record: Obj, key: string, where: string): string | null {
  const value = record[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new BackupError(`${where} has a missing or invalid "${key}".`)
  return value
}

/** A friend's list (version 2 on), cleaned like the app cleans typed items. Empties and repeats are dropped quietly. */
function preferenceList(record: Obj, key: PreferenceKind, where: string): string[] {
  const value = record[key]
  const invalid = () => new BackupError(`${where} has an invalid "${key}" list.`)
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw invalid()
  const items = cleanItems(value)
  if (items.length > MAX_ITEMS || items.some((item) => item.length > MAX_ITEM_LENGTH)) throw invalid()
  return items
}

/** An item is never in both lists; one in both (only possible in an edited file) stays in Likes. */
function preferenceLists(record: Obj, where: string): Pick<Friend, PreferenceKind> {
  const likes = preferenceList(record, 'likes', where)
  const dislikes = preferenceList(record, 'dislikes', where).filter((item) => indexOfItem(likes, item) === -1)
  return { likes, dislikes }
}

/** A version 3 friend's birthday: null, or a valid one (copied, so stray fields are dropped). */
function birthdayOf(record: Obj, where: string, today: ISODate): Birthday | null {
  const value = record.birthday
  if (value === null) return null
  // A backup holds birthdays some phone already accepted, so a day or two "early" from time zones or
  // clock changes is not corruption.
  if (!isValidBirthday(value, addDays(today, 2))) throw new BackupError(`${where} has an invalid birthday.`)
  return { month: value.month, day: value.day, year: value.year }
}

/** A version 4 meetup's activities, cleaned like the app cleans them. Empties and repeats are dropped quietly. */
function activityList(record: Obj, where: string): string[] {
  const value = record.activities
  const invalid = () => new BackupError(`${where} has an invalid "activities" list.`)
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw invalid()
  const activities = cleanItems(value)
  if (activitiesProblem(activities) !== null) throw invalid()
  return activities
}

/** A version 4 photo (copied, so stray fields are dropped). Whatever is wrong with it, the message is the same. */
function photoOf(value: unknown, where: string): MeetupPhoto {
  const invalid = () => new BackupError(`${where} is invalid.`)
  if (!isObj(value)) throw invalid()
  const { id, meetupId, order, full, thumb, width, height, createdAt } = value
  if (typeof id !== 'string' || id.trim() === '' || typeof meetupId !== 'string' || typeof createdAt !== 'string') {
    throw invalid()
  }
  if (typeof order !== 'number' || !Number.isInteger(order) || order < 0) throw invalid()
  if (
    !isPhotoDataUrl(full, MAX_FULL_LENGTH) ||
    !isPhotoDataUrl(thumb, MAX_THUMB_LENGTH) ||
    !isPixelSize(width) ||
    !isPixelSize(height)
  ) {
    throw invalid()
  }
  return { id, meetupId, order, full, thumb, width, height, createdAt }
}

function assertUnique(ids: string[], what: string) {
  if (new Set(ids).size !== ids.length) throw new BackupError(`The backup has two ${what} with the same id.`)
}

function readBackup(raw: unknown, today: ISODate): BackupData {
  if (!isObj(raw) || raw.app !== 'friend-tracker') throw new BackupError("This isn't a Friend Tracker backup file.")
  const { version } = raw
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4) {
    throw new BackupError('This backup was made by a different version of Friend Tracker.')
  }

  const groups: Group[] = list(raw, 'groups').map((value, i) => {
    const where = `Group ${i + 1}`
    const r = asObj(value, where)
    return { id: text(r, 'id', where, true), name: text(r, 'name', where, true) }
  })

  const meetupTypes: MeetupType[] = list(raw, 'meetupTypes').map((value, i) => {
    const where = `Meetup type ${i + 1}`
    const r = asObj(value, where)
    const order = r.order
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      throw new BackupError(`${where} has a missing or invalid "order".`)
    }
    return { id: text(r, 'id', where, true), name: text(r, 'name', where, true), emoji: text(r, 'emoji', where, true), order }
  })

  const friends: Friend[] = list(raw, 'friends').map((value, i) => {
    const where = `Friend ${i + 1}`
    const r = asObj(value, where)
    const photo = nullableText(r, 'photo', where)
    if (photo !== null && !photo.startsWith('data:image/')) throw new BackupError(`${where} has an invalid photo.`)
    return {
      id: text(r, 'id', where, true),
      name: text(r, 'name', where, true),
      groupId: nullableText(r, 'groupId', where),
      photo,
      notes: text(r, 'notes', where),
      // Version 1 backups were made before likes and dislikes existed.
      ...(version === 1 ? { likes: [], dislikes: [] } : preferenceLists(r, where)),
      // Versions 1 and 2 were made before birthdays existed.
      birthday: version >= 3 ? birthdayOf(r, where, today) : null,
      createdAt: text(r, 'createdAt', where),
    }
  })

  const meetups: Meetup[] = list(raw, 'meetups').map((value, i) => {
    const where = `Meetup ${i + 1}`
    const r = asObj(value, where)
    const date = text(r, 'date', where)
    if (!isISODate(date)) throw new BackupError(`${where} has an invalid date.`)
    const friendIds = r.friendIds
    if (!Array.isArray(friendIds) || friendIds.length === 0 || !friendIds.every((id) => typeof id === 'string')) {
      throw new BackupError(`${where} has a missing or invalid "friendIds".`)
    }
    return {
      id: text(r, 'id', where, true),
      date,
      typeId: text(r, 'typeId', where, true),
      friendIds: [...new Set(friendIds as string[])],
      note: text(r, 'note', where),
      // Versions 1 to 3 were made before activities existed.
      activities: version === 4 ? activityList(r, where) : [],
      weather: [],
      mood: null,
      feelings: '',
      createdAt: text(r, 'createdAt', where),
    }
  })

  // Versions 1 to 3 were made before photos existed.
  const meetupPhotos: MeetupPhoto[] =
    version === 4 ? list(raw, 'meetupPhotos').map((value, i) => photoOf(value, `Photo ${i + 1}`)) : []

  assertUnique(groups.map((g) => g.id), 'groups')
  assertUnique(meetupTypes.map((t) => t.id), 'meetup types')
  assertUnique(friends.map((f) => f.id), 'friends')
  assertUnique(meetups.map((m) => m.id), 'meetups')
  assertUnique(meetupPhotos.map((p) => p.id), 'photos')
  if (meetupTypes.length === 0) throw new BackupError('The backup has no meetup types.')

  const groupIds = new Set(groups.map((g) => g.id))
  const typeIds = new Set(meetupTypes.map((t) => t.id))
  const friendIdSet = new Set(friends.map((f) => f.id))

  friends.forEach((f, i) => {
    if (f.groupId !== null && !groupIds.has(f.groupId)) {
      throw new BackupError(`Friend ${i + 1} belongs to a group that isn't in the backup.`)
    }
  })
  meetups.forEach((m, i) => {
    if (!typeIds.has(m.typeId)) throw new BackupError(`Meetup ${i + 1} has a type that isn't in the backup.`)
    if (!m.friendIds.every((id) => friendIdSet.has(id))) {
      throw new BackupError(`Meetup ${i + 1} includes a friend who isn't in the backup.`)
    }
  })

  // Every photo belongs to a meetup in the backup, and no meetup has more than 20.
  const meetupIds = new Set(meetups.map((m) => m.id))
  const photosPerMeetup = new Map<string, number>()
  meetupPhotos.forEach((p, i) => {
    const count = (photosPerMeetup.get(p.meetupId) ?? 0) + 1
    photosPerMeetup.set(p.meetupId, count)
    if (!meetupIds.has(p.meetupId) || count > MAX_PHOTOS) throw new BackupError(`Photo ${i + 1} is invalid.`)
  })

  return { friends, groups, meetupTypes, meetups, meetupPhotos }
}
