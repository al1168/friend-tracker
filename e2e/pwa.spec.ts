import { expect, test } from '@playwright/test'

test('ships a web app manifest and an iPhone icon', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const manifest = await (await request.get(href!)).json()
  expect(manifest).toMatchObject({ name: 'Friend Tracker', short_name: 'Friends', display: 'standalone',
    start_url: './',
    scope: './',
  })
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /apple-touch-icon-180x180\.png$/)
  expect((await request.get('apple-touch-icon-180x180.png')).ok()).toBe(true)
})
