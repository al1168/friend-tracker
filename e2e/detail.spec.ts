import { expect, test } from '@playwright/test'
import { addFriend, logMeetup } from './helpers.ts'

test('shows a friend’s stats and history', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await addFriend(page, 'Sam')
  await logMeetup(page, ['Alex', 'Sam'], { type: 'Meal', note: 'Tacos' })
  await page.getByRole('link', { name: /Alex/ }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
  await expect(page.getByText(/^Last seen .* · Today$/)).toBeVisible()
  const thisYear = page.locator('.stat-row__item').first()
  await expect(thisYear).toHaveText(/This year\s*1$/)
  const history = page.getByRole('region', { name: 'History' })
  await expect(history.getByRole('link', { name: /Meal.*with Sam.*Tacos/ })).toBeVisible()
})

test('logs from the friend page with them preselected', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('link', { name: /Alex/ }).click()
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await expect(sheet.getByRole('button', { name: 'Remove Alex' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ })).toBeVisible()
})

test('edits a meetup from its page, then deletes it with undo', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await page.getByRole('link', { name: /Alex/ }).click()
  const history = page.getByRole('region', { name: 'History' })

  await history.getByRole('link', { name: /Coffee/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const editSheet = page.getByRole('dialog', { name: 'Edit meetup' })
  await editSheet.getByRole('button', { name: 'Drinks', exact: true }).click()
  await editSheet.getByRole('button', { name: 'Save' }).click()
  await expect(editSheet).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Drinks' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('dialog', { name: 'Edit meetup' }).getByRole('button', { name: 'Delete meetup' }).click()
  // The meetup is gone, so its page goes back to the friend.
  await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
  await expect(page.getByText('Your first meetup will show up here.')).toBeVisible()
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(history.getByRole('link', { name: /Drinks/ })).toBeVisible()
})

test('edits and deletes a friend', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('link', { name: /Alex/ }).click()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await sheet.getByLabel('Name', { exact: true }).fill('Alexandra')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Alexandra' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('dialog', { name: 'Edit friend' }).getByRole('button', { name: 'Delete friend' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete friend' }).click()
  await expect(page.getByText('Add the people you want to keep up with.')).toBeVisible()
})

test('shows a future meetup as upcoming without counting it', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { date: '2099-01-01' })
  await page.getByRole('link', { name: /Alex/ }).click()

  await expect(page.getByText('Not seen yet')).toBeVisible()
  await expect(page.locator('.stat-row__item').first()).toHaveText(/This year\s*0$/)
  await expect(page.getByRole('region', { name: 'History' })).toContainText('Upcoming')
})

test('redirects to Friends for an unknown friend', async ({ page }) => {
  await page.goto('/#/friends/nope')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})
