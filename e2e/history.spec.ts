import { expect, test, type Locator, type Page } from '@playwright/test'
import { OWNER_DAY_TYPED } from '../src/test/dayFixtures.ts'
import {
  enterPin,
  friendLink,
  friendRow,
  lockHeading,
  logMeetup,
  meetupRow,
  photoRow,
  seedAppLock,
  seedMeetups,
} from './helpers.ts'

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

/** On the Friends tab: opens the Meetups page from "See all meetups". */
async function openMeetups(page: Page) {
  await recentGroup(page).getByRole('link', { name: 'See all meetups' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meetups' })).toBeVisible()
}

/** Every row title on the Meetups page, in order. */
function rowTitles(page: Page): Locator {
  return page.locator('.inset-group .row__title')
}

/** The Meetups page's rows. */
function meetupRows(page: Page): Locator {
  return page.locator('.inset-group__body > a.row')
}

/** The ISO date `days` before `iso`. */
function daysBefore(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10)
}

/**
 * 130 Coffees with Sam, newest first as rows 1 to 130, each with the note "Visit N": rows 1 to 120 from Oct 5
 * back to Sep 1 (so row 61 continues September), rows 121 to 130 in August. 100 of them have a photo. Their
 * subtitles run about 33 characters: one line without a thumbnail, two with one.
 */
function longHistory(): Parameters<typeof seedMeetups>[1] {
  const meetups = Array.from({ length: 130 }, (_, i) => {
    const date = i < 120 ? daysBefore('2026-10-05', Math.floor((i * 35) / 120)) : daysBefore('2026-08-30', i - 120)
    // Logged a minute apart, later rows earlier, so same-day rows keep their numbers in order.
    const createdAt = new Date(Date.UTC(2026, 9, 6) - i * 60_000).toISOString()
    return meetupRow(`m${i + 1}`, date, ['sam'], { note: `Visit ${i + 1}`, createdAt })
  })
  const photos = meetups.filter((_, i) => i % 13 < 10).map((meetup) => photoRow(`photo-${meetup.id}`, meetup.id))
  return { friends: [SAM], meetups, photos }
}

/** Row N of the long history (1-based), by its note. */
function visit(page: Page, n: number): Locator {
  return page.getByRole('link', { name: new RegExp(`Visit ${n}$`) })
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

test('Recent meetups stops a subtitle at two lines; the Meetups page shows it all', async ({ page }) => {
  const friends = [friendRow('mariya', 'Mariya'), friendRow('jessie', 'Jessie'), friendRow('brandon', 'Brandon')]
  const owners = meetupRow('owners', '2026-10-03', ['mariya', 'jessie', 'brandon'], {
    typeId: 'type-meal',
    activities: ['Movie', 'Shopping'],
    note: OWNER_DAY_TYPED,
  })
  await openWith(page, { friends, meetups: [owners] })
  const row = recentGroup(page).getByRole('link', { name: /^Meal/ })
  const clamp = row.locator('.meetup-row__clamp')
  const lines = (element: Element) => ({
    height: element.getBoundingClientRect().height,
    line: parseFloat(getComputedStyle(element).lineHeight),
  })
  const clamped = await clamp.evaluate(lines)
  expect(clamped.height, 'Two lines at most').toBeLessThanOrEqual(2 * clamped.line + 1)
  // VoiceOver still reads the whole subtitle.
  await expect(row).toHaveAccessibleName(
    /· with Mariya, Jessie and Brandon · Movie, Shopping · nonstopstyle, strand bookstore, Sammy L coffee and 5 more/,
  )

  await openMeetups(page)
  const full = await page
    .getByRole('region', { name: 'October 2026' })
    .getByRole('link', { name: /^Meal/ })
    .locator('.row__subtitle')
    .evaluate(lines)
  expect(full.height, 'More than two lines').toBeGreaterThan(2 * full.line + 1)
})

test('See all opens the Meetups page: Upcoming, then each month', async ({ page }) => {
  const trip = meetupRow('trip', '2025-12-24', ['sam'], { typeId: 'type-trip' })
  const activity = meetupRow('activity', '2026-10-12', ['alex'], { typeId: 'type-activity' })
  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: [...PAST, PARTY, trip, activity] })
  await openMeetups(page)
  await expect(page).toHaveTitle('Meetups · Friend Tracker')
  await expect(page.locator('header.navbar .navbar__back')).toHaveText('Friends')
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Friends' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.locator('.inset-group .group-title')).toHaveText([
    'Upcoming',
    'October 2026',
    'September 2026',
    'December 2025',
  ])
  const titlesIn = (name: string) => page.getByRole('region', { name }).locator('.row__title')
  await expect(titlesIn('Upcoming')).toHaveText(['Party', 'Activity'])
  await expect(titlesIn('October 2026')).toHaveText(['Drinks', 'Meal'])
  await expect(titlesIn('September 2026')).toHaveText(['Coffee', 'Call'])
  await expect(titlesIn('December 2025')).toHaveText(['Trip'])

  // The group's title says it, so its rows don't; Kim's History still does.
  const party = page.getByRole('region', { name: 'Upcoming' }).getByRole('link', { name: /^Party/ })
  await expect(party).toHaveAccessibleName(/^Party\s*Thu, Oct 8 · with Kim$/)
  await page.locator('header.navbar .navbar__back').click()
  await friendLink(page, 'Kim').click()
  const kimsParty = page.getByRole('region', { name: 'History' }).getByRole('link', { name: /^Party/ })
  await expect(kimsParty).toHaveAccessibleName(/^Party\s*Upcoming/)
})

