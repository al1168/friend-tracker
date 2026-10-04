import { expect, test, type Page } from '@playwright/test'
import {
  addFriend,
  addToList,
  dayFromToday,
  drawnPhoto,
  goToTab,
  lockHeading,
  logMeetup,
  reopenAfterAWhile,
  seedAppLock,
  setBirthday,
  stubFaceId,
  stubPush,
} from './helpers.ts'

const DIR = 'e2e/screenshots'
// Roughly the iPhone's largest standard text size.
const LARGE_TEXT = 'html { font: 23px/1.35 -apple-system, system-ui, sans-serif !important; }'

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

async function seed(page: Page) {
  await page.goto('/')
  await page.getByRole('complementary', { name: 'Install the app' }).getByRole('button', { name: 'Dismiss' }).click()
  // Birthdays soon shows Maya (today), Sam (in 3 days, with an age) and Theo (in 9 days).
  // Ages are multiples of 4, so a birthday that lands on Feb 29 still has a leap birth year.
  const today = dayFromToday(0)
  const inThree = dayFromToday(3)
  const inNine = dayFromToday(9)
  await addFriend(page, 'Alex Rivera', 'College')
  await addFriend(page, 'Sam Chen', 'College', { ...inThree, year: inThree.year - 28 })
  await addFriend(page, 'Kim Park', 'Work')
  await addFriend(page, 'Jordan Lee', 'Work')
  await addFriend(page, 'Maya Patel', undefined, { month: today.month, day: today.day })
  await addFriend(page, 'Theo Brooks', 'Family', { month: inNine.month, day: inNine.day })
  // The meetup page, the viewer and the sheet show this one: two activities and three photos.
  const photos = [
    await drawnPhoto(page, 'ramen.png', 1200, 900, 25),
    await drawnPhoto(page, 'karaoke.png', 900, 1200, 300),
    await drawnPhoto(page, 'street.png', 1200, 800, 200),
  ]
  await logMeetup(page, ['Alex Rivera', 'Sam Chen'], {
    type: 'Meal',
    note: 'Ramen night',
    date: daysAgo(3),
    activities: ['Karaoke', 'Board games'],
    photos,
  })
  await logMeetup(page, ['Kim Park'], { type: 'Coffee', date: daysAgo(20) })
  await logMeetup(page, ['Alex Rivera'], { type: 'Drinks', date: daysAgo(45) })
  await logMeetup(page, ['Theo Brooks'], { type: 'Call', date: daysAgo(120) })
  await logMeetup(page, ['Alex Rivera', 'Kim Park', 'Jordan Lee'], { type: 'Party', date: daysAgo(300) })
  await logMeetup(page, ['Sam Chen'], { type: 'Trip', date: daysAgo(400) })
  await page.getByRole('link', { name: /Alex Rivera/ }).click()
  // Alex's birthday is further off, so the friend page shows it but Birthdays soon doesn't
  // (and Alex keeps a single link on the Friends tab).
  const inForty = dayFromToday(40)
  await page.getByRole('region', { name: 'Birthday', exact: true }).getByRole('button', { name: 'Add birthday' }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await setBirthday(sheet, { ...inForty, year: inForty.year - 32 })
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  await addToList(page, 'Likes', 'Ramen, Board games, Hiking')
  // Long enough to show an item wrapping inside its chip.
  await addToList(page, 'Likes', 'Live jazz in tiny basement bars on rainy weeknights')
  await addToList(page, 'Dislikes', 'Cilantro, Early mornings')
  await goToTab(page, 'Friends')
  // The last toast has an Undo action, so it stays up for 8 seconds.
  await expect(page.getByRole('status')).toBeEmpty({ timeout: 12_000 })
}

async function captureAll(page: Page, prefix: string) {
  await page.screenshot({ path: `${DIR}/${prefix}-02-friends.png` })

  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button').first().click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-03-log-sheet.png` })
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(sheet).toBeHidden()

  await page.getByRole('link', { name: /Alex Rivera/ }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-04-friend.png` })
  await page.screenshot({ path: `${DIR}/${prefix}-05-friend-full.png`, fullPage: true })

  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-12-meetup.png`, fullPage: true })

  await page.getByRole('region', { name: 'Photos' }).getByRole('button').first().click()
  await expect(page.getByRole('dialog', { name: 'Photo 1 of 3' })).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-13-viewer.png` })
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const editSheet = page.getByRole('dialog', { name: 'Edit meetup' })
  await editSheet.getByRole('region', { name: 'Photos' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-14-meetup-sheet.png` })
  await editSheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(editSheet).toBeHidden()

  await goToTab(page, 'Stats')
  await page.screenshot({ path: `${DIR}/${prefix}-06-stats.png`, fullPage: true })

  await goToTab(page, 'Settings')
  await page.screenshot({ path: `${DIR}/${prefix}-07-settings.png` })
}

