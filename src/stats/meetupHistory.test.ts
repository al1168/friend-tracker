import { describe, expect, it } from 'vitest'
import { OWNER_DAY_TYPED } from '../test/dayFixtures'
import { meetup } from '../test/fixtures'
import type { Meetup } from '../types'
import {
  FRIEND_HISTORY_ROWS,
  firstRows,
  historySections,
  matchesSearch,
  MEETUPS_PAGE_SIZE,
  meetupNames,
  meetupSearchText,
  meetupSubtitle,
  meetupTitle,
  monthSections,
  RECENT_MEETUPS,
  recentMeetups,
  searchKey,
} from './meetupHistory'

// Mon, Oct 5, 2026.
const TODAY = '2026-10-05'

/** A meetup logged at a given time of its day (UTC), so same-day order is clear. */
function loggedAt(id: string, date: string, time: string, fields: Partial<Meetup> = {}): Meetup {
  return { ...meetup(id, date, ['alex']), createdAt: `${date}T${time}:00.000Z`, ...fields }
}

const ids = (meetups: Meetup[]) => meetups.map((m) => m.id)

describe('limits', () => {
  it('shows the latest meetup on the Friends tab on every day, and 60 rows a page', () => {
    expect(RECENT_MEETUPS).toBe(1)
    expect(MEETUPS_PAGE_SIZE).toBe(60)
  })

  it('shows a friend’s latest five meetups before "Show all"', () => {
    expect(FRIEND_HISTORY_ROWS).toBe(5)
  })
})

describe('recentMeetups', () => {
  const meetups = [
    loggedAt('sep20', '2026-09-20', '12:00'),
    loggedAt('morning', TODAY, '10:00'),
    loggedAt('tomorrow', '2026-10-06', '12:00'),
    loggedAt('oct1', '2026-10-01', '12:00'),
    loggedAt('evening', TODAY, '18:00'),
  ]

  it('gives the latest meetup that happened, the one logged later first on the same date', () => {
    expect(ids(recentMeetups(meetups, TODAY))).toEqual(['evening'])
  })

  it('never gives a future meetup', () => {
    expect(ids(recentMeetups(meetups, TODAY, 10))).toEqual(['evening', 'morning', 'oct1', 'sep20'])
  })

  it('gives what there is when there are fewer, and nothing when every meetup is upcoming', () => {
    expect(ids(recentMeetups([loggedAt('oct1', '2026-10-01', '12:00')], TODAY))).toEqual(['oct1'])
    expect(recentMeetups([loggedAt('tomorrow', '2026-10-06', '12:00')], TODAY)).toEqual([])
  })

  it('takes another limit', () => {
    expect(ids(recentMeetups(meetups, TODAY, 3))).toEqual(['evening', 'morning', 'oct1'])
  })
})

describe('meetupNames', () => {
  const nameById = new Map([
    ['alex', 'Alex'],
    ['sam', 'Sam'],
    ['kim', 'Kim'],
  ])

  it('names the friends in the meetup’s order, skipping ids with no friend', () => {
    expect(meetupNames(meetup('m', TODAY, ['kim', 'gone', 'alex']), nameById)).toEqual(['Kim', 'Alex'])
  })

  it('leaves out the friend whose page the row is on', () => {
    expect(meetupNames(meetup('m', TODAY, ['alex', 'sam', 'kim']), nameById, 'sam')).toEqual(['Alex', 'Kim'])
  })
})

describe('meetupTitle', () => {
  it('names who was there', () => {
    expect(meetupTitle(['Mariya'], 'Meal')).toBe('Mariya')
    expect(meetupTitle(['Mariya', 'Jessie'], 'Meal')).toBe('Mariya and Jessie')
    expect(meetupTitle(['Mariya', 'Jessie', 'Brandon'], 'Meal')).toBe('Mariya, Jessie and Brandon')
  })

  it('shortens four names or more', () => {
    expect(meetupTitle(['Alex', 'Sam', 'Kim', 'Lee'], 'Coffee')).toBe('Alex, Sam and 2 others')
  })

  it('is the type when no one else was there', () => {
    expect(meetupTitle([], 'Coffee')).toBe('Coffee')
  })
})

describe('meetupSubtitle', () => {
  it('reads the type, the date, the activities and the day’s first places', () => {
    const owners = {
      ...meetup('m', '2026-10-03', ['m', 'j', 'b']),
      activities: ['Movie', 'Shopping'],
      note: OWNER_DAY_TYPED,
    }
    expect(meetupSubtitle(owners, 'Meal', TODAY)).toBe(
      'Meal · Sat, Oct 3 · Movie, Shopping · nonstopstyle, strand bookstore, Sammy L coffee and 5 more',
    )
  })

  it('starts with the date when the title is the type, and leaves out the parts that are empty', () => {
    const tacos = { ...meetup('m', '2026-10-03', ['alex']), note: 'Tacos' }
    expect(meetupSubtitle(tacos, null, TODAY)).toBe('Sat, Oct 3 · Tacos')
    expect(meetupSubtitle(meetup('m', '2026-10-03', ['alex']), null, TODAY)).toBe('Sat, Oct 3')
  })

  it('gives the year of a date in another year', () => {
    expect(meetupSubtitle(meetup('m', '2025-09-12', ['sam']), 'Coffee', TODAY)).toBe('Coffee · Fri, Sep 12, 2025')
  })
})

