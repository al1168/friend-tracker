import { describe, expect, it } from 'vitest'
import {
  describeSkippedPhotos,
  isPhotoDataUrl,
  isPixelSize,
  isValidPhotoData,
  MAX_FULL_LENGTH,
  MAX_PHOTOS,
  MAX_THUMB_LENGTH,
  TOO_MANY_PHOTOS,
} from './photos'

const JPEG = 'data:image/jpeg;base64,'

describe('limits', () => {
  it('allows 20 photos per meetup, 4 MB full images and 512 KB thumbnails', () => {
    expect(MAX_PHOTOS).toBe(20)
    expect(TOO_MANY_PHOTOS).toBe('A meetup can have up to 20 photos.')
    expect(MAX_FULL_LENGTH).toBe(4_194_304)
    expect(MAX_THUMB_LENGTH).toBe(524_288)
  })
})

describe('isPhotoDataUrl', () => {
  it('accepts JPEG and PNG data URLs within the limit', () => {
    expect(isPhotoDataUrl(`${JPEG}AAAA`, 100)).toBe(true)
    expect(isPhotoDataUrl('data:image/png;base64,AAAA', 100)).toBe(true)
    expect(isPhotoDataUrl(`${JPEG}${'A'.repeat(100 - JPEG.length)}`, 100)).toBe(true)
  })

  it('refuses other strings, empty data, other types and long ones', () => {
    expect(isPhotoDataUrl(JPEG, 100)).toBe(false)
    expect(isPhotoDataUrl('data:image/gif;base64,AAAA', 100)).toBe(false)
    expect(isPhotoDataUrl('https://example.com/a.jpg', 100)).toBe(false)
    expect(isPhotoDataUrl(`${JPEG}${'A'.repeat(101 - JPEG.length)}`, 100)).toBe(false)
    expect(isPhotoDataUrl(42, 100)).toBe(false)
    expect(isPhotoDataUrl(null, 100)).toBe(false)
  })
})

describe('isPixelSize', () => {
  it('accepts whole numbers from 1', () => {
    expect(isPixelSize(1)).toBe(true)
    expect(isPixelSize(1600)).toBe(true)
    expect(isPixelSize(0)).toBe(false)
    expect(isPixelSize(12.5)).toBe(false)
    expect(isPixelSize('320')).toBe(false)
    expect(isPixelSize(Number.NaN)).toBe(false)
  })
})

describe('describeSkippedPhotos', () => {
  it('says why photos were left out', () => {
    expect(describeSkippedPhotos(0, 0)).toBeNull()
    expect(describeSkippedPhotos(3, 0)).toBe('A meetup can have up to 20 photos.')
    expect(describeSkippedPhotos(0, 1)).toBe("1 photo couldn't be added.")
    expect(describeSkippedPhotos(2, 2)).toBe("A meetup can have up to 20 photos. 2 photos couldn't be added.")
  })
})

describe('isValidPhotoData', () => {
  const valid = { full: `${JPEG}AAAA`, thumb: `${JPEG}BBBB`, width: 4, height: 3 }

  it('accepts a photo within every limit', () => {
    expect(isValidPhotoData(valid)).toBe(true)
  })

  it('refuses a bad image, an oversized one or a bad size', () => {
    expect(isValidPhotoData({ ...valid, full: 'nope' })).toBe(false)
    expect(isValidPhotoData({ ...valid, thumb: `${JPEG}${'A'.repeat(MAX_THUMB_LENGTH)}` })).toBe(false)
    expect(isValidPhotoData({ ...valid, width: 0 })).toBe(false)
    expect(isValidPhotoData({ ...valid, height: undefined })).toBe(false)
  })
})
