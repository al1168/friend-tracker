import type { MeetupType } from '../types'

export const DEFAULT_MEETUP_TYPES: MeetupType[] = [
  { id: 'type-coffee', name: 'Coffee', emoji: '☕', order: 0 },
  { id: 'type-meal', name: 'Meal', emoji: '🍽️', order: 1 },
  { id: 'type-drinks', name: 'Drinks', emoji: '🍻', order: 2 },
  { id: 'type-call', name: 'Call', emoji: '📞', order: 3 },
  { id: 'type-activity', name: 'Activity', emoji: '🎳', order: 4 },
  { id: 'type-party', name: 'Party', emoji: '🎉', order: 5 },
  { id: 'type-trip', name: 'Trip', emoji: '✈️', order: 6 },
  { id: 'type-other', name: 'Other', emoji: '✨', order: 7 },
]
