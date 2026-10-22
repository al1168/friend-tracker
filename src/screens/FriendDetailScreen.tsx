import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { IconPlus } from '../components/icons'
import { InsetGroup, Row, Section } from '../components/InsetGroup'
import { LogButton } from '../components/LogButton'
import { MeetupRow } from '../components/MeetupRow'
import { MonthBars } from '../components/MonthBars'
import { Page, type NavState } from '../components/Page'
import { usePlaceMemory } from '../components/PlaceMemory'
import { StatRow, type StatItem } from '../components/StatRow'
import { useFriend, useFriends, useGroups, useMeetupIdsWithPhotos, useMeetups, useMeetupTypes } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import { describeNextBirthday, formatBirthday } from '../lib/birthdays'
import { daysBetween, formatDate, formatMonthDay, yearOf, type ISODate } from '../lib/dates'
import { formatSince, shortNameById } from '../lib/text'
import { useSheets } from '../sheets/sheetsContext'
import {
  allTimeCountsByFriend,
  countsByFriendByDateLastYear,
  countsByFriendForYear,
  firstYear,
  monthlyCounts,
  sameDateLastYear,
} from '../stats/counts'
import { lastSeenByFriend } from '../stats/lastSeen'
import { FRIEND_HISTORY_ROWS, firstRows, meetupNames, monthSections, type HistorySection } from '../stats/meetupHistory'
import type { MeetupType } from '../types'
import { FriendPreferences } from './FriendPreferences'
import './FriendDetailScreen.css'

export function FriendDetailScreen() {
  const { id } = useParams()
  const friend = useFriend(id)
  const friends = useFriends()
  const groups = useGroups()
  const meetups = useMeetups()
  const types = useMeetupTypes()
  const withPhotos = useMeetupIdsWithPhotos()
  const today = useToday()
  const location = useLocation()
  const { openFriendSheet } = useSheets()

  const data = useMemo(() => {
    if (!friend || !meetups) return null
    const year = yearOf(today)
    // Last year is compared only when it isn't before the first meetup in the app: before that, its zeros say nothing.
    const compares = year > firstYear(meetups, today)
    const theirs = meetups.filter((meetup) => meetup.friendIds.includes(friend.id))
    return {
      year,
      compares,
      lastSeen: lastSeenByFriend(theirs, today).get(friend.id) ?? null,
      thisYear: countsByFriendForYear(theirs, year, today).get(friend.id) ?? 0,
      lastYear: countsByFriendForYear(theirs, year - 1, today).get(friend.id) ?? 0,
      // Last year up to today's date a year ago: this year so far, compared fairly.
      lastYearByDate: countsByFriendByDateLastYear(theirs, today).get(friend.id) ?? 0,
      through: sameDateLastYear(today),
      allTime: allTimeCountsByFriend(theirs, today).get(friend.id) ?? 0,
      current: monthlyCounts(friend.id, theirs, year, today),
      previous: compares ? monthlyCounts(friend.id, theirs, year - 1, today) : undefined,
      history: monthSections(theirs),
      total: theirs.length,
    }
  }, [friend, meetups, today])

  if (friend === null) return <Navigate to="/" replace />
  if (!friend || !friends || !groups || !types || !withPhotos || !data) return null

  const groupName = groups.find((group) => group.id === friend.groupId)?.name
  const typeById = new Map(types.map((type) => [type.id, type] as const))
  // Rows name the others by short name.
  const nameById = shortNameById(friends)
  // A meetup opened from here says the friend's name on its back button, and keeps the tab this page came from.
  const fromFriend: NavState = { backLabel: friend.name, tab: (location.state as NavState | null)?.tab }
  const stats: StatItem[] = [
    { label: 'This year', value: data.thisYear },
    ...(data.compares
      ? [
          {
            label: 'Last year',
            value: data.lastYear,
            // "0 by Oct 22" under a 0 would say nothing.
            note: data.lastYear > 0 ? `${data.lastYearByDate} by ${formatMonthDay(data.through)}` : undefined,
          },
        ]
      : []),
    { label: 'All time', value: data.allTime },
  ]

  return (
    <Page
      title={friend.name}
      back={{ label: 'Friends', fallback: '/' }}
      pushed
      actions={
        <button type="button" className="text-button" onClick={() => openFriendSheet({ friend })}>
          Edit
        </button>
      }
      hero={
        <div className="friend-hero">
          <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={96} />
          <h1 className="friend-hero__name">{friend.name}</h1>
          {groupName && <p className="friend-hero__group">{groupName}</p>}
          <p className="friend-hero__seen">
            {data.lastSeen ? (
              <>
                <span className="friend-hero__seen-part">Last seen {formatDate(data.lastSeen, today)} ·</span>{' '}
                <span className="friend-hero__seen-part">{formatSince(daysBetween(data.lastSeen, today))}</span>
              </>
            ) : (
              'Not seen yet'
            )}
          </p>
        </div>
      }
    >
      {friend.notes && <p className="friend-notes">{friend.notes}</p>}

      <Section title="Birthday">
        {friend.birthday ? (
          <InsetGroup>
            <Row
              onClick={() => openFriendSheet({ friend })}
              leading={
                <span className="emoji-badge" aria-hidden="true">
                  🎂
                </span>
              }
              title={formatBirthday(friend.birthday)}
              subtitle={describeNextBirthday(friend.birthday, today)}
              chevron
            />
          </InsetGroup>
        ) : (
          <div className="chip-wrap">
            <Chip onClick={() => openFriendSheet({ friend })}>
              <IconPlus size={16} strokeWidth={2.4} />
              Add birthday
            </Chip>
          </div>
        )}
      </Section>

      <FriendPreferences key={friend.id} friend={friend} />

      {/* Memories before numbers: History comes before the stat row and the chart. */}
      <Section title="History">
        {data.total === 0 ? (
          <p className="list-message">No meetups yet. Log one when you see them.</p>
        ) : (
          // Remounted per history entry, so "Show all" belongs to this visit of the page.
          <FriendHistory
            key={location.key}
            sections={data.history}
            total={data.total}
            typeById={typeById}
            nameById={nameById}
            friendId={friend.id}
            withPhotos={withPhotos}
            today={today}
            state={fromFriend}
          />
        )}
      </Section>

      {/* No numbers until a meetup has happened: zeros and a flat chart would say nothing. */}
      {data.allTime > 0 && (
        <>
          <StatRow items={stats} />

          <Section title="Month by month">
            <MonthBars current={data.current} previous={data.previous} year={data.year} />
          </Section>
        </>
      )}

      <LogButton presetFriendId={friend.id} />
    </Page>
  )
}

