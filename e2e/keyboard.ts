import { expect, type Locator, type Page } from '@playwright/test'

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
export const KEYBOARD = 340

/**
 * Playwright's WebKit has no on-screen keyboard, so this plays the iPhone's: `window.visualViewport`
 * becomes a fake whose height and offsetTop the test sets. Like iOS, the layout viewport
 * (innerHeight) keeps its size; only the visual viewport shrinks, and iOS may also pan it down
 * (offsetTop) to show a field. Call it before the page loads.
 */
export async function fakeVisualViewport(page: Page) {
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

export async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

/** A custom property the app sets on <html>, such as --keyboard-inset. */
export async function rootProperty(page: Page, name: string) {
  return page.evaluate((name) => document.documentElement.style.getPropertyValue(name), name)
}

/** Moves the fake visual viewport. Throws when the fake is missing, so no test can run without a keyboard. */
export async function setVisualViewport(page: Page, next: { height: number; offsetTop: number }) {
  await page.evaluate((next) => {
    if (!window.setVisualViewport) throw new Error('The fake visualViewport is missing')
    window.setVisualViewport(next)
  }, next)
  await nextFrames(page)
}

/**
 * Slides the keyboard up, with iOS panning the visual viewport `offsetTop` down as well, then lets
 * the page lay out and paint. Checks that the app knows where the keyboard is.
 */
export async function openKeyboard(page: Page, { offsetTop = 0 } = {}) {
  const height = (await page.evaluate(() => window.innerHeight)) - KEYBOARD
  await setVisualViewport(page, { height, offsetTop })
  const inset = `${KEYBOARD - offsetTop}px`
  expect(await rootProperty(page, '--keyboard-inset'), 'The sheet or page sits on the keyboard').toBe(inset)
  expect(await rootProperty(page, '--viewport-height'), 'It fits above the keyboard').toBe(`${height}px`)
  return { height, offsetTop }
}

/** Slides the keyboard back down, with focus staying where it is. */
export async function closeKeyboard(page: Page) {
  await setVisualViewport(page, { height: await page.evaluate(() => window.innerHeight), offsetTop: 0 })
  expect(await rootProperty(page, '--keyboard-inset'), 'Back at the bottom').toBe('0px')
}

/**
 * Focuses a field the way a tap does before the keyboard is up: WebKit scrolls a newly focused field
 * into view a frame later, so let that happen first.
 */
export async function tapFocus(field: Locator) {
  await field.focus()
  await nextFrames(field.page())
}
