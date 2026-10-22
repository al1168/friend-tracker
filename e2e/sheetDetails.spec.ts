import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  addFriend,
  editMeetup,
  friendRow,
  LARGE_TEXT,
  logMeetup,
  meetupRow,
  openDay,
  openFriendPage,
  readMeetups,
  seedMeetups,
  sheetSave,
} from './helpers.ts'

declare global {
  interface Window {
    /** Set by the test of the suggestion while the sheet opens: what the What row showed, in order. */
    whatRowSeen?: string[]
  }
}

// Most tests add a friend and log a meetup first, so they get more time than most.
test.describe.configure({ timeout: 60_000 })

/** The local date `days` ago (negative for the future), as an ISO date. */
function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** In an open meetup sheet: The day box. */
function sheetDay(sheet: Locator): Locator {
  return sheet.getByRole('textbox', { name: 'The day' })
}

async function openLogMeetup(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await expect(sheet).toBeVisible()
  return sheet
}

test.describe('The day in the meetup sheets', () => {
  test('comes right after When, before Activities and Photos', async ({ page }) => {
    await page.goto('/')
    await addFriend(page, 'Alex')
    const sheet = await openLogMeetup(page)
    await expect(sheet.locator('.sheet__body .form-section__label')).toHaveText([
      'Who',
      'What',
      'When',
      'The day',
      'Activities',
      'Photos',
    ])
    await expect(sheet.locator('.sheet__body > :last-child')).toHaveText('Save and write about the day')
  })

  test('logs a meetup with The day typed in the sheet, and its place shows on the Meetup page', async ({ page }) => {
    await page.goto('/')
    await addFriend(page, 'Mariya')
    const sheet = await openLogMeetup(page)
    await sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name: 'Mariya' }).click()
    await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
    const day = sheetDay(sheet)
    await expect(day).toHaveAttribute('placeholder', 'What happened? Start a line with @ for a place.')
    await expect(day).toHaveAccessibleDescription('Lines that start with @ show as places.')
    // Spaces at the end are kept exactly as typed, as the day page keeps them.
    await day.fill('@Blue willow 3:30\nKung pao chicken  ')
    await sheetSave(sheet).click()
    await expect(sheet).toBeHidden()
    expect((await readMeetups(page))[0].note).toBe('@Blue willow 3:30\nKung pao chicken  ')

    await openFriendPage(page, 'Mariya')
    await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
    const places = page.getByRole('region', { name: 'The day' }).getByRole('list', { name: 'Places, 1 stop' })
    await expect(places.getByRole('heading', { level: 3 })).toHaveText(['Blue willow'])
    await expect(places.locator('.day-stop__time')).toHaveText(['3:30 PM'])
  })

  test('"Save and write about the day" takes the words typed in the sheet to the day page', async ({ page }) => {
    await page.goto('/')
    await addFriend(page, 'Alex')
    const sheet = await openLogMeetup(page)
    await sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name: 'Alex' }).click()
    await sheetDay(sheet).fill('@Cafe 10:30')
    await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'The day' })).toHaveValue('@Cafe 10:30')
  })

  test('the Edit meetup sheet starts with the day and saves a change, which the day page shows', async ({ page }) => {
    await page.goto('/')
    await addFriend(page, 'Alex')
    await logMeetup(page, ['Alex'], { note: 'Tacos' })
    await openFriendPage(page, 'Alex')
    let sheet = await editMeetup(page, /Coffee/)
    await expect(sheetDay(sheet)).toHaveValue('Tacos')
    // Unchanged, it closes without asking.
    await sheet.getByRole('button', { name: 'Cancel' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)

    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    sheet = page.getByRole('dialog', { name: 'Edit meetup' })
    await sheetDay(sheet).fill('Tacos\n@Blue willow 3:30')
    await sheetSave(sheet).click()
    await expect(sheet).toBeHidden()
    await openDay(page)
    await expect(page.getByRole('textbox', { name: 'The day' })).toHaveValue('Tacos\n@Blue willow 3:30')
  })

  test('Cancel with words typed in The day asks before throwing them away', async ({ page }) => {
    await page.goto('/')
    await addFriend(page, 'Alex')
    const sheet = await openLogMeetup(page)
    // Only the box changes, so it alone makes the sheet ask.
    await sheetDay(sheet).fill('A line I might keep')
    await sheet.getByRole('button', { name: 'Cancel' }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toContainText('Discard changes?')
    await confirm.getByRole('button', { name: 'Cancel' }).click()
    await expect(sheetDay(sheet)).toHaveValue('A line I might keep')

    await sheet.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
    await expect(sheet).toBeHidden()
    expect(await readMeetups(page)).toHaveLength(0)
  })
  test('says when the box is full, as the day page does', async ({ page }) => {
    await page.goto('/')
    await addFriend(page, 'Alex')
    const sheet = await openLogMeetup(page)
    const day = sheetDay(sheet)
    await day.fill('x'.repeat(9_999))
    await expect(sheet.getByRole('alert')).toHaveCount(0)
    await day.press('End')
    await page.keyboard.type('yz')
    await expect(day).toHaveValue(`${'x'.repeat(9_999)}y`)
    const full = sheet.getByRole('alert')
    await expect(full).toHaveText('This box is full.')
    await expect(full).toHaveClass('field-hint')
    // Room again, and it goes.
    await day.press('Backspace')
    await expect(sheet.getByRole('alert')).toHaveCount(0)
  })
})

