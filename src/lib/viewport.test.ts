import { describe, expect, it } from 'vitest'
import { keyboardInset, revealOffset } from './viewport'

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

  it('shows the top of a field taller than the view that is below it', () => {
    expect(revealOffset(port, { top: 250, bottom: 550 }, 12)).toBe(138)
  })

  it('shows the bottom of a field taller than the view that is above it', () => {
    expect(revealOffset(port, { top: -200, bottom: 250 }, 12)).toBe(-38)
  })

  it('leaves a field that already fills the view', () => {
    expect(revealOffset(port, { top: 50, bottom: 350 }, 12)).toBe(0)
  })
})
