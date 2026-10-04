// Rules for a meetup's activities, shared by the data layer, the backup parser and the meetup sheet.
// Each activity is cleaned like a like (see src/lib/preferences.ts): trimmed, single-spaced, at most
// 60 characters, and unique ignoring case.

import type { Meetup } from '../types'
import { cleanItem, indexOfItem, itemKey, MAX_ITEM_LENGTH } from './preferences'
import { compareNames } from './text'

/** The most activities one meetup can have. */
export const MAX_ACTIVITIES = 20

export const ACTIVITY_TOO_LONG = `Keep each activity under ${MAX_ITEM_LENGTH} characters.`
export const TOO_MANY_ACTIVITIES = `A meetup can have up to ${MAX_ACTIVITIES} activities.`

/** Suggested until they've been used, after every activity used before. */
export const STARTER_ACTIVITIES = [
  'Board games',
  'Karaoke',
  'Movie',
  'Walk',
  'Concert',
  'Shopping',
  'Cooking',
  'Sports',
  'Beach',
  'Museum',
]

/** What would stop this cleaned list from being saved, or null. */
export function activitiesProblem(activities: readonly string[]): string | null {
  if (activities.some((activity) => activity.length > MAX_ITEM_LENGTH)) return ACTIVITY_TOO_LONG
  if (activities.length > MAX_ACTIVITIES) return TOO_MANY_ACTIVITIES
  return null
}

/**
 * Every activity used before, most used first (then by name), then the starters not used yet.
 * Spellings that differ only in case count as one activity, shown as the latest meetup spells it.
 */
export function activitySuggestions(meetups: readonly Pick<Meetup, 'activities' | 'date' | 'createdAt'>[]): string[] {
  const newestFirst = [...meetups].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const used = new Map<string, { name: string; count: number }>()
  for (const meetup of newestFirst) {
    for (const activity of meetup.activities) {
      const name = cleanItem(activity)
      if (name === '') continue
      const key = itemKey(name)
      const entry = used.get(key)
      if (entry) entry.count += 1
      else used.set(key, { name, count: 1 })
    }
  }
  const names = [...used.values()]
    .sort((a, b) => b.count - a.count || compareNames(a.name, b.name))
    .map((entry) => entry.name)
  return [...names, ...STARTER_ACTIVITIES.filter((starter) => indexOfItem(names, starter) === -1)]
}
