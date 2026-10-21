import { describe, expect, it } from 'vitest'
import { meetup } from '../test/fixtures'
import { OWNER_DAY_TYPED, OWNER_MESSAGE } from '../test/dayFixtures'
import {
  DAY_MAX_TYPED,
  daySnippet,
  type DayLine,
  type DayPart,
  type DayStop,
  type DayTime,
  FEELINGS_MAX,
  isDayEmpty,
  isPlaceLine,
  normalizeLineBreaks,
  readDay,
  TOO_LONG_FEELINGS,
} from './dayText'

const text = (value: string): DayLine => ({ kind: 'text', text: value })
const paid = (value: string, who: string | null): DayLine => ({ kind: 'paid', text: value, who })
const at = (minutes: number, approx = false): DayTime => ({ minutes, approx })
const stop = (place: string, start: DayTime | null, end: DayTime | null = null, lines: DayLine[] = []): DayStop => ({
  place,
  start,
  end,
  lines,
})

/** The stops of a day that is one timeline. */
function stopsOf(note: string): DayStop[] {
  const parts = readDay(note)
  expect(parts).toHaveLength(1)
  const [part] = parts
  if (part.kind !== 'timeline') throw new Error(`Expected a timeline, got ${part.kind}`)
  return part.stops
}

/** Each stop's start (and end) in minutes after midnight. */
function timesOf(note: string): (number | [number, number] | null)[] {
  return stopsOf(note).map(({ start, end }) => (start && end ? [start.minutes, end.minutes] : (start?.minutes ?? null)))
}

describe('limits', () => {
  it('stops typing at 10,000 characters for the day and 4,000 for how it felt', () => {
    expect(DAY_MAX_TYPED).toBe(10_000)
    expect(FEELINGS_MAX).toBe(4_000)
    expect(TOO_LONG_FEELINGS).toBe('Keep how it felt under 4,000 characters.')
  })
})

describe('normalizeLineBreaks', () => {
  it('turns \\r\\n and \\r into \\n and changes nothing else', () => {
    expect(normalizeLineBreaks('a\r\nb\rc\n d ')).toBe('a\nb\nc\n d ')
  })
})

// FROZEN for grammar 1: never edit these expectations. A change to the rules is a new grammar.
describe('golden fixture A: the owner’s day as written in the app', () => {
  it('is the stored record’s note, character for character', () => {
    expect(OWNER_DAY_TYPED).toHaveLength(808)
  })

  it('reads as one timeline of 8 stops, with their lines and payers, and no prose', () => {
    expect(readDay(OWNER_DAY_TYPED)).toEqual<DayPart[]>([
      {
        kind: 'timeline',
        stops: [
          stop('nonstopstyle', at(630), null, [text('Took haircut with dyno')]),
          stop('strand bookstore', at(690)),
          stop('Sammy L coffee', at(713), null, [text('Read book and vibe code until 2:50')]),
          stop('Blue willow', at(930), null, [
            text('Walked to mariya at blue willow. Then Jessie came, then Brandon (late) due to construction'),
            text('Ordered Kong pao chicken (salty) garlic string beans, szcheuan beef and jasmine dragon pearl tea.'),
            paid('Jessie paid', 'Jessie'),
          ]),
          stop('hey tea Broadway', null, null, [text('Walked to hey tea (got the king jasmine honeydew)')]),
          stop('amc 34', at(1050), null, [text('Walked to amc and watch prime time(didn’t like it)')]),
          stop('holister + h&m', at(1170), at(1210, true), [text('Stalled time for dinner at holister and H&M')]),
          stop('seoulSaloon', at(1230), null, [
            text('Then walked to dinner @seoulsaloon'),
            text('Ate rose tteboki, fried chicken(chicken nuggets?), octopus kimbap'),
            text('Talked about relationship + movie'),
            text('Jessie Brandon age gap like 3 years'),
            text('Mariya like 3 years older 1/2 younger'),
            paid('Mariya paid', 'Mariya'),
            text('Split ways went home'),
          ]),
        ],
      },
    ])
  })
})

