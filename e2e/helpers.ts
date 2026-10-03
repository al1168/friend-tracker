import { expect, type Locator, type Page } from '@playwright/test'

/** A valid 1×1 PNG. */
export const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export async function goToTab(page: Page, name: 'Friends' | 'Stats' | 'Settings') {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

export async function addFriend(page: Page, name: string, group?: string) {
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheet.getByLabel('Name', { exact: true }).fill(name)
  if (group) {
    const existing = sheet.getByRole('button', { name: group, exact: true })
    if ((await existing.count()) > 0) {
      await existing.click()
    } else {
      await sheet.getByRole('button', { name: 'New group' }).click()
      await sheet.getByLabel('New group name').fill(group)
      await sheet.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(sheet.getByRole('button', { name: group, exact: true })).toHaveAttribute('aria-pressed', 'true')
    }
  }
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
}

export async function logMeetup(
  page: Page,
  names: string[],
  options: { type?: string; date?: string; note?: string } = {},
) {
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  for (const name of names) {
    await sheet.getByLabel('Search all friends').fill(name)
    await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name, exact: true }).click()
  }
  if (options.type) await sheet.getByRole('button', { name: options.type, exact: true }).click()
  if (options.date) await sheet.getByLabel('Pick date').fill(options.date)
  if (options.note) await sheet.getByLabel('Note').fill(options.note)
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
}

/** The lock screen's heading. */
export function lockHeading(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Friend Tracker is locked' })
}

/** Taps a PIN on the keypad inside `scope` (the page, or a sheet). */
export async function enterPin(scope: Page | Locator, pin: string) {
  for (const digit of pin) await scope.getByRole('button', { name: digit, exact: true }).click()
}

/**
 * Turns on the app lock with this PIN by writing it straight into IndexedDB, hashed the same way
 * the app does (PBKDF2-SHA256, 210,000 iterations). The open page doesn't notice until it reloads.
 */
export async function seedAppLock(page: Page, pin: string, passkeyId: string | null = null) {
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await page.evaluate(async ({ pin, passkeyId }) => {
    const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 210_000 }, key, 256)
    const value = {
      enabled: true,
      pin: { hash: toBase64(new Uint8Array(bits)), salt: toBase64(salt), iterations: 210_000 },
      passkeyId,
    }
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('friend-tracker')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const database = request.result
        const transaction = database.transaction('settings', 'readwrite')
        transaction.objectStore('settings').put({ key: 'appLock', value })
        transaction.oncomplete = () => {
          database.close()
          resolve()
        }
        transaction.onerror = () => reject(transaction.error)
      }
    })
  }, { pin, passkeyId })
}

/**
 * Reloads as if the app had been closed for 16 minutes. The stale time is set before the app
 * starts on every later load of this page too, so each reload behaves like a fresh, late launch.
 */
export async function reopenAfterAWhile(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('ft:lastActiveAt', String(Date.now() - 16 * 60_000))
  })
  await page.reload()
}
