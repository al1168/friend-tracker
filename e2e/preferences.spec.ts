import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { addFriend, addToList, goToTab } from './helpers.ts'

function section(page: Page, list: 'Likes' | 'Dislikes') {
  return page.getByRole('region', { name: list, exact: true })
}

async function openFriend(page: Page, name: string) {
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

test('adds likes, several at once, and says when one is already there', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await openFriend(page, 'Alex')
  const likes = section(page, 'Likes')

  await likes.getByRole('button', { name: 'Add a like', exact: true }).click()
  const field = likes.getByRole('textbox', { name: 'New like', exact: true })
  await expect(field).toBeFocused()
  await field.fill('Sushi')
  await field.press('Enter')
  await expect(likes.getByRole('button', { name: 'Sushi', exact: true })).toBeVisible()
  await expect(field).toHaveValue('')
  await expect(field).toBeFocused()

  await field.fill('board games, Hiking')
  await likes.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(likes.locator('.chip--wrap')).toHaveText(['Sushi', 'board games', 'Hiking'])
  await expect(field).toBeFocused()

  await field.fill('sushi')
  await field.press('Enter')
  await expect(likes.getByRole('alert')).toHaveText('Already in Likes.')
  await expect(likes.locator('.chip--wrap')).toHaveText(['Sushi', 'board games', 'Hiking'])
})

test('moves a dislike to Likes, removes with Undo, and keeps the lists after a reload', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await openFriend(page, 'Alex')
  const likes = section(page, 'Likes')
  const dislikes = section(page, 'Dislikes')
  await addToList(page, 'Likes', 'Sushi, Hiking')
  await addToList(page, 'Dislikes', 'Cilantro, Early mornings')

  await dislikes.getByRole('button', { name: 'Cilantro', exact: true }).click()
  await page.getByRole('alertdialog', { name: 'Cilantro' }).getByRole('button', { name: 'Move to Likes' }).click()
  await expect(likes.locator('.chip--wrap')).toHaveText(['Sushi', 'Hiking', 'Cilantro'])
  await expect(dislikes.locator('.chip--wrap')).toHaveText(['Early mornings'])

  await likes.getByRole('button', { name: 'Hiking', exact: true }).click()
  await page.getByRole('alertdialog', { name: 'Hiking' }).getByRole('button', { name: 'Remove' }).click()
  await expect(likes.locator('.chip--wrap')).toHaveText(['Sushi', 'Cilantro'])
  const toast = page.getByRole('status')
  await expect(toast).toContainText('Removed “Hiking”')
  await toast.getByRole('button', { name: 'Undo' }).click()
  await expect(likes.locator('.chip--wrap')).toHaveText(['Sushi', 'Hiking', 'Cilantro'])

  await page.reload()
  await expect(likes.locator('.chip--wrap')).toHaveText(['Sushi', 'Hiking', 'Cilantro'])
  await expect(dislikes.locator('.chip--wrap')).toHaveText(['Early mornings'])
})

test('saves when the field loses focus or the other list opens, and Escape discards', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await openFriend(page, 'Alex')
  const likes = section(page, 'Likes')
  const dislikes = section(page, 'Dislikes')

  await likes.getByRole('button', { name: 'Add a like', exact: true }).click()
  await likes.getByRole('textbox', { name: 'New like', exact: true }).fill('Jazz')
  await dislikes.getByRole('button', { name: 'Add a dislike', exact: true }).click()
  await expect(likes.getByRole('button', { name: 'Jazz', exact: true })).toBeVisible()
  await expect(likes.getByRole('textbox')).toHaveCount(0)
  const field = dislikes.getByRole('textbox', { name: 'New dislike', exact: true })
  await expect(field).toBeFocused()

  await field.fill('Crowds')
  await field.press('Escape')
  await expect(field).toBeHidden()
  await expect(dislikes.locator('.chip--wrap')).toHaveCount(0)

  await dislikes.getByRole('button', { name: 'Add a dislike', exact: true }).click()
  await field.fill('Loud bars')
  await page.getByRole('heading', { level: 1, name: 'Alex' }).click()
  await expect(field).toBeHidden()
  await expect(dislikes.locator('.chip--wrap')).toHaveText(['Loud bars'])
})

