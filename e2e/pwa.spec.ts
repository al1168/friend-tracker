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
