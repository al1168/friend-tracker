import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, friendLink, goToTab, logMeetup, readMeetupPhotos, readMeetups, tinyPhoto } from './helpers.ts'

/** Forces the download path for a backup: the share sheet can't be driven in tests. */
async function downloadBackups(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
}

/** Exports a backup from Settings and returns where the file was saved. */
async function exportFile(page: Page): Promise<string> {
  await goToTab(page, 'Settings')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const path = await (await download).path()
  await expect(page.getByText('Last backup: today')).toBeVisible()
  return path
}

/** A confirm's message, one fact a line. */
async function messageLines(confirm: Locator): Promise<string[]> {
  return (await confirm.locator('.action-sheet__message').evaluate((element) => element.textContent ?? '')).split('\n')
}

/** The Settings tab in the tab bar, by its exact name. */
function settingsTab(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true })
}

test('manages groups', async ({ page }) => {
  await page.goto('/#/settings/groups')
  await page.getByRole('button', { name: 'Add group' }).first().click()
  const newSheet = page.getByRole('dialog', { name: 'New group' })
  await newSheet.getByLabel('Name').fill('College')
  await newSheet.getByRole('button', { name: 'Save' }).click()
  await expect(newSheet).toBeHidden()

  await page.getByRole('button', { name: /College/ }).click()
  const editSheet = page.getByRole('dialog', { name: 'Edit group' })
  await editSheet.getByLabel('Name').fill('University')
  await editSheet.getByRole('button', { name: 'Save' }).click()
  await expect(editSheet).toBeHidden()

  await page.getByRole('button', { name: /University/ }).click()
  await page.getByRole('dialog', { name: 'Edit group' }).getByRole('button', { name: 'Delete group' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete group' }).click()
  await expect(page.getByText('No groups yet.')).toBeVisible()
})

test('adds and reorders meetup types', async ({ page }) => {
  await page.goto('/#/settings/types')
  await page.getByRole('button', { name: 'Add type' }).click()
  const sheet = page.getByRole('dialog', { name: 'New meetup type' })
  await sheet.getByLabel('Emoji').fill('🥾')
  await sheet.getByLabel('Name').fill('Hike')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()

  const titles = page.locator('.type-row .row__title')
  await expect(titles.last()).toHaveText('Hike')
  await page.getByRole('button', { name: 'Move Hike up' }).click()
  await expect(titles.nth(7)).toHaveText('Hike')
  await expect(titles.last()).toHaveText('Other')
})

test('explains why a used type cannot be deleted', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await page.goto('/#/settings/types')
  await page.getByRole('button', { name: /^Coffee/ }).click()
  await expect(page.getByRole('dialog', { name: 'Edit meetup type' })).toContainText(
    "Used by 1 meetup, so it can't be deleted.",
  )
})

test('exports and imports a backup', async ({ page }) => {
  // Force the download path; the share sheet can't be driven in tests.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await goToTab(page, 'Settings')
  await expect(page.getByText('Never backed up')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^friend-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const backupPath = await download.path()
  await expect(page.getByText('Last backup: today')).toBeVisible()

  await goToTab(page, 'Friends')
  await addFriend(page, 'Kim')
  await goToTab(page, 'Settings')
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')
  await expect(page.getByRole('status').getByRole('button', { name: 'Undo' })).toBeVisible()

  // The toast belongs to Settings: going to Friends clears it.
  await goToTab(page, 'Friends')
  await expect(page.locator('.toast')).toHaveCount(0)
  await expect(friendLink(page, 'Alex')).toBeVisible()
  await expect(friendLink(page, 'Kim')).toHaveCount(0)
})

/** The rows kept to undo a restore, counted straight from IndexedDB. */
async function countRestoreUndo(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const request = indexedDB.open('friend-tracker')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const count = database.transaction('restoreUndo').objectStore('restoreUndo').count()
          count.onsuccess = () => {
            database.close()
            resolve(count.result)
          }
          count.onerror = () => reject(count.error)
        }
      }),
  )
}

