import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, friendRow, LARGE_TEXT, seedMeetups, sheetSave } from './helpers.ts'
import { closeKeyboard, fakeVisualViewport, KEYBOARD, nextFrames, openKeyboard, setVisualViewport, tapFocus } from './keyboard.ts'

/** Where a field inside a sheet is, against the part of the sheet's body you can see (it ends at the keyboard). */
async function placement(field: Locator) {
  return field.evaluate((element) => {
    const body = element.closest<HTMLElement>('.sheet__body')
    if (!body) throw new Error('Not in a sheet')
    const top = body.getBoundingClientRect().top + body.clientTop
    const rect = element.getBoundingClientRect()
    return {
      top: rect.top,
      bottom: rect.bottom,
      visibleTop: top,
      visibleBottom: top + body.clientHeight,
      focused: document.activeElement === element,
    }
  })
}

/** The room the app leaves between a field it reveals and the edges of the sheet's visible area. */
const MARGIN = 12

/**
 * The field has focus and is all on screen: inside the sheet's visible scroll area, with `room` to spare above
 * the end of it (the keyboard, or the bottom of the screen).
 */
async function expectRevealed(field: Locator, name: string, { room = 0 } = {}) {
  const at = await placement(field)
  expect(at.focused, `${name} has focus`).toBe(true)
  expect(at.top, `The top of ${name} is inside the visible part of the sheet`).toBeGreaterThanOrEqual(at.visibleTop)
  expect(at.bottom, `The bottom of ${name} is inside the visible part of the sheet, with ${room}px to spare`).toBeLessThanOrEqual(
    at.visibleBottom - room,
  )
}

/** Scrolls to a field the way someone does before tapping it, and checks that its top shows. */
async function scrollToTap(field: Locator, name: string) {
  await field.scrollIntoViewIfNeeded()
  const at = await placement(field)
  expect(at.top, `The top of ${name} shows in the sheet, so it can be tapped`).toBeGreaterThanOrEqual(at.visibleTop)
  expect(at.top, `The top of ${name} shows in the sheet, so it can be tapped`).toBeLessThan(at.visibleBottom)
}

function scrollTop(body: Locator) {
  return body.evaluate((element) => element.scrollTop)
}

async function openLogMeetup(page: Page) {
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  return page.getByRole('dialog', { name: 'Log meetup' })
}

async function openNewFriend(page: Page) {
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  return page.getByRole('dialog', { name: 'New friend' })
}

test.beforeEach(async ({ page }) => {
  await fakeVisualViewport(page)
  await page.goto('/')
})

test('the friend Notes field stays in view when the keyboard opens, before any typing', async ({ page }) => {
  const sheet = await openNewFriend(page)
  const notes = sheet.getByLabel('Notes')
  await tapFocus(notes)
  // As when tapped: Notes is on screen before the keyboard comes up.
  await expectRevealed(notes, 'Notes before the keyboard')

  await openKeyboard(page)

  await expectRevealed(notes, 'Notes')
})

test('moving to Notes while the keyboard is up brings it into view, before any typing', async ({ page }) => {
  const sheet = await openNewFriend(page)
  const name = sheet.getByLabel('Name', { exact: true })
  const notes = sheet.getByLabel('Notes')
  await tapFocus(name)
  await openKeyboard(page)
  await expect(name).toBeFocused()
  const before = await placement(notes)
  expect(before.top, 'Notes starts below the visible part of the sheet').toBeGreaterThan(before.visibleBottom)

  // A fallback guard: focus arrives without the browser scrolling the sheet for it, so only the app can show Notes.
  await notes.evaluate((element) => element.focus({ preventScroll: true }))
  await nextFrames(page)

  await expectRevealed(notes, 'Notes', { room: MARGIN })
})

