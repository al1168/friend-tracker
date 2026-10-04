import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { getSetting, type Settings } from '../db/settings'
import { compareNames } from '../lib/text'
import type { Friend, Group, Meetup, MeetupType } from '../types'

// Each hook returns `undefined` while its first query is loading, then re-renders on every change.

export function useFriends(): Friend[] | undefined {
  return useLiveQuery(() => db.friends.toArray())
}

/** `null` when no friend has this id. */
export function useFriend(id: string | undefined): Friend | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.friends.get(id)) ?? null) : null), [id])
}

export function useGroups(): Group[] | undefined {
  return useLiveQuery(async () => (await db.groups.toArray()).sort((a, b) => compareNames(a.name, b.name)))
}

export function useMeetupTypes(): MeetupType[] | undefined {
  return useLiveQuery(() => db.meetupTypes.orderBy('order').toArray())
}

export function useMeetups(): Meetup[] | undefined {
  return useLiveQuery(() => db.meetups.toArray())
}

/** How many meetup photos are stored. A cheap live count: it never reads an image. */
export function usePhotoCount(): number | undefined {
  return useLiveQuery(() => db.meetupPhotos.count())
}

export function useSetting<K extends keyof Settings>(key: K): Settings[K] | undefined {
  return useLiveQuery(() => getSetting(key), [key])
}
