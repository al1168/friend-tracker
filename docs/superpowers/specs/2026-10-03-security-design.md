# Friend Tracker Security — Design

Date: 2026-10-03
Status: Approved (owner asked for best practices with auto-approval)

Related: [main design](2026-10-02-friend-tracker-design.md), [PRODUCT.md](../../../PRODUCT.md), [DESIGN.md](../../../DESIGN.md).

## Goal

Three protections:

1. **Private code.** The source is no longer public.
2. **Website password.** Nobody can load the app without the owner's password.
3. **App lock.** A Face ID / PIN lock inside the app, so someone holding the unlocked phone can't browse friends.

## Context and constraints

- The owner's data lives only in IndexedDB on their iPhone. The website serves just the app's files, so the password gate protects the app itself, not the data.
- The installed app opens from its service-worker cache, so the website gate is hit mainly on first load, on updates, and when the cache is gone. Day-to-day privacy comes from the app lock.
- iPhone's built-in "Require Face ID" does not appear to work for home-screen web apps. This is a vendor claim to be verified on the device. The app provides its own lock.
- Single user. Free services only, and no payment card required.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Hosting | Cloudflare Pages, deploying from the now-private GitHub repo. GitHub Pages turned off. |
| Website login | A custom password page in a Cloudflare Pages Function on the same origin. Cloudflare Access was rejected: it likely needs a card on file, logs out monthly, and its cross-site login is flaky in iOS home-screen apps. |
| Session length | 1 year |
| Lock timing | Lock after 15 minutes away, including when the app is reopened after being closed |
| PIN | 6 digits |
| Recovery | "Forgot PIN?" accepts the website password (online) and lets you set a new PIN. Data is kept. |

## Part 1: Hosting

- Make the GitHub repo `al1168/friend-tracker` private.
- Turn off GitHub Pages for the repo.
- Delete `.github/workflows/deploy.yml`.
- Cloudflare Pages project, Git-connected to the private repo:
  - Production branch: `main`
  - Build command: `npm run build`
  - Output directory: `dist`
  - Environment variable: `NODE_VERSION=24`. Also add `.node-version` containing `24`.
- Functions live in `/functions` and are deployed automatically with the site.
- Bindings, set in the Pages project settings for Production and Preview:
  - Secret `SITE_PASSWORD`: the owner's chosen passphrase, at least 16 characters (4 or more random words). The gate refuses to open with anything shorter.
  - Secret `SESSION_SECRET`: 32 random bytes, base64. Generated during setup, never committed.
  - KV namespace binding `LOGIN_ATTEMPTS`.
- Pages project → Settings → Runtime → "Fail open / closed" → **Fail closed**, for Production and Preview. If Cloudflare can't run the gate (for example, the free daily Functions quota runs out), the site is unavailable until midnight UTC instead of serving files without the password. The installed app keeps working offline.
- Pages project → Settings → Builds → **Automatic preview deployments: off**, so only `main` is built.
- Rotating `SITE_PASSWORD` or `SESSION_SECRET` signs every session out. Old deployments keep the secrets they were built with, so delete old deployments after rotating.
- The app URL becomes `https://<project>.pages.dev/`. Vite `base: './'` and hash routing need no change.

## Part 2: Website password gate

### Files

- `functions/_middleware.ts`: the entry point. It runs for every request, including static files.
- Shared server logic lives in `server/`, outside `functions/` so it never becomes a route:
  - `server/session.ts`: cookie create and verify
  - `server/password.ts`: constant-time check
  - `server/attempts.ts`: lockout counting
  - `server/loginPage.ts`: HTML
  - `server/gate.ts`: request handling, pure and testable with injected env

### Routes

| Request | Behavior |
|---|---|
| `GET /__login` | Signed in: `303` to `/`. Otherwise `200` with the sign-in page. |
| `POST /__login` (form: `password`, `next`) | Cross-site (`Sec-Fetch-Site: cross-site`, or an `Origin` header that isn't the site's own origin): `403`, before the lockout check and without counting. Locked out: `429` page, "Too many attempts. Try again in 15 minutes." Correct password: clear attempts, set session cookie, `303` to the sanitized `next` (default `/`). Wrong: record attempt, `401` page, "That password didn't work." |
| `POST /__verify-password` (JSON `{ "password": string }`) | Cross-site (same rule as above) or no valid session: `403`, nothing counted. Content type other than `application/json`: `415`, nothing counted. Locked out: `429`. Correct: `204` and clear attempts. Wrong: record attempt, `401`. Used by the app's "Forgot PIN?". |
| Any other request with a valid session | Passed through to the static asset (`next()`). |
| Any other request without a valid session | Navigations (`Sec-Fetch-Mode: navigate` or `Accept` includes `text/html`): `302` to `/__login?next=<path+query>`. Everything else: `401` with an empty body. |

