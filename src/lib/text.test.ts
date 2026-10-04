import { describe, expect, it } from 'vitest'
import {
  compareNames,
  describeBackup,
  describeLastBackup,
  firstGrapheme,
  formatNameList,
  formatSince,
  initials,
  plural,
  sameName,
} from './text'

describe('formatSince', () => {
  it.each([
    [0, 'Today'],
    [1, 'Yesterday'],
    [2, '2 days ago'],
    [13, '13 days ago'],
    [14, '2 weeks ago'],
    [59, '8 weeks ago'],
    [60, '2 months ago'],
    [364, '12 months ago'],
    [365, '1 year ago'],
    [800, '2 years ago'],
  ])('%i days → %s', (days, text) => {
    expect(formatSince(days)).toBe(text)
  })
})

describe('plural', () => {
  it('picks singular or plural', () => {
    expect(plural(1, 'meetup')).toBe('1 meetup')
    expect(plural(2, 'meetup')).toBe('2 meetups')
    expect(plural(0, 'friend')).toBe('0 friends')
  })
})

describe('formatNameList', () => {
  it('joins names naturally', () => {
    expect(formatNameList([])).toBe('')
    expect(formatNameList(['Alex'])).toBe('Alex')
    expect(formatNameList(['Alex', 'Sam'])).toBe('Alex and Sam')
    expect(formatNameList(['Alex', 'Sam', 'Kim'])).toBe('Alex, Sam and Kim')
    expect(formatNameList(['Alex', 'Sam', 'Kim', 'Lee', 'Max'])).toBe('Alex, Sam and 3 others')
  })
})

describe('compareNames', () => {
  it('sorts names ignoring case', () => {
    expect(['bob', 'Alice', 'carol'].sort(compareNames)).toEqual(['Alice', 'bob', 'carol'])
  })
})

describe('sameName', () => {
  it('ignores case and surrounding spaces', () => {
    expect(sameName(' Work ', 'work')).toBe(true)
    expect(sameName('Work', 'Works')).toBe(false)
  })
})

describe('initials', () => {
  it('uses the first and last word', () => {
    expect(initials('Alex Smith')).toBe('AS')
    expect(initials('Mary Jane Watson')).toBe('MW')
    expect(initials('alex')).toBe('A')
    expect(initials('   ')).toBe('?')
  })
})

describe('firstGrapheme', () => {
  it('keeps whole emoji, including skin tones', () => {
    expect(firstGrapheme('👍🏽 yes')).toBe('👍🏽')
    expect(firstGrapheme('  ab')).toBe('a')
    expect(firstGrapheme('')).toBe('')
  })
})

describe('describeLastBackup', () => {
  it('describes when the last backup happened', () => {
    expect(describeLastBackup(null, '2026-10-02')).toBe('Never backed up')
    expect(describeLastBackup('garbage', '2026-10-02')).toBe('Never backed up')
    expect(describeLastBackup(new Date(2026, 9, 1, 23, 30).toISOString(), '2026-10-01')).toBe('Last backup: today')
    expect(describeLastBackup(new Date(2026, 9, 2, 9, 30).toISOString(), '2026-10-02')).toBe('Last backup: today')
    expect(describeLastBackup(new Date(2026, 9, 1, 22, 0).toISOString(), '2026-10-02')).toBe('Last backup: yesterday')
    expect(describeLastBackup(new Date(2026, 8, 11, 12, 0).toISOString(), '2026-10-02')).toBe('Last backup: 3 weeks ago')
  })
})

describe('describeBackup', () => {
  it('adds the photo count when there are photos', () => {
    const today = new Date(2026, 9, 2, 9, 30).toISOString()
    expect(describeBackup(today, '2026-10-02', 0)).toBe('Last backup: today')
    expect(describeBackup(today, '2026-10-02', 12)).toBe('Last backup: today. Includes 12 photos.')
    expect(describeBackup(null, '2026-10-02', 1)).toBe('Never backed up. Includes 1 photo.')
  })
})
