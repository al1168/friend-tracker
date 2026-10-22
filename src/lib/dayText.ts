import type { Meetup } from '../types'

// Reading a day (grammar 1). Pure: no window, document or Intl, so the service worker and tests can use it.
// FROZEN: these rules never change, so a memory reads the same after every update. A change is a new grammar
// (stored as `dayGrammar: 2` on days saved after it); meetups without a grammar field are grammar 1. The golden
// fixtures in dayText.test.ts pin it.

/** The day box stops typing here. A longer day from before, or from a backup, is kept and still editable. */
export const DAY_MAX_TYPED = 10_000
export const FEELINGS_MAX = 4_000
/** Shown under a The day or How it felt box that takes no more. */
export const BOX_FULL = 'This box is full.'
export const TOO_LONG_FEELINGS = 'Keep how it felt under 4,000 characters.'

export type DayLine =
  | { kind: 'text'; text: string }
  /** "Jessie paid": `who` is the words before "paid"; null for a shared bill ("We split it"). */
  | { kind: 'paid'; text: string; who: string | null }

export interface DayTime {
  /** Minutes after the day's midnight, 0 to 2879: a reading past midnight adds 1,440. */
  minutes: number
  /** Typed with "~", "about" or "around". */
  approx: boolean
}

export interface DayStop {
  place: string
  start: DayTime | null
  end: DayTime | null
  lines: DayLine[]
}

export interface DayGap {
  kind: 'gap'
}

export type DayPart =
  | { kind: 'heading'; text: string }
  | { kind: 'timeline'; stops: DayStop[] }
  | { kind: 'prose'; lines: (DayLine | DayGap)[] }