test.describe('errors in the meetup sheets', () => {
  test('one that comes again shows again, and brings only the sheet back to its top', async ({ page }) => {
    await page.goto('/')
    await addFriend(page, 'Alex')
    await logMeetup(page, ['Alex'])
    await openFriendPage(page, 'Alex')
    const sheet = await editMeetup(page, /Coffee/)
    // Deleted from under the open sheet, straight from IndexedDB, so each Save fails the same way.
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const request = indexedDB.open('friend-tracker')
          request.onerror = () => reject(request.error)
          request.onsuccess = () => {
            const database = request.result
            const transaction = database.transaction('meetups', 'readwrite')
            transaction.objectStore('meetups').clear()
            transaction.oncomplete = () => {
              database.close()
              resolve()
            }
            transaction.onerror = () => reject(transaction.error)
          }
        }),
    )
    const body = sheet.locator('.sheet__body')
    const scrollTop = () => body.evaluate((element) => element.scrollTop)
    const toEnd = async () => {
      await body.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      })
      expect(await scrollTop()).toBeGreaterThan(0)
    }

    await toEnd()
    await sheetSave(sheet).click()
    const alert = sheet.getByRole('alert')
    await expect(alert).toHaveText('This meetup no longer exists.')
    await expect.poll(scrollTop, { message: 'The body is back at its very top' }).toBe(0)
    expect(await page.evaluate(() => [window.scrollX, window.scrollY]), 'The page itself never moved').toEqual([0, 0])

    // The same error again is a new alert, so VoiceOver says it again, and it's brought into view again.
    await alert.evaluate((element) => element.setAttribute('data-said', ''))
    await toEnd()
    await sheetSave(sheet).click()
    await expect(sheet.locator('[role="alert"]:not([data-said])')).toHaveText('This meetup no longer exists.')
    await expect.poll(scrollTop).toBe(0)
  })
})

/**
 * Each tint sits behind its line of a The day box: centered on the line it marks (`lines`, from 0), and starting
 * where the box's text starts. The tint takes no width of its own (it reaches 0.2em past the words with a shadow),
 * so it can't make the copy behind the box wrap differently from the box.
 */
