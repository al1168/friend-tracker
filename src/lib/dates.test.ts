import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  formatDate,
  formatMonthDay,
  formatMonthYear,
  isISODate,
  monthIndexOf,
  toISODate,
  yearOf,
} from './dates'

describe('toISODate', () => {
  it('formats a local date with zero padding', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('isISODate', () => {
  it('accepts real calendar dates', () => {
    expect(isISODate('2026-10-02')).toBe(true)
    expect(isISODate('2024-02-29')).toBe(true)
  })

  it('rejects impossible or malformed dates', () => {
    expect(isISODate('2026-02-29')).toBe(false)
    expect(isISODate('2026-13-01')).toBe(false)
    expect(isISODate('2026-1-5')).toBe(false)
    expect(isISODate('hello')).toBe(false)
  })
})

describe('daysBetween', () => {
  it('counts whole calendar days', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
    expect(daysBetween('2026-01-10', '2026-01-01')).toBe(-9)
  })

  it('is not affected by daylight saving changes', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })
})

describe('addDays', () => {
  it('moves across month, year and leap-day boundaries', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('yearOf and monthIndexOf', () => {
  it('read parts of an ISO date', () => {
    expect(yearOf('2026-09-12')).toBe(2026)
    expect(monthIndexOf('2026-09-12')).toBe(8)
    expect(monthIndexOf('2026-01-01')).toBe(0)
  })
})

describe('formatDate', () => {
  it('omits the year for dates in the current year', () => {
    expect(formatDate('2026-09-12', '2026-10-02')).toBe('Sat, Sep 12')
  })

  it('includes the year for other years', () => {
    expect(formatDate('2025-09-12', '2026-10-02')).toBe('Fri, Sep 12, 2025')
  })
})

describe('formatMonthDay', () => {
  it('gives the short month and the day, with no weekday or year', () => {
    expect(formatMonthDay('2025-10-22')).toBe('Oct 22')
    expect(formatMonthDay('2027-02-28')).toBe('Feb 28')
    expect(formatMonthDay('2025-01-01')).toBe('Jan 1')
  })
})

describe('formatMonthYear', () => {
  it('formats a month heading', () => {
    expect(formatMonthYear('2026-09-12')).toBe('September 2026')
  })
})
