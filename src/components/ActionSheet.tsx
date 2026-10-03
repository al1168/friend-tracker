import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
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
  useScrollLock(pending !== null)

  const show = useCallback<ShowActionSheet>(
    (options) =>
      new Promise((resolve) => {
        nextId.current += 1
        setPending({
          id: nextId.current,
          options: options as ActionSheetOptions<unknown>,
          resolve: resolve as (value: unknown) => void,
          closing: false,
        })
      }),
    [],
  )

  function finish(value: unknown) {
    if (!pending || pending.closing) return
    const { id } = pending
    pending.resolve(value)
    setPending({ ...pending, closing: true })
    window.setTimeout(() => setPending((current) => (current?.id === id ? null : current)), EXIT_MS)
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
            <div className="action-sheet" role="alertdialog" aria-modal="true" aria-label={options.title ?? 'Choose an option'}>
              <div className="action-sheet__group">
                {(options.title || options.message) && (
                  <div className="action-sheet__header">
                    {options.title && <p className="action-sheet__title">{options.title}</p>}
                    {options.message && <p className="action-sheet__message">{options.message}</p>}
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
                    {action.selected && <IconCheck size={20} />}
                  </button>
                ))}
              </div>
              <button type="button" className="action-sheet__button action-sheet__cancel" onClick={() => finish(null)}>
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
