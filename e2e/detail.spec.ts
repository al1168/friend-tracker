import { expect, test } from '@playwright/test'
import { addFriend, LARGE_TEXT, logMeetup, tinyPhoto } from './helpers.ts'

test('shows a friend’s stats and history', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await addFriend(page, 'Sam')
  await logMeetup(page, ['Alex', 'Sam'], { type: 'Meal', note: 'Tacos' })
  await page.getByRole('link', { name: /Alex/ }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
  await expect(page.getByText(/^Last seen .* · Today$/)).toBeVisible()
  const thisYear = page.locator('.stat-row__item').first()
  await expect(thisYear).toHaveText(/This year\s*1$/)
  const history = page.getByRole('region', { name: 'History' })
  await expect(history.getByRole('link', { name: /Meal.*with Sam.*Tacos/ })).toBeVisible()
})

test('history rows show activities and the first photo', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await addFriend(page, 'Sam')
  await logMeetup(page, ['Alex', 'Sam'], {
    type: 'Meal',
    activities: ['Karaoke', 'Walk'],
    note: 'Tacos',
    photos: [tinyPhoto('one.png'), tinyPhoto('two.png')],
  })
  await logMeetup(page, ['Alex'])
  await page.getByRole('link', { name: /Alex/ }).click()

  const history = page.getByRole('region', { name: 'History' })
  const meal = history.getByRole('link', { name: /Meal.*with Sam · Karaoke, Walk · Tacos/ })
  await expect(meal).toBeVisible()
  await expect(meal.locator('img.history-thumb')).toHaveAttribute('src', /^data:image\/jpeg/)
  await expect(history.getByRole('link', { name: /Coffee/ }).locator('img')).toHaveCount(0)
})

test('logs from the friend page with them preselected', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('link', { name: /Alex/ }).click()
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await expect(sheet.getByRole('button', { name: 'Remove Alex' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ })).toBeVisible()
})

test('the meetup just logged scrolls clear of its toast and opens with one tap', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('link', { name: /Alex/ }).click()
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  const toast = page.getByRole('status')
  await expect(toast).toContainText('Logged with Alex')

  // Scrolled to the end of the page, the last row is all above the toast.
  const row = page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ })
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const rowBox = await row.boundingBox()
  const toastBox = await toast.boundingBox()
  if (!rowBox || !toastBox) throw new Error('The row or the toast is not on screen')
  expect(rowBox.y + rowBox.height, 'The row ends above the toast').toBeLessThanOrEqual(toastBox.y)

  // So a tap opens it right away, with no waiting for the toast to go: a click held up by the toast times out.
  await expect(toast).toBeVisible()
  await row.click({ timeout: 2000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  await expect(toast).toContainText('Logged with Alex')
})

test('at large text, the meetup just logged scrolls clear of a toast that wraps, and opens with one tap', async ({
  page,
}) => {
  await page.goto('/')
  await page.addStyleTag({ content: LARGE_TEXT })
  const name = 'Bartholomew Fitzgerald-Montgomery'
  await addFriend(page, name)
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  const toast = page.getByRole('status')
  await expect(toast).toContainText(`Logged with ${name}`)
  const toastHeight = await toast.locator('.toast').evaluate((element) => element.getBoundingClientRect().height)
  // About 159px here: the name wraps the message onto several lines, three times the one-line 52px.
  expect(toastHeight, 'The toast wraps onto several lines').toBeGreaterThan(100)

  const row = page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ })
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const rowBox = await row.boundingBox()
  const toastBox = await toast.boundingBox()
  if (!rowBox || !toastBox) throw new Error('The row or the toast is not on screen')
  expect(rowBox.y + rowBox.height, 'The row ends above the toast').toBeLessThanOrEqual(toastBox.y)

  await expect(toast).toBeVisible()
  await row.click({ timeout: 2000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  await expect(toast).toContainText(`Logged with ${name}`)
})

test('at large text, the room for a toast that wrapped stays after it goes, until the next page', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.addStyleTag({ content: LARGE_TEXT })
  const name = 'Bartholomew Fitzgerald-Montgomery'
  await addFriend(page, name)
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  const toast = page.getByRole('status')
  await expect(toast).toContainText(`Logged with ${name}`)
  const toastSpace = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--toast-space'))
  const pageEnd = () => page.evaluate(() => document.documentElement.scrollHeight)
  await expect.poll(async () => parseFloat(await toastSpace()), 'Room for the wrapped toast').toBeGreaterThan(100)
  const space = await toastSpace()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const end = await pageEnd()
  const scrolled = await page.evaluate(() => window.scrollY)

  // The toast goes after 8 seconds; the end of the page stays where it was.
  await page.clock.fastForward(9000)
  await expect(toast).toBeEmpty()
  expect(await toastSpace(), 'The room stays').toBe(space)
  expect(await pageEnd(), 'The end of the page does not move').toBe(end)
  expect(await page.evaluate(() => window.scrollY), 'Nothing scrolls').toBe(scrolled)

  // The next page starts with no room kept for a toast that has gone.
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  expect(await toastSpace()).toBe('0px')
})

test('edits a meetup from its page, then deletes it with undo', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await page.getByRole('link', { name: /Alex/ }).click()
  const history = page.getByRole('region', { name: 'History' })

  await history.getByRole('link', { name: /Coffee/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const editSheet = page.getByRole('dialog', { name: 'Edit meetup' })
  await editSheet.getByRole('button', { name: 'Drinks', exact: true }).click()
  await editSheet.getByRole('button', { name: 'Save' }).click()
  await expect(editSheet).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Drinks' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('dialog', { name: 'Edit meetup' }).getByRole('button', { name: 'Delete meetup' }).click()
  // The meetup is gone, so its page goes back to the friend.
  await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
  await expect(page.getByText('Your first meetup will show up here.')).toBeVisible()
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(history.getByRole('link', { name: /Drinks/ })).toBeVisible()
})

test('edits and deletes a friend', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('link', { name: /Alex/ }).click()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await sheet.getByLabel('Name', { exact: true }).fill('Alexandra')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Alexandra' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('dialog', { name: 'Edit friend' }).getByRole('button', { name: 'Delete friend' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete friend' }).click()
  await expect(page.getByText('Add the people you want to keep up with.')).toBeVisible()
})

test('shows a future meetup as upcoming without counting it', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { date: '2099-01-01' })
  await page.getByRole('link', { name: /Alex/ }).click()

  await expect(page.getByText('Not seen yet')).toBeVisible()
  await expect(page.locator('.stat-row__item').first()).toHaveText(/This year\s*0$/)
  await expect(page.getByRole('region', { name: 'History' })).toContainText('Upcoming')
})

test('redirects to Friends for an unknown friend', async ({ page }) => {
  await page.goto('/#/friends/nope')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})
