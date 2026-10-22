import { expect, test, type Page } from '@playwright/test'
import { addFriend, friendLink, goToTab, logMeetup } from './helpers.ts'

/** Forces the download path for a backup: the share sheet can't be driven in tests. */
async function downloadBackups(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
}

/** Exports a backup from Settings and returns where the file was saved. */
async function exportFile(page: Page): Promise<string> {
  await goToTab(page, 'Settings')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const path = await (await download).path()
  await expect(page.getByText('Last backup: today')).toBeVisible()
  return path
}

/** The Settings tab in the tab bar, by its exact name. */
function settingsTab(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true })
}

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

test('a quiet dot on the Settings tab suggests a backup once meetups are logged after one 30 days old', async ({
  page,
}) => {
  await downloadBackups(page)
  await page.clock.setFixedTime(new Date(2026, 8, 1, 12))
  await page.goto('/')
  await addFriend(page, 'Alex')
  await exportFile(page)
  await page.clock.setFixedTime(new Date(2026, 8, 1, 13))
  await goToTab(page, 'Friends')
  await logMeetup(page, ['Alex'])
  await expect(settingsTab(page, 'Settings')).toBeVisible()

  // 31 days after the backup: the dot, and the tab says why.
  await page.clock.setFixedTime(new Date(2026, 9, 2, 12))
  await page.reload()
  const suggested = settingsTab(page, 'Settings, backup suggested')
  await expect(suggested).toBeVisible()
  await expect(suggested.locator('.tabbar__dot')).toBeVisible()

  // Opening Settings sees it: it goes, and the footer has the facts.
  await suggested.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await expect(settingsTab(page, 'Settings')).toBeVisible()
  await expect(page.locator('.tabbar__dot')).toHaveCount(0)
  await expect(page.getByText('Last backup: 4 weeks ago. 1 meetup since then.')).toBeVisible()
  await page.reload()
  await expect(settingsTab(page, 'Settings')).toBeVisible()
  await goToTab(page, 'Friends')
  await expect(page.locator('.tabbar__dot')).toHaveCount(0)

  // 30 days on, a backup is still due: the dot again.
  await page.clock.setFixedTime(new Date(2026, 10, 1, 12))
  await page.reload()
  await expect(settingsTab(page, 'Settings, backup suggested')).toBeVisible()

  // A backup ends it.
  await exportFile(page)
  await expect(settingsTab(page, 'Settings')).toBeVisible()
  await expect(page.locator('.tabbar__dot')).toHaveCount(0)
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
