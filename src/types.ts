import type { ISODate } from './lib/dates'

export interface Friend {
  id: string
  name: string
  groupId: string | null
  /** JPEG data URL, longest side ≤ 400px */
  photo: string | null
  notes: string
  /** Short items in the order added, oldest first. See src/lib/preferences.ts for the rules. */
  likes: string[]
  dislikes: string[]
  createdAt: string
}

export interface Group {
  id: string
  name: string
}

export interface MeetupType {
  id: string
  name: string
  emoji: string
  order: number
}

export interface Meetup {
  id: string
  date: ISODate
  typeId: string
  friendIds: string[]
  note: string
  createdAt: string
}
