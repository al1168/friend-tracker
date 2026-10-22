import { describe, expect, it } from 'vitest'
import {
  compareNames,
  describeBackup,
  describeLastBackup,
  displayText,
  firstGrapheme,
  formatNameList,
  formatSince,
  initials,
  plural,
  sameName,
  shortName,
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
    expect(describeBackup(today, '2026-10-02', 0, 0)).toBe('Last backup: today')
    expect(describeBackup(today, '2026-10-02', 12, 0)).toBe('Last backup: today. Includes 12 photos.')
    expect(describeBackup(null, '2026-10-02', 1, 0)).toBe('Never backed up. Includes 1 photo.')
  })

  it('says how many meetups were logged since the last backup', () => {
    const sixWeeks = new Date(2026, 7, 20, 9, 30).toISOString()
    const twoMonths = new Date(2026, 7, 2, 9, 30).toISOString()
    expect(describeBackup(sixWeeks, '2026-10-02', 9, 12)).toBe(
      'Last backup: 6 weeks ago. 12 meetups since then. Includes 9 photos.',
    )
    expect(describeBackup(twoMonths, '2026-10-02', 0, 1)).toBe('Last backup: 2 months ago. 1 meetup since then.')
  })

  it('never counts meetups when there has been no backup', () => {
    expect(describeBackup(null, '2026-10-02', 9, 39)).toBe('Never backed up. Includes 9 photos.')
    expect(describeBackup('garbage', '2026-10-02', 0, 3)).toBe('Never backed up')
  })
})

describe('shortName', () => {
  const brandonCao = { name: 'Brandon Cao' }
  const brandonLee = { name: 'brandon lee' }
  const mariya = { name: 'Mariya' }

  it('is the first name when no other friend shares it', () => {
    expect(shortName(brandonCao, [brandonCao])).toBe('Brandon')
    expect(shortName(brandonCao, [brandonCao, mariya])).toBe('Brandon')
    expect(shortName(mariya, [brandonCao, brandonLee, mariya])).toBe('Mariya')
  })

  it('is the full name when another friend has the same first name, ignoring case', () => {
    expect(shortName(brandonCao, [brandonCao, brandonLee, mariya])).toBe('Brandon Cao')
    expect(shortName(brandonLee, [brandonCao, brandonLee])).toBe('brandon lee')
  })

  it('ignores extra spaces', () => {
    const spaced = { name: '  Brandon   Cao ' }
    expect(shortName(spaced, [spaced])).toBe('Brandon')
    expect(shortName(spaced, [spaced, brandonLee])).toBe('Brandon   Cao')
  })
})

describe('displayText', () => {
  it('trims the ends of each line and drops blank lines at the start and end, keeping the ones between', () => {
    expect(displayText('  Tired\n\n\n')).toBe('Tired')
    expect(displayText('\n \n  It was an ok day.  \n\n  Would go again. \n')).toBe('It was an ok day.\n\nWould go again.')
  })

  it('reads Windows line breaks as line breaks', () => {
    expect(displayText('One \r\nTwo\r\n')).toBe('One\nTwo')
  })

  it('gives an empty string for words that are only spaces', () => {
    expect(displayText(' \n \t ')).toBe('')
    expect(displayText('')).toBe('')
  })
})
