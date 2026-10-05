import { describe, expect, it } from 'vitest'
import { caretEdge, keyboardInset, keyboardIsUp, revealMargin, revealOffset } from './viewport'

describe('keyboardInset', () => {
  it('is zero with no keyboard', () => {
    expect(keyboardInset(664, { height: 664, offsetTop: 0 })).toBe(0)
  })

  it('is the part of the layout viewport the keyboard covers', () => {
    expect(keyboardInset(664, { height: 324, offsetTop: 0 })).toBe(340)
  })

  it('leaves out what the visual viewport has scrolled past', () => {
    expect(keyboardInset(664, { height: 324, offsetTop: 40 })).toBe(300)
  })

  it('rounds to whole pixels and never goes below zero', () => {
    expect(keyboardInset(664, { height: 323.6, offsetTop: 0 })).toBe(340)
    expect(keyboardInset(664, { height: 700, offsetTop: 0 })).toBe(0)
  })
})

describe('keyboardIsUp', () => {
  it('is false with no visual viewport at all', () => {
    expect(keyboardIsUp(664, null)).toBe(false)
    expect(keyboardIsUp(664, undefined)).toBe(false)
  })

  it('is false while the visual viewport is full height', () => {
    expect(keyboardIsUp(664, { height: 664, scale: 1 })).toBe(false)
  })

  it('is true when the visual viewport is more than 50px shorter', () => {
    expect(keyboardIsUp(664, { height: 324, scale: 1 })).toBe(true)
    expect(keyboardIsUp(664, { height: 613, scale: 1 })).toBe(true)
  })

  it('takes a small shrink for browser chrome, not the keyboard', () => {
    expect(keyboardIsUp(664, { height: 614, scale: 1 })).toBe(false)
  })

  it('stays true while iOS pans the visual viewport, whatever its offsetTop', () => {
    // Panned all the way: keyboardInset says 0, yet the keyboard is still up.
    const panned = { height: 324, offsetTop: 340, scale: 1 }
    expect(keyboardInset(664, panned)).toBe(0)
    expect(keyboardIsUp(664, panned)).toBe(true)
  })

  it('is false while zoomed in, where a short visual viewport is the zoom', () => {
    expect(keyboardIsUp(664, { height: 332, scale: 2 })).toBe(false)
  })

  it('treats a scale within 0.01 of 1 as normal zoom, since floating point can give 1.0000001', () => {
    expect(keyboardIsUp(664, { height: 324, scale: 1.0000001 })).toBe(true)
    expect(keyboardIsUp(664, { height: 324, scale: 0.9999999 })).toBe(true)
    expect(keyboardIsUp(664, { height: 324, scale: 1.02 })).toBe(false)
  })
})

