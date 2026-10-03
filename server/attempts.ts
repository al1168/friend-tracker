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

/** Expands an IPv6 address to 8 numbers, or null when it isn't one. Handles `::` and a dotted IPv4 tail. */
function parseIpv6(text: string): number[] | null {
  let address = text
  const dotted = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(address)
  if (dotted) {
    const bytes = dotted.slice(2).map(Number)
    if (bytes.some((byte) => byte > 255)) return null
    address = `${dotted[1]}${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`
  }
  const halves = address.split('::')
  if (halves.length > 2) return null
  const parse = (part: string) => (part === '' ? [] : part.split(':'))
  const head = parse(halves[0])
  const tail = halves.length === 2 ? parse(halves[1]) : []
  const missing = 8 - head.length - tail.length
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return null
  return groups.map((group) => parseInt(group, 16))
}

/**
 * What failures are counted against: an IPv4 address as is, an IPv4-mapped IPv6 address as its IPv4 address,
 * and any other IPv6 address as its /64 prefix (one household or phone gets a whole /64, so a single
 * address can't dodge the limit by changing the lower 64 bits).
 */
export function normalizeIp(ip: string): string {
  const text = ip.trim().toLowerCase().split('%')[0]
  if (!text.includes(':')) return text
  const groups = parseIpv6(text)
  if (!groups) return text
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 255, groups[7] >> 8, groups[7] & 255].join('.')
  }
  return `${groups.slice(0, 4).map((group) => group.toString(16)).join(':')}::/64`
}

export function attemptsKey(ip: string): string {
  return `fail:${normalizeIp(ip)}`
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
