import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { OWNER_DAY_TYPED, OWNER_FEELINGS, OWNER_MESSAGE } from '../src/test/dayFixtures.ts'
import {
  addFriend,
  editMeetup,
  enterPin,
  goToTab,
  lockHeading,
  logMeetup,
  openDay,
  openFriendPage,
  pickActivity,
  readMeetups,
  reopenAfterAWhile,
  seedAppLock,
  sheetSave,
  tinyPhoto,
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

test('the quick log: Save at the top right and "Save and write about the day" at the end both wait for a friend', async ({
  page,
}) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  const write = sheet.getByRole('button', { name: 'Save and write about the day' })
  const save = sheetSave(sheet)
  await expect(write).toBeDisabled()
  await expect(save).toBeDisabled()
  // A full-width button at the end of the sheet's body, not a footer.
  await expect(sheet.locator('.sheet__body > :last-child')).toHaveText('Save and write about the day')
  await expect(sheet.locator('.sheet__footer')).toHaveCount(0)

  await sheet.getByLabel('Search all friends').fill('Alex')
  await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Alex', exact: true }).click()

  await expect(write).toBeEnabled()
  await expect(save).toBeEnabled()
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
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeFocused()
  // The day page shows no toast: nothing covers the box you're about to write in. It says so in its own note, above
  // the context line, and VoiceOver hears it once.
  await expect(page.locator('.toast')).toHaveCount(0)
  const note = page.locator('.day-logged')
  await expect(note).toContainText('Logged with Mariya')
  await expect(note.getByRole('button', { name: 'Undo' })).toBeVisible()
  await expect(page.locator('.day-page__body > :first-child')).toHaveClass('day-logged')
  await expect(announcement(page)).toHaveText('Logged with Mariya.')
  await dayBox(page).fill('Tacos')
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  expect((await readMeetups(page))[0].note).toBe('Tacos')
  // Opened from Mariya's page, the memory says her name on its back button.
  await page.getByRole('button', { name: 'Mariya' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mariya' })).toBeVisible()
})

/** Adds Alex and logs a Coffee with "Save and write about the day", which opens its day page. */
async function logAndWrite(page: Page) {
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByLabel('Search all friends').fill('Alex')
  await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Alex', exact: true }).click()
  await sheet.getByRole('button', { name: 'Coffee', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
  // Once the sheet has slid away, its own The day box with it.
  await expect(page.locator('.sheet-layer')).toHaveCount(0)
}

/** Where a box sits in the day page's body, wherever the body is scrolled. */
function topInBody(box: Locator) {
  return box.evaluate((element) => {
    const body = element.closest('.day-page__body')
    if (!body) throw new Error('Not in the day page')
    return element.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop
  })
}

test('Undo in the Logged note takes the meetup away before anything is written, back to Friends', async ({ page }) => {
  await page.goto('/')
  await logAndWrite(page)

  await page.locator('.day-logged').getByRole('button', { name: 'Undo' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  await expect.poll(async () => (await readMeetups(page)).length).toBe(0)
  await expect(page.getByRole('region', { name: 'Recent meetups' })).toHaveCount(0)
})

test('after the first change the Logged note has no Undo, and nothing below it moves', async ({ page }) => {
  await page.goto('/')
  await logAndWrite(page)
  const note = page.locator('.day-logged')
  const before = await topInBody(dayBox(page))

  await dayBox(page).focus()
  await page.keyboard.type('T')

  await expect(note).toContainText('Logged with Alex')
  await expect(note.getByRole('button', { name: 'Undo' })).toHaveCount(0)
  expect(Math.abs((await topInBody(dayBox(page))) - before), 'The day stays put').toBeLessThanOrEqual(1)
  await expect.poll(async () => (await readMeetups(page))[0]?.note).toBe('T')
})

test('a weather chip is a change too, and the note comes back after the app lock without its Undo', async ({ page }) => {
  await page.goto('/')
  await seedAppLock(page, '135790')
  await logAndWrite(page)
  const note = page.locator('.day-logged')
  await page.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Rainy' }).click()
  await expect(note.getByRole('button', { name: 'Undo' })).toHaveCount(0)
  await expect.poll(async () => (await readMeetups(page))[0]?.weather).toEqual(['rainy'])

  await reopenAfterAWhile(page)
  await expect(lockHeading(page)).toBeVisible()
  await enterPin(page, '135790')
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
  await expect(note).toContainText('Logged with Alex')
  await expect(note.getByRole('button', { name: 'Undo' })).toHaveCount(0)
})

test('a toast belongs to its page: following a link clears it', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await expect(page.getByRole('status')).toContainText('Logged with Alex')

  await page.getByRole('region', { name: 'Recent meetups' }).getByRole('link', { name: /^Coffee/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  await expect(page.locator('.toast')).toHaveCount(0)
})

test('going back keeps a toast: "Meetup deleted" shows on the page you land on, and Undo puts the row back', async ({
  page,
}) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  const recent = page.getByRole('region', { name: 'Recent meetups' })
  await recent.getByRole('link', { name: /^Coffee/ }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('dialog', { name: 'Edit meetup' }).getByRole('button', { name: 'Delete meetup' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  await expect(recent).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('Meetup deleted')
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(recent.getByRole('link', { name: /^Coffee/ })).toBeVisible()
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

test('words that couldn’t save before the app lock are still on the page after it, and save once they can', async ({
  page,
}) => {
  await page.goto('/')
  await seedAppLock(page, '135790')
  // The open page reads the lock setting at launch.
  await page.reload()
  await logMeal(page)
  await openMealDay(page)
  await dayBox(page).fill('Ramen night')
  await expect.poll(async () => (await readMeetups(page))[0].note).toBe('Ramen night')

  // The phone runs out of room: every write to meetups fails, until the test says otherwise (the lock's own
  // records still save, so the PIN works).
  await page.evaluate(() => {
    const state = window as unknown as { writesFail: boolean }
    state.writesFail = true
    const failing = <A extends unknown[], R>(write: (...args: A) => R, store: (target: never) => string) =>
      function (this: never, ...args: A): R {
        if (state.writesFail && store(this) === 'meetups') {
          throw new DOMException('The phone is full', 'QuotaExceededError')
        }
        return write.apply(this, args)
      }
    const ofStore = (target: IDBObjectStore) => target.name
    const ofCursor = ({ source }: IDBCursor) => (source instanceof IDBIndex ? source.objectStore.name : source.name)
    IDBObjectStore.prototype.put = failing(IDBObjectStore.prototype.put, ofStore)
    IDBObjectStore.prototype.add = failing(IDBObjectStore.prototype.add, ofStore)
    IDBCursor.prototype.update = failing(IDBCursor.prototype.update, ofCursor)
  })
  await dayBox(page).fill('Ramen night, then karaoke')
  await expect(page.getByText("Couldn't save just now", { exact: false })).toBeVisible()

  // 16 minutes away, then back: the app locks in place (no reload), and the day page unmounts with it.
  await page.evaluate(() => {
    localStorage.setItem('ft:lastActiveAt', String(Date.now() - 16 * 60_000))
    window.dispatchEvent(new Event('focus'))
  })
  await expect(lockHeading(page)).toBeVisible()
  await enterPin(page, '135790')

  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
  await expect(dayBox(page)).toHaveValue('Ramen night, then karaoke')
  await page.evaluate(() => {
    ;(window as unknown as { writesFail: boolean }).writesFail = false
  })
  // The next try comes within 5 seconds.
  await expect
    .poll(async () => (await readMeetups(page))[0].note, { timeout: 10_000 })
    .toBe('Ramen night, then karaoke')
  await expect(page.getByText("Couldn't save just now", { exact: false })).toHaveCount(0)
})

test('"@ Place" adds a place line where the caret is, and Close goes back to The day', async ({ page }) => {
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  const place = helpers(page).getByRole('textbox', { name: 'Place and time' })

  await helpers(page).getByRole('button', { name: 'Place', exact: true }).click()
  await expect(place).toBeFocused()
  await expect(place).toHaveAttribute('autocorrect', 'off')
  await place.fill('@Blue willow 3:30')
  await place.press('Enter')
  await expect(dayBox(page)).toBeFocused()
  await expect(dayBox(page)).toHaveValue('@Blue willow 3:30\n')
  await expect(announcement(page)).toHaveText('Added Blue willow, 3:30 PM.')
  await page.keyboard.type('Walked to mariya')
  await expect(dayBox(page)).toHaveValue('@Blue willow 3:30\nWalked to mariya')

  await helpers(page).getByRole('button', { name: 'Place', exact: true }).click()
  await place.fill('Somewhere')
  await helpers(page).getByRole('button', { name: 'Close' }).click()
  await expect(dayBox(page)).toBeFocused()
  await expect(place).toHaveCount(0)
  await expect(dayBox(page)).toHaveValue('@Blue willow 3:30\nWalked to mariya')

  await helpers(page).getByRole('button', { name: 'Place', exact: true }).click()
  await expect(place).toHaveValue('')
  await place.fill('hey tea')
  await helpers(page).getByRole('button', { name: 'Now, 9:52 PM' }).click()
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
  await helpers(page).getByRole('button', { name: 'Place', exact: true }).click()
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
  await helpers(page).getByRole('button', { name: 'Now, 9:52 PM' }).click()
  await expect(dayBox(page)).toHaveValue('Left at 9:52 PM')
  await expect(announcement(page)).toHaveText('Added 9:52 PM.')

  await helpers(page).getByRole('button', { name: 'Paid' }).click()
  await expect(announcement(page)).toHaveText('Pick who paid.')
  const whoPaid = helpers(page).getByRole('group', { name: 'Who paid?' })
  const names = ['Me', 'Mariya', 'Jessie', 'Brandon', 'Split']
  await expect(whoPaid.getByRole('button')).toHaveCount(names.length)
  for (const [index, name] of names.entries()) {
    await expect(whoPaid.getByRole('button').nth(index)).toHaveAccessibleName(name)
  }
  await expect(whoPaid.getByRole('button')).toHaveText(['Me', /Mariya$/, /Jessie$/, /Brandon$/, 'Split'])
  // The owner's three friends all show at the standard text size, with Close, without scrolling sideways.
  for (const button of await whoPaid.getByRole('button').all()) await expect(button).toBeInViewport({ ratio: 1 })
  await expect(helpers(page).getByRole('button', { name: 'Close' })).toBeInViewport({ ratio: 1 })
  await whoPaid.getByRole('button', { name: 'Jessie' }).click()
  await expect(dayBox(page)).toHaveValue('Left at 9:52 PM\nJessie paid')
  await expect(announcement(page)).toHaveText('Added Jessie paid.')
  await expect(whoPaid).toHaveCount(0)
  await expect.poll(async () => (await readMeetups(page))[0].note).toBe('Left at 9:52 PM\nJessie paid')

  // Close keeps The day's focus when it had it; otherwise focus goes back to "Paid".
  await helpers(page).getByRole('button', { name: 'Paid' }).click()
  await helpers(page).getByRole('button', { name: 'Close' }).click()
  await expect(whoPaid).toHaveCount(0)
  await expect(dayBox(page)).toBeFocused()
  await dayBox(page).blur()
  await helpers(page).getByRole('button', { name: 'Paid' }).click()
  await helpers(page).getByRole('button', { name: 'Close' }).click()
  await expect(helpers(page).getByRole('button', { name: 'Paid' })).toBeFocused()
  await expect(dayBox(page)).toHaveValue('Left at 9:52 PM\nJessie paid')
})

test('every helper is named by the word it shows, for Voice Control', async ({ page }) => {
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  /** Checks each visible helper's name starts with the word it shows, and returns those words. */
  const startsWithItsWord = async () => {
    const words: string[] = []
    for (const button of await helpers(page).getByRole('button').all()) {
      if (!(await button.isVisible())) continue
      // The words on screen: not a visually hidden part, nor a decoration such as the "@" or an avatar's initial.
      const shown = await button.evaluate((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        let text = ''
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (!node.parentElement?.closest('.visually-hidden, [aria-hidden="true"]')) text += node.textContent
        }
        return text.trim()
      })
      if (shown === '') continue // An icon button: "Close" or "Hide keyboard".
      words.push(shown)
      await expect(button).toHaveAccessibleName(new RegExp(`^${shown}`))
    }
    return words
  }
  expect(await startsWithItsWord()).toEqual(['Place', 'Now', 'Paid'])
  await expect(helpers(page).getByRole('button', { name: 'Now, 9:52 PM' })).toBeVisible()
  await helpers(page).getByRole('button', { name: 'Place', exact: true }).click()
  // "Add" waits, dimmed, until there's a place to add, so nothing moves on the first letter.
  await expect(helpers(page).getByRole('button', { name: 'Add', exact: true })).toBeDisabled()
  expect(await startsWithItsWord()).toEqual(['Now', 'Add'])
  await helpers(page).getByRole('textbox', { name: 'Place and time' }).fill('Cafe')
  await expect(helpers(page).getByRole('button', { name: 'Add', exact: true })).toBeEnabled()
  await helpers(page).getByRole('button', { name: 'Close' }).click()
  await helpers(page).getByRole('button', { name: 'Paid' }).click()
  expect(await startsWithItsWord()).toEqual(['Me', 'Mariya', 'Jessie', 'Brandon', 'Split'])
})

/** Focuses The day and selects `from` to `to`, as a double-tap or a drag of the handles does. */
async function selectInDay(page: Page, from: number, to: number) {
  await dayBox(page).focus()
  await dayBox(page).evaluate((box: HTMLTextAreaElement, [from, to]) => box.setSelectionRange(from, to), [from, to])
}

test('a place or paid line never removes the words you have selected', async ({ page }) => {
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  const note = 'Took haircut with dyno\nRead book'
  const dyno = [note.indexOf('dyno'), note.indexOf('dyno') + 4] as const

  // "dyno" is selected: Paid, then Jessie.
  await dayBox(page).fill(note)
  await selectInDay(page, ...dyno)
  await helpers(page).getByRole('button', { name: 'Paid' }).click()
  await helpers(page).getByRole('group', { name: 'Who paid?' }).getByRole('button', { name: 'Jessie' }).click()
  await expect(dayBox(page)).toHaveValue('Took haircut with dyno\nJessie paid\nRead book')

  // Everything selected: "@ Place", a place, Return.
  await dayBox(page).fill(note)
  await selectInDay(page, 0, note.length)
  await helpers(page).getByRole('button', { name: 'Place', exact: true }).click()
  await helpers(page).getByRole('textbox', { name: 'Place and time' }).fill('Cafe')
  await helpers(page).getByRole('textbox', { name: 'Place and time' }).press('Enter')
  await expect(dayBox(page)).toHaveValue(`${note}\n@Cafe\n`)

  // "dyno" selected again, a place typed and left in the field, then Back: the place joins, and "dyno" stays.
  await dayBox(page).fill(note)
  await selectInDay(page, ...dyno)
  await helpers(page).getByRole('button', { name: 'Place', exact: true }).click()
  await helpers(page).getByRole('textbox', { name: 'Place and time' }).fill('Blue willow 3:30')
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  expect((await readMeetups(page))[0].note).toBe('Took haircut with dyno\n@Blue willow 3:30\nRead book')
})

test('"Now" types over a selection you can see, and goes after one you can’t', async ({ page }) => {
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  const now = helpers(page).getByRole('button', { name: 'Now, 9:52 PM' })

  // With The day focused, the selection shows, and "Now" replaces it as typing would.
  await dayBox(page).fill('Left at noon')
  await selectInDay(page, 8, 12)
  await now.click()
  await expect(dayBox(page)).toHaveValue('Left at 9:52 PM')

  // Once The day loses focus its selection no longer shows, so nothing in it is replaced.
  await dayBox(page).fill('Left at noon')
  await selectInDay(page, 8, 12)
  await dayBox(page).blur()
  await now.click()
  await expect(dayBox(page)).toHaveValue('Left at noon 9:52 PM')
})

test('a day that is not today has no "Now", and an upcoming one has no How it felt', async ({ page }) => {
  await page.goto('/')
  await logMeal(page, { date: '2099-01-01' })
  await openMealDay(page)
  await expect(helpers(page).getByRole('button', { name: 'Place', exact: true })).toBeVisible()
  await expect(helpers(page).getByRole('button', { name: /^Now/ })).toHaveCount(0)
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

test('a helper that would take a full day past its limit adds nothing, keeps what you typed and says so', async ({
  page,
}) => {
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  const full = 'x'.repeat(9_995)
  await dayBox(page).fill(full)
  await expect(page.getByRole('alert')).toHaveCount(0)

  // "Jessie paid" on its own line needs 12 more characters than the 5 left.
  await helpers(page).getByRole('button', { name: 'Paid' }).click()
  await helpers(page).getByRole('group', { name: 'Who paid?' }).getByRole('button', { name: 'Jessie' }).click()
  await expect(dayBox(page)).toHaveValue(full)
  await expect(page.getByRole('alert')).toHaveText('This box is full.')
  await helpers(page).getByRole('button', { name: 'Close' }).click()

  // The place stays in its field (the row stays open), and the refusal is said again.
  await helpers(page).getByRole('button', { name: 'Place', exact: true }).click()
  const place = helpers(page).getByRole('textbox', { name: 'Place and time' })
  await place.fill('Blue willow 3:30')
  await place.press('Enter')
  await expect(dayBox(page)).toHaveValue(full)
  await expect(place).toHaveValue('Blue willow 3:30')
  await expect(place).toBeFocused()
  await expect(announcement(page)).toHaveText('This box is full.')

  // With room made, it goes in.
  await dayBox(page).fill('x'.repeat(100))
  await expect(page.getByRole('alert')).toHaveCount(0)
  await helpers(page).getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dayBox(page)).toHaveValue(`${'x'.repeat(100)}\n@Blue willow 3:30\n`)
})

test('How it felt never holds more than it can save, even when the box lets an emoji past its limit', async ({
  page,
}) => {
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  const feelings = page.getByRole('textbox', { name: 'How it felt, in your words' })
  const words = 'a'.repeat(3_999)
  await feelings.fill(words)
  await expect.poll(async () => (await readMeetups(page))[0].feelings).toBe(words)

  // WebKit's maxLength counts an emoji as one character; saved, it's two UTF-16 units, so 4,001 here.
  await feelings.evaluate((box: HTMLTextAreaElement) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(box, `${box.value}😀`)
    box.dispatchEvent(new Event('input', { bubbles: true }))
  })

  await expect(feelings).toHaveValue(words)
  await expect(page.getByRole('alert')).toHaveText('This box is full.')
  // Saving carries on: a weather tap saves at once, and no save error shows.
  await page.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Rainy' }).click()
  await expect.poll(async () => (await readMeetups(page))[0].weather).toEqual(['rainy'])
  await expect(page.getByText("Couldn't save just now", { exact: false })).toHaveCount(0)
  expect((await readMeetups(page))[0].feelings).toBe(words)
})

test('two quick taps on Back go back one step, not two', async ({ page }) => {
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  await dayBox(page).fill('Tacos')

  // Count the steps back asked of the browser (WebKit may merge two asked in the same moment, a phone may not).
  await page.evaluate(() => {
    const go = history.go.bind(history)
    const counted = window as unknown as { stepsBack: number }
    counted.stepsBack = 0
    history.go = (delta?: number) => {
      counted.stepsBack += 1
      go(delta)
    }
  })

  // The second tap comes while the first is still saving "Tacos" on its way out.
  await page.getByRole('button', { name: 'Meal' }).evaluate((back: HTMLButtonElement) => {
    back.click()
    back.click()
  })

  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await page.waitForTimeout(500)
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  expect(await page.evaluate(() => (window as unknown as { stepsBack: number }).stepsBack)).toBe(1)
  expect((await readMeetups(page))[0].note).toBe('Tacos')
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

test('the owner’s example, written on the walk home, reads back as their day', async ({ page }) => {
  test.setTimeout(120_000)
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
  for (const name of FRIENDS) await addFriend(page, name)

  // 1. Friends tab, "+ Log meetup": Mariya, Jessie and Brandon under Recent, Meal, Today, Movie and Shopping.
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  const recent = sheet.getByRole('group', { name: 'Friends', exact: true })
  for (const name of FRIENDS) await recent.getByRole('button', { name }).click()
  await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
  await expect(sheet.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true')
  await pickActivity(sheet, 'Movie')
  await pickActivity(sheet, 'Shopping')

  // 2. "Save and write about the day": the day page slides in, saying so in its note, with no toast over it.
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
  await expect(page.locator('.day-logged')).toContainText('Logged with Mariya, Jessie and Brandon')
  await expect(page.locator('.toast')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Meal' })).toBeVisible()
  await expect(page.getByText('Sat, Oct 3 · with Mariya, Jessie and Brandon', { exact: true })).toBeVisible()

  // 3. "Rainy day".
  await page.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Rainy' }).click()

  // 4. "Locations:" and the story, one place at a time.
  const place = async (text: string) => {
    await helpers(page).getByRole('button', { name: 'Place', exact: true }).click()
    await helpers(page).getByRole('textbox', { name: 'Place and time' }).fill(text)
    await helpers(page).getByRole('textbox', { name: 'Place and time' }).press('Enter')
    await expect(dayBox(page)).toBeFocused()
  }
  const type = (text: string) => page.keyboard.insertText(text)
  const paid = async (name: string) => {
    await helpers(page).getByRole('button', { name: 'Paid' }).click()
    await helpers(page).getByRole('group', { name: 'Who paid?' }).getByRole('button', { name }).click()
  }
  await place('nonstopstyle 10:30')
  await type('Took haircut with dyno')
  await place('strand bookstore 11:30')
  await place('Sammy L coffee 11:53')
  await type('Read book and vibe code until 2:50')
  await place('Blue willow 3:30')
  await type('Walked to mariya at blue willow. Then Jessie came, then Brandon (late) due to construction')
  await page.keyboard.press('Enter')
  await type('Ordered Kong pao chicken (salty) garlic string beans, szcheuan beef and jasmine dragon pearl tea.')
  await paid('Jessie')
  await expect(dayBox(page)).toHaveValue(/\nJessie paid$/)
  await place('hey tea Broadway')
  await type('Walked to hey tea (got the king jasmine honeydew)')
  await place('amc 34 5:30')
  await type('Walked to amc and watch prime time(didn’t like it)')
  await place('holister + @h&m 7:30 - ~8:10')
  await type('Stalled time for dinner at holister and H&M')
  await place('seoulSaloon 8:30')
  for (const line of [
    'Then walked to dinner @seoulsaloon',
    'Ate rose tteboki, fried chicken(chicken nuggets?), octopus kimbap',
    'Talked about relationship + movie',
    'Jessie Brandon age gap like 3 years',
  ]) {
    await type(line)
    await page.keyboard.press('Enter')
  }
  await type('Mariya like 3 years older 1/2 younger')
  await paid('Mariya')
  await page.keyboard.press('Enter')
  await type('Split ways went home')
  await expect(dayBox(page)).toHaveValue(OWNER_DAY_TYPED)

  // 5. "How I felt:": the face, then the words.
  await page.getByRole('group', { name: 'Mood' }).getByRole('button', { name: 'Okay' }).click()
  await page.getByRole('textbox', { name: 'How it felt, in your words' }).fill(OWNER_FEELINGS)

  // 6. "‹ Meal": everything was saved along the way, and the memory shows.
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()

  const [stored] = await readMeetups(page)
  expect(Object.keys(stored).sort()).toEqual([
    'activities',
    'createdAt',
    'date',
    'feelings',
    'friendIds',
    'id',
    'mood',
    'note',
    'typeId',
    'weather',
  ])
  expect(stored).toMatchObject({
    date: '2026-10-03',
    typeId: 'type-meal',
    note: OWNER_DAY_TYPED,
    activities: ['Movie', 'Shopping'],
    weather: ['rainy'],
    mood: 'okay',
    feelings: OWNER_FEELINGS,
  })
  expect(stored.friendIds).toHaveLength(3)

  await expect(page.getByText('Sat, Oct 3 · 🌧️ Rainy', { exact: true })).toBeVisible()
  const places = page.getByRole('list', { name: 'Places, 8 stops' })
  await expect(places.getByRole('heading', { level: 3 })).toHaveText([
    'nonstopstyle',
    'strand bookstore',
    'Sammy L coffee',
    'Blue willow',
    'hey tea Broadway',
    'amc 34',
    'holister + h&m',
    'seoulSaloon',
  ])
  await expect(places.locator('.day-stop__time')).toHaveText([
    '10:30 AM',
    '11:30 AM',
    '11:53 AM',
    '3:30 PM',
    '',
    '5:30 PM',
    '7:30 PM to ~8:10 PM',
    '8:30 PM',
  ])
  await expect(places.getByRole('listitem').nth(6).getByText(/^From 7:30.PM to about 8:10.PM\.$/)).toBeAttached()
  await expect(places.getByRole('listitem').nth(3).locator('.paid-tag')).toHaveText(/Jessie paid$/)
  await expect(places.getByRole('listitem').nth(7).locator('.paid-tag')).toHaveText(/Mariya paid$/)
  await expect(places.locator('.paid-tag')).toHaveCount(2)
  await expect(places.getByRole('listitem').nth(7).locator('.day-line').last()).toHaveText('Split ways went home')
  const felt = page.getByRole('region', { name: 'How it felt' })
  await expect(felt.getByText('Mood: Okay')).toBeVisible()
  await expect(felt).toContainText(OWNER_FEELINGS)
  await expect(page.getByRole('link', { name: 'Edit the day' })).toBeVisible()

  // In Mariya's history: the date, the others, the activities and the first places. No mood, no weather.
  await page.getByRole('button', { name: 'Back' }).click()
  await openFriendPage(page, 'Mariya')
  const row = page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ })
  await expect(row.locator('.row__subtitle')).toHaveText(
    'Sat, Oct 3 · with Jessie and Brandon · Movie, Shopping · nonstopstyle, strand bookstore, Sammy L coffee and 5 more',
  )
  await expect(row).not.toContainText('Okay')
  await expect(row).not.toContainText('Rainy')
})

test('the owner’s message, pasted, is kept exactly and reads back with its headings', async ({ page }) => {
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  await dayBox(page).fill(OWNER_MESSAGE)
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()

  expect((await readMeetups(page))[0].note).toBe(OWNER_MESSAGE)
  const day = page.getByRole('region', { name: 'The day' })
  await expect(day.getByRole('heading', { level: 3 })).toHaveText([
    'Locations',
    'nonstopstyle',
    'strand bookstore',
    'Sammy L coffee',
    'Blue willow',
    'hey tea Broadway',
    'amc 34',
    'holister + h&m',
    'seoulSaloon',
    'How I felt',
  ])
  const places = day.getByRole('list', { name: 'Places, 8 stops' })
  await expect(places.locator('.day-stop__time')).toHaveText([
    '10:30 AM',
    '11:30 AM',
    '11:53 AM',
    '3:30 PM',
    '',
    '5:30 PM',
    '7:30 PM to ~8:10 PM',
    '8:30 PM',
  ])
  const prose = day.locator('.day-prose')
  await expect(prose).toHaveCount(3)
  await expect(prose.nth(0)).toHaveText('Rainy day')
  await expect(prose.nth(1).locator('.day-line')).toHaveCount(15)
  await expect(prose.nth(1).locator('.paid-tag')).toHaveText([/Jessie paid$/, /Mariya paid$/])
  await expect(prose.nth(1).locator('.day-line').last()).toHaveText('Split ways went home')
  await expect(prose.nth(2)).toHaveText(OWNER_FEELINGS)
})

test('a backup keeps the day, its activities and its photos', async ({ page }) => {
  // Force the download path; the share sheet can't be driven in tests.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await page.goto('/')
  await addFriend(page, 'Mariya')
  await logMeetup(page, ['Mariya'], { type: 'Meal', activities: ['Movie'], photos: [tinyPhoto('one.png')] })
  await openFriendPage(page, 'Mariya')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await openDay(page)
  await page.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Rainy' }).click()
  await page.getByRole('group', { name: 'Mood' }).getByRole('button', { name: 'Okay' }).click()
  await dayBox(page).fill(OWNER_DAY_TYPED)
  await page.getByRole('textbox', { name: 'How it felt, in your words' }).fill(OWNER_FEELINGS)
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()

  await goToTab(page, 'Settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.version).toBe(5)
  expect(backup.meetups[0]).toMatchObject({
    note: OWNER_DAY_TYPED,
    activities: ['Movie'],
    weather: ['rainy'],
    mood: 'okay',
    feelings: OWNER_FEELINGS,
  })
  expect(backup.meetupPhotos).toHaveLength(1)

  await openFriendPage(page, 'Mariya')
  const sheet = await editMeetup(page, /Meal/)
  await sheet.getByRole('button', { name: 'Delete meetup' }).click()
  await goToTab(page, 'Settings')
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')

  await openFriendPage(page, 'Mariya')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await expect(page.getByRole('list', { name: 'Places, 8 stops' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Activities' }).getByRole('listitem')).toHaveText(['Movie'])
  await expect(page.getByRole('region', { name: 'Photos' }).getByRole('img')).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'How it felt' }).getByText('Mood: Okay')).toBeVisible()
})
