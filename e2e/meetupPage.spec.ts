import { expect, test, type Page } from '@playwright/test'
import {
  addFriend,
  brokenPhoto,
  friendRow,
  logMeetup,
  meetupRow,
  openDay,
  openFriendPage,
  photoRow,
  readMeetupPhotos,
  readMeetups,
  seedMeetups,
  tinyPhoto,
} from './helpers.ts'

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
  for (const name of ['Activities', 'The day', 'How it felt']) {
    await expect(page.getByRole('region', { name, exact: true })).toHaveCount(0)
  }
  // Photos always shows, here with only its Add photos tile.
  const photos = page.getByRole('region', { name: 'Photos' })
  await expect(photos.getByRole('button')).toHaveText(['Add photos'])
  await expect(photos.getByRole('img')).toHaveCount(0)
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

/** Opens the Meetup page of a Coffee with Alex logged today. */
async function openCoffee(page: Page) {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await page.getByRole('region', { name: 'Recent meetups' }).getByRole('link', { name: /^Coffee/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
}

test('the sections come in the order Activities, Photos, The day, How it felt, then the day row', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { type: 'Meal', activities: ['Karaoke'], note: 'Tacos' })
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await openDay(page)
  await page.getByRole('group', { name: 'Mood' }).getByRole('button', { name: 'Good' }).click()
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()

  await expect(page.locator('.page__body > .section > .group-title')).toHaveText([
    'Activities',
    'Photos',
    'The day',
    'How it felt',
  ])
  // The day row comes last.
  await expect(page.locator('.page__body > .inset-group').last()).toContainText('Edit the day')
})

test('adds photos right from the Meetup page, and Undo takes the batch back', async ({ page }) => {
  await openCoffee(page)
  const photos = page.getByRole('region', { name: 'Photos' })
  const thumbnails = photos.getByRole('img')
  await expect(photos.getByRole('button', { name: 'Add photos' })).toBeVisible()

  await page.locator('input[type="file"]').setInputFiles([tinyPhoto('one.png'), tinyPhoto('two.png')])

  // Saved at once, with no Edit sheet.
  await expect(thumbnails).toHaveCount(2)
  await expect(thumbnails.nth(1)).toHaveAccessibleName('Photo 2 of 2')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect.poll(async () => (await readMeetupPhotos(page)).length).toBe(2)
  const toast = page.getByRole('status')
  await expect(toast).toContainText('Added 2 photos')
  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeEnabled()
  // The last tile is still Add photos.
  await expect(photos.getByRole('button').last()).toHaveAccessibleName('Add photos')

  await toast.getByRole('button', { name: 'Undo' }).click()
  await expect(thumbnails).toHaveCount(0)
  await expect.poll(async () => (await readMeetupPhotos(page)).length).toBe(0)
})

test('a photo that cannot be read is skipped with a hint, and the rest are added', async ({ page }) => {
  await openCoffee(page)
  const photos = page.getByRole('region', { name: 'Photos' })
  await page.locator('input[type="file"]').setInputFiles([tinyPhoto('one.png'), brokenPhoto()])
  await expect(photos.getByRole('img')).toHaveCount(1)
  await expect(photos.getByRole('alert')).toHaveText("1 photo couldn't be added.")
  await expect(page.getByRole('status')).toContainText('Added 1 photo')
})

test('with 19 photos, choosing 3 adds 1 and says a meetup can have up to 20', async ({ page }) => {
  await page.goto('/')
  const meetup = meetupRow('coffee', '2026-10-01', ['alex'])
  const nineteen = Array.from({ length: 19 }, (_, i) => ({ ...photoRow(`p${i}`, 'coffee'), order: i }))
  await seedMeetups(page, { friends: [friendRow('alex', 'Alex')], meetups: [meetup], photos: nineteen })
  await page.goto('/#/meetups/coffee')
  const photos = page.getByRole('region', { name: 'Photos' })
  await expect(photos.getByRole('img')).toHaveCount(19)

  await page.locator('input[type="file"]').setInputFiles([tinyPhoto('a.png'), tinyPhoto('b.png'), tinyPhoto('c.png')])

  await expect(photos.getByRole('img')).toHaveCount(20)
  await expect(photos.getByRole('alert')).toHaveText('A meetup can have up to 20 photos.')
  await expect(page.getByRole('status')).toContainText('Added 1 photo')
  expect((await readMeetupPhotos(page)).find((photo) => !photo.id.startsWith('p'))?.order).toBe(19)

  // Full: the tile says so instead of opening the picker.
  await photos.getByRole('button', { name: 'Add photos' }).click()
  await expect(photos.getByRole('alert')).toHaveText('A meetup can have up to 20 photos.')
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

test('at an accessibility text size "Add photos" wraps between its words, never inside one, and stays in its tile', async ({
  page,
}) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await page.addStyleTag({ content: 'html { font: 33px/1.35 -apple-system, system-ui, sans-serif !important; }' })
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()
  const tile = page.getByRole('region', { name: 'Photos' }).getByRole('button', { name: 'Add photos' })
  await expect(tile).toBeVisible()

  const words = await tile.evaluate((button) => {
    const box = button.getBoundingClientRect()
    const label = button.querySelector('span')?.firstChild
    if (!label?.textContent) throw new Error('No label')
    return [...label.textContent.matchAll(/\S+/g)].map((match) => {
      const range = document.createRange()
      range.setStart(label, match.index)
      range.setEnd(label, match.index + match[0].length)
      const rects = [...range.getClientRects()]
      return {
        word: match[0],
        lines: new Set(rects.map((rect) => Math.round(rect.top))).size,
        inside: rects.every((rect) => rect.left >= box.left && rect.right <= box.right),
      }
    })
  })
  expect(words).toEqual([
    { word: 'Add', lines: 1, inside: true },
    { word: 'photos', lines: 1, inside: true },
  ])
})
