import { useId, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useActionSheet } from '../components/ActionSheet'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { EmptyState } from '../components/EmptyState'
import { IconPlus, IconSearch, IconSort } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import { LogButton } from '../components/LogButton'
import { InstallHint } from '../components/InstallHint'
import { MeetupRow } from '../components/MeetupRow'
import { Page, type NavState } from '../components/Page'
import { useFriends, useGroups, useMeetupIdsWithPhotosAmong, useMeetups, useMeetupTypes, useSetting } from '../data/hooks'
import { setSetting } from '../db/settings'
import { useToday } from '../hooks/useToday'
import { describeBirthdayCountdown, describeNextBirthday, upcomingBirthdays, type UpcomingBirthday } from '../lib/birthdays'
import { daysBetween, yearOf, type ISODate } from '../lib/dates'
import { matchFriend, matchSubtitle } from '../lib/friendSearch'
import { isPlainEnter } from '../lib/keys'
import { isStandalone } from '../lib/platform'
import { formatSince, shortName } from '../lib/text'
import { useSheets } from '../sheets/sheetsContext'
import { countsByFriendForYear } from '../stats/counts'
import { lastSeenByFriend } from '../stats/lastSeen'
import { meetupNames, recentMeetups } from '../stats/meetupHistory'
import { FRIEND_SORT_LABELS, sortFriends, type FriendSort } from '../stats/sortFriends'
import type { Friend } from '../types'
import './FriendsScreen.css'

const SORT_KEY = 'friend-tracker:sort'
const SORTS = Object.keys(FRIEND_SORT_LABELS) as FriendSort[]
/** A meetup opened from Recent meetups says "Friends" on its back button. */
const FROM_FRIENDS: NavState = { backLabel: 'Friends' }

function readStoredSort(): FriendSort {
  try {
    const value = localStorage.getItem(SORT_KEY)
    if (SORTS.includes(value as FriendSort)) return value as FriendSort
  } catch {
    // Storage can be unavailable; fall back to the default.
  }
  return 'lastSeen'
}

function storeSort(sort: FriendSort) {
  try {
    localStorage.setItem(SORT_KEY, sort)
  } catch {
    // Not important enough to report.
  }
}

