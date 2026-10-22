import Dexie, { type EntityTable } from 'dexie'
import { db, type DataTable, type RestoreUndoRow } from '../db/db'
import { forgetPhotoThumbs } from '../db/meetups'
import { getSetting, setSetting, type RestoreUndoInfo } from '../db/settings'
import type { Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'
import { parseBackup, type BackupData, type ParseResult } from './format'

/** How long a restore can be undone. */
export const RESTORE_UNDO_DAYS = 7
const RESTORE_UNDO_MS = RESTORE_UNDO_DAYS * 24 * 60 * 60 * 1000
/** Photos are copied for an undo this many at a time, so it holds at most this many full images at once. */
const PHOTO_BATCH = 20

/** The five tables a backup holds and a restore replaces, by name: never restoreUndo or settings. */
function dataTables() {
  return [db.friends, db.groups, db.meetupTypes, db.meetups, db.meetupPhotos]
}

/** Reads everything in one snapshot, every full photo included: only for backups and tests. */
export async function readAllData(): Promise<BackupData> {
  return db.transaction('r', dataTables(), async () => {
    const [friends, groups, meetupTypes, meetups, meetupPhotos] = await Promise.all([
      db.friends.toArray(),
      db.groups.toArray(),
      db.meetupTypes.orderBy('order').toArray(),
      db.meetups.toArray(),
      db.meetupPhotos.toArray(),
    ])
    return { friends, groups, meetupTypes, meetups, meetupPhotos }
  })
}

/** Every meetup photo, full images included. Only a backup needs them all at once. */
export function readAllPhotos(): Promise<MeetupPhoto[]> {
  return db.meetupPhotos.toArray()
}

/** Empties the five tables and writes `data` into them, inside the caller's transaction. */
async function writeAllData(data: BackupData): Promise<void> {
  await Promise.all(dataTables().map((table) => table.clear()))
  await db.groups.bulkAdd(data.groups)
  await db.meetupTypes.bulkAdd(data.meetupTypes)
  await db.friends.bulkAdd(data.friends)
  await db.meetups.bulkAdd(data.meetups)
  await db.meetupPhotos.bulkAdd(data.meetupPhotos)
}

/** Replaces everything in one transaction. If anything fails, nothing changes. Keeps nothing to undo with. */
export async function replaceAllData(data: BackupData): Promise<void> {
  await db.transaction('rw', dataTables(), () => writeAllData(data))
  // Every photo was replaced, so no thumbnail kept in memory can be trusted.
  forgetPhotoThumbs()
}

function undoRows(table: DataTable, rows: readonly { id: string }[]): RestoreUndoRow[] {
  return rows.map((row) => ({ table, id: row.id, row }))
}

/**
 * Copies what's in the five tables into restoreUndo, inside the caller's transaction, and says how many photos it
 * copied. Friends, groups, types and meetups are small and copied whole (friends' photos are 400px avatars, and
 * meetups hold no images); meetup photos are copied 20 at a time by primary key, so this holds at most 20 full images
 * however many the app has.
 */
async function keepForUndo(): Promise<number> {
  const [friends, groups, meetupTypes, meetups] = await Promise.all([
    db.friends.toArray(),
    db.groups.toArray(),
    db.meetupTypes.toArray(),
    db.meetups.toArray(),
  ])
  await db.restoreUndo.bulkAdd([
    ...undoRows('friends', friends),
    ...undoRows('groups', groups),
    ...undoRows('meetupTypes', meetupTypes),
    ...undoRows('meetups', meetups),
  ])
  let photos = 0
  let lastId: string | null = null
  for (;;) {
    const batch: MeetupPhoto[] = await (lastId === null
      ? db.meetupPhotos.orderBy(':id').limit(PHOTO_BATCH).toArray()
      : db.meetupPhotos.where(':id').above(lastId).limit(PHOTO_BATCH).toArray())
    if (batch.length === 0) return photos
    await db.restoreUndo.bulkAdd(undoRows('meetupPhotos', batch))
    photos += batch.length
    lastId = batch[batch.length - 1].id
  }
}

/**
 * Restores a backup over everything in the app. First, in the same transaction, it keeps what it replaces (friends,
 * groups, meetup types, meetups and their photos) in restoreUndo, replacing any older snapshot, so either both happen
 * or neither. Into an app with no friends and no meetups (a new phone) there's nothing to keep: it keeps none, drops
 * any older one, and the restore can't be undone. Settings data is never part of it, as it's never part of a backup.
 *
 * With `keepUndo: false` it keeps nothing either, and drops any older snapshot: for when there wasn't room for one
 * (the restore failed with a quota error, isQuotaExceeded) and the owner chose "Restore without undo".
 */
export async function restoreBackup(
  data: BackupData,
  now: Date,
  { keepUndo = true }: { keepUndo?: boolean } = {},
): Promise<{ undoable: boolean }> {
  const undoable = await db.transaction('rw', [...dataTables(), db.restoreUndo, db.settings], async () => {
    await db.restoreUndo.clear()
    const [friends, meetups] = await Promise.all([db.friends.count(), db.meetups.count()])
    const kept: RestoreUndoInfo | null =
      keepUndo && (friends > 0 || meetups > 0)
        ? { takenAt: now.toISOString(), friends, meetups, photos: await keepForUndo() }
        : null
    await setSetting('restoreUndo', kept)
    await writeAllData(data)
    return kept !== null
  })
  forgetPhotoThumbs()
  return { undoable }
}

/** The rows of one table restoreUndo keeps, as a range of its [table+id] keys (photos: those after `afterId`). */
function keptRange(table: DataTable, afterId: string | null = null) {
  return db.restoreUndo
    .where('[table+id]')
    .between([table, afterId ?? Dexie.minKey], [table, Dexie.maxKey], afterId === null, true)
}

/** The rows restoreUndo keeps of one table (photos: up to `limit` after `afterId`). */
function keptRows(table: DataTable, afterId: string | null = null, limit = Infinity): Promise<RestoreUndoRow[]> {
  const rows = keptRange(table, afterId)
  return (Number.isFinite(limit) ? rows.limit(limit) : rows).toArray()
}

/**
 * The ids of the friends and meetups a restore's snapshot keeps, read from its keys alone (no row, so no photo), so
 * the "Undo the restore?" confirm can say what in the app now isn't in what's put back. None without a snapshot.
 */
export async function restoreUndoIds(): Promise<{ friendIds: string[]; meetupIds: string[] }> {
  return db.transaction('r', db.restoreUndo, async () => {
    const ids = async (table: DataTable) =>
      (await keptRange(table).primaryKeys()).map((key) => (key as [DataTable, string])[1])
    const [friendIds, meetupIds] = await Promise.all([ids('friends'), ids('meetups')])
    return { friendIds, meetupIds }
  })
}

/** Puts kept rows back in their table, then lets them go from the snapshot at once, in the caller's transaction. */
async function putBack<T extends { id: string }>(table: EntityTable<T, 'id'>, rows: RestoreUndoRow[]): Promise<void> {
  await table.bulkAdd(rows.map(({ row }) => row as T))
  await db.restoreUndo.bulkDelete(rows.map(({ table: name, id }): [DataTable, string] => [name, id]))
}

/**
 * Undoes the last restore: puts back exactly what the app held just before it, in one transaction, and lets the
 * snapshot go. Each part is deleted from the snapshot as soon as it's put back (photos 20 at a time), so the undo
 * never needs room for the data twice over. Resolves false when there's no snapshot.
 */
export async function undoRestore(): Promise<boolean> {
  const undone = await db.transaction('rw', [...dataTables(), db.restoreUndo, db.settings], async () => {
    if ((await getSetting('restoreUndo')) === null || (await db.restoreUndo.count()) === 0) return false
    await Promise.all(dataTables().map((table) => table.clear()))
    await putBack<Group>(db.groups, await keptRows('groups'))
    await putBack<MeetupType>(db.meetupTypes, await keptRows('meetupTypes'))
    await putBack<Friend>(db.friends, await keptRows('friends'))
    await putBack<Meetup>(db.meetups, await keptRows('meetups'))
    let lastId: string | null = null
    for (;;) {
      const batch = await keptRows('meetupPhotos', lastId, PHOTO_BATCH)
      if (batch.length === 0) break
      await putBack<MeetupPhoto>(db.meetupPhotos, batch)
      lastId = batch[batch.length - 1].id
    }
    // Anything left that no table names.
    await db.restoreUndo.clear()
    await setSetting('restoreUndo', null)
    return true
  })
  if (undone) forgetPhotoThumbs()
  return undone
}

/** Whether a restore's snapshot is past its 7 days: Settings stops offering it even before it's deleted. */
export function restoreUndoExpired(kept: RestoreUndoInfo, now: Date): boolean {
  const taken = Date.parse(kept.takenAt)
  return Number.isNaN(taken) || now.getTime() - taken >= RESTORE_UNDO_MS
}

/** Deletes a restore's snapshot once it's 7 days old (and any rows no setting names). Runs on every app start. */
export async function forgetOldRestore(now: Date): Promise<void> {
  await db.transaction('rw', db.restoreUndo, db.settings, async () => {
    const kept = await getSetting('restoreUndo')
    if (kept !== null && !restoreUndoExpired(kept, now)) return
    if (kept === null && (await db.restoreUndo.count()) === 0) return
    await db.restoreUndo.clear()
    await setSetting('restoreUndo', null)
  })
}

export async function parseBackupFile(file: Blob): Promise<ParseResult> {
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    return { ok: false, error: "This file couldn't be read. Pick a .json backup file." }
  }
  return parseBackup(raw)
}