/** "\r\n" and "\r" become "\n". Nothing else about the text changes. */
export function normalizeLineBreaks(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

const LINE_BREAK = /\r\n?|\n/
const DAY_MINUTES = 1440
const NOON = 720

/** A clock as typed at the end of a place line. */
interface Clock {
  hour: number
  minute: number
  half: 'am' | 'pm' | null
  /** "08:30": a leading zero fixes the time as typed. */
  leadingZero: boolean
  /** An hour with no minutes and no am or pm ("7" in "7-9pm"). */
  bare: boolean
  approx: boolean
}

const APPROX = String.raw`(~\s*|(?:about|around)\s+)?`
const CLOCK = String.raw`(\d{1,2})(?:[:.](\d{2}))?(?:\s*([ap]m))?`
const TIME = new RegExp(String.raw`^${APPROX}${CLOCK}(?:(?:\s*[-\u2013\u2014]\s*|\s+to\s+)${APPROX}${CLOCK})?$`, 'i')

function clockOf(approx: string | undefined, hourText: string, minuteText: string | undefined, halfText: string | undefined): Clock | null {
  const hour = Number(hourText)
  const minute = minuteText === undefined ? 0 : Number(minuteText)
  const half = halfText === undefined ? null : halfText.toLowerCase() === 'am' ? 'am' : 'pm'
  if (minute > 59) return null
  if (half ? hour < 1 || hour > 12 : hour > 23) return null
  return {
    hour,
    minute,
    half,
    leadingZero: hourText.length === 2 && hourText.startsWith('0'),
    bare: minuteText === undefined && half === null,
    approx: approx !== undefined,
  }
}

/** A time, or a range of two, filling all of `text`. A lone clock needs minutes or am/pm; so does a range's end. */
function readTimeText(text: string): { start: Clock; end: Clock | null } | null {
  const match = TIME.exec(text)
  if (!match) return null
  const start = clockOf(match[1], match[2], match[3], match[4])
  if (!start) return null
  if (match[6] === undefined) return start.bare ? null : { start, end: null }
  const end = clockOf(match[5], match[6], match[7], match[8])
  return end && !end.bare ? { start, end } : null
}

interface PlaceLine {
  place: string
  start: Clock | null
  end: Clock | null
}

/** A trimmed line read as a place line; 'skip' for "@" alone; null when it isn't one. */
function readPlaceLine(line: string): PlaceLine | 'skip' | null {
  if (!line.startsWith('@')) return null
  if (line === '@') return 'skip'
  let rest = line.replace(/[\s,.;!]+$/, '')
  let start: Clock | null = null
  let end: Clock | null = null
  // A time at the end, after a space: the longest that reads as a time.
  for (let i = 0; i < rest.length; i += 1) {
    if (!/\s/.test(rest[i])) continue
    const time = readTimeText(rest.slice(i + 1))
    if (time) {
      start = time.start
      end = time.end
      rest = rest.slice(0, i)
      break
    }
  }
  const place = rest
    .split(/\s+/)
    .map((word) => word.replace(/^@+/, ''))
    .filter((word) => word !== '')
    .join(' ')
  return place === '' ? null : { place, start, end }
}

/**
 * Whether a line, read on its own, is a place line: one readDay makes a stop of. Spaces around it don't count;
 * "@" alone, "@ 3:30" and an "@" after the start of a line aren't places. The day boxes tint these lines.
 */
export function isPlaceLine(line: string): boolean {
  const place = readPlaceLine(line.trim())
  return place !== null && place !== 'skip'
}

function minutesOf(hour: number, minute: number, half: 'am' | 'pm'): number {
  return (hour % 12) * 60 + minute + (half === 'pm' ? NOON : 0)
}

/** Typed with am or pm, an hour of 0 or 13 to 23, or a leading zero: read exactly as typed. */
function isFixed(clock: Clock): boolean {
  return clock.half !== null || clock.hour === 0 || clock.hour >= 13 || clock.leadingZero
}

/** A fixed time earlier than the latest so far is past midnight. */
function afterLatest(minutes: number, latest: number | null): number {
  return latest !== null && minutes < latest ? minutes + DAY_MINUTES : minutes
}

/** Reads a clock in day order: the earliest reading (AM, PM, then both past midnight) not before the latest so far. */
function resolve(clock: Clock, latest: number | null): number {
  if (clock.half) return afterLatest(minutesOf(clock.hour, clock.minute, clock.half), latest)
  if (isFixed(clock)) return afterLatest(clock.hour * 60 + clock.minute, latest)
  const am = minutesOf(clock.hour, clock.minute, 'am')
  const pm = am + NOON
  // The first time of the day: 7 to 11 are mornings; 12 and 1 to 6 are afternoons.
  if (latest === null) return clock.hour >= 7 && clock.hour <= 11 ? am : pm
  const readings = [am, pm, am + DAY_MINUTES, pm + DAY_MINUTES]
  return readings.find((reading) => reading >= latest) ?? readings[readings.length - 1]
}

/** A range with am or pm only on its end: the start takes the same half when that keeps it before the end. */
function startFromEnd(start: Clock, end: Clock & { half: 'am' | 'pm' }): number {
  const same = minutesOf(start.hour, start.minute, end.half)
  return same < minutesOf(end.hour, end.minute, end.half)
    ? same
    : minutesOf(start.hour, start.minute, end.half === 'am' ? 'pm' : 'am')
}

const PAID = /^(\S+(?:\s+\S+){0,2})\s+paid(?:\s+for\s.*)?$/i
const NOBODY = /^(?:nobody|no one)$/i
const SPLIT = new Set(['split', 'split it', 'we split', 'we split it', 'split the bill', 'split the check'])

/** A line that isn't a place line: who paid, a shared bill, or text. */
function readLine(line: string): DayLine {
  const words = line.replace(/[.!]$/, '')
  if (SPLIT.has(words.toLowerCase())) return { kind: 'paid', text: line, who: null }
  const paid = PAID.exec(words)
  if (paid && !NOBODY.test(paid[1])) return { kind: 'paid', text: line, who: paid[1] }
  return { kind: 'text', text: line }
}

/** "Locations:" reads as the heading "Locations": a line ending with ":", at most 40 characters. */
function headingOf(line: string): string | null {
  if (!line.endsWith(':') || Array.from(line).length > 40) return null
  const text = line.slice(0, -1).trim()
  return text === '' ? null : text
}

/**
 * Reads a day (grammar 1) into headings, timelines of places and prose, top to bottom. The text itself is
 * never changed: this is only how it reads back.
 */
export function readDay(note: string): DayPart[] {
  const parts: DayPart[] = []
  let timeline: DayStop[] | null = null
  let stop: DayStop | null = null
  let prose: (DayLine | DayGap)[] | null = null
  let gap = false
  let latest: number | null = null

  for (const raw of note.split(LINE_BREAK)) {
    const line = raw.trim()
    if (line === '') {
      // A blank line ends a stop's lines (the timeline goes on with the next place) and makes a gap in prose.
      stop = null
      if (prose) gap = true
      continue
    }

    const place = readPlaceLine(line)
    if (place === 'skip') continue
    if (place) {
      if (!timeline) {
        timeline = []
        parts.push({ kind: 'timeline', stops: timeline })
      }
      prose = null
      gap = false
      let start: DayTime | null = null
      let end: DayTime | null = null
      if (place.start) {
        const startMinutes =
          place.end?.half && !isFixed(place.start)
            ? afterLatest(startFromEnd(place.start, { ...place.end, half: place.end.half }), latest)
            : resolve(place.start, latest)
        start = { minutes: startMinutes, approx: place.start.approx }
        latest = Math.max(latest ?? startMinutes, startMinutes)
        if (place.end) {
          const endMinutes = resolve(place.end, latest)
          end = { minutes: endMinutes, approx: place.end.approx }
          latest = Math.max(latest, endMinutes)
        }
      }
      stop = { place: place.place, start, end, lines: [] }
      timeline.push(stop)
      continue
    }

    const dayLine = readLine(line)
    const heading = dayLine.kind === 'text' ? headingOf(line) : null
    if (heading !== null) {
      timeline = null
      stop = null
      prose = null
      gap = false
      parts.push({ kind: 'heading', text: heading })
      continue
    }
    if (stop) {
      stop.lines.push(dayLine)
      continue
    }
    timeline = null
    if (!prose) {
      prose = []
      parts.push({ kind: 'prose', lines: prose })
    } else if (gap) {
      prose.push({ kind: 'gap' })
    }
    gap = false
    prose.push(dayLine)
  }
  return parts
}

const SNIPPET_LENGTH = 80

/** Places written like names: "a", "a and b", "a, b and c", then "a, b, c and 5 more". */
function listPlaces(places: string[]): string {
  if (places.length === 1) return places[0]
  if (places.length === 2) return `${places[0]} and ${places[1]}`
  if (places.length === 3) return `${places[0]}, ${places[1]} and ${places[2]}`
  return `${places[0]}, ${places[1]}, ${places[2]} and ${places.length - 3} more`
}

/**
 * A history row's glimpse of the day: its first places (each counted once, ignoring case), or else its first
 * line, cut at 80 characters. Null for an empty day.
 */
export function daySnippet(note: string): string | null {
  const places: string[] = []
  const seen = new Set<string>()
  for (const part of readDay(note)) {
    if (part.kind !== 'timeline') continue
    for (const { place } of part.stops) {
      const key = place.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      places.push(place)
    }
  }
  if (places.length > 0) return listPlaces(places)
  const first = note
    .split(LINE_BREAK)
    .map((line) => line.trim())
    .find((line) => line !== '')
  if (first === undefined) return null
  const characters = Array.from(first)
  if (characters.length <= SNIPPET_LENGTH) return first
  const head = characters.slice(0, SNIPPET_LENGTH).join('')
  const space = head.lastIndexOf(' ')
  return `${(space > 0 ? head.slice(0, space) : head).trimEnd()}…`
}

/** Nothing written about the day: no words in either box, no weather and no mood. */
export function isDayEmpty(meetup: Pick<Meetup, 'note' | 'feelings' | 'weather' | 'mood'>): boolean {
  return meetup.note.trim() === '' && meetup.feelings.trim() === '' && meetup.weather.length === 0 && meetup.mood === null
}
