import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosave, flushWhenHidden, handOver, type SaveStatus } from './useAutosave'

interface Day {
  note: string
  mood: string | null
}

/** A save that waits until the test settles it, like a slow IndexedDB write. */
function deferredSave() {
  const calls: { fields: Partial<Day>; settle: (result: boolean | Error) => void }[] = []
  const save = vi.fn(
    (fields: Partial<Day>) =>
      new Promise<boolean>((resolve, reject) => {
        calls.push({ fields, settle: (result) => (result instanceof Error ? reject(result) : resolve(result)) })
      }),
  )
  return { save, calls }
}

function setup(save: (fields: Partial<Day>) => Promise<boolean>) {
  const statuses: SaveStatus[] = []
  const saver = createAutosave<Day>(save, (status) => statuses.push(status))
  return { saver, statuses }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createAutosave', () => {
  it('saves text 600ms after the last change, and not before', async () => {
    const save = vi.fn(async () => true)
    const { saver } = setup(save)
    saver.change({ note: 'T' })
    await vi.advanceTimersByTimeAsync(400)
    saver.change({ note: 'Ta' })
    await vi.advanceTimersByTimeAsync(599)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledExactlyOnceWith({ note: 'Ta' })
    expect(saver.isUnsaved()).toBe(false)
  })

  it('saves a chip tap at once, with any text waiting', async () => {
    const save = vi.fn(async () => true)
    const { saver } = setup(save)
    saver.change({ note: 'Tacos' })
    saver.changeNow({ mood: 'okay' })
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledExactlyOnceWith({ note: 'Tacos', mood: 'okay' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('saves everything waiting on flush (blur, the background, Back and unmount)', async () => {
    const save = vi.fn(async () => true)
    const { saver } = setup(save)
    saver.change({ note: 'Tacos' })
    expect(saver.isUnsaved('note')).toBe(true)
    await saver.flush()
    expect(save).toHaveBeenCalledExactlyOnceWith({ note: 'Tacos' })
    expect(saver.isUnsaved()).toBe(false)
    await saver.flush()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('writes one at a time, and the latest value wins', async () => {
    const { save, calls } = deferredSave()
    const { saver } = setup(save)
    saver.changeNow({ note: 'A' })
    saver.change({ note: 'AB' })
    saver.changeNow({ note: 'ABC' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toHaveLength(1)
    expect(saver.isUnsaved('note')).toBe(true)

    calls[0].settle(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.map((call) => call.fields)).toEqual([{ note: 'A' }, { note: 'ABC' }])
    calls[1].settle(true)
    const flushed = saver.flush()
    await vi.advanceTimersByTimeAsync(0)
    await flushed
    expect(calls).toHaveLength(2)
    expect(saver.isUnsaved()).toBe(false)
  })

  it('waits for a write in flight before flushing what came after it', async () => {
    const { save, calls } = deferredSave()
    const { saver } = setup(save)
    saver.changeNow({ note: 'A' })
    saver.change({ note: 'AB' })
    const flushed = saver.flush()
    calls[0].settle(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.map((call) => call.fields)).toEqual([{ note: 'A' }, { note: 'AB' }])
    calls[1].settle(true)
    await flushed
    expect(saver.isUnsaved()).toBe(false)
  })

  it('on a failure, keeps the words, retries every 5 seconds and with the next change, and clears on success', async () => {
    const { save, calls } = deferredSave()
    const { saver, statuses } = setup(save)
    saver.changeNow({ note: 'Tacos' })
    calls[0].settle(new Error('QuotaExceededError'))
    await vi.advanceTimersByTimeAsync(0)
    expect(statuses).toEqual([{ failed: true, gone: false }])
    expect(saver.isUnsaved('note')).toBe(true)

    await vi.advanceTimersByTimeAsync(4999)
    expect(calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls[1].fields).toEqual({ note: 'Tacos' })
    calls[1].settle(new Error('QuotaExceededError'))
    await vi.advanceTimersByTimeAsync(0)

    // The next change tries again after its pause, with the newest words.
    saver.change({ note: 'Tacos and karaoke' })
    await vi.advanceTimersByTimeAsync(600)
    expect(calls[2].fields).toEqual({ note: 'Tacos and karaoke' })
    calls[2].settle(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(statuses.at(-1)).toEqual({ failed: false, gone: false })
    expect(saver.isUnsaved()).toBe(false)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toHaveLength(3)
  })

  it('stops quietly when the record is gone', async () => {
    const save = vi.fn(async () => false)
    const { saver, statuses } = setup(save)
    saver.changeNow({ note: 'Tacos' })
    await vi.advanceTimersByTimeAsync(0)
    expect(statuses).toEqual([{ failed: false, gone: true }])
    saver.change({ note: 'More' })
    saver.changeNow({ mood: 'okay' })
    await saver.flush()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(saver.isUnsaved()).toBe(false)
  })

  it('drops what is waiting on discard, and saves nothing more', async () => {
    const save = vi.fn(async () => true)
    const { saver } = setup(save)
    saver.change({ note: 'Tacos' })
    saver.discard()
    await saver.flush()
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
    expect(saver.isUnsaved()).toBe(false)
  })
})

describe('takeOver', () => {
  it('hands over everything unsaved, waiting or in flight, and stops saving', async () => {
    const { save, calls } = deferredSave()
    const { saver } = setup(save)
    saver.changeNow({ note: 'Tacos' })
    saver.change({ mood: 'okay' })
    expect(saver.takeOver()).toEqual({ note: 'Tacos', mood: 'okay' })
    expect(saver.isUnsaved()).toBe(false)

    // The write in flight fails: nothing is retried, and nothing more is written.
    calls[0].settle(new Error('QuotaExceededError'))
    saver.change({ note: 'Later' })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toHaveLength(1)
    expect(saver.takeOver()).toEqual({})
  })
})

describe('handOver', () => {
  it('stops the saver before it for the same record, and passes on what it never saved', async () => {
    const savers = new Map()
    const { save: oldSave, calls: oldCalls } = deferredSave()
    const old = setup(oldSave).saver
    expect(handOver('m1', old, savers)).toEqual({})
    // The page unmounts (the app lock) while the last write fails: the old saver keeps retrying.
    old.changeNow({ note: 'Typed before the lock' })
    oldCalls[0].settle(new Error('UnknownError'))
    await vi.advanceTimersByTimeAsync(0)

    const next = setup(vi.fn(async () => true)).saver
    expect(handOver('m1', next, savers)).toEqual({ note: 'Typed before the lock' })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(oldCalls).toHaveLength(1)

    // Another record, or the same saver again (a remounted effect), takes nothing.
    expect(handOver('m2', setup(vi.fn(async () => true)).saver, savers)).toEqual({})
    expect(handOver('m1', next, savers)).toEqual({})
  })
})

describe('flushWhenHidden', () => {
  it('flushes when the app goes to the background or the page is hidden, until stopped', () => {
    const document = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState })
    const window = new EventTarget()
    const flush = vi.fn()
    const stop = flushWhenHidden({ document, window }, flush)

    document.dispatchEvent(new Event('visibilitychange'))
    expect(flush).not.toHaveBeenCalled()
    document.visibilityState = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(flush).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('pagehide'))
    expect(flush).toHaveBeenCalledTimes(2)

    stop()
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pagehide'))
    expect(flush).toHaveBeenCalledTimes(2)
  })
})
