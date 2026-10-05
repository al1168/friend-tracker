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
  /**
   * Stops saving and returns everything not yet written (waiting, or in a write still out), for the saver
   * taking over from this one (see handOver).
   */
  takeOver(): Partial<T>
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
          // Stopped meanwhile (discarded, or taken over): these fields are someone else's now, or dropped.
          if (stopped) return
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

  function stop() {
    stopped = true
    waiting = {}
    clearTimeout(pause)
    clearTimeout(retry)
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
      if (stopped) return false
      if (field === undefined) return hasWaiting() || writing !== null
      return field in waiting || (writing !== null && field in writing)
    },
    discard: stop,
    takeOver() {
      const unsaved = stopped ? {} : { ...writing, ...waiting }
      stop()
      return unsaved
    },
  }
}

/** The saver for each record, so the next one for the same record can take over from it. */
const saversByKey = new Map<string, Autosave<object>>()

/**
 * Makes `saver` the one saving the record `key`. A saver before it for the same record (its page unmounted, as on
 * the app lock, while a write was still failing and being retried) stops, so its older words can never land after
 * newer ones, and what it never saved is returned for the new page to keep and save. Returns {} otherwise.
 */
export function handOver<T extends object>(
  key: string,
  saver: Autosave<T>,
  registry: Map<string, Autosave<object>> = saversByKey,
): Partial<T> {
  const before = registry.get(key)
  registry.set(key, saver)
  return before && before !== saver ? (before.takeOver() as Partial<T>) : {}
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

export interface AutosaveOptions<T> {
  /** Runs before the save for the app going away or the page unmounting, so text still in an open field can join it. */
  beforeHide?: () => void
  /** The record saved, so a saver left over for it can hand over (see handOver). */
  key?: string
  /** Gets the fields a saver left over for this record never saved; the page should take them in and save them. */
  onTakeOver?: (fields: Partial<T>) => void
}

/**
 * Saves a page's fields as you type (see createAutosave): everything waiting is saved when the app goes to the
 * background and when the page unmounts (the app lock included). `beforeHide` runs first, so text still in an
 * open field can join the save. With a `key`, a saver left over for the same record hands over to this one.
 */
export function useAutosave<T extends object>(
  save: (fields: Partial<T>) => Promise<boolean>,
  { beforeHide, key, onTakeOver }: AutosaveOptions<T> = {},
): { saver: Autosave<T>; status: SaveStatus } {
  const [status, setStatus] = useState<SaveStatus>({ failed: false, gone: false })
  const saveRef = useRef(save)
  const beforeHideRef = useRef(beforeHide)
  const onTakeOverRef = useRef(onTakeOver)
  useLayoutEffect(() => {
    saveRef.current = save
    beforeHideRef.current = beforeHide
    onTakeOverRef.current = onTakeOver
  })
  const [saver] = useState(() => createAutosave<T>((fields) => saveRef.current(fields), setStatus))

  useEffect(() => {
    if (key !== undefined) {
      const unsaved = handOver(key, saver)
      if (Object.keys(unsaved).length > 0) onTakeOverRef.current?.(unsaved)
    }
  }, [key, saver])

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
