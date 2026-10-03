import { expect, test } from '@playwright/test'
import { enterPin, lockHeading, reopenAfterAWhile, seedAppLock } from './helpers.ts'

// PIN hashing and many taps make these tests slower than most.
test.describe.configure({ timeout: 60_000 })

const PIN = '135790'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await seedAppLock(page, PIN)
})

test('locks when reopened after 15 minutes, and the PIN unlocks it', async ({ page }) => {
  await reopenAfterAWhile(page)
  await expect(lockHeading(page)).toBeVisible()
  // The lock screen replaces the app: no tab bar, no friends list behind it.
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toHaveCount(0)
  await expect(page).toHaveTitle('Friend Tracker')

  await enterPin(page, PIN)
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  await expect(lockHeading(page)).toHaveCount(0)
})

test('stays open when reopened within 15 minutes', async ({ page }) => {
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  await expect(lockHeading(page)).toHaveCount(0)
})

test('a wrong PIN clears the dots and says so', async ({ page }) => {
  await reopenAfterAWhile(page)
  await enterPin(page, '000000')
  await expect(page.getByRole('alert')).toHaveText('Wrong PIN. Try again.')
  await expect(page.getByRole('img', { name: 'Enter your PIN, 0 of 6 digits entered' })).toBeVisible()

  await enterPin(page, '13')
  await expect(page.getByRole('img', { name: 'Enter your PIN, 2 of 6 digits entered' })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveText('')
  await page.getByRole('button', { name: 'Delete' }).click()
  await enterPin(page, PIN.slice(1))
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})

test('waits after 5 wrong PINs, even after reopening, then lets you try again', async ({ page }) => {
  await page.clock.install()
  await reopenAfterAWhile(page)
  for (let i = 0; i < 4; i += 1) {
    await enterPin(page, '000000')
    await expect(page.getByRole('alert')).toHaveText('Wrong PIN. Try again.')
  }
  await enterPin(page, '000000')
  await expect(page.getByRole('timer')).toHaveText(/^Try again in 0:(30|29)$/)
  await expect(page.getByRole('button', { name: '1', exact: true })).toBeDisabled()

  await page.reload()
  await expect(lockHeading(page)).toBeVisible()
  await expect(page.getByRole('timer')).toHaveText(/^Try again in 0:[0-3]\d$/)
  await expect(page.getByRole('button', { name: '1', exact: true })).toBeDisabled()

  await page.clock.fastForward(31_000)
  await expect(page.getByRole('timer')).toHaveCount(0)
  await enterPin(page, PIN)
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})

test('locks again after 15 minutes in the background', async ({ page }) => {
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  // Simulate the app being hidden, 16 minutes passing, and the app coming back.
  await page.evaluate(() => {
    const setVisibility = (state: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    setVisibility('hidden')
    localStorage.setItem('ft:lastActiveAt', String(Date.now() - 16 * 60_000))
    setVisibility('visible')
  })
  await expect(lockHeading(page)).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
})