// FROZEN for grammar 1: never edit these expectations. A change to the rules is a new grammar.
describe('golden fixture B: the owner’s message exactly as sent', () => {
  it('is the message byte for byte', () => {
    expect(OWNER_MESSAGE).toHaveLength(925)
    expect(OWNER_MESSAGE).toContain('(didn’t like it)')
    expect(OWNER_MESSAGE).toContain('@Blue willow 3:30, \n')
    expect(OWNER_MESSAGE).toContain('Split ways went home \n\n\nHow I felt:\n')
  })

  it('reads as prose, a heading, the timeline, the story, a heading and the last sentence', () => {
    expect(readDay(OWNER_MESSAGE)).toEqual<DayPart[]>([
      { kind: 'prose', lines: [text('Rainy day')] },
      { kind: 'heading', text: 'Locations' },
      {
        kind: 'timeline',
        stops: [
          stop('nonstopstyle', at(630)),
          stop('strand bookstore', at(690)),
          stop('Sammy L coffee', at(713)),
          stop('Blue willow', at(930)),
          stop('hey tea Broadway', null),
          stop('amc 34', at(1050)),
          stop('holister + h&m', at(1170), at(1210, true)),
          stop('seoulSaloon', at(1230)),
        ],
      },
      {
        kind: 'prose',
        lines: [
          text('Took haircut with dyno'),
          text('Read book and vibe code until 2:50'),
          text('Walked to mariya at blue willow. Then Jessie came, then Brandon (late) due to construction'),
          text('Ordered Kong pao chicken (salty) garlic string beans, szcheuan beef and jasmine dragon pearl tea.'),
          paid('Jessie paid', 'Jessie'),
          text('Walked to hey tea (got the king jasmine honeydew)'),
          text('Walked to amc and watch prime time(didn’t like it)'),
          text('Stalled time for dinner at holister and H&M'),
          text('Then walked to dinner @seoulsaloon'),
          text('Ate rose tteboki, fried chicken(chicken nuggets?), octopus kimbap'),
          text('Talked about relationship + movie'),
          text('Jessie Brandon age gap like 3 years'),
          text('Mariya like 3 years older 1/2 younger'),
          paid('Mariya paid', 'Mariya'),
          text('Split ways went home'),
        ],
      },
      { kind: 'heading', text: 'How I felt' },
      { kind: 'prose', lines: [text('It was an ok day. I still do feel almost outsidery but it’s okay.')] },
    ])
  })
})

