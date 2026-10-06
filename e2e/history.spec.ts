import { expect, test, type Locator, type Page } from '@playwright/test'
import { friendLink, friendRow, logMeetup, meetupRow, photoRow, seedMeetups } from './helpers.ts'

/** Mon, Oct 5, 2026, 12:00 PM on the phone's clock. */
const MONDAY_NOON = new Date(2026, 9, 5, 12)

const ALEX = friendRow('alex', 'Alex')
const SAM = friendRow('sam', 'Sam')
const KIM = friendRow('kim', 'Kim')

// Four meetups that happened, newest first: Drinks, Meal, Coffee, Call. And one upcoming Party.
const DRINKS = meetupRow('drinks', '2026-10-04', ['kim'], { typeId: 'type-drinks' })
const MEAL = meetupRow('meal', '2026-10-03', ['alex', 'sam'], { typeId: 'type-meal', note: 'Tacos' })
const COFFEE = meetupRow('coffee', '2026-09-25', ['alex'])
const CALL = meetupRow('call', '2026-09-05', ['sam'], { typeId: 'type-call' })
const PARTY = meetupRow('party', '2026-10-08', ['kim'], { typeId: 'type-party' })
const PAST = [DRINKS, MEAL, COFFEE, CALL]

function recentGroup(page: Page): Locator {
  return page.getByRole('region', { name: 'Recent meetups' })
}

/** On Mon, Oct 5, at noon: opens the app and seeds it. */
async function openWith(page: Page, seed: Parameters<typeof seedMeetups>[1]) {
  await page.clock.setFixedTime(MONDAY_NOON)
  await page.goto('/')
  await seedMeetups(page, seed)
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
}

/** The top of an element on screen, in CSS pixels. */
async function topOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Not on screen')
  return box.y
}

/** The top of the first element matching `selector`, read on each of the next `frames` animation frames. */
function topsOverFrames(page: Page, selector: string, frames = 10): Promise<number[]> {
  return page.evaluate(
    ({ selector, frames }) =>
      new Promise<number[]>((resolve) => {
        const element = document.querySelector(selector)
        if (!element) throw new Error(`No ${selector}`)
        const tops: number[] = []
        const read = () => {
          tops.push(element.getBoundingClientRect().top)
          if (tops.length < frames) requestAnimationFrame(read)
          else resolve(tops)
        }
        requestAnimationFrame(read)
      }),
    { selector, frames },
  )
}

test('Recent meetups shows the three latest that happened, naming everyone', async ({ page }) => {
  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: [...PAST, PARTY] })
  const recent = recentGroup(page)
  await expect(recent.locator('.row__title')).toHaveText(['Drinks', 'Meal', 'Coffee', 'See all meetups'])
  await expect(recent.getByRole('link', { name: /^Meal/ })).toHaveAccessibleName(
    /^Meal\s*Sat, Oct 3 · with Alex and Sam · Tacos$/,
  )
  await expect(recent).not.toContainText('Party')
  await expect(recent).not.toContainText('Call')
})

test('Recent meetups shows two while Birthdays soon shows', async ({ page }) => {
  const lee = friendRow('lee', 'Lee', { birthday: { month: 10, day: 8, year: null } })
  await openWith(page, { friends: [ALEX, SAM, KIM, lee], meetups: PAST })
  await expect(page.getByRole('region', { name: 'Birthdays soon' })).toContainText('Lee')
  await expect(recentGroup(page).locator('.row__title')).toHaveText(['Drinks', 'Meal', 'See all meetups'])

  // Two weeks on, no birthday is near: the third row comes back.
  await page.clock.setFixedTime(new Date(2026, 9, 20, 12))
  await page.reload()
  await expect(recentGroup(page).locator('.row__title')).toHaveText(['Drinks', 'Meal', 'Coffee', 'See all meetups'])
  await expect(page.getByRole('region', { name: 'Birthdays soon' })).toHaveCount(0)
})

test('Recent meetups hides while searching or filtering, and until a meetup has happened', async ({ page }) => {
  const work = { id: 'work', name: 'Work' }
  await openWith(page, { friends: [ALEX, { ...KIM, groupId: 'work' }], groups: [work], meetups: [PARTY] })
  await expect(friendLink(page, 'Alex')).toBeVisible()
  await expect(recentGroup(page)).toHaveCount(0)

  await logMeetup(page, ['Kim'], { date: '2026-10-01' })
  await expect(recentGroup(page).locator('.row__title')).toHaveText(['Coffee', 'See all meetups'])

  const search = page.getByLabel('Search friends')
  await search.fill('k')
  await expect(recentGroup(page)).toHaveCount(0)
  await search.fill('')
  await expect(recentGroup(page)).toBeVisible()

  const chips = page.getByRole('group', { name: 'Filter by group' })
  await chips.getByRole('button', { name: 'Work', exact: true }).click()
  await expect(recentGroup(page)).toHaveCount(0)
  await chips.getByRole('button', { name: 'All', exact: true }).click()
  await expect(recentGroup(page)).toBeVisible()
})

