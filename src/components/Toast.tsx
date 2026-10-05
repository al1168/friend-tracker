import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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

  const show = useCallback((options: ToastOptions) => {
    nextId.current += 1
    setPaused(false)
    setToast({ ...options, id: nextId.current })
  }, [])

  useEffect(() => {
    if (!toast || paused) return
    const timer = window.setTimeout(() => setToast(null), toast.actionLabel ? TOAST_WITH_ACTION_MS : TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast, paused])

  // Publishes the shown toast's real height on <html> as --toast-space (0 with none), so the end of a page
  // scrolls clear of a toast that wraps taller than its one line (see .app in base.css). Set before paint.
  useLayoutEffect(() => {
    const root = document.documentElement
    const element = toastRef.current
    if (!element) {
      root.style.setProperty('--toast-space', '0px')
      return
    }
    const observer = new ResizeObserver(([entry]) => {
      root.style.setProperty('--toast-space', `${Math.ceil(entry.borderBoxSize[0].blockSize)}px`)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [toast])
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