async function expectTintsOnLines(box: Locator, tints: Locator, lines: number[]) {
  const text = await box.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      top: rect.top + parseFloat(style.paddingTop),
      left: rect.left + parseFloat(style.paddingLeft),
      lineHeight: parseFloat(style.lineHeight),
    }
  })
  await expect(tints).toHaveCount(lines.length)
  for (const [index, line] of lines.entries()) {
    const tint = await tints.nth(index).evaluate((element) => {
      const [first] = element.getClientRects()
      return { top: first.top, bottom: first.bottom, left: first.left }
    })
    const middle = (tint.top + tint.bottom) / 2
    expect(Math.abs(middle - (text.top + (line + 0.5) * text.lineHeight)), `Tint ${index + 1} is on line ${line + 1}`).toBeLessThanOrEqual(1)
    expect(Math.abs(tint.left - text.left), `Tint ${index + 1} starts with the text`).toBeLessThanOrEqual(1)
  }
}

/** How many lines `text` takes in a The day box, laid out by a textarea like the box (not by the copy behind it). */
function linesInBox(box: Locator, text: string): Promise<number> {
  return box.evaluate((element: HTMLTextAreaElement, text) => {
    const twin = element.cloneNode() as HTMLTextAreaElement
    twin.value = text
    Object.assign(twin.style, { height: '0', minHeight: '0', visibility: 'hidden' })
    element.after(twin)
    const style = getComputedStyle(twin)
    const lines = (twin.scrollHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)) / parseFloat(style.lineHeight)
    twin.remove()
    return Math.round(lines)
  }, text)
}

test.describe('@ highlighting', () => {
  const TYPED = ['@ some place', '@Blue willow 3:30', '@', 'Then dinner @seoulsaloon', '@ 3:30', 'Kung pao chicken'].join('\n')

  test('tints each place line in the sheet box and on the day page, and nothing else', async ({ page }) => {
    await page.goto('/')
    await addFriend(page, 'Alex')
    const sheet = await openLogMeetup(page)
    await sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name: 'Alex' }).click()
    const box = sheetDay(sheet)
    await box.fill(TYPED)
    const tints = sheet.locator('mark.day-place')
    await expect(tints).toHaveText(['@ some place', '@Blue willow 3:30'])
    await expectTintsOnLines(box, tints, [0, 1])
    // Only a look: the copy behind the box is hidden from VoiceOver, and the box reads exactly as typed.
    await expect(sheet.locator('.grow-field__copy')).toHaveAttribute('aria-hidden', 'true')
    await expect(box).toHaveValue(TYPED)

    await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
    await expect(sheet).toBeHidden()
    const dayBox = page.getByRole('textbox', { name: 'The day' })
    await expect(dayBox).toHaveValue(TYPED)
    const dayTints = page.locator('.day-page mark.day-place')
    await expect(dayTints).toHaveText(['@ some place', '@Blue willow 3:30'])
    await expectTintsOnLines(dayBox, dayTints, [0, 1])

    // The tints follow the typing: a new place line gets one, and a line that stops being a place loses its own.
    await dayBox.fill(TYPED.replace('@ some place', 'Some place') + '\n@Park')
    await expect(dayTints).toHaveText(['@Blue willow 3:30', '@Park'])
    await expectTintsOnLines(dayBox, dayTints, [1, 6])
  })

  test('with forced colors the copy behind the box hides, so the words never show twice, and still sizes it', async ({
    page,
  }) => {
    await page.emulateMedia({ forcedColors: 'active' })
    await page.goto('/')
    await addFriend(page, 'Alex')
    const sheet = await openLogMeetup(page)
    const box = sheetDay(sheet)
    const copy = sheet.locator('.grow-field__copy')
    await box.fill('@Blue willow 3:30')
    await expect(copy).toHaveCSS('visibility', 'hidden')
    const before = await box.evaluate((element) => element.getBoundingClientRect().height)
    await box.fill(['@Blue willow 3:30', 'Kung pao chicken', 'Tea', 'Then a walk', 'Home by ten', 'Jessie paid'].join('\n'))
    await expect.poll(() => box.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(before)
  })

  test('a place line that wraps leaves the next place line’s tint on its own words, at any text size', async ({ page }) => {
    await page.goto('/')
    await addFriend(page, 'Alex')
    const sheet = await openLogMeetup(page)
    const box = sheetDay(sheet)
    const tints = sheet.locator('mark.day-place')
    const long = '@The little noodle bar on the corner of Fifth and Main, by the old cinema 3:30'
    await box.fill(`${long}\n@Park`)
    await expect(tints).toHaveText([long, '@Park'])
    for (const size of ['default', 'large'] as const) {
      if (size === 'large') await page.addStyleTag({ content: LARGE_TEXT })
      const wrapped = await linesInBox(box, long)
      expect(wrapped, `At ${size} text the first place line wraps`).toBeGreaterThan(1)
      // Each of its lines is tinted, from the start of the text.
      const text = await box.evaluate((element) => element.getBoundingClientRect().left + parseFloat(getComputedStyle(element).paddingLeft))
      const starts = await tints.first().evaluate((element) => [...element.getClientRects()].map((rect) => rect.left))
      expect(starts).toHaveLength(wrapped)
      for (const left of starts) expect(Math.abs(left - text)).toBeLessThanOrEqual(1)
      // The second place line is on the line straight after it, in the box and in the copy alike.
      await expectTintsOnLines(box, tints, [0, wrapped])
    }
  })
})