test('the search field stays put while the groups above it hide and come back', async ({ page }) => {
  const names = ['Aaron', 'Abby', 'Adam', 'Alana', 'Bianca', 'Carla', 'Dana', 'Ezra', 'Farah', 'Gina', 'Hana', 'Jada']
  // All in one group, so the page stays long enough to keep the field still on a search and on the group's chip.
  const friends = [
    ...names.map((name) => friendRow(name.toLowerCase(), name, { groupId: 'work' })),
    // In 3 days, so Birthdays soon shows.
    friendRow('lee', 'Lee', { birthday: { month: 10, day: 8, year: null } }),
  ]
  // About 33 characters: one line without a thumbnail, two with one.
  const meetups = [
    meetupRow('ramen', '2026-10-04', ['aaron'], { note: 'Ramen' }),
    meetupRow('tacos', '2026-10-03', ['bianca'], { typeId: 'type-meal', note: 'Tacos' }),
  ]
  await openWith(page, {
    friends,
    groups: [{ id: 'work', name: 'Work' }],
    meetups,
    photos: [photoRow('ramen-photo', 'ramen')],
  })
  await expect(page.getByRole('region', { name: 'Birthdays soon' })).toBeVisible()
  await expect(recentGroup(page).locator('img.history-thumb')).toHaveCount(1)

  // The search field just under the nav bar.
  const field = page.locator('.friends-filters .search')
  await page.evaluate(() => {
    const navbar = document.querySelector('header.navbar')!.getBoundingClientRect().bottom
    const top = document.querySelector('.friends-filters .search')!.getBoundingClientRect().top
    window.scrollBy(0, top - navbar - 8)
  })
  const start = await topOf(field)

  const search = page.getByLabel('Search friends')
  await search.fill('a')
  await expect(recentGroup(page)).toHaveCount(0)
  expect(Math.abs((await topOf(field)) - start), 'The field stays put when the groups hide').toBeLessThanOrEqual(4)
  await expect(page.locator('.friends-filters + .inset-group').getByRole('link').first()).toBeInViewport()

  await search.fill('')
  await expect(recentGroup(page)).toBeVisible()
  expect(Math.abs((await topOf(field)) - start), 'The field stays put when they come back').toBeLessThanOrEqual(4)
  await expect(page.locator('.friends-filters + .inset-group').getByRole('link').first()).toBeInViewport()
  // While Recent meetups comes back and its thumbnail arrives.
  for (const top of await topsOverFrames(page, '.friends-filters .search')) {
    expect(Math.abs(top - start), 'The field stays put as the thumbnail arrives').toBeLessThanOrEqual(4)
  }
  await expect(recentGroup(page).locator('img.history-thumb')).toHaveCount(1)

  const chips = page.getByRole('group', { name: 'Filter by group' })
  const chipsTop = await topOf(chips)
  await chips.getByRole('button', { name: 'Work', exact: true }).click()
  await expect(recentGroup(page)).toHaveCount(0)
  expect(Math.abs((await topOf(chips)) - chipsTop), 'The chips stay put on a group').toBeLessThanOrEqual(4)
  await chips.getByRole('button', { name: 'All', exact: true }).click()
  await expect(recentGroup(page)).toBeVisible()
  expect(Math.abs((await topOf(chips)) - chipsTop), 'The chips stay put on All').toBeLessThanOrEqual(4)
})

test('a recent meetup opens its page with "Friends" on the back button', async ({ page }) => {
  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: PAST })
  await recentGroup(page).getByRole('link', { name: /^Meal/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  const back = page.locator('header.navbar .navbar__back')
  await expect(back).toHaveText('Friends')
  await back.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  await expect(recentGroup(page)).toBeVisible()
})

test('the friend page still leaves its friend out', async ({ page }) => {
  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: PAST })
  const meal = recentGroup(page).getByRole('link', { name: /^Meal/ })
  await expect(meal).toHaveAccessibleName(/· with Alex and Sam · Tacos$/)
  await friendLink(page, 'Alex').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
  const history = page.getByRole('region', { name: 'History' })
  await expect(history.getByRole('link', { name: /^Meal/ })).toHaveAccessibleName(/· with Sam · Tacos$/)
})
