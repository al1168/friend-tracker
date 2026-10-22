import { expect, test, type Locator, type Page } from '@playwright/test'
import { friendLink, friendRow, LARGE_TEXT, meetupRow, photoRow, seedMeetups } from './helpers.ts'

/** The iPhone's second accessibility text size: 33px body text. */
const AX_TEXT = 'html { font: 33px/1.35 -apple-system, system-ui, sans-serif !important; }'
/** The third: 40px. */
const AX3_TEXT = 'html { font: 40px/1.35 -apple-system, system-ui, sans-serif !important; }'
const LONG_NAME = 'Maximiliana Alexandra Featherstonehaugh-Worthington'

/** On Thu, Oct 22, 2026: Mariya, Jessie and Brandon Cao at a Meal with a photo, and a Coffee with a long name. */
async function openWithFriends(page: Page, extra: string[] = []) {
  await page.clock.setFixedTime(new Date(2026, 9, 22, 12))
  await page.goto('/')
  await seedMeetups(page, {
    friends: [
      friendRow('mariya', 'Mariya'),
      friendRow('jessie', 'Jessie'),
      friendRow('brandon', 'Brandon Cao'),
      friendRow('maxi', LONG_NAME),
      ...extra.map((name) => friendRow(name.toLowerCase(), name)),
    ],
    meetups: [
      meetupRow('meal', '2026-10-03', ['mariya', 'jessie', 'brandon'], {
        typeId: 'type-meal',
        activities: ['Movie', 'Shopping'],
        note: '@nonstopstyle\n@strand bookstore',
      }),
      meetupRow('coffee', '2026-10-01', ['maxi']),
    ],
    photos: [photoRow('meal-photo', 'meal')],
  })
}

/** Waits for a pushed page to finish sliding in, so what's measured is where it rests. */
async function slidIn(page: Page) {
  await page
    .locator('.page')
    .evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)))
}

/**
 * The words of an element's text that a line break splits though they'd fit on a line of their own (a word's text
 * spread over more than one line box, while the word alone is no wider than the element). A word wider than the line
 * may break: that's the fallback. With `strict`, every split word counts, so a test can say the words have room.
 * Words are split on spaces; a hyphen is a fair place to break, so a hyphenated word counts as its parts.
 */
function splitWords(locator: Locator, { strict = false } = {}): Promise<string[]> {
  return locator.evaluate((element, strict) => {
    const split: string[] = []
    const context = document.createElement('canvas').getContext('2d')
    if (!context) throw new Error('No canvas')
    const style = getComputedStyle(element)
    context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
    const width = element.getBoundingClientRect().width
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? ''
      for (const match of text.matchAll(/[^\s-]+/g)) {
        const range = document.createRange()
        range.setStart(node, match.index)
        range.setEnd(node, match.index + match[0].length)
        const tops = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)))
        if (tops.size > 1 && (strict || context.measureText(match[0]).width <= width)) split.push(match[0])
      }
    }
    return split
  }, strict)
}

