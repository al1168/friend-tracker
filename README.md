# Friend Tracker

A private iPhone app for remembering when you last saw your friends and how often you met this year vs last year. Everything stays on your phone.

## Use it on your iPhone

1. Open https://friend.aldenlu.com/ in **Safari** and sign in with the website password. Let Safari save it to your passwords.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open it from the new **Friends** icon, and sign in again if asked (the icon keeps its own sign-in). Always use the icon: data entered in a Safari tab is stored separately.
4. Optional: **Settings → App lock** locks the app after 15 minutes away. Unlock with Face ID or a 6-digit PIN; **Forgot PIN?** takes the website password. The lock stops someone holding your unlocked phone; it doesn't encrypt your data. Face ID unlock also accepts your iPhone passcode (if Face ID fails, iOS offers the passcode), so anyone who knows your iPhone passcode can unlock the app that way. **Forgot PIN?** asks for the website password, which Safari can fill from your saved passwords after Face ID or your iPhone passcode, so it is no stronger than your iPhone passcode, the same limit as Face ID unlock. Also, setting the clock to within 15 minutes after your last use still opens the app, and moving the clock forward can skip a wrong-PIN wait. The iPhone app switcher may still show the last screen you used, and locking again discards an unsaved sheet draft.
5. Optional: **Settings → Reminders → Birthday reminders** sends a notification at 11:55 PM the night before each friend's birthday. Turn it on from the Home Screen icon and tap **Allow**, then tap **Send a test notification** to see one arrive. The limits are under "Birthday reminders" below.
6. Back up now and then: **Settings → Export backup** → Save to Files (iCloud Drive).

## Hosting

Cloudflare Pages (free plan) builds the private GitHub repo and publishes it on every push to `main`.

- Build command `npm test && npm run build` (a failing unit test stops the deploy), output directory `dist`, Node 24 (`NODE_VERSION=24` and `.node-version`).
- `functions/_middleware.ts` runs in front of every request, static files included, and asks for the website password. The logic lives in `server/` and is unit tested. The local dev and preview servers don't run it.
- Project settings, for both Production and Preview:
  - Secret `SITE_PASSWORD`: the website password, at least 16 characters (4 or more random words). Changing it signs everyone out.
  - Secret `SESSION_SECRET`: 32 random bytes, base64. Changing it signs everyone out.
  - KV namespace binding `LOGIN_ATTEMPTS`: failed sign-ins. Ten wrong tries pause sign-in for 15 minutes.
  - Service binding `REMINDERS` → the Worker `friend-tracker-reminders` (Production only): birthday reminders. Without it, `/__reminders` answers 503 and reminders can't be turned on.
- Settings → Runtime → Compatibility date: 2024-04-03 or later, so the Functions can call the reminders Worker's methods (RPC).
- Settings → Runtime → Fail open / closed: **Fail closed**, for Production and Preview. Settings → Builds: automatic preview deployments are off.
- After changing a secret or binding, redeploy (Deployments → Retry deployment). Old deployments keep the secrets they were built with, so delete old deployments after changing `SITE_PASSWORD`.
- The Pages project is `friend-tracker` (`https://friend-tracker-3bx.pages.dev/`), with the custom domain `friend.aldenlu.com`. Only use the custom domain on the phone: each address keeps its own data, sign-in and Face ID.
- Keep Cloudflare challenges (I'm Under Attack mode, challenge rules) off for `friend.aldenlu.com`. The app's background requests (offline copy, updates, the icon, "Forgot PIN?") can't pass them.
- Check the live site: `node scripts/verify-live.ts https://friend.aldenlu.com/` (set `FT_PASSWORD` to also check signing in).
- The site is set to fail closed. If the free plan's 100,000 daily Functions requests ever run out, the website is unavailable until midnight UTC, but the installed app keeps working offline. Your data isn't on the website; "Forgot PIN?" won't work until then.

## Birthday reminders

iPhone web apps can't schedule a notification themselves, so a small Cloudflare Worker sends each one as a Web Push.

- When reminders are on, the app sends its push subscription and a list of times to `PUT /__reminders` (behind the website password): 11:55 PM, in the phone's time zone, on the night before each friend's next two birthdays, each with the friend's random id. It sends the list again when a birthday changes, and at least once a week.
- `functions/__reminders.ts` (the logic is `server/reminders.ts`) checks the request and passes it to the Worker through the `REMINDERS` service binding.
- The Worker (`reminders/`, named `friend-tracker-reminders`) keeps the list in one Durable Object and wakes at each time with an alarm. The push says only `{"kind":"birthday"}`, encrypted (RFC 8291) and signed with VAPID (RFC 8292) by `@block65/webcrypto-web-push`. The Worker has no web address (`workers_dev` is off): only the binding reaches it.
- On the phone, the service worker (`src/sw.ts`, `src/sw/push.ts`) looks up whose birthday it is in the app's own data and shows "🎂 Alex's birthday starts in 5 minutes".

Setup (once):

1. `node scripts/make-vapid-keys.ts --out <a new file outside this folder>` makes the VAPID key pair. It writes the public key into `src/reminders/vapidKey.ts` and `reminders/wrangler.jsonc` (commit both) and the private key (a JWK) into that file only. Never commit or print the private key.
2. `npx --yes wrangler@4.147.0 login`, then `npx --yes wrangler@4.147.0 deploy --config reminders/wrangler.jsonc`.
3. In Git Bash: `npx --yes wrangler@4.147.0 secret put VAPID_PRIVATE_KEY --config reminders/wrangler.jsonc < <that file>`. In PowerShell: `Get-Content -Raw <that file> | npx --yes wrangler@4.147.0 secret put VAPID_PRIVATE_KEY --config reminders/wrangler.jsonc`. Then delete the file.
4. In the Pages project: **Settings → Bindings → Add → Service binding**, `REMINDERS` → `friend-tracker-reminders`, for Production. Then redeploy.
5. `node scripts/verify-live.ts https://friend.aldenlu.com/` (with `FT_PASSWORD` set it also checks that the binding works).

New keys later: run steps 1 to 3 again, push, and on the iPhone turn reminders off and on again (a subscription belongs to the key it was made with).

Honest limits:

- **Delivery isn't guaranteed.** Notifications depend on iOS: Focus modes, Low Power Mode, or the phone being off for more than 3 hours can delay or drop one.
- **Time zones.** Times use the time zone the phone was in when the app last synced. Opening the app after travelling updates them.
- **Names on the lock screen.** The notification shows the friend's name. iOS shows previews on the lock screen only "When Unlocked" by default; check Settings → Notifications → Show Previews.
- **Turn reminders off** to delete the schedule from the server. The schedule holds only times and random IDs, never names or birthdays. (Each time does give away a date, but not whose birthday it is.)
- **Long gaps.** Reminders cover each friend's next two birthdays. Opening the app at least once a year keeps them going.
- **One iPhone.** Reminders go to the phone that last turned them on or opened the app with them on. Turning them on somewhere else moves them there.

## Develop

    npm install
    npm run dev           # then open the printed URL (use the Network URL on your phone, same Wi-Fi)
    npm test              # unit tests (app, server and the reminders Worker)
    npm run e2e           # end-to-end tests in WebKit at iPhone size
    npm run screenshots   # light/dark/large-text screenshots into e2e/screenshots/

The app lock needs HTTPS or localhost (for WebCrypto), so it can't be turned on over the Wi-Fi URL.
