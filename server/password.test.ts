import { describe, expect, it } from 'vitest'
import { checkPassword } from './password.ts'

const SECRET = 'test-secret-0123456789-abcdefghijklmnop'
const PASSWORD = 'maple otter lantern river'

describe('checkPassword', () => {
  it('accepts the right password', async () => {
    expect(await checkPassword(SECRET, PASSWORD, PASSWORD)).toBe(true)
  })

  it('rejects a wrong password, a prefix, and a longer string', async () => {
    expect(await checkPassword(SECRET, PASSWORD, 'maple otter lantern rivet')).toBe(false)
    expect(await checkPassword(SECRET, PASSWORD, 'maple otter')).toBe(false)
    expect(await checkPassword(SECRET, PASSWORD, `${PASSWORD} `)).toBe(false)
  })

  it('rejects an empty or oversized submission', async () => {
    expect(await checkPassword(SECRET, PASSWORD, '')).toBe(false)
    expect(await checkPassword(SECRET, 'x'.repeat(2000), 'x'.repeat(2000))).toBe(false)
  })

  it('rejects everything when no password is configured', async () => {
    expect(await checkPassword(SECRET, '', '')).toBe(false)
    expect(await checkPassword(SECRET, '', 'anything')).toBe(false)
  })
})
