import { expect, test } from '@playwright/test'
import { addFriend, ONE_PIXEL_PNG } from './helpers.ts'

test('shows a welcome state with no friends', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Add the people you want to keep up with.')).toBeVisible()
})

test('adds friends and lists them', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex Smith')
  await addFriend(page, 'Sam')
  await expect(page.getByRole('status')).toContainText('Added Sam')
  await expect(page.getByRole('link', { name: /Alex Smith/ })).toContainText('Not seen yet')
  await expect(page.getByRole('link', { name: /Sam/ })).toBeVisible()
})

test('requires a name', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet.getByText('Please enter a name.')).toBeVisible()
})

test('asks before discarding a half-filled friend', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheet.getByLabel('Name', { exact: true }).fill('Kim')
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('link', { name: /Kim/ })).toHaveCount(0)
})

test('filters by group and search', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex', 'College')
  await addFriend(page, 'Kim', 'Work')
  await addFriend(page, 'Sam', 'College')
  await expect(page.getByRole('link', { name: /Alex/ })).toContainText('College')

  const filters = page.getByRole('group', { name: 'Filter by group' })
  await filters.getByRole('button', { name: 'College' }).click()
  await expect(page.getByRole('link', { name: /Kim/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Sam/ })).toBeVisible()

  await filters.getByRole('button', { name: 'All' }).click()
  await page.getByLabel('Search friends').fill('ki')
  await expect(page.getByRole('link', { name: /Kim/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Alex/ })).toHaveCount(0)
})

test('adds a photo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheet.locator('input[type="file"]').setInputFiles({
    name: 'dot.png',
    mimeType: 'image/png',
    buffer: Buffer.from(ONE_PIXEL_PNG, 'base64'),
  })
  await expect(sheet.locator('img.avatar')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Remove photo' })).toBeVisible()
})

test('install hint can be dismissed and stays dismissed', async ({ page }) => {
  await page.goto('/')
  const hint = page.getByRole('complementary', { name: 'Install the app' })
  await expect(hint).toBeVisible()
  await hint.getByRole('button', { name: 'Dismiss' }).click()
  await expect(hint).toBeHidden()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  await expect(hint).toBeHidden()
})
