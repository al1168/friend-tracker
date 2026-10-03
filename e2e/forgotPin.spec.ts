import { expect, test, type Page, type Route } from '@playwright/test'
import { enterPin, lockHeading, reopenAfterAWhile, seedAppLock } from './helpers.ts'

// PIN hashing and many taps make these tests slower than most.
test.describe.configure({ timeout: 60_000 })

const PIN = '135790'
const WEBSITE_PASSWORD = 'maple otter lantern river'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await seedAppLock(page, PIN)
  await reopenAfterAWhile(page)
  await expect(lockHeading(page)).toBeVisible()
})

async function askToReset(page: Page, password: string) {
  await page.getByRole('button', { name: 'Forgot PIN?' }).click()
  const sheet = page.getByRole('dialog', { name: 'Reset PIN' })
  await sheet.getByLabel('Website password').fill(password)
  await sheet.getByRole('button', { name: 'Continue' }).click()
  return sheet
}

test('resets the PIN with the website password and keeps the data', async ({ page }) => {
  let body: unknown = null
  await page.route('**/__verify-password', async (route: Route) => {
    expect(route.request().method()).toBe('POST')
    expect(route.request().headers()['content-type']).toContain('application/json')
    body = route.request().postDataJSON()
    await route.fulfill({ status: 204 })
  })
  const sheet = await askToReset(page, WEBSITE_PASSWORD)
  await expect(sheet.getByText('Choose a 6-digit PIN')).toBeVisible()
  expect(body).toEqual({ password: WEBSITE_PASSWORD })
  await enterPin(sheet, '246802')
  await expect(sheet.getByText('Enter it again')).toBeVisible()
  await enterPin(sheet, '246802')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()

  await page.reload()
  await expect(lockHeading(page)).toBeVisible()
  await enterPin(page, '246802')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})

test('explains why the password check failed', async ({ page }) => {
  let answer: 'status' | 'abort' = 'status'
  let status = 401
  await page.route('**/__verify-password', async (route: Route) => {
    if (answer === 'abort') await route.abort('internetdisconnected')
    else await route.fulfill({ status, contentType: 'text/html', body: status === 200 ? '<html></html>' : '' })
  })
  const sheet = await askToReset(page, 'wrong words')
  const alert = sheet.getByRole('alert')
  await expect(alert).toHaveText("That password didn't work.")
  await expect(sheet.getByLabel('Website password')).toHaveAttribute('aria-invalid', 'true')

  const cases: [() => void, string][] = [
    [() => (status = 429), 'Too many attempts. Try again in 15 minutes.'],
    [() => (status = 200), "Couldn't check your password. Please try again."],
    [() => (answer = 'abort'), 'You need to be online to reset your PIN.'],
  ]
  for (const [arrange, message] of cases) {
    arrange()
    await sheet.getByLabel('Website password').fill(WEBSITE_PASSWORD)
    await sheet.getByRole('button', { name: 'Continue' }).click()
    await expect(alert).toHaveText(message)
  }
  // Still locked, and the old PIN still works.
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(sheet).toBeHidden()
  await enterPin(page, PIN)
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})

test('sends you to sign in again when the website sign-in expired', async ({ page }) => {
  await page.route('**/__verify-password', (route: Route) => route.fulfill({ status: 403 }))
  await page.route('**/__login?**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Sign in page</h1>' }),
  )
  const sheet = await askToReset(page, WEBSITE_PASSWORD)
  await expect(sheet.getByRole('alert')).toHaveText('Your sign-in expired. Sign in again, then reset your PIN.')
  await sheet.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/__login\?next=%2F$/)
  await expect(page.getByRole('heading', { name: 'Sign in page' })).toBeVisible()
})
