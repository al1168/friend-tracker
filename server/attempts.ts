// Failed sign-in counting per IP address, stored in Workers KV.

/** The part of Workers KV this module uses (so tests can pass an in-memory fake). */
export interface KVLike {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
}

export const MAX_ATTEMPTS = 10
export const WINDOW_SECONDS = 900

interface AttemptRecord {
  count: number
  /** ms timestamp of the first failure in this window */
  firstAt: number
}

export function attemptsKey(ip: string): string {
  return `fail:${ip}`
}

async function readRecord(kv: KVLike, ip: string, now: number): Promise<AttemptRecord | null> {
  let raw: string | null
  try {
    raw = await kv.get(attemptsKey(ip))
  } catch {
    return null // KV trouble shouldn't lock the owner out; the password is still required.
  }
  if (!raw) return null
  try {
    const record = JSON.parse(raw) as Partial<AttemptRecord>
    if (typeof record.count !== 'number' || typeof record.firstAt !== 'number') return null
    if (now - record.firstAt >= WINDOW_SECONDS * 1000) return null
    return { count: record.count, firstAt: record.firstAt }
  } catch {
    return null
  }
}

export async function isLockedOut(kv: KVLike, ip: string, now: number): Promise<boolean> {
  const record = await readRecord(kv, ip, now)
  return record !== null && record.count >= MAX_ATTEMPTS
}

export async function recordFailure(kv: KVLike, ip: string, now: number): Promise<void> {
  const record = (await readRecord(kv, ip, now)) ?? { count: 0, firstAt: now }
  const next: AttemptRecord = { count: record.count + 1, firstAt: record.firstAt }
  try {
    await kv.put(attemptsKey(ip), JSON.stringify(next), { expirationTtl: WINDOW_SECONDS })
  } catch {
    // KV allows about one write per key per second; a dropped count only makes the limit slightly lenient.
  }
}

export async function clearFailures(kv: KVLike, ip: string): Promise<void> {
  try {
    await kv.delete(attemptsKey(ip))
  } catch {
    // The record expires on its own after the window.
  }
}
