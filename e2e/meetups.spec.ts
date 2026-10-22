import { expect, test } from '@playwright/test'
import { addFriend, editMeetup, friendLink, logMeetup, openFriendPage, sheetSave } from './helpers.ts'

test('logs a meetup with two friends', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await addFriend(page, 'Sam')
  await addFriend(page, 'Kim')
  await logMeetup(page, ['Alex', 'Sam'], { type: 'Meal' })
  await expect(page.getByRole('status')).toContainText('Logged with Alex and Sam')
  await expect(friendLink(page, 'Alex')).toContainText('Today')
  await expect(friendLink(page, 'Sam')).toContainText('Today')
  await expect(friendLink(page, 'Kim')).toContainText('Not seen yet')
})

test('undo removes the meetup', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(friendLink(page, 'Alex')).toContainText('Not seen yet')
})

test('Save is at the top right, dimmed until a friend is picked, and there is no footer', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  const header = sheet.locator('.sheet__header')
  // Cancel on the left, then Save: the order VoiceOver and the keyboard reach them in.
  await expect(header.getByRole('button')).toHaveText(['Cancel', 'Save'])
  await expect(sheetSave(sheet)).toBeDisabled()
  // Picking a friend is the only step: nothing says "Pick a friend".
  await expect(sheet.getByText(/pick a friend|pick at least one/i)).toHaveCount(0)
  await expect(sheet.locator('.sheet__footer')).toHaveCount(0)
  // The title stays centered between Cancel and Save.
  const title = await header.getByRole('heading', { name: 'Log meetup' }).boundingBox()
  const bar = await header.locator('.sheet__bar').boundingBox()
  if (!title || !bar) throw new Error('The header is not on screen')
  expect(Math.abs(title.x + title.width / 2 - (bar.x + bar.width / 2)), 'Within a pixel').toBeLessThanOrEqual(1)

  await sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name: 'Alex' }).click()
  await expect(sheetSave(sheet)).toBeEnabled()
  await sheetSave(sheet).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('Logged with Alex')
})

test('the Edit meetup sheet saves from the top right too', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await openFriendPage(page, 'Alex')
  const sheet = await editMeetup(page, /Coffee/)
  await expect(sheet.locator('.sheet__footer')).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
  await sheetSave(sheet).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('Saved')
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
})

test('logs a meetup on another date', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { date: '2025-03-14' })
  await expect(friendLink(page, 'Alex').locator('.row__subtitle')).toContainText(/years? ago/)
})

test('asks before discarding a started meetup', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name: 'Alex' }).click()
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(sheet).toBeHidden()
})

test('sorts friends by most seen this year', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Amy')
  await addFriend(page, 'Zoe')
  await logMeetup(page, ['Zoe'])
  // The friend rows only: Recent meetups above them now holds the Coffee with Zoe and "See all meetups".
  const names = page.locator('a.row[href^="#/friends/"] .row__title')
  await expect(names).toHaveText(['Amy', 'Zoe'])
  await page.getByRole('button', { name: /^Sort/ }).click()
  await page.getByRole('dialog', { name: 'Sort friends by' }).getByRole('button', { name: 'Most seen this year' }).click()
  await expect(names).toHaveText(['Zoe', 'Amy'])
})