test('at an accessibility size a meetup row’s photo sits under its text, and no word is split', async ({ page }) => {
  await openWithFriends(page)
  await page.addStyleTag({ content: AX_TEXT })
  await page.getByRole('link', { name: 'See all meetups' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meetups' })).toBeVisible()
  const row = page.getByRole('link', { name: /Meal/ })
  await expect(row.locator('.row__title')).toHaveText('Mariya, Jessie and Brandon')
  await expect(row.locator('img.history-thumb')).toHaveCount(1)

  const [thumb, subtitle, box] = await Promise.all([
    row.locator('.meetup-thumb').boundingBox(),
    row.locator('.row__subtitle').boundingBox(),
    row.boundingBox(),
  ])
  if (!thumb || !subtitle || !box) throw new Error('The row is not on screen')
  expect(thumb.y, 'The photo is under the subtitle').toBeGreaterThanOrEqual(subtitle.y + subtitle.height)
  expect(Math.abs(thumb.x - subtitle.x), 'on the text’s left edge').toBeLessThanOrEqual(1)
  expect(thumb.y + thumb.height, 'inside the row').toBeLessThanOrEqual(box.y + box.height)
  expect(await splitWords(row.locator('.row__title')), 'The title breaks between words').toEqual([])
  expect(await splitWords(row.locator('.row__subtitle')), 'So does the subtitle').toEqual([])

  // A row without a photo keeps its one-row layout.
  const coffee = page.getByRole('link', { name: /Coffee/ })
  expect(await coffee.evaluate((element) => getComputedStyle(element).display)).toBe('flex')
})

test('at a larger accessibility size the side margins hold, so a meetup row’s names stay whole', async ({ page }) => {
  await openWithFriends(page)
  await page.addStyleTag({ content: AX3_TEXT })
  await page.getByRole('link', { name: 'See all meetups' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meetups' })).toBeVisible()
  await slidIn(page)
  const row = page.getByRole('link', { name: /Meal/ })
  const title = row.locator('.row__title')
  await expect(title).toHaveText('Mariya, Jessie and Brandon')
  // Each word has room: none breaks, not even as the fallback for a word wider than the line.
  expect(await splitWords(title, { strict: true }), '"Mariya," and the rest are whole').toEqual([])

  // The page's margin and the row's padding are 20px and its gap 12px, as iOS keeps them, not 40px and 30px.
  const [group, titleBox] = await Promise.all([
    row.locator('xpath=ancestor::div[contains(@class, "inset-group__body")]').boundingBox(),
    title.boundingBox(),
  ])
  if (!group || !titleBox) throw new Error('The row is not on screen')
  expect(group.x, 'The page’s margin').toBeCloseTo(20, 0)
  expect(titleBox.x - group.x, 'The badge 20px in, 44px wide, then a 12px gap').toBeCloseTo(20 + 44 + 12, 0)
})

test('at a larger accessibility size chip rows still reach the screen’s edges, and nothing scrolls sideways', async ({
  page,
}) => {
  await page.goto('/')
  await seedMeetups(page, {
    friends: [friendRow('mariya', 'Mariya', { groupId: 'climbing' }), friendRow('jessie', 'Jessie')],
    groups: [{ id: 'climbing', name: 'Climbing' }],
  })
  await page.addStyleTag({ content: AX3_TEXT })
  const viewport = page.viewportSize()
  if (!viewport) throw new Error('No viewport')
  const filters = await page.getByRole('group', { name: 'Filter by group' }).boundingBox()
  if (!filters) throw new Error('The group chips are not on screen')
  expect(filters.x, 'The chip row starts at the screen’s edge').toBeCloseTo(0, 0)
  expect(filters.x + filters.width, 'and ends at the other').toBeCloseTo(viewport.width, 0)
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(sideways, 'The page doesn’t scroll sideways').toBeLessThanOrEqual(0)

  // In the Log sheet too: the What chips reach the sheet's edges, and its body doesn't scroll sideways.
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  const body = sheet.locator('.sheet__body')
  const [types, bodyBox] = await Promise.all([sheet.getByRole('group', { name: 'What' }).boundingBox(), body.boundingBox()])
  if (!types || !bodyBox) throw new Error('The sheet is not on screen')
  expect(types.x, 'The What chips start at the sheet’s edge').toBeCloseTo(bodyBox.x, 0)
  expect(types.x + types.width, 'and end at the other').toBeCloseTo(bodyBox.x + bodyBox.width, 0)
  expect(await body.evaluate((element) => element.scrollWidth <= element.clientWidth), 'Nothing to swipe').toBe(true)
})

test('at the largest standard size a meetup row keeps its photo beside the text', async ({ page }) => {
  await openWithFriends(page)
  await page.addStyleTag({ content: LARGE_TEXT })
  await page.getByRole('link', { name: 'See all meetups' }).click()
  const row = page.getByRole('link', { name: /Meal/ })
  await expect(row.locator('img.history-thumb')).toHaveCount(1)
  expect(await row.evaluate((element) => getComputedStyle(element).display)).toBe('flex')
})

for (const [size, style] of [
  ['the largest standard size', LARGE_TEXT],
  ['an accessibility size', AX_TEXT],
] as const) {
  test(`at ${size} the back label shows "Friends" whole while the large title shows`, async ({ page }) => {
    await openWithFriends(page)
    await page.addStyleTag({ content: style })
    await friendLink(page, LONG_NAME).click()
    await expect(page.getByRole('heading', { level: 1, name: LONG_NAME })).toBeVisible()
    const label = page.locator('header.navbar .navbar__back-label')
    await expect(label).toHaveText('Friends')
    const fits = await label.evaluate((element) => element.scrollWidth <= element.clientWidth)
    expect(fits, 'Not cut short').toBe(true)
  })
}

test('at an accessibility size Who tiles fit a first name: two across, each name whole', async ({ page }) => {
  await openWithFriends(page)
  await page.addStyleTag({ content: AX_TEXT })
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  const tiles = sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button')
  await expect(tiles).toHaveCount(4)
  const [first, second, third] = await Promise.all([0, 1, 2].map((i) => tiles.nth(i).boundingBox()))
  if (!first || !second || !third) throw new Error('The tiles are not on screen')
  expect(Math.abs(second.y - first.y), 'Two across').toBeLessThanOrEqual(1)
  expect(third.y, 'the third on the next row').toBeGreaterThan(first.y + first.height - 1)
  for (const name of ['Mariya', 'Jessie']) {
    const tile = tiles.filter({ hasText: name }).locator('.friend-tile__name')
    expect(await splitWords(tile), `${name} is whole`).toEqual([])
  }
})

test('at an accessibility size the swiping Who strip has wider columns, each name whole', async ({ page }) => {
  // Ten friends: more than 8, so Who swipes.
  await openWithFriends(page, ['Daniel', 'Olivia', 'Kenji', 'Priya', 'Tom', 'Alex'])
  await page.addStyleTag({ content: AX_TEXT })
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  const strip = sheet.getByRole('group', { name: 'Friends', exact: true })
  await expect(strip).toHaveAttribute('data-swipes', 'true')
  const width = await strip.getByRole('button').first().evaluate((element) => element.getBoundingClientRect().width)
  expect(width, 'At least 4.25rem').toBeGreaterThanOrEqual(4.25 * 33 - 1)
  for (const name of ['Mariya', 'Jessie', 'Daniel', 'Olivia']) {
    const tile = strip.getByRole('button').filter({ hasText: name }).locator('.friend-tile__name')
    expect(await splitWords(tile), `${name} is whole`).toEqual([])
  }
})
