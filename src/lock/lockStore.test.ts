import { beforeEach, describe, expect, it } from 'vitest'
import { readAllData, replaceAllData } from '../backup/storage'
import { resetDatabase } from '../db/db'
import { getSetting, setSetting } from '../db/settings'
import { changePin, checkPin, normalizeFailures, resetFailures, setPasskey, turnOffLock, turnOnLock } from './lockStore'
import { LOCK_OFF, NO_FAILURES } from './types'

const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)

beforeEach(resetDatabase)

async function failTimes(times: number, now = NOW) {
  for (let i = 0; i < times; i += 1) await checkPin('000000', now)
}

describe('lock store', () => {
  it('is off by default', async () => {
    expect(await getSetting('appLock')).toEqual(LOCK_OFF)
    expect(await getSetting('appLockFailures')).toEqual(NO_FAILURES)
  })

  it('turns on with a hashed PIN', async () => {
    await turnOnLock('123456')
    const lock = await getSetting('appLock')
    expect(lock).toMatchObject({ enabled: true, passkeyId: null })
    expect(JSON.stringify(lock)).not.toContain('123456')
    expect(await checkPin('123456', NOW)).toEqual({ result: 'ok' })
  })

  it('counts wrong PINs and resets the count on a right one', async () => {
    await turnOnLock('123456')
    expect(await checkPin('000000', NOW)).toEqual({ result: 'wrong', failures: { count: 1, lockedUntil: null } })
    expect(await getSetting('appLockFailures')).toEqual({ count: 1, lockedUntil: null })
    expect(await checkPin('123456', NOW)).toEqual({ result: 'ok' })
    expect(await getSetting('appLockFailures')).toEqual(NO_FAILURES)
  })

  it('pauses after the 5th wrong PIN without checking during the wait', async () => {
    await turnOnLock('123456')
    await failTimes(4)
    const fifth = await checkPin('000000', NOW)
    expect(fifth).toEqual({ result: 'wait', failures: { count: 5, lockedUntil: NOW + 30_000 } })
    expect(await checkPin('123456', NOW + 29_000)).toEqual(fifth)
    expect(await checkPin('123456', NOW + 30_000)).toEqual({ result: 'ok' })
  })

  it('changes the PIN and keeps Face ID', async () => {
    await turnOnLock('123456')
    await setPasskey('cred-1')
    await failTimes(2)
    await changePin('654321')
    expect(await getSetting('appLockFailures')).toEqual(NO_FAILURES)
    expect((await getSetting('appLock')).passkeyId).toBe('cred-1')
    expect((await checkPin('123456', NOW)).result).toBe('wrong')
    expect(await checkPin('654321', NOW)).toEqual({ result: 'ok' })
  })

  it('sets and clears Face ID, resets failures, and turns off', async () => {
    await turnOnLock('123456')
    await setPasskey('cred-1')
    expect((await getSetting('appLock')).passkeyId).toBe('cred-1')
    await setPasskey(null)
    expect((await getSetting('appLock')).passkeyId).toBeNull()
    await failTimes(3)
    await resetFailures()
    expect(await getSetting('appLockFailures')).toEqual(NO_FAILURES)
    await failTimes(1)
    await turnOffLock()
    expect(await getSetting('appLock')).toEqual(LOCK_OFF)
    expect(await getSetting('appLockFailures')).toEqual(NO_FAILURES)
  })

  it('cuts back a wait that is longer than the failure count allows', async () => {
    await turnOnLock('123456')
    await setSetting('appLockFailures', { count: 5, lockedUntil: NOW + 10 * 60_000 })
    const result = await checkPin('123456', NOW)
    expect(result).toEqual({ result: 'wait', failures: { count: 5, lockedUntil: NOW + 30_000 } })
    expect(await getSetting('appLockFailures')).toEqual({ count: 5, lockedUntil: NOW + 30_000 })
    expect(await checkPin('123456', NOW + 30_000)).toEqual({ result: 'ok' })
  })

  it('normalizeFailures cuts back a too-long wait and saves it', async () => {
    await setSetting('appLockFailures', { count: 5, lockedUntil: NOW + 10 * 60_000 })
    expect(await normalizeFailures(NOW)).toEqual({ count: 5, lockedUntil: NOW + 30_000 })
    expect(await getSetting('appLockFailures')).toEqual({ count: 5, lockedUntil: NOW + 30_000 })
  })

  it('normalizeFailures leaves a valid wait, an expired wait and no failures alone', async () => {
    await setSetting('appLockFailures', { count: 5, lockedUntil: NOW + 30_000 })
    expect(await normalizeFailures(NOW)).toEqual({ count: 5, lockedUntil: NOW + 30_000 })
    expect(await normalizeFailures(NOW + 40_000)).toEqual({ count: 5, lockedUntil: NOW + 30_000 })
    await setSetting('appLockFailures', NO_FAILURES)
    expect(await normalizeFailures(NOW)).toEqual(NO_FAILURES)
    expect(await getSetting('appLockFailures')).toEqual(NO_FAILURES)
  })

  it('rejects without counting a wrong PIN when the stored iteration count is unreadable', async () => {
    await turnOnLock('123456')
    const lock = await getSetting('appLock')
    await setSetting('appLock', { ...lock, pin: { ...lock.pin!, iterations: 1.5 } })
    await expect(checkPin('123456', NOW)).rejects.toThrow()
    expect(await getSetting('appLockFailures')).toEqual(NO_FAILURES)
  })

  it('rejects without counting a failure when the stored hash is damaged', async () => {
    await setSetting('appLock', { enabled: true, pin: { hash: '!!!', salt: '!!!', iterations: 210_000 }, passkeyId: null })
    await expect(checkPin('123456', NOW)).rejects.toThrow()
    expect(await getSetting('appLockFailures')).toEqual(NO_FAILURES)
  })

  it('never passes when no PIN is stored', async () => {
    await setSetting('appLock', { enabled: true, pin: null, passkeyId: null })
    expect((await checkPin('123456', NOW)).result).toBe('wrong')
  })

  it('keeps the shared defaults frozen', () => {
    expect(Object.isFrozen(LOCK_OFF)).toBe(true)
    expect(Object.isFrozen(NO_FAILURES)).toBe(true)
  })

  it('is never part of a backup and survives a restore', async () => {
    await turnOnLock('123456')
    const data = await readAllData()
    expect(Object.keys(data).sort()).toEqual(['friends', 'groups', 'meetupPhotos', 'meetupTypes', 'meetups'])
    expect(JSON.stringify(data)).not.toContain('appLock')
    await replaceAllData(data)
    expect((await getSetting('appLock')).enabled).toBe(true)
  })
})
