import { newId } from '../lib/ids'
import { sameName } from '../lib/text'
import type { Group } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

async function cleanName(name: string, exceptId?: string): Promise<string> {
  const trimmed = name.trim()
  if (!trimmed) throw new ValidationError('Please enter a group name.')
  const groups = await db.groups.toArray()
  if (groups.some((group) => group.id !== exceptId && sameName(group.name, trimmed))) {
    throw new ValidationError('You already have a group with that name.')
  }
  return trimmed
}

export async function addGroup(name: string): Promise<Group> {
  const group: Group = { id: newId(), name: await cleanName(name) }
  await db.groups.add(group)
  return group
}

export async function renameGroup(id: string, name: string): Promise<void> {
  await db.groups.update(id, { name: await cleanName(name, id) })
}

/** Deletes a group; its friends become ungrouped. */
export async function deleteGroup(id: string): Promise<void> {
  await db.transaction('rw', db.groups, db.friends, async () => {
    await db.friends.where('groupId').equals(id).modify({ groupId: null })
    await db.groups.delete(id)
  })
}
