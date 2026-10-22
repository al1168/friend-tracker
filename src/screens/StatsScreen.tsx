import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { HBarList } from '../components/HBarList'
import { IconChevronLeft, IconChevronRight } from '../components/icons'
import { InsetGroup, Row, Section } from '../components/InsetGroup'
import { Page } from '../components/Page'
import { useFriends, useGroups, useMeetups, useMeetupTypes } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import { formatMonthDay, yearOf } from '../lib/dates'
import { plural } from '../lib/text'
import { friendsNotSeenInYear, groupBreakdown, topFriends, typeBreakdown } from '../stats/breakdowns'
import { firstYear as firstYearOf, totalsByDateLastYear, totalsForYear } from '../stats/counts'
import './StatsScreen.css'

const FROM_STATS = { backLabel: 'Stats', tab: '/stats' }

export function StatsScreen() {
  const friends = useFriends()
  const groups = useGroups()
  const meetups = useMeetups()
  const types = useMeetupTypes()
  const today = useToday()
  const currentYear = yearOf(today)
  const firstYear = useMemo(() => firstYearOf(meetups ?? [], today), [meetups, today])

  const [params, setParams] = useSearchParams()
  const asked = Number(params.get('year'))
  const year = Number.isInteger(asked) && asked >= firstYear && asked < currentYear ? asked : currentYear
  const showYear = (y: number) => setParams(y === currentYear ? {} : { year: String(y) }, { replace: true })

  // A year is compared with the one before only when that one isn't before the first meetup.
  const compares = year > firstYear

  const stats = useMemo(() => {
    if (!friends || !groups || !meetups || !types) return null
    return {
      totals: totalsForYear(meetups, year, today),
      previous: totalsForYear(meetups, year - 1, today),
      // This year so far against last year up to the same date: the fair comparison.
      byDate: year === yearOf(today) ? totalsByDateLastYear(meetups, today) : null,
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
      {/* Arrows only when there's another year to show: never one before the first meetup. */}
      <div className="year-switcher" role="group" aria-label="Year">
        {firstYear < currentYear && (
          <button
            type="button"
            className="icon-button"
            onClick={() => showYear(year - 1)}
            disabled={year <= firstYear}
            aria-label={`Show ${year - 1}`}
          >
            <IconChevronLeft />
          </button>
        )}
        <span className="year-switcher__year numeric" aria-live="polite">
          {year}
        </span>
        {firstYear < currentYear && (
          <button
            type="button"
            className="icon-button"
            onClick={() => showYear(year + 1)}
            disabled={year >= currentYear}
            aria-label={`Show ${year + 1}`}
          >
            <IconChevronRight />
          </button>
        )}
      </div>

      {empty ? (
        <EmptyState title="Log a few meetups and your year will show up here." />
      ) : (
        <>
          <div className="stats-lead">
            <p className="stats-lead__main">
              {stats.totals.meetups === 0
                ? year === currentYear
                  ? `No meetups in ${year} yet.`
                  : `No meetups in ${year}.`
                : `${plural(stats.totals.meetups, 'meetup')} with ${plural(stats.totals.friends, 'friend')}.`}
            </p>
            {compares && stats.byDate && (
              <p className="stats-lead__previous">
                By {formatMonthDay(stats.byDate.through)} last year: {plural(stats.byDate.meetups, 'meetup')}.
              </p>
            )}
            {compares && (
              <p className="stats-lead__previous">
                {/* This year is still going, so last year is named as a whole year. */}
                {stats.byDate ? `All of ${year - 1}` : year - 1}: {plural(stats.previous.meetups, 'meetup')} with{' '}
                {plural(stats.previous.friends, 'friend')}.
              </p>
            )}
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
                      <span className="numeric top-count__value">
                        <span className="visually-hidden">{year}: </span>
                        {count}
                      </span>
                      {compares && (
                        <span className="top-count__previous">
                          {year - 1}: {previousCount}
                        </span>
                      )}
                    </span>
                  }
                />
              ))}
            </InsetGroup>
          )}

          {stats.byType.length > 0 && (
            <Section title="By type">
              <HBarList
                year={year}
                previousYear={compares ? year - 1 : undefined}
                items={stats.byType.map((row) => ({ ...row, label: `${row.emoji ?? ''} ${row.label}`.trim() }))}
              />
            </Section>
          )}

          {groups.length > 0 && stats.byGroup.length > 0 && (
            <Section title="By group">
              <HBarList year={year} previousYear={compares ? year - 1 : undefined} items={stats.byGroup} />
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