test('the Meetups search finds memories by their words', async ({ page }) => {
  const karaoke = meetupRow('karaoke', '2026-09-20', ['kim'], {
    typeId: 'type-activity',
    activities: ['Karaoke'],
    weather: ['rainy'],
  })
  const soup = meetupRow('soup', '2026-09-18', ['sam'], {
    typeId: 'type-meal',
    note: '@Blue willow 3:30\nThe soup didn’t last',
  })
  const felt = meetupRow('felt', '2026-09-15', ['kim'], { feelings: 'Felt almost outsidery, and that was fine' })
  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: [...PAST, PARTY, karaoke, soup, felt] })
  await openMeetups(page)
  const search = page.getByRole('searchbox', { name: 'Search meetups' })
  const titles = rowTitles(page)

  const expected: [string, string[]][] = [
    ['alex', ['Meal', 'Coffee']],
    ['MEAL', ['Meal', 'Meal']],
    ['karaoke', ['Activity']],
    ['blue willow', ['Meal']],
    ['soup', ['Meal']],
    ['outsidery', ['Coffee']],
    ["didn't", ['Meal']],
    ['sam tacos', ['Meal']],
  ]
  for (const [query, rows] of expected) {
    await search.fill(query)
    await expect(titles, `"${query}"`).toHaveText(rows)
  }

  await search.fill('zebra')
  await expect(page.locator('.list-message')).toHaveText('No meetups match “zebra”.')
  await expect(titles).toHaveCount(0)
  // Read out once typing pauses.
  await expect(page.locator('.meetups-announcer')).toHaveText('No meetups match “zebra”.')

  // Weather is never searched.
  await search.fill('rainy')
  await expect(page.locator('.list-message')).toHaveText('No meetups match “rainy”.')

  await search.fill('')
  await expect(page.locator('.inset-group .group-title')).toHaveText(['Upcoming', 'October 2026', 'September 2026'])
  await expect(titles).toHaveCount(8)
  await expect(page.locator('.meetups-announcer')).toHaveText('')
})

