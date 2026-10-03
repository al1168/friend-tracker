import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { IconPlus } from '../components/icons'
import { InsetGroup, Row, Section } from '../components/InsetGroup'
import { LogButton } from '../components/LogButton'
import { MonthBars } from '../components/MonthBars'
import { Page } from '../components/Page'
import { StatRow } from '../components/StatRow'
import { useFriend, useFriends, useGroups, useMeetups, useMeetupTypes } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import { describeNextBirthday, formatBirthday } from '../lib/birthdays'
import { daysBetween, formatDate, formatMonthYear, yearOf } from '../lib/dates'
import { formatNameList, formatSince } from '../lib/text'
import { useSheets } from '../sheets/sheetsContext'
import { allTimeCountsByFriend, countsByFriendForYear, monthlyCounts } from '../stats/counts'
import { groupByMonth } from '../stats/history'
import { lastSeenByFriend } from '../stats/lastSeen'
import { FriendPreferences } from './FriendPreferences'
import './FriendDetailScreen.css'

export function FriendDetailScreen() {
  const { id } = useParams()
  const friend = useFriend(id)
  const friends = useFriends()
  const groups = useGroups()
  const meetups = useMeetups()
  const types = useMeetupTypes()
  const today = useToday()
  const { openFriendSheet, openMeetupSheet } = useSheets()

  const data = useMemo(() => {
    if (!friend || !meetups) return null
    const year = yearOf(today)
    const theirs = meetups.filter((meetup) => meetup.friendIds.includes(friend.id))
    return {
      year,
      lastSeen: lastSeenByFriend(theirs, today).get(friend.id) ?? null,
      thisYear: countsByFriendForYear(theirs, year, today).get(friend.id) ?? 0,
      lastYear: countsByFriendForYear(theirs, year - 1, today).get(friend.id) ?? 0,
      allTime: allTimeCountsByFriend(theirs, today).get(friend.id) ?? 0,
      current: monthlyCounts(friend.id, theirs, year, today),
      previous: monthlyCounts(friend.id, theirs, year - 1, today),
      history: groupByMonth(theirs),
    }
  }, [friend, meetups, today])

  if (friend === null) return <Navigate to="/" replace />
  if (!friend || !friends || !groups || !types || !data) return null

  const groupName = groups.find((group) => group.id === friend.groupId)?.name
  const typeById = new Map(types.map((type) => [type.id, type] as const))
  const nameById = new Map(friends.map((f) => [f.id, f.name] as const))

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

      <StatRow
        items={[
          { label: 'This year', value: data.thisYear },
          { label: 'Last year', value: data.lastYear },
          { label: 'All time', value: data.allTime },
        ]}
      />

      <Section title="Month by month">
        <MonthBars current={data.current} previous={data.previous} year={data.year} />
      </Section>

      <Section title="History">
        {data.history.length === 0 ? (
          <p className="list-message">Your first meetup will show up here.</p>
        ) : (
          data.history.map(({ month, meetups: monthMeetups }) => (
            <InsetGroup key={month} title={formatMonthYear(`${month}-01`)} level={3}>
              {monthMeetups.map((meetup) => {
                const type = typeById.get(meetup.typeId)
                const others = meetup.friendIds
                  .filter((friendId) => friendId !== friend.id)
                  .map((friendId) => nameById.get(friendId))
                  .filter((name): name is string => name !== undefined)
                return (
                  <Row
                    key={meetup.id}
                    onClick={() => openMeetupSheet({ meetup })}
                    leading={
                      <span className="emoji-badge" aria-hidden="true">
                        {type?.emoji ?? '✨'}
                      </span>
                    }
                    title={
                      <>
                        {type?.name ?? 'Meetup'}{meetup.date > today && ' '}
                        {meetup.date > today && <span className="upcoming-badge">Upcoming</span>}
                      </>
                    }
                    subtitle={[
                      formatDate(meetup.date, today),
                      others.length > 0 ? `with ${formatNameList(others)}` : null,
                      meetup.note || null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    chevron
                  />
                )
              })}
            </InsetGroup>
          ))
        )}
      </Section>

      <LogButton presetFriendId={friend.id} />
    </Page>
  )
}
