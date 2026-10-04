import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { meetupType } from '../test/fixtures'
import { resetDatabase } from '../db/db'
import { getSetting } from '../db/settings'
import type { BackupData } from './format'
import { exportBackup, shareBackupFile } from './exportBackup'

const data: BackupData = { friends: [], groups: [], meetupTypes: [meetupType('t1', 'Coffee', 0)], meetups: [], meetupPhotos: [] }

const click = vi.fn()
const share = vi.fn()
const canShare = vi.fn()

function domError(name: string) {
  return new DOMException('nope', name)
}

beforeEach(async () => {
  await resetDatabase()
  click.mockReset()
  share.mockReset().mockResolvedValue(undefined)
  canShare.mockReset().mockReturnValue(true)
  vi.stubGlobal('navigator', { canShare, share })
  // A download needs a page; count the clicks on the link instead.
  vi.stubGlobal('document', {
    createElement: () => ({ click, remove: vi.fn() }),
    body: { append: vi.fn() },
  })
  vi.stubGlobal('window', { setTimeout: vi.fn() })
  vi.stubGlobal('URL', { createObjectURL: () => 'blob:backup', revokeObjectURL: vi.fn() })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('exportBackup', () => {
  it('shares the file and marks the backup done', async () => {
    expect(await exportBackup(data)).toEqual({ outcome: 'shared' })
    expect(share).toHaveBeenCalledOnce()
    expect(await getSetting('lastBackupAt')).toEqual(expect.any(String))
  })

  it('is cancelled, and not marked done, when the share sheet is dismissed', async () => {
    share.mockRejectedValue(domError('AbortError'))
    expect(await exportBackup(data)).toEqual({ outcome: 'cancelled' })
    expect(await getSetting('lastBackupAt')).toBeNull()
  })

  it('downloads when files cannot be shared', async () => {
    canShare.mockReturnValue(false)
    expect(await exportBackup(data, true)).toEqual({ outcome: 'downloaded' })
    expect(share).not.toHaveBeenCalled()
    expect(click).toHaveBeenCalledOnce()
    expect(await getSetting('lastBackupAt')).toEqual(expect.any(String))
  })

  it('downloads on a TypeError, with or without an async read', async () => {
    share.mockRejectedValue(new TypeError('bad file'))
    expect(await exportBackup(data)).toEqual({ outcome: 'downloaded' })
    expect(await exportBackup(data, true)).toEqual({ outcome: 'downloaded' })
    expect(click).toHaveBeenCalledTimes(2)
  })

  it('downloads on NotAllowedError when nothing was read first (the file is refused)', async () => {
    share.mockRejectedValue(domError('NotAllowedError'))
    expect(await exportBackup(data)).toEqual({ outcome: 'downloaded' })
    expect(click).toHaveBeenCalledOnce()
  })

  it('asks for a new tap on NotAllowedError after an async read (the tap expired)', async () => {
    share.mockRejectedValue(domError('NotAllowedError'))
    const result = await exportBackup(data, true)
    expect(result.outcome).toBe('needs-tap')
    if (result.outcome !== 'needs-tap') throw new Error('unreachable')
    expect(result.file).toBeInstanceOf(File)
    expect(result.file.type).toBe('application/json')
    expect(click).not.toHaveBeenCalled()
    expect(await getSetting('lastBackupAt')).toBeNull()
  })

  it('rethrows other errors', async () => {
    share.mockRejectedValue(new Error('boom'))
    await expect(exportBackup(data, true)).rejects.toThrow('boom')
  })
})

describe('shareBackupFile', () => {
  const file = () => new File(['{}'], 'backup.json', { type: 'application/json' })

  it('shares the file and marks the backup done', async () => {
    expect(await shareBackupFile(file())).toEqual({ outcome: 'shared' })
    expect(share).toHaveBeenCalledOnce()
    expect(await getSetting('lastBackupAt')).toEqual(expect.any(String))
  })

  it('is cancelled, and not marked done, when the share sheet is dismissed', async () => {
    share.mockRejectedValue(domError('AbortError'))
    expect(await shareBackupFile(file())).toEqual({ outcome: 'cancelled' })
    expect(await getSetting('lastBackupAt')).toBeNull()
  })

  it('downloads when the share is refused even with a fresh tap', async () => {
    share.mockRejectedValue(domError('NotAllowedError'))
    expect(await shareBackupFile(file())).toEqual({ outcome: 'downloaded' })
    expect(click).toHaveBeenCalledOnce()
  })
})
