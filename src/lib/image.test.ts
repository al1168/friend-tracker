import { describe, expect, it } from 'vitest'
import { AVATAR_SIZE, fitWithin, PHOTO_FULL_SIZE, PHOTO_THUMB_SIZE } from './image'

describe('sizes', () => {
  it('keeps avatars at 400px and meetup photos at 1600px with 320px thumbnails', () => {
    expect(AVATAR_SIZE).toEqual({ maxSide: 400, quality: 0.85 })
    expect(PHOTO_FULL_SIZE).toEqual({ maxSide: 1600, quality: 0.8 })
    expect(PHOTO_THUMB_SIZE).toEqual({ maxSide: 320, quality: 0.75 })
  })
})

describe('fitWithin', () => {
  it('shrinks the longest side to the limit, keeping the shape', () => {
    expect(fitWithin({ width: 4032, height: 3024 }, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin({ width: 3024, height: 4032 }, 1600)).toEqual({ width: 1200, height: 1600 })
    expect(fitWithin({ width: 5000, height: 5000 }, 1600)).toEqual({ width: 1600, height: 1600 })
  })

  it('makes the thumbnail from the full size', () => {
    expect(fitWithin({ width: 1600, height: 1200 }, 320)).toEqual({ width: 320, height: 240 })
    expect(fitWithin({ width: 1200, height: 1600 }, 320)).toEqual({ width: 240, height: 320 })
  })

  it('never enlarges a small image', () => {
    expect(fitWithin({ width: 800, height: 600 }, 1600)).toEqual({ width: 800, height: 600 })
    expect(fitWithin({ width: 1, height: 1 }, 320)).toEqual({ width: 1, height: 1 })
  })

  it('rounds to whole pixels and keeps at least 1', () => {
    expect(fitWithin({ width: 3000, height: 2001 }, 1600)).toEqual({ width: 1600, height: 1067 })
    expect(fitWithin({ width: 10000, height: 2 }, 320)).toEqual({ width: 320, height: 1 })
  })
})
