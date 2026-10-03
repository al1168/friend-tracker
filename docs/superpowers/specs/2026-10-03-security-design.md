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
  - Secret `SITE_PASSWORD`: the owner's chosen passphrase. Recommended: at least 4 random words.
  - Secret `SESSION_SECRET`: 32 random bytes, base64. Generated during setup, never committed.
  - KV namespace binding `LOGIN_ATTEMPTS`.
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
| `POST /__login` (form: `password`, `next`) | Locked out: `429` page, "Too many attempts. Try again in 15 minutes." Correct password: clear attempts, set session cookie, `303` to the sanitized `next` (default `/`). Wrong: record attempt, `401` page, "That password didn't work." |
| `POST /__verify-password` (JSON `{ "password": string }`) | Requires a valid session, otherwise `403` (signed out). Locked out: `429`. Correct: `204` and clear attempts. Wrong: record attempt, `401`. Used by the app's "Forgot PIN?". |
| Any other request with a valid session | Passed through to the static asset (`next()`). |
| Any other request without a valid session | Navigations (`Sec-Fetch-Mode: navigate` or `Accept` includes `text/html`): `302` to `/__login?next=<path+query>`. Everything else: `401` with an empty body. |

- **`next` sanitization:** accept only paths that start with `/` and not `//`, and contain no backslash. Anything else becomes `/`.
- **Headers on every response the gate itself produces:**
  - `Cache-Control: no-store`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
  - `X-Frame-Options: DENY`

### Session cookie

- **Name:** `ft_session`
- **Value:** `v1.<expiresAt>.<sig>`
  - `expiresAt` is Unix seconds.
  - `sig` is base64url HMAC-SHA256(`SESSION_SECRET`, `"v1.<expiresAt>"`).
- **Attributes:** `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=31536000`
- **Valid when:** the format parses, `expiresAt > now`, and the signature verifies via `crypto.subtle.verify`, which compares in constant time.
- **Rotation:** changing `SESSION_SECRET` signs everyone out.

### Password check

Compute HMAC-SHA256(`SESSION_SECRET`, submitted) and HMAC-SHA256(`SESSION_SECRET`, `SITE_PASSWORD`), then compare the two 32-byte digests in constant time. This avoids leaking length or prefix through timing. Empty submissions are wrong.

### Lockout

- **Key:** `fail:<CF-Connecting-IP or "unknown">` in `LOGIN_ATTEMPTS`
- **Value:** JSON `{ count, firstAt }`, written with `expirationTtl: 900`
- **Rule:** once `count >= 10` within the 15-minute window, both POST routes respond `429` without checking the password.
- **Reset:** a successful sign-in or verification deletes the key.
- **Accepted limit:** KV is eventually consistent, so counts may be slightly lenient.

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
