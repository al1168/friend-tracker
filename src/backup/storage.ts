import { db } from '../db/db'
import { parseBackup, type BackupData, type ParseResult } from './format'

export async function readAllData(): Promise<BackupData> {
  const [friends, groups, meetupTypes, meetups] = await Promise.all([
    db.friends.toArray(),
    db.groups.toArray(),
    db.meetupTypes.orderBy('order').toArray(),
    db.meetups.toArray(),
  ])
  return { friends, groups, meetupTypes, meetups }
}

/** Replaces everything in one transaction. If anything fails, nothing changes. */
export async function replaceAllData(data: BackupData): Promise<void> {
  await db.transaction('rw', [db.friends, db.groups, db.meetupTypes, db.meetups], async () => {
    await Promise.all([db.friends.clear(), db.groups.clear(), db.meetupTypes.clear(), db.meetups.clear()])
    await db.groups.bulkAdd(data.groups)
    await db.meetupTypes.bulkAdd(data.meetupTypes)
    await db.friends.bulkAdd(data.friends)
    await db.meetups.bulkAdd(data.meetups)
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
