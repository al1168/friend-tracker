import { useMemo, useState } from 'react'
import { useActionSheet } from '../components/ActionSheet'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { EmptyState } from '../components/EmptyState'
import { IconPlus, IconSearch, IconSort } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import { LogButton } from '../components/LogButton'
import { InstallHint } from '../components/InstallHint'
import { Page } from '../components/Page'
import { useFriends, useGroups, useMeetups, useSetting } from '../data/hooks'
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
import { FRIEND_SORT_LABELS, sortFriends, type FriendSort } from '../stats/sortFriends'
import './FriendsScreen.css'

const SORT_KEY = 'friend-tracker:sort'
const SORTS = Object.keys(FRIEND_SORT_LABELS) as FriendSort[]
/** The most rows Birthdays soon shows. Its footer counts the rest. */
const MAX_BIRTHDAYS_SOON = 5

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
  const hintDismissed = useSetting('installHintDismissed')
  const today = useToday()
  const { openFriendSheet } = useSheets()
  const showActionSheet = useActionSheet()
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [sort, setSort] = useState<FriendSort>(readStoredSort)

  const activeGroup = groups?.find((group) => group.id === groupFilter) ?? null
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

  if (!friends || !groups || !meetups || hintDismissed === undefined) return null

  // Hidden while searching or filtering, so the list below stays a plain filtered list.
  const showBirthdaysSoon = birthdaysSoon.length > 0 && query.trim() === '' && activeGroup === null
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
                  <Chip
                    key={group.id}
                    selected={activeGroup?.id === group.id}
                    onClick={() => setGroupFilter(group.id)}
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
