import { useEffect, useId, useRef, useState, type ChangeEvent, type RefObject } from 'react'
import type { NewPhoto } from '../db/meetups'
import { newId } from '../lib/ids'
import { processPhoto } from '../lib/image'
import { describeSkippedPhotos, isValidPhotoData, TOO_MANY_PHOTOS } from '../lib/photos'

const NOT_SAVED = "A photo couldn't be saved."

export interface PhotoAdderOptions {
  /** How many more photos fit: 20 less those the meetup has. */
  room: number
  /**
   * Keeps one resized photo: the meetup sheet adds it to its draft, the Meetup page saves it. Resolving false stops
   * the batch quietly (the meetup is gone); throwing stops it with "A photo couldn't be saved.".
   */
  onPhoto: (photo: NewPhoto) => boolean | void | Promise<boolean | void>
  /** False once the sheet closes or the page goes: the batch stops after the photo in hand, and says nothing. */
  active: boolean
  /** True from the first photo of a batch to its end (the sheet's Save and the page's Edit wait). */
  onBusyChange?: (busy: boolean) => void
  /** At the end of a batch that wasn't stopped by `active`: the ids of the photos kept, in order. */
  onDone?: (ids: string[]) => void
}

export interface PhotoAdder {
  /** Opens the picker, or says there's no room. */
  open: () => void
  inputRef: RefObject<HTMLInputElement | null>
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  /** Which photo of the batch is being added. */
  progress: { current: number; total: number } | null
  /** Why some weren't added, under the grid; `n` makes the same words again a new alert. */
  message: { text: string; n: number } | null
  messageId: string
  clearMessage: () => void
}

/**
 * The Add photos tile's picker and its one-at-a-time loop, shared by the meetup sheet and the Meetup page. Each
 * chosen photo is resized (1600px and 320px JPEGs) and handed to `onPhoto` before the next is read, so the loop holds
 * at most one photo's full image (the sheet then keeps its own until Save).
 */
export function usePhotoAdder({ room, onPhoto, active, onBusyChange, onDone }: PhotoAdderOptions): PhotoAdder {
  const inputRef = useRef<HTMLInputElement>(null)
  const messageId = useId()
  const busyRef = useRef(false)
  const activeRef = useRef(active)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [message, setMessage] = useState<{ text: string; n: number } | null>(null)

  useEffect(() => {
    activeRef.current = active
  }, [active])
  // A full unmount (leaving the page, a relock) stops the loop too.
  useEffect(
    () => () => {
      activeRef.current = false
    },
    [],
  )

  function showMessage(text: string | null) {
    setMessage((current) => (text === null ? null : { text, n: (current?.n ?? 0) + 1 }))
  }

  function open() {
    if (busyRef.current) return
    if (room <= 0) {
      showMessage(TOO_MANY_PHOTOS)
      return
    }
    inputRef.current?.click()
  }

  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0 || busyRef.current) return
    // The first ones that fit are added.
    const chosen = files.slice(0, Math.max(0, room))
    const skipped = files.length - chosen.length
    const added: string[] = []
    let failed = 0
    let notSaved = false
    busyRef.current = true
    onBusyChange?.(true)
    showMessage(null)
    try {
      for (const [index, file] of chosen.entries()) {
        if (!activeRef.current) return
        setProgress({ current: index + 1, total: chosen.length })
        let photo: NewPhoto
        try {
          const processed = await processPhoto(file)
          if (!isValidPhotoData(processed)) throw new Error('The photo is too large')
          photo = { id: newId(), ...processed }
        } catch {
          failed += 1
          continue
        }
        try {
          if ((await onPhoto(photo)) === false) return
        } catch {
          // A write that fails stops the batch; the photos kept before it stay.
          notSaved = true
          break
        }
        added.push(photo.id)
      }
    } finally {
      busyRef.current = false
      setProgress(null)
      onBusyChange?.(false)
    }
    if (!activeRef.current) return
    const problems = [describeSkippedPhotos(skipped, failed), notSaved ? NOT_SAVED : null].filter(Boolean)
    showMessage(problems.length > 0 ? problems.join(' ') : null)
    onDone?.(added)
  }

  return { open, inputRef, onChange, progress, message, messageId, clearMessage: () => showMessage(null) }
}
