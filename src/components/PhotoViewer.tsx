import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { usePhoto } from '../data/hooks'
import { useScrollLock } from '../hooks/useScrollLock'
import type { MeetupPhoto } from '../types'
import { IconChevronLeft, IconChevronRight, IconClose } from './icons'
import './PhotoViewer.css'

/** How far a finger must travel sideways to change photos, in px. */
const SWIPE_DISTANCE = 50

interface PhotoViewerProps {
  /** Ids and thumbnails: the full image of the photo showing is read here, one at a time. */
  photos: Pick<MeetupPhoto, 'id' | 'thumb'>[]
  index: number
  onIndexChange: (index: number) => void
  /** Called on Close or Escape. The caller puts focus back on the photo's thumbnail. */
  onClose: () => void
  /** Alt text for a photo, e.g. "Photo 2 of 5, Coffee, Sat, Sep 12". */
  describe: (index: number) => string
}

/** A full-screen photo on a dark ground, with previous and next, swipe and arrow keys. No zoom. */
export function PhotoViewer({ photos, index, onIndexChange, onClose, describe }: PhotoViewerProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const [direction, setDirection] = useState<'next' | 'previous' | null>(null)
  useScrollLock(true)

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
  }, [])

  const photo = photos[index]
  const full = usePhoto(photo?.id)
  const count = photos.length

  function go(step: 1 | -1) {
    const next = index + step
    if (next < 0 || next >= count) return
    setDirection(step === 1 ? 'next' : 'previous')
    onIndexChange(next)
  }

  // Keys are heard on the whole document: Safari doesn't focus a button when it's tapped or clicked,
  // so after Next, focus may be on the page behind the viewer.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        go(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        go(-1)
      } else if (event.key === 'Tab') {
        trapFocus(event)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  /** Keeps Tab and Shift+Tab inside the viewer, going round from the last button to the first. */
  function trapFocus(event: KeyboardEvent) {
    const dialog = dialogRef.current
    const buttons = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (!dialog || !first || !last) return
    const outside = !dialog.contains(document.activeElement)
    if (event.shiftKey && (outside || document.activeElement === first)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (outside || document.activeElement === last)) {
      event.preventDefault()
      first.focus()
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary) return
    swipeStart.current = { x: event.clientX, y: event.clientY }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
  }

  if (!photo) return null

  return createPortal(
    <div ref={dialogRef} className="viewer" role="dialog" aria-modal="true" aria-label={`Photo ${index + 1} of ${count}`}>
      <div className="viewer__bar">
        <button ref={closeRef} type="button" className="viewer__button" aria-label="Close" onClick={onClose}>
          <IconClose size={24} strokeWidth={2.4} />
        </button>
      </div>
      <div
        className="viewer__stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeStart.current = null
        }}
      >
        <img
          key={photo.id}
          className={direction ? `viewer__image viewer__image--${direction}` : 'viewer__image'}
          src={full?.full ?? photo.thumb}
          width={full?.width}
          height={full?.height}
          alt={describe(index)}
          draggable={false}
        />
      </div>
      <div className="viewer__controls">
        {/* aria-disabled, not disabled: a button that disables itself would drop focus. */}
        <button
          type="button"
          className="viewer__button"
          aria-label="Previous photo"
          aria-disabled={index === 0}
          onClick={() => go(-1)}
        >
          <IconChevronLeft size={28} strokeWidth={2.4} />
        </button>
        <p className="viewer__count numeric" aria-live="polite">
          {index + 1} of {count}
        </p>
        <button
          type="button"
          className="viewer__button"
          aria-label="Next photo"
          aria-disabled={index === count - 1}
          onClick={() => go(1)}
        >
          <IconChevronRight size={28} strokeWidth={2.4} />
        </button>
      </div>
    </div>,
    document.body,
  )
}
