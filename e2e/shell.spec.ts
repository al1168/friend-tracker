import { expect, test } from '@playwright/test'

test('tab bar switches between screens', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.getByRole('link', { name: 'Stats' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Stats' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Stats' })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()

  await nav.getByRole('link', { name: 'Friends' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})

test('unknown routes go to Friends', async ({ page }) => {
  await page.goto('/#/nowhere')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})

test('back button works when a screen is opened directly', async ({ page }) => {
  await page.goto('/#/settings/groups')
  await expect(page.getByRole('heading', { level: 1, name: 'Groups' })).toBeVisible()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
})