/** Whether a friend's tile (or a type chip) shows whole, side to side, inside the strip (or row) that scrolls it. */
function shownInStrip(tile: Locator): Promise<boolean> {
  return tile.evaluate((element) => {
    const strip = element.closest('[role="group"]')
    if (!strip) throw new Error('Not in a group')
    const tileRect = element.getBoundingClientRect()
    const stripRect = strip.getBoundingClientRect()
    return tileRect.left >= stripRect.left - 0.5 && tileRect.right <= stripRect.right + 0.5
  })
}

test.describe('swiping through friends', () => {
  const NAMES = Array.from({ length: 12 }, (_, i) => `Friend ${String(i + 1).padStart(2, '0')}`)

  test('Who has every friend: the strip swipes sideways to the 12th, which can be picked', async ({ page }) => {
    await page.goto('/')
    // None seen yet, so they come in name order.
    await seedMeetups(page, { friends: NAMES.map((name, i) => friendRow(`f${i + 1}`, name)) })
    const sheet = await openLogMeetup(page)
    const strip = sheet.getByRole('group', { name: 'Friends', exact: true })
    const tiles = strip.getByRole('button')
    await expect(strip.locator('.friend-tile__name')).toHaveText(NAMES)
    // Two rows, filled a column at a time: the first two friends share the first column.
    const [first, second, third] = await Promise.all([0, 1, 2].map((i) => tiles.nth(i).boundingBox()))
    if (!first || !second || !third) throw new Error('The tiles are not on screen')
    expect(Math.abs(second.x - first.x), 'Friend 02 is under Friend 01').toBeLessThanOrEqual(1)
    expect(second.y).toBeGreaterThan(first.y + first.height - 1)
    expect(third.x).toBeGreaterThan(first.x + first.width)
    // The first column starts on the sheet's 16px margin, and the fifth peeks in at the edge.
    const sheetBox = await sheet.boundingBox()
    if (!sheetBox) throw new Error('The sheet is not on screen')
    expect(Math.abs(first.x - (sheetBox.x + 16)), 'On the margin').toBeLessThanOrEqual(1)
    const fifth = await tiles.nth(8).boundingBox()
    if (!fifth) throw new Error('The fifth column is not on screen')
    expect(fifth.x, 'The fifth column starts on screen').toBeLessThan(sheetBox.x + sheetBox.width)
    expect(fifth.x + fifth.width, 'and runs off it').toBeGreaterThan(sheetBox.x + sheetBox.width)

    const twelfth = tiles.nth(11)
    expect(await shownInStrip(twelfth)).toBe(false)
    // A sideways swipe scrolls the strip (Playwright's mobile WebKit can't swipe or use a wheel, so it scrolls it).
    await strip.evaluate((element) => element.scrollBy({ left: element.scrollWidth, behavior: 'instant' }))
    await expect.poll(() => shownInStrip(twelfth)).toBe(true)
    await twelfth.click()
    await expect(twelfth).toHaveAttribute('aria-pressed', 'true')
    await expect(sheet.getByRole('group', { name: 'Selected friends' })).toContainText('Friend 12')
    await sheetSave(sheet).click()
    // Friend 12 is the only friend on it, so their first name is enough.
    await expect(page.locator('.toast__message')).toHaveText('Logged with Friend')
  })

  test('the swiping strip has room for a focused tile’s ring, and its tiles stay where they were', async ({ page }) => {
    await page.goto('/')
    await seedMeetups(page, { friends: NAMES.map((name, i) => friendRow(`f${i + 1}`, name)) })
    const sheet = await openLogMeetup(page)
    const strip = sheet.getByRole('group', { name: 'Friends', exact: true })
    const room = await strip.evaluate((element) => {
      // The strip scrolls, so it clips at its padding box.
      const top = element.getBoundingClientRect().top + element.clientTop
      const bottom = top + element.clientHeight
      const tiles = [...element.querySelectorAll('.friend-tile')].map((tile) => tile.getBoundingClientRect())
      const label = element.closest('section')?.querySelector('.form-section__label')?.getBoundingClientRect()
      if (!label) throw new Error('No Who label')
      return {
        above: Math.min(...tiles.map((tile) => tile.top - top)),
        below: Math.min(...tiles.map((tile) => bottom - tile.bottom)),
        underLabel: tiles[0].top - label.bottom,
      }
    })
    // The ring is 2px wide, 2px out from the tile.
    expect(room.above, 'Room for the ring above the top row').toBeGreaterThanOrEqual(4)
    expect(room.below, 'and below the bottom row').toBeGreaterThanOrEqual(4)
    expect(room.underLabel, 'The tiles start the section’s 8px gap under Who, as before').toBeCloseTo(8, 0)
  })

  test('a tile that takes keyboard focus scrolls into view', async ({ page }) => {
    await page.goto('/')
    await seedMeetups(page, { friends: NAMES.map((name, i) => friendRow(`f${i + 1}`, name)) })
    const sheet = await openLogMeetup(page)
    const twelfth = sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name: 'Friend 12' })
    expect(await shownInStrip(twelfth)).toBe(false)
    await twelfth.focus()
    await expect.poll(() => shownInStrip(twelfth)).toBe(true)
  })

  test('with 8 friends or fewer, Who is a still grid of four across', async ({ page }) => {
    await page.goto('/')
    await seedMeetups(page, { friends: NAMES.slice(0, 8).map((name, i) => friendRow(`f${i + 1}`, name)) })
    const sheet = await openLogMeetup(page)
    const strip = sheet.getByRole('group', { name: 'Friends', exact: true })
    const tiles = strip.getByRole('button')
    await expect(strip.locator('.friend-tile__name')).toHaveText(NAMES.slice(0, 8))
    // Filled a row at a time, as before: Friend 05 starts the second row.
    const [first, second, fifth] = await Promise.all([0, 1, 4].map((i) => tiles.nth(i).boundingBox()))
    if (!first || !second || !fifth) throw new Error('The tiles are not on screen')
    expect(Math.abs(second.y - first.y)).toBeLessThanOrEqual(1)
    expect(Math.abs(fifth.x - first.x)).toBeLessThanOrEqual(1)
    expect(fifth.y).toBeGreaterThan(first.y)
    expect(await strip.evaluate((element) => element.scrollWidth <= element.clientWidth), 'Nothing to swipe').toBe(true)
  })
})

