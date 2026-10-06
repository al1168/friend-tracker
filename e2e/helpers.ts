import { expect, type Locator, type Page } from '@playwright/test'

/** A valid 1×1 PNG. */
export const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

/** Roughly the iPhone's largest standard text size, for page.addStyleTag. */
export const LARGE_TEXT = 'html { font: 23px/1.35 -apple-system, system-ui, sans-serif !important; }'

export async function goToTab(page: Page, name: 'Friends' | 'Stats' | 'Settings') {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

export async function addFriend(page: Page, name: string, group?: string, birthday?: BirthdayChoice) {
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
  if (birthday) await setBirthday(sheet, birthday)
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
}

export async function logMeetup(
  page: Page,
  names: string[],
  options: { type?: string; date?: string; note?: string; activities?: string[]; photos?: PhotoFile[] } = {},
) {
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  for (const name of names) {
    await sheet.getByLabel('Search all friends').fill(name)
    await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name, exact: true }).click()
  }
  if (options.type) await sheet.getByRole('button', { name: options.type, exact: true }).click()
  if (options.date) await sheet.getByLabel('Pick date').fill(options.date)
  for (const activity of options.activities ?? []) await pickActivity(sheet, activity)
  if (options.photos) await addPhotos(sheet, options.photos)
  if (!options.note) {
    await sheet.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(sheet).toBeHidden()
    return
  }
  // A note is the day: write it on the day page, then come back to where the sheet was opened.
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
  await expect(sheet).toBeHidden()
  await page.getByRole('textbox', { name: 'The day' }).fill(options.note)
  await page.locator('.day-page__bar').getByRole('button').click()
  await expect(page.getByRole('heading', { level: 1, name: options.type ?? 'Coffee' })).toBeVisible()
  await page.locator('header.navbar .navbar__back').click()
  await expect(page.getByRole('heading', { level: 1, name: options.type ?? 'Coffee' })).toHaveCount(0)
}

/** A file for the photo picker (`setInputFiles`). */
export interface PhotoFile {
  name: string
  mimeType: string
  buffer: Buffer
}

/** A tiny photo for the picker: the 1×1 PNG. */
export function tinyPhoto(name = 'photo.png'): PhotoFile {
  return { name, mimeType: 'image/png', buffer: Buffer.from(ONE_PIXEL_PNG, 'base64') }
}

/** A file the picker hands over that isn't an image at all. */
export function brokenPhoto(name = 'broken.jpg'): PhotoFile {
  return { name, mimeType: 'image/jpeg', buffer: Buffer.from('not an image') }
}

/**
 * A photo of a given size, drawn in the page: a soft diagonal gradient in `hue`, as a PNG. For
 * checking the resize, and for screenshots that need something that looks like a picture.
 */
export async function drawnPhoto(
  page: Page,
  name: string,
  width: number,
  height: number,
  hue = 30,
): Promise<PhotoFile> {
  const base64 = await page.evaluate(
    ({ width, height, hue }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('No canvas')
      const gradient = context.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, `hsl(${hue} 80% 82%)`)
      gradient.addColorStop(1, `hsl(${hue + 50} 55% 48%)`)
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)
      context.fillStyle = `hsl(${hue + 20} 90% 96% / 0.7)`
      context.beginPath()
      context.arc(width * 0.3, height * 0.35, Math.min(width, height) * 0.18, 0, Math.PI * 2)
      context.fill()
      return canvas.toDataURL('image/png').split(',')[1]
    },
    { width, height, hue },
  )
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}

/** In an open meetup sheet: selects an activity's chip, or adds it with "+ New" when there's no chip for it. */
export async function pickActivity(sheet: Locator, name: string) {
  const activities = sheet.getByRole('group', { name: 'Activities' })
  const chip = activities.getByRole('button', { name, exact: true })
  if ((await chip.count()) > 0) {
    await chip.click()
  } else {
    await activities.getByRole('button', { name: 'New activity' }).click()
    await sheet.getByRole('textbox', { name: 'New activity' }).fill(name)
    await sheet.getByRole('button', { name: 'Add', exact: true }).click()
  }
  await expect(activities.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
}

/** In an open meetup sheet: the Photos grid. */
export function photoGrid(sheet: Locator): Locator {
  return sheet.getByRole('list', { name: 'Photos' })
}

/** In an open meetup sheet: picks photos and waits until they've all been added. */
export async function addPhotos(sheet: Locator, files: PhotoFile[]) {
  const thumbnails = photoGrid(sheet).getByRole('img')
  const before = await thumbnails.count()
  await sheet.locator('input[type="file"]').setInputFiles(files)
  await expect(thumbnails).toHaveCount(before + files.length)
}

/** Opens a friend's page from the Friends tab. */
export async function openFriendPage(page: Page, name: string) {
  await goToTab(page, 'Friends')
  await friendLink(page, name).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

/** On a friend's page: opens a meetup from their history, then its Edit meetup sheet. */
export async function editMeetup(page: Page, name: RegExp): Promise<Locator> {
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit meetup' })
  await expect(sheet).toBeVisible()
  return sheet
}

/** Every stored meetup photo, read straight from IndexedDB. */
export async function readMeetupPhotos(
  page: Page,
): Promise<{ id: string; order: number; full: string; thumb: string; width: number; height: number }[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('friend-tracker')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const getAll = database.transaction('meetupPhotos').objectStore('meetupPhotos').getAll()
          getAll.onsuccess = () => {
            database.close()
            resolve(getAll.result)
          }
          getAll.onerror = () => reject(getAll.error)
        }
      }),
  )
}