interface FriendHistoryProps {
  /** The friend's meetups, one group per month (monthSections). */
  sections: HistorySection[]
  total: number
  typeById: ReadonlyMap<string, MeetupType>
  /** Short names by id: a row names the others. */
  nameById: ReadonlyMap<string, string>
  friendId: string
  withPhotos: ReadonlySet<string>
  today: ISODate
  /** Router state for a meetup opened from here. */
  state: NavState
}

/**
 * A friend's History: the latest five meetups by month, then "Show all 12 meetups", which shows the rest in place and
 * moves focus to the first meetup it added. Going back to the page keeps it open: the place memory (by history
 * entry) holds it, so the page is as tall as it was and ScrollManager can put it back where it was.
 */
function FriendHistory({
  sections,
  total,
  typeById,
  nameById,
  friendId,
  withPhotos,
  today,
  state,
}: FriendHistoryProps) {
  const { key } = useLocation()
  const places = usePlaceMemory()
  const [all, setAll] = useState(() => places.get(key)?.count === Infinity)
  const firstAdded = useRef<HTMLAnchorElement>(null)
  const focusPending = useRef(false)
  const shown = all ? { sections, more: 0 } : firstRows(sections, FRIEND_HISTORY_ROWS)

  // "Show all" goes away under the finger; focus moves to the first meetup it added, about where it was, so nothing
  // scrolls.
  useEffect(() => {
    if (!focusPending.current) return
    focusPending.current = false
    firstAdded.current?.focus({ preventScroll: true })
  }, [all])

  function showAll() {
    focusPending.current = true
    setAll(true)
    places.set(key, { query: '', count: Infinity })
  }

  let index = 0
  return (
    <>
      {shown.sections.map((section) => (
        <InsetGroup key={section.key} title={section.title} level={3}>
          {section.meetups.map((meetup) => {
            const row = index
            index += 1
            return (
              <MeetupRow
                key={meetup.id}
                meetup={meetup}
                type={typeById.get(meetup.typeId)}
                names={meetupNames(meetup, nameById, friendId)}
                today={today}
                state={state}
                hasPhoto={withPhotos.has(meetup.id)}
                ref={row === FRIEND_HISTORY_ROWS ? firstAdded : undefined}
              />
            )
          })}
        </InsetGroup>
      ))}
      {shown.more > 0 && (
        <InsetGroup>
          <Row onClick={showAll} title={`Show all ${total} meetups`} accent />
        </InsetGroup>
      )}
    </>
  )
}
