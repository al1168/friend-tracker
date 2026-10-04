// Rules for meetup photos, shared by the data layer, the backup parser and the meetup sheet.

import { plural } from './text'

/** The most photos one meetup can have. */
export const MAX_PHOTOS = 20
export const TOO_MANY_PHOTOS = `A meetup can have up to ${MAX_PHOTOS} photos.`

/** The longest a full photo's data URL can be, in characters (4 MB). */
export const MAX_FULL_LENGTH = 4 * 1024 * 1024
/** The longest a thumbnail's data URL can be, in characters (512 KB). */
export const MAX_THUMB_LENGTH = 512 * 1024

const DATA_URL_PREFIXES = ['data:image/jpeg;base64,', 'data:image/png;base64,']

/** A JPEG or PNG data URL with some data, at most `maxLength` characters long. */
export function isPhotoDataUrl(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length <= maxLength &&
    DATA_URL_PREFIXES.some((prefix) => value.length > prefix.length && value.startsWith(prefix))
  )
}

/** A size in pixels: a whole number, at least 1. */
export function isPixelSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

/**
 * Why some chosen photos weren't added, or null when they all were: `skipped` didn't fit under the
 * limit, `failed` couldn't be read.
 */
export function describeSkippedPhotos(skipped: number, failed: number): string | null {
  const problems: string[] = []
  if (skipped > 0) problems.push(TOO_MANY_PHOTOS)
  if (failed > 0) problems.push(`${plural(failed, 'photo')} couldn't be added.`)
  return problems.length > 0 ? problems.join(' ') : null
}

/** The image part of a photo: both data URLs within their limits, and the full image's size. */
export function isValidPhotoData(photo: { full: unknown; thumb: unknown; width: unknown; height: unknown }): boolean {
  return (
    isPhotoDataUrl(photo.full, MAX_FULL_LENGTH) &&
    isPhotoDataUrl(photo.thumb, MAX_THUMB_LENGTH) &&
    isPixelSize(photo.width) &&
    isPixelSize(photo.height)
  )
}