test('at large text, moving to Notes leaves the room the CSS sets, which grows with the text', async ({ page }) => {
  await page.addStyleTag({ content: LARGE_TEXT })
  const sheet = await openNewFriend(page)
  const name = sheet.getByLabel('Name', { exact: true })
  const notes = sheet.getByLabel('Notes')
  await tapFocus(name)
  await openKeyboard(page)
  const room = await notes.evaluate((element) => parseFloat(getComputedStyle(element).scrollMarginBottom))
  expect(room, 'var(--space-3) at this text size').toBeGreaterThan(MARGIN)
  const before = await placement(notes)
  expect(before.top, 'Notes starts below the visible part of the sheet').toBeGreaterThan(before.visibleBottom)

  await notes.evaluate((element) => element.focus({ preventScroll: true }))
  await nextFrames(page)

  // Layout positions are fractions of a pixel, so allow for rounding below the margin's whole pixels.
  await expectRevealed(notes, 'Notes', { room: Math.floor(room) })
})

test('moving to Notes brings it into view while iOS has panned the visual viewport over the keyboard', async ({
  page,
}) => {
  const sheet = await openNewFriend(page)
  const notes = sheet.getByLabel('Notes')
  await tapFocus(sheet.getByLabel('Name', { exact: true }))
  // Panned all the way down: the keyboard covers none of the layout viewport, yet it is still up.
  await openKeyboard(page, { offsetTop: KEYBOARD })
  const before = await placement(notes)
  expect(before.top, 'Notes starts below the visible part of the sheet').toBeGreaterThan(before.visibleBottom)

  await notes.evaluate((element) => element.focus({ preventScroll: true }))
  await nextFrames(page)

  await expectRevealed(notes, 'Notes', { room: MARGIN })
})

test('a field already in view is not nudged when it takes focus with the keyboard up', async ({ page }) => {
  const sheet = await openNewFriend(page)
  const body = sheet.locator('.sheet__body')
  const notes = sheet.getByLabel('Notes')
  await tapFocus(sheet.getByLabel('Name', { exact: true }))
  await openKeyboard(page)
  // Where the browser's own focus scrolling leaves a field: just in view, close to the edge.
  await notes.evaluate((element) => {
    const scroller = element.closest<HTMLElement>('.sheet__body')
    if (!scroller) throw new Error('Not in a sheet')
    const visibleBottom = scroller.getBoundingClientRect().top + scroller.clientTop + scroller.clientHeight
    scroller.scrollTop += element.getBoundingClientRect().bottom - visibleBottom + 2
  })
  await nextFrames(page)
  const before = await scrollTop(body)
  const at = await placement(notes)
  expect(at.bottom, 'Notes is in view').toBeLessThanOrEqual(at.visibleBottom)
  expect(at.bottom, 'Notes is close to the edge').toBeGreaterThan(at.visibleBottom - 12)

  await notes.evaluate((element) => element.focus({ preventScroll: true }))
  await nextFrames(page)

  expect(await scrollTop(body), 'The sheet did not move').toBe(before)
  await expectRevealed(notes, 'Notes')
})

test('scrolling the sheet while the keyboard is up is left alone', async ({ page }) => {
  const sheet = await openNewFriend(page)
  const body = sheet.locator('.sheet__body')
  const notes = sheet.getByLabel('Notes')
  await tapFocus(notes)
  const { height } = await openKeyboard(page)

  // Scroll back up to the photo with Notes still focused: nothing pulls the sheet back down.
  await body.evaluate((element) => {
    element.scrollTop = 0
  })
  await nextFrames(page)
  await nextFrames(page)
  expect(await scrollTop(body)).toBe(0)

  // iOS nudges the visual viewport as you scroll: a scroll event, no resize.
  await setVisualViewport(page, { height, offsetTop: 8 })
  await nextFrames(page)

  expect(await scrollTop(body)).toBe(0)
  await expect(notes).toBeFocused()
})

test('closing the keyboard leaves the sheet where it was scrolled', async ({ page }) => {
  const sheet = await openNewFriend(page)
  const body = sheet.locator('.sheet__body')
  const notes = sheet.getByLabel('Notes')
  await scrollToTap(notes, 'Notes')
  await tapFocus(notes)
  await openKeyboard(page)
  await expectRevealed(notes, 'Notes')

  // Back up to the photo with Notes still focused, then the keyboard goes down: the sheet grows.
  await body.evaluate((element) => {
    element.scrollTop = 0
  })
  await nextFrames(page)
  await closeKeyboard(page)
  await nextFrames(page)

  expect(await scrollTop(body), 'Nothing pulls the sheet back to Notes').toBe(0)
  await expect(notes).toBeFocused()
})

