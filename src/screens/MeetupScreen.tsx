import { useEffect, useId, useRef } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Section } from '../components/InsetGroup'
import { Page, type NavState } from '../components/Page'
import { useFriends, useMeetup, useMeetupPhotos, useMeetupTypes } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import { formatDate } from '../lib/dates'
import { useSheets } from '../sheets/sheetsContext'
import type { Friend } from '../types'
import './MeetupScreen.css'

/** The memory view of one meetup: what, when, who, what you did, the note and the photos. */
export function MeetupScreen() {
  const { id } = useParams()
  const meetup = useMeetup(id)
  const photos = useMeetupPhotos(id)
  const friends = useFriends()
  const types = useMeetupTypes()
  const today = useToday()
  const location = useLocation()
  const navigate = useNavigate()
  const { openMeetupSheet } = useSheets()
  const withId = useId()
  const leftRef = useRef(false)

  // Deleted from the sheet (or never there): go back, like the friend page does for a deleted friend.
  useEffect(() => {
    if (meetup !== null || leftRef.current) return
    leftRef.current = true
    if (location.key === 'default') navigate('/', { replace: true })
    else navigate(-1)
  }, [meetup, location.key, navigate])

  if (!meetup || !photos || !friends || !types) return null

  const type = types.find((t) => t.id === meetup.typeId)
  const title = type?.name ?? 'Meetup'
  const friendById = new Map(friends.map((f) => [f.id, f] as const))
  const people = meetup.friendIds.map((friendId) => friendById.get(friendId)).filter((f): f is Friend => !!f)
  // A friend opened from here says this meetup on its back button, and keeps the tab this page came from.
  const fromHere: NavState = { backLabel: title, tab: (location.state as NavState | null)?.tab }

  return (
    <Page
      title={title}
      back={{ label: 'Back', fallback: '/' }}
      pushed
      actions={
        <button type="button" className="text-button" onClick={() => openMeetupSheet({ meetup })}>
          Edit
        </button>
      }
      hero={
        <div className="meetup-hero">
          <span className="meetup-hero__badge" aria-hidden="true">
            {type?.emoji ?? '✨'}
          </span>
          <h1 className="meetup-hero__title">{title}</h1>
          <p className="meetup-hero__date">
            {formatDate(meetup.date, today)}
            {meetup.date > today && <span className="upcoming-badge">Upcoming</span>}
          </p>
          {people.length > 0 && (
            <div className="meetup-hero__with">
              <span id={withId} className="meetup-hero__with-label">
                With
              </span>
              <ul className="meetup-hero__people" aria-labelledby={withId}>
                {people.map((friend) => (
                  <li key={friend.id}>
                    <Link to={`/friends/${friend.id}`} state={fromHere} className="person-chip">
                      <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={28} />
                      {friend.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      }
    >
      {meetup.activities.length > 0 && (
        <Section title="Activities">
          <ul className="meetup-tags">
            {meetup.activities.map((activity) => (
              <li key={activity} className="meetup-tag">
                {activity}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {meetup.note && (
        <Section title="Note">
          <p className="meetup-note">{meetup.note}</p>
        </Section>
      )}

      {photos.length > 0 && (
        <Section title="Photos">
          <ul className="photo-grid">
            {photos.map((photo, index) => (
              <li key={photo.id} className="photo-tile">
                <img
                  className="photo-tile__image"
                  src={photo.thumb}
                  alt={`Photo ${index + 1} of ${photos.length}`}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  )
}