/**
 * On Wed, Oct 21: Alex and a Coffee with a photo, backed up; then Kim and a Meal with her, which the backup doesn't
 * have. Returns the backup file.
 */
async function backUpThenAddMore(page: Page): Promise<string> {
  await downloadBackups(page)
  await page.clock.setFixedTime(new Date(2026, 9, 21, 10))
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { photos: [tinyPhoto('one.png')] })
  const backupPath = await exportFile(page)
  await goToTab(page, 'Friends')
  await addFriend(page, 'Kim')
  await logMeetup(page, ['Kim'], { type: 'Meal', photos: [tinyPhoto('two.png'), tinyPhoto('three.png')] })
  return backupPath
}

/** Imports a backup file from Settings, confirming. */
async function restore(page: Page, backupPath: string) {
  await goToTab(page, 'Settings')
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')
}

test('Undo on the "Backup restored" toast puts everything back', async ({ page }) => {
  const backupPath = await backUpThenAddMore(page)
  await restore(page, backupPath)
  expect(await readMeetups(page)).toHaveLength(1)

  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()

  await expect(page.getByRole('status')).toContainText('Restore undone')
  await expect.poll(async () => (await readMeetups(page)).length).toBe(2)
  expect(await readMeetupPhotos(page)).toHaveLength(3)
  expect(await countRestoreUndo(page)).toBe(0)
  await expect(page.getByRole('button', { name: 'Undo restore' })).toHaveCount(0)
  await goToTab(page, 'Friends')
  await expect(friendLink(page, 'Kim')).toBeVisible()
  await expect(friendLink(page, 'Alex')).toBeVisible()
})

test('"Undo restore" in Settings asks first, says what would go, puts everything back, and then goes', async ({
  page,
}) => {
  // Backs up, logs, restores and logs again: more than most.
  test.setTimeout(60_000)
  const backupPath = await backUpThenAddMore(page)
  await restore(page, backupPath)
  // The toast goes with the page; Settings still offers the undo.
  await goToTab(page, 'Friends')
  await expect(friendLink(page, 'Kim')).toHaveCount(0)
  // A meetup logged after the restore isn't in what the undo puts back.
  await logMeetup(page, ['Alex'], { type: 'Drinks' })
  await goToTab(page, 'Settings')

  const row = page.getByRole('button', { name: 'Undo restore', exact: true })
  await expect(row).toHaveAccessibleDescription('Puts back the data from before Wed, Oct 21. Kept until Wed, Oct 28.')
  await row.click()
  const confirm = page.getByRole('alertdialog', { name: 'Undo the restore?' })
  expect(await messageLines(confirm)).toEqual([
    'Before Wed, Oct 21: 2 friends, 2 meetups, 3 photos.',
    'In the app now: 1 friend, 2 meetups, 1 photo.',
    "1 meetup in the app now isn't in what's put back.",
    'Everything in the app now will be replaced.',
  ])
  await confirm.getByRole('button', { name: 'Undo restore' }).click()

  await expect(page.getByRole('status')).toContainText('Restore undone')
  await expect(row).toHaveCount(0)
  await expect.poll(async () => (await readMeetups(page)).map((meetup) => meetup.typeId).sort()).toEqual([
    'type-coffee',
    'type-meal',
  ])
  expect(await readMeetupPhotos(page)).toHaveLength(3)
})

test('a second restore says the first one can’t be undone after it', async ({ page }) => {
  const backupPath = await backUpThenAddMore(page)
  await restore(page, backupPath)

  await page.locator('input[type="file"]').setInputFiles(backupPath)
  const confirm = page.getByRole('alertdialog', { name: 'Replace all data with this backup?' })
  expect((await messageLines(confirm)).at(-1)).toBe("The restore of Wed, Oct 21 can't be undone after this.")
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await expect(confirm).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Undo restore', exact: true })).toBeVisible()
})

