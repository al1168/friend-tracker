import { useMemo, useState, type ReactNode } from 'react'
import { FriendSheet } from './FriendSheet'
import { MeetupSheet } from './MeetupSheet'
import { SheetsContext, type FriendSheetRequest, type MeetupSheetRequest, type SheetsApi } from './sheetsContext'

export function SheetsProvider({ children }: { children: ReactNode }) {
  const [friendRequest, setFriendRequest] = useState<FriendSheetRequest | null>(null)
  const [friendKey, setFriendKey] = useState(0)
  const [meetupRequest, setMeetupRequest] = useState<MeetupSheetRequest | null>(null)
  const [meetupKey, setMeetupKey] = useState(0)

  const api = useMemo<SheetsApi>(
    () => ({
      openFriendSheet: (request = {}) => {
        setFriendKey((key) => key + 1)
        setFriendRequest(request)
      },
      openMeetupSheet: (request = {}) => {
        setMeetupKey((key) => key + 1)
        setMeetupRequest(request)
      },
    }),
    [],
  )

  return (
    <SheetsContext.Provider value={api}>
      {children}
      <FriendSheet key={`friend-${friendKey}`} request={friendRequest} onClose={() => setFriendRequest(null)} />
      <MeetupSheet key={`meetup-${meetupKey}`} request={meetupRequest} onClose={() => setMeetupRequest(null)} />
    </SheetsContext.Provider>
  )
}
