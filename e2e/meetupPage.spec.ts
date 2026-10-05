import { expect, test } from '@playwright/test'
import { addFriend, logMeetup, openDay, openFriendPage, readMeetups, tinyPhoto } from './helpers.ts'

/** Today as the app writes it in the current year ("Sat, Oct 3"). */
function todayLabel(): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())
}

test('shows who, what you did, the day and the photos', async ({ page }) => {
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
  await expect(page.getByRole('region', { name: 'The day' })).toContainText('Tacos')
  await expect(page.getByRole('link', { name: 'Edit the day' })).toBeVisible()
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
  for (const name of ['Activities', 'The day', 'How it felt', 'Photos']) {
    await expect(page.getByRole('region', { name, exact: true })).toHaveCount(0)
  }
  await expect(page.getByRole('link', { name: /^Write about the day/ })).toHaveAccessibleName(
    'Write about the day Places, what happened, how it felt',
  )
})

test('reads the day back: places in order with their times, paid tags, headings and prose', async ({ page }) => {
  await page.goto('/')
  for (const name of ['Jessie', 'Sam Lee', 'Sam Park']) await addFriend(page, name)
  await logMeetup(page, ['Jessie', 'Sam Lee', 'Sam Park'], {
    type: 'Meal',
    note: ['Rainy', 'Plan:', '@Cafe 10:30', 'Coffee', 'Jessie paid', '', '@Park', '@Bar 7-9pm', 'Sam paid', '', 'Home', '', '', 'Tired'].join(
      '\n',
    ),
  })
  await openFriendPage(page, 'Jessie')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  const day = page.getByRole('region', { name: 'The day' })

  const places = day.getByRole('list', { name: 'Places, 3 stops' })
  await expect(places.getByRole('heading', { level: 3 })).toHaveText(['Cafe', 'Park', 'Bar'])
  await expect(places.getByRole('listitem').nth(0)).toContainText('10:30')
  await expect(places.getByRole('listitem').nth(0).getByText('At 10:30', { exact: false })).toBeAttached()
  await expect(places.getByRole('listitem').nth(2).getByText(/^From 7:00.PM to 9:00.PM\.$/)).toBeAttached()
  await expect(day.getByRole('heading', { level: 3, name: 'Plan' })).toBeVisible()
  // "Jessie paid" names one friend, so it gets her face; "Sam paid" fits two, so it gets none.
  const jessiePaid = places.getByRole('listitem').nth(0).locator('.paid-tag')
  await expect(jessiePaid).toHaveText(/Jessie paid$/)
  await expect(jessiePaid.locator('.avatar')).toHaveCount(1)
  await expect(places.getByRole('listitem').nth(2).locator('.paid-tag .avatar')).toHaveCount(0)
  await expect(day.locator('.day-prose')).toHaveText([/^Rainy$/, /^Home\s*Tired$/])
  await expect(day.locator('.day-gap')).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'How it felt' })).toHaveCount(0)
})

test('shows the weather in the hero and how it felt, and never in the history', async ({ page }) => {
  // Written with stray spaces and blank lines around it, which are kept but not shown.
  const felt = '\n  Easy and warm.  \nWould go again.\n\n'
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { type: 'Meal' })
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await openDay(page)
  await page.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Windy' }).click()
  await page.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Rainy' }).click()
  await page.getByRole('group', { name: 'Mood' }).getByRole('button', { name: 'Good' }).click()
  await page.getByRole('textbox', { name: 'How it felt, in your words' }).fill(felt)
  await page.getByRole('button', { name: 'Meal' }).click()

  await expect(page.getByText(`${todayLabel()} · 🌧️ Rainy, 🌬️ Windy`, { exact: true })).toBeVisible()
  // Each weather keeps its emoji and word together when the line wraps at large text sizes.
  await expect(page.locator('.meetup-hero__weather')).toHaveText(['🌧️ Rainy', '🌬️ Windy'])
  await expect(page.locator('.meetup-hero__weather').first()).toHaveCSS('white-space', 'nowrap')
  const feltBox = page.getByRole('region', { name: 'How it felt' })
  await expect(feltBox.getByText('Mood: Good')).toBeVisible()
  expect(await feltBox.locator('.felt-box__words').evaluate((words) => words.textContent)).toBe(
    'Easy and warm.\nWould go again.',
  )
  expect((await readMeetups(page))[0].feelings).toBe(felt)
  await expect(page.getByRole('region', { name: 'The day' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Edit the day' })).toBeVisible()

  await page.getByRole('button', { name: 'Alex' }).click()
  const row = page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ })
  await expect(row).not.toContainText('Rainy')
  await expect(row).not.toContainText('Good')
})

test('redirects to Friends for an unknown meetup', async ({ page }) => {
  await page.goto('/#/meetups/nope')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})

test('the photo viewer goes through the photos and gives focus back to the thumbnail', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { photos: [tinyPhoto('one.png'), tinyPhoto('two.png'), tinyPhoto('three.png')] })
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()
  const thumbnails = page.getByRole('region', { name: 'Photos' }).getByRole('button')

  await thumbnails.first().click()
  const viewer = page.getByRole('dialog', { name: 'Photo 1 of 3' })
  await expect(viewer).toBeVisible()
  await expect(viewer.getByRole('button', { name: 'Close' })).toBeFocused()
  await expect(viewer.getByRole('img')).toHaveAccessibleName(`Photo 1 of 3, Coffee, ${todayLabel()}`)
  await expect(viewer.getByRole('img')).toHaveAttribute('src', /^data:image\/jpeg/)
  await expect(viewer.getByText('1 of 3', { exact: true })).toBeVisible()
  await expect(viewer.getByRole('button', { name: 'Previous photo' })).toHaveAttribute('aria-disabled', 'true')

  await viewer.getByRole('button', { name: 'Next photo' }).click()
  const second = page.getByRole('dialog', { name: 'Photo 2 of 3' }).getByRole('img')
  await expect(second).toBeVisible()
  // The next photo slides in from the right.
  expect(await second.evaluate((element) => getComputedStyle(element).animationName)).toBe('viewer-from-next')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: 'Photo 3 of 3' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next photo' })).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('dialog', { name: 'Photo 2 of 3' })).toBeVisible()

  // Focus stays inside: Shift+Tab from Close goes round to Next.
  await page.getByRole('button', { name: 'Close' }).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Next photo' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(thumbnails.nth(1)).toBeFocused()

  await thumbnails.nth(2).click()
  await page.getByRole('dialog', { name: 'Photo 3 of 3' }).getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(thumbnails.nth(2)).toBeFocused()
})

test('the photo viewer changes photos with a swipe, and only fades with Reduce Motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { photos: [tinyPhoto('one.png'), tinyPhoto('two.png')] })
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()
  await page.getByRole('region', { name: 'Photos' }).getByRole('button').first().click()
  await expect(page.getByRole('dialog', { name: 'Photo 1 of 2' })).toBeVisible()

  // A swipe to the left shows the next photo, to the right the previous one.
  await page.mouse.move(300, 400)
  await page.mouse.down()
  await page.mouse.move(120, 410, { steps: 5 })
  await page.mouse.up()
  const image = page.getByRole('dialog', { name: 'Photo 2 of 2' }).getByRole('img')
  await expect(image).toBeVisible()
  expect(await image.evaluate((element) => getComputedStyle(element).animationName)).toBe('fade-in')

  await page.mouse.move(100, 400)
  await page.mouse.down()
  await page.mouse.move(300, 395, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByRole('dialog', { name: 'Photo 1 of 2' })).toBeVisible()
})