/** Makes the page's IndexedDB refuse every row written to restoreUndo, as a full phone would. */
async function fillThePhone(page: Page) {
  await page.evaluate(() => {
    const add = IDBObjectStore.prototype.add
    IDBObjectStore.prototype.add = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['add']>) {
      if (this.name === 'restoreUndo') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
      return add.apply(this, args)
    }
  })
}

test('with no room to keep a copy for undo, it asks before restoring without one', async ({ page }) => {
  test.setTimeout(60_000)
  const backupPath = await backUpThenAddMore(page)
  await goToTab(page, 'Settings')
  await fillThePhone(page)
  const askWithoutUndo = page.getByRole('alertdialog', { name: 'Restore without undo?' })

  // Cancel: nothing changed.
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(askWithoutUndo).toBeVisible()
  expect(await messageLines(askWithoutUndo)).toEqual([
    "There isn't room on this iPhone to keep a copy for undo. Nothing was changed.",
    "Everything in the app now will be replaced, and it can't be undone.",
  ])
  await askWithoutUndo.getByRole('button', { name: 'Cancel' }).click()
  await expect(askWithoutUndo).toHaveCount(0)
  await expect(page.locator('.toast')).toHaveCount(0)
  expect(await readMeetups(page)).toHaveLength(2)

  // Restore without undo: the backup is in, with nothing kept and no Undo.
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await askWithoutUndo.getByRole('button', { name: 'Restore without undo' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')
  await expect(page.getByRole('status').getByRole('button')).toHaveCount(0)
  expect(await readMeetups(page)).toHaveLength(1)
  await expect(page.getByRole('button', { name: 'Undo restore', exact: true })).toHaveCount(0)
  expect(await countRestoreUndo(page)).toBe(0)
})

test('a restore that ends after you leave Settings shows no toast on the page you went to', async ({ page }) => {
  test.setTimeout(60_000)
  const backupPath = await backUpThenAddMore(page)
  await goToTab(page, 'Settings')
  // Another connection holds the friends store, so the restore waits for it: a slow restore on a full phone.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('friend-tracker')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const transaction = database.transaction('friends', 'readwrite')
          const store = transaction.objectStore('friends')
          const hold = () => {
            if ((window as { releaseFriends?: boolean }).releaseFriends) return
            store.get('nobody').onsuccess = hold
          }
          hold()
          transaction.oncomplete = () => database.close()
          resolve()
        }
      }),
  )
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Friends' }).click()
  await expect(page).toHaveURL(/#\/$/)

  await page.evaluate(() => {
    ;(window as { releaseFriends?: boolean }).releaseFriends = true
  })
  await expect.poll(async () => (await readMeetups(page)).length).toBe(1)
  await expect(friendLink(page, 'Kim')).toHaveCount(0)
  await expect(friendLink(page, 'Alex')).toBeVisible()
  await page.waitForTimeout(500)
  await expect(page.locator('.toast')).toHaveCount(0)
})

