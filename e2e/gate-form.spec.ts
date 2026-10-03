// Real-browser check of the website gate's sign-in form, against the real gate code.
// (The cookie isn't checked: WebKit on Windows drops Secure cookies over http.)
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { expect, test } from '@playwright/test'
import { handleRequest, type GateEnv } from '../server/gate.ts'
import { createMemoryKv } from '../server/memoryKv.ts'

const PASSWORD = 'maple otter lantern river'
const env: GateEnv = {
  SITE_PASSWORD: PASSWORD,
  SESSION_SECRET: 'e2e-secret-0123456789-abcdefghijklmnopqrstuvwxyz',
  LOGIN_ATTEMPTS: createMemoryKv(),
}

let server: Server
let base = ''

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    const headers = new Headers()
    for (const [name, value] of Object.entries(req.headers)) {
      if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(', ') : value)
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
    const request = new Request(`http://${req.headers.host}${req.url}`, {
      method: req.method,
      headers,
      body: hasBody ? Buffer.concat(chunks) : undefined,
    })
    const result = await handleRequest(request, env, Date.now())
    if (result === 'next') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end('<!doctype html><title>App</title><h1>App</h1>')
      return
    }
    const outgoing: Record<string, string> = {}
    result.headers.forEach((value, name) => {
      outgoing[name] = value
    })
    res.writeHead(result.status, outgoing)
    res.end(Buffer.from(await result.arrayBuffer()))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
})

test.afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

test('a signed-out visitor signs in with the form (same-origin POST is accepted)', async ({ page }) => {
  await page.goto(base)
  await expect(page).toHaveURL(/\/__login\?next=%2F$/)
  await page.getByLabel('Password').fill(PASSWORD)
  const login = page.waitForResponse((response) => response.url().endsWith('/__login') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Sign in' }).click()
  const response = await login
  expect(response.status()).toBe(303)
  expect(response.headers()['location']).toBe('/')
})

test('a wrong password shows the error', async ({ page }) => {
  await page.goto(`${base}__login`)
  await page.getByLabel('Password').fill('not the password at all')
  const login = page.waitForResponse((response) => response.url().endsWith('/__login') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Sign in' }).click()
  expect((await login).status()).toBe(401)
  await expect(page.getByRole('alert')).toHaveText("That password didn't work.")
})
