import type { ISODate } from '../lib/dates'
import { compareNames } from '../lib/text'
import type { Friend, Group, Meetup, MeetupType } from '../types'
import { countsByFriendForYear, meetupsInYear } from './counts'

export const NO_GROUP_KEY = '__none__'

export interface BreakdownRow {
  key: string
  label: string
  emoji: string | null
  count: number
  previousCount: number
}

export interface FriendYearRow {
  friend: Friend
  count: number
  previousCount: number
}

function byCounts(a: { count: number; previousCount: number }, b: { count: number; previousCount: number }): number {
  return b.count - a.count || b.previousCount - a.previousCount
}

/** Meetups per type for `year` and the year before. Each meetup counts once. */
export function typeBreakdown(meetups: Meetup[], types: MeetupType[], year: number, today: ISODate): BreakdownRow[] {
  const countTypes = (y: number) => {
    const counts = new Map<string, number>()
    for (const meetup of meetupsInYear(meetups, y, today)) counts.set(meetup.typeId, (counts.get(meetup.typeId) ?? 0) + 1)
    return counts
  }
  const current = countTypes(year)
  const previous = countTypes(year - 1)
  return types
    .map((type) => ({
      key: type.id,
      label: type.name,
      emoji: type.emoji,
      count: current.get(type.id) ?? 0,
      previousCount: previous.get(type.id) ?? 0,
      order: type.order,
    }))
    .filter((row) => row.count > 0 || row.previousCount > 0)
    .sort((a, b) => byCounts(a, b) || a.order - b.order)
    .map(({ key, label, emoji, count, previousCount }) => ({ key, label, emoji, count, previousCount }))
}

/** Meetups per group. A meetup with two friends from one group counts once for that group. */
export function groupBreakdown(
  meetups: Meetup[],
  friends: Friend[],
  groups: Group[],
  year: number,
  today: ISODate,
): BreakdownRow[] {
  const knownGroupIds = new Set(groups.map((g) => g.id))
  const groupOf = new Map(
    friends.map((f) => [f.id, f.groupId !== null && knownGroupIds.has(f.groupId) ? f.groupId : NO_GROUP_KEY] as const),
  )
  const countGroups = (y: number) => {
    const counts = new Map<string, number>()
    for (const meetup of meetupsInYear(meetups, y, today)) {
      const keys = new Set<string>()
      for (const friendId of meetup.friendIds) {
        const key = groupOf.get(friendId)
        if (key !== undefined) keys.add(key)
      }
      for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }
  const current = countGroups(year)
  const previous = countGroups(year - 1)
  const labels = [...groups.map((g) => ({ key: g.id, label: g.name })), { key: NO_GROUP_KEY, label: 'No group' }]
  return labels
    .map(({ key, label }) => ({
      key,
      label,
      emoji: null,
      count: current.get(key) ?? 0,
      previousCount: previous.get(key) ?? 0,
    }))
    .filter((row) => row.count > 0 || row.previousCount > 0)
    .sort((a, b) => byCounts(a, b) || compareNames(a.label, b.label))
}

/** Friends seen most in `year` (at least once), ties broken by name. */
export function topFriends(
  meetups: Meetup[],
  friends: Friend[],
  year: number,
  today: ISODate,
  limit = 10,
): FriendYearRow[] {
  const current = countsByFriendForYear(meetups, year, today)
  const previous = countsByFriendForYear(meetups, year - 1, today)
  return friends
    .map((friend) => ({ friend, count: current.get(friend.id) ?? 0, previousCount: previous.get(friend.id) ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || compareNames(a.friend.name, b.friend.name))
    .slice(0, limit)
}

/** Friends with no meetups (up to today) in `year`, by name. */
export function friendsNotSeenInYear(meetups: Meetup[], friends: Friend[], year: number, today: ISODate): Friend[] {
  const counts = countsByFriendForYear(meetups, year, today)
  return friends.filter((friend) => !counts.has(friend.id)).sort((a, b) => compareNames(a.name, b.name))
}