test('a restore can be undone for 7 days, then its snapshot is gone', async ({ page }) => {
  const backupPath = await backUpThenAddMore(page)
  await restore(page, backupPath)
  expect(await countRestoreUndo(page)).toBeGreaterThan(0)

  // Six days on, still offered.
  await page.clock.setFixedTime(new Date(2026, 9, 27, 10))
  await page.reload()
  await expect(page.getByRole('button', { name: 'Undo restore', exact: true })).toBeVisible()

  // Seven days on, the next start lets it go.
  await page.clock.setFixedTime(new Date(2026, 9, 28, 10))
  await page.reload()
  await expect(page.getByRole('button', { name: 'Import backup' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Undo restore', exact: true })).toHaveCount(0)
  await expect.poll(() => countRestoreUndo(page)).toBe(0)
})

test('a restore into a fresh app has nothing to undo', async ({ page }) => {
  const backupPath = await backUpThenAddMore(page)
  await page.evaluate(() => indexedDB.deleteDatabase('friend-tracker'))
  await page.reload()
  await expect(page.getByText('Add the people you want to keep up with.')).toBeVisible()

  await goToTab(page, 'Settings')
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  const confirm = page.getByRole('alertdialog')
  await expect(confirm).toContainText('No friends or meetups in the app yet.')
  await expect(confirm).not.toContainText('undo')
  await confirm.getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')
  await expect(page.getByRole('status').getByRole('button')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Undo restore', exact: true })).toHaveCount(0)
  expect(await countRestoreUndo(page)).toBe(0)
})

test('a quiet dot on the Settings tab suggests a backup once meetups are logged after one 30 days old', async ({
  page,
}) => {
  await downloadBackups(page)
  await page.clock.setFixedTime(new Date(2026, 8, 1, 12))
  await page.goto('/')
  await addFriend(page, 'Alex')
  await exportFile(page)
  await page.clock.setFixedTime(new Date(2026, 8, 1, 13))
  await goToTab(page, 'Friends')
  await logMeetup(page, ['Alex'])
  await expect(settingsTab(page, 'Settings')).toBeVisible()

  // 31 days after the backup: the dot, and the tab says why.
  await page.clock.setFixedTime(new Date(2026, 9, 2, 12))
  await page.reload()
  const suggested = settingsTab(page, 'Settings, backup suggested')
  await expect(suggested).toBeVisible()
  await expect(suggested.locator('.tabbar__dot')).toBeVisible()

  // Opening Settings sees it: it goes, and the footer has the facts.
  await suggested.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await expect(settingsTab(page, 'Settings')).toBeVisible()
  await expect(page.locator('.tabbar__dot')).toHaveCount(0)
  await expect(page.getByText('Last backup: 4 weeks ago. 1 meetup since then.')).toBeVisible()
  await page.reload()
  await expect(settingsTab(page, 'Settings')).toBeVisible()
  await goToTab(page, 'Friends')
  await expect(page.locator('.tabbar__dot')).toHaveCount(0)

  // 30 days on, a backup is still due: the dot again.
  await page.clock.setFixedTime(new Date(2026, 10, 1, 12))
  await page.reload()
  await expect(settingsTab(page, 'Settings, backup suggested')).toBeVisible()

  // A backup ends it.
  await exportFile(page)
  await expect(settingsTab(page, 'Settings')).toBeVisible()
  await expect(page.locator('.tabbar__dot')).toHaveCount(0)
})

test('the import confirm compares the backup with the app', async ({ page }) => {
  await downloadBackups(page)
  await page.clock.setFixedTime(new Date(2026, 8, 2, 12))
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  const backupPath = await exportFile(page)

  // Seven weeks on: one more friend and two more meetups.
  await page.clock.setFixedTime(new Date(2026, 9, 21, 12))
  await page.reload()
  await goToTab(page, 'Friends')
  await addFriend(page, 'Kim')
  await logMeetup(page, ['Kim'])
  await logMeetup(page, ['Alex', 'Kim'], { type: 'Meal' })
  await goToTab(page, 'Settings')
  await page.locator('input[type="file"]').setInputFiles(backupPath)

  const confirm = page.getByRole('alertdialog', { name: 'Replace all data with this backup?' })
  expect(await messageLines(confirm)).toEqual([
    'Backup from Wed, Sep 2: 1 friend, 1 meetup.',
    'In the app now: 2 friends, 3 meetups.',
    "1 friend and 2 meetups in the app now aren't in this backup.",
    'Everything in the app now will be replaced. You can undo this in Settings for 7 days.',
  ])
  // One line each.
  await expect(confirm.locator('.action-sheet__message')).toHaveCSS('white-space', 'pre-line')
  await confirm.getByRole('button', { name: 'Cancel' }).click()
  await expect(confirm).toHaveCount(0)
})

test('rejects a file that is not a backup', async ({ page }) => {
  await page.goto('/#/settings')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":1}'),
  })
  await expect(page.getByRole('alert')).toContainText("This isn't a Friend Tracker backup file.")
})
