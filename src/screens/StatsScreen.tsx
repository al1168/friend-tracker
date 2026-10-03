import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { HBarList } from '../components/HBarList'
import { IconChevronLeft, IconChevronRight } from '../components/icons'
import { InsetGroup, Row, Section } from '../components/InsetGroup'
import { Page } from '../components/Page'
import { useFriends, useGroups, useMeetups, useMeetupTypes } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import { yearOf } from '../lib/dates'
import { plural } from '../lib/text'
import { friendsNotSeenInYear, groupBreakdown, topFriends, typeBreakdown } from '../stats/breakdowns'
import { totalsForYear } from '../stats/counts'
import './StatsScreen.css'

const FROM_STATS = { backLabel: 'Stats', tab: '/stats' }

export function StatsScreen() {
  const friends = useFriends()
  const groups = useGroups()
  const meetups = useMeetups()
  const types = useMeetupTypes()
  const today = useToday()
  const currentYear = yearOf(today)
  const [year, setYear] = useState(currentYear)

  const firstYear = useMemo(
    () => Math.min(currentYear, ...(meetups ?? []).map((meetup) => yearOf(meetup.date))),
    [meetups, currentYear],
  )

  const stats = useMemo(() => {
    if (!friends || !groups || !meetups || !types) return null
    return {
      totals: totalsForYear(meetups, year, today),
      previous: totalsForYear(meetups, year - 1, today),
      top: topFriends(meetups, friends, year, today),
      byType: typeBreakdown(meetups, types, year, today),
      byGroup: groupBreakdown(meetups, friends, groups, year, today),
      notSeen: friendsNotSeenInYear(meetups, friends, year, today),
    }
  }, [friends, groups, meetups, types, year, today])

  if (!stats || !groups) return null
  const empty = stats.totals.meetups === 0 && stats.previous.meetups === 0

  return (
    <Page title="Stats">
      <div className="year-switcher">
        <button
          type="button"
          className="icon-button"
          onClick={() => setYear(year - 1)}
          disabled={year <= firstYear}
          aria-label={`Show ${year - 1}`}
        >
          <IconChevronLeft />
        </button>
        <span className="year-switcher__year numeric" aria-live="polite">
          {year}
        </span>
        <button
          type="button"
          className="icon-button"
          onClick={() => setYear(year + 1)}
          disabled={year >= currentYear}
          aria-label={`Show ${year + 1}`}
        >
          <IconChevronRight />
        </button>
      </div>

      {empty ? (
        <EmptyState title="Log a few meetups and your year will show up here." />
      ) : (
        <>
          <div className="stats-lead">
            <p className="stats-lead__main">
              {plural(stats.totals.meetups, 'meetup')} with {plural(stats.totals.friends, 'friend')}.
            </p>
            <p className="stats-lead__previous">
              {year - 1}: {plural(stats.previous.meetups, 'meetup')} with {plural(stats.previous.friends, 'friend')}.
            </p>
          </div>

          {stats.top.length > 0 && (
            <InsetGroup title="Top friends">
              {stats.top.map(({ friend, count, previousCount }) => (
                <Row
                  key={friend.id}
                  to={`/friends/${friend.id}`}
                  state={FROM_STATS}
                  leading={<Avatar name={friend.name} photo={friend.photo} seed={friend.id} />}
                  title={friend.name}
                  trailing={
                    <span className="top-count">
                      <span className="numeric top-count__value">{count}</span>
                      <span className="top-count__previous">
                        {year - 1}: {previousCount}
                      </span>
                    </span>
                  }
                />
              ))}
            </InsetGroup>
          )}

          {stats.byType.length > 0 && (
            <Section title="By type">
              <HBarList
                previousYear={year - 1}
                items={stats.byType.map((row) => ({ ...row, label: `${row.emoji ?? ''} ${row.label}`.trim() }))}
              />
            </Section>
          )}

          {groups.length > 0 && stats.byGroup.length > 0 && (
            <Section title="By group">
              <HBarList previousYear={year - 1} items={stats.byGroup} />
            </Section>
          )}

          {stats.notSeen.length > 0 && (
            <Section title={year === currentYear ? `Not seen yet in ${year}` : `Not seen in ${year}`}>
              <div className="chip-wrap">
                {stats.notSeen.map((friend) => (
                  <Link key={friend.id} to={`/friends/${friend.id}`} state={FROM_STATS} className="person-chip">
                    <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={28} />
                    {friend.name}
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </Page>
  )
}
