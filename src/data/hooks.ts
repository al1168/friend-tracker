import { useLiveQuery } from 'dexie-react-hooks'
import { useContext } from 'react'
import { db } from '../db/db'
import { firstPhotoThumb, meetupIdsWithPhotosAmong, photoById, photoCount, photoThumbs } from '../db/meetups'
import { getSetting, type Settings } from '../db/settings'
import { compareNames } from '../lib/text'
import type { Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'
import { MeetupIdsWithPhotosContext } from './meetupIdsWithPhotosContext'

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

/** The thumbnail of a meetup's first photo, or null when it has none: a meetup row's picture. */
export function useFirstPhotoThumb(meetupId: string): string | null | undefined {
  return useLiveQuery(() => firstPhotoThumb(meetupId), [meetupId])
}

/**
 * Which meetups have photos, so a meetup row knows from its first render whether it ends with a thumbnail. A
 * key-only walk of an index (no photo is read), kept live for the whole app by MeetupIdsWithPhotosProvider.
 */
export function useMeetupIdsWithPhotos(): ReadonlySet<string> | undefined {
  const ids = useContext(MeetupIdsWithPhotosContext)
  if (ids === null) throw new Error('useMeetupIdsWithPhotos must be used inside MeetupIdsWithPhotosProvider')
  return ids
}

/**
 * Which of a few meetups have photos, kept live: a bounded read for a screen that shows only a few rows, so it
 * never waits for the app-wide walk. `undefined` while `meetupIds` is (its data is loading) and until the first
 * answer; when the ids change, the last answer stays until the new one arrives, so the screen never blanks.
 */
export function useMeetupIdsWithPhotosAmong(meetupIds: readonly string[] | undefined): ReadonlySet<string> | undefined {
  const key = meetupIds?.join('\n')
  return useLiveQuery(async () => (meetupIds ? meetupIdsWithPhotosAmong(meetupIds) : undefined), [key])
}

/** How many meetup photos are stored. Counts without reading any image. */
export function usePhotoCount(): number | undefined {
  return useLiveQuery(() => photoCount())
}

export function useSetting<K extends keyof Settings>(key: K): Settings[K] | undefined {
  return useLiveQuery(() => getSetting(key), [key])
}
