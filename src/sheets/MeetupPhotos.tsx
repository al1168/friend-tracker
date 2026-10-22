import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { PhotoAddHint, PhotoAddTile } from '../components/PhotoAddTile'
import { IconClose } from '../components/icons'
import type { NewPhoto } from '../db/meetups'
import { usePhotoAdder } from '../hooks/usePhotoAdder'
import { MAX_PHOTOS } from '../lib/photos'
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
  const gridRef = useRef<HTMLUListElement>(null)
  const [announcement, setAnnouncement] = useState({ text: '', n: 0 })
  // After a remove, focus goes to the remove button that took its place (else the one before, else Add photos).
  const pendingFocus = useRef<number | null>(null)
  const adder = usePhotoAdder({
    room: MAX_PHOTOS - photos.length,
    active: open,
    onBusyChange,
    // The sheet holds each new photo, full image and all, until Save.
    onPhoto: (photo) => {
      setPhotos((current) => current && [...current, { id: photo.id, thumb: photo.thumb, added: photo }])
    },
    onDone: (ids) => {
      if (ids.length > 0) setAnnouncement((last) => ({ text: `Added ${plural(ids.length, 'photo')}.`, n: last.n + 1 }))
    },
  })

  useEffect(() => {
    const index = pendingFocus.current
    const grid = gridRef.current
    if (index === null || !grid) return
    pendingFocus.current = null
    const removes = grid.querySelectorAll<HTMLButtonElement>('.photo-tile__remove')
    const target = removes[index] ?? removes[index - 1] ?? grid.querySelector<HTMLButtonElement>('.photo-add')
    target?.focus({ preventScroll: true })
  }, [photos])

  function remove(id: string, index: number) {
    pendingFocus.current = index
    setPhotos((current) => current && current.filter((photo) => photo.id !== id))
    adder.clearMessage()
    setAnnouncement((last) => ({ text: '', n: last.n }))
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
        <PhotoAddTile adder={adder} />
      </ul>
      <PhotoAddHint adder={adder} />
      <span className="visually-hidden" aria-live="polite">
        <span key={announcement.n}>{announcement.text}</span>
      </span>
    </section>
  )
}
