import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, setBirthday } from './helpers.ts'

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
