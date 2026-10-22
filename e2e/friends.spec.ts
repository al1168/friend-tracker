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
    note: 'Sang until the place closed, then walked the long way home along the river',
  })
  await seedMeetups(page, { friends, groups, meetups: [latest, meetupRow('older', '2026-10-01', ['kim'])] })
  await page.getByRole('complementary', { name: 'Install the app' }).getByRole('button', { name: 'Dismiss' }).click()

  const search = await spanOf(page.locator('.friends-filters .search'))
  expect(search.top, 'Search sits just under the large title').toBeLessThanOrEqual(110)
  const birthdays = page.getByRole('region', { name: 'Birthdays soon' })
  await expect(birthdays.getByRole('link')).toHaveCount(3)
  const recent = page.getByRole('region', { name: 'Recent meetups' })
  await expect(recent.locator('.row__title')).toHaveText(['Alex, Aisha and 2 others'])
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

test('under the chips the groups sit 24px apart, Birthdays soon 8px under its title with two whole tiles and a peek', async ({
  page,
}) => {
  // Wed, Oct 21, 2026, noon: four birthdays soon, with names short enough that three tiles would just fit.
  await page.clock.setFixedTime(new Date(2026, 9, 21, 12))
  await page.goto('/')
  const friends = [
    friendRow('al', 'Al', { groupId: 'work', birthday: { month: 10, day: 21, year: null } }),
    friendRow('bo', 'Bo', { birthday: { month: 10, day: 22, year: null } }),
    friendRow('cy', 'Cy', { birthday: { month: 10, day: 24, year: null } }),
    friendRow('di', 'Di', { birthday: { month: 10, day: 25, year: null } }),
  ]
  await seedMeetups(page, {
    friends,
    groups: [{ id: 'work', name: 'Work' }],
    meetups: [meetupRow('coffee', '2026-10-19', ['bo'])],
  })
  await page.getByRole('complementary', { name: 'Install the app' }).getByRole('button', { name: 'Dismiss' }).click()
  const chips = page.getByRole('group', { name: 'Filter by group' })
  const birthdays = page.getByRole('region', { name: 'Birthdays soon' })
  const recent = page.getByRole('region', { name: 'Recent meetups' })
  await expect(birthdays.getByRole('link')).toHaveCount(4)
  const near = (value: number, expected: number) => Math.abs(value - expected) <= 1

  const title = await spanOf(birthdays.getByRole('heading'))
  const tile = await spanOf(birthdays.getByRole('link').first())
  expect(near(title.top - (await spanOf(chips)).bottom, 24), 'Birthdays soon 24px under the chips').toBe(true)
  expect(near(tile.top - title.bottom, 8), 'Its title 8px above the tiles').toBe(true)
  expect(near((await spanOf(recent)).top - tile.bottom, 24), 'Recent meetups 24px under the tiles').toBe(true)

  // Two whole tiles, then a peek of the third, plainly cut off: there's more to swipe to.
  const width = page.viewportSize()?.width ?? 0
  const edges = await birthdays.getByRole('link').evaluateAll((links) =>
    links.map((link) => {
      const box = link.getBoundingClientRect()
      return { left: box.left, right: box.right }
    }),
  )
  expect(edges[1].right, 'The second tile shows whole').toBeLessThanOrEqual(width)
  const peek = width - edges[2].left
  expect(peek, 'The third tile peeks in').toBeGreaterThanOrEqual(40)
  expect(peek / (edges[2].right - edges[2].left), 'Less than two thirds of it shows').toBeLessThan(2 / 3)

  // With no birthday soon, Recent meetups sits 24px under the chips, and See all's hit area stays clear of them.
  await page.clock.setFixedTime(new Date(2026, 11, 1, 12))
  await page.reload()
  await expect(birthdays).toHaveCount(0)
  const chipsBottom = (await spanOf(chips)).bottom
  expect(near((await spanOf(recent)).top - chipsBottom, 24), 'Recent meetups 24px under the chips').toBe(true)
  const hitTop = await recent.getByRole('link', { name: 'See all meetups' }).evaluate((link) => {
    const area = getComputedStyle(link, '::before')
    return link.getBoundingClientRect().bottom - parseFloat(area.bottom) - parseFloat(area.height)
  })
  expect(hitTop, 'See all reaches up no further than the chips').toBeGreaterThanOrEqual(chipsBottom)

  // The friend list alone, right under the chips, sits closer: 16px.
  await chips.getByRole('button', { name: 'Work' }).click()
  await expect(recent).toHaveCount(0)
  const list = page.locator('.inset-group').last()
  expect(near((await spanOf(list)).top - (await spanOf(chips)).bottom, 16), 'The list 16px under the chips').toBe(true)
})

