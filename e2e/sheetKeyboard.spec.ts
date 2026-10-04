import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend } from './helpers.ts'

declare global {
  interface Window {
    /** Set by `fakeVisualViewport`: changes the visual viewport's height and fires its events. */
    setVisualViewportHeight?: (height: number) => void
  }
}

/** About the height of the iPhone keyboard with its suggestion bar. */
const KEYBOARD = 340

/**
 * Playwright's WebKit has no on-screen keyboard, so this plays the iPhone's: `window.visualViewport`
 * becomes a fake whose height the test sets. Like iOS, the layout viewport (innerHeight) keeps its
 * size; only the visual viewport shrinks, and it fires `resize` (and `scroll`).
 */
async function fakeVisualViewport(page: Page) {
  await page.addInitScript(() => {
    const state: { height: number | null } = { height: null }
    const viewport = new EventTarget()
    const getters: Record<string, () => number> = {
      width: () => window.innerWidth,
      height: () => state.height ?? window.innerHeight,
      offsetTop: () => 0,
      offsetLeft: () => 0,
      pageTop: () => window.scrollY,
      pageLeft: () => window.scrollX,
      scale: () => 1,
    }
    for (const [name, get] of Object.entries(getters)) Object.defineProperty(viewport, name, { get, enumerable: true })
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => viewport })
    window.setVisualViewportHeight = (height) => {
      state.height = height
      viewport.dispatchEvent(new Event('resize'))
      viewport.dispatchEvent(new Event('scroll'))
    }
  })
}

async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

/**
 * Focuses a field the way a tap does before the keyboard is up: WebKit scrolls a newly focused field
 * into view a frame later, so let that happen first.
 */
async function tapFocus(field: Locator) {
  await field.focus()
  await nextFrames(field.page())
}

/** Slides the keyboard up, then lets the page lay out and paint. */
async function openKeyboard(page: Page) {
  await page.evaluate((keyboard) => window.setVisualViewportHeight?.(window.innerHeight - keyboard), KEYBOARD)
  await nextFrames(page)
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

/** The field has focus and is all on screen: inside the sheet's visible scroll area, above the Save bar. */
async function expectRevealed(field: Locator, name: string) {
  const at = await placement(field)
  expect(at.focused, `${name} has focus`).toBe(true)
  expect(at.top, `The top of ${name} is inside the visible part of the sheet`).toBeGreaterThanOrEqual(at.visibleTop)
  expect(at.bottom, `The bottom of ${name} is inside the visible part of the sheet`).toBeLessThanOrEqual(at.visibleBottom)
  expect(at.bottom, `${name} is above the Save bar`).toBeLessThanOrEqual(at.footerTop)
}

test.beforeEach(async ({ page }) => {
  await fakeVisualViewport(page)
  await page.goto('/')
})

test('the meetup Note comes into view when the keyboard opens, before any typing', async ({ page }) => {
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  const note = sheet.getByLabel('Note')
  await tapFocus(note)
  // Start from the top of the sheet, with the Note below what you can see.
  await sheet.locator('.sheet__body').evaluate((body) => {
    body.scrollTop = 0
  })
  const before = await placement(note)
  expect(before.focused).toBe(true)
  expect(before.top, 'Note starts below the visible part of the sheet').toBeGreaterThan(before.visibleBottom)

  await openKeyboard(page)

  await expectRevealed(note, 'Note')
})

test('the friend Notes field stays in view when the keyboard opens, before any typing', async ({ page }) => {
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  const notes = sheet.getByLabel('Notes')
  await tapFocus(notes)
  // As when tapped: Notes is on screen before the keyboard comes up.
  await expectRevealed(notes, 'Notes before the keyboard')

  await openKeyboard(page)

  await expectRevealed(notes, 'Notes')
})

test('moving to Notes while the keyboard is up brings it into view, before any typing', async ({ page }) => {
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  const name = sheet.getByLabel('Name', { exact: true })
  const notes = sheet.getByLabel('Notes')
  await tapFocus(name)
  await openKeyboard(page)
  await expect(name).toBeFocused()
  const before = await placement(notes)
  expect(before.top, 'Notes starts below the visible part of the sheet').toBeGreaterThan(before.visibleBottom)

  // Focus arrives without the browser scrolling the sheet for it, so only the app can show Notes.
  await notes.evaluate((element) => element.focus({ preventScroll: true }))
  await nextFrames(page)

  await expectRevealed(notes, 'Notes')
})

test('scrolling the sheet while the keyboard is up is left alone', async ({ page }) => {
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  const body = sheet.locator('.sheet__body')
  await tapFocus(sheet.getByLabel('Notes'))
  await openKeyboard(page)

  // Scroll back up to the photo with Notes still focused: nothing pulls the sheet back down.
  await body.evaluate((element) => {
    element.scrollTop = 0
  })
  await nextFrames(page)
  await nextFrames(page)

  expect(await body.evaluate((element) => element.scrollTop)).toBe(0)
  await expect(sheet.getByLabel('Notes')).toBeFocused()
})
