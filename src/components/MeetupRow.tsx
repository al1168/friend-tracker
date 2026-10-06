import { memo, type Ref } from 'react'
import { useFirstPhotoThumb } from '../data/hooks'
import type { ISODate } from '../lib/dates'
import { meetupSubtitle } from '../stats/meetupHistory'
import type { Meetup, MeetupType } from '../types'
import { Row } from './InsetGroup'
import type { NavState } from './Page'
import './MeetupRow.css'

interface MeetupRowProps {
  meetup: Meetup
  /** Undefined when the meetup's type was deleted: the row then reads "Meetup" with ✨. */
  type: MeetupType | undefined
  /** The names after "with", in the meetup's order (see meetupNames). */
  names: string[]
  today: ISODate
  /** Router state for the Meetup page: its back label, and the tab it keeps. */
  state: NavState
  /** Whether the meetup has a photo (from useMeetupIdsWithPhotos), so the thumbnail's box is there from the start. */
  hasPhoto: boolean
  /** Stops the subtitle at this many lines (Recent meetups passes 2). Omitted: the whole subtitle wraps. */
  subtitleLines?: number
  /** The "Upcoming" badge on a future date. False under the Meetups page's "Upcoming" title. Default true. */
  showUpcoming?: boolean
  /** Lets the Meetups page move focus to this row. */
  ref?: Ref<HTMLAnchorElement>
}

/**
 * A meetup row's picture: the meetup's first photo, in a 40px box drawn from the first render, so the row's width
 * is final on first paint and a thumbnail arriving never moves the page. Each row reads only that thumbnail.
 */
export function MeetupThumb({ meetupId }: { meetupId: string }) {
  const thumb = useFirstPhotoThumb(meetupId)
  return (
    <span className="meetup-thumb" aria-hidden="true">
      {thumb && <img className="history-thumb" src={thumb} alt="" />}
    </span>
  )
}

/**
 * One row for a meetup, the same everywhere (a friend's History, Recent meetups, the Meetups page): the type's
 * badge and name, the subtitle, the first photo and a chevron. Tapping it opens the Meetup page.
 */
export const MeetupRow = memo(function MeetupRow({
  meetup,
  type,
  names,
  today,
  state,
  hasPhoto,
  subtitleLines,
  showUpcoming = true,
  ref,
}: MeetupRowProps) {
  const upcoming = showUpcoming && meetup.date > today
  const subtitle = meetupSubtitle(meetup, names, today)
  return (
    <Row
      ref={ref}
      to={`/meetups/${meetup.id}`}
      state={state}
      leading={
        <span className="emoji-badge" aria-hidden="true">
          {type?.emoji ?? '✨'}
        </span>
      }
      title={
        <>
          {type?.name ?? 'Meetup'}
          {upcoming && ' '}
          {upcoming && <span className="upcoming-badge">Upcoming</span>}
        </>
      }
      subtitle={
        subtitleLines ? (
          // The whole subtitle stays in the DOM, so the link's name (what VoiceOver reads) is the full text.
          <span className="meetup-row__clamp" style={{ WebkitLineClamp: subtitleLines }}>
            {subtitle}
          </span>
        ) : (
          subtitle
        )
      }
      trailing={hasPhoto ? <MeetupThumb meetupId={meetup.id} /> : undefined}
      chevron
    />
  )
})
