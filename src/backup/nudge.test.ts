import { describe, expect, it } from 'vitest'
import { BACKUP_NUDGE_DAYS, backupDue, meetupsSinceBackup, showBackupDot } from './nudge'

/** Noon on a day of 2026, in the phone's time zone (America/Los_Angeles in the tests). */
function noon(month: number, day: number): Date {
  return new Date(2026, month - 1, day, 12)
}

function logged(date: Date) {
  return { createdAt: date.toISOString() }
}

const BACKUP = noon(9, 1).toISOString()

describe('meetupsSinceBackup', () => {
  it('counts only meetups logged after the backup', () => {
    const meetups = [logged(noon(8, 30)), logged(new Date(2026, 8, 1, 11)), logged(noon(9, 2)), logged(noon(9, 20))]
    expect(meetupsSinceBackup(meetups, BACKUP)).toBe(2)
    expect(meetupsSinceBackup([logged(noon(9, 1))], BACKUP)).toBe(0)
  })

  it('counts every meetup when there has been no backup', () => {
    expect(meetupsSinceBackup([logged(noon(1, 1)), logged(noon(9, 2))], null)).toBe(2)
    expect(meetupsSinceBackup([], null)).toBe(0)
  })
})

describe('backupDue', () => {
  const since = [logged(noon(9, 2))]

  it('is due 30 days after a backup with a meetup logged since, not at 29', () => {
    expect(BACKUP_NUDGE_DAYS).toBe(30)
    expect(backupDue(since, BACKUP, noon(9, 30))).toBe(false)
    expect(backupDue(since, BACKUP, noon(10, 1))).toBe(true)
  })

  it('is never due with nothing new since the backup', () => {
    expect(backupDue([logged(noon(8, 20))], BACKUP, noon(10, 31))).toBe(false)
    expect(backupDue([], BACKUP, noon(10, 31))).toBe(false)
  })

  it('with no backup, is due once the first meetup is 30 days old', () => {
    const meetups = [logged(noon(9, 20)), logged(noon(9, 1))]
    expect(backupDue(meetups, null, noon(9, 30))).toBe(false)
    expect(backupDue(meetups, null, noon(10, 1))).toBe(true)
    expect(backupDue([], null, noon(12, 1))).toBe(false)
  })
})

describe('showBackupDot', () => {
  const now = noon(10, 21)

  it('shows while a backup is due and the dot was not seen in the last 30 days', () => {
    expect(showBackupDot(true, null, now)).toBe(true)
    expect(showBackupDot(true, noon(10, 11).toISOString(), now)).toBe(false)
    expect(showBackupDot(true, noon(9, 21).toISOString(), now)).toBe(true)
    expect(showBackupDot(false, null, now)).toBe(false)
  })
})
