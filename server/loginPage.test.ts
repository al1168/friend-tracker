import { describe, expect, it } from 'vitest'
import { loginPage } from './loginPage.ts'

describe('loginPage', () => {
  it('asks for the password with a field Keychain can fill', () => {
    const html = loginPage({ next: '/', error: null })
    expect(html).toContain('<h1>Friend Tracker</h1>')
    expect(html).toContain('Enter your password to open the app.')
    expect(html).toContain('type="password" autocomplete="current-password"')
    expect(html).toContain('<button type="submit">Sign in</button>')
    expect(html).toContain('<p class="error" id="error" role="alert"></p>')
    expect(html).not.toContain('aria-invalid')
    expect(html).not.toMatch(/<(script|link|img)\b/)
  })

  it('shows the error under the field', () => {
    const html = loginPage({ next: '/', error: "That password didn't work." })
    expect(html).toContain('<p class="error" id="error" role="alert">That password didn&#39;t work.</p>')
    expect(html).toContain('aria-invalid="true" aria-describedby="error"')
  })

  it('escapes the return path', () => {
    const html = loginPage({ next: '/a"><script>x</script>', error: null })
    expect(html).toContain('name="next" value="/a&quot;&gt;&lt;script&gt;x&lt;/script&gt;"')
    expect(html).not.toContain('<script>')
  })
})
