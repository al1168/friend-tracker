import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

/** A sessionStorage that keeps what it's given in a Map. */
function fakeStorage() {
  const items = new Map<string, string>()
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    items,
  }
}

describe('the Logged note’s Undo', () => {
  it('is offered until a change spends it, for that meetup only', async () => {
    const { loggedUndoSpent, spendLoggedUndo } = await import('./loggedUndo')
    expect(loggedUndoSpent('m1')).toBe(false)
    spendLoggedUndo('m1')
    expect(loggedUndoSpent('m1')).toBe(true)
    expect(loggedUndoSpent('m2')).toBe(false)
  })

  it('stays spent after a reload, through sessionStorage', async () => {
    const storage = fakeStorage()
    vi.stubGlobal('sessionStorage', storage)
    const first = await import('./loggedUndo')
    first.spendLoggedUndo('m1')
    expect(JSON.parse(storage.items.get('friend-tracker:logged-undo-spent') ?? '[]')).toEqual(['m1'])

    // A reload empties memory: a fresh copy of the module reads what was stored.
    vi.resetModules()
    const reloaded = await import('./loggedUndo')
    expect(reloaded.loggedUndoSpent('m1')).toBe(true)
    expect(reloaded.loggedUndoSpent('m2')).toBe(false)
  })

  it('keeps working in memory when sessionStorage throws', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    })
    const { loggedUndoSpent, spendLoggedUndo } = await import('./loggedUndo')
    spendLoggedUndo('m1')
    expect(loggedUndoSpent('m1')).toBe(true)
  })
})
