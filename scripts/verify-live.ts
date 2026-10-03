// Checks the deployed website password gate in WebKit at iPhone size.
//
//   node scripts/verify-live.ts https://friend-tracker.pages.dev/
//
// Without FT_PASSWORD it checks everything a stranger sees (and spends one wrong attempt).
// With FT_PASSWORD set to the website password it also signs in and checks the signed-in side.

import assert from 'node:assert/strict'
import { devices, request, webkit } from '@playwright/test'

const target = process.argv[2]
if (!target) {
  console.error('Usage: node scripts/verify-live.ts https://<project>.pages.dev/')
  process.exit(2)
}
const base = new URL('/', target).href
const password = process.env.FT_PASSWORD ?? ''
const wrongPassword = `not-the-password-${Date.now()}`

let passed = 0
async function check(name: string, run: () => Promise<void>) {
  await run()
  passed += 1
  console.log(`ok ${passed} - ${name}`)
}

const anonymous = await request.newContext({ baseURL: base, maxRedirects: 0 })

await check('a signed-out page load goes to the sign-in page', async () => {
  const response = await anonymous.get('/', { headers: { Accept: 'text/html' } })
  assert.equal(response.status(), 302)
  assert.equal(response.headers()['location'], '/__login?next=%2F')
})

await check('a signed-out file request gets 401 and nothing else', async () => {
  const response = await anonymous.get('/manifest.webmanifest', { headers: { Accept: '*/*' } })
  assert.equal(response.status(), 401)
  assert.equal(await response.text(), '')
})

await check('the sign-in page is served with the security headers', async () => {
  const response = await anonymous.get('/__login')
  assert.equal(response.status(), 200)
  assert.match(await response.text(), /Enter your password to open the app\./)
  const headers = response.headers()
  assert.equal(headers['cache-control'], 'no-store')
  assert.equal(headers['x-content-type-options'], 'nosniff')
  assert.equal(headers['referrer-policy'], 'same-origin')
  assert.equal(headers['x-frame-options'], 'DENY')
  assert.match(headers['content-security-policy'] ?? '', /default-src 'none'/)
})

await check('a wrong password is refused', async () => {
  const response = await anonymous.post('/__login', { form: { password: wrongPassword, next: '/' } })
  assert.equal(response.status(), 401)
  assert.match(await response.text(), /That password didn&#39;t work\./)
  assert.equal(response.headers()['set-cookie'], undefined)
})

await check('a sign-in from another site is refused without being counted', async () => {
  const response = await anonymous.post('/__login', {
    form: { password: wrongPassword, next: '/' },
    headers: { Origin: 'https://evil.example' },
  })
  assert.equal(response.status(), 403)
  assert.equal(response.headers()['set-cookie'], undefined)
})

await check('the password check needs a signed-in session', async () => {
  const response = await anonymous.post('/__verify-password', { data: { password: wrongPassword } })
  assert.equal(response.status(), 403)
})

const browser = await webkit.launch()
const context = await browser.newContext({ ...devices['iPhone 13'] })
const page = await context.newPage()

await check('Safari shows the sign-in page first', async () => {
  await page.goto(base)
  assert.equal(new URL(page.url()).pathname, '/__login')
  await page.getByRole('heading', { name: 'Friend Tracker' }).waitFor()
  await page.getByLabel('Password').waitFor()
})

if (!password) {
  console.log('Set FT_PASSWORD to also check signing in.')
} else {
  await check('the right password opens the app', async () => {
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.getByRole('heading', { level: 1, name: 'Friends' }).waitFor()
    assert.equal(page.url(), base)
  })

  await check('the session cookie is HttpOnly, Secure, SameSite=Lax and lasts a year', async () => {
    // Read the raw header: WebKit on Windows reports every cookie's SameSite as "None".
    const response = await anonymous.post('/__login', { form: { password, next: '/' } })
    assert.equal(response.status(), 303)
    // assert.ok, not assert.match: a failed match would print the cookie value.
    const attributes = /^__Host-ft_session=v1\.\d+\.[\w-]{43}; HttpOnly; Secure; SameSite=Lax; Path=\/; Max-Age=31536000$/
    assert.ok(attributes.test(response.headers()['set-cookie'] ?? ''), 'Set-Cookie attributes differ')
    const cookie = (await context.cookies(base)).find((c) => c.name === '__Host-ft_session')
    assert.ok(cookie, 'Safari did not keep the __Host-ft_session cookie')
    const days = (cookie.expires * 1000 - Date.now()) / 86_400_000
    assert.ok(days > 360 && days <= 366, `cookie lasts ${days.toFixed(1)} days`)
  })

  await check('the manifest loads with the cookie (installing works)', async () => {
    const link = page.locator('link[rel="manifest"]')
    assert.equal(await link.getAttribute('crossorigin'), 'use-credentials')
    const response = await page.request.get(new URL((await link.getAttribute('href')) ?? '', base).href)
    assert.equal(response.status(), 200)
    assert.equal((await response.json()).name, 'Friend Tracker')
  })

  await check('the password check answers 415, 401, then 204', async () => {
    const url = new URL('/__verify-password', base).href
    const notJson = await page.request.post(url, { data: 'password', headers: { 'Content-Type': 'text/plain' } })
    assert.equal(notJson.status(), 415)
    assert.equal((await page.request.post(url, { data: { password: wrongPassword } })).status(), 401)
    assert.equal((await page.request.post(url, { data: { password } })).status(), 204)
  })

  await check('the sign-in page is never answered from the offline cache', async () => {
    // Only meaningful once the service worker controls the page, so wait for that first.
    await page.evaluate(() => navigator.serviceWorker.ready)
    await page.reload()
    assert.ok(await page.evaluate(() => navigator.serviceWorker.controller !== null), 'the service worker is not in control')
    await page.goto(new URL('/__login', base).href)
    await page.getByRole('heading', { level: 1, name: 'Friends' }).waitFor()
    assert.equal(page.url(), base)
  })
}

await browser.close()
await anonymous.dispose()
console.log(`All ${passed} checks passed.`)