test.describe('names in the Log sheet', () => {
  const LONG_NAME = 'Maximiliana Alexandra Featherstonehaugh-Worthington'

  test('a long selected name ends in "…" inside the sheet, and its × still shows', async ({ page }) => {
    await page.goto('/')
    await seedMeetups(page, { friends: [friendRow('maxi', LONG_NAME), friendRow('kim', 'Kim')] })
    const sheet = await openLogMeetup(page)
    await sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name: LONG_NAME }).click()
    const selected = sheet.getByRole('group', { name: 'Selected friends' })
    const chip = selected.getByRole('button', { name: `Remove ${LONG_NAME}` })
    await expect(chip).toBeVisible()
    const [chipBox, close, body] = await Promise.all([
      chip.boundingBox(),
      chip.locator('svg').boundingBox(),
      sheet.locator('.sheet__body').boundingBox(),
    ])
    if (!chipBox || !close || !body) throw new Error('Not on screen')
    expect(chipBox.x + chipBox.width, 'The chip ends inside the sheet’s margin').toBeLessThanOrEqual(
      body.x + body.width - 16 + 1,
    )
    expect(close.x + close.width, 'and so does its ×').toBeLessThanOrEqual(chipBox.x + chipBox.width)
    const label = chip.locator('.chip__label')
    const cut = await label.evaluate((element) => element.scrollWidth > element.clientWidth)
    expect(cut, 'The name ends in …').toBe(true)
    await chip.click()
    await expect(sheet.getByRole('group', { name: 'Selected friends' })).toHaveCount(0)
  })

  test('"Logged with" names each friend by first name, or in full when two on it share one', async ({ page }) => {
    await page.goto('/')
    await seedMeetups(page, {
      friends: ['Mariya', 'Jessie', 'Brandon Cao', 'Sam Chen', 'Sam Lee'].map((name) =>
        friendRow(name.toLowerCase().replace(' ', '-'), name),
      ),
    })
    await logMeetup(page, ['Mariya', 'Jessie', 'Brandon Cao'])
    await expect(page.locator('.toast__message')).toHaveText('Logged with Mariya, Jessie and Brandon')
    await logMeetup(page, ['Sam Chen', 'Sam Lee'])
    await expect(page.locator('.toast__message')).toHaveText('Logged with Sam Chen and Sam Lee')

    // The day page's Logged note says it the same way.
    const sheet = await openLogMeetup(page)
    await sheet.getByLabel('Search all friends').fill('Brandon')
    await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Brandon Cao' }).click()
    await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
    await expect(page.locator('.day-logged')).toContainText('Logged with Brandon')
    await expect(page.locator('.day-logged')).not.toContainText('Cao')
  })
})

