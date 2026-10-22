import { expect, test, type Locator } from '@playwright/test'
import { addFriend, friendRow, meetupRow, ONE_PIXEL_PNG, seedMeetups, sheetSave } from './helpers.ts'

/** The top and bottom of an element on screen, in CSS pixels. */
async function spanOf(locator: Locator): Promise<{ top: number; bottom: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Not on screen')
  return { top: box.y, bottom: box.y + box.height }
}

test('shows a welcome state with no friends', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Add the people you want to keep up with.')).toBeVisible()
})

test('friends come first: search, the chips, Birthdays soon and the latest meetup, then the list', async ({ page }) => {
  // Wed, Oct 21, 2026, noon: three birthdays in the next two weeks.
  await page.clock.setFixedTime(new Date(2026, 9, 21, 12))
  await page.goto('/')
  const groups = ['Climbing', 'College', 'Family', 'Work'].map((name) => ({ id: name.toLowerCase(), name }))
  const friends = [
    friendRow('alex', 'Alex Rivera', { groupId: 'college' }),
    friendRow('aisha', 'Aisha Rahman', { groupId: 'work' }),
    friendRow('maxi', 'Maximiliana Alexandra', { groupId: 'family' }),
    friendRow('jordan', 'Jordan Lee', { groupId: 'climbing' }),
    friendRow('kim', 'Kim Park', { groupId: 'work' }),
    friendRow('brandon', 'Brandon Cao', { birthday: { month: 10, day: 23, year: 1999 } }),
    friendRow('sam', 'Sam Chen', { groupId: 'college', birthday: { month: 10, day: 30, year: null } }),
    friendRow('len', 'Len Foster', { birthday: { month: 11, day: 3, year: null } }),
  ]
  // A latest meetup whose subtitle runs to two lines.
  const latest = meetupRow('karaoke', '2026-10-19', ['alex', 'aisha', 'maxi', 'jordan'], {
    activities: ['Karaoke', 'Board games'],
  })
  await seedMeetups(page, { friends, groups, meetups: [latest, meetupRow('older', '2026-10-01', ['kim'])] })
  await page.getByRole('complementary', { name: 'Install the app' }).getByRole('button', { name: 'Dismiss' }).click()

  const search = await spanOf(page.locator('.friends-filters .search'))
  expect(search.top, 'Search sits just under the large title').toBeLessThanOrEqual(110)
  const birthdays = page.getByRole('region', { name: 'Birthdays soon' })
  await expect(birthdays.getByRole('link')).toHaveCount(3)
  const recent = page.getByRole('region', { name: 'Recent meetups' })
  await expect(recent.locator('.row__title')).toHaveText(['Coffee'])
  const list = page.locator('.inset-group').last().getByRole('link')
  await expect(list).toHaveCount(8)

  // Top to bottom: the search field, the chips, Birthdays soon, Recent meetups, then the friends.
  const tops = [
    search.top,
    (await spanOf(page.getByRole('group', { name: 'Filter by group' }))).top,
    (await spanOf(birthdays)).top,
    (await spanOf(recent)).top,
    (await spanOf(list.first())).top,
  ]
  expect([...tops].sort((a, b) => a - b), 'In that order').toEqual(tops)
  expect(tops[4], 'The first friend row is on the first screen').toBeLessThanOrEqual(480)
  // 645px is where the Home Screen app's Log pill starts, in these coordinates (713px less 16 and 52).
  const third = await spanOf(list.nth(2).locator('.row__title'))
  expect(third.bottom, 'The third friend’s name shows clear of the Log pill').toBeLessThanOrEqual(645)
})

test('adds friends and lists them', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex Smith')
  await addFriend(page, 'Sam')
  await expect(page.getByRole('status')).toContainText('Added Sam')
  await expect(page.getByRole('link', { name: /Alex Smith/ })).toContainText('Not seen yet')
  await expect(page.getByRole('link', { name: /Sam/ })).toBeVisible()
})

test('the friend sheet saves from the top right, with no footer', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await expect(sheet.locator('.sheet__header').getByRole('button')).toHaveText(['Cancel', 'Save'])
  await expect(sheet.locator('.sheet__footer')).toHaveCount(0)
  await sheet.getByLabel('Name', { exact: true }).fill('Kim')
  await sheetSave(sheet).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('Added Kim')
})

test('requires a name', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheetSave(sheet).click()
  await expect(sheet.getByText('Please enter a name.')).toBeVisible()
})

test('asks before discarding a half-filled friend', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheet.getByLabel('Name', { exact: true }).fill('Kim')
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('link', { name: /Kim/ })).toHaveCount(0)
})

test('filters by group and search', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex', 'College')
  await addFriend(page, 'Kim', 'Work')
  await addFriend(page, 'Sam', 'College')
  await expect(page.getByRole('link', { name: /Alex/ })).toContainText('College')

  const filters = page.getByRole('group', { name: 'Filter by group' })
  await filters.getByRole('button', { name: 'College' }).click()
  await expect(page.getByRole('link', { name: /Kim/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Sam/ })).toBeVisible()

  await filters.getByRole('button', { name: 'All' }).click()
  await page.getByLabel('Search friends').fill('ki')
  await expect(page.getByRole('link', { name: /Kim/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Alex/ })).toHaveCount(0)
})

test('adds a photo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheet.locator('input[type="file"]').setInputFiles({
    name: 'dot.png',
    mimeType: 'image/png',
    buffer: Buffer.from(ONE_PIXEL_PNG, 'base64'),
  })
  await expect(sheet.locator('img.avatar')).toBeVisible()
  await expect(sheet.locator('img.avatar')).toHaveAttribute('src', /^data:image\/jpeg/)
  await expect(sheet.getByRole('button', { name: 'Remove photo' })).toBeVisible()
})

test('install hint can be dismissed and stays dismissed', async ({ page }) => {
  await page.goto('/')
  const hint = page.getByRole('complementary', { name: 'Install the app' })
  await expect(hint).toBeVisible()
  await hint.getByRole('button', { name: 'Dismiss' }).click()
  await expect(hint).toBeHidden()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  await expect(hint).toBeHidden()
})

test('remembers the sort order', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Amy')
  await addFriend(page, 'Zoe')
  await page.getByRole('button', { name: /^Sort/ }).click()
  await page.getByRole('dialog', { name: 'Sort friends by' }).getByRole('button', { name: 'Name' }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Sort: Name' })).toBeVisible()
})

test('keeps a typed new group when saving', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheet.getByLabel('Name', { exact: true }).fill('Kim')
  await sheet.getByRole('button', { name: 'New group' }).click()
  await sheet.getByLabel('New group name').fill('Work')
  await sheetSave(sheet).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('link', { name: /Kim/ })).toContainText('Work')
})

test('empty name is announced', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheetSave(sheet).click()
  const input = sheet.getByLabel('Name', { exact: true })
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(input).toHaveAccessibleDescription(/Please enter a name/)
  await expect(input).toBeFocused()
})
