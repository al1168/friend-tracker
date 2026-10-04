import { expect, test } from '@playwright/test'
import { addFriend, logMeetup, openFriendPage, tinyPhoto } from './helpers.ts'

/** Today as the app writes it in the current year ("Sat, Oct 3"). */
function todayLabel(): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())
}

test('shows who, what you did, the note and the photos', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await addFriend(page, 'Sam')
  await logMeetup(page, ['Alex', 'Sam'], {
    type: 'Meal',
    activities: ['Karaoke', 'Pottery class'],
    note: 'Tacos',
    photos: [tinyPhoto('one.png'), tinyPhoto('two.png')],
  })
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await expect(page.getByText(todayLabel(), { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Alex' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Friends' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  // (The text includes each avatar's initials, so check that it contains the names.)
  await expect(page.getByRole('list', { name: 'With' }).getByRole('link')).toContainText(['Alex', 'Sam'])
  await expect(page.getByRole('region', { name: 'Activities' }).getByRole('listitem')).toHaveText([
    'Karaoke',
    'Pottery class',
  ])
  await expect(page.getByRole('region', { name: 'Note' })).toContainText('Tacos')
  const photos = page.getByRole('region', { name: 'Photos' }).getByRole('img')
  await expect(photos).toHaveCount(2)
  await expect(photos.nth(1)).toHaveAccessibleName('Photo 2 of 2')

  // A friend opens from here, and comes back to the meetup.
  await page.getByRole('list', { name: 'With' }).getByRole('link', { name: 'Sam' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sam' })).toBeVisible()
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await page.getByRole('button', { name: 'Alex' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
})

test('hides what a meetup does not have, and marks one that is upcoming', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { date: '2099-01-01' })
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  await expect(page.getByText('Upcoming', { exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'With' }).getByRole('link')).toContainText(['Alex'])
  for (const name of ['Activities', 'Note', 'Photos']) {
    await expect(page.getByRole('region', { name })).toHaveCount(0)
  }
})

test('redirects to Friends for an unknown meetup', async ({ page }) => {
  await page.goto('/#/meetups/nope')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})
