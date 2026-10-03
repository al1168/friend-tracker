import { expect, test } from '@playwright/test'
import {
  enterPin,
  fakePasskey,
  FAKE_PASSKEY_ID,
  lockHeading,
  readSetting,
  reopenAfterAWhile,
  seedAppLock,
  stubFaceId,
  turnOnAppLock,
} from './helpers.ts'

// PIN hashing and many taps make these tests slower than most.
test.describe.configure({ timeout: 60_000 })

test('turns on app lock with a PIN', async ({ page }) => {
  await stubFaceId(page, false)
  await page.goto('/#/settings')
  await expect(page.getByText('Locks the app after 15 minutes away. Unlock with your PIN.')).toBeVisible()

  await turnOnAppLock(page, '111111')
  await expect(page.getByRole('status')).toContainText('App lock is on')
  await expect(page.getByRole('button', { name: 'Turn off app lock' })).toBeVisible()
  await expect(page.getByRole('switch', { name: 'Face ID' })).toHaveCount(0)
  // The button that opened the sheet is gone, so focus lands on the group's heading.
  await expect(page.getByRole('heading', { level: 2, name: 'App lock' })).toBeFocused()

  await reopenAfterAWhile(page)
  await expect(lockHeading(page)).toBeVisible()
  await enterPin(page, '111111')
  // Unlocking returns to the same screen.
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
})

test('asks again when the two PINs differ', async ({ page }) => {
  await stubFaceId(page, false)
  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Turn on app lock' }).click()
  const sheet = page.getByRole('dialog', { name: 'Turn on app lock' })
  await enterPin(sheet, '111111')
  await enterPin(sheet, '222222')
  await expect(sheet.getByRole('alert')).toHaveText("Those PINs didn't match. Try again.")
  await expect(sheet.getByText('Choose a 6-digit PIN')).toBeVisible()
  // Each step's prompt takes focus, so VoiceOver reads it.
  await expect(sheet.getByText('Choose a 6-digit PIN')).toBeFocused()

  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('button', { name: 'Turn on app lock' })).toBeVisible()
})