describe('searchKey', () => {
  it('folds case, accents, curly quotes and runs of spaces', () => {
    expect(searchKey('Crème Brûlée')).toBe('creme brulee')
    expect(searchKey('didn’t')).toBe("didn't")
    expect(searchKey('“Hi”')).toBe('"hi"')
    expect(searchKey('  Blue\n\nwillow ')).toBe('blue willow')
  })
})

describe('matchesSearch', () => {
  const nameById = new Map([
    ['alex', 'Alex'],
    ['sam', 'Sam'],
    ['kim', 'Kim'],
    ['lee', 'Lee'],
    ['mariya', 'Mariya'],
    ['jessie', 'Jessie'],
    ['brandon', 'Brandon'],
  ])

  /** Whether `query` finds this meetup, read as the Meetups page reads it. */
  function finds(query: string, found: Meetup, typeName = 'Coffee', today = TODAY): boolean {
    return matchesSearch(meetupSearchText(found, meetupNames(found, nameById), typeName, today), query)
  }

  const meal = { ...meetup('meal', '2026-10-03', ['mariya', 'jessie', 'brandon'], 'type-meal') }

  it('finds a friend’s name in any case', () => {
    expect(finds('MARIYA', meal, 'Meal')).toBe(true)
  })

  it('finds a name the row shortens to "and 2 others"', () => {
    const four = meetup('four', '2026-10-03', ['alex', 'sam', 'kim', 'lee'])
    expect(finds('lee', four)).toBe(true)
  })

  it('finds the type’s name, and "Meetup" when the type is gone', () => {
    expect(finds('meal', meal, 'Meal')).toBe(true)
    expect(finds('meetup', meal, 'Meetup')).toBe(true)
    expect(finds('meetup', meal, 'Meal')).toBe(false)
  })

  it('finds an activity', () => {
    expect(finds('karaoke', { ...meal, activities: ['Board games', 'Karaoke'] }, 'Meal')).toBe(true)
  })

  it('finds a place with its "@", and a plain line of the day', () => {
    const day = { ...meal, note: '@Blue willow 3:30\nOrdered kung pao chicken' }
    expect(finds('blue willow', day, 'Meal')).toBe(true)
    expect(finds('kung pao', day, 'Meal')).toBe(true)
  })

  it('finds How it felt’s words only on a meetup that has happened', () => {
    const felt = { ...meetup('felt', TODAY, ['alex']), feelings: 'I still feel almost outsidery' }
    expect(finds('outsidery', felt)).toBe(true)
    expect(finds('outsidery', { ...felt, date: '2026-10-06' })).toBe(false)
  })

  it('ignores accents and the kind of apostrophe', () => {
    expect(finds('cafe', { ...meal, note: 'Café on the corner' }, 'Meal')).toBe(true)
    expect(finds("didn't", { ...meal, note: 'We didn’t stay long' }, 'Meal')).toBe(true)
    expect(finds('didn’t', { ...meal, note: "We didn't stay long" }, 'Meal')).toBe(true)
  })

  it('needs every word typed, each found anywhere in the meetup', () => {
    const coffee = meetup('coffee', '2026-10-03', ['jessie'], 'type-coffee')
    const tacos = { ...meetup('tacos', '2026-10-03', ['jessie'], 'type-meal'), note: 'Tacos' }
    const owners = { ...meal, note: OWNER_DAY_TYPED }
    expect(finds('jessie coffee', coffee, 'Coffee')).toBe(true)
    expect(finds('jessie coffee', tacos, 'Meal')).toBe(false)
    expect(finds('jessie coffee', owners, 'Meal')).toBe(true)
    expect(finds('sam tacos', { ...meetup('m', '2026-10-03', ['sam']), note: 'Tacos' }, 'Meal')).toBe(true)
  })

  it('finds the weather’s words, on a meetup that has happened or is upcoming', () => {
    const rainy = { ...meal, weather: ['rainy' as const, 'cold' as const] }
    expect(finds('rainy', rainy, 'Meal')).toBe(true)
    expect(finds('COLD', rainy, 'Meal')).toBe(true)
    expect(finds('rainy jessie', rainy, 'Meal')).toBe(true)
    expect(finds('rainy alex', rainy, 'Meal')).toBe(false)
    expect(finds('sunny', rainy, 'Meal')).toBe(false)
    expect(finds('rainy', { ...rainy, date: '2026-10-09' }, 'Meal')).toBe(true)
  })

  it('skips a weather it doesn’t know', () => {
    const odd = { ...meal, weather: ['foggy'] } as unknown as Meetup
    expect(finds('foggy', odd, 'Meal')).toBe(false)
    expect(finds('meal', odd, 'Meal')).toBe(true)
  })

  it('never searches the mood or the date', () => {
    expect(finds('okay', { ...meal, mood: 'okay' }, 'Meal')).toBe(false)
    expect(finds('oct', meal, 'Meal')).toBe(false)
  })

  it('matches everything with a blank query', () => {
    expect(finds('', meal, 'Meal')).toBe(true)
    expect(finds('   ', meal, 'Meal')).toBe(true)
  })
})

