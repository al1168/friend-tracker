import type { BirthdayReminders, PushSupport } from './types'

/** The Reminders group's footer in Settings. */
export function reminderFooter(support: PushSupport, reminders: BirthdayReminders): string {
  if (support === 'unavailable') return 'Open Friend Tracker from your Home Screen to turn on reminders.'
  if (support === 'denied') {
    return "Notifications are off for Friend Tracker. Turn them on in the iPhone's Settings app, under Notifications → Friends."
  }
  if (reminders.enabled) {
    const on = "On. You'll get a note at 11:55 PM the night before each birthday."
    if (reminders.lastError !== 'sync') return on
    return `${on} Couldn't update reminders just now. The app will try again next time it opens.`
  }
  if (reminders.lastError === 'revoked') return 'Reminders stopped. Turn them on again.'
  return 'A notification at 11:55 PM the night before each birthday.'
}
