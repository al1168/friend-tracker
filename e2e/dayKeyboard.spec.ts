import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, logMeetup, openDay, openFriendPage } from './helpers.ts'
import { closeKeyboard, fakeVisualViewport, nextFrames, openKeyboard, tapFocus } from './keyboard.ts'

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
