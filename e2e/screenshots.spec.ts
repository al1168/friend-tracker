import { expect, test, type Page } from '@playwright/test'
import { addFriend, goToTab, lockHeading, logMeetup, reopenAfterAWhile, seedAppLock, stubFaceId } from './helpers.ts'

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
  await addFriend(page, 'Alex Rivera', 'College')
  await addFriend(page, 'Sam Chen', 'College')
  await addFriend(page, 'Kim Park', 'Work')
  await addFriend(page, 'Jordan Lee', 'Work')
  await addFriend(page, 'Maya Patel')
  await addFriend(page, 'Theo Brooks', 'Family')
  await logMeetup(page, ['Alex Rivera', 'Sam Chen'], { type: 'Meal', note: 'Ramen night', date: daysAgo(3) })
  await logMeetup(page, ['Kim Park'], { type: 'Coffee', date: daysAgo(20) })
  await logMeetup(page, ['Alex Rivera'], { type: 'Drinks', date: daysAgo(45) })
  await logMeetup(page, ['Theo Brooks'], { type: 'Call', date: daysAgo(120) })
  await logMeetup(page, ['Alex Rivera', 'Kim Park', 'Jordan Lee'], { type: 'Party', date: daysAgo(300) })
  await logMeetup(page, ['Sam Chen'], { type: 'Trip', date: daysAgo(400) })
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

  await goToTab(page, 'Stats')
  await page.screenshot({ path: `${DIR}/${prefix}-06-stats.png`, fullPage: true })

  await goToTab(page, 'Settings')
  await page.screenshot({ path: `${DIR}/${prefix}-07-settings.png` })
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
  })
}

test('large text', async ({ page }) => {
  test.setTimeout(120_000)
  await seed(page)
  await page.addStyleTag({ content: LARGE_TEXT })
  await captureAll(page, 'large-text')
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
