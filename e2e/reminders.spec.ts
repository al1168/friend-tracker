import { expect, test, type Page, type Route } from '@playwright/test'
import { addFriend, dayFromToday, FAKE_SUBSCRIPTION, FAKE_SUBSCRIPTION_KEY, goToTab, stubPush } from './helpers.ts'

interface ScheduleRequest {
  method: string
  contentType: string | undefined
  body: { subscription: unknown; reminders: { at: number; friendId: string }[] } | null
}

/** Answers /__reminders (with `status`) and /__reminders/test like the server, and records what the app sent. */
async function fakeServer(page: Page, status = 204) {
  const requests: ScheduleRequest[] = []
  const tests: string[] = []
  await page.route('**/__reminders', async (route: Route) => {
    const request = route.request()
    const isPut = request.method() === 'PUT'
    requests.push({
      method: request.method(),
      contentType: request.headers()['content-type'],
      body: isPut ? request.postDataJSON() : null,
    })
    await route.fulfill({ status })
  })
  await page.route('**/__reminders/test', async (route: Route) => {
    tests.push(route.request().method())
    await route.fulfill({ status: 204 })
  })
  return { requests, tests }
}

function remindersGroup(page: Page) {
  return page.getByRole('region', { name: 'Reminders' })
}

function reminderSwitch(page: Page) {
  return remindersGroup(page).getByRole('switch', { name: 'Birthday reminders' })
}

function storedSubscription(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), FAKE_SUBSCRIPTION_KEY)
}

/** 11:55 PM on the night before `date`, in this machine's time zone (which the browser shares). */
function nightBefore(date: { year: number; month: number; day: number }): number {
  return new Date(date.year, date.month - 1, date.day - 1, 23, 55).getTime()
}

test('asks for the Home Screen app in a Safari tab', async ({ page }) => {
  await page.goto('/#/settings')
  await expect(reminderSwitch(page)).toBeDisabled()
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'false')
  await expect(
    remindersGroup(page).getByText('Open Friend Tracker from your Home Screen to turn on reminders.'),
  ).toBeVisible()
  await expect(reminderSwitch(page)).toHaveAccessibleDescription('Open Friend Tracker from your Home Screen to turn on reminders.')
  await expect(page.getByRole('button', { name: 'Send a test notification' })).toHaveCount(0)
})

test('turns on, sends the schedule, and sends a test notification', async ({ page }) => {
  await stubPush(page)
  const server = await fakeServer(page)
  await page.goto('/')
  const birthday = dayFromToday(5)
  await addFriend(page, 'Alex Rivera', undefined, { month: birthday.month, day: birthday.day })
  await goToTab(page, 'Settings')
  await expect(remindersGroup(page).getByText('A notification at 11:55 PM the night before each birthday.')).toBeVisible()

  await reminderSwitch(page).click()
  await expect(page.getByRole('status')).toContainText('Birthday reminders are on')
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'true')
  await expect(
    remindersGroup(page).getByText("On. You'll get a note at 11:55 PM the night before each birthday."),
  ).toBeVisible()

  expect(server.requests).toHaveLength(1)
  const [put] = server.requests
  expect(put.method).toBe('PUT')
  expect(put.contentType).toContain('application/json')
  expect(put.body?.subscription).toEqual(FAKE_SUBSCRIPTION)
  const reminders = put.body?.reminders ?? []
  expect(reminders).toHaveLength(2)
  const [first, second] = reminders
  // Only a time and the friend's random id: never a name or a birthday.
  expect(Object.keys(first).sort()).toEqual(['at', 'friendId'])
  expect(first.friendId).toMatch(/^[0-9a-f-]{36}$/)
  expect(second.friendId).toBe(first.friendId)
  expect(first.at).toBe(nightBefore(birthday))
  const daysApart = (second.at - first.at) / 86_400_000
  expect(daysApart).toBeGreaterThan(364)
  expect(daysApart).toBeLessThan(367)

  await remindersGroup(page).getByRole('button', { name: 'Send a test notification' }).click()
  await expect(page.getByRole('status')).toContainText('Test notification sent')
  expect(server.tests).toEqual(['POST'])
})

