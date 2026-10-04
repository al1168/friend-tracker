import { afterEach, describe, expect, it, vi } from 'vitest'
import { askToKeepData } from './persist'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubStorage(storage: Partial<StorageManager> | undefined) {
  vi.stubGlobal('navigator', { storage })
}

describe('askToKeepData', () => {
  it('asks to keep the data when it is not kept yet', async () => {
    const persist = vi.fn(async () => true)
    stubStorage({ persisted: async () => false, persist })
    await askToKeepData()
    expect(persist).toHaveBeenCalledOnce()
  })

  it('does not ask again once the data is kept', async () => {
    const persist = vi.fn(async () => true)
    stubStorage({ persisted: async () => true, persist })
    await askToKeepData()
    expect(persist).not.toHaveBeenCalled()
  })

  it('does nothing without the storage API, and never throws', async () => {
    stubStorage(undefined)
    await expect(askToKeepData()).resolves.toBeUndefined()
    stubStorage({
      persisted: async () => false,
      persist: async () => {
        throw new Error('Not allowed')
      },
    })
    await expect(askToKeepData()).resolves.toBeUndefined()
  })
})
