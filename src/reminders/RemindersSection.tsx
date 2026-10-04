import { useId, useRef } from 'react'
import { InsetGroup, Row } from '../components/InsetGroup'
import { useToast } from '../components/Toast'
import { browserReminderDeps } from './browserPush'
import { reminderFooter } from './footer'
import { sendTestNotification, turnOffReminders, turnOnReminders } from './reminderStore'
import type { BirthdayReminders } from './types'
import { usePushSupport } from './usePushSupport'

/** How long after a tap's work is done that more taps on the same row are still ignored (a double tap). */
const TAP_GUARD_MS = 300

/**
 * Wraps a row's tap so it runs one at a time. The work starts right inside the tap, so iOS
 * still counts it as the tap when it shows the notification prompt.
 */
function useOneAtATime() {
  const busy = useRef(false)
  return (run: () => Promise<void>) => () => {
    if (busy.current) return
    busy.current = true
    void run().finally(() => {
      window.setTimeout(() => {
        busy.current = false
      }, TAP_GUARD_MS)
    })
  }
}

/** The "Reminders" group on the Settings screen. */
export function RemindersSection({ reminders }: { reminders: BirthdayReminders }) {
  const toast = useToast()
  const [support, recheckSupport] = usePushSupport(browserReminderDeps.push)
  const switchTap = useOneAtATime()
  const testTap = useOneAtATime()
  const footerId = useId()
  const usable = support === 'available'

  const toggle = switchTap(async () => {
    if (reminders.enabled) {
      try {
        await turnOffReminders(browserReminderDeps)
        toast({ message: 'Birthday reminders are off', tone: 'plain' })
      } catch {
        // The browser's database refused the write.
        toast({ message: "Couldn't turn off reminders. Please try again.", tone: 'plain' })
      }
      return
    }
    const result = await turnOnReminders(browserReminderDeps)
    if (result === 'on') toast({ message: 'Birthday reminders are on' })
    else if (result === 'denied') {
      // The footer now says how to allow notifications; the toast announces it.
      recheckSupport()
      toast({ message: reminderFooter('denied', reminders), tone: 'plain' })
    } else if (result === 'not-set-up') toast({ message: "Birthday reminders aren't set up yet.", tone: 'plain' })
    else toast({ message: "Couldn't turn on reminders. Please try again.", tone: 'plain' })
  })

  const sendTest = testTap(async () => {
    const outcome = await sendTestNotification(browserReminderDeps)
    if (outcome === 'sent') toast({ message: 'Test notification sent' })
    else toast({ message: "Couldn't send a test notification. Please try again.", tone: 'plain' })
  })

  return (
    <InsetGroup title="Reminders" footer={reminderFooter(support, reminders)} footerId={footerId}>
      <Row
        title="Birthday reminders"
        switchOn={reminders.enabled}
        disabled={!usable}
        describedBy={usable ? undefined : footerId}
        onClick={toggle}
      />
      {reminders.enabled && usable && <Row title="Send a test notification" accent onClick={sendTest} />}
    </InsetGroup>
  )
}
