import { createPortal } from 'react-dom'
import { useSheets } from '../sheets/sheetsContext'
import { IconPlus } from './icons'
import './LogButton.css'

/** The "+ Log meetup" pill, always within thumb reach. */
export function LogButton({ presetFriendId }: { presetFriendId?: string }) {
  const { openMeetupSheet } = useSheets()
  return createPortal(
    <button type="button" className="log-button" onClick={() => openMeetupSheet({ presetFriendId })}>
      <IconPlus size={20} strokeWidth={2.6} />
      Log meetup
    </button>,
    document.body,
  )
}
