import { expect, test, type Page } from '@playwright/test'
import {
  addFriend,
  enterPin,
  lockHeading,
  logMeetup,
  openDay,
  openFriendPage,
  readMeetups,
  reopenAfterAWhile,
  seedAppLock,
} from './helpers.ts'

// Most tests add three friends and log a meetup first, so they get more time than most.
test.describe.configure({ timeout: 60_000 })

// The owner wrote their day on Saturday, Oct 3, 2026, at about 9:52 PM, walking home.
test.use({ timezoneId: 'America/Los_Angeles' })
const SATURDAY_NIGHT = new Date('2026-10-03T21:52:00-07:00')
const FRIENDS = ['Mariya', 'Jessie', 'Brandon']

/** Adds Mariya, Jessie and Brandon and logs a Meal with them (today, unless `date` says otherwise). */
async function logMeal(page: Page, options: { date?: string } = {}) {
  for (const name of FRIENDS) await addFriend(page, name)
  await logMeetup(page, FRIENDS, { type: 'Meal', ...options })
}

/** Opens the Meal's day page from Mariya's history. */
async function openMealDay(page: Page) {
  await openFriendPage(page, 'Mariya')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await openDay(page)
}

function dayBox(page: Page) {
  return page.getByRole('textbox', { name: 'The day' })
}

function helpers(page: Page) {
  return page.getByRole('group', { name: 'Writing helpers' })
}

/** What the day page last announced to VoiceOver. */
function announcement(page: Page) {
  return page.locator('.day-page > [aria-live="polite"]')
}

/** Plays the app going to the background: the document turns hidden. */
async function hideApp(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

test('the quick log is unchanged: no Note, and Save stays put while "Save and write about the day" waits for a friend', async ({
  page,
}) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await expect(sheet.getByLabel('Note')).toHaveCount(0)
  const write = sheet.getByRole('button', { name: 'Save and write about the day' })
  const save = sheet.locator('.sheet__footer .button--block')
  await expect(write).toBeDisabled()
  await expect(save).toHaveText('Pick a friend')
  // Measure once the sheet has finished rising.
  await sheet.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)))
  const before = await save.boundingBox()

  await sheet.getByLabel('Search all friends').fill('Alex')
  await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Alex', exact: true }).click()

  await expect(write).toBeEnabled()
  await expect(save).toHaveText('Save')
  expect(await save.boundingBox(), 'Save did not move').toEqual(before)
  await save.click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('Logged with Alex')
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Write about the day/ })).toBeVisible()
})

test('"Save and write about the day" logs the meetup and opens its day; Back lands on the new memory', async ({
  page,
}) => {
  await page.goto('/')
  await addFriend(page, 'Mariya')
  await openFriendPage(page, 'Mariya')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()

  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('Logged with Mariya')
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeFocused()
  // The toast sits 8px above the helper bar.
  const toast = await page.locator('.toast').boundingBox()
  const bar = await page.locator('.day-page__footer').boundingBox()
  if (!toast || !bar) throw new Error('The toast or the helper bar is not on screen')
  expect(Math.abs(toast.y + toast.height - (bar.y - 8)), 'Within a pixel').toBeLessThanOrEqual(1)
  await dayBox(page).fill('Tacos')
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  expect((await readMeetups(page))[0].note).toBe('Tacos')
  // Opened from Mariya's page, the memory says her name on its back button.
  await page.getByRole('button', { name: 'Mariya' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mariya' })).toBeVisible()
})

test('Undo on the "Logged" toast takes the day with it, back to Friends', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByLabel('Search all friends').fill('Alex')
  await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Alex', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
  await dayBox(page).fill('A line I meant to keep')

  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  await expect.poll(async () => (await readMeetups(page)).length).toBe(0)
})

test('opens on its title, with the meetup on Back and who was there', async ({ page }) => {
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)

  await expect(page).toHaveTitle('The day · Friend Tracker')
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeFocused()
  await expect(page.getByText('Sat, Oct 3 · with Mariya, Jessie and Brandon', { exact: true })).toBeVisible()
  for (const name of ['Weather', 'The day', 'How it felt']) {
    await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible()
  }
  await expect(dayBox(page)).toHaveAccessibleDescription(
    'Start a line with @ for each place, with a time if you like. Lines under a place go with it.',
  )
  await expect(page.getByRole('textbox', { name: 'How it felt, in your words' })).toBeVisible()
  await expect(page.getByText('Saves as you type, and stays on this iPhone.')).toBeVisible()

  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
})

