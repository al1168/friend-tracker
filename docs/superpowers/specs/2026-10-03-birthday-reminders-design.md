# Birthday reminders: design

Date: 2026-10-03. Status: approved. The owner chose "App notification", and asked for best-practice decisions without approval stops. This is part 2 of birthdays and builds on `Friend.birthday` from part 1.

## Goal

At **11:55 PM the night before** a friend's birthday, the iPhone shows a notification from Friend Tracker: "🎂 Alex's birthday starts in 5 minutes". The owner can then message them right at midnight.

## Constraints that shape the design

- **No local scheduling on iOS.** iPhone web apps can't schedule notifications themselves: there are no Notification Triggers and no periodic background sync. A notification at a set time needs a **Web Push** from a server.
- **Web Push on iOS works only in the Home Screen app** (iOS 16.4+), after the owner allows notifications from a tap.
- **Every push must show a notification.** After three pushes that show nothing, Safari revokes the subscription.
- **Data stays on the phone.** The server must never learn names or anything personal. It only knows "send a push at these times", tagged with random friend IDs.

## Architecture

```
iPhone app ──PUT /__reminders──▶ Pages Function (behind the password gate)
                                      │ service binding REMINDERS
                                      ▼
                         Worker "friend-tracker-reminders"
                                      │
                                      ▼
                  Durable Object ReminderSchedule ("owner")
                  stores: push subscription + [{ at, friendId }]
                  alarm at the next "at" → sends a Web Push
                                      │
                                      ▼
            Apple push service → iPhone service worker "push" event
            → reads friends from IndexedDB → shows the notification
```

### 1. The reminders Worker (`reminders/`, its own small package)

**Deployment:**
- `wrangler.jsonc` with `"workers_dev": false` and no routes. It's only reachable through the service binding.
- One SQLite-backed Durable Object class, `ReminderSchedule`, declared with `new_sqlite_classes`.
- Free plan.

**Entry point:** a `WorkerEntrypoint` with RPC methods, which the Pages Function calls. Each forwards to the single DO instance, `idFromName('owner')`:
- `sync({ subscription, reminders })`: replaces the stored subscription and the whole reminder list, then sets the alarm to the earliest `at`.
- `clear()`: deletes the subscription and the reminders, and cancels the alarm.
- `test()`: sends one push now with `kind: "test"`.

