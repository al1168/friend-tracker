import { createContext, useContext, useRef, type ReactNode } from 'react'

/** Where you were on a list: its search and how many rows it showed. */
export interface Place {
  query: string
  count: number
}

const PlaceMemoryContext = createContext<Map<string, Place> | null>(null)

/**
 * Keeps each history entry's place (by `location.key`) in memory, the way ScrollManager keeps scroll positions, so
 * going back to a list finds its search and rows. It lives inside App, which the app lock unmounts, so the lock
 * starts every list fresh. Nothing is stored on the phone.
 */
export function PlaceMemoryProvider({ children }: { children: ReactNode }) {
  const places = useRef(new Map<string, Place>())
  return <PlaceMemoryContext.Provider value={places.current}>{children}</PlaceMemoryContext.Provider>
}

export function usePlaceMemory(): Map<string, Place> {
  const places = useContext(PlaceMemoryContext)
  if (!places) throw new Error('usePlaceMemory must be used inside PlaceMemoryProvider')
  return places
}
