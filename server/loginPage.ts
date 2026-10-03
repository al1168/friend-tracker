// The sign-in page. Self-contained (inline CSS, no requests) and styled with the app's tokens.

export interface LoginPageOptions {
  /** Already sanitized path to return to after signing in. */
  next: string
  error: string | null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const STYLES = `
:root {
  color-scheme: light dark;
  --bg: oklch(96.4% 0.009 60);
  --surface: oklch(99.4% 0.004 60);
  --ink: oklch(25% 0.014 50);
  --ink-2: oklch(47% 0.014 50);
  --accent: oklch(81% 0.095 50);
  --accent-pressed: oklch(77% 0.105 48);
  --on-accent: oklch(29% 0.06 40);
  --accent-ink: oklch(53% 0.15 38);
  --accent-soft: oklch(94.5% 0.03 55);
  --danger: oklch(55% 0.19 27);
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: oklch(18.5% 0.008 55);
    --surface: oklch(23.5% 0.009 55);
    --ink: oklch(95% 0.008 70);
    --ink-2: oklch(76% 0.012 60);
    --accent: oklch(80% 0.1 50);
    --accent-pressed: oklch(75% 0.11 48);
    --on-accent: oklch(26% 0.05 40);
    --accent-ink: oklch(81% 0.1 52);
    --accent-soft: oklch(31% 0.04 50);
    --danger: oklch(70% 0.17 25);
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
@supports (font: -apple-system-body) { html { font: -apple-system-body; } }
body {
  margin: 0;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: calc(env(safe-area-inset-top, 0px) + 1.5rem) 1rem calc(env(safe-area-inset-bottom, 0px) + 1.5rem);
  background: var(--bg);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.35;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}
main { width: 100%; max-width: 22rem; display: flex; flex-direction: column; align-items: center; text-align: center; }
.mark { width: 96px; height: 64px; margin-bottom: 1rem; }
.mark .a { fill: var(--accent-soft); }
.mark .b { fill: var(--accent); opacity: 0.75; }
h1 {
  margin: 0;
  font-family: ui-rounded, 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1.2;
}
.lead { margin: 0.5rem 0 1.5rem; color: var(--ink-2); text-wrap: balance; }
form { width: 100%; display: flex; flex-direction: column; gap: 0.5rem; text-align: left; }
label { margin: 0 0.25rem; font-size: 0.77rem; font-weight: 600; color: var(--ink-2); }
.field {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: 0.6rem 0.9rem;
  border: 0;
  border-radius: 12px;
  background: var(--surface);
  color: var(--ink);
  font: inherit;
  font-size: max(16px, 1rem);
}
.error { min-height: 1.35em; margin: 0 0.25rem; font-size: 0.77rem; color: var(--danger); }
button {
  min-height: 52px;
  margin-top: 0.5rem;
  border: 0;
  border-radius: 999px;
  background: var(--accent);
  color: var(--on-accent);
  font: inherit;
  font-size: 1.06rem;
  font-weight: 600;
  cursor: pointer;
}
button:active { background: var(--accent-pressed); }
:focus-visible { outline: 2px solid var(--accent-ink); outline-offset: 2px; }
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
`

export function loginPage({ next, error }: LoginPageOptions): string {
  const invalid = error ? ' aria-invalid="true" aria-describedby="error"' : ''
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F8F2ED" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#16120F" media="(prefers-color-scheme: dark)">
<meta name="robots" content="noindex">
<title>Sign in · Friend Tracker</title>
<style>${STYLES}</style>
</head>
<body>
<main>
<svg class="mark" viewBox="0 0 120 80" aria-hidden="true"><circle class="a" cx="48" cy="40" r="28"/><circle class="b" cx="72" cy="40" r="28"/></svg>
<h1>Friend Tracker</h1>
<p class="lead">Enter your password to open the app.</p>
<form method="post" action="/__login">
<input type="hidden" name="next" value="${escapeHtml(next)}">
<input class="visually-hidden" type="text" name="username" value="Friend Tracker" autocomplete="username" tabindex="-1" aria-hidden="true">
<label for="password">Password</label>
<input class="field" id="password" name="password" type="password" autocomplete="current-password" required autofocus${invalid}>
<p class="error" id="error" role="alert">${error ? escapeHtml(error) : ''}</p>
<button type="submit">Sign in</button>
</form>
</main>
</body>
</html>
`
}
