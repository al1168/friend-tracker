import { afterEach, describe, expect, it, vi } from 'vitest'
import { startKeyboardInset } from './useKeyboardInset'

/**
 * A page with a fake visual viewport, like an iPhone's: the layout viewport (innerHeight) keeps its size and
 * only the visual viewport shrinks for the keyboard. <html> keeps its custom properties and classes in a Map
 * and a Set, so the test can read them.
 */
function fakePage() {
  const viewport = Object.assign(new EventTarget(), { height: 664, offsetTop: 0, scale: 1 })
  const properties = new Map<string, string>()
  const classes = new Set<string>()
  const documentElement = {
    style: {
      setProperty: (name: string, value: string) => properties.set(name, value),
      removeProperty: (name: string) => properties.delete(name),
    },
    classList: {
      toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
      remove: (name: string) => classes.delete(name),
    },
  }
  vi.stubGlobal('window', { innerHeight: 664, visualViewport: viewport })
  vi.stubGlobal('document', { documentElement })
  return {
    properties,
    classes,
    /** Slides the keyboard to `height` px tall (0 to close it). */
    keyboard(height: number) {
      viewport.height = 664 - height
      viewport.dispatchEvent(new Event('resize'))
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('startKeyboardInset', () => {
  it('publishes the keyboard while it has a user', () => {
    const page = fakePage()
    const stop = startKeyboardInset()
    expect(page.properties.get('--keyboard-inset')).toBe('0px')
    page.keyboard(340)
    expect(page.properties.get('--keyboard-inset')).toBe('340px')
    expect(page.properties.get('--viewport-height')).toBe('324px')
    expect(page.classes.has('keyboard-open')).toBe(true)
    stop()
    expect(page.properties.get('--keyboard-inset')).toBe('0px')
    expect(page.properties.has('--viewport-height')).toBe(false)
    expect(page.classes.has('keyboard-open')).toBe(false)
  })

  it('keeps publishing until the last of two users stops', () => {
    const page = fakePage()
    const stopSheet = startKeyboardInset()
    const stopDayPage = startKeyboardInset()
    page.keyboard(340)

    // The Log sheet finishes closing while the day page has the keyboard up.
    stopSheet()
    expect(page.properties.get('--keyboard-inset')).toBe('340px')
    expect(page.properties.get('--viewport-height')).toBe('324px')
    expect(page.classes.has('keyboard-open')).toBe(true)
    page.keyboard(300)
    expect(page.properties.get('--keyboard-inset')).toBe('300px')

    stopDayPage()
    expect(page.properties.get('--keyboard-inset')).toBe('0px')
    expect(page.properties.has('--viewport-height')).toBe(false)
    expect(page.classes.has('keyboard-open')).toBe(false)
  })

  it('counts a user once, however many times it stops', () => {
    const page = fakePage()
    const stopSheet = startKeyboardInset()
    const stopDayPage = startKeyboardInset()
    page.keyboard(340)
    stopSheet()
    stopSheet()
    expect(page.classes.has('keyboard-open')).toBe(true)
    stopDayPage()
    expect(page.classes.has('keyboard-open')).toBe(false)
  })

  it('stops listening once nobody uses it', () => {
    const page = fakePage()
    startKeyboardInset()()
    page.keyboard(340)
    expect(page.properties.get('--keyboard-inset')).toBe('0px')
    expect(page.classes.has('keyboard-open')).toBe(false)
  })

  it('does nothing without a visual viewport', () => {
    vi.stubGlobal('window', { innerHeight: 664, visualViewport: null })
    vi.stubGlobal('document', { documentElement: {} })
    const stop = startKeyboardInset()
    expect(() => stop()).not.toThrow()
  })
})