/** A meetup as IndexedDB stores it, read without the app's reading hook. */
export type StoredMeetup = Record<string, unknown> & { id: string; note: string }

/** Every stored meetup, read straight from IndexedDB, oldest first. */
export async function readMeetups(page: Page): Promise<StoredMeetup[]> {
  const meetups = await page.evaluate(
    () =>
      new Promise<StoredMeetup[]>((resolve, reject) => {
        const request = indexedDB.open('friend-tracker')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const getAll = database.transaction('meetups').objectStore('meetups').getAll()
          getAll.onsuccess = () => {
            database.close()
            resolve(getAll.result)
          }
          getAll.onerror = () => reject(getAll.error)
        }
      }),
  )
  return meetups.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
}

/** On a Meetup page: opens its day page from the day row ("Write about the day" or "Edit the day"). */
export async function openDay(page: Page) {
  await page.getByRole('link', { name: /^(Write about|Edit) the day/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
}

/** The pixel size of an image data URL, decoded in the page. */
export async function imageSize(page: Page, src: string): Promise<{ width: number; height: number }> {
  return page.evaluate(async (src) => {
    const image = new Image()
    image.src = src
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight }
  }, src)
}

/** A birthday to pick in the friend sheet. Leave out `year` for "No year". */
export interface BirthdayChoice {
  month: number
  day: number
  year?: number
}

/** In an open friend sheet: picks the birthday's month, day and year. */
export async function setBirthday(sheet: Locator, { month, day, year }: BirthdayChoice) {
  await sheet.getByRole('combobox', { name: 'Birthday month' }).selectOption(String(month))
  await sheet.getByRole('combobox', { name: 'Birthday day' }).selectOption(String(day))
  await sheet
    .getByRole('combobox', { name: 'Birthday year' })
    .selectOption(year === undefined ? { label: 'No year' } : String(year))
}

/**
 * The local date `days` from today (negative for the past). Tests build birthdays from it, so the
 * same countdown ("In 5 days") shows whatever day they run.
 */
export function dayFromToday(days: number): { year: number; month: number; day: number } {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
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

/** The push subscription `stubPush` hands out: an Apple endpoint and keys of the right sizes. */
export const FAKE_SUBSCRIPTION = {
  endpoint: 'https://web.push.apple.com/QGuQyavXutnMH-e2e',
  keys: { p256dh: `B${'A'.repeat(86)}`, auth: 'A'.repeat(22) },
}

/** Where `stubPush` keeps the subscription, so it survives reloads. Remove it to play iOS dropping it. */
export const FAKE_SUBSCRIPTION_KEY = 'e2e:push-subscription'

/**
 * Makes every later page load look like the installed Home Screen app with Web Push:
 * `navigator.standalone`, a Notification whose permission prompt answers `answer`, and a service
 * worker registration whose PushManager hands out FAKE_SUBSCRIPTION. (Real service workers are
 * blocked in these tests.)
 */
export async function stubPush(page: Page, { answer = 'granted' }: { answer?: NotificationPermission } = {}) {
  await page.addInitScript(
    ({ answer, subscription, storeKey }) => {
      const permissionKey = 'e2e:notification-permission'
      Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
      class FakeNotification {
        static get permission() {
          return localStorage.getItem(permissionKey) ?? 'default'
        }
        static async requestPermission() {
          localStorage.setItem(permissionKey, answer)
          return answer
        }
      }
      Object.defineProperty(window, 'Notification', { configurable: true, writable: true, value: FakeNotification })
      function FakePushManager() {}
      Object.defineProperty(window, 'PushManager', { configurable: true, writable: true, value: FakePushManager })
      // The subscription is stored as its application server key (base64), so a test can see which key made it.
      const subscriptionFor = (key: string) => ({
        endpoint: subscription.endpoint,
        expirationTime: null,
        options: {
          userVisibleOnly: true,
          applicationServerKey: Uint8Array.from(atob(key), (char) => char.charCodeAt(0)).buffer,
        },
        toJSON: () => ({ endpoint: subscription.endpoint, expirationTime: null, keys: subscription.keys }),
        unsubscribe: async () => {
          localStorage.removeItem(storeKey)
          return true
        },
      })
      const pushManager = {
        getSubscription: async () => {
          const key = localStorage.getItem(storeKey)
          return key === null ? null : subscriptionFor(key)
        },
        subscribe: async ({ applicationServerKey }: { applicationServerKey: Uint8Array }) => {
          const key = btoa(String.fromCharCode(...new Uint8Array(applicationServerKey)))
          localStorage.setItem(storeKey, key)
          return subscriptionFor(key)
        },
      }
      const registration = { pushManager }
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          ready: Promise.resolve(registration),
          register: async () => registration,
          controller: null,
          addEventListener() {},
          removeEventListener() {},
        },
      })
    },
    { answer, subscription: FAKE_SUBSCRIPTION, storeKey: FAKE_SUBSCRIPTION_KEY },
  )
}

