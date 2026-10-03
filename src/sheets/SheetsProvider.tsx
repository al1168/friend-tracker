import { useMemo, useState, type ReactNode } from 'react'
import { FriendSheet } from './FriendSheet'
import { SheetsContext, type FriendSheetRequest, type SheetsApi } from './sheetsContext'

export function SheetsProvider({ children }: { children: ReactNode }) {
  const [friendRequest, setFriendRequest] = useState<FriendSheetRequest | null>(null)
  const [friendKey, setFriendKey] = useState(0)

  const api = useMemo<SheetsApi>(
    () => ({
      openFriendSheet: (request = {}) => {
        setFriendKey((key) => key + 1)
        setFriendRequest(request)
      },
    }),
    [],
  )

  return (
    <SheetsContext.Provider value={api}>
      {children}
      <FriendSheet key={friendKey} request={friendRequest} onClose={() => setFriendRequest(null)} />
    </SheetsContext.Provider>
  )
}
