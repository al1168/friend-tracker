// "Forgot PIN?": checks the website password with the server's /__verify-password endpoint.

export const VERIFY_PASSWORD_URL = '/__verify-password'

export type PasswordCheck = 'ok' | 'wrong' | 'too-many' | 'signed-out' | 'offline' | 'error'

/** Only 204 counts as correct, so a captive portal or any stray 200 page can never reset the PIN. */
export async function verifySitePassword(password: string, fetcher: typeof fetch = fetch): Promise<PasswordCheck> {
  let response: Response
  try {
    response = await fetcher(VERIFY_PASSWORD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
      credentials: 'same-origin',
      cache: 'no-store',
    })
  } catch {
    return 'offline'
  }
  switch (response.status) {
    case 204:
      return 'ok'
    case 401:
      return 'wrong'
    case 403:
      return 'signed-out'
    case 429:
      return 'too-many'
    default:
      return 'error'
  }
}