/** "a.b" as a pattern that matches only "a.b". */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * A friend's row on the Friends tab (or Birthdays soon) by the friend's name. A friend row's name starts with the
 * friend's name (the avatar is hidden); a meetup row's starts with its type, so "with Alex" never matches.
 */
export function friendLink(page: Page, name: string): Locator {
  return page.getByRole('link', { name: new RegExp(`^${escapeRegExp(name)}`) })
}

/** A friend as IndexedDB stores it, for seedMeetups. */
export interface SeedFriend {
  id: string
  name: string
  groupId: string | null
  photo: string | null
  notes: string
  likes: string[]
  dislikes: string[]
  birthday: { month: number; day: number; year: number | null } | null
  createdAt: string
}

/** A meetup as IndexedDB stores it, for seedMeetups. */
export interface SeedMeetup {
  id: string
  date: string
  typeId: string
  friendIds: string[]
  note: string
  activities: string[]
  weather: string[]
  mood: string | null
  feelings: string
  createdAt: string
}

/** A meetup photo as IndexedDB stores it, for seedMeetups. */
export interface SeedPhoto {
  id: string
  meetupId: string
  order: number
  full: string
  thumb: string
  width: number
  height: number
  createdAt: string
}

/** A complete friend row with nothing filled in but what's given. */
export function friendRow(id: string, name: string, fields: Partial<SeedFriend> = {}): SeedFriend {
  return {
    id,
    name,
    groupId: null,
    photo: null,
    notes: '',
    likes: [],
    dislikes: [],
    birthday: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...fields,
  }
}

/** A complete meetup row: a Coffee (one of the default types) unless `typeId` says otherwise, logged at noon UTC. */
export function meetupRow(
  id: string,
  date: string,
  friendIds: string[],
  fields: Partial<SeedMeetup> = {},
): SeedMeetup {
  return {
    id,
    date,
    typeId: 'type-coffee',
    friendIds,
    note: '',
    activities: [],
    weather: [],
    mood: null,
    feelings: '',
    createdAt: `${date}T12:00:00.000Z`,
    ...fields,
  }
}

/** A meetup's first photo: the 1×1 PNG as both the full image and the thumbnail. */
export function photoRow(id: string, meetupId: string): SeedPhoto {
  const image = `data:image/png;base64,${ONE_PIXEL_PNG}`
  return { id, meetupId, order: 0, full: image, thumb: image, width: 1, height: 1, createdAt: '2026-09-01T12:00:00Z' }
}

/**
 * Writes friends, groups, meetups and photos straight into IndexedDB in one transaction, skipping the app's
 * checks (so every row must be complete), then reloads so the app reads them. Call it after the first
 * `page.goto`, once the app has created its stores.
 */
export async function seedMeetups(
  page: Page,
  seed: {
    friends?: SeedFriend[]
    groups?: { id: string; name: string }[]
    meetups?: SeedMeetup[]
    photos?: SeedPhoto[]
  },
) {
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  await page.evaluate(
    async ({ friends, groups, meetups, photos }) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('friend-tracker')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction(['friends', 'groups', 'meetups', 'meetupPhotos'], 'readwrite')
          for (const row of friends) transaction.objectStore('friends').put(row)
          for (const row of groups) transaction.objectStore('groups').put(row)
          for (const row of meetups) transaction.objectStore('meetups').put(row)
          for (const row of photos) transaction.objectStore('meetupPhotos').put(row)
          transaction.oncomplete = () => {
            database.close()
            resolve()
          }
          transaction.onerror = () => reject(transaction.error)
        }
      })
    },
    { friends: seed.friends ?? [], groups: seed.groups ?? [], meetups: seed.meetups ?? [], photos: seed.photos ?? [] },
  )
  await page.reload()
}