/** 12 friends with an "a" in every name. */
const SEARCHABLE = ['Alex', 'Sam', 'Kim Park', 'Jordan', 'Maya', 'Theo Banks', 'Mariya', 'Jessica', 'Brandon', 'Priya', 'Lana', 'Zara']

/** Opens Log meetup over the 12 friends, focuses "Search all friends", brings up the keyboard and types "a". */
async function searchWithKeyboardUp(page: Page) {
  await seedMeetups(page, { friends: SEARCHABLE.map((name, i) => friendRow(`f${i + 1}`, name)) })
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)))
  const input = sheet.getByLabel('Search all friends')
  await tapFocus(input)
  await openKeyboard(page)
  await page.keyboard.type('a')
  await nextFrames(page)
  const rows = sheet.getByRole('group', { name: 'Search results' }).getByRole('button')
  await expect(rows).toHaveCount(SEARCHABLE.length)
  // The whole field, not just the text inside it.
  return { sheet, input, field: sheet.locator('label.search'), rows }
}

/** How many result rows show above the keyboard: whole, and at least in part. */
async function resultsShown(rows: Locator, visibleBottom: number) {
  return rows.evaluateAll(
    (elements, bottom) => ({
      whole: elements.filter((row) => row.getBoundingClientRect().bottom <= bottom + 0.5).length,
      started: elements.filter((row) => row.getBoundingClientRect().top < bottom).length,
    }),
    visibleBottom,
  )
}

test('the friend search goes to the top of the sheet as you type, so its results fill the room above the keyboard', async ({
  page,
}) => {
  const { sheet, input, field, rows } = await searchWithKeyboardUp(page)
  const body = sheet.locator('.sheet__body')
  await expect(sheet.locator('.sheet__footer')).toHaveCount(0)
  let at = await placement(field)
  expect(at.top - at.visibleTop, 'The field sits 12px below the header').toBeCloseTo(MARGIN, 0)
  // This profile is Safari's 664px-tall page, 324px above the keyboard: three whole rows, and the fourth starting
  // at the keyboard's edge (a Home Screen app has more room: see the next test).
  const shown = await resultsShown(rows, at.visibleBottom)
  expect(shown.whole, 'Three whole results above the keyboard').toBeGreaterThanOrEqual(3)
  expect(shown.started, 'The results run on to the keyboard').toBeGreaterThanOrEqual(4)
  await expect(input).toBeFocused()

  // Scrolling the results by hand moves nothing, and neither does the app when the caret moves (the browser's own
  // caret reveal aside, which this leaves out).
  await body.evaluate((element) => {
    element.scrollTop += 80
  })
  await nextFrames(page)
  await nextFrames(page)
  const scrolled = await scrollTop(body)
  expect(scrolled, 'Scrolled by hand').toBeGreaterThan(0)
  await page.evaluate(() => document.dispatchEvent(new Event('selectionchange')))
  await nextFrames(page)
  await nextFrames(page)
  expect(await scrollTop(body)).toBe(scrolled)

  // The next letter brings the field back to the top.
  await page.keyboard.type('r')
  await nextFrames(page)
  at = await placement(field)
  expect(at.top - at.visibleTop).toBeCloseTo(MARGIN, 0)
  await expect(rows).toHaveCount(SEARCHABLE.filter((name) => name.toLowerCase().includes('ar')).length)
})

