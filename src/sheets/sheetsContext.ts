import { createContext, useContext } from 'react'
import type { Friend } from '../types'

export interface FriendSheetRequest {
  /** Present when editing; absent when adding. */
  friend?: Friend
}

export interface SheetsApi {
  openFriendSheet: (request?: FriendSheetRequest) => void
}

export const SheetsContext = createContext<SheetsApi | null>(null)

export function useSheets(): SheetsApi {
  const api = useContext(SheetsContext)
  if (!api) throw new Error('useSheets must be used inside SheetsProvider')
  return api
}
