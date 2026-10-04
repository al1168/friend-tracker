import { db } from '../db/db'
import type { MeetupPhoto } from '../types'
import { parseBackup, type BackupData, type ParseResult } from './format'

/** Reads everything in one snapshot, every full photo included: only for backups and tests. */
export async function readAllData(): Promise<BackupData> {
  return db.transaction('r', [db.friends, db.groups, db.meetupTypes, db.meetups, db.meetupPhotos], async () => {
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

/** Replaces everything in one transaction. If anything fails, nothing changes. */
export async function replaceAllData(data: BackupData): Promise<void> {
  await db.transaction('rw', [db.friends, db.groups, db.meetupTypes, db.meetups, db.meetupPhotos], async () => {
    await Promise.all([
      db.friends.clear(),
      db.groups.clear(),
      db.meetupTypes.clear(),
      db.meetups.clear(),
      db.meetupPhotos.clear(),
    ])
    await db.groups.bulkAdd(data.groups)
    await db.meetupTypes.bulkAdd(data.meetupTypes)
    await db.friends.bulkAdd(data.friends)
    await db.meetups.bulkAdd(data.meetups)
    await db.meetupPhotos.bulkAdd(data.meetupPhotos)
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