test.describe('as the Home Screen app', () => {
  // The iPhone 13's whole 844px screen, with its 47px status bar and 34px home indicator.
  test.use({ viewport: { width: 390, height: 844 } })

  test('the friend search shows at least four whole results above the keyboard', async ({ page }) => {
    await page.addStyleTag({ content: ':root { --safe-top: 47px; --safe-bottom: 34px; }' })
    const { field, rows } = await searchWithKeyboardUp(page)
    const at = await placement(field)
    expect(at.top - at.visibleTop, 'The field sits 12px below the header').toBeCloseTo(MARGIN, 0)
    expect((await resultsShown(rows, at.visibleBottom)).whole).toBeGreaterThanOrEqual(4)
  })
})

test('focusing a chip with the keyboard up leaves the scrolled sheet alone', async ({ page }) => {
  const sheet = await openLogMeetup(page)
  const body = sheet.locator('.sheet__body')
  await tapFocus(sheet.getByLabel('Search all friends'))
  await openKeyboard(page)
  await body.evaluate((element) => {
    element.scrollTop = 0
  })
  await nextFrames(page)
  const chip = sheet.getByRole('group', { name: 'Activities' }).getByRole('button').first()
  const before = await chip.evaluate((element) => {
    const scroller = element.closest<HTMLElement>('.sheet__body')
    if (!scroller) throw new Error('Not in a sheet')
    const visibleBottom = scroller.getBoundingClientRect().top + scroller.clientTop + scroller.clientHeight
    return { top: element.getBoundingClientRect().top, visibleBottom }
  })
  expect(before.top, 'The chip is below the visible part of the sheet').toBeGreaterThan(before.visibleBottom)

  // A chip brings up no keyboard, so taking focus gives the app nothing to reveal.
  await chip.evaluate((element) => element.focus({ preventScroll: true }))
  await nextFrames(page)

  await expect(chip).toBeFocused()
  expect(await scrollTop(body)).toBe(0)
})

test('with the keyboard up, Save stays at the top right and nothing rides on the keyboard', async ({ page }) => {
  const sheet = await openLogMeetup(page)
  const save = sheetSave(sheet)
  // Measure once the sheet has finished rising.
  await sheet.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)))
  await tapFocus(sheet.getByLabel('Search all friends'))
  const before = await save.boundingBox()

  const { height } = await openKeyboard(page)

  expect(await save.boundingBox(), 'Save did not move').toEqual(before)
  await expect(save).toBeInViewport()
  await expect(sheet.locator('.sheet__footer')).toHaveCount(0)
  const bodyBottom = await sheet.locator('.sheet__body').evaluate((element) => element.getBoundingClientRect().bottom)
  expect(bodyBottom, 'The body runs down to the keyboard').toBeCloseTo(height, 0)
  await closeKeyboard(page)
})

test('the end of the sheet stays clear of the home indicator, and gives that room up while the keyboard is up', async ({
  page,
}) => {
  // Play a phone with a home indicator: 34px of safe area at the bottom.
  await page.addStyleTag({ content: ':root { --safe-bottom: 34px; }' })
  const sheet = await openNewFriend(page)
  // With no footer, the body is the bottom of the sheet.
  const body = sheet.locator('.sheet__body')
  const html = page.locator('html')
  const paddingBottom = () => body.evaluate((element) => getComputedStyle(element).paddingBottom)
  await tapFocus(sheet.getByLabel('Name', { exact: true }))
  expect(await paddingBottom(), 'Room for the home indicator under the last row').toBe('58px')

  const { height } = await openKeyboard(page)
  await expect(html).toHaveClass(/\bkeyboard-open\b/)
  expect(await paddingBottom(), 'The keyboard covers the home indicator').toBe('24px')

  // iOS pans the visual viewport down over the keyboard: still up.
  await setVisualViewport(page, { height, offsetTop: KEYBOARD })
  await expect(html).toHaveClass(/\bkeyboard-open\b/)

  await closeKeyboard(page)
  await expect(html).not.toHaveClass(/\bkeyboard-open\b/)
  expect(await paddingBottom()).toBe('58px')

  // Closing the sheet with the keyboard up takes the class away with it.
  await openKeyboard(page)
  await expect(html).toHaveClass(/\bkeyboard-open\b/)
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet).toBeHidden()
  await expect(html).not.toHaveClass(/\bkeyboard-open\b/)
})