test.describe('who comes first in Who', () => {
  // Bo: 3 meetups lately. Cy: 1, yesterday. Di and Ed: only months ago, together with each other and once Cy and Di.
  // Ana: never.
  const friends = ['Ana', 'Bo', 'Cy', 'Di', 'Ed'].map((name) => friendRow(name.toLowerCase(), name))
  const meetups = [
    meetupRow('b1', daysAgo(10), ['bo']),
    meetupRow('b2', daysAgo(20), ['bo']),
    meetupRow('b3', daysAgo(30), ['bo']),
    meetupRow('c1', daysAgo(1), ['cy']),
    meetupRow('d1', daysAgo(200), ['di', 'ed']),
    meetupRow('d2', daysAgo(250), ['ed', 'di']),
    meetupRow('d3', daysAgo(300), ['di', 'cy']),
  ]

  test('the friends you met most lately come first, then the most recently seen, then the rest by name', async ({
    page,
  }) => {
    await page.goto('/')
    await seedMeetups(page, { friends, meetups })
    const sheet = await openLogMeetup(page)
    const names = sheet.getByRole('group', { name: 'Friends', exact: true }).locator('.friend-tile__name')
    await expect(names).toHaveText(['Bo', 'Cy', 'Di', 'Ed', 'Ana'])
  })

  test('from a friend’s page, the friends usually with them come first', async ({ page }) => {
    await page.goto('/')
    await seedMeetups(page, { friends, meetups })
    await openFriendPage(page, 'Di')
    const sheet = await openLogMeetup(page)
    const strip = sheet.getByRole('group', { name: 'Friends', exact: true })
    // Ed was with Di twice, Cy once; then everyone else as above, Di included and picked.
    await expect(strip.locator('.friend-tile__name')).toHaveText(['Ed', 'Cy', 'Bo', 'Di', 'Ana'])
    await expect(strip.getByRole('button', { name: 'Di' })).toHaveAttribute('aria-pressed', 'true')
  })
})

