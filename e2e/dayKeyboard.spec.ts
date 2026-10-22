import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, logMeetup, openDay, openFriendPage } from './helpers.ts'
import { closeKeyboard, fakeVisualViewport, KEYBOARD, nextFrames, openKeyboard, rootProperty, tapFocus } from './keyboard.ts'

/** The room the app keeps between the caret's line and the edges of the day page's visible body. */
const MARGIN = 12

test.beforeEach(async ({ page }) => {
  await fakeVisualViewport(page)
  await page.goto('/')
})

/** Logs a coffee with Alex and opens its day page. */
async function openDayPage(page: Page) {
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()
  await openDay(page)
}

function dayBox(page: Page) {
  return page.getByRole('textbox', { name: 'The day' })
}

/** The visible part of the day page's body, its nav bar and its footer, in layout viewport pixels. */
async function layout(page: Page) {
  return page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('.day-page__body')
    const bar = document.querySelector('.day-page__bar')
    const footer = document.querySelector('.day-page__footer')
    if (!body || !bar || !footer) throw new Error('Not on the day page')
    const top = body.getBoundingClientRect().top + body.clientTop
    return {
      visibleTop: top,
      visibleBottom: top + body.clientHeight,
      barTop: bar.getBoundingClientRect().top,
      barBottom: bar.getBoundingClientRect().bottom,
      footerTop: footer.getBoundingClientRect().top,
      footerBottom: footer.getBoundingClientRect().bottom,
    }
  })
}

/** Where line `line` (1 for the first) of a box whose lines don't wrap is on screen. */
async function lineSpan(box: Locator, line: number) {
  return box.evaluate((element, line) => {
    const style = getComputedStyle(element)
    const height = parseFloat(style.lineHeight)
    const top = element.getBoundingClientRect().top + parseFloat(style.paddingTop) + (line - 1) * height
    return { top, bottom: top + height }
  }, line)
}

/** Where the last line of a box is on screen (the caret's line when the caret is at the end). */
async function lastLineSpan(box: Locator) {
  return box.evaluate((element) => {
    const style = getComputedStyle(element)
    const bottom = element.getBoundingClientRect().bottom - parseFloat(style.paddingBottom)
    return { top: bottom - parseFloat(style.lineHeight), bottom }
  })
}

/** A line is in the visible body and above the helper bar with `room` to spare. */
async function expectLineShown(page: Page, line: { top: number; bottom: number }, what: string, room = MARGIN) {
  const at = await layout(page)
  expect(line.top, `${what} is below the nav bar`).toBeGreaterThanOrEqual(at.visibleTop)
  expect(line.bottom, `${what} is above the helper bar with ${room}px to spare`).toBeLessThanOrEqual(at.footerTop - room)
}

test('the Log sheet closing under the day page leaves the keyboard to the day page', async ({ page }) => {
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByLabel('Search all friends').fill('Alex')
  await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Alex', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
  // The sheet is still sliding away (260ms) when the keyboard comes up on the day page.
  await expect(page.locator('.sheet-layer--closing')).toHaveCount(1)
  await openKeyboard(page)

  await page.waitForTimeout(400)

  await expect(page.locator('.sheet-layer')).toHaveCount(0)
  expect(await rootProperty(page, '--keyboard-inset')).toBe(`${KEYBOARD}px`)
  expect(await rootProperty(page, '--viewport-height')).not.toBe('')
  await expect(page.locator('html')).toHaveClass(/\bkeyboard-open\b/)
})

test('the page sits on the keyboard, with "Hide keyboard" on the helper bar', async ({ page }) => {
  await openDayPage(page)
  const hide = page.getByRole('button', { name: 'Hide keyboard' })
  await expect(hide).toBeHidden()
  await tapFocus(dayBox(page))

  const { height } = await openKeyboard(page)

  const at = await layout(page)
  expect(at.footerBottom, 'The helper bar sits right on the keyboard').toBeCloseTo(height, 0)
  expect(at.barTop, 'The nav bar is at the top').toBe(0)
  await expect(hide).toBeVisible()
  await hide.click()
  await expect(dayBox(page)).not.toBeFocused()
  await closeKeyboard(page)
  await expect(hide).toBeHidden()
})

test('with iOS panning the visual viewport, the nav bar and the focused box both show', async ({ page }) => {
  await openDayPage(page)
  await tapFocus(dayBox(page))

  const { height, offsetTop } = await openKeyboard(page, { offsetTop: 120 })

  // What you see of the page runs from offsetTop to offsetTop + height in layout viewport terms.
  const at = await layout(page)
  expect(at.barTop, 'The nav bar is on screen').toBeGreaterThanOrEqual(offsetTop)
  expect(at.footerBottom, 'The helper bar is on screen, on the keyboard').toBeLessThanOrEqual(offsetTop + height + 1)
  const line = await lineSpan(dayBox(page), 1)
  expect(line.top, 'The caret’s line is on screen').toBeGreaterThanOrEqual(offsetTop)
  await expectLineShown(page, line, 'The caret’s line')
})