describe('place lines', () => {
  it.each([
    ['@nonstopstyle 10:30', 'nonstopstyle', at(630), null],
    ['@Blue willow 3:30, ', 'Blue willow', at(930), null],
    [' @seoulSaloon 8:30. ', 'seoulSaloon', at(510), null],
    ['@hey tea Broadway ', 'hey tea Broadway', null, null],
    ['@amc 34 5:30', 'amc 34', at(1050), null],
    ['@amc 34', 'amc 34', null, null],
    ['@holister + @h&m 7:30 - ~8:10', 'holister + h&m', at(450), at(490, true)],
    ['@Bar 7-9pm', 'Bar', at(1140), at(1260)],
    ['@Cafe 3pm', 'Cafe', at(900), null],
    ['@Cafe 10.30', 'Cafe', at(630), null],
    ['@Park about 8:10', 'Park', at(490, true), null],
    ['@Gym 15:30', 'Gym', at(930), null],
    ['@Bar 25:00', 'Bar 25:00', null, null],
  ])('reads %j as the place %j', (line, place, start, end) => {
    expect(stopsOf(line)).toEqual([stop(place, start, end)])
  })

  it('reads more ways of writing a time', () => {
    expect(timesOf('@Cafe 3 PM')).toEqual([900])
    expect(timesOf('@Cafe around 3pm')).toEqual([900])
    expect(stopsOf('@Cafe around 3pm')[0].start).toEqual(at(900, true))
    expect(timesOf('@Show 7 to 9pm')).toEqual([[1140, 1260]])
    expect(timesOf('@Show 7:30\u20139:15')).toEqual([[450, 555]])
    expect(timesOf('@Show 7:30 \u2014 9:15')).toEqual([[450, 555]])
  })

  it('never reads a bare number or an impossible clock as a time', () => {
    expect(stopsOf('@Meet 10 - 11')[0]).toEqual(stop('Meet 10 - 11', null))
    expect(stopsOf('@Cafe 13pm')[0]).toEqual(stop('Cafe 13pm', null))
    expect(stopsOf('@Cafe 9:75')[0]).toEqual(stop('Cafe 9:75', null))
    // A range's end needs minutes or am/pm too.
    expect(stopsOf('@Show 11am-1')[0]).toEqual(stop('Show 11am-1', null))
  })

  it('skips a line that is only "@"', () => {
    expect(readDay('@')).toEqual([])
    expect(readDay('@Cafe\n@\nCoffee')).toEqual([{ kind: 'timeline', stops: [stop('Cafe', null, null, [text('Coffee')])] }])
  })

  it('reads a line with nothing left once the time is taken off as ordinary text', () => {
    expect(readDay('@ 3:30')).toEqual([{ kind: 'prose', lines: [text('@ 3:30')] }])
  })

  it('reads an "@" anywhere but the start of a line as ordinary text', () => {
    expect(readDay('Then walked to dinner @seoulsaloon')).toEqual([
      { kind: 'prose', lines: [text('Then walked to dinner @seoulsaloon')] },
    ])
  })
})

describe('isPlaceLine', () => {
  /** The stops readDay makes from one line read on its own. */
  const stopsFrom = (line: string) => readDay(line).flatMap((part) => (part.kind === 'timeline' ? part.stops : []))

  it.each([
    ['A', OWNER_DAY_TYPED],
    ['B', OWNER_MESSAGE],
  ])('is true for a line of golden fixture %s exactly when the grammar makes a stop from it', (_, note) => {
    for (const line of note.split('\n')) expect(isPlaceLine(line), line).toBe(stopsFrom(line).length === 1)
  })

  it.each([
    ['A', OWNER_DAY_TYPED, 8],
    ['B', OWNER_MESSAGE, 8],
  ])('finds as many place lines in golden fixture %s as readDay makes stops', (_, note, stops) => {
    expect(note.split('\n').filter(isPlaceLine)).toHaveLength(stops)
    expect(readDay(note).flatMap((part) => (part.kind === 'timeline' ? part.stops : []))).toHaveLength(stops)
  })

  it('reads "@ some place" and a place with a time as places, with spaces around them', () => {
    for (const line of ['@ some place', '@Blue willow 3:30', '  @Cafe ', '@Blue willow 3:30, ', '@Bar 25:00']) {
      expect(isPlaceLine(line), line).toBe(true)
    }
  })

  it('never reads "@" alone, a time alone or an "@" after the start of a line as a place', () => {
    for (const line of ['@', ' @ ', '@ 3:30', 'Then walked to dinner @seoulsaloon', '', 'Jessie paid', 'Plan:']) {
      expect(isPlaceLine(line), line).toBe(false)
    }
  })
})

describe('paid lines', () => {
  it('reads one to three words before "paid" as who paid', () => {
    expect(readDay('Jessie paid\nI paid\nJessie paid for dinner\nMary Ann Lee paid.\nSam paid!')).toEqual([
      {
        kind: 'prose',
        lines: [
          paid('Jessie paid', 'Jessie'),
          paid('I paid', 'I'),
          paid('Jessie paid for dinner', 'Jessie'),
          paid('Mary Ann Lee paid.', 'Mary Ann Lee'),
          paid('Sam paid!', 'Sam'),
        ],
      },
    ])
  })

  it('reads a shared bill', () => {
    const lines = ['split', 'Split it', 'we split', 'We split it.', 'split the bill', 'Split the check']
    expect(readDay(lines.join('\n'))).toEqual([{ kind: 'prose', lines: lines.map((line) => paid(line, null)) }])
  })

  it('keeps everything else as text', () => {
    const lines = ['Nobody paid', 'No one paid', 'Split ways went home', 'Me and my mom paid', 'paid', 'Who paid?']
    expect(readDay(lines.join('\n'))).toEqual([{ kind: 'prose', lines: lines.map(text) }])
  })
})

