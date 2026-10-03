import { expect, test } from '@playwright/test'
import { enterPin, lockHeading, reopenAfterAWhile, seedAppLock, stubFaceId, turnOnAppLock } from './helpers.ts'

// PIN hashing and many taps make these tests slower than most.
test.describe.configure({ timeout: 60_000 })

test('turns on app lock with a PIN', async ({ page }) => {
  await stubFaceId(page, false)
  await page.goto('/#/settings')
  await expect(page.getByText('Locks the app after 15 minutes away. Unlock with your PIN.')).toBeVisible()

  await turnOnAppLock(page, '111111')
  await expect(page.getByRole('status')).toContainText('App lock is on')
  await expect(page.getByRole('button', { name: 'Turn off app lock' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Face ID/ })).toHaveCount(0)

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

  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('button', { name: 'Turn on app lock' })).toBeVisible()
})

test('offers Face ID when the iPhone has it', async ({ page }) => {
  await stubFaceId(page, true)
  await page.goto('/#/settings')
  await expect(
    page.getByText('Locks the app after 15 minutes away. Unlock with your PIN, Face ID or your iPhone passcode.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Turn on app lock' }).click()
  const sheet = page.getByRole('dialog', { name: 'Turn on app lock' })
  await enterPin(sheet, '111111')
  await enterPin(sheet, '111111')
  await expect(sheet.getByText('Use Face ID or your iPhone passcode to unlock?')).toBeVisible()
  await sheet.getByRole('button', { name: 'Not now' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('App lock is on')
  await expect(page.getByRole('button', { name: 'Face ID Off' })).toBeVisible()
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

  await reopenAfterAWhile(page)
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await expect(lockHeading(page)).toHaveCount(0)
})
