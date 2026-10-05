import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import {
  addFriend,
  addPhotos,
  brokenPhoto,
  drawnPhoto,
  editMeetup,
  goToTab,
  imageSize,
  logMeetup,
  openFriendPage,
  photoGrid,
  pickActivity,
  readMeetupPhotos,
  tinyPhoto,
} from './helpers.ts'

test('logs a meetup with activities, one of them new, and two photos', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
  const activities = sheet.getByRole('group', { name: 'Activities' })
  // The starters, in order, then "+ New".
  await expect(activities.getByRole('button').first()).toHaveText('Board games')
  await pickActivity(sheet, 'Karaoke')
  await pickActivity(sheet, 'Pottery class')
  await expect(sheet.getByRole('textbox', { name: 'New activity' })).toBeHidden()
  await expect(activities.getByRole('button', { name: 'New activity' })).toBeFocused()
  await addPhotos(sheet, [tinyPhoto('one.png'), tinyPhoto('two.png')])
  await expect(photoGrid(sheet).getByRole('img', { name: 'Photo 2' })).toHaveAttribute('src', /^data:image\/jpeg/)
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()

  await openFriendPage(page, 'Alex')
  const edit = await editMeetup(page, /Coffee/)
  const picked = edit.getByRole('group', { name: 'Activities' }).locator('[aria-pressed="true"]')
  await expect(picked).toHaveText(['Karaoke', 'Pottery class'])
  await expect(photoGrid(edit).getByRole('img')).toHaveCount(2)
  const stored = await readMeetupPhotos(page)
  expect(stored.map((photo) => photo.order).sort()).toEqual([0, 1])
})

test('suggests activities used before first, and shows the rest with More', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { activities: ['Pottery class', 'Arcade', 'Karaoke'] })
  await logMeetup(page, ['Alex'], { activities: ['Arcade', 'Bowling'] })

  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  const activities = sheet.getByRole('group', { name: 'Activities' })
  // Used before (most used first, then by name), then the starters: 13 in all, 12 shown.
  await expect(activities.locator('.chip--wrap')).toHaveText([
    'Arcade',
    'Bowling',
    'Karaoke',
    'Pottery class',
    'Board games',
    'Movie',
    'Walk',
    'Concert',
    'Shopping',
    'Cooking',
    'Sports',
    'Beach',
  ])
  await activities.getByRole('button', { name: 'More activities' }).click()
  await expect(activities.locator('.chip--wrap')).toHaveCount(13)
  await expect(activities.getByRole('button', { name: 'Museum' })).toBeFocused()
  await expect(activities.getByRole('button', { name: 'More activities' })).toHaveCount(0)
})

test('shrinks a large photo to 1600 pixels with a 320 pixel thumbnail', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { photos: [await drawnPhoto(page, 'wide.png', 2000, 1000)] })

  const [photo] = await readMeetupPhotos(page)
  expect(photo).toMatchObject({ width: 1600, height: 800 })
  expect(photo.full).toMatch(/^data:image\/jpeg;base64,/)
  expect(photo.thumb).toMatch(/^data:image\/jpeg;base64,/)
  expect(await imageSize(page, photo.full)).toEqual({ width: 1600, height: 800 })
  expect(await imageSize(page, photo.thumb)).toEqual({ width: 320, height: 160 })
})

test('skips a photo that cannot be read, and photos past 20', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  const input = sheet.locator('input[type="file"]')
  const thumbnails = photoGrid(sheet).getByRole('img')

  await input.setInputFiles([brokenPhoto(), tinyPhoto()])
  await expect(thumbnails).toHaveCount(1)
  await expect(sheet.getByRole('alert')).toHaveText("1 photo couldn't be added.")

  await input.setInputFiles(Array.from({ length: 20 }, (_, i) => tinyPhoto(`photo-${i}.png`)))
  await expect(thumbnails).toHaveCount(20)
  await expect(sheet.getByRole('alert')).toHaveText('A meetup can have up to 20 photos.')

  // Full: the Add photos tile says so instead of opening the picker.
  await photoGrid(sheet).getByRole('button', { name: 'Add photos' }).click()
  await expect(sheet.getByRole('alert')).toHaveText('A meetup can have up to 20 photos.')
})

test('Cancel discards photo changes', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { activities: ['Karaoke'], photos: [tinyPhoto('one.png'), tinyPhoto('two.png')] })

  await openFriendPage(page, 'Alex')
  let sheet = await editMeetup(page, /Coffee/)
  await photoGrid(sheet).getByRole('button', { name: 'Remove photo 1' }).click()
  await expect(photoGrid(sheet).getByRole('img')).toHaveCount(1)
  await expect(photoGrid(sheet).getByRole('button', { name: 'Remove photo 1' })).toBeFocused()
  await sheet.getByRole('group', { name: 'Activities' }).getByRole('button', { name: 'Karaoke' }).click()
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(sheet).toBeHidden()

  await openFriendPage(page, 'Alex')
  sheet = await editMeetup(page, /Coffee/)
  await expect(photoGrid(sheet).getByRole('img')).toHaveCount(2)
  await expect(sheet.getByRole('group', { name: 'Activities' }).getByRole('button', { name: 'Karaoke' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('Save removes a photo', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { activities: ['Karaoke'], photos: [tinyPhoto('one.png'), tinyPhoto('two.png')] })

  await openFriendPage(page, 'Alex')
  let sheet = await editMeetup(page, /Coffee/)
  await photoGrid(sheet).getByRole('button', { name: 'Remove photo 2' }).click()
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()

  await openFriendPage(page, 'Alex')
  sheet = await editMeetup(page, /Coffee/)
  await expect(photoGrid(sheet).getByRole('img')).toHaveCount(1)
  expect(await readMeetupPhotos(page)).toHaveLength(1)
})

test('deleting a meetup and Undo bring its photos back', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { photos: [tinyPhoto('one.png'), tinyPhoto('two.png')] })

  await openFriendPage(page, 'Alex')
  const sheet = await editMeetup(page, /Coffee/)
  await sheet.getByRole('button', { name: 'Delete meetup' }).click()
  await expect(page.getByRole('status')).toContainText('Meetup deleted')
  expect(await readMeetupPhotos(page)).toHaveLength(0)
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()

  await openFriendPage(page, 'Alex')
  const restored = await editMeetup(page, /Coffee/)
  await expect(photoGrid(restored).getByRole('img')).toHaveCount(2)
})

test('keeps photos and activities through a backup', async ({ page }) => {
  // Force the download path; the share sheet can't be driven in tests.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { activities: ['Karaoke'], photos: [tinyPhoto('one.png'), tinyPhoto('two.png')] })

  await goToTab(page, 'Settings')
  await expect(page.getByText('Never backed up. Includes 2 photos.')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.version).toBe(5)
  expect(backup.meetups[0].activities).toEqual(['Karaoke'])
  expect(backup.meetupPhotos).toHaveLength(2)

  await openFriendPage(page, 'Alex')
  const sheet = await editMeetup(page, /Coffee/)
  await sheet.getByRole('button', { name: 'Delete meetup' }).click()
  await goToTab(page, 'Settings')
  await expect(page.getByText(/Includes \d+ photos?\./)).toHaveCount(0)
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')
  await expect(page.getByText('Includes 2 photos.')).toBeVisible()

  await openFriendPage(page, 'Alex')
  const restored = await editMeetup(page, /Coffee/)
  await expect(photoGrid(restored).getByRole('img')).toHaveCount(2)
  await expect(restored.getByRole('group', { name: 'Activities' }).getByRole('button', { name: 'Karaoke' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
