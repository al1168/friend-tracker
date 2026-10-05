import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Text saves this long after the last change. */
export const SAVE_PAUSE_MS = 600
/** After a failed write, the next try comes this much later (or with the next change, if sooner). */
export const RETRY_MS = 5000

export interface SaveStatus {
  /** The last write failed; the words are still waiting to save. */
  failed: boolean
  /** The record is gone (save resolved false): saving has stopped. */
  gone: boolean
}

export interface Autosave<T extends object> {
  /** Text changed: saves after a pause. */
  change(fields: Partial<T>): void
  /** A chip was tapped: saves right away. */
  changeNow(fields: Partial<T>): void
  /** Saves everything waiting now, and resolves once it is written or the write has failed. */
  flush(): Promise<void>
  /** Whether anything (or this field) changed and isn't written yet. */
  isUnsaved(field?: keyof T): boolean
  /** Drops what's waiting and stops saving ("Discard changes"). */
  discard(): void
}

/**
 * Saves a page's fields as they change, one write at a time, sending only the fields that changed. Changes made
 * while a write is out go in the next one, so an older value never lands after a newer one. A failed write keeps
 * its fields (under anything newer) and tries again every 5 seconds and with the next change. `save` resolves
 * false when the record is gone, which stops saving quietly.
 */
export function createAutosave<T extends object>(
  save: (fields: Partial<T>) => Promise<boolean>,
  onStatus: (status: SaveStatus) => void,
): Autosave<T> {
  let waiting: Partial<T> = {}
  let writing: Partial<T> | null = null
  let current: Promise<void> | null = null
  let writeAgain = false
  let pause: ReturnType<typeof setTimeout> | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let status: SaveStatus = { failed: false, gone: false }
  let stopped = false

  const hasWaiting = () => Object.keys(waiting).length > 0

  function report(next: SaveStatus) {
    if (next.failed === status.failed && next.gone === status.gone) return
    status = next
    onStatus(next)
  }

  function write(): Promise<void> {
    clearTimeout(pause)
    if (stopped) return Promise.resolve()
    if (current) {
      writeAgain = true
      return current
    }
    if (!hasWaiting()) return Promise.resolve()
    clearTimeout(retry)
    const fields = waiting
    waiting = {}
    writing = fields
    current = save(fields)
      .then(
        (found) => {
          if (found) {
            report({ failed: false, gone: false })
            return
          }
          stopped = true
          waiting = {}
          report({ failed: false, gone: true })
        },
        () => {
          waiting = { ...fields, ...waiting }
          report({ failed: true, gone: false })
          retry = setTimeout(() => void write(), RETRY_MS)
        },
      )
      .finally(() => {
        writing = null
        current = null
        if (writeAgain) {
          writeAgain = false
          void write()
        }
      })
    return current
  }

  return {
    change(fields) {
      if (stopped) return
      waiting = { ...waiting, ...fields }
      clearTimeout(pause)
      pause = setTimeout(() => void write(), SAVE_PAUSE_MS)
    },
    changeNow(fields) {
      if (stopped) return
      waiting = { ...waiting, ...fields }
      void write()
    },
    async flush() {
      clearTimeout(pause)
      while (current) await current
      if (stopped || !hasWaiting()) return
      await write()
      while (current) await current
    },
    isUnsaved(field) {
      if (field === undefined) return hasWaiting() || writing !== null
      return field in waiting || (writing !== null && field in writing)
    },
    discard() {
      stopped = true
      waiting = {}
      clearTimeout(pause)
      clearTimeout(retry)
    },
  }
}

/** What the page listens to for "the app is going away": the document and the window, or fakes in tests. */
export interface PageEvents {
  document: EventTarget & { visibilityState: DocumentVisibilityState }
  window: EventTarget
}

/** Calls `flush` when the app goes to the background (`visibilitychange` to hidden, and `pagehide`). Returns a stop. */
export function flushWhenHidden(page: PageEvents, flush: () => void): () => void {
  const onVisibilityChange = () => {
    if (page.document.visibilityState === 'hidden') flush()
  }
  page.document.addEventListener('visibilitychange', onVisibilityChange)
  page.window.addEventListener('pagehide', flush)
  return () => {
    page.document.removeEventListener('visibilitychange', onVisibilityChange)
    page.window.removeEventListener('pagehide', flush)
  }
}

/**
 * Saves a page's fields as you type (see createAutosave): everything waiting is saved when the app goes to the
 * background and when the page unmounts (the app lock included). `beforeHide` runs first, so text still in an
 * open field can join the save.
 */
export function useAutosave<T extends object>(
  save: (fields: Partial<T>) => Promise<boolean>,
  beforeHide?: () => void,
): { saver: Autosave<T>; status: SaveStatus } {
  const [status, setStatus] = useState<SaveStatus>({ failed: false, gone: false })
  const saveRef = useRef(save)
  const beforeHideRef = useRef(beforeHide)
  useLayoutEffect(() => {
    saveRef.current = save
    beforeHideRef.current = beforeHide
  })
  const [saver] = useState(() => createAutosave<T>((fields) => saveRef.current(fields), setStatus))

  useEffect(() => {
    const flush = () => {
      beforeHideRef.current?.()
      void saver.flush()
    }
    const stop = flushWhenHidden({ document, window }, flush)
    return () => {
      stop()
      flush()
    }
  }, [saver])

  return { saver, status }
}
