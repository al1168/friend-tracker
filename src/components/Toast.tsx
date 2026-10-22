import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigationType } from 'react-router'
import { isDayPage } from '../lib/routes'
import './Toast.css'

export interface ToastOptions {
  message: string
  actionLabel?: string
  onAction?: () => void
  /** `success` shows an animated check mark. */
  tone?: 'success' | 'plain'
}

const TOAST_MS = 5000
const TOAST_WITH_ACTION_MS = 8000
const ToastContext = createContext<((options: ToastOptions) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null)
  const [paused, setPaused] = useState(false)
  const nextId = useRef(0)
  const toastRef = useRef<HTMLDivElement>(null)
  const { key: pageKey, pathname } = useLocation()
  const navigationType = useNavigationType()
  const pathRef = useRef(pathname)

  const show = useCallback((options: ToastOptions) => {
    // The day page never shows a toast, so none covers the box being written in: it says what it needs itself.
    if (isDayPage(pathRef.current)) return
    nextId.current += 1
    setPaused(false)
    setToast({ ...options, id: nextId.current })
  }, [])

  useEffect(() => {
    if (!toast || paused) return
    const timer = window.setTimeout(() => setToast(null), toast.actionLabel ? TOAST_WITH_ACTION_MS : TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast, paused])

  // Publishes the shown toast's real height on <html> as --toast-space, so the end of a page scrolls clear of a
  // toast that wraps taller than its one line (see .app in base.css). Set before paint. When the toast goes, its
  // room stays until the next page, so the end of this one doesn't jump up under your thumb.
  useLayoutEffect(() => {
    const element = toastRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty('--toast-space', `${Math.ceil(entry.borderBoxSize[0].blockSize)}px`)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [toast])
  // A toast belongs to the page it was shown on. Opening another page (a push) clears it at once, so an Undo never
  // shows over a page it isn't about. Going back (a pop) keeps it, so a delete's Undo shows on the page you land on;
  // so does a replace, which in this app stands in for Back or changes the same page. A new page keeps room only for
  // a toast that is showing now (on a push the toast is still in the DOM here, so it isn't measured).
  useLayoutEffect(() => {
    pathRef.current = pathname
    if (navigationType === 'PUSH') {
      setToast(null)
      document.documentElement.style.setProperty('--toast-space', '0px')
      return
    }
    const element = toastRef.current
    const space = element ? Math.ceil(element.getBoundingClientRect().height) : 0
    document.documentElement.style.setProperty('--toast-space', `${space}px`)
    // Only a new page runs this: its path and how it was reached are read with it.
  }, [pageKey])
  useLayoutEffect(
    () => () => {
      document.documentElement.style.removeProperty('--toast-space')
    },
    [],
  )

  return (
    <ToastContext.Provider value={show}>
      {children}
      {createPortal(
        <div className="toast-region" role="status" aria-live="polite">
          {toast && (
            <div
              key={toast.id}
              ref={toastRef}
              className="toast"
              onFocus={() => setPaused(true)}
              onBlur={() => setPaused(false)}
              onPointerEnter={() => setPaused(true)}
              onPointerLeave={() => setPaused(false)}
            >
              {toast.tone !== 'plain' && (
                <span className="toast__check" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
                  </svg>
                </span>
              )}
              <span className="toast__message">{toast.message}</span>
              {toast.actionLabel && (
                <button
                  type="button"
                  className="toast__action"
                  onClick={() => {
                    setToast(null)
                    toast.onAction?.()
                  }}
                >
                  {toast.actionLabel}
                </button>
              )}
            </div>
          )}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside ToastProvider')
  return show
}
