import { describe, expect, it } from 'vitest'
import { describeStopTime, formatClock, formatDayTime, speakTime, typedClock } from './clock'

const NBSP = '\u00a0'

describe('formatClock', () => {
  it('writes a 12-hour time with a no-break space before AM or PM', () => {
    expect(formatClock(630, '12h')).toBe(`10:30${NBSP}AM`)
    expect(formatClock(930, '12h')).toBe(`3:30${NBSP}PM`)
    expect(formatClock(0, '12h')).toBe(`12:00${NBSP}AM`)
    expect(formatClock(720, '12h')).toBe(`12:00${NBSP}PM`)
    expect(formatClock(1312, '12h')).toBe(`9:52${NBSP}PM`)
  })

  it('writes a 24-hour time with two-digit hours', () => {
    expect(formatClock(930, '24h')).toBe('15:30')
    expect(formatClock(1312, '24h')).toBe('21:52')
    expect(formatClock(65, '24h')).toBe('01:05')
  })

  it('shows a time past midnight as the clock reads it', () => {
    expect(formatClock(1470, '12h')).toBe(`12:30${NBSP}AM`)
    expect(formatClock(1500, '24h')).toBe('01:00')
  })
})

describe('typedClock', () => {
  it('uses an ordinary space, as you would type it', () => {
    expect(typedClock(1312, '12h')).toBe('9:52 PM')
    expect(typedClock(1312, '24h')).toBe('21:52')
  })
})

describe('formatDayTime', () => {
  it('marks a rough time with "~"', () => {
    expect(formatDayTime({ minutes: 1210, approx: true }, '12h')).toBe(`~8:10${NBSP}PM`)
    expect(formatDayTime({ minutes: 1170, approx: false }, '12h')).toBe(`7:30${NBSP}PM`)
  })
})

describe('speakTime', () => {
  it('gives VoiceOver a sentence for each kind of time', () => {
    expect(speakTime({ start: { minutes: 630, approx: false }, end: null }, '12h')).toBe(`At 10:30${NBSP}AM.`)
    expect(speakTime({ start: { minutes: 1050, approx: true }, end: null }, '12h')).toBe(`About 5:30${NBSP}PM.`)
    expect(
      speakTime({ start: { minutes: 1170, approx: false }, end: { minutes: 1210, approx: true } }, '12h'),
    ).toBe(`From 7:30${NBSP}PM to about 8:10${NBSP}PM.`)
    expect(speakTime({ start: { minutes: 930, approx: false }, end: null }, '24h')).toBe('At 15:30.')
    expect(speakTime({ start: null, end: null }, '12h')).toBeNull()
  })
})

describe('describeStopTime', () => {
  it('says a stop’s time in words for an announcement', () => {
    expect(describeStopTime({ start: { minutes: 930, approx: false }, end: null }, '12h')).toBe(`3:30${NBSP}PM`)
    expect(
      describeStopTime({ start: { minutes: 1170, approx: false }, end: { minutes: 1210, approx: true } }, '12h'),
    ).toBe(`7:30${NBSP}PM to about 8:10${NBSP}PM`)
    expect(describeStopTime({ start: null, end: null }, '12h')).toBeNull()
  })
})
