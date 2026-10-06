import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { IconSearch } from '../components/icons'
import { InsetGroup } from '../components/InsetGroup'
import { LogButton } from '../components/LogButton'
import { MeetupRow } from '../components/MeetupRow'
import { Page, type NavState } from '../components/Page'
import { usePlaceMemory } from '../components/PlaceMemory'
import { useFriends, useMeetupIdsWithPhotos, useMeetups, useMeetupTypes } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import type { ISODate } from '../lib/dates'
import { isPlainEnter } from '../lib/keys'
import {
  firstRows,
  historySections,
  matchesSearch,
  MEETUPS_PAGE_SIZE,
  meetupNames,
  meetupSearchText,
  type HistorySection,
} from '../stats/meetupHistory'
import type { MeetupType } from '../types'
import './MeetupsScreen.css'

/** A meetup opened from here says "Meetups" on its back button. */
const FROM_MEETUPS: NavState = { backLabel: 'Meetups' }
/** How long typing pauses before VoiceOver hears how many meetups match. */
const ANNOUNCE_AFTER_MS = 700

function describeMatches(count: number, query: string): string {
  if (count === 0) return `No meetups match “${query}”.`
  return count === 1 ? '1 meetup matches.' : `${count} meetups match.`
}

interface MeetupListProps {
  /** The groups to show, already searched with `query`. */
  sections: HistorySection[]
  /** The deferred, trimmed search, for the no-match line. */
  query: string
  /** How many rows show, counted across the groups. */
  count: number
  typeById: ReadonlyMap<string, MeetupType>
  namesById: ReadonlyMap<string, string[]>
  withPhotos: ReadonlySet<string>
  today: ISODate
  /** The row "Show older meetups" moves focus to (its group's heading when it starts a group), or null. */
  focusIndex: number | null
  focusRef: (element: HTMLElement | null) => void
  onShowMore: (shown: number) => void
}

/**
 * The groups, the no-match line and "Show older meetups". Memoized, so a keystroke re-renders only the search
 * field until the deferred query catches up.
 */
const MeetupList = memo(function MeetupList({
  sections,
  query,
  count,
  typeById,
  namesById,
  withPhotos,
  today,
  focusIndex,
  focusRef,
  onShowMore,
}: MeetupListProps) {
  if (sections.length === 0) return <p className="list-message">No meetups match “{query}”.</p>
  const shown = firstRows(sections, count)
  let index = 0
  return (
    <>
      {shown.sections.map((section) => {
        const first = index
        index += section.meetups.length
        return (
          <InsetGroup key={section.key} title={section.title} titleRef={focusIndex === first ? focusRef : undefined}>
            {section.meetups.map((meetup, i) => (
              <MeetupRow
                key={meetup.id}
                meetup={meetup}
                type={typeById.get(meetup.typeId)}
                names={namesById.get(meetup.id) ?? []}
                today={today}
                state={FROM_MEETUPS}
                hasPhoto={withPhotos.has(meetup.id)}
                // The group's title already says it.
                showUpcoming={section.key !== 'upcoming'}
                ref={i > 0 && focusIndex === first + i ? focusRef : undefined}
              />
            ))}
          </InsetGroup>
        )
      })}
      {shown.more > 0 && (
        <div className="meetups-more">
          <button type="button" className="button button--secondary" onClick={() => onShowMore(count)}>
            Show older meetups
          </button>
        </div>
      )}
    </>
  )
})

