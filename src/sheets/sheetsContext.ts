import { createContext, useContext } from 'react'
import type { Friend, Meetup } from '../types'

export interface FriendSheetRequest {
  /** Present when editing; absent when adding. */
  friend?: Friend
}

export interface MeetupSheetRequest {
  /** Present when editing; absent when logging a new meetup. */
  meetup?: Meetup
  /** Friend to pre-select when logging from their page. */
  presetFriendId?: string
}

export interface SheetsApi {
  openFriendSheet: (request?: FriendSheetRequest) => void
  openMeetupSheet: (request?: MeetupSheetRequest) => void
}

export const SheetsContext = createContext<SheetsApi | null>(null)

export function useSheets(): SheetsApi {
  const api = useContext(SheetsContext)
  if (!api) throw new Error('useSheets must be used inside SheetsProvider')
  return api
}
