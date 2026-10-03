// Runs in front of every request to the site, static files included (Cloudflare Pages Functions).
import { handleRequest } from '../server/gate.ts'

interface Env {
  SITE_PASSWORD: string
  SESSION_SECRET: string
  LOGIN_ATTEMPTS: KVNamespace
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const result = await handleRequest(context.request, context.env, Date.now())
  if (result === 'next') return context.next()
  if (result instanceof Response) return result
  // A session close to expiring is renewed: serve the file and send a fresh cookie with it.
  const served = await context.next()
  const response = new Response(served.body, served)
  response.headers.append('Set-Cookie', result.setCookie)
  return response
}
