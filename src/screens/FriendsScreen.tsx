import { useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { useFriends, useGroups, useMeetupIdsWithPhotos, useMeetups, useMeetupTypes, useSetting } from '../data/hooks'
import { setSetting } from '../db/settings'
import { useToday } from '../hooks/useToday'
import { describeNextBirthday, upcomingBirthdays } from '../lib/birthdays'
import { daysBetween, yearOf } from '../lib/dates'
import { matchFriend, matchSubtitle } from '../lib/friendSearch'
import { isPlainEnter } from '../lib/keys'
import { isStandalone } from '../lib/platform'
import { formatSince } from '../lib/text'
import { useSheets } from '../sheets/sheetsContext'
import { countsByFriendForYear } from '../stats/counts'
import { lastSeenByFriend } from '../stats/lastSeen'
import { meetupNames, RECENT_MEETUPS, RECENT_MEETUPS_WITH_BIRTHDAYS, recentMeetups } from '../stats/meetupHistory'
import { FRIEND_SORT_LABELS, sortFriends, type FriendSort } from '../stats/sortFriends'
import './FriendsScreen.css'

const SORT_KEY = 'friend-tracker:sort'
const SORTS = Object.keys(FRIEND_SORT_LABELS) as FriendSort[]
/** The most rows Birthdays soon shows. Its footer counts the rest. */
const MAX_BIRTHDAYS_SOON = 3
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
  const withPhotos = useMeetupIdsWithPhotos()
  const hintDismissed = useSetting('installHintDismissed')
  const today = useToday()
  const { openFriendSheet } = useSheets()
  const showActionSheet = useActionSheet()
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [sort, setSort] = useState<FriendSort>(readStoredSort)
  const filtersRef = useRef<HTMLDivElement>(null)
  // Where the search field was before a search or a chip hid or showed the groups above it.
  const filtersTopBefore = useRef<number | null>(null)

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
  // Recent meetups gives up a row while Birthdays soon shows above it, so the search field stays nearer the top.
  const recent = useMemo(
    () => recentMeetups(meetups ?? [], today, showBirthdaysSoon ? RECENT_MEETUPS_WITH_BIRTHDAYS : RECENT_MEETUPS),
    [meetups, today, showBirthdaysSoon],
  )
  const nameById = useMemo(() => new Map((friends ?? []).map((friend) => [friend.id, friend.name] as const)), [friends])
  const typeById = useMemo(() => new Map((types ?? []).map((type) => [type.id, type] as const)), [types])

  // Safari has no scroll anchoring, so when the groups above the search field hide or come back, the page
  // scrolls by what went away or came back, before paint: the field stays where your eyes are. The browser clamps
  // the scroll at the top and bottom of the page, so there the field can come to rest a little off, never off screen.
  useLayoutEffect(() => {
    const before = filtersTopBefore.current
    filtersTopBefore.current = null
    const filters = filtersRef.current
    if (before === null || !filters) return
    window.scrollBy(0, filters.getBoundingClientRect().top - before)
  }, [unfiltered])

  /** Before a search or chip change: notes where the field is when the change will hide or show the groups. */
  function keepFiltersStill(nextUnfiltered: boolean) {
    if (nextUnfiltered !== unfiltered && filtersRef.current) {
      filtersTopBefore.current = filtersRef.current.getBoundingClientRect().top
    }
  }

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

  if (!friends || !groups || !meetups || !types || !withPhotos || hintDismissed === undefined) return null

  const moreBirthdays = birthdaysSoon.length - MAX_BIRTHDAYS_SOON

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
          {showBirthdaysSoon && (
            <InsetGroup
              title="Birthdays soon"
              footer={moreBirthdays > 0 ? `And ${moreBirthdays} more in the next two weeks.` : undefined}
            >
              {birthdaysSoon.slice(0, MAX_BIRTHDAYS_SOON).map(({ friend, birthday }) => (
                <Row
                  key={friend.id}
                  to={`/friends/${friend.id}`}
                  leading={<Avatar name={friend.name} photo={friend.photo} seed={friend.id} />}
                  title={friend.name}
                  subtitle={describeNextBirthday(birthday, today)}
                />
              ))}
            </InsetGroup>
          )}

          {unfiltered && recent.length > 0 && (
            <InsetGroup title="Recent meetups">
              {recent.map((meetup) => (
                <MeetupRow
                  key={meetup.id}
                  meetup={meetup}
                  type={typeById.get(meetup.typeId)}
                  names={meetupNames(meetup, nameById)}
                  today={today}
                  state={FROM_FRIENDS}
                  hasPhoto={withPhotos.has(meetup.id)}
                  subtitleLines={2}
                />
              ))}
              <Row to="/meetups" title="See all meetups" accent chevron />
            </InsetGroup>
          )}

          <div className="friends-filters" ref={filtersRef}>
            <label className="search">
              <IconSearch size={18} />
              <input
                type="search"
                className="search__input"
                placeholder="Search"
                aria-label="Search friends"
                enterKeyHint="search"
                value={query}
                onChange={(event) => {
                  const value = event.target.value
                  keepFiltersStill(value.trim() === '' && activeGroup === null)
                  setQuery(value)
                }}
                onKeyDown={(event) => {
                  if (isPlainEnter(event)) event.currentTarget.blur()
                }}
              />
            </label>
            {groups.length > 0 && (
              <div className="chip-row" role="group" aria-label="Filter by group">
                <Chip
                  selected={activeGroup === null}
                  onClick={() => {
                    keepFiltersStill(query.trim() === '')
                    setGroupFilter(null)
                  }}
                >
                  All
                </Chip>
                {groups.map((group) => (
                  <Chip
                    key={group.id}
                    selected={activeGroup?.id === group.id}
                    onClick={() => {
                      keepFiltersStill(false)
                      setGroupFilter(group.id)
                    }}
                  >
                    {group.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>

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
