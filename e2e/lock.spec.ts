import { expect, test } from '@playwright/test'
import { addFriend, enterPin, lockHeading, reopenAfterAWhile, seedAppLock } from './helpers.ts'
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

test('the wait text goes away when the wait ends, without reloading', async ({ page }) => {
  await page.clock.install()
  await reopenAfterAWhile(page)
  for (let i = 0; i < 4; i += 1) {
    await enterPin(page, '000000')
    await expect(page.getByRole('alert')).toHaveText('Wrong PIN. Try again.')
  }
  await enterPin(page, '000000')
  await expect(page.getByRole('timer')).toBeVisible()

  await page.clock.fastForward(31_000)
  await expect(page.getByRole('timer')).toHaveCount(0)
  await expect(page.locator('.pin-message')).toHaveText('')
  await expect(page.getByRole('button', { name: '1', exact: true })).toBeEnabled()
})

test('locks after 20 minutes even if no visibility event ever fired', async ({ page }) => {
  await page.clock.install()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  await page.clock.fastForward(20 * 60_000)
  await expect(lockHeading(page)).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
})

test('relocking with a sheet open closes it, and the app works after unlocking', async ({ page }) => {
  await addFriend(page, 'Alex Rivera')
  await page.clock.install()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  await page.getByRole('button', { name: 'Log meetup' }).click()
  await expect(page.getByRole('dialog', { name: 'Log meetup' })).toBeVisible()
  await page.clock.fastForward(20 * 60_000)
  await expect(lockHeading(page)).toBeVisible()
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await expect(page.locator('html')).not.toHaveClass(/scroll-locked/)

  await enterPin(page, PIN)
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  await expect(page.locator('html')).not.toHaveClass(/scroll-locked/)
  await page.getByRole('button', { name: 'Log meetup' }).click()
  await expect(page.getByRole('dialog', { name: 'Log meetup' })).toBeVisible()
})

test('a cancelled Face ID says so and stays locked', async ({ page }) => {
  await seedAppLock(page, PIN, 'AAAAAAAAAAAAAAAAAAAAAA')
  await page.addInitScript(() => {
    // The user cancels the Face ID prompt.
    const credentials = { get: () => Promise.reject(new DOMException('Cancelled', 'NotAllowedError')) }
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: credentials })
  })
  await reopenAfterAWhile(page)
  await expect(lockHeading(page)).toBeFocused()
  await page.getByRole('button', { name: 'Unlock with Face ID' }).click()
  await expect(page.getByRole('alert')).toHaveText("Face ID didn't work. Use your PIN.")
  await expect(lockHeading(page)).toBeVisible()
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