describe('historySections', () => {
  it('puts upcoming meetups first, soonest first, then each month, newest first', () => {
    const sections = historySections(
      [
        loggedAt('dec24', '2025-12-24', '12:00'),
        loggedAt('oct9', '2026-10-09', '12:00'),
        loggedAt('oct7-second', '2026-10-07', '18:00'),
        loggedAt('oct5', TODAY, '12:00'),
        loggedAt('oct7-first', '2026-10-07', '10:00'),
        loggedAt('sep30', '2026-09-30', '12:00'),
      ],
      TODAY,
    )
    expect(sections.map(({ key, title, meetups }) => [key, title, ids(meetups)])).toEqual([
      ['upcoming', 'Upcoming', ['oct7-first', 'oct7-second', 'oct9']],
      ['2026-10', 'October 2026', ['oct5']],
      ['2026-09', 'September 2026', ['sep30']],
      ['2025-12', 'December 2025', ['dec24']],
    ])
  })

  it('shows no empty groups', () => {
    expect(historySections([], TODAY)).toEqual([])
    expect(historySections([loggedAt('oct9', '2026-10-09', '12:00')], TODAY).map((s) => s.title)).toEqual(['Upcoming'])
  })
})

describe('monthSections', () => {
  it('groups by month, newest first, an upcoming month first, each titled', () => {
    const sections = monthSections([
      loggedAt('sep30', '2026-09-30', '12:00'),
      loggedAt('oct9', '2026-10-09', '12:00'),
      loggedAt('oct1', '2026-10-01', '12:00'),
      loggedAt('dec24', '2025-12-24', '12:00'),
    ])
    expect(sections.map(({ key, title, meetups }) => [key, title, ids(meetups)])).toEqual([
      ['2026-10', 'October 2026', ['oct9', 'oct1']],
      ['2026-09', 'September 2026', ['sep30']],
      ['2025-12', 'December 2025', ['dec24']],
    ])
    expect(monthSections([])).toEqual([])
  })

  it('gives a friend’s latest five across months, and how many more', () => {
    // m1 to m3 in October, m4 to m8 in September, newest first.
    const date = (i: number) => `2026-${i < 3 ? '10' : '09'}-0${9 - i}`
    const meetups = Array.from({ length: 8 }, (_, i) => loggedAt(`m${i + 1}`, date(i), '12:00'))
    const shown = firstRows(monthSections(meetups), FRIEND_HISTORY_ROWS)
    expect(shown.sections.map((section) => ids(section.meetups))).toEqual([
      ['m1', 'm2', 'm3'],
      ['m4', 'm5'],
    ])
    expect(shown.more).toBe(3)
  })
})

describe('firstRows', () => {
  // 70 meetups: 5 upcoming, 30 in October, 35 in September.
  const time = (i: number) => `${String(10 + (i % 10))}:${String(10 + i)}`
  const meetups = [
    ...Array.from({ length: 5 }, (_, i) => loggedAt(`up${i}`, `2026-10-${String(10 + i)}`, '12:00')),
    ...Array.from({ length: 30 }, (_, i) => loggedAt(`oct${i}`, '2026-10-02', time(i))),
    ...Array.from({ length: 35 }, (_, i) => loggedAt(`sep${i}`, '2026-09-15', time(i))),
  ]
  const sections = historySections(meetups, TODAY)
  const rowsOf = (result: ReturnType<typeof firstRows>) => result.sections.flatMap((section) => ids(section.meetups))

  it('gives the first rows in order across the groups, and how many are left', () => {
    const result = firstRows(sections, 60)
    expect(rowsOf(result)).toEqual(sections.flatMap((section) => ids(section.meetups)).slice(0, 60))
    expect(result.sections.map((section) => [section.title, section.meetups.length])).toEqual([
      ['Upcoming', 5],
      ['October 2026', 30],
      ['September 2026', 25],
    ])
    expect(result.more).toBe(10)
  })

  it('drops the groups after a cut at a group’s end', () => {
    const result = firstRows(sections, 35)
    expect(result.sections.map((section) => section.title)).toEqual(['Upcoming', 'October 2026'])
    expect(result.more).toBe(35)
  })

  it('gives everything when the count is past the total', () => {
    const result = firstRows(sections, 120)
    expect(rowsOf(result)).toHaveLength(70)
    expect(result.more).toBe(0)
  })
})