describe('revealOffset', () => {
  const port = { top: 100, bottom: 300 }

  it('leaves a field that is already in view, margin included', () => {
    expect(revealOffset(port, { top: 112, bottom: 288 }, 12)).toBe(0)
    expect(revealOffset(port, { top: 150, bottom: 200 }, 12)).toBe(0)
  })

  it('scrolls down just enough to show a field below, with the margin under it', () => {
    expect(revealOffset(port, { top: 400, bottom: 444 }, 12)).toBe(156)
    expect(revealOffset(port, { top: 270, bottom: 314 }, 12)).toBe(26)
  })

  it('scrolls up just enough to show a field above, with the margin over it', () => {
    expect(revealOffset(port, { top: 20, bottom: 64 }, 12)).toBe(-92)
    expect(revealOffset(port, { top: 105, bottom: 149 }, 12)).toBe(-7)
  })

  it('with no margin, leaves a field that is just in view and shows one that is not flush with the edge', () => {
    expect(revealOffset(port, { top: 256, bottom: 300 }, 0)).toBe(0)
    expect(revealOffset(port, { top: 100, bottom: 144 }, 0)).toBe(0)
    expect(revealOffset(port, { top: 260, bottom: 304 }, 0)).toBe(4)
    expect(revealOffset(port, { top: 96, bottom: 140 }, 0)).toBe(-4)
  })

  it('scrolls whole pixels, rounding away from the field, so a field a fraction of a pixel out ends up inside', () => {
    expect(revealOffset(port, { top: 256.44, bottom: 300.44 }, 0)).toBe(1)
    expect(revealOffset(port, { top: 99.95, bottom: 143.95 }, 0)).toBe(-1)
    expect(revealOffset(port, { top: 400.5, bottom: 444.5 }, 12)).toBe(157)
  })

  it('shows all of a field that fits in the view but not with the margins, splitting the room left', () => {
    const below = { top: 400, bottom: 590 }
    const offset = revealOffset(port, below, 12)
    expect(below.top - offset).toBeGreaterThanOrEqual(port.top)
    expect(below.bottom - offset).toBeLessThanOrEqual(port.bottom)
    expect(offset).toBe(295)

    const above = { top: -100, bottom: 90 }
    expect(revealOffset(port, above, 12)).toBe(-205)
  })

  it('shows the top of a field taller than the view that is below it', () => {
    expect(revealOffset(port, { top: 250, bottom: 550 }, 12)).toBe(150)
  })

  it('shows the top of a field taller than the view that is above it, unless the caret is at its end', () => {
    expect(revealOffset(port, { top: -200, bottom: 250 }, 12)).toBe(-300)
    expect(revealOffset(port, { top: -200, bottom: 250 }, 12, 'end')).toBe(-50)
  })

  it('shows the bottom of a field taller than the view when the caret is at its end', () => {
    expect(revealOffset(port, { top: 250, bottom: 550 }, 12, 'end')).toBe(250)
    // Already flush with the bottom: nothing to do.
    expect(revealOffset(port, { top: -100, bottom: 300 }, 12, 'end')).toBe(0)
  })

  it('leaves a field that already fills the view, unless the caret is at its hidden end', () => {
    expect(revealOffset(port, { top: 50, bottom: 350 }, 12)).toBe(0)
    expect(revealOffset(port, { top: 50, bottom: 350 }, 12, 'end')).toBe(50)
  })
})

describe('revealMargin', () => {
  it('is the field’s own scroll margin, so the CSS sets it at every text size', () => {
    expect(revealMargin('12px')).toBe(12)
    expect(revealMargin('17.25px')).toBe(17.25)
    expect(revealMargin('0px')).toBe(0)
  })

  it('is 12px when the field has no margin it can read', () => {
    expect(revealMargin('')).toBe(12)
    expect(revealMargin('auto')).toBe(12)
  })
})

describe('caretEdge', () => {
  /** A Notes box 88px tall: `text` with the caret at `caret` (the end by default), its text `textHeight` tall. */
  function box(text: string, textHeight: number, caret: number | null = text.length) {
    return { value: text, selectionEnd: caret, scrollHeight: Math.max(88, textHeight), clientHeight: 88 }
  }
  const long = 'x'.repeat(400)

  it('is the end when the caret reaches the last character, or past it, of text that runs past the box', () => {
    expect(caretEdge(box(long, 300))).toBe('end')
    expect(caretEdge(box(long, 300, 399))).toBe('end')
  })

  it('is the start anywhere earlier in text that runs past the box, or without a selection', () => {
    expect(caretEdge(box(long, 300, 398))).toBe('start')
    expect(caretEdge(box(long, 300, 0))).toBe('start')
    expect(caretEdge(box(long, 300, null))).toBe('start')
  })

  it('is the start when the text fits in the box, since its end is then not at the bottom', () => {
    expect(caretEdge(box('Met at work', 22))).toBe('start')
    expect(caretEdge(box('', 0, 0))).toBe('start')
    // A pixel of rounding is not overflow.
    expect(caretEdge({ ...box('Met at work', 22), scrollHeight: 89 })).toBe('start')
  })

  it('shows the top of an empty Notes box taller than the view, where its caret is', () => {
    const port = { top: 100, bottom: 150 }
    const notes = { top: 120, bottom: 208 }
    const offset = revealOffset(port, notes, 12, caretEdge(box('', 0, 0)))
    expect(notes.top - offset, 'The top of Notes is at the top of the view').toBe(port.top)
  })
})
