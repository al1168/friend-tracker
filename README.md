# Friend Tracker

A private iPhone app for remembering when you last saw your friends and how often you met this year vs last year. Everything stays on your phone.

## Use it on your iPhone

1. Open https://friend.aldenlu.com/ in **Safari** and sign in with the website password. Let Safari save it to your passwords.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open it from the new **Friends** icon, and sign in again if asked (the icon keeps its own sign-in). Always use the icon: data entered in a Safari tab is stored separately.
4. Optional: **Settings → App lock** locks the app after 15 minutes away. Unlock with Face ID or a 6-digit PIN; **Forgot PIN?** takes the website password. The lock stops someone holding your unlocked phone; it doesn't encrypt your data. Face ID unlock also accepts your iPhone passcode (if Face ID fails, iOS offers the passcode), so anyone who knows your iPhone passcode can unlock the app that way. **Forgot PIN?** asks for the website password, which Safari can fill from your saved passwords after Face ID or your iPhone passcode, so it is no stronger than your iPhone passcode, the same limit as Face ID unlock. Also, setting the clock to within 15 minutes after your last use still opens the app, and moving the clock forward can skip a wrong-PIN wait. The iPhone app switcher may still show the last screen you used, and locking again discards an unsaved sheet draft.
5. Back up now and then: **Settings → Export backup** → Save to Files (iCloud Drive).

## Hosting

Cloudflare Pages (free plan) builds the private GitHub repo and publishes it on every push to `main`.

- Build command `npm test && npm run build` (a failing unit test stops the deploy), output directory `dist`, Node 24 (`NODE_VERSION=24` and `.node-version`).
- `functions/_middleware.ts` runs in front of every request, static files included, and asks for the website password. The logic lives in `server/` and is unit tested. The local dev and preview servers don't run it.
- Project settings, for both Production and Preview:
  - Secret `SITE_PASSWORD`: the website password, at least 16 characters (4 or more random words). Changing it signs everyone out.
  - Secret `SESSION_SECRET`: 32 random bytes, base64. Changing it signs everyone out.
  - KV namespace binding `LOGIN_ATTEMPTS`: failed sign-ins. Ten wrong tries pause sign-in for 15 minutes.
- Settings → Runtime → Fail open / closed: **Fail closed**, for Production and Preview. Settings → Builds: automatic preview deployments are off.
- After changing a secret or binding, redeploy (Deployments → Retry deployment). Old deployments keep the secrets they were built with, so delete old deployments after changing `SITE_PASSWORD`.
- The Pages project is `friend-tracker` (`https://friend-tracker-3bx.pages.dev/`), with the custom domain `friend.aldenlu.com`. Only use the custom domain on the phone: each address keeps its own data, sign-in and Face ID.
- Keep Cloudflare challenges (I'm Under Attack mode, challenge rules) off for `friend.aldenlu.com`. The app's background requests (offline copy, updates, the icon, "Forgot PIN?") can't pass them.
- Check the live site: `node scripts/verify-live.ts https://friend.aldenlu.com/` (set `FT_PASSWORD` to also check signing in).
- The site is set to fail closed. If the free plan's 100,000 daily Functions requests ever run out, the website is unavailable until midnight UTC, but the installed app keeps working offline. Your data isn't on the website; "Forgot PIN?" won't work until then.

## Develop

    npm install
    npm run dev           # then open the printed URL (use the Network URL on your phone, same Wi-Fi)
    npm test              # unit tests (app and server)
    npm run e2e           # end-to-end tests in WebKit at iPhone size
    npm run screenshots   # light/dark/large-text screenshots into e2e/screenshots/

The app lock needs HTTPS or localhost (for WebCrypto), so it can't be turned on over the Wi-Fi URL.
