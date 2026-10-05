import type { Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'

export const TODAY = '2026-10-02'

export function friend(id: string, name: string, groupId: string | null = null): Friend {
  return {
    id,
    name,
    groupId,
    photo: null,
    notes: '',
    likes: [],
    dislikes: [],
    birthday: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

export function meetup(id: string, date: string, friendIds: string[], typeId = 'coffee'): Meetup {
  return {
    id,
    date,
    typeId,
    friendIds,
    note: '',
    activities: [],
    weather: [],
    mood: null,
    feelings: '',
    createdAt: `${date}T12:00:00.000Z`,
  }
}

/** A stored photo with tiny stand-in images (not real JPEGs, but the right shape). */
export function meetupPhoto(id: string, meetupId: string, order: number): MeetupPhoto {
  return {
    id,
    meetupId,
    order,
    full: `data:image/jpeg;base64,FULL${id}`,
    thumb: `data:image/jpeg;base64,THUMB${id}`,
    width: 4,
    height: 3,
    createdAt: '2026-09-01T12:00:00.000Z',
  }
}

export function meetupType(id: string, name: string, order: number, emoji = '☕'): MeetupType {
  return { id, name, emoji, order }
}

export function group(id: string, name: string): Group {
  return { id, name }
}
