import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, dayFromToday, goToTab, setBirthday } from './helpers.ts'

/** "March" for 3. */
function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' })
}

function birthdaySelects(sheet: Locator) {
  return {
    month: sheet.getByRole('combobox', { name: 'Birthday month' }),
    day: sheet.getByRole('combobox', { name: 'Birthday day' }),
    year: sheet.getByRole('combobox', { name: 'Birthday year' }),
  }
}

/** On a friend's page: opens the Edit friend sheet from the nav bar. */
async function editFriend(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await expect(sheet).toBeVisible()
  return sheet
}

async function save(sheet: Locator) {
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
}

test('saves a birthday with a year, then without one, then removes it', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('link', { name: /Alex/ }).click()

  let sheet = await editFriend(page)
  await expect(sheet.getByLabel('Notes')).toHaveAttribute('placeholder', "Partner's name, how you met")
  await expect(sheet.getByRole('button', { name: 'Remove birthday' })).toHaveCount(0)
  await setBirthday(sheet, { month: 3, day: 14, year: 1996 })
  await save(sheet)

  sheet = await editFriend(page)
  let selects = birthdaySelects(sheet)
  await expect(selects.month).toHaveValue('3')
  await expect(selects.day).toHaveValue('14')
  await expect(selects.year).toHaveValue('1996')
  await selects.year.selectOption({ label: 'No year' })
  await save(sheet)

  sheet = await editFriend(page)
  selects = birthdaySelects(sheet)
  await expect(selects.month).toHaveValue('3')
  await expect(selects.day).toHaveValue('14')
  await expect(selects.year).toHaveValue('')
  await sheet.getByRole('button', { name: 'Remove birthday' }).click()
  for (const select of [selects.month, selects.day, selects.year]) await expect(select).toHaveValue('')
  await expect(sheet.getByRole('button', { name: 'Remove birthday' })).toHaveCount(0)
  await expect(sheet.getByRole('group', { name: 'Birthday', exact: true })).toBeFocused()
  await save(sheet)

  sheet = await editFriend(page)
  selects = birthdaySelects(sheet)
  for (const select of [selects.month, selects.day, selects.year]) await expect(select).toHaveValue('')
})

test('checks the birthday on Save, and sets one when adding a friend', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheet.getByLabel('Name', { exact: true }).fill('Sam')
  const { month, day, year } = birthdaySelects(sheet)

  await month.selectOption('3')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet.getByText('Pick a month and a day.')).toBeVisible()
  await expect(day).toHaveAttribute('aria-invalid', 'true')
  await expect(day).toHaveAccessibleDescription('Pick a month and a day.')
  await expect(sheet.getByRole('group', { name: 'Birthday', exact: true })).toBeFocused()

  await month.selectOption('2')
  await expect(sheet.getByText('Pick a month and a day.')).toBeHidden()
  await expect(day).toHaveAttribute('aria-invalid', 'false')
  await day.selectOption('29')
  await year.selectOption('2023')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet.getByText("That date doesn't exist.")).toBeVisible()
  await expect(year).toHaveAccessibleDescription("That date doesn't exist.")

  await year.selectOption({ label: 'No year' })
  await save(sheet)
  await expect(page.getByRole('status')).toContainText('Added Sam')

  // .last(): the Friends list's row. (In late February, Birthdays soon above it lists Sam too.)
  await page.getByRole('link', { name: /Sam/ }).last().click()
  const edit = birthdaySelects(await editFriend(page))
  await expect(edit.month).toHaveValue('2')
  await expect(edit.day).toHaveValue('29')
  await expect(edit.year).toHaveValue('')
})

test('keeps the day list in step with the month', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const { month, day } = birthdaySelects(page.getByRole('dialog', { name: 'New friend' }))

  // "Day", then 1 to 31 while no month is picked.
  await expect(day.locator('option')).toHaveCount(32)
  await month.selectOption('1')
  await day.selectOption('31')
  await month.selectOption('2')
  await expect(day).toHaveValue('')
  await expect(day.locator('option')).toHaveCount(30)

  await day.selectOption('29')
  await month.selectOption('4')
  await expect(day).toHaveValue('29')
  await expect(day.locator('option')).toHaveCount(31)
})

test('asks before discarding a changed birthday', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('link', { name: /Alex/ }).click()

  const sheet = await editFriend(page)
  await birthdaySelects(sheet).month.selectOption('5')
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(sheet).toBeHidden()

  await expect(birthdaySelects(await editFriend(page)).month).toHaveValue('')
})

