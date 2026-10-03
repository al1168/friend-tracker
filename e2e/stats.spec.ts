import { expect, test } from '@playwright/test'
import { addFriend, goToTab, logMeetup } from './helpers.ts'

test('shows a friendly empty state', async ({ page }) => {
  await page.goto('/#/stats')
  await expect(page.getByText('Log a few meetups and your year will show up here.')).toBeVisible()
})

test('summarizes the year', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex', 'College')
  await addFriend(page, 'Sam', 'College')
  await addFriend(page, 'Kim')
  await logMeetup(page, ['Alex', 'Sam'], { type: 'Meal' })
  await logMeetup(page, ['Alex'], { type: 'Coffee' })
  await goToTab(page, 'Stats')

  await expect(page.getByText('2 meetups with 2 friends.', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Top friends' }).getByRole('link').first()).toContainText('Alex')
  await expect(page.getByRole('region', { name: 'By type' })).toContainText('Meal')
  await expect(page.getByRole('region', { name: 'By group' })).toContainText('College')
  await expect(page.getByRole('region', { name: /Not seen yet in/ })).toContainText('Kim')
})

test('switches to last year', async ({ page }) => {
  const lastYear = new Date().getFullYear() - 1
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { date: `${lastYear}-06-01` })
  await goToTab(page, 'Stats')
  await expect(page.getByText('0 meetups with 0 friends.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Show ${lastYear}` }).click()
  await expect(page.getByText('1 meetup with 1 friend.', { exact: true })).toBeVisible()
})

test('opening a friend from Stats goes back to Stats', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await goToTab(page, 'Stats')
  await page.getByRole('region', { name: 'Top friends' }).getByRole('link', { name: /Alex/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Stats' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await page.getByRole('button', { name: 'Stats' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Stats' })).toBeVisible()
})