test('The day comes into view when the keyboard opens, before any typing', async ({ page }) => {
  await openDayPage(page)
  await tapFocus(dayBox(page))

  await openKeyboard(page)

  await expect(dayBox(page)).toBeFocused()
  await expectLineShown(page, await lineSpan(dayBox(page), 1), 'The first line of The day')
})

test('The day goes to the top when the keyboard comes up for it, its top 12px under the nav bar', async ({ page }) => {
  await openDayPage(page)
  await tapFocus(dayBox(page))

  await openKeyboard(page)

  const at = await layout(page)
  const box = await dayBox(page).boundingBox()
  if (!box) throw new Error('The day is not on screen')
  expect(Math.abs(box.y - (at.visibleTop + MARGIN)), 'Its top is 12px under the nav bar').toBeLessThanOrEqual(2)
  await expectLineShown(page, await lineSpan(dayBox(page), 1), 'The caret’s line')
})

test('a long day tapped at its end shows the caret’s line instead of its top', async ({ page }) => {
  await openDayPage(page)
  const box = dayBox(page)
  await box.fill(Array.from({ length: 60 }, (_, i) => `Line ${i + 1}`).join('\n'))
  await tapFocus(box)
  await box.press('End')

  await openKeyboard(page)

  await expectLineShown(page, await lastLineSpan(box), 'Line 60')
})

test('adding a place from the Place row hands focus back without moving The day', async ({ page }) => {
  await openDayPage(page)
  await tapFocus(dayBox(page))
  await openKeyboard(page)
  const top = async () => {
    const box = await dayBox(page).boundingBox()
    if (!box) throw new Error('The day is not on screen')
    return box.y
  }
  const before = await top()
  const helpers = page.getByRole('group', { name: 'Writing helpers' })
  const place = helpers.getByRole('textbox', { name: 'Place and time' })

  await helpers.getByRole('button', { name: 'Place', exact: true }).click()
  await place.fill('nonstopstyle 10:30')
  await place.press('Enter')

  await expect(dayBox(page)).toBeFocused()
  await expect(dayBox(page)).toHaveValue('@nonstopstyle 10:30\n')
  await nextFrames(page)
  expect(Math.abs((await top()) - before), 'The day stays put').toBeLessThanOrEqual(1)
})

test('the Place field takes the whole bar, with Now, Add, Close and "Hide keyboard" on a line under it', async ({
  page,
}) => {
  await openDayPage(page)
  await tapFocus(dayBox(page))
  await openKeyboard(page)
  const helpers = page.getByRole('group', { name: 'Writing helpers' })

  await helpers.getByRole('button', { name: 'Place', exact: true }).click()
  const place = helpers.getByRole('textbox', { name: 'Place and time' })
  await expect(place).toBeFocused()
  await place.fill('nonstopstyle 10:30')

  const field = await place.boundingBox()
  const bar = await page.locator('.day-page__footer').boundingBox()
  if (!field || !bar) throw new Error('The Place row is not on screen')
  expect(Math.abs(field.width - (bar.width - 32)), 'As wide as the bar less its sides').toBeLessThanOrEqual(2)
  const below = helpers.getByRole('button')
  await expect(below).toHaveCount(4)
  const names = await below.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent))
  expect(names, 'In the order they show').toEqual([expect.stringMatching(/^Now, /), 'Add', 'Close', 'Hide keyboard'])
  for (const button of await below.all()) {
    const box = await button.boundingBox()
    if (!box) throw new Error('A button is not on screen')
    expect(box.y, 'On the line under the field').toBeGreaterThanOrEqual(field.y + field.height)
    await expect(button).toBeInViewport({ ratio: 1 })
  }
})

test('typing new lines at the end of a long day keeps the caret’s line above the helper bar', async ({ page }) => {
  await openDayPage(page)
  const box = dayBox(page)
  await box.fill(Array.from({ length: 60 }, (_, i) => `Line ${i + 1}`).join('\n'))
  await tapFocus(box)
  await box.press('End')
  await openKeyboard(page)

  for (let line = 61; line <= 65; line += 1) {
    await page.keyboard.press('Enter')
    await page.keyboard.type(`Line ${line}`)
    await nextFrames(page)
    await expectLineShown(page, await lastLineSpan(box), `Line ${line}`)
  }
})

