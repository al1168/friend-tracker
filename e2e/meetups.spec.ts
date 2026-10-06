import { expect, test } from '@playwright/test'
import { addFriend, friendLink, logMeetup } from './helpers.ts'

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

test('Save waits for a friend to be picked', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await expect(sheet.getByRole('button', { name: 'Pick a friend' })).toBeDisabled()
  await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
  await expect(sheet.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
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
  // The friend rows only: Recent meetups above them now holds the Coffee and "See all meetups".
  const names = page.getByRole('link', { name: /^(Amy|Zoe)/ }).locator('.row__title')
  await expect(names).toHaveText(['Amy', 'Zoe'])
  await page.getByRole('button', { name: /^Sort/ }).click()
  await page.getByRole('dialog', { name: 'Sort friends by' }).getByRole('button', { name: 'Most seen this year' }).click()
  await expect(names).toHaveText(['Zoe', 'Amy'])
})