describe('headings', () => {
  it('reads a line of up to 40 characters ending with ":" as a heading', () => {
    const forty = `${'x'.repeat(39)}:`
    expect(readDay(forty)).toEqual([{ kind: 'heading', text: 'x'.repeat(39) }])
    expect(readDay(`x${forty}`)).toEqual([{ kind: 'prose', lines: [text(`x${forty}`)] }])
    expect(readDay('Note to self: buy milk')).toEqual([{ kind: 'prose', lines: [text('Note to self: buy milk')] }])
    expect(readDay(':')).toEqual([{ kind: 'prose', lines: [text(':')] }])
  })
})

describe('grouping', () => {
  it('keeps place lines in a row as one timeline, even with blank lines between them', () => {
    expect(readDay('@A\n\n@B\n\n\n@C')).toEqual([{ kind: 'timeline', stops: [stop('A', null), stop('B', null), stop('C', null)] }])
  })

  it('gives the lines under a place to its stop, up to a blank line', () => {
    expect(readDay('@A\nOne\nTwo\n\nThree')).toEqual([
      { kind: 'timeline', stops: [stop('A', null, null, [text('One'), text('Two')])] },
      { kind: 'prose', lines: [text('Three')] },
    ])
  })

  it('ends a timeline at a heading, which stands on its own', () => {
    expect(readDay('@A\nOne\nLater:\n@B')).toEqual([
      { kind: 'timeline', stops: [stop('A', null, null, [text('One')])] },
      { kind: 'heading', text: 'Later' },
      { kind: 'timeline', stops: [stop('B', null)] },
    ])
  })

  it('makes one small gap of any number of blank lines inside prose, and none at its ends', () => {
    expect(readDay('\n\nOne\n\n\n\nTwo\n\n')).toEqual([{ kind: 'prose', lines: [text('One'), { kind: 'gap' }, text('Two')] }])
  })

  it('runs prose until a place line, and keeps paid lines where they are', () => {
    expect(readDay('Rainy\nI paid\n@A\nJessie paid')).toEqual([
      { kind: 'prose', lines: [text('Rainy'), paid('I paid', 'I')] },
      { kind: 'timeline', stops: [stop('A', null, null, [paid('Jessie paid', 'Jessie')])] },
    ])
  })

  it('reads \\r\\n line breaks from a backup the same way', () => {
    expect(readDay('@A 10:30\r\nOne')).toEqual(readDay('@A 10:30\nOne'))
  })
})