test('turns off and deletes the schedule', async ({ page }) => {
  await stubPush(page)
  const server = await fakeServer(page)
  await page.goto('/#/settings')
  await reminderSwitch(page).click()
  await expect(page.getByRole('status')).toContainText('Birthday reminders are on')
  // A fresh start, as on another day (a second tap right away would count as a double tap).
  await page.reload()
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'true')

  await reminderSwitch(page).click()
  await expect(page.getByRole('status')).toContainText('Birthday reminders are off')
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'false')
  await expect(remindersGroup(page).getByText('A notification at 11:55 PM the night before each birthday.')).toBeVisible()
  await expect(remindersGroup(page).getByRole('button', { name: 'Send a test notification' })).toHaveCount(0)
  expect(server.requests.map((request) => request.method)).toEqual(['PUT', 'DELETE'])
  expect(await storedSubscription(page)).toBeNull()
})

test('explains how to allow notifications after a denial', async ({ page }) => {
  await stubPush(page, { answer: 'denied' })
  const server = await fakeServer(page)
  await page.goto('/#/settings')
  await reminderSwitch(page).click()
  await expect(
    remindersGroup(page).getByText(
      "Notifications are off for Friend Tracker. Turn them on in the iPhone's Settings app, under Notifications → Friends.",
    ),
  ).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Notifications are off for Friend Tracker.')
  await expect(reminderSwitch(page)).toBeDisabled()
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'false')
  await expect(reminderSwitch(page)).toHaveAccessibleDescription(/Notifications → Friends\./)
  expect(server.requests).toEqual([])
})

test('says so when reminders are not set up on the server', async ({ page }) => {
  await stubPush(page)
  await fakeServer(page, 503)
  await page.goto('/#/settings')
  await reminderSwitch(page).click()
  await expect(page.getByRole('status')).toContainText("Birthday reminders aren't set up yet.")
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'false')
  expect(await storedSubscription(page)).toBeNull()
})

test('stays off when the schedule cannot be saved', async ({ page }) => {
  await stubPush(page)
  await fakeServer(page, 500)
  await page.goto('/#/settings')
  await reminderSwitch(page).click()
  await expect(page.getByRole('status')).toContainText("Couldn't turn on reminders. Please try again.")
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'false')
  expect(await storedSubscription(page)).toBeNull()
})

test('sends the schedule again when a birthday changes', async ({ page }) => {
  await stubPush(page)
  const server = await fakeServer(page)
  await page.goto('/#/settings')
  await reminderSwitch(page).click()
  await expect(page.getByRole('status')).toContainText('Birthday reminders are on')
  expect(server.requests[0].body?.reminders).toEqual([])

  await goToTab(page, 'Friends')
  const birthday = dayFromToday(10)
  await addFriend(page, 'Sam Chen', undefined, { month: birthday.month, day: birthday.day })
  // Sent about 2 seconds after the change.
  await expect.poll(() => server.requests.length, { timeout: 10_000 }).toBe(2)
  expect(server.requests[1].method).toBe('PUT')
  expect(server.requests[1].body?.reminders[0].at).toBe(nightBefore(birthday))
})

test('says when iOS stopped the reminders', async ({ page }) => {
  await stubPush(page)
  const server = await fakeServer(page)
  await page.goto('/#/settings')
  await reminderSwitch(page).click()
  await expect(page.getByRole('status')).toContainText('Birthday reminders are on')

  // iOS dropped the subscription, as it does after pushes that showed nothing.
  await page.evaluate((key) => localStorage.removeItem(key), FAKE_SUBSCRIPTION_KEY)
  await page.reload()
  await expect(remindersGroup(page).getByText('Reminders stopped. Turn them on again.')).toBeVisible({ timeout: 10_000 })
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'false')
  expect(server.requests.map((request) => request.method)).toEqual(['PUT', 'DELETE'])
})
