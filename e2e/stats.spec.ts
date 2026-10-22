import { expect, test } from '@playwright/test'
import { addFriend, friendRow, goToTab, logMeetup, meetupRow, seedMeetups } from './helpers.ts'

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
  const currentYear = new Date().getFullYear()
  const lastYear = currentYear - 1
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { date: `${lastYear}-06-01` })
  await goToTab(page, 'Stats')
  await expect(page.getByText(`No meetups in ${currentYear} yet.`, { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `Show ${currentYear + 1}` })).toBeDisabled()
  await page.getByRole('button', { name: `Show ${lastYear}` }).click()
  await expect(page.getByText('1 meetup with 1 friend.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: `Show ${lastYear - 1}` })).toBeDisabled()
})

test('opening a friend from Stats goes back to Stats', async ({ page }) => {
  const lastYear = new Date().getFullYear() - 1
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { date: `${lastYear}-06-01` })
  await logMeetup(page, ['Alex'])
  await goToTab(page, 'Stats')
  await page.getByRole('button', { name: `Show ${lastYear}` }).click()
  await page.getByRole('region', { name: 'Top friends' }).getByRole('link', { name: /Alex/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Stats' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await page.getByRole('button', { name: 'Stats' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Stats' })).toBeVisible()
  await expect(page.getByText('1 meetup with 1 friend.', { exact: true })).toBeVisible()
  await expect(page.getByText(String(lastYear), { exact: true })).toBeVisible()
})

/** Thu, Oct 22, 2026, 12:00 PM on the phone's clock. */
const OCT_22_NOON = new Date(2026, 9, 22, 12)

test('this year is compared with last year up to the same date, then with all of last year', async ({ page }) => {
  await page.clock.setFixedTime(OCT_22_NOON)
  await page.goto('/')
  await seedMeetups(page, {
    friends: [friendRow('alex', 'Alex'), friendRow('sam', 'Sam')],
    meetups: [
      meetupRow('mar3', '2025-03-03', ['alex']),
      meetupRow('oct22', '2025-10-22', ['sam']),
      meetupRow('oct23', '2025-10-23', ['alex']),
      meetupRow('feb1', '2026-02-01', ['alex']),
      meetupRow('oct1', '2026-10-01', ['sam']),
    ],
  })
  await goToTab(page, 'Stats')
  await expect(page.locator('.stats-lead p')).toHaveText([
    '2 meetups with 2 friends.',
    'By Oct 22 last year: 2 meetups.',
    'All of 2025: 3 meetups with 2 friends.',
  ])
  // Last year, as a whole year against the one before it, which is before the first meetup: one line.
  await page.getByRole('button', { name: 'Show 2025' }).click()
  await expect(page.locator('.stats-lead p')).toHaveText(['3 meetups with 2 friends.'])
})

test('the first year is never compared with the year before it', async ({ page }) => {
  await page.clock.setFixedTime(OCT_22_NOON)
  await page.goto('/')
  await seedMeetups(page, {
    friends: [friendRow('alex', 'Alex', { groupId: 'college' })],
    groups: [{ id: 'college', name: 'College' }],
    meetups: [meetupRow('one', '2026-10-01', ['alex'])],
  })
  await goToTab(page, 'Stats')
  await expect(page.locator('.stats-lead p')).toHaveText(['1 meetup with 1 friend.'])
  await expect(page.getByRole('main')).not.toContainText('2025')
  // One year to show: the year alone, with no arrows.
  await expect(page.getByRole('group', { name: 'Year' })).toHaveText('2026')
  await expect(page.getByRole('group', { name: 'Year' }).getByRole('button')).toHaveCount(0)
  await expect(page.locator('.top-count__previous')).toHaveCount(0)
  await expect(page.locator('.hbars__bar--previous')).toHaveCount(0)
  await expect(page.locator('.hbars__bar--current')).toHaveCount(2)
})

test('a past year is compared with the one before only when that one had meetups', async ({ page }) => {
  await page.clock.setFixedTime(OCT_22_NOON)
  await page.goto('/')
  await seedMeetups(page, {
    friends: [friendRow('alex', 'Alex')],
    meetups: [
      meetupRow('y24', '2024-05-01', ['alex']),
      meetupRow('y25', '2025-05-01', ['alex']),
      meetupRow('y26', '2026-05-01', ['alex']),
    ],
  })
  await goToTab(page, 'Stats')
  await expect(page.getByRole('group', { name: 'Year' }).getByRole('button')).toHaveCount(2)
  await page.getByRole('button', { name: 'Show 2025' }).click()
  await expect(page.locator('.stats-lead p')).toHaveText(['1 meetup with 1 friend.', '2024: 1 meetup with 1 friend.'])
  await expect(page.locator('.top-count__previous')).toHaveText(['2024: 1'])
  await page.getByRole('button', { name: 'Show 2024' }).click()
  await expect(page.locator('.stats-lead p')).toHaveText(['1 meetup with 1 friend.'])
  await expect(page.locator('.top-count__previous')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Show 2023' })).toBeDisabled()
})

test('"Not seen in" a year leaves out friends added after it', async ({ page }) => {
  await page.clock.setFixedTime(OCT_22_NOON)
  await page.goto('/')
  await seedMeetups(page, {
    friends: [
      friendRow('alex', 'Alex', { createdAt: '2025-02-01T12:00:00.000Z' }),
      friendRow('kim', 'Kim', { createdAt: '2025-02-01T12:00:00.000Z' }),
      friendRow('newbie', 'Newbie', { createdAt: '2026-05-01T12:00:00.000Z' }),
    ],
    meetups: [meetupRow('y25', '2025-05-01', ['alex']), meetupRow('y26', '2026-05-01', ['alex'])],
  })
  await goToTab(page, 'Stats')
  const notSeen = (name: string) => page.getByRole('region', { name })
  await expect(notSeen('Not seen yet in 2026').getByRole('link')).toHaveText([/Kim$/, /Newbie$/])
  await page.getByRole('button', { name: 'Show 2025' }).click()
  await expect(notSeen('Not seen in 2025').getByRole('link')).toHaveText([/Kim$/])
})