test('shows the birthday on the friend page with a countdown, and edits it from there', async ({ page }) => {
  const soon = dayFromToday(5)
  // 40 is a multiple of 4, so the birth year is a leap year whenever `soon` is Feb 29.
  const born = soon.year - 40
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('link', { name: /Alex/ }).click()
  const section = page.getByRole('region', { name: 'Birthday', exact: true })

  await section.getByRole('button', { name: 'Add birthday' }).click()
  let sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await setBirthday(sheet, { month: soon.month, day: soon.day, year: born })
  await save(sheet)
  const row = section.getByRole('button')
  await expect(row).toContainText(`${monthName(soon.month)} ${soon.day}, ${born}`)
  await expect(row).toContainText('In 5 days · turns 40')

  await row.click()
  sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await sheet.getByRole('combobox', { name: 'Birthday year' }).selectOption({ label: 'No year' })
  await save(sheet)
  await expect(row).toContainText(`${monthName(soon.month)} ${soon.day}`)
  await expect(row).toContainText('In 5 days')
  await expect(row).not.toContainText(String(born))
  await expect(row).not.toContainText('turns')

  await row.click()
  sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await sheet.getByRole('button', { name: 'Remove birthday' }).click()
  await save(sheet)
  await expect(section.getByRole('button', { name: 'Add birthday' })).toBeVisible()
})

test('lists the birthdays in the next two weeks on the Friends tab', async ({ page }) => {
  const today = dayFromToday(0)
  const inFive = dayFromToday(5)
  const inFifteen = dayFromToday(15)
  await page.goto('/')
  await addFriend(page, 'Alex', undefined, { ...inFive, year: inFive.year - 40 })
  await addFriend(page, 'Lee', undefined, { month: today.month, day: today.day })
  await addFriend(page, 'Kim', undefined, { month: inFifteen.month, day: inFifteen.day })
  await addFriend(page, 'Sam', 'Work')

  const soon = page.getByRole('region', { name: 'Birthdays soon' })
  const rows = soon.getByRole('link')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Lee')
  await expect(rows.nth(0)).toContainText('Today')
  await expect(rows.nth(1)).toContainText('Alex')
  await expect(rows.nth(1)).toContainText('In 5 days · turns 40')

  const search = page.getByLabel('Search friends')
  await search.fill('a')
  await expect(soon).toBeHidden()
  await search.fill('')
  await expect(soon).toBeVisible()

  const filters = page.getByRole('group', { name: 'Filter by group' })
  await filters.getByRole('button', { name: 'Work' }).click()
  await expect(soon).toBeHidden()
  await filters.getByRole('button', { name: 'All' }).click()
  await expect(soon).toBeVisible()

  await rows.nth(1).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
  await page.getByRole('button', { name: 'Friends', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})

test('shows at most three birthdays soon, then how many more', async ({ page }) => {
  await page.goto('/')
  for (const [days, name] of ['Ana', 'Ben', 'Cal', 'Dee', 'Eve', 'Fay'].entries()) {
    const { month, day } = dayFromToday(days)
    await addFriend(page, name, undefined, { month, day })
  }

  const soon = page.getByRole('region', { name: 'Birthdays soon' })
  await expect(soon.getByRole('link')).toHaveCount(3)
  await expect(soon.getByRole('link').last()).toContainText('Cal')
  await expect(soon).toContainText('And 3 more in the next two weeks.')
})

test('keeps birthdays through a backup', async ({ page }) => {
  // Force the download path; the share sheet can't be driven in tests.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await page.goto('/')
  await addFriend(page, 'Alex', undefined, { month: 3, day: 14, year: 1996 })

  await goToTab(page, 'Settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.version).toBe(3)
  expect(backup.friends[0]).toMatchObject({ name: 'Alex', birthday: { month: 3, day: 14, year: 1996 } })

  await goToTab(page, 'Friends')
  // .last(): the Friends list's row, not the Birthdays soon one (Alex is in both in early March).
  await page.getByRole('link', { name: /Alex/ }).last().click()
  const section = page.getByRole('region', { name: 'Birthday', exact: true })
  await section.getByRole('button').click()
  const sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await sheet.getByRole('button', { name: 'Remove birthday' }).click()
  await save(sheet)
  await expect(section.getByRole('button', { name: 'Add birthday' })).toBeVisible()

  await goToTab(page, 'Settings')
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')

  await goToTab(page, 'Friends')
  await page.getByRole('link', { name: /Alex/ }).last().click()
  await expect(section).toContainText('March 14, 1996')
})
