import { describe, expect, it } from 'vitest'
import { meetup } from '../test/fixtures'
import {
  ACTIVITY_TOO_LONG,
  activitiesProblem,
  activitySuggestions,
  MAX_ACTIVITIES,
  STARTER_ACTIVITIES,
  TOO_MANY_ACTIVITIES,
} from './activities'

/** A meetup with these activities on this date. */
function did(date: string, activities: string[], id = `m-${date}-${activities.join()}`) {
  return { ...meetup(id, date, ['alex']), activities }
}

describe('limits', () => {
  it('allows 20 activities per meetup', () => {
    expect(MAX_ACTIVITIES).toBe(20)
    expect(TOO_MANY_ACTIVITIES).toBe('A meetup can have up to 20 activities.')
    expect(ACTIVITY_TOO_LONG).toBe('Keep each activity under 60 characters.')
  })
})

describe('activitiesProblem', () => {
  it('accepts up to 20 activities of up to 60 characters', () => {
    expect(activitiesProblem([])).toBeNull()
    expect(activitiesProblem(['x'.repeat(60)])).toBeNull()
    expect(activitiesProblem(Array.from({ length: 20 }, (_, i) => `Activity ${i + 1}`))).toBeNull()
  })

  it('refuses a long activity or too many', () => {
    expect(activitiesProblem(['x'.repeat(61)])).toBe(ACTIVITY_TOO_LONG)
    expect(activitiesProblem(Array.from({ length: 21 }, (_, i) => `Activity ${i + 1}`))).toBe(TOO_MANY_ACTIVITIES)
  })
})

describe('activitySuggestions', () => {
  it('suggests the starters when nothing has been used', () => {
    expect(activitySuggestions([])).toEqual(STARTER_ACTIVITIES)
    expect(STARTER_ACTIVITIES).toEqual([
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
    ])
  })

  it('puts used activities first, most used first, then by name', () => {
    const suggestions = activitySuggestions([
      did('2026-09-01', ['Pottery', 'Walk']),
      did('2026-09-02', ['Walk', 'Arcade']),
      did('2026-09-03', ['Pottery', 'Walk']),
      did('2026-09-04', ['Bowling']),
    ])
    expect(suggestions.slice(0, 4)).toEqual(['Walk', 'Pottery', 'Arcade', 'Bowling'])
  })

  it('leaves out starters that have been used, ignoring case', () => {
    const suggestions = activitySuggestions([did('2026-09-01', ['karaoke', 'Pottery'])])
    expect(suggestions).toEqual([
      'karaoke',
      'Pottery',
      ...STARTER_ACTIVITIES.filter((starter) => starter !== 'Karaoke'),
    ])
  })

  it('counts spellings that differ in case as one, spelled like the latest meetup', () => {
    const suggestions = activitySuggestions([
      did('2026-09-01', ['board games']),
      did('2026-09-05', ['Board Games']),
      { ...did('2026-09-05', ['BOARD GAMES'], 'older-same-day'), createdAt: '2026-09-04T12:00:00.000Z' },
    ])
    expect(suggestions[0]).toBe('Board Games')
    expect(suggestions.filter((name) => name.toLocaleLowerCase() === 'board games')).toHaveLength(1)
  })

  it('cleans stored spellings and skips empty ones', () => {
    expect(activitySuggestions([did('2026-09-01', ['  Pottery   class ', ' '])]).slice(0, 2)).toEqual([
      'Pottery class',
      'Board games',
    ])
  })
})