describe('AM or PM', () => {
  it('reads the owner’s day in day order', () => {
    expect(timesOf(OWNER_DAY_TYPED)).toEqual([630, 690, 713, 930, null, 1050, [1170, 1210], 1230])
  })

  it('reads the first time of the day as a morning from 7 to 11, and an afternoon for 12 and 1 to 6', () => {
    expect(timesOf('@A 7:00')).toEqual([420])
    expect(timesOf('@A 11:00')).toEqual([660])
    expect(timesOf('@A 12:00')).toEqual([720])
    expect(timesOf('@A 6:00')).toEqual([1080])
  })

  it('reads a late unmarked time past midnight', () => {
    expect(timesOf('@A 9pm\n@B 12:30')).toEqual([1260, 1470])
  })

  it('counts a fixed time earlier than the latest so far as past midnight, and reads on from it', () => {
    expect(timesOf('@A 9pm\n@B 1am\n@C 2:00')).toEqual([1260, 1500, 1560])
  })

  it('gives a range with am or pm only on its end the same half when that keeps the start first', () => {
    expect(timesOf('@A 7-9pm')).toEqual([[1140, 1260]])
    expect(timesOf('@A 11-1pm')).toEqual([[660, 780]])
  })

  it('reads 24-hour times and a leading zero exactly as typed', () => {
    expect(timesOf('@A 15:30')).toEqual([930])
    expect(timesOf('@A 08:30')).toEqual([510])
    expect(timesOf('@A 0:15')).toEqual([15])
    // A leading zero is a morning even as the first time, where "5:30" reads 5:30 PM.
    expect(timesOf('@A 05:30')).toEqual([330])
    expect(timesOf('@A 5:30')).toEqual([1050])
  })

  it('reads a range end after its start', () => {
    expect(timesOf('@A 11am-1:30')).toEqual([[660, 810]])
  })

  it('changes how a later time reads when a place is added above it, and never the text', () => {
    expect(timesOf('@B 3:30')).toEqual([930])
    expect(timesOf('@A 9pm\n@B 3:30')).toEqual([1260, 1650])
  })
})

describe('daySnippet', () => {
  it('lists the first three places, then how many more', () => {
    expect(daySnippet(OWNER_DAY_TYPED)).toBe('nonstopstyle, strand bookstore, Sammy L coffee and 5 more')
    expect(daySnippet(OWNER_MESSAGE)).toBe('nonstopstyle, strand bookstore, Sammy L coffee and 5 more')
  })

  it('lists one, two or three places like names', () => {
    expect(daySnippet('@Cafe 10:30\nCoffee')).toBe('Cafe')
    expect(daySnippet('@Cafe\n@Park')).toBe('Cafe and Park')
    expect(daySnippet('@Cafe\n@Park\n@Bar')).toBe('Cafe, Park and Bar')
    expect(daySnippet('@Cafe\n@Park\n@Bar\n@Gym')).toBe('Cafe, Park, Bar and 1 more')
  })

  it('counts a place once, ignoring case, spelled as it first appears', () => {
    expect(daySnippet('@Cafe 9am\n@Park\n@cafe 5pm')).toBe('Cafe and Park')
  })

  it('without places, shows the first line', () => {
    expect(daySnippet('Tacos')).toBe('Tacos')
    expect(daySnippet('\n  Tacos  \nThen karaoke')).toBe('Tacos')
  })

  it('cuts a long first line at the last space within 80 characters, or at 80 for one long word', () => {
    const words = 'We walked all the way along the river to the old bridge and back again before dinner'
    expect(words.length).toBeGreaterThan(80)
    expect(daySnippet(words)).toBe('We walked all the way along the river to the old bridge and back again before…')
    expect(daySnippet('x'.repeat(100))).toBe(`${'x'.repeat(80)}…`)
    const eighty = 'y'.repeat(80)
    expect(daySnippet(eighty)).toBe(eighty)
  })

  it('is null for an empty day', () => {
    expect(daySnippet('')).toBeNull()
    expect(daySnippet(' \n\n ')).toBeNull()
  })
})

describe('isDayEmpty', () => {
  const empty = meetup('m1', '2026-10-03', ['f1'])

  it('is true with nothing written, picked or felt', () => {
    expect(isDayEmpty(empty)).toBe(true)
    expect(isDayEmpty({ ...empty, note: ' \n ', feelings: ' ' })).toBe(true)
  })

  it('is false with any of the day’s fields', () => {
    expect(isDayEmpty({ ...empty, note: 'Tacos' })).toBe(false)
    expect(isDayEmpty({ ...empty, feelings: 'Good' })).toBe(false)
    expect(isDayEmpty({ ...empty, weather: ['rainy'] })).toBe(false)
    expect(isDayEmpty({ ...empty, mood: 'okay' })).toBe(false)
  })
})