test.describe('the suggested meetup type', () => {
  // Jamie's meetups are all Meals. Kim's are Drinks, the owner's most-used type. Lee's one meetup is a Trip, a type
  // far along the What row.
  const friends = [friendRow('jamie', 'Jamie'), friendRow('kim', 'Kim'), friendRow('lee', 'Lee')]
  const meetups = [
    ...[3, 10, 20].map((days, i) => meetupRow(`j${i}`, daysAgo(days), ['jamie'], { typeId: 'type-meal' })),
    ...[2, 5, 8, 12, 15].map((days, i) => meetupRow(`k${i}`, daysAgo(days), ['kim'], { typeId: 'type-drinks' })),
    meetupRow('l0', daysAgo(40), ['lee'], { typeId: 'type-trip' }),
  ]

  /** In an open meetup sheet: the What row's selected chip. */
  function pickedType(sheet: Locator): Locator {
    return sheet.getByRole('group', { name: 'What' }).locator('[aria-pressed="true"]')
  }

  test('a friend whose meetups are all Meals gets Meal when logging from their page', async ({ page }) => {
    await page.goto('/')
    await seedMeetups(page, { friends, meetups })
    await openFriendPage(page, 'Jamie')
    let sheet = await openLogMeetup(page)
    await expect(pickedType(sheet)).toHaveCount(1)
    await expect(pickedType(sheet)).toHaveText(/Meal/)
    // A suggestion isn't a change: Cancel closes without asking.
    await sheet.getByRole('button', { name: 'Cancel' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)

    sheet = await openLogMeetup(page)
    await expect(pickedType(sheet)).toHaveText(/Meal/)
    await sheetSave(sheet).click()
    await expect(sheet).toBeHidden()
    expect((await readMeetups(page)).at(-1)).toMatchObject({ typeId: 'type-meal', friendIds: ['jamie'] })
  })

  test('tapping the type already suggested is no change, and tapping another one is', async ({ page }) => {
    await page.goto('/')
    await seedMeetups(page, { friends, meetups })
    await openFriendPage(page, 'Jamie')
    let sheet = await openLogMeetup(page)
    const what = () => sheet.getByRole('group', { name: 'What' })
    await expect(pickedType(sheet)).toHaveText(/Meal/)
    await what().getByRole('button', { name: 'Meal', exact: true }).click()
    await sheet.getByRole('button', { name: 'Cancel' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)

    sheet = await openLogMeetup(page)
    await what().getByRole('button', { name: 'Coffee', exact: true }).click()
    await sheet.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('Discard changes?')
  })

  test('while the sheet opens, the What row shows only the real suggestion, never the first type before it', async ({
    page,
  }) => {
    await page.goto('/')
    await seedMeetups(page, { friends, meetups })
    await openFriendPage(page, 'Lee')
    // Every type the What row shows picked, and whether it's scrolled, in order, from before the sheet opens.
    await page.evaluate(() => {
      const seen: string[] = []
      window.whatRowSeen = seen
      const note = () => {
        const row = document.querySelector('[role="dialog"] .chip-row')
        if (!row) return
        const picked = row.querySelector('[aria-pressed="true"]')?.textContent ?? 'none'
        const entry = `${picked} at ${row.scrollLeft > 0 ? 'scrolled' : 'start'}`
        if (seen.at(-1) !== entry) seen.push(entry)
      }
      new MutationObserver(note).observe(document.body, { subtree: true, childList: true, attributes: true })
      document.addEventListener('scroll', note, true)
    })
    const sheet = await openLogMeetup(page)
    const trip = sheet.getByRole('group', { name: 'What' }).getByRole('button', { name: 'Trip', exact: true })
    await expect(trip).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => shownInStrip(trip)).toBe(true)
    const seen = (await page.evaluate(() => window.whatRowSeen)) ?? []
    // Nothing picked and the row at its start, until Trip.
    const beforeTrip = seen.slice(0, seen.findIndex((entry) => entry.includes('Trip')))
    expect(beforeTrip.every((entry) => entry === 'none at start'), seen.join(', ')).toBe(true)
  })

  test('the suggestion follows the friends picked until a type is tapped, which then sticks', async ({ page }) => {
    await page.goto('/')
    await seedMeetups(page, { friends, meetups })
    const sheet = await openLogMeetup(page)
    const strip = sheet.getByRole('group', { name: 'Friends', exact: true })
    // No friend yet: the owner's most-used type.
    await expect(pickedType(sheet)).toHaveText(/Drinks/)
    await strip.getByRole('button', { name: 'Jamie' }).click()
    await expect(pickedType(sheet)).toHaveText(/Meal/)
    // With Kim too: 5 Drinks to 3 Meals.
    await strip.getByRole('button', { name: 'Kim' }).click()
    await expect(pickedType(sheet)).toHaveText(/Drinks/)

    await sheet.getByRole('group', { name: 'What' }).getByRole('button', { name: 'Coffee', exact: true }).click()
    await strip.getByRole('button', { name: 'Kim' }).click()
    await expect(pickedType(sheet)).toHaveText(/Coffee/)
    await sheetSave(sheet).click()
    expect((await readMeetups(page)).at(-1)).toMatchObject({ typeId: 'type-coffee', friendIds: ['jamie'] })
  })

  test('a suggestion far along the What row scrolls into view there, and the sheet stays where it is', async ({ page }) => {
    await page.goto('/')
    await seedMeetups(page, { friends, meetups })
    // From Kim's page, so the row of picked friends is already there and nothing above moves the sheet's content.
    await openFriendPage(page, 'Kim')
    const sheet = await openLogMeetup(page)
    await sheet.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)))
    const what = sheet.getByRole('group', { name: 'What' })
    const trip = what.getByRole('button', { name: 'Trip', exact: true })
    await expect(pickedType(sheet)).toHaveText(/Drinks/)
    expect(await shownInStrip(trip)).toBe(false)
    // Scrolled to the end of the sheet, away from Who and What. The taps on the tiles are made in the page, so the
    // test doesn't scroll the sheet to reach them.
    const body = sheet.locator('.sheet__body')
    await body.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    const before = await body.evaluate((element) => element.scrollTop)
    const strip = sheet.getByRole('group', { name: 'Friends', exact: true })
    const tap = (name: string) => strip.getByRole('button', { name }).evaluate((element) => (element as HTMLElement).click())
    await tap('Lee')
    await expect(pickedType(sheet)).toHaveText(/Drinks/)
    // Lee alone: his Trip.
    await tap('Kim')
    await expect(trip).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => shownInStrip(trip)).toBe(true)
    expect(await body.evaluate((element) => element.scrollTop), 'The sheet did not move').toBe(before)
  })

  test('Edit keeps the meetup’s own type', async ({ page }) => {
    await page.goto('/')
    // A Coffee with Kim, whose other meetups are all Drinks.
    await seedMeetups(page, { friends, meetups: [...meetups, meetupRow('kc', daysAgo(1), ['kim'], { typeId: 'type-coffee' })] })
    await openFriendPage(page, 'Kim')
    const sheet = await editMeetup(page, /Coffee/)
    await expect(pickedType(sheet)).toHaveText(/Coffee/)
    await sheet.getByRole('button', { name: 'Cancel' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })
})
