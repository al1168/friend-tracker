import Dexie from 'dexie'
import { describe, expect, it } from 'vitest'
import { isQuotaExceeded } from './errors'

describe('isQuotaExceeded', () => {
  const quota = () => new DOMException('The quota has been exceeded.', 'QuotaExceededError')

  it('knows the browser’s own error, and the old Firefox one', () => {
    expect(isQuotaExceeded(quota())).toBe(true)
    expect(isQuotaExceeded(new DOMException('Full', 'NS_ERROR_DOM_QUOTA_REACHED'))).toBe(true)
  })

  it('finds it however Dexie wraps it: mapped, aborted, or one of a bulk write’s failures', () => {
    expect(isQuotaExceeded(new Dexie.QuotaExceededError('Full', quota()))).toBe(true)
    expect(isQuotaExceeded(new Dexie.AbortError(quota()))).toBe(true)
    expect(isQuotaExceeded(new Dexie.BulkError('restoreUndo.bulkAdd(): 1 of 20 operations failed', { 3: quota() }))).toBe(
      true,
    )
    expect(isQuotaExceeded(new Error('Wrapped', { cause: new Dexie.AbortError(quota()) }))).toBe(true)
  })

  it('is false for anything else', () => {
    expect(isQuotaExceeded(new Dexie.ConstraintError('Key already exists'))).toBe(false)
    expect(isQuotaExceeded(new Dexie.AbortError())).toBe(false)
    expect(isQuotaExceeded(new Dexie.BulkError('1 failed', { 0: new DOMException('Exists', 'ConstraintError') }))).toBe(false)
    expect(isQuotaExceeded(new Error('QuotaExceededError'))).toBe(false)
    expect(isQuotaExceeded(null)).toBe(false)
    expect(isQuotaExceeded('QuotaExceededError')).toBe(false)
  })
})
