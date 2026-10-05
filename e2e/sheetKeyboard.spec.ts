import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, editMeetup, logMeetup, openFriendPage } from './helpers.ts'

declare global {
  interface Window {
    /**
     * Set by `fakeVisualViewport`: resizes and moves the visual viewport, firing `resize` when its
     * height changes and `scroll` when it moves, as iOS does.
     */
    setVisualViewport?: (next: { height: number; offsetTop: number }) => void
  }
}

/** About the height of the iPhone keyboard with its suggestion bar. */
const KEYBOARD = 340

/**
 * Playwright's WebKit has no on-screen keyboard, so this plays the iPhone's: `window.visualViewport`
 * becomes a fake whose height and offsetTop the test sets. Like iOS, the layout viewport
 * (innerHeight) keeps its size; only the visual viewport shrinks, and iOS may also pan it down
 * (offsetTop) to show a field.
 */
async function fakeVisualViewport(page: Page) {
  await page.addInitScript(() => {
    const state = { height: window.innerHeight, offsetTop: 0, resized: false }
    const viewport = new EventTarget()
    const getters: Record<string, () => number> = {
      width: () => window.innerWidth,
      height: () => (state.resized ? state.height : window.innerHeight),
      offsetTop: () => state.offsetTop,
      offsetLeft: () => 0,
      pageTop: () => window.scrollY + state.offsetTop,
      pageLeft: () => window.scrollX,
      scale: () => 1,
    }
    for (const [name, get] of Object.entries(getters)) Object.defineProperty(viewport, name, { get, enumerable: true })
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => viewport })
    window.setVisualViewport = ({ height, offsetTop }) => {
      const resized = height !== getters.height()
      const moved = offsetTop !== state.offsetTop
      state.height = height
      state.offsetTop = offsetTop
      state.resized = true
      if (resized) viewport.dispatchEvent(new Event('resize'))
      if (moved) viewport.dispatchEvent(new Event('scroll'))
    }
  })
}

async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

/** A custom property the app sets on <html>, such as --keyboard-inset. */
async function rootProperty(page: Page, name: string) {
  return page.evaluate((name) => document.documentElement.style.getPropertyValue(name), name)
}

/** Moves the fake visual viewport. Throws when the fake is missing, so no test can run without a keyboard. */
async function setVisualViewport(page: Page, next: { height: number; offsetTop: number }) {
  await page.evaluate((next) => {
    if (!window.setVisualViewport) throw new Error('The fake visualViewport is missing')
    window.setVisualViewport(next)
  }, next)
  await nextFrames(page)
}

/**
 * Slides the keyboard up, with iOS panning the visual viewport `offsetTop` down as well, then lets
 * the page lay out and paint. Checks that the sheet really sits on the keyboard.
 */
async function openKeyboard(page: Page, { offsetTop = 0 } = {}) {
  const height = (await page.evaluate(() => window.innerHeight)) - KEYBOARD
  await setVisualViewport(page, { height, offsetTop })
  const inset = `${KEYBOARD - offsetTop}px`
  expect(await rootProperty(page, '--keyboard-inset'), 'The sheet sits on the keyboard').toBe(inset)
  expect(await rootProperty(page, '--viewport-height'), 'The sheet fits above the keyboard').toBe(`${height}px`)
  return { height, offsetTop }
}

/** Slides the keyboard back down, with focus staying where it is. */
async function closeKeyboard(page: Page) {
  await setVisualViewport(page, { height: await page.evaluate(() => window.innerHeight), offsetTop: 0 })
  expect(await rootProperty(page, '--keyboard-inset'), 'The sheet is back at the bottom').toBe('0px')
}

/**
 * Focuses a field the way a tap does before the keyboard is up: WebKit scrolls a newly focused field
 * into view a frame later, so let that happen first.
 */
async function tapFocus(field: Locator) {
  await field.focus()
  await nextFrames(field.page())
}

/** Where a field inside a sheet is, against the part of the sheet's body you can see and its Save bar. */
async function placement(field: Locator) {
  return field.evaluate((element) => {
    const body = element.closest<HTMLElement>('.sheet__body')
    const footer = element.closest('.sheet')?.querySelector('.sheet__footer')
    if (!body || !footer) throw new Error('Not in a sheet with a footer')
    const top = body.getBoundingClientRect().top + body.clientTop
    const rect = element.getBoundingClientRect()
    return {
      top: rect.top,
      bottom: rect.bottom,
      visibleTop: top,
      visibleBottom: top + body.clientHeight,
      footerTop: footer.getBoundingClientRect().top,
      focused: document.activeElement === element,
    }
  })
}

/** The room the app leaves between a field it reveals and the edges of the sheet's visible area. */
const MARGIN = 12

/**
 * The field has focus and is all on screen: inside the sheet's visible scroll area, and above the Save bar
 * with `room` to spare.
 */
