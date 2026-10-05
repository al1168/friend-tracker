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

/** The day's weather. Emoji and labels live in src/lib/weather.ts. */
export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'windy' | 'hot' | 'cold'

/** How a meetup felt to you. Emoji and labels live in src/lib/moods.ts. A word, never a number (the No Score Rule). */
export type Mood = 'heavy' | 'okay' | 'good' | 'great'

export interface Meetup {
  id: string
  date: ISODate
  typeId: string
  friendIds: string[]
  /**
   * The day, in your words ("The day" in the app). This was the one-line note, so every existing note is
   * already a day. Stored exactly as typed (line breaks as \n). Lines that start with "@" read back as
   * places (src/lib/dayText.ts); reading never changes the text.
   */
  note: string
  /** What you did, in the order picked. Cleaned like likes (see src/lib/activities.ts). */
  activities: string[]
  /** Weather picked, in chip order, no repeats. [] when none. */
  weather: Weather[]
  /** One of four faces, or null. Never preselected, scored, averaged, counted or charted. */
  mood: Mood | null
  /** "How it felt", in your words. Stored as typed (line breaks as \n), at most 4,000 characters. '' when none. */
  feelings: string
  createdAt: string
}

/** One photo of a meetup. Stored in its own table, never inside the meetup. */
export interface MeetupPhoto {
  id: string
  meetupId: string
  /** 0-based position in the meetup */
  order: number
  /** JPEG data URL, longest side ≤ 1600px */
  full: string
  /** JPEG data URL, longest side ≤ 320px */
  thumb: string
  /** Size of `full` in pixels */
  width: number
  height: number
  createdAt: string
}
