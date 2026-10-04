// Shrinks photos on the phone before they're saved. Only `fitWithin` is pure; the rest needs a
// browser (a canvas), so it's covered by the end-to-end tests.

export interface PixelSize {
  width: number
  height: number
}

/** How big to draw an image, and the JPEG quality to save it at. */
export interface JpegSize {
  maxSide: number
  quality: number
}

/** A friend's photo. */
export const AVATAR_SIZE: JpegSize = { maxSide: 400, quality: 0.85 }
/** A meetup photo, shown full screen. */
export const PHOTO_FULL_SIZE: JpegSize = { maxSide: 1600, quality: 0.8 }
/** A meetup photo's thumbnail, for grids and lists. */
export const PHOTO_THUMB_SIZE: JpegSize = { maxSide: 320, quality: 0.75 }

/** A meetup photo, ready to save: two JPEG data URLs and the full image's size. */
export interface ProcessedPhoto {
  full: string
  thumb: string
  width: number
  height: number
}

/** The size that fits within `maxSide` on its longest side, keeping the shape. Never enlarges; at least 1×1. */
export function fitWithin({ width, height }: PixelSize, maxSide: number): PixelSize {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

interface Decoded extends PixelSize {
  source: CanvasImageSource
  /** Frees the decoded pixels. */
  release: () => void
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load image'))
    image.src = url
  })
}

/** Decodes an image file, turned upright the way its EXIF orientation says. */
async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
    } catch {
      // Older Safari refuses the options, and some files only decode in an <img>: try that next.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    if (image.naturalWidth < 1 || image.naturalHeight < 1) throw new Error('Image has no size')
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

/** Draws `source` onto a new canvas of `size`, on white (JPEG has no transparency). */
function draw(source: CanvasImageSource, size: PixelSize): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available')
  context.fillStyle = 'white'
  context.fillRect(0, 0, size.width, size.height)
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, size.width, size.height)
  return canvas
}

/** iOS limits the memory all canvases share, so hand each one's back as soon as it's done. */
function release(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): string {
  const url = canvas.toDataURL('image/jpeg', quality)
  if (!url.startsWith('data:image/jpeg')) throw new Error('Could not encode the image')
  return url
}

/** Shrinks a photo so its longest side is at most `maxSide`, as a JPEG data URL. */
export async function resizeImageToDataUrl(
  file: Blob,
  maxSide = AVATAR_SIZE.maxSide,
  quality = AVATAR_SIZE.quality,
): Promise<string> {
  const image = await decode(file)
  try {
    const canvas = draw(image.source, fitWithin(image, maxSide))
    try {
      return toJpeg(canvas, quality)
    } finally {
      release(canvas)
    }
  } finally {
    image.release()
  }
}

/**
 * Decodes a photo once and makes both sizes a meetup keeps: the full image (longest side 1600px)
 * and, drawn from it, the thumbnail (longest side 320px). Throws if the file can't be read.
 */
export async function processPhoto(file: Blob): Promise<ProcessedPhoto> {
  const image = await decode(file)
  try {
    const full = draw(image.source, fitWithin(image, PHOTO_FULL_SIZE.maxSide))
    try {
      const thumb = draw(full, fitWithin(full, PHOTO_THUMB_SIZE.maxSide))
      try {
        return {
          full: toJpeg(full, PHOTO_FULL_SIZE.quality),
          thumb: toJpeg(thumb, PHOTO_THUMB_SIZE.quality),
          width: full.width,
          height: full.height,
        }
      } finally {
        release(thumb)
      }
    } finally {
      release(full)
    }
  } finally {
    image.release()
  }
}