test('offers Face ID when the iPhone has it, and Not now keeps the PIN', async ({ page }) => {
  await stubFaceId(page, true)
  await page.goto('/#/settings')
  await expect(
    page.getByText('Locks the app after 15 minutes away. Unlock with your PIN, Face ID or your iPhone passcode.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Turn on app lock' }).click()
  const sheet = page.getByRole('dialog', { name: 'Turn on app lock' })
  await enterPin(sheet, '111111')
  await enterPin(sheet, '111111')
  await expect(sheet.getByText('Use Face ID or your iPhone passcode to unlock?')).toBeFocused()
  await sheet.getByRole('button', { name: 'Not now' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('App lock is on')
  await expect(page.getByRole('switch', { name: 'Face ID' })).toHaveAttribute('aria-checked', 'false')
})

test('cancelling at the Face ID question keeps the lock on', async ({ page }) => {
  await stubFaceId(page, true)
  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Turn on app lock' }).click()
  const sheet = page.getByRole('dialog', { name: 'Turn on app lock' })
  await enterPin(sheet, '111111')
  await enterPin(sheet, '111111')
  await expect(sheet.getByText('Use Face ID or your iPhone passcode to unlock?')).toBeVisible()
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('button', { name: 'Turn off app lock' })).toBeVisible()
  expect(await readSetting(page, 'appLock')).toMatchObject({ enabled: true, passkeyId: null })
})

test('turning on the lock with Face ID saves the passkey', async ({ page }) => {
  await fakePasskey(page)
  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Turn on app lock' }).click()
  const sheet = page.getByRole('dialog', { name: 'Turn on app lock' })
  await enterPin(sheet, '111111')
  await enterPin(sheet, '111111')
  await sheet.getByRole('button', { name: 'Use Face ID' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('App lock is on')
  await expect(page.getByRole('switch', { name: 'Face ID' })).toHaveAttribute('aria-checked', 'true')
  expect(await readSetting(page, 'appLock')).toMatchObject({ enabled: true, passkeyId: FAKE_PASSKEY_ID })
})

test('turning Face ID on needs the PIN', async ({ page }) => {
  await fakePasskey(page)
  await page.goto('/#/settings')
  await seedAppLock(page, '111111')
  await page.reload()
  const faceId = page.getByRole('switch', { name: 'Face ID' })
  await expect(faceId).toHaveAttribute('aria-checked', 'false')
  await faceId.click()
  const sheet = page.getByRole('dialog', { name: 'Turn on Face ID' })
  await expect(sheet.getByText('Enter your PIN')).toBeVisible()
  await enterPin(sheet, '999999')
  await expect(sheet.getByRole('alert')).toHaveText('Wrong PIN. Try again.')
  await enterPin(sheet, '111111')
  await expect(sheet.getByText('Use Face ID or your iPhone passcode to unlock?')).toBeFocused()
  await sheet.getByRole('button', { name: 'Use Face ID' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('Face ID is on')
  await expect(faceId).toHaveAttribute('aria-checked', 'true')
  expect(await readSetting(page, 'appLock')).toMatchObject({ passkeyId: FAKE_PASSKEY_ID })
})

test('Face ID that cannot be set up says so', async ({ page }) => {
  await stubFaceId(page, true)
  await page.addInitScript(() => {
    const credentials = { create: () => Promise.reject(new DOMException('Cancelled', 'NotAllowedError')) }
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: credentials })
  })
  await page.goto('/#/settings')
  await seedAppLock(page, '111111')
  await page.reload()
  await page.getByRole('switch', { name: 'Face ID' }).click()
  const sheet = page.getByRole('dialog', { name: 'Turn on Face ID' })
  await enterPin(sheet, '111111')
  await sheet.getByRole('button', { name: 'Use Face ID' }).click()
  await expect(sheet.getByRole('alert')).toHaveText("Face ID couldn't be set up. Try again, or tap Not now.")
  await sheet.getByRole('button', { name: 'Not now' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText("Face ID wasn't turned on.")
  await expect(page.getByRole('switch', { name: 'Face ID' })).toHaveAttribute('aria-checked', 'false')
})

test('turning Face ID off is one tap', async ({ page }) => {
  await stubFaceId(page, true)
  await page.goto('/#/settings')
  await seedAppLock(page, '111111', FAKE_PASSKEY_ID)
  await page.reload()
  const faceId = page.getByRole('switch', { name: 'Face ID' })
  await expect(faceId).toHaveAttribute('aria-checked', 'true')
  await faceId.click()
  await expect(faceId).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByRole('status')).toContainText('Face ID is off')
  expect(await readSetting(page, 'appLock')).toMatchObject({ enabled: true, passkeyId: null })
})

test('a double tap on the Face ID switch only turns it off', async ({ page }) => {
  await stubFaceId(page, true)
  await page.goto('/#/settings')
  await seedAppLock(page, '111111', FAKE_PASSKEY_ID)
  await page.reload()
  const faceId = page.getByRole('switch', { name: 'Face ID' })
  await expect(faceId).toHaveAttribute('aria-checked', 'true')
  // A real double tap: the second tap lands about 100 ms after the first.
  await faceId.evaluate(async (element) => {
    const button = element as HTMLElement
    button.click()
    await new Promise((resolve) => setTimeout(resolve, 100))
    button.click()
  })
  await expect(faceId).toHaveAttribute('aria-checked', 'false')
  await page.waitForTimeout(600)
  await expect(page.locator('[role=dialog]')).toHaveCount(0)
  await expect(faceId).toHaveAttribute('aria-checked', 'false')
})

test('changes the PIN', async ({ page }) => {
  await stubFaceId(page, false)
  await page.goto('/#/settings')
  await seedAppLock(page, '111111')
  await page.reload()
  await page.getByRole('button', { name: 'Change PIN' }).click()
  const sheet = page.getByRole('dialog', { name: 'Change PIN' })
  await expect(sheet.getByText('Enter your current PIN')).toBeVisible()
  await enterPin(sheet, '999999')
  await expect(sheet.getByRole('alert')).toHaveText('Wrong PIN. Try again.')
  await enterPin(sheet, '111111')
  await expect(sheet.getByText('Choose a 6-digit PIN')).toBeVisible()
  await enterPin(sheet, '222222')
  await expect(sheet.getByText('Enter it again')).toBeVisible()
  await enterPin(sheet, '222222')
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('PIN changed')

  await reopenAfterAWhile(page)
  await enterPin(page, '111111')
  await expect(page.getByRole('alert')).toHaveText('Wrong PIN. Try again.')
  await enterPin(page, '222222')
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
})

test('turns the lock off with the PIN', async ({ page }) => {
  await stubFaceId(page, false)
  await page.goto('/#/settings')
  await seedAppLock(page, '111111')
  await page.reload()
  await page.getByRole('button', { name: 'Turn off app lock' }).click()
  const sheet = page.getByRole('dialog', { name: 'Turn off app lock' })
  await expect(sheet.getByText('Enter your PIN to turn off app lock')).toBeVisible()
  await enterPin(sheet, '111111')
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('App lock is off')
  await expect(page.getByRole('button', { name: 'Turn on app lock' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: 'App lock' })).toBeFocused()

  await reopenAfterAWhile(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await expect(lockHeading(page)).toHaveCount(0)
})

test('turns the lock off with Face ID', async ({ page }) => {
  await fakePasskey(page)
  await page.goto('/#/settings')
  await seedAppLock(page, '111111', FAKE_PASSKEY_ID)
  await page.reload()
  await page.getByRole('button', { name: 'Turn off app lock' }).click()
  const sheet = page.getByRole('dialog', { name: 'Turn off app lock' })
  await sheet.getByRole('button', { name: 'Use Face ID' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('App lock is off')
  expect(await readSetting(page, 'appLock')).toMatchObject({ enabled: false, pin: null })
})

test('wrong PINs in a sheet count toward the same wait as the lock screen', async ({ page }) => {
  await stubFaceId(page, false)
  await page.goto('/#/settings')
  await seedAppLock(page, '111111')
  await page.reload()
  await page.getByRole('button', { name: 'Turn off app lock' }).click()
  const off = page.getByRole('dialog', { name: 'Turn off app lock' })
  for (let attempt = 0; attempt < 4; attempt++) {
    await enterPin(off, '000000')
    await expect(off.getByRole('alert')).toHaveText('Wrong PIN. Try again.')
  }
  await off.getByRole('button', { name: 'Cancel' }).click()
  await expect(off).toBeHidden()

  // The fifth wrong PIN, in another sheet, starts the wait.
  await page.getByRole('button', { name: 'Change PIN' }).click()
  const change = page.getByRole('dialog', { name: 'Change PIN' })
  await enterPin(change, '000000')
  await expect(change.getByRole('timer')).toContainText('Try again in 0:')
  await expect(change.getByRole('button', { name: '1', exact: true })).toBeDisabled()

  // The lock screen honors it.
  await reopenAfterAWhile(page)
  await expect(lockHeading(page)).toBeVisible()
  await expect(page.getByRole('timer')).toContainText('Try again in 0:')
})

test('Settings still appears when Face ID availability never answers', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(PublicKeyCredential, 'isUserVerifyingPlatformAuthenticatorAvailable', {
      configurable: true,
      value: () => new Promise(() => {}),
    })
  })
  await page.goto('/#/settings')
  await expect(page.getByText('Locks the app after 15 minutes away. Unlock with your PIN.')).toBeVisible({
    timeout: 8_000,
  })
})
