import type { DayStop, DayTime } from './dayText'

/** How the phone shows times: "3:30 PM" or "15:30". */
export type ClockStyle = '12h' | '24h'

let phoneStyle: ClockStyle | null = null

/** The phone's clock style, read once: a 24-hour clock when its hour cycle is h23 or h24. */
export function clockStyle(): ClockStyle {
  if (phoneStyle === null) {
    const { hourCycle } = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions()
    phoneStyle = hourCycle === 'h23' || hourCycle === 'h24' ? '24h' : '12h'
  }
  return phoneStyle
}

const NO_BREAK_SPACE = '\u00a0'

/**
 * "3:30 PM" (a no-break space before AM or PM, built here so the spacing never depends on the browser) or
 * "15:30". Minutes past midnight (1,440 and up) show as the clock reads them.
 */
export function formatClock(minutes: number, style: ClockStyle): string {
  const inDay = ((minutes % 1440) + 1440) % 1440
  const hour = Math.floor(inDay / 60)
  const minute = String(inDay % 60).padStart(2, '0')
  if (style === '24h') return `${String(hour).padStart(2, '0')}:${minute}`
  return `${hour % 12 || 12}:${minute}${NO_BREAK_SPACE}${hour < 12 ? 'AM' : 'PM'}`
}

/** The time as text you'd type: an ordinary space before AM or PM ("9:52 PM"). */
export function typedClock(minutes: number, style: ClockStyle): string {
  return formatClock(minutes, style).replace(NO_BREAK_SPACE, ' ')
}

/** A time on the Meetup page: rough times get "~" ("~8:10 PM"). */
export function formatDayTime(time: DayTime, style: ClockStyle): string {
  return `${time.approx ? '~' : ''}${formatClock(time.minutes, style)}`
}

function spoken(time: DayTime, style: ClockStyle): string {
  return `${time.approx ? 'about ' : ''}${formatClock(time.minutes, style)}`
}

/** A stop's time in words, for announcements: "3:30 PM", "about 5:30 PM", "7:30 PM to about 8:10 PM". */
export function describeStopTime(stop: Pick<DayStop, 'start' | 'end'>, style: ClockStyle): string | null {
  if (!stop.start) return null
  return stop.end ? `${spoken(stop.start, style)} to ${spoken(stop.end, style)}` : spoken(stop.start, style)
}

/** The VoiceOver sentence for a stop's time: "At 10:30 AM.", "About 5:30 PM.", "From 7:30 PM to about 8:10 PM.". */
export function speakTime(stop: Pick<DayStop, 'start' | 'end'>, style: ClockStyle): string | null {
  if (!stop.start) return null
  if (stop.end) return `From ${spoken(stop.start, style)} to ${spoken(stop.end, style)}.`
  const time = formatClock(stop.start.minutes, style)
  return stop.start.approx ? `About ${time}.` : `At ${time}.`
}
