// Runs in front of every request to the site, static files included (Cloudflare Pages Functions).
import { applyGateResult } from '../server/applyGateResult.ts'
import { handleRequest } from '../server/gate.ts'

interface Env {
  SITE_PASSWORD: string
  SESSION_SECRET: string
  LOGIN_ATTEMPTS: KVNamespace
}

export const onRequest: PagesFunction<Env> = async (context) =>
  applyGateResult(await handleRequest(context.request, context.env, Date.now()), () => context.next())
