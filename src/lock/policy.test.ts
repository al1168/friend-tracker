import { describe, expect, it } from 'vitest'
import { addFailure, backoffMs, formatWait, parseLastActive, shouldLock, waitRemainingMs } from './policy'

const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)
const MINUTE = 60_000

describe('shouldLock', () => {
  it('never locks when the lock is off', () => {
    expect(shouldLock({ enabled: false, lastActiveAt: null, now: NOW })).toBe(false)
    expect(shouldLock({ enabled: false, lastActiveAt: NOW - 60 * MINUTE, now: NOW })).toBe(false)
  })

  it('locks when the last active time is unknown', () => {
    expect(shouldLock({ enabled: true, lastActiveAt: null, now: NOW })).toBe(true)
  })

  it('locks when the clock went backwards', () => {
    expect(shouldLock({ enabled: true, lastActiveAt: NOW + 1, now: NOW })).toBe(true)
  })

  it('locks after 15 minutes away, not before', () => {
    expect(shouldLock({ enabled: true, lastActiveAt: NOW - 15 * MINUTE + 1, now: NOW })).toBe(false)
    expect(shouldLock({ enabled: true, lastActiveAt: NOW - 15 * MINUTE, now: NOW })).toBe(true)
  })
})

describe('wrong PIN backoff', () => {
  it('waits nothing for 4 failures, then 30 s doubling up to 15 minutes', () => {
    expect([1, 2, 3, 4].map(backoffMs)).toEqual([0, 0, 0, 0])
    expect([5, 6, 7, 8, 9].map(backoffMs)).toEqual([30_000, 60_000, 120_000, 240_000, 480_000])
    expect(backoffMs(10)).toBe(15 * MINUTE)
    expect(backoffMs(25)).toBe(15 * MINUTE)
  })

  it('records when the wait ends', () => {
    expect(addFailure({ count: 0, lockedUntil: null }, NOW)).toEqual({ count: 1, lockedUntil: null })
    expect(addFailure({ count: 4, lockedUntil: null }, NOW)).toEqual({ count: 5, lockedUntil: NOW + 30_000 })
    expect(addFailure({ count: 5, lockedUntil: NOW + 30_000 }, NOW + 40_000)).toEqual({
      count: 6,
      lockedUntil: NOW + 100_000,
    })
  })

  it('counts down the wait', () => {
    expect(waitRemainingMs({ count: 3, lockedUntil: null }, NOW)).toBe(0)
    expect(waitRemainingMs({ count: 5, lockedUntil: NOW + 30_000 }, NOW + 10_000)).toBe(20_000)
    expect(waitRemainingMs({ count: 5, lockedUntil: NOW + 30_000 }, NOW + 31_000)).toBe(0)
  })

  it('formats the wait as minutes and seconds', () => {
    expect(formatWait(30_000)).toBe('0:30')
    expect(formatWait(29_001)).toBe('0:30')
    expect(formatWait(1)).toBe('0:01')
    expect(formatWait(120_000)).toBe('2:00')
    expect(formatWait(15 * MINUTE)).toBe('15:00')
  })
})

describe('parseLastActive', () => {
  it('reads a stored timestamp', () => {
    expect(parseLastActive(String(NOW))).toBe(NOW)
  })

  it('treats anything else as unknown', () => {
    for (const bad of [null, '', 'abc', '-5', '1e3', '12.5', ' 12']) expect(parseLastActive(bad)).toBeNull()
  })
})
