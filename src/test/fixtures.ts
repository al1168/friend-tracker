import type { Friend, Group, Meetup, MeetupType } from '../types'

export const TODAY = '2026-10-02'

export function friend(id: string, name: string, groupId: string | null = null): Friend {
  return { id, name, groupId, photo: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z' }
}

export function meetup(id: string, date: string, friendIds: string[], typeId = 'coffee'): Meetup {
  return { id, date, typeId, friendIds, note: '', createdAt: `${date}T12:00:00.000Z` }
}

export function meetupType(id: string, name: string, order: number, emoji = '☕'): MeetupType {
  return { id, name, emoji, order }
}

export function group(id: string, name: string): Group {
  return { id, name }
}
