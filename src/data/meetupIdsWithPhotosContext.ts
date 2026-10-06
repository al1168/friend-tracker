import { createContext } from 'react'

/** Which meetups have photos (see MeetupIdsWithPhotosProvider): undefined while loading, null outside the provider. */
export const MeetupIdsWithPhotosContext = createContext<ReadonlySet<string> | undefined | null>(null)
