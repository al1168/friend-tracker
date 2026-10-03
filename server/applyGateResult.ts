// Turns the gate's answer into the response the middleware sends. Anything it doesn't recognise is refused,
// so a change to the gate's result type can never open the site by accident.

import type { GateResult } from './gate.ts'

export async function applyGateResult(result: GateResult, next: () => Promise<Response>): Promise<Response> {
  if (result === 'next') return next()
  if (
    typeof result === 'object' &&
    result !== null &&
    !(result instanceof Response) &&
    'kind' in result &&
    result.kind === 'next' &&
    'setCookie' in result &&
    typeof result.setCookie === 'string'
  ) {
    // A session close to expiring is renewed: serve the file and send a fresh cookie with it.
    const served = await next()
    const response = new Response(served.body, served)
    response.headers.append('Set-Cookie', result.setCookie)
    return response
  }
  if (result instanceof Response) return result
  return new Response("Friend Tracker isn't set up yet.", {
    status: 500,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}
