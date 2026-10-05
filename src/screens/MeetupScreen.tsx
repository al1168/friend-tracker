import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { DayView } from '../components/DayView'
import { InsetGroup, Row, Section } from '../components/InsetGroup'
import { Page, type NavState } from '../components/Page'
import { PhotoViewer } from '../components/PhotoViewer'
import { useFriends, useMeetup, useMeetupPhotoThumbs, useMeetupTypes } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import { formatDate } from '../lib/dates'
import { isDayEmpty, readDay } from '../lib/dayText'
import { feelingsApply, moodInfo } from '../lib/moods'
import { displayText } from '../lib/text'
import { weatherInfo } from '../lib/weather'
import { useSheets } from '../sheets/sheetsContext'
import type { Friend } from '../types'
import './MeetupScreen.css'

/** The memory view of one meetup: what, when, who, what you did, the day, how it felt and the photos. */
export function MeetupScreen() {
  const { id } = useParams()
  const meetup = useMeetup(id)
  const photos = useMeetupPhotoThumbs(id)
  const friends = useFriends()
  const types = useMeetupTypes()
  const today = useToday()
  const location = useLocation()
  const navigate = useNavigate()
  const { openMeetupSheet } = useSheets()
  const withId = useId()
  const leftRef = useRef(false)
  // The photo open in the viewer, by position. Its thumbnail takes focus back when the viewer closes.
  const [viewing, setViewing] = useState<number | null>(null)
  const thumbnails = useRef<(HTMLButtonElement | null)[]>([])

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
  const describePhoto = (index: number) =>
    `Photo ${index + 1} of ${photos.length}, ${title}, ${formatDate(meetup.date, today)}`
  const dayParts = readDay(meetup.note)
  const mood = moodInfo(meetup.mood)
  // Shown with each line's ends trimmed and no blank lines around it; stored as typed.
  const feltWords = displayText(meetup.feelings)
  const showFelt = feelingsApply(meetup, today) && (mood !== null || feltWords !== '')
  const dayEmpty = isDayEmpty(meetup)

  function closeViewer() {
    if (viewing !== null) thumbnails.current[viewing]?.focus()
    setViewing(null)
  }

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
            {meetup.weather.length > 0 && ' · '}
            {meetup.weather.map((key, index) => {
              const { emoji, label } = weatherInfo(key)
              return (
                <Fragment key={key}>
                  {index > 0 && ', '}
                  {/* Kept on one line, so a wrap never leaves the emoji without its word. */}
                  <span className="meetup-hero__weather">
                    <span aria-hidden="true">{emoji} </span>
                    {label}
                  </span>
                </Fragment>
              )
            })}
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

      {dayParts.length > 0 && (
        <Section title="The day">
          <DayView parts={dayParts} people={people} />
        </Section>
      )}

      {showFelt && (
        <Section title="How it felt">
          <div className="felt-box">
            {mood && (
              <p className="felt-box__mood">
                <span className="felt-box__face" aria-hidden="true">
                  {mood.emoji}
                </span>
                <span>
                  <span className="visually-hidden">Mood: </span>
                  {mood.label}
                </span>
              </p>
            )}
            {feltWords !== '' && <p className="felt-box__words">{feltWords}</p>}
          </div>
        </Section>
      )}

      <InsetGroup>
        <Row
          to={`/meetups/${meetup.id}/day`}
          leading={
            <span className="emoji-badge" aria-hidden="true">
              📝
            </span>
          }
          title={dayEmpty ? 'Write about the day' : 'Edit the day'}
          subtitle={dayEmpty ? 'Places, what happened, how it felt' : undefined}
          accent={dayEmpty}
          chevron
        />
      </InsetGroup>

      {photos.length > 0 && (
        <Section title="Photos">
          <ul className="photo-grid">
            {photos.map((photo, index) => (
              <li key={photo.id} className="photo-tile">
                <button
                  ref={(element) => {
                    thumbnails.current[index] = element
                  }}
                  type="button"
                  className="photo-tile__open"
                  onClick={() => setViewing(index)}
                >
                  <img
                    className="photo-tile__image"
                    src={photo.thumb}
                    alt={`Photo ${index + 1} of ${photos.length}`}
                  />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {viewing !== null && (
        <PhotoViewer
          photos={photos}
          index={Math.min(viewing, photos.length - 1)}
          onIndexChange={setViewing}
          onClose={closeViewer}
          describe={describePhoto}
        />
      )}
    </Page>
  )
}
