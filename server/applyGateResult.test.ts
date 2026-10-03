import { describe, expect, it } from 'vitest'
import { applyGateResult } from './applyGateResult.ts'

function served(): Response {
  return new Response('the file', { status: 200, headers: { 'Content-Type': 'text/plain', 'X-File': 'yes' } })
}

describe('applyGateResult', () => {
  it("serves the file untouched for 'next'", async () => {
    let calls = 0
    const response = await applyGateResult('next', async () => {
      calls += 1
      return served()
    })
    expect(calls).toBe(1)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('the file')
    expect(response.headers.get('X-File')).toBe('yes')
    expect(response.headers.get('Set-Cookie')).toBeNull()
  })

  it('serves the file and appends the fresh cookie for a renewal', async () => {
    let calls = 0
    const next = async () => {
      calls += 1
      const response = served()
      response.headers.append('Set-Cookie', 'other=1; Path=/')
      return response
    }
    const response = await applyGateResult({ kind: 'next', setCookie: '__Host-ft_session=new; Path=/' }, next)
    expect(calls).toBe(1)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('the file')
    expect(response.headers.get('Content-Type')).toBe('text/plain')
    expect(response.headers.get('X-File')).toBe('yes')
    expect(response.headers.getSetCookie()).toEqual(['other=1; Path=/', '__Host-ft_session=new; Path=/'])
  })

  it('keeps the status of a renewed response that is not 200', async () => {
    const response = await applyGateResult(
      { kind: 'next', setCookie: 'a=b' },
      async () => new Response('missing', { status: 404 }),
    )
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('missing')
    expect(response.headers.getSetCookie()).toEqual(['a=b'])
  })

  it('returns a Response as is and never serves the file', async () => {
    const denied = new Response('no', { status: 401, headers: { 'X-Gate': 'closed', 'Set-Cookie': 'x=1' } })
    const response = await applyGateResult(denied, async () => {
      throw new Error('next must not be called')
    })
    expect(response).toBe(denied)
    expect(response.status).toBe(401)
    expect(await response.text()).toBe('no')
    expect(response.headers.get('X-Gate')).toBe('closed')
    expect(response.headers.getSetCookie()).toEqual(['x=1'])
  })

  it('fails closed on anything it does not recognise', async () => {
    for (const odd of [undefined, null, 'allow', {}, { kind: 'next' }, { setCookie: 1 }, { kind: 'x', setCookie: 'a' }, 42]) {
      const response = await applyGateResult(odd as never, async () => {
        throw new Error('next must not be called')
      })
      expect(response.status).toBe(500)
      expect(await response.text()).toBe("Friend Tracker isn't set up yet.")
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
    }
  })
})
