import { expect, test } from '@playwright/test'
import { addFriend, friendLink, goToTab, logMeetup } from './helpers.ts'

test('manages groups', async ({ page }) => {
  await page.goto('/#/settings/groups')
  await page.getByRole('button', { name: 'Add group' }).first().click()
  const newSheet = page.getByRole('dialog', { name: 'New group' })
  await newSheet.getByLabel('Name').fill('College')
  await newSheet.getByRole('button', { name: 'Save' }).click()
  await expect(newSheet).toBeHidden()

  await page.getByRole('button', { name: /College/ }).click()
  const editSheet = page.getByRole('dialog', { name: 'Edit group' })
  await editSheet.getByLabel('Name').fill('University')
  await editSheet.getByRole('button', { name: 'Save' }).click()
  await expect(editSheet).toBeHidden()

  await page.getByRole('button', { name: /University/ }).click()
  await page.getByRole('dialog', { name: 'Edit group' }).getByRole('button', { name: 'Delete group' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete group' }).click()
  await expect(page.getByText('No groups yet.')).toBeVisible()
})

test('adds and reorders meetup types', async ({ page }) => {
  await page.goto('/#/settings/types')
  await page.getByRole('button', { name: 'Add type' }).click()
  const sheet = page.getByRole('dialog', { name: 'New meetup type' })
  await sheet.getByLabel('Emoji').fill('🥾')
  await sheet.getByLabel('Name').fill('Hike')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()

  const titles = page.locator('.type-row .row__title')
  await expect(titles.last()).toHaveText('Hike')
  await page.getByRole('button', { name: 'Move Hike up' }).click()
  await expect(titles.nth(7)).toHaveText('Hike')
  await expect(titles.last()).toHaveText('Other')
})

test('explains why a used type cannot be deleted', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await page.goto('/#/settings/types')
  await page.getByRole('button', { name: /^Coffee/ }).click()
  await expect(page.getByRole('dialog', { name: 'Edit meetup type' })).toContainText(
    "Used by 1 meetup, so it can't be deleted.",
  )
})

test('exports and imports a backup', async ({ page }) => {
  // Force the download path; the share sheet can't be driven in tests.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await goToTab(page, 'Settings')
  await expect(page.getByText('Never backed up')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^friend-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const backupPath = await download.path()
  await expect(page.getByText('Last backup: today')).toBeVisible()

  await goToTab(page, 'Friends')
  await addFriend(page, 'Kim')
  await goToTab(page, 'Settings')
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')

  await goToTab(page, 'Friends')
  await expect(friendLink(page, 'Alex')).toBeVisible()
  await expect(friendLink(page, 'Kim')).toHaveCount(0)
})

test('rejects a file that is not a backup', async ({ page }) => {
  await page.goto('/#/settings')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":1}'),
  })
  await expect(page.getByRole('alert')).toContainText("This isn't a Friend Tracker backup file.")
})
