import vm from 'node:vm'
import { expect, test } from '@playwright/test'

test('ships a web app manifest and an iPhone icon', async ({ page, request }) => {
  await page.goto('/')
  const manifestLink = page.locator('link[rel="manifest"]')
  // The manifest request carries the website sign-in cookie, so installing works behind the password gate.
  await expect(manifestLink).toHaveAttribute('crossorigin', 'use-credentials')
  const href = await manifestLink.getAttribute('href')
  expect(href).toBeTruthy()
  const manifest = await (await request.get(href!)).json()
  expect(manifest).toMatchObject({ name: 'Friend Tracker', short_name: 'Friends', display: 'standalone',
    start_url: './',
    scope: './',
  })
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /apple-touch-icon-180x180\.png$/)
  expect((await request.get('apple-touch-icon-180x180.png')).ok()).toBe(true)
})

test('never answers the website sign-in pages from the offline cache', async ({ request }) => {
  const serviceWorker = await (await request.get('sw.js')).text()
  expect(serviceWorker).toContain('denylist:[/^\\/__/]')
})

test('lists the app files for offline use in one classic script', async ({ request }) => {
  const serviceWorker = await (await request.get('sw.js')).text()
  // The build put the list of offline files in place of self.__WB_MANIFEST.
  expect(serviceWorker).not.toContain('__WB_MANIFEST')
  expect(serviceWorker).toMatch(/"?url"?:"index\.html"/)
  expect(serviceWorker).toMatch(/"?url"?:"assets\/index-[\w-]+\.js"/)
  expect(serviceWorker).toMatch(/"?url"?:"manifest\.webmanifest"/)
  expect(serviceWorker).toContain('self.skipWaiting()')
  // registerSW.js registers it as a classic script, so it must not use module syntax.
  // Parsing it as a classic script rejects any import or export statement, and import.meta.
  expect(() => new vm.Script(serviceWorker)).not.toThrow()
  // A service worker also forbids dynamic import().
  expect(serviceWorker).not.toMatch(/\bimport\s*\(/)
})

test('shows birthday reminders from the service worker', async ({ request }) => {
  const serviceWorker = await (await request.get('sw.js')).text()
  expect(serviceWorker).toMatch(/addEventListener\([`'"]push[`'"]/)
  expect(serviceWorker).toMatch(/addEventListener\([`'"]notificationclick[`'"]/)
})

test.describe('with the service worker running', () => {
  test.use({ serviceWorkers: 'allow' })

  test('installs, saves the app for offline use, and takes control without a reload', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
    // Installing fails if any listed file is missing, so "ready" means every file was saved.
    await page.evaluate(() => navigator.serviceWorker.ready)
    // clientsClaim: the worker takes over the page that installed it.
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null)).toMatch(/\/sw\.js$/)
    const saved = await page.evaluate(async () => {
      const names = await caches.keys()
      const cache = await caches.open(names.find((name) => name.includes('precache'))!)
      return (await cache.keys()).map((request) => new URL(request.url).pathname)
    })
    expect(saved).toEqual(expect.arrayContaining(['/index.html', '/manifest.webmanifest', '/registerSW.js']))
    expect(saved.some((path) => /^\/assets\/index-[\w-]+\.js$/.test(path))).toBe(true)
  })
})