export function FriendsScreen() {
  const friends = useFriends()
  const groups = useGroups()
  const meetups = useMeetups()
  const types = useMeetupTypes()
  const hintDismissed = useSetting('installHintDismissed')
  const today = useToday()
  // The latest past meetup: Recent meetups' one row, on every day.
  const latest = useMemo(() => (meetups ? recentMeetups(meetups, today) : undefined), [meetups, today])
  // Whether it has photos: one key-only read, so the screen the app opens on never waits for the app-wide walk of
  // every meetup with photos (MeetupIdsWithPhotosProvider), which grows with the history.
  const latestWithPhotos = useMeetupIdsWithPhotosAmong(latest?.map((meetup) => meetup.id))
  const { openFriendSheet } = useSheets()
  const showActionSheet = useActionSheet()
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [sort, setSort] = useState<FriendSort>(readStoredSort)

  const activeGroup = groups?.find((group) => group.id === groupFilter) ?? null
  // Searching or filtering hides Birthdays soon and Recent meetups, so the list below stays a plain filtered list.
  const unfiltered = query.trim() === '' && activeGroup === null
  const groupNames = useMemo(() => new Map((groups ?? []).map((group) => [group.id, group.name] as const)), [groups])

  const rows = useMemo(() => {
    if (!friends || !meetups) return []
    const lastSeen = lastSeenByFriend(meetups, today)
    const counts = countsByFriendForYear(meetups, yearOf(today), today)
    return sortFriends(friends, meetups, sort, today)
      .filter((friend) => activeGroup === null || friend.groupId === activeGroup.id)
      .flatMap((friend) => {
        const match = matchFriend(friend, query)
        if (!match) return []
        return [{ friend, match, lastSeen: lastSeen.get(friend.id) ?? null, count: counts.get(friend.id) ?? 0 }]
      })
  }, [friends, meetups, today, sort, activeGroup, query])

  const birthdaysSoon = useMemo(() => upcomingBirthdays(friends ?? [], today), [friends, today])
  const showBirthdaysSoon = birthdaysSoon.length > 0 && unfiltered
  const nameById = useMemo(() => new Map((friends ?? []).map((friend) => [friend.id, friend.name] as const)), [friends])
  const typeById = useMemo(() => new Map((types ?? []).map((type) => [type.id, type] as const)), [types])

  async function chooseSort() {
    const choice = await showActionSheet<FriendSort>({
      title: 'Sort friends by',
      actions: SORTS.map((value) => ({ label: FRIEND_SORT_LABELS[value], value, selected: value === sort })),
    })
    if (choice) {
      setSort(choice)
      storeSort(choice)
    }
  }

  if (!friends || !groups || !meetups || !types || !latest || !latestWithPhotos || hintDismissed === undefined) {
    return null
  }

  return (
    <Page
      title="Friends"
      actions={
        <>
          <button
            type="button"
            className="icon-button"
            onClick={chooseSort}
            aria-label={`Sort: ${FRIEND_SORT_LABELS[sort]}`}
          >
            <IconSort />
          </button>
          <button type="button" className="icon-button" onClick={() => openFriendSheet()} aria-label="Add friend">
            <IconPlus />
          </button>
        </>
      }
    >
      {!hintDismissed && !isStandalone() && (
        <InstallHint onDismiss={() => void setSetting('installHintDismissed', true)} />
      )}

      {friends.length === 0 ? (
        <EmptyState
          title="Add the people you want to keep up with."
          message="Then log a meetup whenever you see them."
          action={
            <button type="button" className="button button--primary" onClick={() => openFriendSheet()}>
              Add friend
            </button>
          }
        />
      ) : (
        <>
          {/* Search and the chips come first, under the title, as in Contacts. Nothing above them ever hides, so
              typing or tapping a chip never moves them. */}
          <div className="friends-filters">
            <label className="search">
              <IconSearch size={18} />
              <input
                type="search"
                className="search__input"
                placeholder="Search"
                aria-label="Search friends"
                enterKeyHint="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (isPlainEnter(event)) event.currentTarget.blur()
                }}
              />
            </label>
            {groups.length > 0 && (
              <div className="chip-row" role="group" aria-label="Filter by group">
                <Chip selected={activeGroup === null} onClick={() => setGroupFilter(null)}>
                  All
                </Chip>
                {groups.map((group) => (
                  <Chip key={group.id} selected={activeGroup?.id === group.id} onClick={() => setGroupFilter(group.id)}>
                    {group.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>

          {showBirthdaysSoon && <BirthdaysSoon birthdays={birthdaysSoon} friends={friends} today={today} />}

          {unfiltered && latest.length > 0 && (
            <InsetGroup
              title="Recent meetups"
              action={
                <Link to="/meetups" className="group-action" aria-label="See all meetups">
                  See all
                </Link>
              }
            >
              {latest.map((meetup) => (
                <MeetupRow
                  key={meetup.id}
                  meetup={meetup}
                  type={typeById.get(meetup.typeId)}
                  names={meetupNames(meetup, nameById)}
                  today={today}
                  state={FROM_FRIENDS}
                  hasPhoto={latestWithPhotos.has(meetup.id)}
                  subtitleLines={2}
                />
              ))}
            </InsetGroup>
          )}

          {rows.length > 0 ? (
            <InsetGroup>
              {rows.map(({ friend, match, lastSeen, count }) => (
                <Row
                  key={friend.id}
                  to={`/friends/${friend.id}`}
                  leading={<Avatar name={friend.name} photo={friend.photo} seed={friend.id} />}
                  title={friend.name}
                  subtitle={[
                    friend.groupId ? groupNames.get(friend.groupId) : undefined,
                    lastSeen ? formatSince(daysBetween(lastSeen, today)) : 'Not seen yet',
                    matchSubtitle(match),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  trailing={
                    <span className="friend-count">
                      <span className="numeric friend-count__value">{count}</span>
                      <span className="friend-count__label">this year</span>
                    </span>
                  }
                />
              ))}
            </InsetGroup>
          ) : (
            <p className="list-message">
              {query.trim()
                ? `No friends match “${query.trim()}”.`
                : `No friends in ${activeGroup?.name ?? 'this group'} yet.`}
            </p>
          )}
        </>
      )}
      {friends.length > 0 && <LogButton />}
    </Page>
  )
}

interface BirthdaysSoonProps {
  /** Every birthday today or in the next 14 days, soonest first, then by name. */
  birthdays: UpcomingBirthday[]
  /** Every friend, so a tile can tell whether its first name is shared. */
  friends: Friend[]
  today: ISODate
}

/**
 * Birthdays soon: one row of tiles that scrolls sideways, each a link to the friend's page with the face, the short
 * name and the countdown. A tile is named in full for VoiceOver, starting with the word it shows ("Brandon Cao, In 2
 * days · turns 27"), so Voice Control's "Tap Brandon" works.
 */
function BirthdaysSoon({ birthdays, friends, today }: BirthdaysSoonProps) {
  const titleId = useId()
  return (
    <section className="birthdays-soon" aria-labelledby={titleId}>
      <h2 id={titleId} className="group-title">
        Birthdays soon
      </h2>
      {/* role="list": Safari drops a list from VoiceOver once its bullets are styled away. */}
      <ul className="birthday-strip snap-strip" role="list">
        {birthdays.map(({ friend, birthday, daysUntil }) => (
          <li key={friend.id}>
            <Link
              to={`/friends/${friend.id}`}
              className="birthday-tile"
              aria-label={`${friend.name}, ${describeNextBirthday(birthday, today)}`}
            >
              <Avatar name={friend.name} photo={friend.photo} seed={friend.id} />
              <span className="birthday-tile__text">
                <span className="birthday-tile__name">{shortName(friend, friends)}</span>
                <span className="birthday-tile__when">{describeBirthdayCountdown(daysUntil)}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
