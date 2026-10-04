// Which push endpoints the app may send to. Shared by the /__reminders endpoint (which checks what
// the app sends) and the sender (which checks again before fetching), so the Worker can't be used
// to send requests anywhere but a push service.

const PUSH_HOSTS = ['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com']
const PUSH_HOST_SUFFIXES = ['.push.apple.com', '.notify.windows.com']

const MAX_ENDPOINT_LENGTH = 1024

/**
 * The normalized form of an https: URL on a known push service with no user name, password or
 * port, or null for anything else. The normalized form is what gets stored and fetched.
 */
export function normalizePushEndpoint(endpoint: string): string | null {
  if (endpoint.length > MAX_ENDPOINT_LENGTH) return null
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.port !== '') return null
  const host = url.hostname
  if (!PUSH_HOSTS.includes(host) && !PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return null
  return url.href.length > MAX_ENDPOINT_LENGTH ? null : url.href
}

/** An https: URL on a known push service, with no user name, password or port. */
export function isPushEndpoint(endpoint: string): boolean {
  return normalizePushEndpoint(endpoint) !== null
}
