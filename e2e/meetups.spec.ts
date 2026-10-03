import { expect, test } from '@playwright/test'
import { addFriend, logMeetup } from './helpers.ts'

test('logs a meetup with two friends', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await addFriend(page, 'Sam')
  await addFriend(page, 'Kim')
  await logMeetup(page, ['Alex', 'Sam'], { type: 'Meal' })
  await expect(page.getByRole('status')).toContainText('Logged with Alex and Sam')
  await expect(page.getByRole('link', { name: /Alex/ })).toContainText('Today')
  await expect(page.getByRole('link', { name: /Sam/ })).toContainText('Today')
  await expect(page.getByRole('link', { name: /Kim/ })).toContainText('Not seen yet')
})

test('undo removes the meetup', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('link', { name: /Alex/ })).toContainText('Not seen yet')
})

test('Save waits for a friend to be picked', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await expect(sheet.getByRole('button', { name: 'Pick a friend' })).toBeDisabled()
  await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
  await expect(sheet.getByRole('button', { name: 'Save' })).toBeEnabled()
})

test('logs a meetup on another date', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { date: '2025-03-14' })
  await expect(page.getByRole('link', { name: /Alex/ })).toContainText('year')
})

test('asks before discarding a started meetup', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(sheet).toBeHidden()
})

test('sorts friends by most seen this year', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Amy')
  await addFriend(page, 'Zoe')
  await logMeetup(page, ['Zoe'])
  const names = page.locator('.row__title')
  await expect(names).toHaveText(['Amy', 'Zoe'])
  await page.getByRole('button', { name: /^Sort/ }).click()
  await page.getByRole('dialog', { name: 'Sort friends by' }).getByRole('button', { name: 'Most seen this year' }).click()
  await expect(names).toHaveText(['Zoe', 'Amy'])
})
