import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { meetupIdsWithPhotos } from '../db/meetups'
import { MeetupIdsWithPhotosContext } from './meetupIdsWithPhotosContext'

/**
 * One live walk of the photos' meetupId index for the whole app, so a screen opened or gone back to knows at once
 * which of its rows have a photo. The walk takes a step per meetup with photos, so a long list going back would
 * otherwise wait for it every time, and could miss the scroll it returns to. It starts again on every open and
 * every unlock (LockGate unmounts App), so the Friends tab, the screen the app opens on, doesn't wait for it: it
 * asks only about its few recent rows (useMeetupIdsWithPhotosAmong). The Meetups page and the friend page do.
 */
export function MeetupIdsWithPhotosProvider({ children }: { children: ReactNode }) {
  const ids = useLiveQuery(async () => new Set(await meetupIdsWithPhotos()))
  return <MeetupIdsWithPhotosContext.Provider value={ids}>{children}</MeetupIdsWithPhotosContext.Provider>
}