async function expectRevealed(field: Locator, name: string, { room = 0 } = {}) {
  const at = await placement(field)
  expect(at.focused, `${name} has focus`).toBe(true)
  expect(at.top, `The top of ${name} is inside the visible part of the sheet`).toBeGreaterThanOrEqual(at.visibleTop)
  expect(at.bottom, `The bottom of ${name} is inside the visible part of the sheet`).toBeLessThanOrEqual(at.visibleBottom)
  expect(at.bottom, `${name} is above the Save bar, with ${room}px to spare`).toBeLessThanOrEqual(at.footerTop - room)
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

test('the meetup Note comes into view when the keyboard opens, before any typing', async ({ page }) => {
  const sheet = await openLogMeetup(page)
  const note = sheet.getByLabel('Note')
  await scrollToTap(note, 'Note')
  await tapFocus(note)

  await openKeyboard(page)

  await expectRevealed(note, 'Note')
})

test('the Note in Edit meetup comes into view when the keyboard opens, before any typing', async ({ page }) => {
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await openFriendPage(page, 'Alex')
  const sheet = await editMeetup(page, /Coffee/)
  const note = sheet.getByLabel('Note')
  await scrollToTap(note, 'Note')
  await tapFocus(note)

  await openKeyboard(page)

  await expectRevealed(note, 'Note')
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

test('the Note comes into view when iOS also pans the visual viewport for the keyboard', async ({ page }) => {
  const sheet = await openLogMeetup(page)
  const note = sheet.getByLabel('Note')
  await scrollToTap(note, 'Note')
  await tapFocus(note)

  const { height, offsetTop } = await openKeyboard(page, { offsetTop: 150 })

  await expectRevealed(note, 'Note')
  // What you see of the page runs from offsetTop to offsetTop + height in layout viewport terms.
  const at = await placement(note)
  expect(at.top, 'The top of Note is on screen').toBeGreaterThanOrEqual(offsetTop)
  expect(at.bottom, 'The bottom of Note is on screen, above the keyboard').toBeLessThanOrEqual(offsetTop + height)
})

test('moving to the meetup Note while the keyboard is up shows all of it above the Save bar', async ({ page }) => {
  const sheet = await openLogMeetup(page)
  await tapFocus(sheet.getByLabel('Search all friends'))
  await openKeyboard(page)
  const note = sheet.getByLabel('Note')
  // So the browser has scrolling to do: if it ever starts with the Note in view, this test checks nothing.
  const before = await placement(note)
  expect(before.bottom, 'The Note starts out of the visible part of the sheet').toBeGreaterThan(before.visibleBottom)

  // As the keyboard's next-field arrow does: a plain focus, with the browser's own scrolling.
  await note.focus()
  await nextFrames(page)

  await expectRevealed(note, 'Note', { room: MARGIN })
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
  const sheet = await openLogMeetup(page)
  const body = sheet.locator('.sheet__body')
  const note = sheet.getByLabel('Note')
  await scrollToTap(note, 'Note')
  await tapFocus(note)
  await openKeyboard(page)
  await expectRevealed(note, 'Note')

  // Back up to Who with the Note still focused, then the keyboard goes down: the sheet grows.
  await body.evaluate((element) => {
    element.scrollTop = 0
  })
  await nextFrames(page)
  await closeKeyboard(page)
  await nextFrames(page)

  expect(await scrollTop(body), 'Nothing pulls the sheet back to the Note').toBe(0)
  await expect(note).toBeFocused()
})

test('focusing a chip with the keyboard up leaves the scrolled sheet alone', async ({ page }) => {
  const sheet = await openLogMeetup(page)
  const body = sheet.locator('.sheet__body')
  const note = sheet.getByLabel('Note')
  await scrollToTap(note, 'Note')
  await tapFocus(note)
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

test('the Save bar gives up its home indicator room while the keyboard is up', async ({ page }) => {
  // Play a phone with a home indicator: 34px of safe area at the bottom.
  await page.addStyleTag({ content: ':root { --safe-bottom: 34px; }' })
  const sheet = await openNewFriend(page)
  const footer = sheet.locator('.sheet__footer')
  const html = page.locator('html')
  const paddingBottom = () => footer.evaluate((element) => getComputedStyle(element).paddingBottom)
  await tapFocus(sheet.getByLabel('Name', { exact: true }))
  expect(await paddingBottom(), 'Room for the home indicator under Save').toBe('46px')

  const { height } = await openKeyboard(page)
  await expect(html).toHaveClass(/\bkeyboard-open\b/)
  expect(await paddingBottom(), 'The keyboard covers the home indicator').toBe('12px')

  // iOS pans the visual viewport down over the keyboard: still up.
  await setVisualViewport(page, { height, offsetTop: KEYBOARD })
  await expect(html).toHaveClass(/\bkeyboard-open\b/)

  await closeKeyboard(page)
  await expect(html).not.toHaveClass(/\bkeyboard-open\b/)
  expect(await paddingBottom()).toBe('46px')

  // Closing the sheet with the keyboard up takes the class away with it.
  await openKeyboard(page)
  await expect(html).toHaveClass(/\bkeyboard-open\b/)
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet).toBeHidden()
  await expect(html).not.toHaveClass(/\bkeyboard-open\b/)
})
