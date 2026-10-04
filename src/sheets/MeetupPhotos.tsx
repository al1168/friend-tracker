import { useEffect, useId, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react'
import { IconCameraPlus, IconClose } from '../components/icons'
import type { NewPhoto } from '../db/meetups'
import { newId } from '../lib/ids'
import { processPhoto } from '../lib/image'
import { describeSkippedPhotos, isValidPhotoData, MAX_PHOTOS, TOO_MANY_PHOTOS } from '../lib/photos'
import { plural } from '../lib/text'

/** A photo in the meetup sheet: a saved one (its id and thumbnail), or a new one waiting for Save. */
export interface DraftPhoto {
  id: string
  thumb: string
  /** Only for a photo added in this sheet. */
  added?: NewPhoto
}

interface MeetupPhotosProps {
  photos: DraftPhoto[]
  setPhotos: Dispatch<SetStateAction<DraftPhoto[] | null>>
  /** True while photos are being resized (Save waits). */
  onBusyChange: (busy: boolean) => void
  /** False once the sheet closes, which stops resizing what's left. */
  open: boolean
}

/** The meetup sheet's Photos section: a grid of thumbnails with remove buttons, and the Add photos tile. */
export function MeetupPhotos({ photos, setPhotos, onBusyChange, open }: MeetupPhotosProps) {
  const labelId = useId()
  const messageId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLUListElement>(null)
  const busyRef = useRef(false)
  const openRef = useRef(open)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [message, setMessage] = useState<{ text: string; n: number } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // After a remove, focus goes to the remove button that took its place (else the one before, else Add photos).
  const pendingFocus = useRef<number | null>(null)

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    const index = pendingFocus.current
    const grid = gridRef.current
    if (index === null || !grid) return
    pendingFocus.current = null
    const removes = grid.querySelectorAll<HTMLButtonElement>('.photo-tile__remove')
    const target = removes[index] ?? removes[index - 1] ?? grid.querySelector<HTMLButtonElement>('.photo-add')
    target?.focus({ preventScroll: true })
  }, [photos])

  function showMessage(text: string | null) {
    setMessage((current) => (text === null ? null : { text, n: (current?.n ?? 0) + 1 }))
  }

  function openPicker() {
    if (busyRef.current) return
    if (photos.length >= MAX_PHOTOS) {
      showMessage(TOO_MANY_PHOTOS)
      return
    }
    fileInput.current?.click()
  }

  /** Resizes the chosen files one at a time (to keep memory low), adding each as it's ready. */
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0 || busyRef.current) return
    const chosen = files.slice(0, Math.max(0, MAX_PHOTOS - photos.length))
    const skipped = files.length - chosen.length
    let added = 0
    let failed = 0
    busyRef.current = true
    onBusyChange(true)
    showMessage(null)
    setAnnouncement('')
    try {
      for (const [index, file] of chosen.entries()) {
        if (!openRef.current) return
        setProgress({ current: index + 1, total: chosen.length })
        try {
          const processed = await processPhoto(file)
          if (!isValidPhotoData(processed)) throw new Error('The photo is too large')
          const id = newId()
          setPhotos((current) => current && [...current, { id, thumb: processed.thumb, added: { id, ...processed } }])
          added += 1
        } catch {
          failed += 1
        }
      }
    } finally {
      busyRef.current = false
      setProgress(null)
      onBusyChange(false)
    }
    showMessage(describeSkippedPhotos(skipped, failed))
    if (added > 0) setAnnouncement(`Added ${plural(added, 'photo')}.`)
  }

  function remove(id: string, index: number) {
    pendingFocus.current = index
    setPhotos((current) => current && current.filter((photo) => photo.id !== id))
    showMessage(null)
    setAnnouncement('')
  }

  return (
    <section className="form-section" aria-labelledby={labelId}>
      <h3 id={labelId} className="form-section__label">
        Photos
      </h3>
      <ul ref={gridRef} className="photo-grid" aria-labelledby={labelId}>
        {photos.map((photo, index) => (
          <li key={photo.id} className="photo-tile">
            <img className="photo-tile__image" src={photo.thumb} alt={`Photo ${index + 1}`} />
            <button
              type="button"
              className="photo-tile__remove"
              aria-label={`Remove photo ${index + 1}`}
              onClick={() => remove(photo.id, index)}
            >
              <span className="photo-tile__remove-glyph">
                <IconClose size={12} strokeWidth={3} />
              </span>
            </button>
          </li>
        ))}
        <li className="photo-tile">
          <button
            type="button"
            className="photo-add"
            aria-disabled={progress !== null}
            aria-describedby={message ? messageId : undefined}
            onClick={openPicker}
          >
            <IconCameraPlus size={26} />
            <span>{progress ? `Adding ${progress.current} of ${progress.total}…` : 'Add photos'}</span>
          </button>
        </li>
      </ul>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={choose}
      />
      {message && (
        <p key={message.n} id={messageId} className="field-hint" role="alert">
          {message.text}
        </p>
      )}
      <span className="visually-hidden" aria-live="polite">
        {announcement}
      </span>
    </section>
  )
}
