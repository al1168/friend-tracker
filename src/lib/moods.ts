import type { Meetup, Mood } from '../types'
import type { ISODate } from './dates'

// The service worker opens the database, which imports this file: nothing here may touch window, document or Intl.

export interface MoodInfo {
  key: Mood
  emoji: string
  label: string
}

/** The four faces, low to high. A mood is a word, never a number (the No Score Rule). */
export const MOODS: readonly MoodInfo[] = [
  { key: 'heavy', emoji: '😔', label: 'Heavy' },
  { key: 'okay', emoji: '🙂', label: 'Okay' },
  { key: 'good', emoji: '😊', label: 'Good' },
  { key: 'great', emoji: '😄', label: 'Great' },
]

export const INVALID_MOOD = 'Please pick a mood from the list.'

export function isMood(value: unknown): value is Mood {
  return typeof value === 'string' && MOODS.some((mood) => mood.key === value)
}

/** The face for a mood, or null for anything unknown. Never throws. */
export function moodInfo(value: unknown): MoodInfo | null {
  return MOODS.find((mood) => mood.key === value) ?? null
}

/** How it felt is for meetups dated today or earlier. */
export function feelingsApply(meetup: Pick<Meetup, 'date'>, today: ISODate): boolean {
  return meetup.date <= today
}
