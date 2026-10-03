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
  birthday: Birthday | null
  createdAt: string
}

/** A month and day, with the year when it's known. See src/lib/birthdays.ts for the rules. */
export interface Birthday {
  /** 1 to 12 */
  month: number
  /** 1 to 31, valid for the month (February allows 29) */
  day: number
  /** 1900 to the current year, or null when unknown */
  year: number | null
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
