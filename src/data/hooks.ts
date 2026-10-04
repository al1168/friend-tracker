import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { firstPhotoThumb, photoById, photoCount, photoThumbs } from '../db/meetups'
import { getSetting, type Settings } from '../db/settings'
import { compareNames } from '../lib/text'
import type { Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'

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

/** `null` when no meetup has this id. */
export function useMeetup(id: string | undefined): Meetup | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.meetups.get(id)) ?? null) : null), [id])
}

/** One photo with its full image: the viewer reads only the photo it shows. `null` when it's gone. */
export function usePhoto(id: string | undefined): MeetupPhoto | null | undefined {
  return useLiveQuery(async () => (id ? photoById(id) : null), [id])
}

/**
 * A meetup's photos as ids and thumbnails, in order: what the meetup sheet and the Meetup page show.
 * Full images are never read here: Dexie's live-query cache would keep them. Empty when there's no meetup yet.
 */
export function useMeetupPhotoThumbs(meetupId: string | undefined): Pick<MeetupPhoto, 'id' | 'thumb'>[] | undefined {
  return useLiveQuery(async () => (meetupId ? photoThumbs(meetupId) : []), [meetupId])
}

/** The thumbnail of a meetup's first photo, or null when it has none: a history row's picture. */
export function useFirstPhotoThumb(meetupId: string): string | null | undefined {
  return useLiveQuery(() => firstPhotoThumb(meetupId), [meetupId])
}

/** How many meetup photos are stored. Counts without reading any image. */
export function usePhotoCount(): number | undefined {
  return useLiveQuery(() => photoCount())
}

export function useSetting<K extends keyof Settings>(key: K): Settings[K] | undefined {
  return useLiveQuery(() => getSetting(key), [key])
}