/** Settings with birthday reminders just turned on, as in the Home Screen app (push is faked). */
async function captureReminders(page: Page, prefix: string, largeText = false) {
  await stubPush(page)
  await page.route('**/__reminders', (route) => route.fulfill({ status: 204 }))
  await page.goto('/#/settings')
  if (largeText) await page.addStyleTag({ content: LARGE_TEXT })
  await page.getByRole('switch', { name: 'Birthday reminders' }).click()
  await expect(page.getByRole('status')).toContainText('Birthday reminders are on')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-11-reminders-on.png` })
}

async function captureLock(page: Page, prefix: string, largeText = false, faceId = false) {
  await page.goto('/')
  // The Face ID button shows whenever a passkey id is stored, so seeding one is enough.
  await seedAppLock(page, '135790', faceId ? 'AAAAAAAAAAAAAAAAAAAAAA' : null)
  await reopenAfterAWhile(page)
  if (largeText) await page.addStyleTag({ content: LARGE_TEXT })
  await expect(lockHeading(page)).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-08-lock.png` })
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme })

    test('empty state', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
      await page.screenshot({ path: `${DIR}/${scheme}-01-empty.png` })
    })

    test('all screens', async ({ page }) => {
      test.setTimeout(120_000)
      await seed(page)
      await captureAll(page, scheme)
    })

    test('lock screen', async ({ page }) => {
      await captureLock(page, scheme)
    })

    test('reminders on', async ({ page }) => {
      await captureReminders(page, scheme)
    })
  })
}

test('large text', async ({ page }) => {
  test.setTimeout(120_000)
  await seed(page)
  await page.addStyleTag({ content: LARGE_TEXT })
  await captureAll(page, 'large-text')
})

test('large text reminders on', async ({ page }) => {
  await captureReminders(page, 'large-text', true)
})

test('large text lock screen', async ({ page }) => {
  await captureLock(page, 'large-text', true)
})

test('large text lock screen with Face ID', async ({ page }) => {
  await captureLock(page, 'large-text-face-id', true, true)
})

/** Settings with the lock on, then one lock sheet open, at the given text size. */
async function captureLockSheet(page: Page, prefix: string, sheetOpener: string, dialog: string, largeText = false) {
  await stubFaceId(page, true)
  await page.goto('/#/settings')
  await seedAppLock(page, '135790', 'AAAAAAAAAAAAAAAAAAAAAA')
  await page.reload()
  if (largeText) await page.addStyleTag({ content: LARGE_TEXT })
  await page.getByRole('heading', { level: 2, name: 'App lock' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${DIR}/${prefix}-09-app-lock-on.png` })
  await page.getByRole(sheetOpener === 'Face ID' ? 'switch' : 'button', { name: sheetOpener }).click()
  await expect(page.getByRole('dialog', { name: dialog })).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-10-lock-sheet.png` })
}

test('lock sheet', async ({ page }) => {
  await captureLockSheet(page, 'light', 'Turn off app lock', 'Turn off app lock')
})

test('large text lock sheet', async ({ page }) => {
  await captureLockSheet(page, 'large-text', 'Turn off app lock', 'Turn off app lock', true)
})