test('a meetup opened from Meetups goes back to the same search', async ({ page }) => {
  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: PAST })
  await openMeetups(page)
  const search = page.getByRole('searchbox', { name: 'Search meetups' })
  await search.fill('tacos')
  await expect(rowTitles(page)).toHaveText(['Meal'])
  await expect(page.locator('.meetups-announcer')).toHaveText('1 meetup matches.')

  await page.getByRole('link', { name: /^Meal/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await expect(page.locator('header.navbar .navbar__back')).toHaveText('Meetups')
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit meetup' })
  await sheet.getByRole('button', { name: 'Drinks', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Drinks' })).toBeVisible()

  await page.locator('header.navbar .navbar__back').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meetups' })).toBeVisible()
  await expect(search).toHaveValue('tacos')
  await expect(rowTitles(page)).toHaveText(['Drinks'])
  // A restored search isn't read out again.
  await page.waitForTimeout(1000)
  await expect(page.locator('.meetups-announcer')).toHaveText('')
})

test('deleting a meetup from Meetups goes back to the list, and Undo puts it back', async ({ page }) => {
  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: PAST })
  await openMeetups(page)
  const september = page.getByRole('region', { name: 'September 2026' })
  await september.getByRole('link', { name: /^Coffee/ }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('dialog', { name: 'Edit meetup' }).getByRole('button', { name: 'Delete meetup' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meetups' })).toBeVisible()
  await expect(september.locator('.row__title')).toHaveText(['Call'])
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(september.locator('.row__title')).toHaveText(['Coffee', 'Call'])
})

test('a long history shows 60 rows at a time and keeps its place', async ({ page }) => {
  await openWith(page, longHistory())
  await openMeetups(page)
  const rows = meetupRows(page)
  const more = page.getByRole('button', { name: 'Show older meetups' })
  await expect(rows).toHaveCount(60)
  await expect(more).toBeVisible()

  // A tap: focus goes to the first row it added, which continues September, with no ring drawn.
  await more.tap()
  await expect(rows).toHaveCount(120)
  await expect(visit(page, 61)).toBeFocused()
  expect(await page.evaluate(() => document.querySelectorAll(':focus-visible').length), 'No focus ring').toBe(0)

  // The keyboard: the first row added opens August, so its heading takes focus. Nothing is left to show.
  await more.focus()
  await more.press('Enter')
  await expect(rows).toHaveCount(130)
  await expect(page.getByRole('heading', { name: 'August 2026' })).toBeFocused()
  await expect(more).toHaveCount(0)

  await expect(visit(page, 1).locator('img.history-thumb')).toHaveAttribute('src', /^data:image\/png/)
  await expect(visit(page, 11).locator('.meetup-thumb')).toHaveCount(0)

  // Open row 100 and come back: every row still shows, and row 100 is where it was.
  await visit(page, 100).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  await page.locator('header.navbar .navbar__back').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meetups' })).toBeVisible()
  await expect(rows).toHaveCount(130)
  await expect(visit(page, 100)).toBeInViewport()
  const tops = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const row = [...document.querySelectorAll('.inset-group__body > a.row')][99]
        const seen: number[] = []
        const read = () => {
          seen.push(row.getBoundingClientRect().top)
          if (seen.length < 10) requestAnimationFrame(read)
          else resolve(seen)
        }
        requestAnimationFrame(read)
      }),
  )
  for (const top of tops) expect(Math.abs(top - tops[0]), 'Row 100 stays put').toBeLessThanOrEqual(1)
})

test('the app lock starts the Meetups page fresh', async ({ page }) => {
  test.setTimeout(60_000)
  await page.clock.setFixedTime(MONDAY_NOON)
  await page.goto('/')
  await seedAppLock(page, '135790')
  await seedMeetups(page, longHistory())
  await openMeetups(page)
  const search = page.getByRole('searchbox', { name: 'Search meetups' })
  const rows = meetupRows(page)
  const more = page.getByRole('button', { name: 'Show older meetups' })
  // Every meetup is a Coffee.
  await search.fill('coffee')
  await expect(rows).toHaveCount(60)
  await more.click()
  await expect(rows).toHaveCount(120)

  // Hidden, 16 minutes, back: locked. Then the PIN.
  await page.evaluate(() => {
    const setVisibility = (state: DocumentVisibilityState) => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
      document.dispatchEvent(new Event('visibilitychange'))
    }
    setVisibility('hidden')
    localStorage.setItem('ft:lastActiveAt', String(Date.now() - 16 * 60_000))
    setVisibility('visible')
  })
  await expect(lockHeading(page)).toBeVisible()
  await enterPin(page, '135790')
  await expect(page.getByRole('heading', { level: 1, name: 'Meetups' })).toBeVisible()
  await expect(page).toHaveURL(/#\/meetups$/)
  await expect(search).toHaveValue('')
  await expect(rows).toHaveCount(60)
  await expect(more).toBeVisible()
})

test('Meetups with no meetups yet', async ({ page }) => {
  await openWith(page, { friends: [ALEX] })
  await page.goto('/#/meetups')
  await expect(page.getByText('No meetups yet.')).toBeVisible()
  await expect(page.getByText('Your first meetup will show up here.')).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Search meetups' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Log meetup' })).toBeVisible()

  await logMeetup(page, ['Alex'])
  await expect(page.getByRole('region', { name: 'October 2026' }).locator('.row__title')).toHaveText(['Coffee'])
})