/** Every meetup: Upcoming, then one group per month, searchable, 60 rows at a time. */
export function MeetupsScreen() {
  const meetups = useMeetups()
  const friends = useFriends()
  const types = useMeetupTypes()
  const withPhotos = useMeetupIdsWithPhotos()
  const today = useToday()
  const { key } = useLocation()
  const places = usePlaceMemory()
  // Coming back to this history entry finds its search and rows shown; a new visit starts blank at 60 rows.
  const [query, setQuery] = useState(() => places.get(key)?.query ?? '')
  const [count, setCount] = useState(() => places.get(key)?.count ?? MEETUPS_PAGE_SIZE)
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  // The trimmed query to announce once typing has paused; null until then, so a restored search isn't announced.
  const [announced, setAnnounced] = useState<string | null>(null)
  const announceTimer = useRef<number | undefined>(undefined)
  const pendingFocus = useRef(false)
  const focusTarget = useRef<HTMLElement | null>(null)

  // The results, the no-match line and the announcement all follow this one value.
  const searched = useDeferredValue(query.trim())

  const nameById = useMemo(() => new Map((friends ?? []).map((friend) => [friend.id, friend.name] as const)), [friends])
  const typeById = useMemo(() => new Map((types ?? []).map((type) => [type.id, type] as const)), [types])
  const namesById = useMemo(
    () => new Map((meetups ?? []).map((meetup) => [meetup.id, meetupNames(meetup, nameById)] as const)),
    [meetups, nameById],
  )
  // Folding every day is the slow part, so it happens only while there's a search, once per data change.
  const searching = searched !== ''
  const searchText = useMemo(() => {
    if (!searching || !meetups) return null
    return new Map(
      meetups.map((meetup) => {
        const typeName = typeById.get(meetup.typeId)?.name ?? 'Meetup'
        return [meetup.id, meetupSearchText(meetup, namesById.get(meetup.id) ?? [], typeName, today)] as const
      }),
    )
  }, [searching, meetups, namesById, typeById, today])
  const matches = useMemo(() => {
    if (!meetups || !searchText) return meetups
    return meetups.filter((meetup) => matchesSearch(searchText.get(meetup.id) ?? '', searched))
  }, [meetups, searchText, searched])
  const sections = useMemo(() => (matches ? historySections(matches, today) : []), [matches, today])

  useEffect(() => () => window.clearTimeout(announceTimer.current), [])

  // "Show older meetups" moves focus to what it added, without scrolling: it sits where the button was.
  useEffect(() => {
    if (!pendingFocus.current) return
    pendingFocus.current = false
    focusTarget.current?.focus({ preventScroll: true })
  }, [count])

  const setFocusTarget = useCallback((element: HTMLElement | null) => {
    focusTarget.current = element
  }, [])

  const showMore = useCallback(
    (shown: number) => {
      const next = shown + MEETUPS_PAGE_SIZE
      pendingFocus.current = true
      setFocusIndex(shown)
      setCount(next)
      places.set(key, { query: places.get(key)?.query ?? '', count: next })
    },
    [places, key],
  )

  function search(value: string) {
    setQuery(value)
    // A new search starts again at 60 rows. Only here, never in an effect, so a restored search keeps its rows.
    setCount(MEETUPS_PAGE_SIZE)
    setFocusIndex(null)
    places.set(key, { query: value, count: MEETUPS_PAGE_SIZE })
    setAnnounced(null)
    window.clearTimeout(announceTimer.current)
    announceTimer.current = window.setTimeout(() => setAnnounced(value.trim()), ANNOUNCE_AFTER_MS)
  }

  if (!meetups || !friends || !types || !withPhotos || !matches) return null

  const announcement =
    announced !== null && announced !== '' && announced === searched ? describeMatches(matches.length, searched) : ''

  return (
    <Page title="Meetups" back={{ label: 'Friends', fallback: '/' }} pushed>
      {meetups.length === 0 ? (
        <EmptyState title="No meetups yet." message="Your first meetup will show up here." />
      ) : (
        <>
          <label className="search">
            <IconSearch size={18} />
            <input
              type="search"
              className="search__input"
              placeholder="Search"
              aria-label="Search meetups"
              enterKeyHint="search"
              value={query}
              onChange={(event) => search(event.target.value)}
              onKeyDown={(event) => {
                if (isPlainEnter(event)) event.currentTarget.blur()
              }}
            />
          </label>
          {/* No role: the toast region is the page's one status. */}
          <p className="visually-hidden meetups-announcer" aria-live="polite">
            {announcement}
          </p>
          <MeetupList
            sections={sections}
            query={searched}
            count={count}
            typeById={typeById}
            namesById={namesById}
            withPhotos={withPhotos}
            today={today}
            focusIndex={focusIndex}
            focusRef={setFocusTarget}
            onShowMore={showMore}
          />
        </>
      )}
      {friends.length > 0 && <LogButton />}
    </Page>
  )
}
