import { expect, type Page } from '@playwright/test'

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