test('moving the caret to an earlier line brings that line into view', async ({ page }) => {
  await openDayPage(page)
  const box = dayBox(page)
  await box.fill(Array.from({ length: 60 }, (_, i) => `Line ${i + 1}`).join('\n'))
  await tapFocus(box)
  await box.press('End')
  await openKeyboard(page)
  await nextFrames(page)
  const before = await lineSpan(box, 5)
  expect(before.bottom, 'Line 5 starts out of view').toBeLessThan((await layout(page)).visibleTop)

  await box.evaluate((element: HTMLTextAreaElement) => {
    const start = element.value.indexOf('Line 5\n')
    element.setSelectionRange(start, start)
  })
  await nextFrames(page)

  await expectLineShown(page, await lineSpan(box, 5), 'Line 5')
})

test('moving to How it felt with the keyboard up shows it above the helper bar, with only "Hide keyboard"', async ({
  page,
}) => {
  await openDayPage(page)
  await tapFocus(dayBox(page))
  await openKeyboard(page)
  const feelings = page.getByRole('textbox', { name: 'How it felt, in your words' })

  await feelings.focus()
  await nextFrames(page)

  const box = await feelings.boundingBox()
  if (!box) throw new Error('How it felt is not on screen')
  await expectLineShown(page, { top: box.y, bottom: box.y + box.height }, 'How it felt')
  const helpers = page.getByRole('group', { name: 'Writing helpers' })
  await expect(helpers.getByRole('button')).toHaveCount(1)
  await expect(helpers.getByRole('button', { name: 'Hide keyboard' })).toBeVisible()
})

test('with three friends, every "Who paid?" chip, Close and "Hide keyboard" show on the keyboard', async ({ page }) => {
  for (const name of ['Mariya', 'Jessie', 'Brandon']) await addFriend(page, name)
  await logMeetup(page, ['Mariya', 'Jessie', 'Brandon'], { type: 'Meal' })
  await openFriendPage(page, 'Mariya')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await openDay(page)
  await tapFocus(dayBox(page))
  const { height } = await openKeyboard(page)
  const helpers = page.getByRole('group', { name: 'Writing helpers' })

  await helpers.getByRole('button', { name: 'Paid' }).click()

  const whoPaid = helpers.getByRole('group', { name: 'Who paid?' })
  await expect(whoPaid.getByRole('button')).toHaveCount(5)
  for (const button of await whoPaid.getByRole('button').all()) await expect(button).toBeInViewport({ ratio: 1 })
  await expect(helpers.getByRole('button', { name: 'Close' })).toBeInViewport({ ratio: 1 })
  await expect(helpers.getByRole('button', { name: 'Hide keyboard' })).toBeInViewport({ ratio: 1 })
  const at = await layout(page)
  expect(at.footerBottom, 'The bar still sits on the keyboard').toBeCloseTo(height, 0)

  // "Hide keyboard" puts the bar back to its helpers.
  await helpers.getByRole('button', { name: 'Hide keyboard' }).click()
  await expect(whoPaid).toHaveCount(0)
  await expect(helpers.getByRole('button', { name: 'Paid' })).toBeVisible()
})

test('How it felt shows only "Hide keyboard": an open Place row waits with its text, and Who paid closes', async ({
  page,
}) => {
  await openDayPage(page)
  await tapFocus(dayBox(page))
  await openKeyboard(page)
  const helpers = page.getByRole('group', { name: 'Writing helpers' })
  const feelings = page.getByRole('textbox', { name: 'How it felt, in your words' })
  const place = helpers.getByRole('textbox', { name: 'Place and time' })

  await helpers.getByRole('button', { name: 'Place', exact: true }).click()
  await place.fill('Blue willow')
  await feelings.focus()
  await expect(helpers.getByRole('button')).toHaveCount(1)
  await expect(place).toHaveCount(0)
  await dayBox(page).focus()
  await expect(place).toHaveValue('Blue willow')
  await helpers.getByRole('button', { name: 'Close' }).click()

  await helpers.getByRole('button', { name: 'Paid' }).click()
  await feelings.focus()
  await expect(helpers.getByRole('button')).toHaveCount(1)
  await dayBox(page).focus()
  await expect(helpers.getByRole('group', { name: 'Who paid?' })).toHaveCount(0)
  await expect(helpers.getByRole('button', { name: 'Paid' })).toBeVisible()
})

test('with How it felt focused and no keyboard on screen, the empty helper bar goes away', async ({ page }) => {
  await openDayPage(page)
  const feelings = page.getByRole('textbox', { name: 'How it felt, in your words' })
  const footer = page.locator('.day-page__footer')

  await tapFocus(feelings)
  await expect(footer).toBeHidden()

  await openKeyboard(page)
  await expect(footer).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hide keyboard' })).toBeVisible()
})
