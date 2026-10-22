import { describe, expect, it } from 'vitest'
import { isDayPage } from './routes'

describe('isDayPage', () => {
  it('is a meetup’s day page', () => {
    expect(isDayPage('/meetups/m1/day')).toBe(true)
    expect(isDayPage('/meetups/abc-123/day')).toBe(true)
  })

  it('is no other page', () => {
    expect(isDayPage('/')).toBe(false)
    expect(isDayPage('/meetups')).toBe(false)
    expect(isDayPage('/meetups/m1')).toBe(false)
    expect(isDayPage('/meetups/m1/day/more')).toBe(false)
    expect(isDayPage('/meetups//day')).toBe(false)
    expect(isDayPage('/friends/day')).toBe(false)
  })
})
