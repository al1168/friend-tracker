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

/** On a friend's page: adds `text` to their Likes or Dislikes with Enter, then closes the field. */
export async function addToList(page: Page, list: 'Likes' | 'Dislikes', text: string) {
  const kind = list === 'Likes' ? 'like' : 'dislike'
  const section = page.getByRole('region', { name: list, exact: true })
  await section.getByRole('button', { name: `Add a ${kind}`, exact: true }).click()
  const field = section.getByRole('textbox', { name: `New ${kind}`, exact: true })
  await field.fill(text)
  await field.press('Enter')
  await expect(field).toHaveValue('')
  await field.press('Escape')
  await expect(field).toBeHidden()
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

/** Writes one row of the `settings` table straight into IndexedDB (the open page notices on its next reload). */
export async function putSetting(page: Page, key: string, value: unknown) {
  await page.evaluate(
    async ({ key, value }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('friend-tracker')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction('settings', 'readwrite')
          transaction.objectStore('settings').put({ key, value })
          transaction.oncomplete = () => {
            database.close()
            resolve()
          }
          transaction.onerror = () => reject(transaction.error)
        }
      })
    },
    { key, value },
  )
}

/** Reads one row of the `settings` table straight from IndexedDB (null when missing). */
export async function readSetting(page: Page, key: string): Promise<unknown> {
  return page.evaluate(
    (key) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('friend-tracker')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const get = database.transaction('settings').objectStore('settings').get(key)
          get.onsuccess = () => {
            database.close()
            resolve(get.result?.value ?? null)
          }
        }
      }),
    key,
  )
}

/** The passkey id that `fakePasskey` hands out (the bytes 1 to 8, as base64url). */
export const FAKE_PASSKEY_ID = 'AQIDBAUGBwg'

/**
 * Fakes a Face ID that always succeeds: creating and asserting a passkey both return the same
 * credential, with the user-verified flag set. Face ID also looks available.
 */
export async function fakePasskey(page: Page) {
  await page.addInitScript(() => {
    function FakeCredential() {}
    FakeCredential.isUserVerifyingPlatformAuthenticatorAvailable = async () => true
    function FakeAssertion() {}
    Object.defineProperty(window, 'PublicKeyCredential', { configurable: true, writable: true, value: FakeCredential })
    Object.defineProperty(window, 'AuthenticatorAssertionResponse', {
      configurable: true,
      writable: true,
      value: FakeAssertion,
    })
    const rawId = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer
    const credential = () => {
      const result = Object.create(FakeCredential.prototype)
      Object.defineProperty(result, 'rawId', { value: rawId })
      return result
    }
    const credentials = {
      create: async () => credential(),
      get: async () => {
        const result = credential()
        const response = Object.create(FakeAssertion.prototype)
        const authenticatorData = new Uint8Array(37)
        authenticatorData[32] = 0x05 // user present + user verified
        Object.defineProperty(response, 'authenticatorData', { value: authenticatorData.buffer })
        Object.defineProperty(result, 'response', { value: response })
        return result
      },
    }
    Object.defineProperty(navigator, 'credentials', { configurable: true, value: credentials })
  })
}

/** Makes Face ID look available (or not) on every later page load, whatever machine runs the tests. */
export async function stubFaceId(page: Page, available: boolean) {
  await page.addInitScript((available) => {
    Object.defineProperty(PublicKeyCredential, 'isUserVerifyingPlatformAuthenticatorAvailable', {
      configurable: true,
      value: async () => available,
    })
  }, available)
}

/** Turns on the app lock from Settings with this PIN (Face ID must look unavailable). */
export async function turnOnAppLock(page: Page, pin: string) {
  await page.goto('/#/settings')
  await page.getByRole('button', { name: 'Turn on app lock' }).click()
  const sheet = page.getByRole('dialog', { name: 'Turn on app lock' })
  await expect(sheet.getByText('Choose a 6-digit PIN')).toBeVisible()
  await enterPin(sheet, pin)
  await expect(sheet.getByText('Enter it again')).toBeVisible()
  await enterPin(sheet, pin)
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('button', { name: 'Change PIN' })).toBeVisible()
}
