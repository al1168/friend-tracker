import { describe, expect, it } from 'vitest'
import { reminderFooter } from './footer'
import { REMINDERS_OFF, type BirthdayReminders } from './types'

const ON: BirthdayReminders = {
  enabled: true,
  lastSyncedHash: 'hash',
  lastSyncedAt: '2026-10-03T12:00:00.000Z',
  lastError: null,
}

describe('reminderFooter', () => {
  it('describes reminders when they can be turned on', () => {
    expect(reminderFooter('available', REMINDERS_OFF)).toBe('A notification at 11:55 PM the night before each birthday.')
  })

  it('asks for the Home Screen app where push is unavailable, whatever the setting', () => {
    for (const reminders of [REMINDERS_OFF, ON]) {
      expect(reminderFooter('unavailable', reminders)).toBe('Open Friend Tracker from your Home Screen to turn on reminders.')
    }
  })

  it('explains how to allow notifications once they were denied', () => {
    for (const reminders of [REMINDERS_OFF, ON]) {
      expect(reminderFooter('denied', reminders)).toBe(
        "Notifications are off for Friend Tracker. Turn them on in the iPhone's Settings app, under Notifications.",
      )
    }
  })

  it('says when they are on, and when the last update failed', () => {
    expect(reminderFooter('available', ON)).toBe("On. You'll get a note at 11:55 PM the night before each birthday.")
    expect(reminderFooter('available', { ...ON, lastError: 'sync' })).toBe(
      "On. You'll get a note at 11:55 PM the night before each birthday. Couldn't update reminders just now. The app will try again next time it opens.",
    )
  })

  it('says when they stopped by themselves', () => {
    expect(reminderFooter('available', { ...REMINDERS_OFF, lastError: 'revoked' })).toBe('Reminders stopped. Turn them on again.')
  })

  it('reads as plain off while a delete is still pending', () => {
    expect(reminderFooter('available', { ...REMINDERS_OFF, lastError: 'delete' })).toBe(
      'A notification at 11:55 PM the night before each birthday.',
    )
  })
})