test('keeps likes and dislikes through a backup', async ({ page }) => {
  // Force the download path; the share sheet can't be driven in tests.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await page.goto('/')
  await addFriend(page, 'Alex')
  await openFriend(page, 'Alex')
  await addToList(page, 'Likes', 'Sushi')
  await addToList(page, 'Dislikes', 'Cilantro')

  await goToTab(page, 'Settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.version).toBe(5)
  expect(backup.friends[0]).toMatchObject({ name: 'Alex', likes: ['Sushi'], dislikes: ['Cilantro'] })

  await goToTab(page, 'Friends')
  await openFriend(page, 'Alex')
  await addToList(page, 'Likes', 'Ramen')
  await goToTab(page, 'Settings')
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')

  await goToTab(page, 'Friends')
  await openFriend(page, 'Alex')
  await expect(section(page, 'Likes').locator('.chip--wrap')).toHaveText(['Sushi'])
  await expect(section(page, 'Dislikes').locator('.chip--wrap')).toHaveText(['Cilantro'])
})

test('keeps text that cannot be saved when the field loses focus', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await openFriend(page, 'Alex')
  const likes = section(page, 'Likes')

  await likes.getByRole('button', { name: 'Add a like', exact: true }).click()
  const field = likes.getByRole('textbox', { name: 'New like', exact: true })
  const tooLong = 'x'.repeat(61)
  await field.fill(`Ramen, ${tooLong}`)
  await page.getByRole('heading', { level: 1, name: 'Alex' }).click()

  await expect(field).toBeVisible()
  await expect(field).toHaveValue(`Ramen, ${tooLong}`)
  await expect(likes.getByRole('alert')).toHaveText('Keep each one under 60 characters.')
  await expect(likes.locator('.chip--wrap')).toHaveCount(0)
})

test('moves focus to a neighbour when an item is removed', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await openFriend(page, 'Alex')
  const likes = section(page, 'Likes')
  await addToList(page, 'Likes', 'Sushi, Hiking, Jazz')

  async function remove(name: string) {
    await likes.getByRole('button', { name, exact: true }).click()
    await page.getByRole('alertdialog', { name }).getByRole('button', { name: 'Remove' }).click()
  }

  await remove('Hiking')
  await expect(likes.getByRole('button', { name: 'Jazz', exact: true })).toBeFocused()
  await remove('Jazz')
  await expect(likes.getByRole('button', { name: 'Sushi', exact: true })).toBeFocused()
  await remove('Sushi')
  await expect(likes.getByRole('button', { name: 'Add a like', exact: true })).toBeFocused()
})

test('clears text that cannot be saved with the clear button', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await openFriend(page, 'Alex')
  const likes = section(page, 'Likes')

  await likes.getByRole('button', { name: 'Add a like', exact: true }).click()
  const field = likes.getByRole('textbox', { name: 'New like', exact: true })
  await expect(likes.getByRole('button', { name: 'Clear text' })).toHaveCount(0)
  await field.fill('x'.repeat(61))
  await page.getByRole('heading', { level: 1, name: 'Alex' }).click()
  await expect(likes.getByRole('alert')).toHaveText('Keep each one under 60 characters.')

  await likes.getByRole('button', { name: 'Clear text' }).click()
  await expect(field).toHaveValue('')
  await expect(likes.getByRole('alert')).toHaveCount(0)
  await expect(field).toBeFocused()
  await expect(likes.getByRole('button', { name: 'Clear text' })).toHaveCount(0)

  await page.getByRole('heading', { level: 1, name: 'Alex' }).click()
  await expect(field).toBeHidden()
})

test('finds a friend by what they like, never by what they dislike', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Kim', 'Work')
  await addFriend(page, 'Sam')
  await openFriend(page, 'Kim')
  await addToList(page, 'Likes', 'Board games, Hiking')
  await goToTab(page, 'Friends')
  await openFriend(page, 'Sam')
  await addToList(page, 'Dislikes', 'Hiking')
  await goToTab(page, 'Friends')

  const search = page.getByLabel('Search friends')
  await search.fill('HIK')
  await expect(page.getByRole('link', { name: /Kim/ })).toContainText('Work · Not seen yet · Likes Hiking')
  await expect(page.getByRole('link', { name: /Sam/ })).toHaveCount(0)

  await search.fill('kim')
  await expect(page.getByRole('link', { name: /Kim/ })).not.toContainText('Likes')

  await search.fill('ramen')
  await expect(page.getByText('No friends match “ramen”.')).toBeVisible()
})