- **`next` sanitization:** accept only paths matching `^/[\x21-\x7e]*$` (one leading `/`, then printable ASCII with no spaces), that don't start with `//` and contain no backslash. Anything else becomes `/`. Percent-encoded text is never decoded.
- **Headers on every response the gate itself produces:**
  - `Cache-Control: no-store`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `X-Frame-Options: DENY`

### Session cookie

- **Name:** `__Host-ft_session` (the `__Host-` prefix makes browsers require `Secure`, `Path=/` and no `Domain`)
- **Value:** `v1.<expiresAt>.<sig>`
  - `expiresAt` is Unix seconds.
  - `sig` is base64url HMAC-SHA256(session key, `"v1.<expiresAt>"`), where session key = HMAC-SHA256(`SESSION_SECRET`, `"ft-session\0" + SITE_PASSWORD`).
- **Attributes:** `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`
- **Valid when:** any cookie with that name verifies (a stray duplicate can't lock the owner out), the format parses, `expiresAt > now`, and the signature verifies via `crypto.subtle.verify`, which compares in constant time.
- **Rotation:** changing `SESSION_SECRET` or `SITE_PASSWORD` signs everyone out, because the session key depends on both. The old name `ft_session` is not accepted.

### Password check

Using a separate password-check key = HMAC-SHA256(`SESSION_SECRET`, `"ft-password-check"`), compute HMAC-SHA256(key, submitted) and HMAC-SHA256(key, `SITE_PASSWORD`), then compare the two 32-byte digests in constant time. This avoids leaking length or prefix through timing. Empty submissions and submissions over 1,024 characters are wrong. A `SITE_PASSWORD` shorter than 16 characters is a misconfiguration: the gate fails closed (`500`, "Friend Tracker isn't set up yet.").

### Lockout

- **Key:** `fail:<client address>` in `LOGIN_ATTEMPTS`, from `CF-Connecting-IP` (or `"unknown"`). An IPv4 address is used as is, an IPv4-mapped IPv6 address (`::ffff:1.2.3.4`) as its IPv4 address, and any other IPv6 address as its lowercase /64 prefix (the first four groups), so changing the lower 64 bits doesn't dodge the limit.
- **Value:** JSON `{ count, firstAt }`, written with `expirationTtl: 900`
- **Rule:** once `count >= 10` within the 15-minute window, both POST routes respond `429` without checking the password.
- **Reset:** a successful sign-in or verification deletes the key.
- **Accepted limit:** KV is eventually consistent and the limit is per address, so parallel or distributed guessing can exceed it. The real defense is the passphrase of at least 16 characters (4 or more random words), not the counter.

### Sign-in page

- Self-contained HTML with inline CSS and no external requests. It matches the app tokens (warm paper and peach accent), follows light/dark mode, and uses the system font.
- Content: "Friend Tracker", then "Enter your password to open the app.", a password field (`autocomplete="current-password"` so iCloud Keychain saves it), and a "Sign in" button.
- The error text sits under the field in a `role="alert"` region.
- Built for phones: 16px+ input text, 44pt targets.

### App changes for the gate

- Set `useCredentials: true` in vite-plugin-pwa, so the manifest link sends the cookie. Without it the manifest fetch is redirected and installing breaks.
- Add Workbox `navigateFallbackDenylist: [/^\/__/]` so `/__login` and `/__verify-password` always go to the network and are never answered with the cached app shell.

## Part 3: App lock

### Settings (stored in IndexedDB `settings`, never exported or imported)

| Key | Value |
|---|---|
| `appLock` | `{ enabled: boolean, pin: { hash, salt, iterations } \| null, passkeyId: string \| null }` (`hash`, `salt` base64; `passkeyId` base64url) |
| `appLockFailures` | `{ count: number, lockedUntil: number \| null }` (ms timestamps) |

`localStorage['ft:lastActiveAt']` holds a ms timestamp. It's read synchronously at launch; if it's missing or unreadable, the app locks.

### Rules (pure functions in `src/lock/policy.ts`)

- **`shouldLock({ enabled, lastActiveAt, now })`:** true when enabled and either `lastActiveAt` is null or `now - lastActiveAt >= 15 min`.
- **`lastActiveAt` is written:**
  - on `visibilitychange` to hidden
  - on `pagehide`
  - every 30 s while visible
- **The check runs:** at launch, and on `visibilitychange` back to visible.
- **Wrong-PIN backoff:**
  - Failures 1–4 have no wait.
  - Failure 5 imposes a 30 s wait, doubling with each further failure up to 15 min. `lockedUntil` is persisted, so reloading doesn't reset it.
  - A correct PIN or a Face ID unlock resets the count.

### PIN (`src/lock/pin.ts`)

- Exactly 6 digits.
- Hash: PBKDF2-SHA256 via WebCrypto with 210,000 iterations, a 16-byte random salt and a 32-byte output.
- Verification recomputes the hash and compares it in constant time.

### Face ID (`src/lock/passkey.ts`, WebAuthn)

- **Availability:** `PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()`. If unavailable, the app is PIN-only and the Face ID option is hidden.
- **Register:** `navigator.credentials.create`, always called from a tap, with:
  - `rp: { name: 'Friend Tracker', id: location.hostname }`
  - a random 16-byte user id
  - `user.name` / `displayName` set to "Friend Tracker"
  - `pubKeyCredParams` ES256 (-7) and RS256 (-257)
  - `authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' }`
  - a random challenge and a 60 s timeout

  The credential id is stored as `passkeyId`.
- **Unlock:** `navigator.credentials.get` from a tap, with `allowCredentials: [passkeyId]`, `userVerification: 'required'` and a random challenge. Success requires the returned id to equal `passkeyId` and the UV flag (`authenticatorData[32] & 0x04`) to be set.
- **Failure:** cancelling or failing stays on the lock screen with "Face ID didn't work. Use your PIN." It does not count as a PIN failure.

### Lock screen (`src/lock/LockScreen.tsx`, `PinPad.tsx`)

- `LockGate` wraps the whole app (inside `ErrorBoundary`). While locked it renders only the lock screen: no routes, no tab bar, no data queries mounted.
- Layout:
  - App mark (the two circles), then "Friend Tracker is locked".
  - The **Unlock with Face ID** button, when a passkey is set up.
  - Six dot indicators and a 3×4 keypad (1–9, blank, 0, delete) with large round keys of 64pt or more, in thumb reach.
  - The PIN checks automatically once the 6th digit is entered.
- Feedback:
  - Wrong PIN: the dots clear, with "Wrong PIN. Try again." (`role="alert"`).
  - During backoff, the keypad is disabled with "Try again in 0:30", counting down.
- **"Forgot PIN?"** (text button) asks for the website password, posts to `/__verify-password` with credentials, then shows "Choose a new PIN" (entered twice) and unlocks. Errors:
  - `401`: "That password didn't work."
  - `429`: "Too many attempts. Try again in 15 minutes."
  - `403` (the website sign-in expired): "Your sign-in expired. Sign in again, then reset your PIN." with a **Sign in** button that navigates to `/__login?next=/`.
  - Network error: "You need to be online to reset your PIN."
- Reduced motion: no shake animation, just the message.

### Settings screen additions (an "App lock" section)

- **Lock off:**
  - Row "Turn on app lock" (accent). It opens a sheet: "Choose a 6-digit PIN", then "Enter it again", then, if available, "Use Face ID to unlock?" with **Use Face ID** and **Not now**.
  - Footer: "Locks the app after 15 minutes away. Unlock with Face ID or your PIN."
- **Lock on:**
  - Row "Face ID", trailing "On" or "Off". Tapping it toggles: turning on registers a passkey, turning off clears `passkeyId`.
  - Row "Change PIN": current PIN, then new PIN twice.
  - Row "Turn off app lock" (destructive): requires the current PIN or Face ID, then clears `appLock`.
- Same footer as above.

### Honest limit

This is a UI gate, not encryption. It stops someone holding the unlocked phone. It doesn't stop someone with developer tools attached to the unlocked phone. The PIN hash could also be brute-forced offline by such a person, since there are only 10⁶ PINs. Encrypting the database is out of scope.

## Rollout

1. **Owner:** in the current app, **Settings → Export backup → Save to Files**.
2. **Build:** build and test Parts 2 and 3. Add `.node-version` and remove the GitHub deploy workflow.
3. **Make private:** make the repo private, turn off GitHub Pages, push.
4. **Owner (guided):**
   - Create a free Cloudflare account.
   - Create the Pages project from the private repo with the settings above.
   - Create the KV namespace and bind it as `LOGIN_ATTEMPTS`.
   - Set the `SITE_PASSWORD` secret to their chosen passphrase, and `SESSION_SECRET` to a generated value.
   - Redeploy.
5. **Verify** the live site with an automated WebKit check:
   - Unauthenticated `/` redirects to `/__login`, and an unauthenticated asset returns `401`.
   - A wrong password returns `401`.
   - The right password opens the app.
   - `/__verify-password` behaves as specified.
6. **Owner on the iPhone:**
   1. Open the new link in Safari, sign in, and let Keychain save the password.
   2. Add to Home Screen, open it from the icon, and sign in again (the icon has separate cookies).
   3. **Import backup.**
   4. Turn on **App lock** with Face ID.
   5. Delete the old icon.
   6. Check whether iOS offers "Require Face ID" on the icon.

## Testing

- **Unit (Vitest, Node):**
  - `server/` modules:
    - cookie round trip, tampering, expiry, malformed values
    - password check
    - lockout counting with an in-memory KV fake
    - every route's status and redirect in `gate.ts`
    - `next` sanitization
  - `src/lock/`: PIN hash and verify, `shouldLock`, and the backoff schedule.
- **E2E (Playwright WebKit, iPhone 13):**
  - Turn on the lock with a PIN, reload, and confirm it is locked.
  - A wrong PIN shows the message; the correct PIN unlocks.
  - Backoff after 5 wrong PINs.
  - "Forgot PIN?" with `/__verify-password` mocked via `page.route` (204, 401, 429).
  - Change PIN, and turn the lock off.
  - The existing 35 tests stay green; the lock is off by default.
  - The e2e server (`vite preview`) doesn't run Functions, so the gate is covered by unit tests and the live check.
- **Manual on iPhone:** Face ID registration and unlock, both sign-ins, install, import, and the 15-minute relock.

## Out of scope

Encrypting the database, multiple users, sign-out and password change UI (rotate the secrets in Cloudflare instead), a custom domain, and Cloudflare Access.

## Decisions made while planning

Recorded in [the security plan](../plans/2026-10-03-security.md):

- **The gate fails closed.** A missing `SITE_PASSWORD`, a missing or shorter-than-32-character `SESSION_SECRET`, or a missing `LOGIN_ATTEMPTS` binding makes every request answer `500` "Friend Tracker isn't set up yet."
- **Extra gate answers.** Other methods on `/__login` and `/__verify-password` get `405`. A `/__verify-password` body that isn't `{ "password": string }` gets `400` and isn't counted. Submissions over 1,024 characters are wrong. `next` also rejects control characters.
- **Sign-in page.** Sent with `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`. It has a visible "Password" label and a visually hidden `username` field ("Friend Tracker") so Keychain files the password under a name.
- **Lockout.** `firstAt` is a ms timestamp; the window starts at the first failure. If KV errors, the lockout check is skipped (the password is still required) and a failed write isn't counted. IPv6 addresses are counted per /64 prefix.
- **Hardening.** `SITE_PASSWORD` shorter than 16 characters fails closed like a missing secret. The cookie is `__Host-ft_session`, signed with a key derived from `SESSION_SECRET` and `SITE_PASSWORD` (rotating the password signs everyone out); the password check uses a separate derived key. `next` allows printable ASCII only. A cross-site POST (`Sec-Fetch-Site: cross-site`, or an `Origin` that isn't the site) gets `403` before anything is counted, and `/__verify-password` needs a JSON content type (`415` otherwise).
- **Forgot PIN.** Only `204` counts as correct. Any other status (a captive portal's `200`, a `405`, a `500`) shows "Couldn't check your password. Please try again." When the sign-in expired (`403`), the sheet's main button becomes **Sign in**.
- **App lock.** `ft:lastActiveAt` is written whether or not the lock is on; the lock counts as on only when a PIN is stored. Wrong PINs in Change PIN and Turn off app lock count toward the same backoff. Turning the lock on saves it right after the PIN is confirmed, before the Face ID question. Resetting a forgotten PIN keeps Face ID.
- **Settings.** The "App lock" group sits between Backup and About your data. Without Face ID on the device, the Face ID row is hidden and the footer reads "Locks the app after 15 minutes away. Unlock with your PIN."
- **Lock screen.** "Enter your PIN" sits under the title and "Forgot PIN?" under the keypad. Wrong-PIN messages use calm secondary ink, not red. While PIN entry is paused, the countdown is a `role="timer"`, announced once.
