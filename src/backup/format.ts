import { isISODate, type ISODate } from '../lib/dates'
import { cleanItems, indexOfItem, MAX_ITEM_LENGTH, MAX_ITEMS, type PreferenceKind } from '../lib/preferences'
import type { Friend, Group, Meetup, MeetupType } from '../types'

export interface BackupData {
  friends: Friend[]
  groups: Group[]
  meetupTypes: MeetupType[]
  meetups: Meetup[]
}

export interface BackupFile extends BackupData {
  app: 'friend-tracker'
  version: 2
  exportedAt: string
}

export type ParseResult = { ok: true; data: BackupData } | { ok: false; error: string }

export function createBackup(data: BackupData, exportedAt: Date): BackupFile {
  return { app: 'friend-tracker', version: 2, exportedAt: exportedAt.toISOString(), ...data }
}

export function backupFileName(today: ISODate): string {
  return `friend-tracker-backup-${today}.json`
}

/** Validates an untrusted, already-JSON-parsed value. Never throws for bad input. */
export function parseBackup(raw: unknown): ParseResult {
  try {
    return { ok: true, data: readBackup(raw) }
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

/** A version 2 friend's list, cleaned like the app cleans typed items. Empties and repeats are dropped quietly. */
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

function assertUnique(ids: string[], what: string) {
  if (new Set(ids).size !== ids.length) throw new BackupError(`The backup has two ${what} with the same id.`)
}

function readBackup(raw: unknown): BackupData {
  if (!isObj(raw) || raw.app !== 'friend-tracker') throw new BackupError("This isn't a Friend Tracker backup file.")
  const { version } = raw
  if (version !== 1 && version !== 2) {
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
      createdAt: text(r, 'createdAt', where),
    }
  })

  assertUnique(groups.map((g) => g.id), 'groups')
  assertUnique(meetupTypes.map((t) => t.id), 'meetup types')
  assertUnique(friends.map((f) => f.id), 'friends')
  assertUnique(meetups.map((m) => m.id), 'meetups')
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

  return { friends, groups, meetupTypes, meetups }
}
