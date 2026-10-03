import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useScrollLock } from '../hooks/useScrollLock'
import { IconCheck } from './icons'
import './ActionSheet.css'

export interface ActionSheetAction<T> {
  label: string
  value: T
  destructive?: boolean
  selected?: boolean
}

export interface ActionSheetOptions<T> {
  title?: string
  message?: string
  actions: ActionSheetAction<T>[]
}

type ShowActionSheet = <T>(options: ActionSheetOptions<T>) => Promise<T | null>

interface Pending {
  id: number
  options: ActionSheetOptions<unknown>
  resolve: (value: unknown) => void
  closing: boolean
}

const EXIT_MS = 200
const ActionSheetContext = createContext<ShowActionSheet | null>(null)

export function ActionSheetProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const nextId = useRef(0)
  const pendingRef = useRef<Pending | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const messageId = useId()
  useScrollLock(pending !== null)

  const pendingId = pending?.id
  useEffect(() => {
    if (pendingId === undefined) return
    cancelRef.current?.focus({ preventScroll: true })
  }, [pendingId])

  const show = useCallback<ShowActionSheet>(
    (options) =>
      new Promise((resolve) => {
        const current = pendingRef.current
        if (current && !current.closing) {
          current.resolve(null)
        } else {
          returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        }
        nextId.current += 1
        const next: Pending = {
          id: nextId.current,
          options: options as ActionSheetOptions<unknown>,
          resolve: resolve as (value: unknown) => void,
          closing: false,
        }
        pendingRef.current = next
        setPending(next)
      }),
    [],
  )

  function finish(value: unknown) {
    if (!pending || pending.closing) return
    const { id } = pending
    returnFocus.current?.focus({ preventScroll: true })
    returnFocus.current = null
    pending.resolve(value)
    const closing = { ...pending, closing: true }
    pendingRef.current = closing
    setPending(closing)
    window.setTimeout(() => {
      if (pendingRef.current?.id === id) pendingRef.current = null
      setPending((current) => (current?.id === id ? null : current))
    }, EXIT_MS)
  }

  const options = pending?.options
  return (
    <ActionSheetContext.Provider value={show}>
      {children}
      {pending &&
        options &&
        createPortal(
          <div className={pending.closing ? 'action-layer action-layer--closing' : 'action-layer'}>
            <div className="action-scrim" onClick={() => finish(null)} />
            <div className="action-sheet" role={options.actions.some((a) => a.destructive) ? 'alertdialog' : 'dialog'}
              aria-modal="true"
              aria-label={options.title ?? 'Choose an option'}
              aria-describedby={options.message ? messageId : undefined}
            >
              <div className="action-sheet__group">
                {(options.title || options.message) && (
                  <div className="action-sheet__header">
                    {options.title && <p className="action-sheet__title">{options.title}</p>}
                    {options.message && <p id={messageId} className="action-sheet__message">{options.message}</p>}
                  </div>
                )}
                {options.actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className={action.destructive ? 'action-sheet__button action-sheet__button--destructive' : 'action-sheet__button'}
                    onClick={() => finish(action.value)}
                  >
                    {action.label}
                    {action.selected && (
                      <>
                        <span className="visually-hidden">, selected</span>
                        <IconCheck size={20} />
                      </>
                    )}
                  </button>
                ))}
              </div>
              <button ref={cancelRef} type="button" className="action-sheet__button action-sheet__cancel" onClick={() => finish(null)}>
                Cancel
              </button>
            </div>
          </div>,
          document.body,
        )}
    </ActionSheetContext.Provider>
  )
}

export function useActionSheet(): ShowActionSheet {
  const show = useContext(ActionSheetContext)
  if (!show) throw new Error('useActionSheet must be used inside ActionSheetProvider')
  return show
}

interface ConfirmOptions {
  title?: string
  message?: string
  confirmLabel: string
  destructive?: boolean
}

/** Resolves to true when the user taps the confirm button. */
export function useConfirm() {
  const show = useActionSheet()
  return useCallback(
    async ({ title, message, confirmLabel, destructive }: ConfirmOptions) =>
      (await show({ title, message, actions: [{ label: confirmLabel, value: true, destructive }] })) === true,
    [show],
  )
}

/** For sheets: resolves to true when it's fine to close (nothing changed, or the user chose to discard). */
export function useConfirmDiscard() {
  const confirm = useConfirm()
  return useCallback(
    async (dirty: boolean) =>
      !dirty || confirm({ title: 'Discard changes?', confirmLabel: 'Discard changes', destructive: true }),
    [confirm],
  )
}
