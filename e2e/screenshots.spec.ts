import { expect, test, type Page } from '@playwright/test'
import { OWNER_DAY_TYPED, OWNER_FEELINGS } from '../src/test/dayFixtures.ts'
import {
  addFriend,
  addToList,
  dayFromToday,
  drawnPhoto,
  friendLink,
  goToTab,
  LARGE_TEXT,
  lockHeading,
  logMeetup,
  reopenAfterAWhile,
  seedAppLock,
  setBirthday,
  sheetSave,
  stubFaceId,
  stubPush,
} from './helpers.ts'
import { closeKeyboard, fakeVisualViewport, openKeyboard } from './keyboard.ts'

const DIR = 'e2e/screenshots'

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

async function seed(page: Page) {
  // The day page's Place and Who paid rows are captured over the fake keyboard.
  await fakeVisualViewport(page)
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
  // The owner's example day is written with these three.
  for (const name of ['Mariya', 'Jessie', 'Brandon']) await addFriend(page, name)
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
  // The Meetups page opens with "Upcoming". Stats and the friend pages captured don't change: future meetups
  // aren't counted.
  await logMeetup(page, ['Maya Patel'], { type: 'Party', date: daysAgo(-2) })
  await friendLink(page, 'Alex Rivera').click()
  // Alex's birthday is further off, so the friend page shows it but Birthdays soon doesn't
  // (and Alex keeps a single link on the Friends tab).
  const inForty = dayFromToday(40)
  await page.getByRole('region', { name: 'Birthday', exact: true }).getByRole('button', { name: 'Add birthday' }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await setBirthday(sheet, { ...inForty, year: inForty.year - 32 })
  await sheetSave(sheet).click()
  await expect(sheet).toBeHidden()
  await addToList(page, 'Likes', 'Ramen, Board games, Hiking')
  // Long enough to show an item wrapping inside its chip.
  await addToList(page, 'Likes', 'Live jazz in tiny basement bars on rainy weeknights')
  await addToList(page, 'Dislikes', 'Cilantro, Early mornings')
  await goToTab(page, 'Friends')
  // The last toast has an Undo action, so it stays up for 8 seconds.
  await expect(page.getByRole('status')).toBeEmpty({ timeout: 12_000 })
}

/**
 * A full-page capture of the day page: it's a fixed layer that scrolls inside, so for the capture it becomes a
 * plain block as tall as its content.
 */
async function captureFullDay(page: Page, path: string) {
  const style = await page.addStyleTag({
    content: `.day-page { position: absolute; top: 0; bottom: auto; height: auto; }
      .day-page__body { overflow: visible; }
      .scroll-locked, .scroll-locked body { overflow: visible !important; }`,
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path, fullPage: true })
  await style.evaluate((element) => element.parentNode?.removeChild(element))
}

/**
 * A full-page capture of a list, to see where everything lands. The tab bar and the "+ Log meetup" pill are fixed,
 * so they'd be painted where they sit on screen, over the middle of the image: they're hidden for the capture.
 */
async function captureFullList(page: Page, path: string) {
  const style = await page.addStyleTag({ content: '.tabbar, .log-button { visibility: hidden !important; }' })
  await page.screenshot({ path, fullPage: true })
  await style.evaluate((element) => element.parentNode?.removeChild(element))
}

/** On the day page: writes the owner's example (as typed in the app), with the weather, the face and the words. */
async function writeOwnersDay(page: Page) {
  await page.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Rainy' }).click()
  await page.getByRole('textbox', { name: 'The day' }).fill(OWNER_DAY_TYPED)
  await page.getByRole('group', { name: 'Mood' }).getByRole('button', { name: 'Okay' }).click()
  await page.getByRole('textbox', { name: 'How it felt, in your words' }).fill(OWNER_FEELINGS)
}

async function captureAll(page: Page, prefix: string) {
  await page.screenshot({ path: `${DIR}/${prefix}-02-friends.png` })
  // Where the search field, the chips and the friend list land below Birthdays soon and Recent meetups.
  await captureFullList(page, `${DIR}/${prefix}-02-friends-full.png`)

  // The New friend sheet, with Save at the top right.
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const friendSheet = page.getByRole('dialog', { name: 'New friend' })
  await expect(friendSheet).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-23-friend-sheet.png` })
  await friendSheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(friendSheet).toBeHidden()

  // The Log sheet: the friend search over the keyboard, then Save at the top right over every friend's tile, then The
  // day with a place line tinted, then the end of the sheet, then the day page written through it.
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  const body = sheet.locator('.sheet__body')
  const search = sheet.getByLabel('Search all friends')
  const pickFromSearch = async (name: string) => {
    await search.fill(name)
    await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name, exact: true }).click()
  }
  await search.focus()
  await openKeyboard(page)
  // Mariya picked from the search: her chip sits just above the field, over the results for the next name.
  await pickFromSearch('Mariya')
  await search.fill('a')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-22-log-search.png` })
  await search.fill('')
  await closeKeyboard(page)
  for (const name of ['Jessie', 'Brandon']) await pickFromSearch(name)
  await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
  await search.blur()
  await body.evaluate((element) => {
    element.scrollTop = 0
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-03-log-sheet.png` })
  const sheetDay = sheet.getByRole('textbox', { name: 'The day' })
  await sheetDay.fill('@Blue willow 3:30\nKung pao chicken, garlic string beans and jasmine dragon pearl tea\nJessie paid')
  await sheetDay.blur()
  await sheetDay.evaluate((element) => element.scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-21-log-day.png` })
  // The day page opens empty for the captures that follow.
  await sheetDay.fill('')
  await sheetDay.blur()
  // The end of the sheet: Activities, Photos and "Save and write about the day".
  await body.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-24-log-end.png` })
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-15-day-empty.png` })

  await writeOwnersDay(page)
  await expect(page.getByRole('status')).toBeEmpty({ timeout: 12_000 })
  await captureFullDay(page, `${DIR}/${prefix}-16-day-written.png`)

  const day = page.getByRole('textbox', { name: 'The day' })
  await day.focus()
  await day.press('End')
  await openKeyboard(page)
  const helpers = page.getByRole('group', { name: 'Writing helpers' })
  await helpers.getByRole('button', { name: 'Place', exact: true }).click()
  await helpers.getByRole('textbox', { name: 'Place and time' }).fill('Blue willow 3:30')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-17-day-place.png` })
  await helpers.getByRole('button', { name: 'Close' }).click()
  await helpers.getByRole('button', { name: 'Paid' }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-18-day-paid.png` })
  await helpers.getByRole('button', { name: 'Close' }).click()
  await helpers.getByRole('button', { name: 'Hide keyboard' }).click()
  await closeKeyboard(page)

  // The Meetup page holding the owner's example.
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-12-meetup.png`, fullPage: true })
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()

  // The Meetups page, with the owner's example among the months, then searched.
  await page.getByRole('link', { name: 'See all meetups' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meetups' })).toBeVisible()
  await page.waitForTimeout(500)
  await captureFullList(page, `${DIR}/${prefix}-19-meetups.png`)
  await page.getByRole('searchbox', { name: 'Search meetups' }).fill('ramen')
  await expect(page.locator('.inset-group .row__title')).toHaveText(['Meal'])
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-20-meetups-search.png` })
  await page.locator('header.navbar .navbar__back').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()

  await friendLink(page, 'Alex Rivera').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-04-friend.png` })
  await page.screenshot({ path: `${DIR}/${prefix}-05-friend-full.png`, fullPage: true })

  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
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

test('accessibility text size day page and memory', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  for (const name of ['Mariya', 'Jessie', 'Brandon']) await addFriend(page, name)
  await page.addStyleTag({ content: 'html { font: 33px/1.35 -apple-system, system-ui, sans-serif !important; }' })
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  for (const name of ['Mariya', 'Jessie', 'Brandon']) {
    await sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name }).click()
  }
  await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
  await writeOwnersDay(page)
  await expect(page.getByRole('status')).toBeEmpty({ timeout: 12_000 })
  // The faces two by two.
  await captureFullDay(page, `${DIR}/ax-16-day-written.png`)
  // The timeline's times above the places.
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/ax-12-meetup.png`, fullPage: true })
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