test('a friend never seen has no "this year" count; one seen has it', async ({ page }) => {
  await page.goto('/')
  await seedMeetups(page, {
    friends: [friendRow('alex', 'Alex'), friendRow('sam', 'Sam')],
    meetups: [meetupRow('coffee', '2026-01-05', ['alex'])],
  })
  const alex = page.locator('a.row[href="#/friends/alex"]')
  const sam = page.locator('a.row[href="#/friends/sam"]')
  await expect(alex.locator('.friend-count')).toHaveText(/this year/)
  await expect(sam).toContainText('Not seen yet')
  await expect(sam.locator('.friend-count')).toHaveCount(0)
})

test('filtering by a group leaves its name out of each row', async ({ page }) => {
  await page.goto('/')
  const groups = [
    { id: 'climbing', name: 'Climbing' },
    { id: 'work', name: 'Work' },
  ]
  await seedMeetups(page, {
    friends: [friendRow('kenji', 'Kenji', { groupId: 'climbing' }), friendRow('kim', 'Kim', { groupId: 'work' })],
    groups,
  })
  const kenji = page.locator('a.row[href="#/friends/kenji"] .row__subtitle')
  await expect(kenji).toHaveText('Climbing · Not seen yet')
  const chips = page.getByRole('group', { name: 'Filter by group' })
  await chips.getByRole('button', { name: 'Climbing' }).click()
  await expect(kenji).toHaveText('Not seen yet')
  await chips.getByRole('button', { name: 'All' }).click()
  await expect(kenji).toHaveText('Climbing · Not seen yet')
})

test('there is no Sort button until there is a friend', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Add the people you want to keep up with.')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Sort/ })).toHaveCount(0)
  await addFriend(page, 'Alex')
  await expect(page.getByRole('button', { name: /^Sort/ })).toBeVisible()
})

test.describe('in dark mode', () => {
  test.use({ colorScheme: 'dark' })

  test('the toast is a raised dark surface with light words, not a bright pill', async ({ page }) => {
    await page.goto('/')
    await addFriend(page, 'Alex')
    const toast = page.locator('.toast')
    await expect(toast).toContainText('Added Alex')
    // Each color as the screen draws it (any CSS color, oklch included), then its relative luminance.
    const luminance = (property: 'background-color' | 'color') =>
      toast.evaluate((element, property) => {
        const canvas = document.createElement('canvas')
        canvas.width = canvas.height = 1
        const context = canvas.getContext('2d')
        if (!context) throw new Error('No canvas')
        context.fillStyle = getComputedStyle(element).getPropertyValue(property)
        context.fillRect(0, 0, 1, 1)
        const [r, g, b] = [...context.getImageData(0, 0, 1, 1).data].map((value) => {
          const channel = value / 255
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
      }, property)
    const background = await luminance('background-color')
    const text = await luminance('color')
    expect(background, 'A dark surface').toBeLessThan(0.15)
    expect((text + 0.05) / (background + 0.05), 'AA contrast').toBeGreaterThanOrEqual(4.5)
  })
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
