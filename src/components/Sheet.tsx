import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useKeyboardInset } from '../hooks/useKeyboardInset'
import { useRevealFocusedField } from '../hooks/useRevealFocusedField'
import { useScrollLock } from '../hooks/useScrollLock'
import './Sheet.css'

const EXIT_MS = 260
const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 0.6 // px per ms

/** The header's trailing text button, such as Save. */
export interface SheetAction {
  label: string
  onClick: () => void
  /** Dimmed and unpressable (VoiceOver reads it as dimmed). */
  disabled?: boolean
}

interface SheetProps {
  open: boolean
  title: string
  onRequestClose: () => void | Promise<void>
  /** On the right of the header, across from Cancel, as iOS sheets put Save. */
  action?: SheetAction
  footer?: ReactNode
  children: ReactNode
}

export function Sheet({ open, title, onRequestClose, action, footer, children }: SheetProps) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  const closing = mounted && !open

  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ y: number; time: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useScrollLock(mounted)
  useKeyboardInset(mounted)
  useRevealFocusedField(open, bodyRef)

  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [closing])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus({ preventScroll: true })
    return () => {
      const active = document.activeElement
      if (active instanceof HTMLElement && panelRef.current?.contains(active)) active.blur()
      previous?.focus({ preventScroll: true })
    }
  }, [open])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('button')) return
    dragStart.current = { y: event.clientY, time: event.timeStamp }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return
    setDragY(Math.max(0, event.clientY - dragStart.current.y))
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    if (!start) return
    dragStart.current = null
    setDragging(false)
    const distance = event.clientY - start.y
    const velocity = distance / Math.max(1, event.timeStamp - start.time)
    if (distance > DISMISS_DISTANCE || (distance > 20 && velocity > DISMISS_VELOCITY)) {
      void Promise.resolve(onRequestClose()).finally(() => setDragY(0))
    } else {
      setDragY(0)
    }
  }

  function onPointerCancel() {
    dragStart.current = null
    setDragging(false)
    setDragY(0)
  }

  if (!mounted) return null

  const style: CSSProperties | undefined = closing
    ? { transform: 'translateY(100%)' }
    : dragY > 0
      ? { transform: `translateY(${dragY}px)` }
      : undefined

  return createPortal(
    <div className={closing ? 'sheet-layer sheet-layer--closing' : 'sheet-layer'}>
      <div className="sheet-scrim" onClick={() => void onRequestClose()} />
      <div
        ref={panelRef}
        className={dragging ? 'sheet sheet--dragging' : 'sheet'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={style}
      >
        <div
          className="sheet__header"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <span className="sheet__grabber" aria-hidden="true" />
          {/* Each side holds its button over an invisible copy of the other side's label, so both sides are as
              wide as the wider one: the title stays centered and can wrap at large text sizes. */}
          <div className="sheet__bar">
            <span className="sheet__side">
              <button type="button" className="text-button" onClick={() => void onRequestClose()}>
                Cancel
              </button>
              {action && (
                <span className="text-button sheet__action sheet__ghost" aria-hidden="true">
                  {action.label}
                </span>
              )}
            </span>
            <h2 id={titleId} className="sheet__title">
              {title}
            </h2>
            <span className="sheet__side sheet__side--end">
              {action && (
                <button
                  type="button"
                  className="text-button sheet__action"
                  onClick={action.onClick}
                  disabled={action.disabled}
                >
                  {action.label}
                </button>
              )}
              <span className="text-button sheet__ghost" aria-hidden="true">
                Cancel
              </span>
            </span>
          </div>
        </div>
        <div ref={bodyRef} className="sheet__body">
          {children}
        </div>
        {footer && <div className="sheet__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