**Storage** (DO SQLite or KV-style storage, the planner's choice):
- `subscription`: `{ endpoint, keys: { p256dh, auth } }`.
- `reminders`: `{ at: number, friendId: string }[]`, where `at` is UTC milliseconds. At most 1,000 entries.

**`alarm()`:**
- **Due reminders** are those with `at <= now + 30 s`, grouped into **one push per distinct minute**. Two friends with the same birthday get one push; the phone names both.
- **After a push:**
  - 2xx: remove the sent reminders.
  - 404 or 410: the subscription is gone, so clear everything.
  - 429 or 5xx: keep them and retry in 60 s, giving up 30 minutes after `at`.
- **Next alarm:** set to the next `at`.
- **Errors:** caught and rescheduled, never left to the 6-retry limit.

**Sending a push:**
- The body is an encrypted JSON payload, `{ "kind": "birthday" }` or `{ "kind": "test" }`, with **no personal data**. It uses RFC 8291 `aes128gcm`, with VAPID per RFC 8292.
  - A payload-less push would be simpler, but it isn't documented for Apple's service, so we encrypt a tiny payload to be safe.
  - Use a small, current, Workers-compatible library such as `@block65/webcrypto-web-push` if it checks out. Otherwise implement it with WebCrypto, tested against RFC 8291's Appendix A test vector.
- **VAPID:**
  - ES256 JWT with `aud` = the endpoint's origin, `exp` ≤ 12 h, `sub` = `https://friend.aldenlu.com`.
  - Header `Authorization: vapid t=…, k=…`.
  - `TTL: 10800` (3 hours, so a phone that's briefly offline still gets it), and `Urgency: high`.
- **Secrets and variables:**
  - secret `VAPID_PRIVATE_KEY` (a JWK);
  - vars `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT`.

### 2. The Pages Function `functions/__reminders.ts`

It runs behind the existing `_middleware` gate, so only a signed-in session reaches it.

**Requests:**
- `PUT` with JSON `{ subscription, reminders }` → `env.REMINDERS.sync(...)` → 204.
- `DELETE` → `clear()` → 204.
- `POST` to `/__reminders/test` → `test()` → 204.

**Validation:**
- The request must come from this site: `Sec-Fetch-Site: same-origin`, else 403. JSON content type, else 415.
- The subscription endpoint must be `https:`, on a known push host: `web.push.apple.com`, `*.push.apple.com`, `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `*.notify.windows.com`. Otherwise 400. This stops the Worker being used to send requests anywhere.
- Each reminder has a finite `at` within the next 2 years, and a `friendId` string of at most 64 characters. At most 1,000 reminders.

**Fail closed:** if the `REMINDERS` binding is missing, return 503 with "Birthday reminders aren't set up yet.".

**Headers:** responses carry the gate's security headers.

`navigateFallbackDenylist` already excludes `/__*`.

### 3. The app

**The service worker** moves from `generateSW` to `injectManifest` with `src/sw.ts`. It keeps today's behavior exactly:
- `precacheAndRoute(self.__WB_MANIFEST)` and `cleanupOutdatedCaches()`;
- a navigation route to `index.html` with `denylist: [/^\/__/]`;
- `skipWaiting` plus `clientsClaim`;
- the manifest with `useCredentials`.

It adds:
- **`push`:** inside `event.waitUntil`, always show exactly one notification.
  - Read the payload's `kind`. A missing or unreadable payload counts as `birthday`.
  - For `test`, the title is "🎂 Reminders work" and the body is "You'll get a note at 11:55 PM before each birthday.".
  - For `birthday`, open the app's Dexie database (read only) and find the friends whose birthday falls on the local date of `now + 10 minutes`. Feb 29 counts as Feb 28 in non-leap years.
  - **Title for one friend:** "🎂 Alex's birthday starts in 5 minutes", or "🎂 It's Alex's birthday" if the push arrives after midnight.
  - **Title for several friends:** "🎂 Alex and Sam: birthdays at midnight", using `formatNameList`.
  - **Body:** "Send them a message."
  - **If nobody matches, or reading fails:** title "🎂 A birthday is coming up", body "Open Friend Tracker to see who.". Never show nothing.
  - **`tag`:** `birthday-<date>`. **`data.url`:** `/#/friends/<id>` for one friend, else `/#/`.
- **`notificationclick`:** focus an open window and navigate it to `data.url`, or open one.

**The setting** lives in the `settings` table as `birthdayReminders: { enabled: boolean, lastSyncedHash: string | null, lastSyncedAt: string | null, lastError: string | null }`. Like `appLock`, it is never in backups and is kept on import.

**Settings screen, a new "Reminders" group** with a "Birthday reminders" switch row (`role="switch"`, like the Face ID row). Its footer depends on the state:
- **Off, and push is available:** "A notification at 11:55 PM the night before each birthday."
- **Push unavailable** (not the installed Home Screen app, or no `PushManager`): the switch is disabled and the footer says "Open Friend Tracker from your Home Screen to turn on reminders.".
- **Notifications denied:** the switch is disabled and the footer says "Notifications are off for Friend Tracker. Turn them on in the iPhone's Settings app, under Notifications.".
- **On:** "On. You'll get a note at 11:55 PM the night before each birthday.", plus a **"Send a test notification"** row below the switch.
- **On, but the last sync failed:** the footer adds "Couldn't update reminders just now. The app will try again next time it opens.".

**Turning reminders on** (from the tap):
1. `Notification.requestPermission()`.
2. `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`, using the VAPID public key, which is a committed constant since it isn't secret.
3. Sync.
4. Toast "Birthday reminders are on".

If any step fails, the switch stays off with a plain toast: "Couldn't turn on reminders. Please try again." A denial shows the denied footer instead.

**Turning reminders off:** `subscription.unsubscribe()`, then `DELETE /__reminders`, then `enabled: false`. The local switch turns off even if the DELETE fails; it's retried on the next sync.

**Sync** is a `useReminderSync()` hook mounted once inside `App`, so it only runs while unlocked.
- **When:** whenever reminders are enabled and the friends' birthdays change, when the app opens, and when it becomes visible again.
- **What it builds:** for every friend with a birthday, the next 2 occurrences, each at **23:55 local time on the day before** the birthday date (Feb 29 maps to Feb 28). Past instants are skipped.
- **When it sends:** it PUTs `{ subscription, reminders }` only when the content hash changed or the last sync is more than 7 days old. It debounces 2 seconds.
- **Revoked subscription:** if `pushManager.getSubscription()` returns null while enabled, the setting becomes off with `lastError: "revoked"`. The footer then reads: "Reminders stopped. Turn them on again.".
- **Failed sync:** sets `lastError`, with no toast.

**Pure logic** lives in `src/lib/reminders.ts`: building reminders, hashing them, and picking the notification friends for a date. It's shared by the app and the service worker, and fully unit tested with fixed dates.

## Setup (the owner and the controller)

1. **Keys.** The controller generates VAPID keys locally with a small script. The public key is committed. The private key goes straight to the Worker secret and is never printed or committed.
2. **Deploy the Worker.** The owner runs `npx wrangler login` on this PC and approves it in the browser. The controller then deploys with `npx wrangler deploy` from `reminders/` and sets the secret via stdin.
3. **Bind it to Pages.** In Pages project Settings → Bindings → Add → Service binding, the owner adds `REMINDERS` → `friend-tracker-reminders` (Production), then redeploys.
4. **Check the site.** `scripts/verify-live.ts` gains a check that `PUT /__reminders` without a session gets 401, and that the 503 "not set up" message never appears once the binding exists.
5. **On the iPhone:** open the app from the Home Screen, go to Settings → Birthday reminders, tap Allow, then tap **Send a test notification** and see it arrive.

## Honest limits (README)

- **Delivery isn't guaranteed.** Notifications depend on iOS: Focus modes, Low Power Mode, or the phone being off for more than 3 hours can delay or drop one.
- **Time zones.** Times use the time zone the phone was in when the app last synced. Opening the app after travelling updates them.
- **Names on the lock screen.** The notification shows the friend's name. iOS shows previews on the lock screen only "When Unlocked" by default; check Settings → Notifications → Show Previews.
- **Turn reminders off** to delete the schedule from the server. The schedule holds only times and random IDs, never names or birthdays.
- **Long gaps.** Reminders cover each friend's next two birthdays. Opening the app at least once a year keeps them going.

## Testing

**Unit tests (app):**
- building reminders across DST changes, Feb 29, Dec 31, and the past-instant cut-off;
- the hash;
- notification friend selection and titles (one, several, none, after midnight);
- the reminder setting's state to footer text;
- the `__reminders` function: the gate's session, same-origin, content type, endpoint allowlist, limits, and the missing binding.

**Unit tests (Worker):**
- alarm grouping, and retry and give-up;
- 404/410 clearing;
- VAPID JWT shape;
- payload encryption against the RFC 8291 test vector, if implemented in-house.

Use Vitest with a fake storage and a fake `fetch`.

**E2E:**
- the Settings reminders row shows "Open Friend Tracker from your Home Screen" in a normal browser tab;
- the switch flow with `PushManager` and `Notification` stubbed in the page;
- `PUT /__reminders` happens with the right body;
- the existing PWA tests still pass with the `injectManifest` service worker. Service workers are blocked in e2e, so keep the existing build and precache checks.

**On device:** the test notification arrives, and a reminder set a few minutes ahead arrives. A temporary test mode is not shipped; use "Send a test notification" plus one real birthday set for tomorrow.

## Decisions made while planning

Recorded in [the plan](../plans/2026-10-03-birthday-reminders.md):

- **The test RPC is `sendTest()`, not `test()`.** `test` is the name of a Workers handler, so it can't be an RPC method. The endpoint stays `POST /__reminders/test`.
- **Routes.** `functions/__reminders.ts` serves `/__reminders` and `functions/__reminders/test.ts` serves `/__reminders/test`; both call `handleReminders` in `server/reminders.ts`, which answers 405 for other methods.
- **Test answers.** `sendTest()` returns `sent`, `no-subscription`, `gone` or `failed`, sent on as 204, 409, 410 or 502. On 409 the app sends the schedule again and retries once; on 410 reminders stop ("Reminders stopped. Turn them on again."). Toasts: "Test notification sent", or "Couldn't send a test notification. Please try again.".
- **Validation.** `at` is a whole number of ms from a day ago to 732 days ahead. `p256dh` is 65 bytes and `auth` 16 bytes of base64url. The endpoint is at most 1,024 characters with no user name, password or port, and the body at most 200,000 characters. Only `endpoint`, `keys.p256dh`, `keys.auth`, `at` and `friendId` are passed on. A Worker failure gives 502.
- **The Durable Object's logic** is a plain `Schedule` class over the storage's key-value methods, tested in plain Vitest. Calls run one at a time. A push with no answer in 15 seconds, or any status other than 2xx, 404 or 410, is retried like a 429 or 5xx; a reminder more than 30 minutes late is dropped without sending.
- **The push library** is `@block65/webcrypto-web-push` 2.0.0, pinned (current, small, WebCrypto only, `aes128gcm` with the `vapid` scheme). The secret stays a JWK; the Worker refuses one that isn't the pair of `VAPID_PUBLIC_KEY`. No `nodejs_compat`.
- **Notifications.** Several friends after midnight: "🎂 Alex and Sam: birthdays today". The test notification uses the tag `reminders-test` and opens Settings. Friend ids in links are URI-encoded, a tap opens only pages on this site, and the service worker gives the database 5 seconds before it shows the fallback.
- **Reminders.** With a known birth year there's no reminder for the day they were born. With more than 1,000, the soonest 1,000 are sent. The hash is SHA-256 over the endpoint, both keys and every reminder.
- **`lastError`** is `"sync"`, `"revoked"` or `"delete"`. `"delete"`: off, but the server's schedule wasn't deleted yet; the app retries when it opens or comes back. `"revoked"` also covers notifications turned off in the iPhone's Settings and a subscription made with another key.
- **Settings.** The Reminders group sits right after Organize. A switch that can't be used is disabled and dimmed. A dismissed permission prompt counts as a failure. Turning off shows "Birthday reminders are off". Each row ignores taps while it works and for 300 ms after.
- **Honest copy.** "About your data" now says the times for birthday reminders are sent when they're on (never names). The README adds a "One iPhone" limit and notes that each time gives away a date, but not whose birthday it is.
- **Build.** The service worker stays one classic script, type-checked by `tsconfig.sw.json` with the WebWorker library. The Worker's tests run in the root `npm test`. Wrangler isn't a dependency: the rollout runs the pinned `npx --yes wrangler@4.147.0`.
- **Keys.** The committed public key starts as a marked placeholder that the rollout replaces. `scripts/make-vapid-keys.ts` writes the private key only to a new file outside the repo, or into a pipe.
- **verify-live** checks a signed-out `PUT /__reminders` (401) and, signed in, that an empty schedule gets 400, which proves the binding without changing the schedule.