test('saves the weather and the face on the tap', async ({ page }) => {
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  const weather = page.getByRole('group', { name: 'Weather' })
  await expect(weather.getByRole('button')).toHaveText([
    /Sunny$/,
    /Cloudy$/,
    /Rainy$/,
    /Stormy$/,
    /Snowy$/,
    /Windy$/,
    /Hot$/,
    /Cold$/,
  ])
  await weather.getByRole('button', { name: 'Windy' }).click()
  await weather.getByRole('button', { name: 'Rainy' }).click()
  await expect(weather.getByRole('button', { name: 'Rainy' })).toHaveAttribute('aria-pressed', 'true')
  const mood = page.getByRole('group', { name: 'Mood' })
  await expect(mood.getByRole('button')).toHaveText([/Heavy$/, /Okay$/, /Good$/, /Great$/])
  await expect(mood.getByRole('button', { pressed: true })).toHaveCount(0)
  await mood.getByRole('button', { name: 'Okay' }).click()
  await expect(mood.getByRole('button', { name: 'Okay' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await readMeetups(page))[0]).toMatchObject({ weather: ['rainy', 'windy'], mood: 'okay' })

  // Tapping the picked face again clears it.
  await mood.getByRole('button', { name: 'Okay' }).click()
  await expect(mood.getByRole('button', { name: 'Okay' })).toHaveAttribute('aria-pressed', 'false')
  await weather.getByRole('button', { name: 'Windy' }).click()
  await expect.poll(async () => (await readMeetups(page))[0]).toMatchObject({ weather: ['rainy'], mood: null })
})

test('saves what you type after a pause, and at once when the app goes to the background', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  await dayBox(page).fill('Ramen night')
  await page.waitForTimeout(1000)
  await page.reload()
  await expect(dayBox(page)).toHaveValue('Ramen night')

  // With the clock stopped, the pause never ends: only going to the background can save this.
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 1000))
  await dayBox(page).fill('Ramen night, then karaoke')
  await hideApp(page)
  await expect.poll(async () => (await readMeetups(page))[0].note).toBe('Ramen night, then karaoke')
  await page.clock.resume()
  await page.reload()
  await expect(dayBox(page)).toHaveValue('Ramen night, then karaoke')
})

test('comes back with your words after the app lock', async ({ page }) => {
  await page.goto('/')
  await seedAppLock(page, '135790')
  await logMeal(page)
  await openMealDay(page)
  await dayBox(page).fill('@Blue willow 3:30\nJessie paid')
  await expect.poll(async () => (await readMeetups(page))[0].note).toBe('@Blue willow 3:30\nJessie paid')

  await reopenAfterAWhile(page)
  await expect(lockHeading(page)).toBeVisible()
  await enterPin(page, '135790')
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
  await expect(dayBox(page)).toHaveValue('@Blue willow 3:30\nJessie paid')
})

test('"@ Place" adds a place line where the caret is, and Close goes back to The day', async ({ page }) => {
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  const place = helpers(page).getByRole('textbox', { name: 'Place and time' })

  await helpers(page).getByRole('button', { name: 'Add a place' }).click()
  await expect(place).toBeFocused()
  await expect(place).toHaveAttribute('autocorrect', 'off')
  await place.fill('@Blue willow 3:30')
  await place.press('Enter')
  await expect(dayBox(page)).toBeFocused()
  await expect(dayBox(page)).toHaveValue('@Blue willow 3:30\n')
  await expect(announcement(page)).toHaveText('Added Blue willow, 3:30 PM.')
  await page.keyboard.type('Walked to mariya')
  await expect(dayBox(page)).toHaveValue('@Blue willow 3:30\nWalked to mariya')

  await helpers(page).getByRole('button', { name: 'Add a place' }).click()
  await place.fill('Somewhere')
  await helpers(page).getByRole('button', { name: 'Close' }).click()
  await expect(dayBox(page)).toBeFocused()
  await expect(place).toHaveCount(0)
  await expect(dayBox(page)).toHaveValue('@Blue willow 3:30\nWalked to mariya')

  await helpers(page).getByRole('button', { name: 'Add a place' }).click()
  await expect(place).toHaveValue('')
  await place.fill('hey tea')
  await helpers(page).getByRole('button', { name: 'Add the time, 9:52 PM' }).click()
  await expect(place).toHaveValue('hey tea 9:52 PM')
  await helpers(page).getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dayBox(page)).toHaveValue('@Blue willow 3:30\nWalked to mariya\n@hey tea 9:52 PM\n')
  await expect(announcement(page)).toHaveText('Added hey tea, 9:52 PM.')
})

test('a place still in the Place field joins the day when you go back', async ({ page }) => {
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  await dayBox(page).fill('Rainy')
  await helpers(page).getByRole('button', { name: 'Add a place' }).click()
  await helpers(page).getByRole('textbox', { name: 'Place and time' }).fill('Blue willow 3:30')

  await page.getByRole('button', { name: 'Meal' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  expect((await readMeetups(page))[0].note).toBe('Rainy\n@Blue willow 3:30\n')
})

test('"Now" writes the time on today’s meetup, and "Paid" writes who paid', async ({ page }) => {
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)

  await dayBox(page).fill('Left at')
  await helpers(page).getByRole('button', { name: 'Add the time, 9:52 PM' }).click()
  await expect(dayBox(page)).toHaveValue('Left at 9:52 PM')
  await expect(announcement(page)).toHaveText('Added 9:52 PM.')

  await helpers(page).getByRole('button', { name: 'Paid' }).click()
  await expect(announcement(page)).toHaveText('Pick who paid.')
  const whoPaid = helpers(page).getByRole('group', { name: 'Who paid?' })
  const names = ['I paid', 'Mariya', 'Jessie', 'Brandon', 'We split it', 'Close']
  await expect(whoPaid.getByRole('button')).toHaveCount(names.length)
  for (const [index, name] of names.entries()) {
    await expect(whoPaid.getByRole('button').nth(index)).toHaveAccessibleName(name)
  }
  await expect(whoPaid.getByRole('button')).toHaveText(['Me', /Mariya$/, /Jessie$/, /Brandon$/, 'Split', ''])
  await whoPaid.getByRole('button', { name: 'Jessie' }).click()
  await expect(dayBox(page)).toHaveValue('Left at 9:52 PM\nJessie paid')
  await expect(announcement(page)).toHaveText('Added Jessie paid.')
  await expect(whoPaid).toHaveCount(0)
  await expect.poll(async () => (await readMeetups(page))[0].note).toBe('Left at 9:52 PM\nJessie paid')
})

test('a day that is not today has no "Now", and an upcoming one has no How it felt', async ({ page }) => {
  await page.goto('/')
  await logMeal(page, { date: '2099-01-01' })
  await openMealDay(page)
  await expect(helpers(page).getByRole('button', { name: 'Add a place' })).toBeVisible()
  await expect(helpers(page).getByRole('button', { name: /Add the time/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'How it felt' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Mood' })).toHaveCount(0)
})

test('says when The day is full', async ({ page }) => {
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  await dayBox(page).fill('x'.repeat(9_999))
  await expect(page.getByRole('alert')).toHaveCount(0)
  await dayBox(page).press('End')
  await page.keyboard.type('yz')
  await expect(dayBox(page)).toHaveValue(`${'x'.repeat(9_999)}y`)
  await expect(page.getByRole('alert')).toHaveText('This box is full.')
})

test('an old note is already the day: shown under The day, previewed in history, and in the box', async ({ page }) => {
  await page.goto('/#/settings')
  const backup = {
    app: 'friend-tracker',
    version: 4,
    exportedAt: '2026-09-13T12:00:00.000Z',
    groups: [],
    meetupTypes: [{ id: 'type-meal', name: 'Meal', emoji: '🍽️', order: 0 }],
    friends: [
      {
        id: 'f-sam',
        name: 'Sam',
        groupId: null,
        photo: null,
        notes: '',
        likes: [],
        dislikes: [],
        birthday: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    meetups: [
      {
        id: 'm-old',
        date: '2026-09-12',
        typeId: 'type-meal',
        friendIds: ['f-sam'],
        note: 'Tacos\nThen karaoke',
        activities: ['Karaoke'],
        createdAt: '2026-09-12T12:00:00.000Z',
      },
    ],
    meetupPhotos: [],
  }
  await page.locator('input[type="file"]').setInputFiles({
    name: 'friend-tracker-backup-2026-09-13.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  })
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')

  await openFriendPage(page, 'Sam')
  const row = page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ })
  await expect(row).toHaveAccessibleName(/ · Karaoke · Tacos$/)
  await row.click()
  const day = page.getByRole('region', { name: 'The day' })
  await expect(day.locator('.day-line')).toHaveText(['Tacos', 'Then karaoke'])
  await openDay(page)
  await expect(dayBox(page)).toHaveValue('Tacos\nThen karaoke')
  expect((await readMeetups(page))[0]).toMatchObject({ note: 'Tacos\nThen karaoke', activities: ['Karaoke'], weather: [] })
})

test('opened directly, Back goes to its meetup; an unknown one goes to Friends', async ({ page }) => {
  await page.goto('/')
  await logMeal(page)
  const [{ id }] = await readMeetups(page)
  await page.goto('about:blank')
  await page.goto(`/#/meetups/${id}/day`)
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()

  await page.goto('about:blank')
  await page.goto('/#/meetups/nope/day')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})
