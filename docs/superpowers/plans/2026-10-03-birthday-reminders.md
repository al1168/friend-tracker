# Birthday Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At 11:55 PM the night before a friend's birthday, the owner's iPhone shows "🎂 Alex's birthday starts in 5 minutes" from the installed Friend Tracker app, while the server only ever learns times and random friend ids.

**Architecture:** A pure module, `src/lib/reminders.ts`, turns birthdays into reminder instants (11:55 PM local time on the night before, Feb 29 on Feb 28 in other years) and turns a push into the notification's words. The service worker moves to vite-plugin-pwa's `injectManifest` (`src/sw.ts`, same offline behavior) and gains `push` and `notificationclick` handlers (`src/sw/push.ts`) that read the friends from the app's own Dexie database. The app subscribes to Web Push from a Settings switch and keeps the server's schedule current with `useReminderSync` (`src/reminders/`). The schedule goes through `PUT /__reminders`, a Pages Function behind the existing password gate (`functions/__reminders.ts`, logic in `server/reminders.ts`), to a separate Worker (`reminders/`, reached only through the `REMINDERS` service binding) whose one SQLite-backed Durable Object stores the subscription and times and sends each push from an alarm, encrypted and VAPID-signed by `@block65/webcrypto-web-push`.

**Tech Stack:** Vite 8, React 19, TypeScript 6 (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`), react-router 7 (HashRouter), Dexie 4 with dexie-react-hooks, vite-plugin-pwa 1.3 (`injectManifest`) with workbox-core, workbox-precaching and workbox-routing 7.4, Cloudflare Pages Functions and a Worker with a Durable Object (`@cloudflare/workers-types` 5, Wrangler 4.147.0 through `npx`), `@block65/webcrypto-web-push` 2.0.0, Vitest 5 with fake-indexeddb (TZ America/Los_Angeles), Playwright WebKit (iPhone 13, port 4174).

---

**Spec:** [docs/superpowers/specs/2026-10-03-birthday-reminders-design.md](../specs/2026-10-03-birthday-reminders-design.md), the source of truth. Design context: [DESIGN.md](../../../DESIGN.md), [PRODUCT.md](../../../PRODUCT.md). Earlier plans this builds on: [birthdays](2026-10-03-birthdays.md) (`Friend.birthday`, `src/lib/birthdays.ts`) and [security](2026-10-03-security.md) (the gate, `server/`, the Pages setup, `scripts/verify-live.ts`).

## Ground rules for every task

- Run every command from the project root in Git Bash: `/c/Users/luald/OneDrive/Desktop/Friend tracker`. The branch `feature/birthday-reminders` is already checked out.
- TypeScript: type-only imports use `import type` or an inline `type` specifier; no enums, namespaces or constructor parameter properties; no unused locals or parameters.
- Import paths are extensionless inside `src/`. Inside `e2e/`, `server/`, `functions/`, `scripts/` and `reminders/`, local files are imported with `.ts` (`./schedule.ts`, `../server/reminders.ts`).
- Copy (UI text, notification text, comments, docs) never uses em dashes. Use commas, colons, periods or parentheses. UI and notification text is exactly as written in this plan.
- Never run `npm run dev`, `npm run preview`, `vite preview` or wrangler. `npm run e2e` and `npm run screenshots` start and stop their own preview server. Wrangler (`npx --yes wrangler@4.147.0 ...`) appears only in Task 8, which the controller runs with the owner.
- Never print, paste or commit a VAPID private key.
- Commands:
  - Unit tests: `npm test` (one file: `npx vitest run <path>`)
  - Type check and production build: `npm run build` (quick type check only: `npx tsc -b`)
  - End-to-end tests: `npm run e2e` (one file: `npx playwright test --project=iphone <path>`)
  - Screenshots: `npm run screenshots`
- Baseline before Task 1: `npm test` shows `Test Files  33 passed (33)` and `Tests  319 passed (319)`; `npm run e2e` shows `83 passed`; `npm run screenshots` shows `11 passed`. Each task states the new totals.
- `npm run build` prints `WARN  inlineDynamicImports option is deprecated, please use codeSplitting: false instead.` from Task 2 on. That comes from vite-plugin-pwa 1.3 building the service worker with Vite 8, and is harmless.
- **Times in tests.** Unit tests run in America/Los_Angeles (`vitest.config.ts`), where daylight saving time in 2026 starts on Mar 8 and ends on Nov 1, and build local times with `new Date(year, monthIndex, day, hour, minute)`. E2E tests can't fix the browser's date, so they build birthdays from the real date with `dayFromToday(n)` and compute the expected 11:55 PM instant with the same `Date` constructor (Node and the browser share the machine's time zone; the config sets no `timezoneId`).
- **Service workers are blocked in e2e** (`serviceWorkers: 'block'` in `playwright.config.ts`). The reminders e2e tests fake the Home Screen app's `navigator.standalone`, `Notification`, `PushManager` and service worker registration with `stubPush` (Task 6). One PWA test opts back in with `test.use({ serviceWorkers: 'allow' })` to install the real built worker.
- **Screenshots are not committed.** `e2e/screenshots` is in `.gitignore`; look at the PNGs locally and never `git add` them.
- Commit after each task with the exact `git add` paths and message given. Every commit message ends with a blank line and then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Decisions made while planning

The spec leaves these open, or needed a change once checked against the platform. Task 7 records them at the end of the spec.

1. **The test RPC is `sendTest()`, not `test()`.** `test` is the name of a Workers handler (`WorkerEntrypoint.test(controller)`), so it can't be an RPC method; TypeScript refuses it too. The endpoint stays `POST /__reminders/test`.
2. **Routes.** A Pages Function file answers only its own path, so `functions/__reminders.ts` serves `/__reminders` and `functions/__reminders/test.ts` serves `/__reminders/test` (checked with `wrangler pages functions build`). Both call `handleReminders` in `server/reminders.ts`, which also answers 405 for other methods.
3. **Test answers.** `sendTest()` returns `sent`, `no-subscription`, `gone` or `failed`, which the endpoint sends as 204, 409, 410 or 502. On 409 the app sends the schedule again and retries once; on 410 reminders stop with "Reminders stopped. Turn them on again.". Toasts: "Test notification sent", or "Couldn't send a test notification. Please try again.".
4. **Validation.** `at` is a whole number of ms from a day ago (a phone's clock can be off; the Worker drops anything over 30 minutes late) to 732 days ahead (two years and a leap day). `p256dh` must be 65 bytes and `auth` 16 bytes of base64url. The endpoint is at most 1,024 characters, with no user name, password or port. The body is at most 200,000 characters (1,000 reminders take about 70 KB). Only `endpoint`, `keys.p256dh`, `keys.auth`, `at` and `friendId` are passed on. When the Worker fails, the endpoint answers 502.
5. **The Durable Object's logic is a plain `Schedule` class** (`reminders/src/schedule.ts`) over the storage's key-value methods, so plain Vitest tests it with a fake storage and a fake push sender. `reminders/src/index.ts` holds the thin `DurableObject` and `WorkerEntrypoint` classes. Calls run one at a time, so a sync that arrives while the alarm waits on a push service is never overwritten. A push with no answer in 15 seconds, or any status other than 2xx, 404 or 410, is retried like a 429 or 5xx. A reminder more than 30 minutes late is dropped without sending.
6. **The push library.** `@block65/webcrypto-web-push` 2.0.0, pinned: published 2026-09-03 with npm provenance, 17 KB, one small dependency (`uint8array-extras`), WebCrypto only (no `nodejs_compat`), and since 2.0 it sends `aes128gcm` with the `vapid t=…, k=…` scheme Apple needs. The secret stays a JWK as the spec says: the Worker hands its `d` to the library and refuses a JWK that isn't the pair of `VAPID_PUBLIC_KEY`. A test checks its own RFC 8291 decryptor against the RFC's Appendix A message, then decrypts what the Worker really sends.
7. **Notification details.** For several friends after midnight the title is "🎂 Alex and Sam: birthdays today". The test notification uses the tag `reminders-test` and opens Settings. Friend ids in links are URI-encoded, and a tap only opens pages on this site. The service worker gives the database 5 seconds, then shows the fallback.
8. **Building reminders.** With a known birth year there is no reminder for the day they were born (the rule `nextBirthday` already follows). With more than 1,000 reminders, the soonest 1,000 are sent. The hash is SHA-256 (base64url) over the endpoint, both keys and every reminder.
9. **`lastError`** is `"sync"`, `"revoked"` or `"delete"`. `"delete"` means reminders are off but the server's schedule wasn't deleted yet, so the app retries the delete when it opens or comes back to the foreground. `"revoked"` also covers notifications turned off in the iPhone's Settings and a subscription made with another key; the app then deletes the schedule if it can.
10. **Settings.** The Reminders group sits right after Organize. A switch that can't be used is a disabled button, dimmed, with the footer saying why. A dismissed permission prompt counts as a failure. Turning off shows "Birthday reminders are off", like the Face ID switch's "Face ID is off". Each row ignores taps while it works and for 300 ms after, like the Face ID switch.
11. **Honest copy.** "About your data" no longer says "Nothing is sent anywhere": it says the times for birthday reminders are sent when they're on (never names). The README's limits add "One iPhone" and say that each time gives away a date, but not whose birthday it is.
12. **Build and type checks.** The service worker stays one classic script: vite-plugin-pwa's default `es` build leaves no `import` in `dist/sw.js` (an e2e test checks). `tsconfig.sw.json` type-checks `src/sw.ts` and `src/sw/` with the WebWorker library, and `tsconfig.app.json` leaves them out. `reminders/tsconfig.json` type-checks the Worker with the Workers types; the Worker's tests run in the root `npm test` (plain Vitest, so the Cloudflare build runs them too) and are type-checked by `tsconfig.node.json`, because the Workers types declare WebCrypto differently from the DOM. Wrangler isn't a dependency: Task 8 runs the pinned `npx --yes wrangler@4.147.0`, so the Pages build doesn't download it.
13. **Keys.** The committed public key starts as a clearly marked placeholder: a real P-256 public key whose private half was thrown away, so the format test passes and nothing can sign for it. Task 8 replaces it. `scripts/make-vapid-keys.ts` writes the private key only to a new file outside the repo (`--out`) or into a pipe (`--stdout`, refused on a terminal); Task 8 uses `--out`, because Git Bash can't tell a pipe from the screen.
14. **verify-live** checks that a signed-out `PUT /__reminders` gets 401 and, signed in, that an empty schedule gets 400 (the endpoint's own checks, which run only once the binding exists). It never changes the schedule. The RPC path itself is proven by the iPhone's test notification in Task 8 (and was smoke-tested locally while planning: `wrangler pages dev` with `--service REMINDERS=…` gave 401, 409, 400, 204, 204, 409 and 405 through the real Worker and Durable Object).

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/lib/reminders.ts` | Create (Task 1) | `Reminder`, `PushSubscriptionData`, `reminderTime`, `reminderTimes`, `buildReminders`, `scheduleHash`, `pushKind`, `Notice`, `TEST_NOTICE`, `reminderDate`, `fallbackNotice`, `birthdaysOn`, `birthdayNotice` |
| `src/lib/reminders.test.ts` | Create (Task 1) | Unit tests, including daylight saving changes, Feb 29, Jan 1 and the past cut-off |
| `src/sw.ts` | Create (Task 2), modify (Task 3) | The service worker: precache, cleanup, the app-shell route with the `/__` deny list, skipWaiting and clientsClaim; then the push handlers |
| `tsconfig.sw.json` | Create (Task 2) | Type-checks `src/sw.ts` and `src/sw/` with the WebWorker library |
| `tsconfig.app.json`, `tsconfig.json` | Modify (Tasks 2 and 4) | Leave the service worker out of the app project; reference the new projects |
| `vite.config.ts` | Modify (Task 2) | `injectManifest` with `srcDir: 'src'`, `filename: 'sw.ts'`; everything else unchanged |
| `package.json`, `package-lock.json` | Modify (Tasks 2 and 4) | `workbox-core`, `workbox-precaching`, `workbox-routing`; `@block65/webcrypto-web-push` (dev dependencies) |
| `e2e/pwa.spec.ts` | Modify (Tasks 2 and 3) | The built worker lists the offline files, is one classic script, installs and takes control, and has the push handlers |
| `src/sw/push.ts`, `src/sw/push.test.ts` | Create (Task 3) | `onPush` (always one notification, inside `waitUntil`), `clickTarget`, `openApp`, `onNotificationClick` |
| `reminders/wrangler.jsonc` | Create (Task 4) | The Worker `friend-tracker-reminders`: no URL, one SQLite Durable Object, VAPID vars |
| `reminders/tsconfig.json` | Create (Task 4) | Type-checks the Worker with the Workers types |
| `reminders/src/schedule.ts`, `.test.ts` | Create (Task 4) | `Schedule`: sync, clear, sendTest and the alarm, over a storage interface |
| `reminders/src/push.ts`, `.test.ts` | Create (Task 4) | `vapidKeys`, `pushSender` (library call, TTL, Urgency), with an RFC 8291 decryption check |
| `reminders/src/index.ts` | Create (Task 4) | `ReminderSchedule` (the Durable Object) and the RPC `WorkerEntrypoint` |
| `vitest.config.ts`, `tsconfig.node.json` | Modify (Task 4) | Run and type-check the Worker's tests |
| `server/reminders.ts`, `.test.ts` | Create (Task 5) | `handleReminders`: methods, same-origin, JSON, endpoint allowlist, limits, fail closed, the gate's headers |
| `functions/__reminders.ts`, `functions/__reminders/test.ts` | Create (Task 5) | The Pages Functions for `/__reminders` and `/__reminders/test` |
| `scripts/verify-live.ts` | Modify (Task 5) | Two reminders checks |
| `src/reminders/types.ts` | Create (Task 6) | `PushSupport`, `ReminderProblem`, `BirthdayReminders`, `REMINDERS_OFF` |
| `src/db/settings.ts` | Modify (Task 6) | The `birthdayReminders` setting |
| `src/backup/storage.test.ts` | Modify (Task 6) | Backups never carry the reminder setting, and an import keeps it |
| `src/reminders/vapidKey.ts`, `.test.ts` | Create (Task 6) | The VAPID public key (a marked placeholder until Task 8), its format and its match with `reminders/wrangler.jsonc` |
| `src/reminders/api.ts`, `.test.ts` | Create (Task 6) | `scheduleApi`: PUT, DELETE and the test POST |
| `src/reminders/footer.ts`, `.test.ts` | Create (Task 6) | `reminderFooter`: the state's footer text |
| `src/reminders/reminderStore.ts`, `.test.ts` | Create (Task 6) | `turnOnReminders`, `turnOffReminders`, `syncReminders`, `sendTestNotification` |
| `src/reminders/browserPush.ts` | Create (Task 6) | The browser's permission and PushManager, `browserReminderDeps` |
| `src/reminders/usePushSupport.ts`, `useReminderSync.ts` | Create (Task 6) | Push availability; the sync hook and `ReminderSync` |
| `src/reminders/RemindersSection.tsx` | Create (Task 6) | The Settings "Reminders" group |
| `src/components/InsetGroup.tsx`, `.css` | Modify (Task 6) | `Row` gets `disabled` |
| `src/screens/SettingsScreen.tsx`, `src/App.tsx` | Modify (Task 6) | The Reminders group and "About your data"; `<ReminderSync />` |
| `e2e/helpers.ts`, `e2e/reminders.spec.ts`, `e2e/screenshots.spec.ts` | Modify, create, modify (Task 6) | `stubPush`; the reminders flows; three "reminders on" screenshots |
| `scripts/make-vapid-keys.ts` | Create (Task 7) | Makes the key pair; never prints the private key |
| `README.md`, `DESIGN.md`, the spec | Modify (Task 7) | Setup and honest limits; the Reminders group and switch rows; the planning decisions |

---

### Task 1: Reminder times and notification text (`src/lib/reminders.ts`)

**Files:**
- Create: `src/lib/reminders.ts`, `src/lib/reminders.test.ts`

Everything here is pure: each function takes `now` (ms) or a date and never reads the clock. The app (Task 6) builds the schedule with `buildReminders` and `scheduleHash`; the service worker (Task 3) words the notification with `pushKind`, `birthdayNotice`, `fallbackNotice` and `TEST_NOTICE`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/reminders.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { friend } from '../test/fixtures'
import type { Birthday } from '../types'
import {
  birthdayNotice,
  birthdaysOn,
  buildReminders,
  fallbackNotice,
  MAX_REMINDERS,
  pushKind,
  reminderTime,
  reminderTimes,
  scheduleHash,
  TEST_NOTICE,
  type PushSubscriptionData,
} from './reminders'

// Tests run in America/Los_Angeles (see vitest.config.ts): PDT is UTC-7, PST is UTC-8.
// In 2026, daylight saving starts on Mar 8 and ends on Nov 1.

/** A local time in the test time zone, as ms. Months are 1 to 12. */
function local(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
  return new Date(year, month - 1, day, hour, minute, second).getTime()
}

function bday(month: number, day: number, year: number | null = null): Birthday {
  return { month, day, year }
}

function withBirthday(id: string, name: string, birthday: Birthday | null) {
  return { ...friend(id, name), birthday }
}

describe('reminderTime', () => {
  it('is 11:55 PM local time on the night before', () => {
    const at = reminderTime(bday(10, 14), 2026)
    expect(at).toBe(local(2026, 10, 13, 23, 55))
    expect(new Date(at).toISOString()).toBe('2026-10-14T06:55:00.000Z')
  })

  it('falls on the last day of the month before for the 1st', () => {
    expect(reminderTime(bday(3, 1), 2026)).toBe(local(2026, 2, 28, 23, 55))
    expect(reminderTime(bday(3, 1), 2028)).toBe(local(2028, 2, 29, 23, 55))
    expect(reminderTime(bday(5, 1), 2026)).toBe(local(2026, 4, 30, 23, 55))
    expect(new Date(reminderTime(bday(1, 1), 2027)).toISOString()).toBe('2027-01-01T07:55:00.000Z')
    expect(reminderTime(bday(1, 1), 2027)).toBe(local(2026, 12, 31, 23, 55))
  })

  it('moves Feb 29 to Feb 28 in years without one', () => {
    expect(reminderTime(bday(2, 29), 2027)).toBe(local(2027, 2, 27, 23, 55))
    expect(reminderTime(bday(2, 29), 2028)).toBe(local(2028, 2, 28, 23, 55))
  })

  it('stays at 11:55 PM across daylight saving changes', () => {
    const times = {
      beforeSpring: reminderTime(bday(3, 8), 2026),
      afterSpring: reminderTime(bday(3, 9), 2026),
      beforeFall: reminderTime(bday(11, 1), 2026),
      afterFall: reminderTime(bday(11, 2), 2026),
    }
    expect(new Date(times.beforeSpring).toISOString()).toBe('2026-03-08T07:55:00.000Z')
    expect(new Date(times.afterSpring).toISOString()).toBe('2026-03-09T06:55:00.000Z')
    expect(new Date(times.beforeFall).toISOString()).toBe('2026-11-01T06:55:00.000Z')
    expect(new Date(times.afterFall).toISOString()).toBe('2026-11-02T07:55:00.000Z')
    // The night the clocks spring forward is 23 hours long; the night they fall back is 25.
    expect(times.afterSpring - times.beforeSpring).toBe(23 * 3_600_000)
    expect(times.afterFall - times.beforeFall).toBe(25 * 3_600_000)
    for (const at of Object.values(times)) {
      expect([new Date(at).getHours(), new Date(at).getMinutes()]).toEqual([23, 55])
    }
  })
})

describe('reminderTimes', () => {
  const now = local(2026, 10, 2, 12, 0)

  it('gives the next two, skipping ones already past', () => {
    expect(reminderTimes(bday(10, 14), now)).toEqual([local(2026, 10, 13, 23, 55), local(2027, 10, 13, 23, 55)])
    // Today's birthday was reminded of last night, so the next two are next year's and the year after's.
    expect(reminderTimes(bday(10, 2), now)).toEqual([local(2027, 10, 1, 23, 55), local(2028, 10, 1, 23, 55)])
  })

  it('skips a reminder at exactly now', () => {
    expect(reminderTimes(bday(10, 3), local(2026, 10, 2, 23, 55))).toEqual([
      local(2027, 10, 2, 23, 55),
      local(2028, 10, 2, 23, 55),
    ])
    expect(reminderTimes(bday(10, 3), local(2026, 10, 2, 23, 54, 59))[0]).toBe(local(2026, 10, 2, 23, 55))
  })

  it('crosses the new year', () => {
    expect(reminderTimes(bday(1, 1), local(2026, 12, 31, 23, 0))).toEqual([
      local(2026, 12, 31, 23, 55),
      local(2027, 12, 31, 23, 55),
    ])
    expect(reminderTimes(bday(1, 1), local(2026, 12, 31, 23, 58))).toEqual([
      local(2027, 12, 31, 23, 55),
      local(2028, 12, 31, 23, 55),
    ])
    expect(reminderTimes(bday(12, 31), local(2026, 12, 31, 12, 0))).toEqual([
      local(2027, 12, 30, 23, 55),
      local(2028, 12, 30, 23, 55),
    ])
  })

  it('reminds of a Feb 29 birthday on Feb 27 or Feb 28', () => {
    expect(reminderTimes(bday(2, 29), now)).toEqual([local(2027, 2, 27, 23, 55), local(2028, 2, 28, 23, 55)])
  })

  it('never reminds of the day they were born', () => {
    // Possible only with a clock or time zone a day off: a Jan 1 birth date while the phone is still on Dec 31.
    expect(reminderTimes(bday(1, 1, 2027), local(2026, 12, 31, 23, 0))).toEqual([
      local(2027, 12, 31, 23, 55),
      local(2028, 12, 31, 23, 55),
    ])
  })
})

describe('buildReminders', () => {
  const now = local(2026, 10, 2, 12, 0)

  it('lists every birthday reminder, soonest first, then by friend id', () => {
    const friends = [
      withBirthday('sam', 'Sam', bday(10, 14)),
      withBirthday('lee', 'Lee', null),
      withBirthday('alex', 'Alex', bday(10, 14, 1990)),
      withBirthday('kim', 'Kim', bday(1, 1)),
    ]
    expect(buildReminders(friends, now)).toEqual([
      { at: local(2026, 10, 13, 23, 55), friendId: 'alex' },
      { at: local(2026, 10, 13, 23, 55), friendId: 'sam' },
      { at: local(2026, 12, 31, 23, 55), friendId: 'kim' },
      { at: local(2027, 10, 13, 23, 55), friendId: 'alex' },
      { at: local(2027, 10, 13, 23, 55), friendId: 'sam' },
      { at: local(2027, 12, 31, 23, 55), friendId: 'kim' },
    ])
  })

  it('keeps the soonest 1,000', () => {
    const friends = Array.from({ length: 600 }, (_, i) => withBirthday(`f${String(i).padStart(3, '0')}`, 'Friend', bday(3, 14)))
    const reminders = buildReminders(friends, now)
    expect(reminders).toHaveLength(MAX_REMINDERS)
    expect(reminders[599]).toEqual({ at: local(2027, 3, 13, 23, 55), friendId: 'f599' })
    expect(reminders[600]).toEqual({ at: local(2028, 3, 13, 23, 55), friendId: 'f000' })
  })

  it('gives nothing without birthdays', () => {
    expect(buildReminders([withBirthday('lee', 'Lee', null)], now)).toEqual([])
  })
})

describe('scheduleHash', () => {
  const subscription: PushSubscriptionData = {
    endpoint: 'https://web.push.apple.com/abc',
    keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
  }
  const reminders = [{ at: 1_800_000_000_000, friendId: 'alex' }]

  it('is the same for the same schedule', async () => {
    const hash = await scheduleHash(subscription, reminders)
    expect(hash).toMatch(/^[\w-]{43}$/)
    expect(await scheduleHash({ ...subscription }, [{ ...reminders[0] }])).toBe(hash)
  })

  it('changes when anything the server stores changes', async () => {
    const hash = await scheduleHash(subscription, reminders)
    const others = await Promise.all([
      scheduleHash(subscription, []),
      scheduleHash(subscription, [{ at: 1_800_000_060_000, friendId: 'alex' }]),
      scheduleHash(subscription, [{ at: 1_800_000_000_000, friendId: 'sam' }]),
      scheduleHash({ ...subscription, endpoint: 'https://web.push.apple.com/xyz' }, reminders),
      scheduleHash({ ...subscription, keys: { ...subscription.keys, p256dh: 'new-key' } }, reminders),
      scheduleHash({ ...subscription, keys: { ...subscription.keys, auth: 'new-secret' } }, reminders),
    ])
    expect(new Set([hash, ...others]).size).toBe(7)
  })
})

describe('pushKind', () => {
  it('is "test" only when the payload says so', () => {
    expect(pushKind({ kind: 'test' })).toBe('test')
    expect(pushKind({ kind: 'birthday' })).toBe('birthday')
    for (const payload of [null, undefined, 'test', 42, {}, { kind: 'other' }, ['test']]) {
      expect(pushKind(payload)).toBe('birthday')
    }
  })
})

describe('birthdaysOn', () => {
  it('finds the friends whose birthday is that date, by name', () => {
    const friends = [
      withBirthday('sam', 'Sam', bday(10, 14)),
      withBirthday('alex', 'alex', bday(10, 14, 1990)),
      withBirthday('kim', 'Kim', bday(10, 15)),
      withBirthday('lee', 'Lee', null),
    ]
    expect(birthdaysOn(friends, '2026-10-14').map((f) => f.id)).toEqual(['alex', 'sam'])
    expect(birthdaysOn(friends, '2026-10-16')).toEqual([])
  })

  it('counts Feb 29 on Feb 28 in years without one', () => {
    const leap = [withBirthday('max', 'Max', bday(2, 29))]
    expect(birthdaysOn(leap, '2027-02-28').map((f) => f.id)).toEqual(['max'])
    expect(birthdaysOn(leap, '2028-02-28')).toEqual([])
    expect(birthdaysOn(leap, '2028-02-29').map((f) => f.id)).toEqual(['max'])
  })

  it('skips the day they were born', () => {
    expect(birthdaysOn([withBirthday('baby', 'Baby', bday(10, 14, 2026))], '2026-10-14')).toEqual([])
    expect(birthdaysOn([withBirthday('baby', 'Baby', bday(10, 14, 2026))], '2027-10-14')).toHaveLength(1)
  })
})

describe('birthdayNotice', () => {
  const alex = withBirthday('alex', 'Alex', bday(10, 14))
  const sam = withBirthday('sam', 'Sam', bday(10, 14))
  const kim = withBirthday('kim', 'Kim', bday(10, 14))
  const jo = withBirthday('jo', 'Jo', bday(10, 14))
  const lee = withBirthday('lee', 'Lee', bday(3, 2))

  it('names one friend and opens their page', () => {
    expect(birthdayNotice([alex, lee], local(2026, 10, 13, 23, 55))).toEqual({
      title: "🎂 Alex's birthday starts in 5 minutes",
      body: 'Send them a message.',
      tag: 'birthday-2026-10-14',
      url: '/#/friends/alex',
    })
  })

  it('counts a push up to 30 seconds early as the same reminder', () => {
    expect(birthdayNotice([alex], local(2026, 10, 13, 23, 54, 30)).title).toBe("🎂 Alex's birthday starts in 5 minutes")
  })

  it('says it is their birthday when the push arrives after midnight', () => {
    expect(birthdayNotice([alex], local(2026, 10, 14, 0, 20))).toMatchObject({
      title: "🎂 It's Alex's birthday",
      tag: 'birthday-2026-10-14',
    })
  })

  it('names several friends in one notification and opens the Friends tab', () => {
    expect(birthdayNotice([sam, alex, lee], local(2026, 10, 13, 23, 55))).toEqual({
      title: '🎂 Alex and Sam: birthdays at midnight',
      body: 'Send them a message.',
      tag: 'birthday-2026-10-14',
      url: '/#/',
    })
    expect(birthdayNotice([sam, alex, kim, jo], local(2026, 10, 13, 23, 55)).title).toBe(
      '🎂 Alex, Jo and 2 others: birthdays at midnight',
    )
    expect(birthdayNotice([sam, alex], local(2026, 10, 14, 1, 0)).title).toBe('🎂 Alex and Sam: birthdays today')
  })

  it('falls back when nobody matches', () => {
    expect(birthdayNotice([lee], local(2026, 10, 13, 23, 55))).toEqual(fallbackNotice(local(2026, 10, 13, 23, 55)))
    expect(birthdayNotice([], local(2026, 10, 13, 23, 55))).toEqual({
      title: '🎂 A birthday is coming up',
      body: 'Open Friend Tracker to see who.',
      tag: 'birthday-2026-10-14',
      url: '/#/',
    })
  })

  it('finds a Feb 29 birthday on Feb 28', () => {
    const max = withBirthday('max', 'Max', bday(2, 29))
    expect(birthdayNotice([max], local(2027, 2, 27, 23, 55)).title).toBe("🎂 Max's birthday starts in 5 minutes")
  })

  it('keeps the friend link safe for any id', () => {
    expect(birthdayNotice([withBirthday('a/b c', 'Alex', bday(10, 14))], local(2026, 10, 13, 23, 55)).url).toBe(
      '/#/friends/a%2Fb%20c',
    )
  })
})

describe('TEST_NOTICE', () => {
  it('says reminders work and opens Settings', () => {
    expect(TEST_NOTICE).toEqual({
      title: '🎂 Reminders work',
      body: "You'll get a note at 11:55 PM before each birthday.",
      tag: 'reminders-test',
      url: '/#/settings',
    })
  })
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/lib/reminders.test.ts`
Expected: FAIL, `Test Files  1 failed (1)` and `Tests  no tests`, with `Error: Cannot find module './reminders' imported from .../src/lib/reminders.test.ts`.

- [ ] **Step 3: Write the module**

Create `src/lib/reminders.ts`:

```ts
// Birthday reminders: when to remind, and what the notification says.
// Shared by the app (which builds the schedule it sends to the server) and the service worker
// (which turns a push into a notification). Nothing here reads the clock: every function takes `now`.

import type { Birthday, Friend } from '../types'
import { bytesToBase64url } from './base64'
import { isLeapYear } from './birthdays'
import { toISODate, type ISODate } from './dates'
import { compareNames, formatNameList } from './text'

/** One scheduled reminder, as the server stores it. */
export interface Reminder {
  /** UTC milliseconds: 11:55 PM on the night before the birthday, in the phone's time zone. */
  at: number
  friendId: string
}

/** A push subscription, as the app sends it to the server. */
export interface PushSubscriptionData {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** The server keeps at most this many reminders. */
export const MAX_REMINDERS = 1000

/** Each friend gets a reminder for this many of their next birthdays. */
export const BIRTHDAYS_AHEAD = 2

/**
 * The reminder for the birthday in `year`: 11:55 PM local time on the day before.
 * Feb 29 falls on Feb 28 in years without one. For the 1st of a month the day before is
 * day 0, which `Date` reads as the last day of the month before (Dec 31 for Jan 1).
 */
export function reminderTime(birthday: Birthday, year: number): number {
  const day = birthday.month === 2 && birthday.day === 29 && !isLeapYear(year) ? 28 : birthday.day
  return new Date(year, birthday.month - 1, day - 1, 23, 55).getTime()
}

/**
 * The next `count` reminder times after `now`, soonest first. With a known year, the first
 * one is for their first birthday at the earliest.
 */
export function reminderTimes(birthday: Birthday, now: number, count = BIRTHDAYS_AHEAD): number[] {
  const thisYear = new Date(now).getFullYear()
  const first = birthday.year === null ? thisYear : Math.max(thisYear, birthday.year + 1)
  const times: number[] = []
  // This year's reminder may be past, and so may next year's when a Jan 1 birthday's reminder
  // (Dec 31, 11:55 PM) has just gone by, so look a couple of years further.
  for (let year = first; times.length < count && year <= first + count + 1; year += 1) {
    const at = reminderTime(birthday, year)
    if (at > now) times.push(at)
  }
  return times
}

/** Every friend's next reminders, soonest first (then by friend id), at most MAX_REMINDERS. */
export function buildReminders(friends: readonly Friend[], now: number): Reminder[] {
  const reminders: Reminder[] = []
  for (const friend of friends) {
    if (!friend.birthday) continue
    for (const at of reminderTimes(friend.birthday, now)) reminders.push({ at, friendId: friend.id })
  }
  reminders.sort((a, b) => a.at - b.at || (a.friendId < b.friendId ? -1 : a.friendId > b.friendId ? 1 : 0))
  return reminders.slice(0, MAX_REMINDERS)
}

/** A fingerprint of what the server would store, so the app only sends the schedule when it changed. */
export async function scheduleHash(subscription: PushSubscriptionData, reminders: readonly Reminder[]): Promise<string> {
  const text = JSON.stringify([
    subscription.endpoint,
    subscription.keys.p256dh,
    subscription.keys.auth,
    reminders.map((reminder) => [reminder.at, reminder.friendId]),
  ])
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return bytesToBase64url(new Uint8Array(digest))
}

/** What a push asks for. Reminder pushes say "birthday"; the Settings test says "test". */
export type PushKind = 'birthday' | 'test'

/** The kind in a push payload. A missing or unreadable payload counts as a birthday. */
export function pushKind(payload: unknown): PushKind {
  if (typeof payload !== 'object' || payload === null) return 'birthday'
  return (payload as { kind?: unknown }).kind === 'test' ? 'test' : 'birthday'
}

/** What the service worker shows. `url` is where tapping it goes. */
export interface Notice {
  title: string
  body: string
  tag: string
  url: string
}

/** A push arrives a few minutes before midnight, so the birthday is the date 10 minutes after it. */
const LOOK_AHEAD_MS = 10 * 60_000

export const TEST_NOTICE: Notice = {
  title: '🎂 Reminders work',
  body: "You'll get a note at 11:55 PM before each birthday.",
  tag: 'reminders-test',
  url: '/#/settings',
}

/** The birthday a push at `now` is about: the local date 10 minutes later. */
export function reminderDate(now: number): ISODate {
  return toISODate(new Date(now + LOOK_AHEAD_MS))
}

/** Shown when the friends can't be read, or nobody's birthday matches. Never show nothing. */
export function fallbackNotice(now: number): Notice {
  return {
    title: '🎂 A birthday is coming up',
    body: 'Open Friend Tracker to see who.',
    tag: `birthday-${reminderDate(now)}`,
    url: '/#/',
  }
}

/**
 * Friends whose birthday falls on `date`, by name. Feb 29 birthdays fall on Feb 28 in years
 * without one. With a known year, only from their first birthday on.
 */
export function birthdaysOn(friends: readonly Friend[], date: ISODate): Friend[] {
  const [year, month, day] = date.split('-').map(Number)
  return friends
    .filter(({ birthday }) => {
      if (!birthday || (birthday.year !== null && birthday.year >= year)) return false
      const falls = birthday.month === 2 && birthday.day === 29 && !isLeapYear(year) ? 28 : birthday.day
      return birthday.month === month && falls === day
    })
    .sort((a, b) => compareNames(a.name, b.name))
}

/** The notification for a reminder push that arrives at `now`. */
export function birthdayNotice(friends: readonly Friend[], now: number): Notice {
  const date = reminderDate(now)
  const due = birthdaysOn(friends, date)
  if (due.length === 0) return fallbackNotice(now)
  // A late push (after midnight) speaks of today.
  const started = toISODate(new Date(now)) === date
  const tag = `birthday-${date}`
  const body = 'Send them a message.'
  if (due.length === 1) {
    const [friend] = due
    return {
      title: started ? `🎂 It's ${friend.name}'s birthday` : `🎂 ${friend.name}'s birthday starts in 5 minutes`,
      body,
      tag,
      url: `/#/friends/${encodeURIComponent(friend.id)}`,
    }
  }
  const names = formatNameList(due.map((friend) => friend.name))
  return { title: started ? `🎂 ${names}: birthdays today` : `🎂 ${names}: birthdays at midnight`, body, tag, url: '/#/' }
}
```

Notes for reviewers:
- `new Date(year, month - 1, day - 1, 23, 55)` is local time, so each instant is 11:55 PM in the phone's zone whatever the UTC offset that night (the test checks both 2026 daylight saving changes: 23 and 25 hour nights). 11:55 PM always exists: zones change their clocks at 2 AM, or at midnight, never at 11:55 PM.
- Day 0 of a month is the last day of the month before (Feb 28 or 29, Apr 30, Dec 31 of the previous year), which is exactly "the night before the 1st".
- `birthdaysOn` and `reminderTimes` follow `nextBirthday`'s rules from `src/lib/birthdays.ts` (Feb 29 on Feb 28 in other years; nothing before the first birthday), so a reminder is only ever scheduled for a date the service worker will match.
- `scheduleHash` uses `crypto.subtle`, which the app has (HTTPS, or localhost in tests) and Node has in Vitest.

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run src/lib/reminders.test.ts`
Expected: PASS, `Tests  26 passed (26)`.

- [ ] **Step 5: Run everything**

Run: `npm test`
Expected: `Test Files  34 passed (34)` and `Tests  345 passed (345)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...` with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/reminders.ts src/lib/reminders.test.ts
git commit -F - <<'EOF'
feat: birthday reminder times and notification wording

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: The service worker moves to `injectManifest` (`src/sw.ts`), with the same behavior

**Files:**
- Create: `src/sw.ts`, `tsconfig.sw.json`
- Modify: `vite.config.ts:9-18`, `tsconfig.app.json:22`, `tsconfig.json:3-7`, `package.json` and `package-lock.json` (through npm), `e2e/pwa.spec.ts` (append)

Today `generateSW` writes `dist/sw.js` from the `workbox` options: `self.skipWaiting()`, `clientsClaim()`, `precacheAndRoute([...12 files...], {})`, `cleanupOutdatedCaches()` and `registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html"), {denylist:[/^\/__/]}))`. The new `src/sw.ts` does exactly those five things in that order. `registerSW.js`, the manifest (`useCredentials`, `start_url` and `scope` `./`), `base: './'`, `registerType: 'autoUpdate'` and `injectRegister: 'script'` don't change. vite-plugin-pwa builds `src/sw.ts` with Vite into one file (`dist/sw.js`) and replaces `self.__WB_MANIFEST` with the same list of files as before.

- [ ] **Step 1: Add tests that pin down today's behavior**

Append to the end of `e2e/pwa.spec.ts`:

```ts

test('lists the app files for offline use in one classic script', async ({ request }) => {
  const serviceWorker = await (await request.get('sw.js')).text()
  // The build put the list of offline files in place of self.__WB_MANIFEST.
  expect(serviceWorker).not.toContain('__WB_MANIFEST')
  expect(serviceWorker).toMatch(/"?url"?:"index\.html"/)
  expect(serviceWorker).toMatch(/"?url"?:"assets\/index-[\w-]+\.js"/)
  expect(serviceWorker).toMatch(/"?url"?:"manifest\.webmanifest"/)
  expect(serviceWorker).toContain('self.skipWaiting()')
  // registerSW.js registers it as a classic script, so it must not use module syntax.
  expect(serviceWorker).not.toMatch(/\bimport\s*[{*("'`]|\bexport\s*[{*]|import\.meta/)
})

test.describe('with the service worker running', () => {
  test.use({ serviceWorkers: 'allow' })

  test('installs, saves the app for offline use, and takes control without a reload', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
    // Installing fails if any listed file is missing, so "ready" means every file was saved.
    await page.evaluate(() => navigator.serviceWorker.ready)
    // clientsClaim: the worker takes over the page that installed it.
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null)).toMatch(/\/sw\.js$/)
    const saved = await page.evaluate(async () => {
      const names = await caches.keys()
      const cache = await caches.open(names.find((name) => name.includes('precache'))!)
      return (await cache.keys()).map((request) => new URL(request.url).pathname)
    })
    expect(saved).toEqual(expect.arrayContaining(['/index.html', '/manifest.webmanifest', '/registerSW.js']))
    expect(saved.some((path) => /^\/assets\/index-[\w-]+\.js$/.test(path))).toBe(true)
  })
})
```

(Playwright's offline mode can't be used here: in WebKit on Windows it fails every navigation, even ones the service worker would answer.)

- [ ] **Step 2: Run them against today's service worker**

Run: `npx playwright test --project=iphone e2e/pwa.spec.ts`
Expected: `4 passed`. These describe behavior that must not change, so they pass before and after the move.

- [ ] **Step 3: Save today's list of offline files**

Run:

```bash
mkdir -p node_modules/.tmp
grep -oE '"?url"?:"[^"]*"' dist/sw.js | sed 's/"url"/url/' | sort > node_modules/.tmp/precache-before.txt
wc -l < node_modules/.tmp/precache-before.txt
```

Expected: `12` (`dist/` is from the build in Step 2; `node_modules/.tmp` is ignored by git).

- [ ] **Step 4: Add the Workbox packages**

Run: `npm install --save-dev workbox-core@^7.4.1 workbox-precaching@^7.4.1 workbox-routing@^7.4.1`
Expected: `package.json` gains `"workbox-core": "^7.4.1"`, `"workbox-precaching": "^7.4.1"` and `"workbox-routing": "^7.4.1"` under `devDependencies` (the same 7.4.1 that vite-plugin-pwa already installed, so `package-lock.json` changes only by those three lines).

- [ ] **Step 5: Write the service worker**

Create `src/sw.ts`:

```ts
// The service worker. vite-plugin-pwa bundles this file into dist/sw.js and puts the list of
// files to keep offline in place of self.__WB_MANIFEST. It's type-checked by tsconfig.sw.json.

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare const self: ServiceWorkerGlobalScope

// A new version takes over as soon as it's installed; the app shows it the next time it's opened.
self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Every page load is answered with the app, offline too, except the website's own pages and
// endpoints under /__ (sign-in, password check, reminders), which always go to the network.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/__/] }))
```

(`self.__WB_MANIFEST` is typed by `workbox-precaching`. The `declare const self` gives this module the service worker's `self`.)

- [ ] **Step 6: Type-check the service worker on its own**

The app's project uses the DOM library, where `self` is a window and service worker types don't exist, and the DOM and WebWorker libraries can't be mixed in one project. So the service worker gets its own project.

Create `tsconfig.sw.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.sw.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "WebWorker"],
    "types": [],
    "module": "esnext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/sw.ts", "src/sw"]
}
```

In `tsconfig.app.json`, replace:

```json
  "include": ["src"]
```

with:

```json
  "include": ["src"],
  "exclude": ["src/sw.ts", "src/sw"]
```

In `tsconfig.json`, replace:

```json
    { "path": "./tsconfig.functions.json" }
```

with:

```json
    { "path": "./tsconfig.functions.json" },
    { "path": "./tsconfig.sw.json" }
```

(`src/sw/` arrives in Task 3. Whatever it imports from the app, such as `src/db/db.ts`, is then checked against the WebWorker library too, which catches any use of `window` or `document`.)

- [ ] **Step 7: Build the service worker from `src/sw.ts`**

In `vite.config.ts`, replace:

```ts
    VitePWA({
      // New versions install in the background and take over right away; the app shows them the next time it's opened or reloaded.
      registerType: 'autoUpdate',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        // The website's sign-in page and password check (/__login, /__verify-password) always go to the network.
        navigateFallbackDenylist: [/^\/__/],
      },
      injectRegister: 'script',
```

with:

```ts
    VitePWA({
      // The service worker is src/sw.ts; the build adds the list of files to keep offline.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // New versions install in the background and take over right away (src/sw.ts calls skipWaiting and
      // clientsClaim); the app shows them the next time it's opened or reloaded.
      registerType: 'autoUpdate',
      injectRegister: 'script',
```

- [ ] **Step 8: Build and compare the new `dist/sw.js` with the old one**

Run: `npm run build`
Expected: `tsc -b` passes, Vite builds the app, then vite-plugin-pwa prints `Building src/sw.ts service worker ("es" format)...`, `mode      injectManifest`, `precache  12 entries` and `files generated` with only `dist/sw.js`.

Run:

```bash
grep -oE '"?url"?:"[^"]*"' dist/sw.js | sed 's/"url"/url/' | sort > node_modules/.tmp/precache-after.txt
diff node_modules/.tmp/precache-before.txt node_modules/.tmp/precache-after.txt && echo same files
grep -o 'self.skipWaiting()' dist/sw.js
grep -o 'denylist:\[[^]]*\]' dist/sw.js
grep -cE '^import |^export |import\.meta' dist/sw.js
ls dist | grep -c '^workbox-'
cat dist/registerSW.js
```

Expected, in order: `same files` (the same 12 files: `registerSW.js`, `index.html`, the CSS and JS bundles, the five icons and `manifest.webmanifest`; the service worker itself is not in the list); `self.skipWaiting()`; `denylist:[/^\/__/]`; `0`; `0` (Workbox is now bundled into `sw.js`, so there's no separate `workbox-*.js`); and the unchanged `if('serviceWorker' in navigator) {window.addEventListener('load', () => {navigator.serviceWorker.register('./sw.js', { scope: './' })})}`.

- [ ] **Step 9: Run the PWA tests and everything else**

Run: `npx playwright test --project=iphone e2e/pwa.spec.ts`
Expected: `4 passed`.

Run: `npm test`
Expected: `Test Files  34 passed (34)` and `Tests  345 passed (345)`.

Run: `npm run e2e`
Expected: `85 passed`.

- [ ] **Step 10: Commit**

```bash
git add src/sw.ts tsconfig.sw.json tsconfig.app.json tsconfig.json vite.config.ts package.json package-lock.json e2e/pwa.spec.ts
git commit -F - <<'EOF'
refactor: build the service worker from src/sw.ts (injectManifest), same behavior

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: The service worker shows the reminders (`push` and `notificationclick`)

**Files:**
- Create: `src/sw/push.ts`, `src/sw/push.test.ts`
- Modify: `src/sw.ts` (header comment, imports, end), `e2e/pwa.spec.ts` (before the `with the service worker running` block)

The handlers live in `src/sw/push.ts` and take the browser objects as arguments, so Vitest runs them in Node against fake-indexeddb with a fake registration and fake clients. `src/sw.ts` only wires them to `self`.

What the service worker may import: `src/db/db.ts` imports only `dexie`, `src/types.ts` (types) and `src/db/defaults.ts`; `src/lib/reminders.ts` imports `src/lib/base64.ts`, `src/lib/birthdays.ts`, `src/lib/dates.ts` and `src/lib/text.ts`. None of these touch `window` or `document` (`text.ts` only builds an `Intl.Collator` and an `Intl.Segmenter`, which workers have), and `tsconfig.sw.json` checks that against the WebWorker library. The worker opens the same `friend-tracker` database with the same `db` object, so the version, the schema and the friends `reading` hook (`birthday ??= null`) are the app's own. It only reads. If the app later upgrades the schema while the worker holds the database open, Dexie closes the worker's connection on `versionchange` and opens it again on the next read.

- [ ] **Step 1: Write the failing tests**

Create `src/sw/push.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, resetDatabase } from '../db/db'
import { friend } from '../test/fixtures'
import type { Birthday } from '../types'
import { clickTarget, onNotificationClick, onPush, openApp, type ClientsLike, type WindowClientLike } from './push'

beforeEach(resetDatabase)

const SCOPE = 'https://friend.example/'

/** 11:55 PM on Oct 13, 2026, in the test time zone (America/Los_Angeles). */
const NIGHT_BEFORE = new Date(2026, 9, 13, 23, 55).getTime()

function withBirthday(id: string, name: string, birthday: Birthday | null) {
  return { ...friend(id, name), birthday }
}

/** A push event whose waitUntil promises can be awaited. */
function pushEvent(data: { json(): unknown } | null) {
  const waits: Promise<unknown>[] = []
  return {
    event: { data, waitUntil: (promise: Promise<unknown>) => void waits.push(promise) },
    waits,
    settled: () => Promise.all(waits),
  }
}

function jsonData(value: unknown) {
  return { json: () => value }
}

function fakeRegistration() {
  return { showNotification: vi.fn(async (_title: string, _options: NotificationOptions) => {}) }
}

describe('onPush', () => {
  it('shows the test notification for a test push', async () => {
    const registration = fakeRegistration()
    const push = pushEvent(jsonData({ kind: 'test' }))
    onPush(push.event, { registration, now: () => NIGHT_BEFORE })
    await push.settled()
    expect(registration.showNotification.mock.calls).toEqual([
      [
        '🎂 Reminders work',
        { body: "You'll get a note at 11:55 PM before each birthday.", tag: 'reminders-test', data: { url: '/#/settings' } },
      ],
    ])
  })

  it("reads the app's database and names the friend whose birthday it is", async () => {
    await db.friends.bulkAdd([
      withBirthday('alex', 'Alex', { month: 10, day: 14, year: 1990 }),
      withBirthday('sam', 'Sam', { month: 3, day: 2, year: null }),
    ])
    const registration = fakeRegistration()
    const push = pushEvent(jsonData({ kind: 'birthday' }))
    onPush(push.event, { registration, now: () => NIGHT_BEFORE })
    await push.settled()
    expect(registration.showNotification.mock.calls).toEqual([
      [
        "🎂 Alex's birthday starts in 5 minutes",
        { body: 'Send them a message.', tag: 'birthday-2026-10-14', data: { url: '/#/friends/alex' } },
      ],
    ])
  })

  it('counts a missing or unreadable payload as a birthday reminder', async () => {
    await db.friends.add(withBirthday('alex', 'Alex', { month: 10, day: 14, year: null }))
    const unreadable = {
      json: () => {
        throw new SyntaxError('Unexpected token')
      },
    }
    for (const data of [null, unreadable, jsonData('hello')]) {
      const registration = fakeRegistration()
      const push = pushEvent(data)
      onPush(push.event, { registration, now: () => NIGHT_BEFORE })
      await push.settled()
      expect(registration.showNotification).toHaveBeenCalledTimes(1)
      expect(registration.showNotification.mock.calls[0][0]).toBe("🎂 Alex's birthday starts in 5 minutes")
    }
  })

  it('hands the notification to waitUntil before returning', async () => {
    const registration = fakeRegistration()
    const push = pushEvent(jsonData({ kind: 'birthday' }))
    onPush(push.event, { registration, now: () => NIGHT_BEFORE })
    // Called synchronously, so the browser keeps the worker alive until the notification shows.
    expect(push.waits).toHaveLength(1)
    await push.settled()
    expect(registration.showNotification).toHaveBeenCalledTimes(1)
  })

  it('still shows a notification when the friends cannot be read', async () => {
    const registration = fakeRegistration()
    const push = pushEvent(jsonData({ kind: 'birthday' }))
    const readFriends = () => Promise.reject(new Error('DatabaseClosedError'))
    onPush(push.event, { registration, readFriends, now: () => NIGHT_BEFORE })
    expect(push.waits).toHaveLength(1)
    await push.settled()
    expect(registration.showNotification.mock.calls).toEqual([
      [
        '🎂 A birthday is coming up',
        { body: 'Open Friend Tracker to see who.', tag: 'birthday-2026-10-14', data: { url: '/#/' } },
      ],
    ])
  })

  it('still shows a notification when reading the friends throws right away', async () => {
    const registration = fakeRegistration()
    const push = pushEvent(jsonData({ kind: 'birthday' }))
    const readFriends = () => {
      throw new Error('IndexedDB is not available')
    }
    onPush(push.event, { registration, readFriends, now: () => NIGHT_BEFORE })
    await push.settled()
    expect(registration.showNotification.mock.calls[0][0]).toBe('🎂 A birthday is coming up')
  })

  it('gives up on a read that takes too long', async () => {
    const registration = fakeRegistration()
    const push = pushEvent(jsonData({ kind: 'birthday' }))
    const readFriends = () => new Promise<never>(() => {})
    onPush(push.event, { registration, readFriends, now: () => NIGHT_BEFORE, timeoutMs: 20 })
    await push.settled()
    expect(registration.showNotification.mock.calls[0][0]).toBe('🎂 A birthday is coming up')
  })

  it('shows the fallback when nobody has a birthday that night', async () => {
    await db.friends.add(withBirthday('sam', 'Sam', { month: 3, day: 2, year: null }))
    const registration = fakeRegistration()
    const push = pushEvent(jsonData({ kind: 'birthday' }))
    onPush(push.event, { registration, now: () => NIGHT_BEFORE })
    await push.settled()
    expect(registration.showNotification.mock.calls[0][0]).toBe('🎂 A birthday is coming up')
  })
})

/** A window the notification can bring forward, recording what happened to it. */
function fakeWindow(options: { focusFails?: boolean; navigateFails?: boolean } = {}) {
  const calls: string[] = []
  const client: WindowClientLike = {
    focus: async () => {
      calls.push('focus')
      if (options.focusFails) throw new Error('InvalidAccessError')
      return client
    },
    navigate: async (url: string) => {
      calls.push(`navigate ${url}`)
      if (options.navigateFails) throw new TypeError('Not controlled')
      return client
    },
  }
  return { client, calls }
}

function fakeClients(windows: WindowClientLike[]) {
  const opened: string[] = []
  const clients: ClientsLike = {
    matchAll: async () => windows,
    openWindow: async (url: string) => {
      opened.push(url)
      return null
    },
  }
  return { clients, opened }
}

describe('clickTarget', () => {
  it('resolves the notification link on this site', () => {
    expect(clickTarget({ url: '/#/friends/alex' }, SCOPE)).toBe('https://friend.example/#/friends/alex')
    expect(clickTarget({ url: '/#/' }, SCOPE)).toBe('https://friend.example/#/')
  })

  it('goes to the Friends tab for anything else', () => {
    for (const data of [null, undefined, 'x', {}, { url: 42 }, { url: 'https://evil.example/' }, { url: '//evil.example/' }]) {
      expect(clickTarget(data, SCOPE)).toBe('https://friend.example/#/')
    }
  })
})

describe('openApp', () => {
  it('brings an open window forward and takes it to the link', async () => {
    const open = fakeWindow()
    const { clients, opened } = fakeClients([open.client])
    await openApp('https://friend.example/#/friends/alex', clients)
    expect(open.calls).toEqual(['focus', 'navigate https://friend.example/#/friends/alex'])
    expect(opened).toEqual([])
  })

  it('leaves the window where it was when it cannot be moved', async () => {
    const open = fakeWindow({ navigateFails: true })
    const { clients, opened } = fakeClients([open.client])
    await openApp('https://friend.example/#/', clients)
    expect(open.calls).toEqual(['focus', 'navigate https://friend.example/#/'])
    expect(opened).toEqual([])
  })

  it('opens the app when no window can come forward', async () => {
    const stuck = fakeWindow({ focusFails: true })
    const { clients, opened } = fakeClients([stuck.client])
    await openApp('https://friend.example/#/', clients)
    expect(opened).toEqual(['https://friend.example/#/'])

    const none = fakeClients([])
    await openApp('https://friend.example/#/friends/alex', none.clients)
    expect(none.opened).toEqual(['https://friend.example/#/friends/alex'])
  })
})

describe('onNotificationClick', () => {
  it('closes the notification and opens its link inside waitUntil', async () => {
    const close = vi.fn()
    const waits: Promise<unknown>[] = []
    const { clients, opened } = fakeClients([])
    onNotificationClick(
      { notification: { data: { url: '/#/friends/alex' }, close }, waitUntil: (promise) => void waits.push(promise) },
      clients,
      SCOPE,
    )
    expect(close).toHaveBeenCalledTimes(1)
    expect(waits).toHaveLength(1)
    await Promise.all(waits)
    expect(opened).toEqual(['https://friend.example/#/friends/alex'])
  })
})
```

In `e2e/pwa.spec.ts`, replace:

```ts
test.describe('with the service worker running', () => {
```

with:

```ts
test('shows birthday reminders from the service worker', async ({ request }) => {
  const serviceWorker = await (await request.get('sw.js')).text()
  expect(serviceWorker).toMatch(/addEventListener\([`'"]push[`'"]/)
  expect(serviceWorker).toMatch(/addEventListener\([`'"]notificationclick[`'"]/)
})

test.describe('with the service worker running', () => {
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/sw/push.test.ts`
Expected: FAIL, `Test Files  1 failed (1)` and `Tests  no tests`, with `Error: Cannot find module './push' imported from .../src/sw/push.test.ts`.

Run: `npx playwright test --project=iphone e2e/pwa.spec.ts`
Expected: `1 failed` (`shows birthday reminders from the service worker`: the built worker has no `push` listener) and `4 passed`.

- [ ] **Step 3: Write the handlers**

Create `src/sw/push.ts`:

```ts
// What the service worker does with a push, and with a tap on its notification. Kept apart from
// src/sw.ts so it can be tested in Node: the browser objects come in as arguments.
// Runs in the service worker, so nothing here (or in what it imports) may touch window or document.

import { db } from '../db/db'
import { birthdayNotice, fallbackNotice, pushKind, TEST_NOTICE, type Notice } from '../lib/reminders'
import type { Friend } from '../types'

/** Reading the friends gives up after this long, so a push still shows something in time. */
export const READ_TIMEOUT_MS = 5000

/** The parts of a PushEvent this code uses. */
export interface PushEventLike {
  readonly data: { json(): unknown } | null
  waitUntil(promise: Promise<unknown>): void
}

/** The parts of a ServiceWorkerRegistration this code uses. */
export interface NotifierLike {
  showNotification(title: string, options: NotificationOptions): Promise<void>
}

export interface PushOptions {
  registration: NotifierLike
  /** Reads every friend. Defaults to the app's database. */
  readFriends?: () => Promise<Friend[]>
  /** The current time in ms. Defaults to Date.now. */
  now?: () => number
  timeoutMs?: number
}

function readPayload(data: PushEventLike['data']): unknown {
  try {
    return data ? data.json() : null
  } catch {
    // Not JSON: counts as a birthday reminder.
    return null
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Timed out')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

async function noticeFor(payload: unknown, options: PushOptions, now: number): Promise<Notice> {
  if (pushKind(payload) === 'test') return TEST_NOTICE
  try {
    const readFriends = options.readFriends ?? (() => db.friends.toArray())
    return birthdayNotice(await withTimeout(readFriends(), options.timeoutMs ?? READ_TIMEOUT_MS), now)
  } catch {
    return fallbackNotice(now)
  }
}

async function showFor(payload: unknown, options: PushOptions, now: number): Promise<void> {
  const notice = await noticeFor(payload, options, now)
  await options.registration.showNotification(notice.title, {
    body: notice.body,
    tag: notice.tag,
    data: { url: notice.url },
  })
}

/**
 * Handles a push. iOS stops sending pushes to an app that receives them without showing a
 * notification, so this always shows exactly one, inside waitUntil, even when the friends
 * can't be read.
 */
export function onPush(event: PushEventLike, options: PushOptions): void {
  const now = (options.now ?? Date.now)()
  event.waitUntil(showFor(readPayload(event.data), options, now))
}

/** The parts of a WindowClient this code uses. */
export interface WindowClientLike {
  focus(): Promise<WindowClientLike>
  navigate(url: string): Promise<WindowClientLike | null>
}

/** The parts of the service worker's `clients` this code uses. */
export interface ClientsLike {
  matchAll(options: { type: 'window'; includeUncontrolled: boolean }): Promise<readonly WindowClientLike[]>
  openWindow(url: string): Promise<unknown>
}

/** The parts of a NotificationEvent this code uses. */
export interface NotificationClickLike {
  readonly notification: { readonly data: unknown; close(): void }
  waitUntil(promise: Promise<unknown>): void
}

/** Where a tapped notification goes: its `data.url`, on this site only, else the Friends tab. */
export function clickTarget(data: unknown, scope: string): string {
  const home = new URL('/#/', scope).href
  const url = typeof data === 'object' && data !== null ? (data as { url?: unknown }).url : undefined
  if (typeof url !== 'string') return home
  const target = new URL(url, scope)
  return target.origin === new URL(scope).origin ? target.href : home
}

/** Brings an open window to the front and takes it to `url`, or opens the app there. */
export async function openApp(url: string, clients: ClientsLike): Promise<void> {
  for (const client of await clients.matchAll({ type: 'window', includeUncontrolled: true })) {
    try {
      const focused = await client.focus()
      // If it can't be moved, it's in front anyway, showing where the owner left it.
      await focused.navigate(url).catch(() => null)
      return
    } catch {
      // This window can't be focused; try the next, or open a new one.
    }
  }
  await clients.openWindow(url)
}

export function onNotificationClick(event: NotificationClickLike, clients: ClientsLike, scope: string): void {
  event.notification.close()
  event.waitUntil(openApp(clickTarget(event.notification.data, scope), clients))
}
```

Notes for reviewers:
- `onPush` calls `event.waitUntil` synchronously, before anything is awaited, and the promise it hands over always ends in exactly one `showNotification`: `noticeFor` catches a failed or slow read (and a `readFriends` that throws right away) and falls back to "🎂 A birthday is coming up". iOS revokes the subscription after three pushes that show nothing, so there is no path without a notification.
- `now` is read when the push arrives, so "starts in 5 minutes" versus "It's Alex's birthday" depends on the arrival time, not on how long the read took.
- `openApp` brings the first window it can forward and moves it to the link; if moving fails (`WindowClient.navigate` needs a controlled window), the window still comes forward. With no window it opens one.

- [ ] **Step 4: Wire them into the service worker**

In `src/sw.ts`, replace:

```ts
// The service worker. vite-plugin-pwa bundles this file into dist/sw.js and puts the list of
// files to keep offline in place of self.__WB_MANIFEST. It's type-checked by tsconfig.sw.json.

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
```

with:

```ts
// The service worker: keeps the app offline and shows birthday reminders. vite-plugin-pwa bundles
// this file into dist/sw.js and puts the list of files to keep offline in place of
// self.__WB_MANIFEST. It's type-checked by tsconfig.sw.json.

import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { onNotificationClick, onPush } from './sw/push'
```

Replace:

```ts
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/__/] }))
```

with:

```ts
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/__/] }))

// Birthday reminders (see src/sw/push.ts).
self.addEventListener('push', (event) => onPush(event, { registration: self.registration }))
self.addEventListener('notificationclick', (event) => onNotificationClick(event, self.clients, self.registration.scope))
```

- [ ] **Step 5: Run the unit tests and the type check**

Run: `npx vitest run src/sw/push.test.ts`
Expected: PASS, `Tests  14 passed (14)`.

Run: `npx tsc -b`
Expected: no output, exit code 0. (`PushEvent`, `NotificationEvent`, `self.registration` and `self.clients` fit the small `...Like` interfaces in `push.ts`.)

- [ ] **Step 6: Build, and check the worker still installs**

Run: `npm run build`
Expected: as in Task 2 (`precache  12 entries`). `dist/sw.mjs` is now about 116 kB (38 kB gzipped), because Dexie is bundled in.

Run: `npx playwright test --project=iphone e2e/pwa.spec.ts`
Expected: `5 passed`. The `installs, saves the app for offline use, and takes control without a reload` test runs the real built worker, so it also proves that loading Dexie and the reminder code in the worker doesn't throw.

- [ ] **Step 7: Run everything**

Run: `npm test`
Expected: `Test Files  35 passed (35)` and `Tests  359 passed (359)`.

Run: `npm run e2e`
Expected: `86 passed`.

- [ ] **Step 8: Commit**

```bash
git add src/sw.ts src/sw/push.ts src/sw/push.test.ts e2e/pwa.spec.ts
git commit -F - <<'EOF'
feat: the service worker shows birthday reminder notifications

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: The reminders Worker (`reminders/`)

**Files:**
- Create: `reminders/wrangler.jsonc`, `reminders/tsconfig.json`, `reminders/src/schedule.ts`, `reminders/src/schedule.test.ts`, `reminders/src/push.ts`, `reminders/src/push.test.ts`, `reminders/src/index.ts`
- Modify: `vitest.config.ts:8`, `tsconfig.node.json:19`, `tsconfig.json` (the references from Task 2), `package.json` and `package-lock.json` (through npm)

The Worker has no `package.json` of its own. Its one library is a dev dependency of the root package, so the root `npm test` (which the Cloudflare Pages build runs) can run the Worker's tests in plain Vitest, and Wrangler (Task 8) finds the library in the root `node_modules` when it bundles `reminders/src/index.ts`. Wrangler itself is not installed: Task 8 runs the pinned `npx --yes wrangler@4.147.0`.

The Durable Object's logic is the plain class `Schedule` in `schedule.ts`, over a `ScheduleStorage` interface that `DurableObjectStorage` satisfies (the key-value methods work on SQLite-backed Durable Objects too). `push.ts` sends one push. `index.ts` is the only file that imports `cloudflare:workers`; it isn't unit-tested (Vitest in Node can't load that module), and it only forwards calls.

- [ ] **Step 1: Add the push library**

Run: `npm install --save-dev --save-exact @block65/webcrypto-web-push@2.0.0`
Expected: `package.json` gains `"@block65/webcrypto-web-push": "2.0.0"` under `devDependencies`, and `package-lock.json` gains it and `uint8array-extras`.

Run: `npm ls @block65/webcrypto-web-push`
Expected: one line ending in `@block65/webcrypto-web-push@2.0.0`.

- [ ] **Step 2: Let Vitest and TypeScript see the Worker**

In `vitest.config.ts`, replace:

```ts
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
```

with:

```ts
    include: ['src/**/*.test.ts', 'server/**/*.test.ts', 'reminders/**/*.test.ts'],
```

In `tsconfig.node.json`, replace:

```json
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts", "pwa-assets.config.ts", "e2e", "server", "scripts"]
```

with:

```json
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts", "pwa-assets.config.ts", "e2e", "server", "scripts", "reminders/src/**/*.test.ts"]
```

In `tsconfig.json`, replace:

```json
    { "path": "./tsconfig.sw.json" }
```

with:

```json
    { "path": "./tsconfig.sw.json" },
    { "path": "./reminders/tsconfig.json" }
```

Create `reminders/tsconfig.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "../node_modules/.tmp/tsconfig.reminders.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023"],
    "types": ["@cloudflare/workers-types"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  // The tests run in Node and are type-checked by ../tsconfig.node.json.
  "exclude": ["src/**/*.test.ts"]
}
```

(The tests are type-checked by `tsconfig.node.json` because they use WebCrypto the way the DOM declares it; the Workers types declare a few WebCrypto shapes differently, such as `$public` for ECDH. `schedule.ts` and `push.ts` are checked by both projects.)

- [ ] **Step 3: Write the failing schedule tests**

Create `reminders/src/schedule.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  EARLY_MS,
  GIVE_UP_MS,
  groupByMinute,
  RETRY_MS,
  Schedule,
  type PushKind,
  type Reminder,
  type ScheduleStorage,
  type Subscription,
} from './schedule.ts'

const SUBSCRIPTION: Subscription = {
  endpoint: 'https://web.push.apple.com/QGuQyavXutnMH-endpoint',
  keys: { p256dh: 'p256dh-key', auth: 'auth-secret' },
}

/** 11:55 PM in Los Angeles on Oct 13, 2026 (06:55 UTC on the 14th). */
const AT = Date.UTC(2026, 9, 14, 6, 55)
const DAY = 86_400_000

/** Durable Object storage in memory. Values are copied in and out, like the real thing. */
function fakeStorage() {
  const data = new Map<string, unknown>()
  const state = { alarm: null as number | null, failGets: false }
  const storage: ScheduleStorage = {
    get: async <T>(key: string) => {
      if (state.failGets) throw new Error('storage is unavailable')
      return structuredClone(data.get(key)) as T | undefined
    },
    put: async <T>(entries: Record<string, T>) => {
      for (const [key, value] of Object.entries(entries)) data.set(key, structuredClone(value))
    },
    delete: async (keys: string[]) => keys.filter((key) => data.delete(key)).length,
    setAlarm: async (time: number) => {
      state.alarm = time
    },
    deleteAlarm: async () => {
      state.alarm = null
    },
  }
  return { storage, data, state }
}

/** A push service that answers each push with the next status (or throws for null: no answer). */
function fakePush(...answers: (number | null)[]) {
  const sent: { endpoint: string; kind: PushKind }[] = []
  const send = async (subscription: Subscription, kind: PushKind) => {
    sent.push({ endpoint: subscription.endpoint, kind })
    const answer = answers.length > 0 ? answers.shift() : 201
    if (answer === null || answer === undefined) throw new Error('network error')
    return answer
  }
  return { send, sent }
}

function setup(answers: (number | null)[] = []) {
  const store = fakeStorage()
  const push = fakePush(...answers)
  const clock = { now: AT }
  const schedule = new Schedule(store.storage, push.send, () => clock.now)
  return { ...store, ...push, clock, schedule }
}

const reminder = (at: number, friendId: string): Reminder => ({ at, friendId })

describe('groupByMinute', () => {
  it('groups reminders that share a minute, earliest first', () => {
    const groups = groupByMinute([reminder(AT + 60_000, 'kim'), reminder(AT, 'alex'), reminder(AT + 59_000, 'sam')])
    expect(groups).toEqual([[reminder(AT, 'alex'), reminder(AT + 59_000, 'sam')], [reminder(AT + 60_000, 'kim')]])
  })
})

describe('sync', () => {
  it('stores the subscription and reminders and wakes at the earliest', async () => {
    const { schedule, data, state } = setup()
    const reminders = [reminder(AT + DAY, 'kim'), reminder(AT, 'alex')]
    await schedule.sync({ subscription: SUBSCRIPTION, reminders })
    expect(data.get('subscription')).toEqual(SUBSCRIPTION)
    expect(data.get('reminders')).toEqual(reminders)
    expect(state.alarm).toBe(AT)
  })

  it('replaces everything, and cancels the alarm when nothing is left', async () => {
    const { schedule, data, state } = setup()
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex')] })
    const other = { ...SUBSCRIPTION, endpoint: 'https://web.push.apple.com/other' }
    await schedule.sync({ subscription: other, reminders: [] })
    expect(data.get('subscription')).toEqual(other)
    expect(data.get('reminders')).toEqual([])
    expect(state.alarm).toBeNull()
  })
})

describe('clear', () => {
  it('forgets everything and cancels the alarm', async () => {
    const { schedule, data, state } = setup()
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex')] })
    await schedule.clear()
    expect([...data.keys()]).toEqual([])
    expect(state.alarm).toBeNull()
  })
})

describe('alarm', () => {
  it('sends one push for friends who share a birthday, then wakes for the next one', async () => {
    const { schedule, data, state, sent } = setup()
    await schedule.sync({
      subscription: SUBSCRIPTION,
      reminders: [reminder(AT, 'alex'), reminder(AT, 'sam'), reminder(AT + DAY, 'kim')],
    })
    await schedule.alarm()
    expect(sent).toEqual([{ endpoint: SUBSCRIPTION.endpoint, kind: 'birthday' }])
    expect(data.get('reminders')).toEqual([reminder(AT + DAY, 'kim')])
    expect(state.alarm).toBe(AT + DAY)
  })

  it('sends a reminder up to 30 seconds early, but not before', async () => {
    const { schedule, clock, sent, state } = setup()
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex')] })
    clock.now = AT - EARLY_MS - 1
    await schedule.alarm()
    expect(sent).toEqual([])
    expect(state.alarm).toBe(AT)
    clock.now = AT - EARLY_MS
    await schedule.alarm()
    expect(sent).toHaveLength(1)
    expect(state.alarm).toBeNull()
  })

  it('sends one push per minute when several are due', async () => {
    const { schedule, clock, sent, data } = setup()
    await schedule.sync({
      subscription: SUBSCRIPTION,
      reminders: [reminder(AT, 'alex'), reminder(AT + 5 * 60_000, 'sam')],
    })
    clock.now = AT + 6 * 60_000
    await schedule.alarm()
    expect(sent).toHaveLength(2)
    expect(data.get('reminders')).toEqual([])
  })

  it('forgets everything when the subscription is gone (404 or 410)', async () => {
    for (const status of [404, 410]) {
      const { schedule, data, state } = setup([status])
      await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex'), reminder(AT + DAY, 'kim')] })
      await schedule.alarm()
      expect([...data.keys()]).toEqual([])
      expect(state.alarm).toBeNull()
    }
  })

  it('tries again in a minute after a 429, a 5xx or no answer', async () => {
    for (const answer of [429, 500, 503, null]) {
      const { schedule, data, state } = setup([answer])
      await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex'), reminder(AT + DAY, 'kim')] })
      await schedule.alarm()
      expect(data.get('reminders')).toEqual([reminder(AT, 'alex'), reminder(AT + DAY, 'kim')])
      expect(state.alarm).toBe(AT + RETRY_MS)
    }
  })

  it('sends on a later try and then moves on', async () => {
    const { schedule, clock, data, state, sent } = setup([503, 201])
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex'), reminder(AT + DAY, 'kim')] })
    await schedule.alarm()
    clock.now = AT + RETRY_MS
    await schedule.alarm()
    expect(sent).toHaveLength(2)
    expect(data.get('reminders')).toEqual([reminder(AT + DAY, 'kim')])
    expect(state.alarm).toBe(AT + DAY)
  })

  it('gives up 30 minutes after the reminder time', async () => {
    const { schedule, clock, data, state, sent } = setup([503])
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex'), reminder(AT + DAY, 'kim')] })
    clock.now = AT + GIVE_UP_MS
    await schedule.alarm()
    expect(sent).toHaveLength(1)
    expect(state.alarm).toBe(AT + GIVE_UP_MS + RETRY_MS)
    clock.now = AT + GIVE_UP_MS + 1
    await schedule.alarm()
    expect(sent).toHaveLength(1)
    expect(data.get('reminders')).toEqual([reminder(AT + DAY, 'kim')])
    expect(state.alarm).toBe(AT + DAY)
  })

  it('never throws: an error just tries again in a minute', async () => {
    const { schedule, state } = setup()
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex')] })
    state.failGets = true
    await expect(schedule.alarm()).resolves.toBeUndefined()
    expect(state.alarm).toBe(AT + RETRY_MS)
  })

  it('cleans up when there is no subscription', async () => {
    const { schedule, data, state, sent } = setup()
    await schedule.alarm()
    expect(sent).toEqual([])
    expect([...data.keys()]).toEqual([])
    expect(state.alarm).toBeNull()
  })

  it('lets a sync that arrives during a push finish after it, so the new schedule is kept', async () => {
    const store = fakeStorage()
    let answer: (status: number) => void = () => {}
    let sending: () => void = () => {}
    const sendStarted = new Promise<void>((resolve) => (sending = resolve))
    const send = () => {
      sending()
      return new Promise<number>((resolve) => (answer = resolve))
    }
    const schedule = new Schedule(store.storage, send, () => AT)
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex')] })
    const alarm = schedule.alarm()
    const fresh = [reminder(AT + DAY, 'kim')]
    const sync = schedule.sync({ subscription: SUBSCRIPTION, reminders: fresh })
    await sendStarted
    answer(201)
    await Promise.all([alarm, sync])
    expect(store.data.get('reminders')).toEqual(fresh)
    expect(store.state.alarm).toBe(AT + DAY)
  })
})

describe('sendTest', () => {
  it('sends a test push', async () => {
    const { schedule, sent } = setup()
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [] })
    expect(await schedule.sendTest()).toBe('sent')
    expect(sent).toEqual([{ endpoint: SUBSCRIPTION.endpoint, kind: 'test' }])
  })

  it('says when there is nothing to send to', async () => {
    const { schedule, sent } = setup()
    expect(await schedule.sendTest()).toBe('no-subscription')
    expect(sent).toEqual([])
  })

  it('forgets everything when the subscription is gone', async () => {
    const { schedule, data } = setup([410])
    await schedule.sync({ subscription: SUBSCRIPTION, reminders: [reminder(AT, 'alex')] })
    expect(await schedule.sendTest()).toBe('gone')
    expect([...data.keys()]).toEqual([])
  })

  it('reports a failed push', async () => {
    for (const answer of [500, 403, null]) {
      const { schedule } = setup([answer])
      await schedule.sync({ subscription: SUBSCRIPTION, reminders: [] })
      expect(await schedule.sendTest()).toBe('failed')
    }
  })
})
```

- [ ] **Step 4: Run them and see them fail**

Run: `npx vitest run reminders/src/schedule.test.ts`
Expected: FAIL, `Test Files  1 failed (1)` and `Tests  no tests`, with `Error: Cannot find module './schedule.ts' imported from .../reminders/src/schedule.test.ts`.

- [ ] **Step 5: Write the schedule**

Create `reminders/src/schedule.ts`:

```ts
// The reminder schedule kept by the ReminderSchedule Durable Object (see index.ts): one push
// subscription, the times to send a push, and the alarm that sends them. The platform pieces
// (storage, sending a push, the clock) come in as arguments, so this is tested in plain Node.

/** A push subscription as the app sends it. */
export interface Subscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

/** When to send a push (UTC ms), and the random id of the friend it's for. Never a name or a date. */
export interface Reminder {
  at: number
  friendId: string
}

export interface SyncInput {
  subscription: Subscription
  reminders: Reminder[]
}

/** What a push asks the phone to show. The payload carries nothing else. */
export type PushKind = 'birthday' | 'test'

export type TestResult = 'sent' | 'no-subscription' | 'gone' | 'failed'

/** Sends one push and resolves with the push service's HTTP status. Rejects when there's no answer. */
export type SendPush = (subscription: Subscription, kind: PushKind) => Promise<number>

/** The parts of DurableObjectStorage the schedule uses. */
export interface ScheduleStorage {
  get<T>(key: string): Promise<T | undefined>
  put<T>(entries: Record<string, T>): Promise<void>
  delete(keys: string[]): Promise<number>
  setAlarm(scheduledTime: number): Promise<void>
  deleteAlarm(): Promise<void>
}

/** A reminder this close is sent now: an alarm may fire a little early. */
export const EARLY_MS = 30_000
/** After a failed send (429, 5xx, no answer), the next try is this much later. */
export const RETRY_MS = 60_000
/** A reminder still not sent this long after its time is dropped: it would only arrive late. */
export const GIVE_UP_MS = 30 * 60_000

const SUBSCRIPTION = 'subscription'
const REMINDERS = 'reminders'

function isSent(status: number): boolean {
  return status >= 200 && status < 300
}

/** The subscription no longer exists: the push service will never accept it again. */
function isGone(status: number): boolean {
  return status === 404 || status === 410
}

function key(reminder: Reminder): string {
  return `${reminder.at}:${reminder.friendId}`
}

/** Due reminders in groups that share a minute, earliest first. Each group is one push. */
export function groupByMinute(reminders: readonly Reminder[]): Reminder[][] {
  const groups = new Map<number, Reminder[]>()
  for (const reminder of [...reminders].sort((a, b) => a.at - b.at)) {
    const minute = Math.floor(reminder.at / 60_000)
    groups.set(minute, [...(groups.get(minute) ?? []), reminder])
  }
  return [...groups.values()]
}

export class Schedule {
  private readonly storage: ScheduleStorage
  private readonly send: SendPush
  private readonly now: () => number
  /** Calls run one at a time, so a sync never interleaves with an alarm that's waiting on a push. */
  private queue: Promise<unknown> = Promise.resolve()

  constructor(storage: ScheduleStorage, send: SendPush, now: () => number) {
    this.storage = storage
    this.send = send
    this.now = now
  }

  private exclusive<T>(run: () => Promise<T>): Promise<T> {
    const result = this.queue.then(run, run)
    this.queue = result.catch(() => {})
    return result
  }

  /** Replaces the subscription and every reminder, and sets the alarm for the earliest one. */
  sync(input: SyncInput): Promise<void> {
    return this.exclusive(async () => {
      await this.storage.put<unknown>({ [SUBSCRIPTION]: input.subscription, [REMINDERS]: input.reminders })
      await this.arm(input.reminders.map((reminder) => reminder.at))
    })
  }

  /** Forgets the subscription and every reminder, and cancels the alarm. */
  clear(): Promise<void> {
    return this.exclusive(() => this.clearNow())
  }

  /** Sends one test push now. */
  sendTest(): Promise<TestResult> {
    return this.exclusive(async () => {
      const subscription = await this.storage.get<Subscription>(SUBSCRIPTION)
      if (!subscription) return 'no-subscription'
      let status: number
      try {
        status = await this.send(subscription, 'test')
      } catch {
        return 'failed'
      }
      if (isSent(status)) return 'sent'
      if (isGone(status)) {
        await this.clearNow()
        return 'gone'
      }
      return 'failed'
    })
  }

  /**
   * The alarm: one push per minute that has reminders due, then the alarm for what's next.
   * It never throws: the platform retries a failed alarm only 6 times, so any error just tries
   * again in a minute.
   */
  alarm(): Promise<void> {
    return this.exclusive(async () => {
      try {
        await this.sendDue()
      } catch {
        await this.storage.setAlarm(this.now() + RETRY_MS).catch(() => {})
      }
    })
  }

  private async clearNow(): Promise<void> {
    await this.storage.deleteAlarm()
    await this.storage.delete([SUBSCRIPTION, REMINDERS])
  }

  /** Sets the alarm for the earliest time, or cancels it when there's none. */
  private async arm(times: readonly number[]): Promise<void> {
    if (times.length === 0) await this.storage.deleteAlarm()
    else await this.storage.setAlarm(Math.min(...times))
  }

  private async sendDue(): Promise<void> {
    const now = this.now()
    const subscription = await this.storage.get<Subscription>(SUBSCRIPTION)
    const reminders = (await this.storage.get<Reminder[]>(REMINDERS)) ?? []
    if (!subscription) {
      await this.clearNow()
      return
    }
    const done = new Set<string>()
    let retrying = false
    for (const group of groupByMinute(reminders.filter((reminder) => reminder.at <= now + EARLY_MS))) {
      if (now - group[0].at > GIVE_UP_MS) {
        for (const reminder of group) done.add(key(reminder))
        continue
      }
      let status: number | null
      try {
        status = await this.send(subscription, 'birthday')
      } catch {
        status = null
      }
      if (status !== null && isGone(status)) {
        await this.clearNow()
        return
      }
      if (status !== null && isSent(status)) {
        for (const reminder of group) done.add(key(reminder))
      } else {
        // 429, 5xx, any other answer, or none: keep them and try again in a minute.
        retrying = true
      }
    }
    const left = reminders.filter((reminder) => !done.has(key(reminder)))
    await this.storage.put({ [REMINDERS]: left })
    const upcoming = left.filter((reminder) => reminder.at > now + EARLY_MS).map((reminder) => reminder.at)
    await this.arm(retrying ? [...upcoming, now + RETRY_MS] : upcoming)
  }
}
```

Notes for reviewers:
- `sync` and the alarm both use `setAlarm(Math.min(...))`: a time already past fires at once, which is how a reminder that's due right now gets sent.
- The alarm catches everything and sets itself a minute ahead, so the platform's 6 automatic retries are never used up. A reminder that keeps failing is dropped 30 minutes after its time, so it can't loop forever.
- `exclusive` matters because a Durable Object handles another call while one awaits a `fetch`: without it, a sync arriving during a push would be overwritten when the alarm saves what's left.
- A 404 or 410 means the push service will never accept the subscription again, so everything is forgotten (the app finds out on its next sync, Task 6).

- [ ] **Step 6: Run the tests and see them pass**

Run: `npx vitest run reminders/src/schedule.test.ts`
Expected: PASS, `Tests  18 passed (18)`.

- [ ] **Step 7: Write the failing push tests**

Create `reminders/src/push.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { pushSender, PUSH_TTL_SECONDS, vapidKeys, type VapidEnv } from './push.ts'
import type { Subscription } from './schedule.ts'

const SUBJECT = 'https://friend.aldenlu.com'
const ENDPOINT = 'https://web.push.apple.com/QGuQyavXutnMH-endpoint'

function toBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

async function hmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const imported = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, data))
}

const text = (value: string) => new TextEncoder().encode(value)

/**
 * Decrypts an RFC 8291 (aes128gcm) push message the way the phone does, with the subscription's
 * private key and auth secret. Checked against the RFC's own example below, so it can check the
 * messages this Worker sends.
 */
async function decryptPush(body: Uint8Array<ArrayBuffer>, uaPrivate: CryptoKey, uaPublic: Uint8Array<ArrayBuffer>, auth: Uint8Array<ArrayBuffer>) {
  const salt = body.slice(0, 16)
  const idLength = body[20]
  const asPublic = body.slice(21, 21 + idLength)
  const ciphertext = body.slice(21 + idLength)
  const senderKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: senderKey }, uaPrivate, 256))
  const prkKey = await hmac(auth, ecdhSecret)
  const ikm = (await hmac(prkKey, concat(text('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])))).slice(0, 32)
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, concat(text('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16)
  const nonce = (await hmac(prk, concat(text('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext))
  // The last record ends with a 0x02 delimiter, then zero padding.
  const end = padded.lastIndexOf(2)
  return new TextDecoder().decode(padded.slice(0, end))
}

/** The phone's side of a subscription: an ECDH key pair and an auth secret. */
async function phoneSubscription() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const auth = crypto.getRandomValues(new Uint8Array(16))
  const subscription: Subscription = { endpoint: ENDPOINT, keys: { p256dh: toBase64url(publicKey), auth: toBase64url(auth) } }
  return { subscription, privateKey: pair.privateKey, publicKey, auth }
}

/** A fresh VAPID key pair, as scripts/make-vapid-keys.ts makes it. */
async function vapidEnv(): Promise<{ env: VapidEnv; publicKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  return {
    env: { VAPID_PUBLIC_KEY: toBase64url(raw), VAPID_PRIVATE_KEY: JSON.stringify(jwk), VAPID_SUBJECT: SUBJECT },
    publicKey: pair.publicKey,
  }
}

/** A fetch that records what it was asked and answers with `status`. */
function fakeFetch(status = 201) {
  const requests: { url: string; init: RequestInit }[] = []
  const fetcher = (async (url: string, init: RequestInit) => {
    requests.push({ url, init })
    return new Response(null, { status })
  }) as unknown as typeof fetch
  return { fetcher, requests }
}

describe('decryptPush (the test helper)', () => {
  it("reads RFC 8291's example message", async () => {
    // RFC 8291, Appendix A.
    const uaPublic = fromBase64url('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4')
    const uaPrivate = await crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        d: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',
        x: toBase64url(uaPublic.slice(1, 33)),
        y: toBase64url(uaPublic.slice(33, 65)),
      },
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      ['deriveBits'],
    )
    const auth = fromBase64url('BTBZMqHH6r4Tts7J_aSIgg')
    const body = fromBase64url(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    )
    expect(await decryptPush(body, uaPrivate, uaPublic, auth)).toBe('When I grow up, I want to be a watermelon')
  })
})

describe('pushSender', () => {
  it('posts an encrypted {"kind"} payload that the phone can read, and nothing else', async () => {
    const phone = await phoneSubscription()
    const { env } = await vapidEnv()
    const { fetcher, requests } = fakeFetch(201)
    expect(await pushSender(env, fetcher)(phone.subscription, 'birthday')).toBe(201)
    expect(requests).toHaveLength(1)
    const { url, init } = requests[0]
    expect(url).toBe(ENDPOINT)
    expect(init.method).toBe('POST')
    const body = init.body as Uint8Array<ArrayBuffer>
    expect(await decryptPush(body, phone.privateKey, phone.publicKey, phone.auth)).toBe('{"kind":"birthday"}')
  })

  it('sends the push headers Apple needs', async () => {
    const phone = await phoneSubscription()
    const { env } = await vapidEnv()
    const { fetcher, requests } = fakeFetch(201)
    await pushSender(env, fetcher)(phone.subscription, 'test')
    const headers = new Headers(requests[0].init.headers)
    expect(headers.get('TTL')).toBe(String(PUSH_TTL_SECONDS))
    expect(headers.get('Urgency')).toBe('high')
    expect(headers.get('Content-Encoding')).toBe('aes128gcm')
    expect(headers.get('Content-Type')).toBe('application/octet-stream')
    expect(headers.get('Authorization')).toMatch(new RegExp(`^vapid t=[\\w-]+\\.[\\w-]+\\.[\\w-]+, k=${env.VAPID_PUBLIC_KEY}$`))
  })

  it('signs a VAPID token for the push service, valid for at most 12 hours', async () => {
    const phone = await phoneSubscription()
    const { env, publicKey } = await vapidEnv()
    const { fetcher, requests } = fakeFetch(201)
    const before = Math.floor(Date.now() / 1000)
    await pushSender(env, fetcher)(phone.subscription, 'birthday')
    const token = /^vapid t=([^,]+), k=/.exec(new Headers(requests[0].init.headers).get('Authorization') ?? '')![1]
    const [header, payload, signature] = token.split('.')
    const decode = (part: string) => JSON.parse(new TextDecoder().decode(fromBase64url(part)))
    expect(decode(header)).toEqual({ typ: 'JWT', alg: 'ES256' })
    const claims = decode(payload)
    expect(claims.aud).toBe('https://web.push.apple.com')
    expect(claims.sub).toBe(SUBJECT)
    expect(claims.exp).toBeGreaterThan(before)
    expect(claims.exp).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 12 * 3600)
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      fromBase64url(signature),
      text(`${header}.${payload}`),
    )
    expect(valid).toBe(true)
  })

  it("passes on the push service's answer", async () => {
    const phone = await phoneSubscription()
    const { env } = await vapidEnv()
    for (const status of [404, 410, 429, 503]) {
      expect(await pushSender(env, fakeFetch(status).fetcher)(phone.subscription, 'birthday')).toBe(status)
    }
  })
})

describe('vapidKeys', () => {
  it('takes the private key from the JWK', async () => {
    const { env } = await vapidEnv()
    const jwk = JSON.parse(env.VAPID_PRIVATE_KEY) as JsonWebKey
    expect(vapidKeys(env)).toEqual({ subject: SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: jwk.d })
  })

  it('refuses keys that do not belong together, a missing secret, or a bad subject', async () => {
    const one = await vapidEnv()
    const two = await vapidEnv()
    expect(() => vapidKeys({ ...one.env, VAPID_PRIVATE_KEY: two.env.VAPID_PRIVATE_KEY })).toThrow(
      'VAPID_PRIVATE_KEY is not the private key for VAPID_PUBLIC_KEY.',
    )
    expect(() => vapidKeys({ ...one.env, VAPID_PRIVATE_KEY: '' })).toThrow()
    expect(() => vapidKeys({ ...one.env, VAPID_SUBJECT: 'friend.aldenlu.com' })).toThrow(
      'VAPID_SUBJECT must be an https: or mailto: URL.',
    )
  })
})
```

The first test checks the test file's own RFC 8291 decryptor against the message in RFC 8291, Appendix A ("When I grow up, I want to be a watermelon"). The others use that decryptor on what the Worker really sends, with a phone key pair and VAPID keys made fresh in each test, so nothing secret is in the repo.

- [ ] **Step 8: Run them and see them fail**

Run: `npx vitest run reminders/src/push.test.ts`
Expected: FAIL, `Test Files  1 failed (1)` and `Tests  no tests`, with `Error: Cannot find module './push.ts' imported from .../reminders/src/push.test.ts`.

- [ ] **Step 9: Write the sender**

Create `reminders/src/push.ts`:

```ts
// Sends one Web Push: the payload is encrypted as RFC 8291 (aes128gcm) and the request is signed
// with VAPID (RFC 8292), both by @block65/webcrypto-web-push. The payload is only
// {"kind":"birthday"} or {"kind":"test"}: the phone looks up who it's for in its own data.

import { buildPushPayload } from '@block65/webcrypto-web-push'
import type { PushKind, SendPush } from './schedule.ts'

export interface VapidEnv {
  /** The application server key: an uncompressed P-256 point, base64url. Not secret. */
  VAPID_PUBLIC_KEY: string
  /** The matching private key as a JWK (a secret). */
  VAPID_PRIVATE_KEY: string
  /** Who runs this sender: an https: or mailto: URL. Apple refuses pushes without one. */
  VAPID_SUBJECT: string
}

/** A phone that's off or offline gets the push if it's back within 3 hours. */
export const PUSH_TTL_SECONDS = 10_800

/** A push service that hasn't answered by then counts as no answer (the alarm tries again). */
const SEND_TIMEOUT_MS = 15_000

function base64urlToBytes(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The keys in the form the library takes. Throws when the secret is missing or isn't the public key's pair. */
export function vapidKeys(env: VapidEnv): { subject: string; publicKey: string; privateKey: string } {
  const jwk = JSON.parse(env.VAPID_PRIVATE_KEY) as JsonWebKey
  const publicKey = base64urlToBytes(env.VAPID_PUBLIC_KEY)
  const matches =
    jwk.kty === 'EC' &&
    jwk.crv === 'P-256' &&
    typeof jwk.d === 'string' &&
    publicKey.length === 65 &&
    jwk.x === bytesToBase64url(publicKey.slice(1, 33)) &&
    jwk.y === bytesToBase64url(publicKey.slice(33, 65))
  if (!matches) throw new Error('VAPID_PRIVATE_KEY is not the private key for VAPID_PUBLIC_KEY.')
  if (!/^(https:|mailto:)/.test(env.VAPID_SUBJECT)) throw new Error('VAPID_SUBJECT must be an https: or mailto: URL.')
  return { subject: env.VAPID_SUBJECT, publicKey: env.VAPID_PUBLIC_KEY, privateKey: jwk.d as string }
}

/** A SendPush that posts to the subscription's push service. */
export function pushSender(env: VapidEnv, fetcher: typeof fetch = fetch): SendPush {
  return async (subscription, kind: PushKind) => {
    const request = await buildPushPayload(
      { data: { kind }, options: { ttl: PUSH_TTL_SECONDS, urgency: 'high' } },
      { endpoint: subscription.endpoint, expirationTime: null, keys: subscription.keys },
      vapidKeys(env),
    )
    const response = await fetcher(subscription.endpoint, {
      method: 'POST',
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    // Only the status matters. Not reading the body frees the connection.
    await response.body?.cancel().catch(() => {})
    return response.status
  }
}
```

(`buildPushPayload` signs `{ aud: <the endpoint's origin>, exp: now + 12 h, sub: VAPID_SUBJECT }` with ES256, sends `Authorization: vapid t=…, k=…`, and encrypts the payload as one `aes128gcm` record padded to 4,096 bytes. `exp` is exactly 12 hours ahead, which Apple accepts; it's checked in the tests.)

- [ ] **Step 10: Run the tests and see them pass**

Run: `npx vitest run reminders/src/push.test.ts`
Expected: PASS, `Tests  7 passed (7)`.

- [ ] **Step 11: Write the Worker and its configuration**

Create `reminders/src/index.ts`:

```ts
// The reminders Worker. It has no URL (workers_dev is off and there are no routes): the Pages
// project reaches it only through its REMINDERS service binding, and calls these RPC methods.
// Every call goes to the one schedule, the Durable Object named "owner".

import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers'
import { pushSender, type VapidEnv } from './push.ts'
import { Schedule, type SyncInput, type TestResult } from './schedule.ts'

export interface Env extends VapidEnv {
  SCHEDULE: DurableObjectNamespace<ReminderSchedule>
}

/** One schedule, kept in Durable Object storage and woken by its alarm. */
export class ReminderSchedule extends DurableObject<Env> {
  private readonly schedule: Schedule

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.schedule = new Schedule(ctx.storage, pushSender(env), () => Date.now())
  }

  async sync(input: SyncInput): Promise<void> {
    await this.schedule.sync(input)
  }

  async clear(): Promise<void> {
    await this.schedule.clear()
  }

  async sendTest(): Promise<TestResult> {
    return this.schedule.sendTest()
  }

  async alarm(): Promise<void> {
    await this.schedule.alarm()
  }
}

function owner(env: Env) {
  return env.SCHEDULE.get(env.SCHEDULE.idFromName('owner'))
}

export default class RemindersWorker extends WorkerEntrypoint<Env> {
  async sync(input: SyncInput): Promise<void> {
    await owner(this.env).sync(input)
  }

  async clear(): Promise<void> {
    await owner(this.env).clear()
  }

  // Not named "test": that's the name of a Workers handler, so it can't be an RPC method.
  async sendTest(): Promise<TestResult> {
    return owner(this.env).sendTest()
  }
}
```

Create `reminders/wrangler.jsonc`:

```jsonc
// The reminders Worker (see README.md, "Birthday reminders"). Deploy from the project root:
//   npx --yes wrangler@4.147.0 deploy --config reminders/wrangler.jsonc
{
  "name": "friend-tracker-reminders",
  "main": "src/index.ts",
  "compatibility_date": "2026-10-01",
  // No public URL: only the Pages project's REMINDERS service binding reaches it.
  "workers_dev": false,
  "preview_urls": false,
  "durable_objects": {
    "bindings": [{ "name": "SCHEDULE", "class_name": "ReminderSchedule" }]
  },
  // The free plan needs SQLite-backed Durable Objects.
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["ReminderSchedule"] }],
  "vars": {
    // Written by scripts/make-vapid-keys.ts, with the same value as src/reminders/vapidKey.ts.
    "VAPID_PUBLIC_KEY": "BLwNAu9O6nqiNKx-6lPlhLk_2LslupgmkvBGz6Bwlfhz_vvn0VFdgSSsRGSIr29QPqsN0r8M8ZOY9Emd_t619ig",
    "VAPID_SUBJECT": "https://friend.aldenlu.com"
  },
  // The private key is a secret: npx --yes wrangler@4.147.0 secret put VAPID_PRIVATE_KEY --config reminders/wrangler.jsonc
  "observability": { "enabled": true }
}
```

The `VAPID_PUBLIC_KEY` here is the placeholder that Task 6 also puts in `src/reminders/vapidKey.ts` (a real P-256 public key whose private half was thrown away). Task 8 replaces both with `scripts/make-vapid-keys.ts`. `nodejs_compat` isn't needed: the library uses only WebCrypto, `atob` and `btoa`.

- [ ] **Step 12: Type-check, and check that the Worker bundles**

Run: `npx tsc -b`
Expected: no output, exit code 0. (`DurableObjectStorage` satisfies `ScheduleStorage`, and the RPC stub's methods match `Schedule`'s.)

Run:

```bash
npx rolldown reminders/src/index.ts --format esm --platform neutral --external cloudflare:workers --file node_modules/.tmp/reminders-check.js
grep -oE '^import .*' node_modules/.tmp/reminders-check.js
```

Expected: rolldown (Vite 8's bundler, already installed) prints `Finished`, about 17 kB, and the only import left is `import { DurableObject, WorkerEntrypoint } from "cloudflare:workers";`. That is what Wrangler will bundle in Task 8: the library and `uint8array-extras` are inside, and nothing needs Node.

- [ ] **Step 13: Run everything**

Run: `npm test`
Expected: `Test Files  37 passed (37)` and `Tests  384 passed (384)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `86 passed`.

- [ ] **Step 14: Commit**

```bash
git add reminders/wrangler.jsonc reminders/tsconfig.json reminders/src/schedule.ts reminders/src/schedule.test.ts reminders/src/push.ts reminders/src/push.test.ts reminders/src/index.ts vitest.config.ts tsconfig.node.json tsconfig.json package.json package-lock.json
git commit -F - <<'EOF'
feat: reminders Worker with a Durable Object schedule and Web Push

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: The `/__reminders` Pages Function

**Files:**
- Create: `server/reminders.ts`, `server/reminders.test.ts`, `functions/__reminders.ts`, `functions/__reminders/test.ts`
- Modify: `scripts/verify-live.ts:69-72` (signed out) and `:124` (signed in)

**How it sits behind the gate.** `functions/_middleware.ts` runs first for every path. For `/__reminders` the gate (`server/gate.ts`) has no special case: a signed-in request of any method gets `'next'` (or `{ kind: 'next', setCookie }`), and `applyGateResult` calls `context.next()`, which runs the matching function; a signed-out request that isn't a page load (a `fetch` with `Accept: */*`) gets `401` with an empty body. The tests below check both through `handleRequest` itself. The service worker never answers `/__*` (Task 2's deny list), and it doesn't touch `PUT`, `DELETE` or `POST` anyway.

**Checks, in order:** the path (404), the method (405 with `Allow`), `Sec-Fetch-Site: same-origin` (403; Safari sends it from iOS 16.4, the first version with Web Push), the `REMINDERS` binding (503 "Birthday reminders aren't set up yet."), then for a PUT the JSON content type (415) and the body (400). Every answer is built by `respond` from `server/gate.ts`, so it carries `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` and `X-Frame-Options: DENY`.

- [ ] **Step 1: Write the failing tests**

Create `server/reminders.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import type { SyncInput, TestResult } from '../reminders/src/schedule.ts'
import { handleRequest, type GateEnv } from './gate.ts'
import { createMemoryKv } from './memoryKv.ts'
import {
  handleReminders,
  isPushEndpoint,
  MAX_AHEAD_MS,
  MAX_BEHIND_MS,
  NOT_SET_UP,
  type RemindersEnv,
  type RemindersService,
} from './reminders.ts'
import { createSessionValue, deriveSessionKey } from './session.ts'

const ORIGIN = 'https://friend.example'
const NOW = Date.UTC(2026, 9, 3, 12, 0, 0)

/** Valid base64url keys of the right sizes: a 65-byte P-256 point (starting 0x04) and a 16-byte secret. */
const P256DH = `B${'A'.repeat(86)}`
const AUTH = 'A'.repeat(22)

const SUBSCRIPTION = { endpoint: 'https://web.push.apple.com/QGuQyavXutnMH-endpoint', keys: { p256dh: P256DH, auth: AUTH } }
const REMINDERS = [{ at: NOW + 86_400_000, friendId: '8f14e45f-ceea-467f-a0e6-b5c1e0f4a1d2' }]

/** A stand-in for the Worker's RPC methods that records every call. */
function fakeService(testResult: TestResult = 'sent', fail = false) {
  const calls: { method: string; input?: SyncInput }[] = []
  const service: RemindersService = {
    sync: async (input) => {
      calls.push({ method: 'sync', input })
      if (fail) throw new Error('Worker exception')
    },
    clear: async () => {
      calls.push({ method: 'clear' })
      if (fail) throw new Error('Worker exception')
    },
    sendTest: async () => {
      calls.push({ method: 'sendTest' })
      if (fail) throw new Error('Worker exception')
      return testResult
    },
  }
  return { env: { REMINDERS: service } as RemindersEnv, calls }
}

interface RequestOptions {
  body?: unknown
  headers?: Record<string, string>
  /** The browser's Sec-Fetch-Site header, or null for none. */
  site?: string | null
}

function request(method: string, path = '/__reminders', { body, headers = {}, site = 'same-origin' }: RequestOptions = {}) {
  const text = body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  const fetchSite: Record<string, string> = site === null ? {} : { 'Sec-Fetch-Site': site }
  return new Request(`${ORIGIN}${path}`, {
    method,
    body: text,
    headers: { ...fetchSite, 'Content-Type': 'application/json', ...headers },
  })
}

function put(body: unknown, headers: Record<string, string> = {}, site: string | null = 'same-origin') {
  return request('PUT', '/__reminders', { body, headers, site })
}

async function statusOf(req: Request, env: RemindersEnv): Promise<number> {
  return (await handleReminders(req, env, NOW)).status
}

describe('the website gate in front of /__reminders', () => {
  const PASSWORD = 'maple otter lantern river'
  const SECRET = 'test-secret-0123456789-abcdefghijklmnop'
  const gateEnv: GateEnv = { SITE_PASSWORD: PASSWORD, SESSION_SECRET: SECRET, LOGIN_ATTEMPTS: createMemoryKv() }

  it('refuses every reminders request without a session', async () => {
    for (const req of [put({ subscription: SUBSCRIPTION, reminders: REMINDERS }), request('DELETE'), request('POST', '/__reminders/test')]) {
      const result = await handleRequest(req, gateEnv, NOW)
      expect(result instanceof Response && result.status).toBe(401)
    }
  })

  it('passes signed-in requests on to the function', async () => {
    const cookie = `__Host-ft_session=${await createSessionValue(await deriveSessionKey(SECRET, PASSWORD), NOW)}`
    for (const req of [
      put({ subscription: SUBSCRIPTION, reminders: REMINDERS }, { Cookie: cookie }),
      request('DELETE', '/__reminders', { headers: { Cookie: cookie } }),
      request('POST', '/__reminders/test', { headers: { Cookie: cookie } }),
    ]) {
      expect(await handleRequest(req, gateEnv, NOW)).toBe('next')
    }
  })
})

describe('PUT /__reminders', () => {
  it('hands a valid schedule to the Worker, keeping only the known fields', async () => {
    const { env, calls } = fakeService()
    const body = {
      subscription: { ...SUBSCRIPTION, expirationTime: null, extra: 'x' },
      reminders: [{ ...REMINDERS[0], name: 'Alex' }],
      extra: true,
    }
    expect(await statusOf(put(body), env)).toBe(204)
    expect(calls).toEqual([{ method: 'sync', input: { subscription: SUBSCRIPTION, reminders: REMINDERS } }])
  })

  it('accepts an empty list', async () => {
    const { env, calls } = fakeService()
    expect(await statusOf(put({ subscription: SUBSCRIPTION, reminders: [] }), env)).toBe(204)
    expect(calls).toHaveLength(1)
  })

  it('takes JSON only', async () => {
    const { env, calls } = fakeService()
    const req = put({ subscription: SUBSCRIPTION, reminders: REMINDERS }, { 'Content-Type': 'text/plain' })
    expect(await statusOf(req, env)).toBe(415)
    expect(calls).toEqual([])
  })

  it('refuses a body that is not a schedule', async () => {
    const { env, calls } = fakeService()
    const bad = ['not json', '[]', 'null', JSON.stringify({ reminders: REMINDERS }), JSON.stringify({ subscription: SUBSCRIPTION })]
    for (const body of bad) expect(await statusOf(put(body), env)).toBe(400)
    const huge = JSON.stringify({ subscription: SUBSCRIPTION, reminders: REMINDERS, padding: 'x'.repeat(200_000) })
    expect(await statusOf(put(huge), env)).toBe(400)
    expect(calls).toEqual([])
  })
})

describe('isPushEndpoint', () => {
  it('accepts the push services', () => {
    for (const endpoint of [
      'https://web.push.apple.com/QGuQyavXutnMH',
      'https://api.push.apple.com/3/device/abc',
      'https://fcm.googleapis.com/fcm/send/abc:def',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://wns2-by3p.notify.windows.com/w/?token=abc',
    ]) {
      expect(isPushEndpoint(endpoint)).toBe(true)
    }
  })

  it('refuses anywhere else', () => {
    for (const endpoint of [
      'http://web.push.apple.com/abc',
      'https://evil.example/abc',
      'https://web.push.apple.com.evil.example/abc',
      'https://evilpush.apple.com/abc',
      'https://push.apple.com/abc',
      'https://web.push.apple.com./abc',
      'https://user:pass@web.push.apple.com/abc',
      'https://web.push.apple.com:8443/abc',
      'https://169.254.169.254/latest',
      'https://localhost/abc',
      'not a url',
      `https://web.push.apple.com/${'a'.repeat(1024)}`,
    ]) {
      expect(isPushEndpoint(endpoint)).toBe(false)
    }
  })
})

describe('PUT /__reminders limits', () => {
  async function refused(change: (body: { subscription: Record<string, unknown>; reminders: unknown[] }) => void) {
    const { env, calls } = fakeService()
    const body = { subscription: structuredClone(SUBSCRIPTION) as Record<string, unknown>, reminders: structuredClone(REMINDERS) as unknown[] }
    change(body)
    const status = await statusOf(put(body), env)
    return status === 400 && calls.length === 0
  }

  it('refuses an endpoint outside the push services', async () => {
    expect(await refused((body) => (body.subscription.endpoint = 'https://evil.example/abc'))).toBe(true)
  })

  it('refuses keys of the wrong size or format', async () => {
    expect(await refused((body) => (body.subscription.keys = { p256dh: P256DH.slice(1), auth: AUTH }))).toBe(true)
    expect(await refused((body) => (body.subscription.keys = { p256dh: P256DH, auth: `${AUTH}AAAA` }))).toBe(true)
    expect(await refused((body) => (body.subscription.keys = { p256dh: `${P256DH.slice(1)}+`, auth: AUTH }))).toBe(true)
    expect(await refused((body) => (body.subscription.keys = { p256dh: P256DH }))).toBe(true)
  })

  it('takes at most 1,000 reminders', async () => {
    const reminder = REMINDERS[0]
    expect(await refused((body) => (body.reminders = Array.from({ length: 1001 }, () => reminder)))).toBe(true)
    const { env } = fakeService()
    const thousand = { subscription: SUBSCRIPTION, reminders: Array.from({ length: 1000 }, () => reminder) }
    expect(await statusOf(put(thousand), env)).toBe(204)
  })

  it('takes whole-millisecond times from a day ago to two years ahead', async () => {
    for (const at of [Number.NaN, 1.5 + NOW, `${NOW}`, null, NOW - MAX_BEHIND_MS - 1, NOW + MAX_AHEAD_MS + 1]) {
      expect(await refused((body) => (body.reminders = [{ at, friendId: 'alex' }]))).toBe(true)
    }
    const { env } = fakeService()
    const edges = [
      { at: NOW - MAX_BEHIND_MS, friendId: 'alex' },
      { at: NOW + MAX_AHEAD_MS, friendId: 'sam' },
    ]
    expect(await statusOf(put({ subscription: SUBSCRIPTION, reminders: edges }), env)).toBe(204)
  })

  it('takes friend ids of 1 to 64 characters', async () => {
    for (const friendId of ['', 'x'.repeat(65), 42, null]) {
      expect(await refused((body) => (body.reminders = [{ at: NOW, friendId }]))).toBe(true)
    }
    expect(await refused((body) => (body.reminders = ['alex']))).toBe(true)
    const { env } = fakeService()
    expect(await statusOf(put({ subscription: SUBSCRIPTION, reminders: [{ at: NOW, friendId: 'x'.repeat(64) }] }), env)).toBe(204)
  })
})

describe('DELETE /__reminders', () => {
  it('clears the schedule', async () => {
    const { env, calls } = fakeService()
    expect(await statusOf(request('DELETE'), env)).toBe(204)
    expect(calls).toEqual([{ method: 'clear' }])
  })
})

describe('POST /__reminders/test', () => {
  it("passes on the Worker's answer", async () => {
    const expected: [TestResult, number][] = [
      ['sent', 204],
      ['no-subscription', 409],
      ['gone', 410],
      ['failed', 502],
    ]
    for (const [result, status] of expected) {
      const { env, calls } = fakeService(result)
      expect(await statusOf(request('POST', '/__reminders/test'), env)).toBe(status)
      expect(calls).toEqual([{ method: 'sendTest' }])
    }
  })
})

describe('every reminders request', () => {
  it('must come from this site', async () => {
    for (const site of ['cross-site', 'same-site', 'none', null]) {
      const reqs = [
        put({ subscription: SUBSCRIPTION, reminders: REMINDERS }, {}, site),
        request('DELETE', '/__reminders', { site }),
        request('POST', '/__reminders/test', { site }),
      ]
      for (const req of reqs) {
        const { env, calls } = fakeService()
        expect(await statusOf(req, env)).toBe(403)
        expect(calls).toEqual([])
      }
    }
  })

  it('fails closed when the Worker is not bound', async () => {
    for (const req of [put({ subscription: SUBSCRIPTION, reminders: REMINDERS }), request('DELETE'), request('POST', '/__reminders/test')]) {
      const response = await handleReminders(req, {}, NOW)
      expect(response.status).toBe(503)
      expect(await response.text()).toBe(NOT_SET_UP)
    }
  })

  it('answers 502 when the Worker fails', async () => {
    const { env } = fakeService('sent', true)
    expect(await statusOf(put({ subscription: SUBSCRIPTION, reminders: REMINDERS }), env)).toBe(502)
    expect(await statusOf(request('DELETE'), env)).toBe(502)
    expect(await statusOf(request('POST', '/__reminders/test'), env)).toBe(502)
  })

  it('allows only its methods', async () => {
    const { env, calls } = fakeService()
    const getList = await handleReminders(request('GET'), env, NOW)
    expect(getList.status).toBe(405)
    expect(getList.headers.get('Allow')).toBe('PUT, DELETE')
    const putTest = await handleReminders(request('PUT', '/__reminders/test', { body: {} }), env, NOW)
    expect(putTest.status).toBe(405)
    expect(putTest.headers.get('Allow')).toBe('POST')
    expect(calls).toEqual([])
  })

  it("carries the gate's security headers", async () => {
    const { env } = fakeService()
    const responses = [
      await handleReminders(put({ subscription: SUBSCRIPTION, reminders: REMINDERS }), env, NOW),
      await handleReminders(put('nope'), env, NOW),
      await handleReminders(put({}, {}, 'cross-site'), env, NOW),
      await handleReminders(request('DELETE'), {}, NOW),
    ]
    for (const response of responses) {
      expect(response.headers.get('Cache-Control')).toBe('no-store')
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
      expect(response.headers.get('Referrer-Policy')).toBe('same-origin')
    }
  })
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run server/reminders.test.ts`
Expected: FAIL, `Test Files  1 failed (1)` and `Tests  no tests`, with `Error: Cannot find module './reminders.ts' imported from .../server/reminders.test.ts`.

- [ ] **Step 3: Write the endpoint's logic**

Create `server/reminders.ts`:

```ts
// The /__reminders endpoint. The app sends its birthday reminder schedule here, and this hands it to
// the reminders Worker (reminders/) through the REMINDERS service binding. It runs behind the
// website gate (functions/_middleware.ts), so only a signed-in session ever reaches it.
//
//   PUT    /__reminders       { subscription, reminders }  → sync     → 204
//   DELETE /__reminders                                     → clear    → 204
//   POST   /__reminders/test                                → sendTest → 204, or 409 / 410 / 502

import type { Reminder, Subscription, SyncInput, TestResult } from '../reminders/src/schedule.ts'
import { respond } from './gate.ts'

export const REMINDERS_PATH = '/__reminders'
export const REMINDERS_TEST_PATH = '/__reminders/test'

export const NOT_SET_UP = "Birthday reminders aren't set up yet."

/** The reminders Worker's RPC methods, as the service binding exposes them. */
export interface RemindersService {
  sync(input: SyncInput): Promise<void>
  clear(): Promise<void>
  sendTest(): Promise<TestResult>
}

export interface RemindersEnv {
  REMINDERS?: RemindersService
}

/** Push services the Worker may send to, so it can't be used to send requests anywhere else. */
const PUSH_HOSTS = ['web.push.apple.com', 'fcm.googleapis.com', 'updates.push.services.mozilla.com']
const PUSH_HOST_SUFFIXES = ['.push.apple.com', '.notify.windows.com']

export const MAX_REMINDERS = 1000
export const MAX_FRIEND_ID_LENGTH = 64
const MAX_ENDPOINT_LENGTH = 1024
/** 1,000 reminders take about 70 KB. */
const MAX_BODY_LENGTH = 200_000
const DAY_MS = 86_400_000
/** Reminders reach two years ahead (with room for a leap day). */
export const MAX_AHEAD_MS = 732 * DAY_MS
/** A phone's clock can be off, so a reminder up to a day old is accepted (the Worker drops it if it's too late). */
export const MAX_BEHIND_MS = DAY_MS

const PLAIN_TEXT = { 'Content-Type': 'text/plain; charset=utf-8' }

const TEST_STATUS: Record<TestResult, number> = { sent: 204, 'no-subscription': 409, gone: 410, failed: 502 }

type Obj = Record<string, unknown>

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** An https: URL on a known push service, with no user name, password or port. */
export function isPushEndpoint(endpoint: string): boolean {
  if (endpoint.length > MAX_ENDPOINT_LENGTH) return false
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '' || url.port !== '') return false
  const host = url.hostname
  return PUSH_HOSTS.includes(host) || PUSH_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

/** The number of bytes a base64url key decodes to, or -1 when it isn't base64url. */
function base64urlLength(text: string): number {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(text)) return -1
  const length = text.replace(/=+$/, '').length
  return length % 4 === 1 ? -1 : Math.floor((length * 3) / 4)
}

function readSubscription(value: unknown): Subscription | null {
  if (!isObj(value) || typeof value.endpoint !== 'string' || !isObj(value.keys)) return null
  const { endpoint } = value
  const { p256dh, auth } = value.keys
  if (!isPushEndpoint(endpoint)) return null
  // p256dh is an uncompressed P-256 point (65 bytes); auth is a 16-byte secret.
  if (typeof p256dh !== 'string' || base64urlLength(p256dh) !== 65) return null
  if (typeof auth !== 'string' || base64urlLength(auth) !== 16) return null
  return { endpoint, keys: { p256dh, auth } }
}

function readReminders(value: unknown, now: number): Reminder[] | null {
  if (!Array.isArray(value) || value.length > MAX_REMINDERS) return null
  const reminders: Reminder[] = []
  for (const item of value) {
    if (!isObj(item)) return null
    const { at, friendId } = item
    if (typeof at !== 'number' || !Number.isInteger(at) || at < now - MAX_BEHIND_MS || at > now + MAX_AHEAD_MS) {
      return null
    }
    if (typeof friendId !== 'string' || friendId.length === 0 || friendId.length > MAX_FRIEND_ID_LENGTH) return null
    // Only these two fields go on.
    reminders.push({ at, friendId })
  }
  return reminders
}

/** The PUT body, checked: `{ subscription, reminders }` within every limit, or null. */
export async function readSchedule(request: Request, now: number): Promise<SyncInput | null> {
  let body: unknown
  try {
    const text = await request.text()
    if (text.length > MAX_BODY_LENGTH) return null
    body = JSON.parse(text)
  } catch {
    return null
  }
  if (!isObj(body)) return null
  const subscription = readSubscription(body.subscription)
  const reminders = readReminders(body.reminders, now)
  return subscription && reminders ? { subscription, reminders } : null
}

export async function handleReminders(request: Request, env: RemindersEnv, now: number): Promise<Response> {
  const { pathname } = new URL(request.url)
  if (pathname !== REMINDERS_PATH && pathname !== REMINDERS_TEST_PATH) return respond(404)
  const methods = pathname === REMINDERS_TEST_PATH ? ['POST'] : ['PUT', 'DELETE']
  if (!methods.includes(request.method)) return respond(405, null, { Allow: methods.join(', ') })
  // Only the app itself, on this site, may change the schedule.
  if (request.headers.get('Sec-Fetch-Site') !== 'same-origin') return respond(403, 'Forbidden', PLAIN_TEXT)
  // Fail closed: without the Worker there's nothing to talk to.
  const service = env.REMINDERS
  if (!service) return respond(503, NOT_SET_UP, PLAIN_TEXT)

  try {
    if (request.method === 'DELETE') {
      await service.clear()
      return respond(204)
    }
    if (request.method === 'POST') return respond(TEST_STATUS[await service.sendTest()] ?? 502)
    if (!(request.headers.get('Content-Type') ?? '').toLowerCase().startsWith('application/json')) return respond(415)
    const input = await readSchedule(request, now)
    if (!input) return respond(400)
    await service.sync(input)
    return respond(204)
  } catch {
    // The Worker failed or couldn't be reached.
    return respond(502)
  }
}
```

(The types come from `reminders/src/schedule.ts` with `import type`, so the Function and the Worker agree on the RPC shapes and nothing of the Worker is bundled into the Function.)

- [ ] **Step 4: Run the tests and see them pass**

Run: `npx vitest run server/reminders.test.ts`
Expected: PASS, `Tests  20 passed (20)`.

- [ ] **Step 5: Add the two Pages Functions**

Create `functions/__reminders.ts`:

```ts
// PUT and DELETE /__reminders: the app's birthday reminder schedule (see server/reminders.ts).
// The middleware runs first, so only a signed-in session gets here.
import { handleReminders, type RemindersEnv } from '../server/reminders.ts'

export const onRequest: PagesFunction<RemindersEnv> = (context) =>
  handleReminders(context.request, context.env, Date.now())
```

Create `functions/__reminders/test.ts`:

```ts
// POST /__reminders/test: sends a test notification (see server/reminders.ts).
// The middleware runs first, so only a signed-in session gets here.
import { handleReminders, type RemindersEnv } from '../../server/reminders.ts'

export const onRequest: PagesFunction<RemindersEnv> = (context) =>
  handleReminders(context.request, context.env, Date.now())
```

A Pages Function file answers only its own path, so `/__reminders/test` needs its own file. (Checked while planning with `wrangler pages functions build`: the routes are `/__reminders` and `/__reminders/test`, with `_middleware.ts` in front of both.) At run time `context.env.REMINDERS` is the service binding's stub, whose RPC methods match `RemindersService`.

- [ ] **Step 6: Add the live checks**

In `scripts/verify-live.ts`, replace:

```ts
await check('the password check needs a signed-in session', async () => {
  const response = await anonymous.post('/__verify-password', { data: { password: wrongPassword } })
  assert.equal(response.status(), 403)
})
```

with:

```ts
await check('the password check needs a signed-in session', async () => {
  const response = await anonymous.post('/__verify-password', { data: { password: wrongPassword } })
  assert.equal(response.status(), 403)
})

await check('the reminders endpoint needs a signed-in session', async () => {
  const response = await anonymous.put('/__reminders', { data: { subscription: null, reminders: [] } })
  assert.equal(response.status(), 401)
  assert.equal(await response.text(), '')
})
```

Replace:

```ts
  await check('the sign-in page is never answered from the offline cache', async () => {
```

with:

```ts
  await check('the reminders endpoint is set up (the Worker is bound)', async () => {
    // An empty schedule is refused by the endpoint's own checks (400), which run only once the
    // REMINDERS binding exists. Without it the answer is 503 "Birthday reminders aren't set up yet."
    const response = await page.request.put(new URL('/__reminders', base).href, {
      data: { subscription: null, reminders: [] },
      headers: { 'Sec-Fetch-Site': 'same-origin' },
    })
    assert.notEqual(response.status(), 503, await response.text())
    assert.equal(response.status(), 400)
  })

  await check('the sign-in page is never answered from the offline cache', async () => {
```

Both checks leave the stored schedule alone. Without `FT_PASSWORD` the script now runs 8 checks; with it, 14. (It isn't run here: it checks the deployed site, in Task 8.)

- [ ] **Step 7: Run everything**

Run: `npx tsc -b`
Expected: no output, exit code 0 (`tsconfig.functions.json` checks the two functions with the Workers types).

Run: `npm test`
Expected: `Test Files  38 passed (38)` and `Tests  404 passed (404)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `86 passed`.

- [ ] **Step 8: Commit**

```bash
git add server/reminders.ts server/reminders.test.ts functions/__reminders.ts functions/__reminders/test.ts scripts/verify-live.ts
git commit -F - <<'EOF'
feat: /__reminders endpoint behind the website gate, failing closed without the Worker

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: The app: the setting, subscribing, syncing, and the Settings "Reminders" group

**Files:**
- Create: `src/reminders/types.ts`, `src/reminders/vapidKey.ts`, `src/reminders/vapidKey.test.ts`, `src/reminders/api.ts`, `src/reminders/api.test.ts`, `src/reminders/footer.ts`, `src/reminders/footer.test.ts`, `src/reminders/reminderStore.ts`, `src/reminders/reminderStore.test.ts`, `src/reminders/browserPush.ts`, `src/reminders/usePushSupport.ts`, `src/reminders/useReminderSync.ts`, `src/reminders/RemindersSection.tsx`, `e2e/reminders.spec.ts`
- Modify: `src/db/settings.ts:1-16`, `src/backup/storage.test.ts:8`, `:71`, `src/components/InsetGroup.tsx:54-56`, `:69`, `:112`, `src/components/InsetGroup.css:65`, `src/screens/SettingsScreen.tsx:12`, `:21`, `:31`, `:78`, `:102-106`, `src/App.tsx:5`, `:20`, `e2e/helpers.ts` (append), `e2e/screenshots.spec.ts:12`, `:89`, `:116-119`, `:129`

How the pieces fit:
- `reminderStore.ts` does the work: `turnOnReminders`, `turnOffReminders`, `syncReminders` and `sendTestNotification`. The browser (permission, subscription) and the network come in as `deps`, so it's tested with fakes against fake-indexeddb. Its calls run one at a time, so a sync still waiting on the network can't finish after "turn off" and switch reminders back on, and the server always gets the PUT before the DELETE.
- `browserPush.ts` is the real browser side, and `browserReminderDeps` wires it to `scheduleApi()`. Not unit-tested (no browser in Vitest); the e2e tests drive it through `stubPush`.
- `useReminderSync` runs inside `App` as `<ReminderSync />`. `LockGate` renders `App` only while unlocked, so the sync never runs on the lock screen. It waits 2 seconds after the app opens, comes back to the foreground, or any friend changes, then calls `syncReminders`, which sends only when the schedule's hash changed, the last send is a week old, or the last send failed.
- The setting is in the `settings` table, which backups never read or write (`readAllData` and `replaceAllData` touch only friends, groups, meetup types and meetups), so it's never exported and an import keeps it, like `appLock`.

- [ ] **Step 1: The setting**

Create `src/reminders/types.ts`:

```ts
/** Whether this app can get push notifications: only the installed Home Screen app can on iPhone. */
export type PushSupport = 'available' | 'unavailable' | 'denied'

/**
 * What went wrong last, for the Settings footer and the next sync:
 * - `sync`: sending the schedule failed (reminders stay on; the next sync tries again).
 * - `revoked`: iOS dropped the subscription, or notifications were turned off, so reminders stopped.
 * - `delete`: reminders were turned off, but deleting the server's schedule failed (the next sync tries again).
 */
export type ReminderProblem = 'sync' | 'revoked' | 'delete'

/** Stored in the `settings` table, which is never exported or imported. */
export interface BirthdayReminders {
  enabled: boolean
  /** scheduleHash of what the server last accepted. */
  lastSyncedHash: string | null
  /** ISO time the server last accepted the schedule. */
  lastSyncedAt: string | null
  lastError: ReminderProblem | null
}

// Frozen: a shared default, so nothing may change it in place (copy with a spread instead).
export const REMINDERS_OFF: BirthdayReminders = Object.freeze({
  enabled: false,
  lastSyncedHash: null,
  lastSyncedAt: null,
  lastError: null,
})
```

In `src/db/settings.ts`, replace:

```ts
import { LOCK_OFF, NO_FAILURES, type AppLock, type LockFailures } from '../lock/types'
import { db } from './db'
```

with:

```ts
import { LOCK_OFF, NO_FAILURES, type AppLock, type LockFailures } from '../lock/types'
import { REMINDERS_OFF, type BirthdayReminders } from '../reminders/types'
import { db } from './db'
```

Replace:

```ts
  appLockFailures: LockFailures
}
```

with:

```ts
  appLockFailures: LockFailures
  birthdayReminders: BirthdayReminders
}
```

Replace:

```ts
  appLockFailures: NO_FAILURES,
}
```

with:

```ts
  appLockFailures: NO_FAILURES,
  birthdayReminders: REMINDERS_OFF,
}
```

In `src/backup/storage.test.ts`, replace:

```ts
import type { AppLock, LockFailures } from '../lock/types'
```

with:

```ts
import type { AppLock, LockFailures } from '../lock/types'
import type { BirthdayReminders } from '../reminders/types'
```

Replace:

```ts
    expect(await getSetting('appLock')).toEqual(appLock)
    expect(await getSetting('appLockFailures')).toEqual(appLockFailures)
  })
```

with:

```ts
    expect(await getSetting('appLock')).toEqual(appLock)
    expect(await getSetting('appLockFailures')).toEqual(appLockFailures)
  })

  it('keeps the reminder settings, which a backup never carries', async () => {
    const birthdayReminders: BirthdayReminders = {
      enabled: true,
      lastSyncedHash: 'hash',
      lastSyncedAt: '2026-10-03T12:00:00.000Z',
      lastError: null,
    }
    await setSetting('birthdayReminders', birthdayReminders)

    const file = createBackup(await readAllData(), new Date('2026-10-03T12:00:00.000Z'))
    expect(JSON.stringify(file)).not.toContain('birthdayReminders')
    await replaceAllData({ friends: [friend('f1', 'Alex')], groups: [], meetupTypes: [], meetups: [] })

    expect(await getSetting('birthdayReminders')).toEqual(birthdayReminders)
  })
```

Run: `npx vitest run src/backup/storage.test.ts`
Expected: PASS, `Tests  5 passed (5)`. (A guard: backups already leave the `settings` table alone, and this keeps it that way.)

- [ ] **Step 2: The VAPID public key, with a format test**

Create `src/reminders/vapidKey.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import wranglerConfig from '../../reminders/wrangler.jsonc?raw'
import { base64urlToBytes } from '../lib/base64'
import { VAPID_PUBLIC_KEY } from './vapidKey'

describe('VAPID_PUBLIC_KEY', () => {
  it('is an uncompressed P-256 public key in unpadded base64url', async () => {
    expect(VAPID_PUBLIC_KEY).toMatch(/^[A-Za-z0-9_-]{87}$/)
    const bytes = base64urlToBytes(VAPID_PUBLIC_KEY)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(4)
    // WebCrypto refuses a point that isn't on the curve.
    await expect(crypto.subtle.importKey('raw', bytes, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])).resolves.toBeDefined()
  })

  it('is the key the reminders Worker signs with', () => {
    expect(wranglerConfig).toContain(`"VAPID_PUBLIC_KEY": "${VAPID_PUBLIC_KEY}"`)
  })
})
```

Run: `npx vitest run src/reminders/vapidKey.test.ts`
Expected: FAIL with `Error: Cannot find module './vapidKey' imported from .../src/reminders/vapidKey.test.ts`.

Create `src/reminders/vapidKey.ts`:

```ts
// The VAPID public key (the "application server key") that birthday reminder pushes are signed with.
// It isn't secret. scripts/make-vapid-keys.ts makes a new key pair, writes the public key here and
// into reminders/wrangler.jsonc, and the private key becomes the reminders Worker's secret.
// PLACEHOLDER: the rollout (Task 8 of the plan) replaces this key. Nobody holds its private half.
export const VAPID_PUBLIC_KEY = 'BLwNAu9O6nqiNKx-6lPlhLk_2LslupgmkvBGz6Bwlfhz_vvn0VFdgSSsRGSIr29QPqsN0r8M8ZOY9Emd_t619ig'
```

**This key is a placeholder, clearly marked, and the one sanctioned placeholder in this plan.** It is a real P-256 public key (so the format test is meaningful) whose private half was thrown away when it was made, so nothing can sign for it. It's the same value as `VAPID_PUBLIC_KEY` in `reminders/wrangler.jsonc` (Task 4). Task 8 Step 2 replaces both with `scripts/make-vapid-keys.ts` before anything is deployed.

Run: `npx vitest run src/reminders/vapidKey.test.ts`
Expected: PASS, `Tests  2 passed (2)`. (`?raw` imports the file as text; Vite and Vitest support it, and `vite/client` types it.)

- [ ] **Step 3: The `/__reminders` client**

Create `src/reminders/api.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { scheduleApi, type ScheduleBody } from './api'

const BODY: ScheduleBody = {
  subscription: { endpoint: 'https://web.push.apple.com/abc', keys: { p256dh: 'p256dh-key', auth: 'auth-secret' } },
  reminders: [{ at: 1_800_000_000_000, friendId: 'alex' }],
}

/** A fetch that records each call and answers with the next response (or throws for null: offline). */
function fakeFetch(...answers: (Response | null)[]) {
  const calls: { url: string; init: RequestInit }[] = []
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const answer = answers.shift()
    if (!answer) throw new TypeError('Load failed')
    return answer
  }) as unknown as typeof fetch
  return { fetcher, calls }
}

const status = (code: number) => new Response(null, { status: code })

describe('putSchedule', () => {
  it('PUTs the schedule as JSON with the sign-in cookie, and only 204 counts', async () => {
    const { fetcher, calls } = fakeFetch(status(204))
    expect(await scheduleApi(fetcher).putSchedule(BODY)).toBe(true)
    expect(calls[0].url).toBe('/__reminders')
    expect(calls[0].init).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(BODY),
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
    })
    for (const answer of [status(200), status(400), status(503), null]) {
      expect(await scheduleApi(fakeFetch(answer).fetcher).putSchedule(BODY)).toBe(false)
    }
  })

  it('never trusts a redirect', async () => {
    const redirected = new Response(null, { status: 204 })
    Object.defineProperty(redirected, 'redirected', { value: true })
    expect(await scheduleApi(fakeFetch(redirected).fetcher).putSchedule(BODY)).toBe(false)
  })
})

describe('deleteSchedule', () => {
  it('sends DELETE, and only 204 counts', async () => {
    const { fetcher, calls } = fakeFetch(status(204))
    expect(await scheduleApi(fetcher).deleteSchedule()).toBe(true)
    expect(calls[0]).toMatchObject({ url: '/__reminders', init: { method: 'DELETE' } })
    expect(await scheduleApi(fakeFetch(status(502)).fetcher).deleteSchedule()).toBe(false)
    expect(await scheduleApi(fakeFetch(null).fetcher).deleteSchedule()).toBe(false)
  })
})

describe('sendTest', () => {
  it('POSTs to the test endpoint and reads the answer', async () => {
    const { fetcher, calls } = fakeFetch(status(204))
    expect(await scheduleApi(fetcher).sendTest()).toBe('sent')
    expect(calls[0]).toMatchObject({ url: '/__reminders/test', init: { method: 'POST' } })
    expect(await scheduleApi(fakeFetch(status(409)).fetcher).sendTest()).toBe('no-subscription')
    expect(await scheduleApi(fakeFetch(status(410)).fetcher).sendTest()).toBe('gone')
    expect(await scheduleApi(fakeFetch(status(502)).fetcher).sendTest()).toBe('error')
    expect(await scheduleApi(fakeFetch(null).fetcher).sendTest()).toBe('error')
  })
})
```

Run: `npx vitest run src/reminders/api.test.ts`
Expected: FAIL with `Error: Cannot find module './api' imported from .../src/reminders/api.test.ts`.

Create `src/reminders/api.ts`:

```ts
// The app's side of /__reminders (see server/reminders.ts): sends the reminder schedule to the
// server, deletes it, and asks for a test notification.

import type { PushSubscriptionData, Reminder } from '../lib/reminders'

export const REMINDERS_URL = '/__reminders'
export const REMINDERS_TEST_URL = '/__reminders/test'

const TIMEOUT_MS = 15_000

/** What the server stores: where to send pushes, and when. */
export interface ScheduleBody {
  subscription: PushSubscriptionData
  reminders: Reminder[]
}

/** The server's answer to a test: sent, it has no schedule (409), or the subscription is gone (410). */
export type TestAnswer = 'sent' | 'no-subscription' | 'gone' | 'error'

export interface ScheduleApi {
  /** True when the server saved the schedule. */
  putSchedule(body: ScheduleBody): Promise<boolean>
  /** True when the server deleted the schedule. */
  deleteSchedule(): Promise<boolean>
  sendTest(): Promise<TestAnswer>
}

/** The answer's status, or null for no answer, a timeout, or a redirect (a captive portal, or a lost sign-in). */
async function statusOf(fetcher: typeof fetch, url: string, init: RequestInit): Promise<number | null> {
  try {
    const response = await fetcher(url, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'manual',
      // AbortSignal.timeout is missing before iOS 16: without it the request just has no time limit.
      signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(TIMEOUT_MS) : undefined,
    })
    if (response.type === 'opaqueredirect' || response.redirected) return null
    return response.status
  } catch {
    return null
  }
}

export function scheduleApi(fetcher: typeof fetch = fetch): ScheduleApi {
  return {
    putSchedule: async (body) =>
      (await statusOf(fetcher, REMINDERS_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })) === 204,
    deleteSchedule: async () => (await statusOf(fetcher, REMINDERS_URL, { method: 'DELETE' })) === 204,
    sendTest: async () => {
      switch (await statusOf(fetcher, REMINDERS_TEST_URL, { method: 'POST' })) {
        case 204:
          return 'sent'
        case 409:
          return 'no-subscription'
        case 410:
          return 'gone'
        default:
          return 'error'
      }
    },
  }
}
```

(Same pattern as `src/lock/sitePassword.ts`: only the expected status counts, and a redirect never does. The browser adds `Sec-Fetch-Site: same-origin` to these same-origin requests by itself.)

Run: `npx vitest run src/reminders/api.test.ts`
Expected: PASS, `Tests  4 passed (4)`.

- [ ] **Step 4: The footer text**

Create `src/reminders/footer.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { reminderFooter } from './footer'
import { REMINDERS_OFF, type BirthdayReminders } from './types'

const ON: BirthdayReminders = {
  enabled: true,
  lastSyncedHash: 'hash',
  lastSyncedAt: '2026-10-03T12:00:00.000Z',
  lastError: null,
}

describe('reminderFooter', () => {
  it('describes reminders when they can be turned on', () => {
    expect(reminderFooter('available', REMINDERS_OFF)).toBe('A notification at 11:55 PM the night before each birthday.')
  })

  it('asks for the Home Screen app where push is unavailable, whatever the setting', () => {
    for (const reminders of [REMINDERS_OFF, ON]) {
      expect(reminderFooter('unavailable', reminders)).toBe('Open Friend Tracker from your Home Screen to turn on reminders.')
    }
  })

  it('explains how to allow notifications once they were denied', () => {
    for (const reminders of [REMINDERS_OFF, ON]) {
      expect(reminderFooter('denied', reminders)).toBe(
        "Notifications are off for Friend Tracker. Turn them on in the iPhone's Settings app, under Notifications.",
      )
    }
  })

  it('says when they are on, and when the last update failed', () => {
    expect(reminderFooter('available', ON)).toBe("On. You'll get a note at 11:55 PM the night before each birthday.")
    expect(reminderFooter('available', { ...ON, lastError: 'sync' })).toBe(
      "On. You'll get a note at 11:55 PM the night before each birthday. Couldn't update reminders just now. The app will try again next time it opens.",
    )
  })

  it('says when they stopped by themselves', () => {
    expect(reminderFooter('available', { ...REMINDERS_OFF, lastError: 'revoked' })).toBe('Reminders stopped. Turn them on again.')
  })

  it('reads as plain off while a delete is still pending', () => {
    expect(reminderFooter('available', { ...REMINDERS_OFF, lastError: 'delete' })).toBe(
      'A notification at 11:55 PM the night before each birthday.',
    )
  })
})
```

Run: `npx vitest run src/reminders/footer.test.ts`
Expected: FAIL with `Error: Cannot find module './footer' imported from .../src/reminders/footer.test.ts`.

Create `src/reminders/footer.ts`:

```ts
import type { BirthdayReminders, PushSupport } from './types'

/** The Reminders group's footer in Settings. */
export function reminderFooter(support: PushSupport, reminders: BirthdayReminders): string {
  if (support === 'unavailable') return 'Open Friend Tracker from your Home Screen to turn on reminders.'
  if (support === 'denied') {
    return "Notifications are off for Friend Tracker. Turn them on in the iPhone's Settings app, under Notifications."
  }
  if (reminders.enabled) {
    const on = "On. You'll get a note at 11:55 PM the night before each birthday."
    if (reminders.lastError !== 'sync') return on
    return `${on} Couldn't update reminders just now. The app will try again next time it opens.`
  }
  if (reminders.lastError === 'revoked') return 'Reminders stopped. Turn them on again.'
  return 'A notification at 11:55 PM the night before each birthday.'
}
```

Run: `npx vitest run src/reminders/footer.test.ts`
Expected: PASS, `Tests  6 passed (6)`.

- [ ] **Step 5: Turning on and off, syncing, and the test notification**

Create `src/reminders/reminderStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from '../db/db'
import { getSetting, setSetting } from '../db/settings'
import { base64urlToBytes } from '../lib/base64'
import { buildReminders, scheduleHash } from '../lib/reminders'
import { friend } from '../test/fixtures'
import type { ScheduleApi, ScheduleBody, TestAnswer } from './api'
import {
  REFRESH_MS,
  sendTestNotification,
  syncReminders,
  turnOffReminders,
  turnOnReminders,
  type PushPort,
  type ReminderDeps,
  type SubscriptionLike,
} from './reminderStore'
import { REMINDERS_OFF, type BirthdayReminders, type PushSupport } from './types'
import { VAPID_PUBLIC_KEY } from './vapidKey'

beforeEach(resetDatabase)

/** Noon on Oct 2, 2026, in the test time zone. */
const NOW = new Date(2026, 9, 2, 12, 0).getTime()

const ENDPOINT = 'https://web.push.apple.com/QGuQyavXutnMH-endpoint'
const KEYS = { p256dh: 'p256dh-key', auth: 'auth-secret' }
const APP_KEY = base64urlToBytes(VAPID_PUBLIC_KEY)

/** A push subscription made with `key` that records when it's dropped. */
function fakeSubscription(key: Uint8Array = APP_KEY) {
  const state = { unsubscribed: false }
  const subscription: SubscriptionLike = {
    options: { applicationServerKey: new Uint8Array(key).buffer },
    toJSON: () => ({ endpoint: ENDPOINT, expirationTime: null, keys: KEYS }),
    unsubscribe: async () => {
      state.unsubscribed = true
      return true
    },
  }
  return { subscription, state }
}

interface PushOptions {
  support?: PushSupport
  answer?: NotificationPermission
  existing?: SubscriptionLike | null
}

/** The browser: permission, and one subscription that subscribe() replaces. */
function fakePush({ support = 'available', answer = 'granted', existing = null }: PushOptions = {}) {
  const calls: string[] = []
  const state = { current: existing, subscribedWith: null as Uint8Array | null, made: null as ReturnType<typeof fakeSubscription> | null }
  const push: PushPort = {
    support: () => support,
    requestPermission: () => {
      calls.push('requestPermission')
      return Promise.resolve(answer)
    },
    getSubscription: async () => state.current,
    subscribe: async (key) => {
      calls.push('subscribe')
      state.subscribedWith = key
      state.made = fakeSubscription(key)
      state.current = state.made.subscription
      return state.current
    },
  }
  return { push, calls, state }
}

/** The server: records each call and answers as told. */
function fakeApi(answers: { put?: boolean[]; remove?: boolean[]; test?: TestAnswer[] } = {}) {
  const calls: { method: string; body?: ScheduleBody }[] = []
  const api: ScheduleApi = {
    putSchedule: async (body) => {
      calls.push({ method: 'PUT', body })
      return answers.put?.shift() ?? true
    },
    deleteSchedule: async () => {
      calls.push({ method: 'DELETE' })
      return answers.remove?.shift() ?? true
    },
    sendTest: async () => {
      calls.push({ method: 'TEST' })
      return answers.test?.shift() ?? 'sent'
    },
  }
  return { api, calls }
}

function deps(push: PushPort, api: ScheduleApi, now = NOW): ReminderDeps {
  return { push, api, now: () => now }
}

async function addAlex() {
  await db.friends.add({ ...friend('alex', 'Alex'), birthday: { month: 10, day: 14, year: null } })
}

async function expectedSchedule() {
  const subscription = { endpoint: ENDPOINT, keys: KEYS }
  const reminders = buildReminders(await db.friends.toArray(), NOW)
  return { body: { subscription, reminders }, hash: await scheduleHash(subscription, reminders) }
}

/** Reminders already on and in step with the server, as of `syncedAt`. */
async function seedOn(syncedAt = NOW, change: Partial<BirthdayReminders> = {}) {
  const { hash } = await expectedSchedule()
  await setSetting('birthdayReminders', {
    enabled: true,
    lastSyncedHash: hash,
    lastSyncedAt: new Date(syncedAt).toISOString(),
    lastError: null,
    ...change,
  })
}

describe('turnOnReminders', () => {
  it('asks for permission before anything else, inside the tap', async () => {
    const { push, calls } = fakePush()
    const turningOn = turnOnReminders(deps(push, fakeApi().api))
    // Called synchronously: iOS only shows the prompt while the tap is still being handled.
    expect(calls).toEqual(['requestPermission'])
    expect(await turningOn).toBe('on')
  })

  it("subscribes with the app's key, sends the schedule, and saves it", async () => {
    await addAlex()
    const { push, state } = fakePush()
    const server = fakeApi()
    expect(await turnOnReminders(deps(push, server.api))).toBe('on')
    expect(state.subscribedWith).toEqual(APP_KEY)
    const { body, hash } = await expectedSchedule()
    expect(body.reminders).toHaveLength(2)
    expect(server.calls).toEqual([{ method: 'PUT', body }])
    expect(await getSetting('birthdayReminders')).toEqual({
      enabled: true,
      lastSyncedHash: hash,
      lastSyncedAt: new Date(NOW).toISOString(),
      lastError: null,
    })
  })

  it('reuses a subscription made with the app key', async () => {
    const existing = fakeSubscription()
    const { push, calls } = fakePush({ existing: existing.subscription })
    expect(await turnOnReminders(deps(push, fakeApi().api))).toBe('on')
    expect(calls).toEqual(['requestPermission'])
    expect(existing.state.unsubscribed).toBe(false)
  })

  it('replaces a subscription made with another key', async () => {
    const old = fakeSubscription(new Uint8Array(65).fill(4))
    const { push, calls } = fakePush({ existing: old.subscription })
    expect(await turnOnReminders(deps(push, fakeApi().api))).toBe('on')
    expect(old.state.unsubscribed).toBe(true)
    expect(calls).toEqual(['requestPermission', 'subscribe'])
  })

  it('stays off when notifications are denied', async () => {
    const { push, calls } = fakePush({ answer: 'denied' })
    const server = fakeApi()
    expect(await turnOnReminders(deps(push, server.api))).toBe('denied')
    expect(calls).toEqual(['requestPermission'])
    expect(server.calls).toEqual([])
    expect(await getSetting('birthdayReminders')).toEqual(REMINDERS_OFF)
  })

  it('stays off when the prompt is dismissed', async () => {
    const { push } = fakePush({ answer: 'default' })
    expect(await turnOnReminders(deps(push, fakeApi().api))).toBe('failed')
    expect(await getSetting('birthdayReminders')).toEqual(REMINDERS_OFF)
  })

  it('stays off, and drops the subscription, when the server does not save the schedule', async () => {
    const { push, state } = fakePush()
    expect(await turnOnReminders(deps(push, fakeApi({ put: [false] }).api))).toBe('failed')
    expect(state.made?.state.unsubscribed).toBe(true)
    expect(await getSetting('birthdayReminders')).toEqual(REMINDERS_OFF)
  })

  it('stays off when subscribing fails', async () => {
    const { push } = fakePush()
    push.subscribe = () => Promise.reject(new DOMException('Subscribing failed', 'AbortError'))
    const server = fakeApi()
    expect(await turnOnReminders(deps(push, server.api))).toBe('failed')
    expect(server.calls).toEqual([])
  })
})

describe('turnOffReminders', () => {
  it('drops the subscription, deletes the schedule, and saves off', async () => {
    await seedOn()
    const current = fakeSubscription()
    const server = fakeApi()
    await turnOffReminders(deps(fakePush({ existing: current.subscription }).push, server.api))
    expect(current.state.unsubscribed).toBe(true)
    expect(server.calls).toEqual([{ method: 'DELETE' }])
    expect(await getSetting('birthdayReminders')).toEqual(REMINDERS_OFF)
  })

  it('is off even when the delete fails, and remembers to retry it', async () => {
    await seedOn()
    await turnOffReminders(deps(fakePush().push, fakeApi({ remove: [false] }).api))
    expect(await getSetting('birthdayReminders')).toEqual({ ...REMINDERS_OFF, lastError: 'delete' })
  })
})

describe('syncReminders', () => {
  it('does nothing while reminders are off', async () => {
    const server = fakeApi()
    await syncReminders(deps(fakePush().push, server.api))
    expect(server.calls).toEqual([])
  })

  it('retries a delete that failed, then forgets it', async () => {
    await setSetting('birthdayReminders', { ...REMINDERS_OFF, lastError: 'delete' })
    const server = fakeApi({ remove: [false, true] })
    const { push } = fakePush()
    await syncReminders(deps(push, server.api))
    expect(await getSetting('birthdayReminders')).toEqual({ ...REMINDERS_OFF, lastError: 'delete' })
    await syncReminders(deps(push, server.api))
    expect(server.calls).toEqual([{ method: 'DELETE' }, { method: 'DELETE' }])
    expect(await getSetting('birthdayReminders')).toEqual(REMINDERS_OFF)
  })

  it('sends nothing when the schedule is unchanged and less than a week old', async () => {
    await addAlex()
    await seedOn(NOW - REFRESH_MS + 60_000)
    const server = fakeApi()
    await syncReminders(deps(fakePush({ existing: fakeSubscription().subscription }).push, server.api))
    expect(server.calls).toEqual([])
  })

  it('sends the schedule when a birthday changed', async () => {
    await seedOn()
    await addAlex()
    const server = fakeApi()
    await syncReminders(deps(fakePush({ existing: fakeSubscription().subscription }).push, server.api))
    const { body, hash } = await expectedSchedule()
    expect(server.calls).toEqual([{ method: 'PUT', body }])
    expect(await getSetting('birthdayReminders')).toMatchObject({ enabled: true, lastSyncedHash: hash, lastError: null })
  })

  it('sends it again after a week, even unchanged', async () => {
    await addAlex()
    await seedOn(NOW - REFRESH_MS)
    const server = fakeApi()
    await syncReminders(deps(fakePush({ existing: fakeSubscription().subscription }).push, server.api))
    expect(server.calls.map((call) => call.method)).toEqual(['PUT'])
    expect(await getSetting('birthdayReminders')).toMatchObject({ lastSyncedAt: new Date(NOW).toISOString() })
  })

  it('remembers a failed send, keeps reminders on, and tries again next time', async () => {
    await seedOn()
    await addAlex()
    const { push } = fakePush({ existing: fakeSubscription().subscription })
    const server = fakeApi({ put: [false, true] })
    await syncReminders(deps(push, server.api))
    const failed = await getSetting('birthdayReminders')
    expect(failed).toMatchObject({ enabled: true, lastError: 'sync' })
    await syncReminders(deps(push, server.api))
    expect(server.calls.map((call) => call.method)).toEqual(['PUT', 'PUT'])
    expect(await getSetting('birthdayReminders')).toMatchObject({ enabled: true, lastError: null })
  })

  it('turns reminders off when the subscription is gone', async () => {
    await seedOn()
    const server = fakeApi()
    await syncReminders(deps(fakePush({ existing: null }).push, server.api))
    expect(await getSetting('birthdayReminders')).toEqual({ ...REMINDERS_OFF, lastError: 'revoked' })
    expect(server.calls).toEqual([{ method: 'DELETE' }])
  })

  it('turns reminders off when notifications were turned off', async () => {
    await seedOn()
    const current = fakeSubscription()
    await syncReminders(deps(fakePush({ support: 'denied', existing: current.subscription }).push, fakeApi().api))
    expect(await getSetting('birthdayReminders')).toEqual({ ...REMINDERS_OFF, lastError: 'revoked' })
  })

  it('turns reminders off when the subscription was made with another key', async () => {
    await seedOn()
    const old = fakeSubscription(new Uint8Array(65).fill(4))
    await syncReminders(deps(fakePush({ existing: old.subscription }).push, fakeApi().api))
    expect(await getSetting('birthdayReminders')).toEqual({ ...REMINDERS_OFF, lastError: 'revoked' })
    expect(old.state.unsubscribed).toBe(true)
  })

  it('leaves everything alone where push is unavailable', async () => {
    await seedOn()
    const server = fakeApi()
    await syncReminders(deps(fakePush({ support: 'unavailable' }).push, server.api))
    expect(server.calls).toEqual([])
    expect(await getSetting('birthdayReminders')).toMatchObject({ enabled: true, lastError: null })
  })

  it('saves a failure instead of throwing', async () => {
    await seedOn()
    const { push } = fakePush()
    push.getSubscription = () => Promise.reject(new Error('The service worker is not ready.'))
    await expect(syncReminders(deps(push, fakeApi().api))).resolves.toBeUndefined()
    expect(await getSetting('birthdayReminders')).toMatchObject({ enabled: true, lastError: 'sync' })
  })

  it('never turns reminders back on when they are turned off during a send', async () => {
    await seedOn()
    await addAlex()
    const order: string[] = []
    let release: (saved: boolean) => void = () => {}
    let sending: () => void = () => {}
    const sendStarted = new Promise<void>((resolve) => (sending = resolve))
    const api: ScheduleApi = {
      putSchedule: () => {
        order.push('PUT')
        sending()
        return new Promise((resolve) => (release = resolve))
      },
      deleteSchedule: async () => {
        order.push('DELETE')
        return true
      },
      sendTest: async () => 'sent',
    }
    const { push } = fakePush({ existing: fakeSubscription().subscription })
    const sync = syncReminders(deps(push, api))
    const off = turnOffReminders(deps(push, api))
    await sendStarted
    release(true)
    await Promise.all([sync, off])
    // The delete waited for the send, so the server ends up with nothing and the switch stays off.
    expect(order).toEqual(['PUT', 'DELETE'])
    expect(await getSetting('birthdayReminders')).toEqual(REMINDERS_OFF)
  })
})

describe('sendTestNotification', () => {
  it('asks the server for a test', async () => {
    await seedOn()
    const server = fakeApi()
    expect(await sendTestNotification(deps(fakePush().push, server.api))).toBe('sent')
    expect(server.calls).toEqual([{ method: 'TEST' }])
  })

  it('sends the schedule again when the server lost it, then retries once', async () => {
    await seedOn()
    const server = fakeApi({ test: ['no-subscription', 'sent'] })
    const { push } = fakePush({ existing: fakeSubscription().subscription })
    expect(await sendTestNotification(deps(push, server.api))).toBe('sent')
    expect(server.calls.map((call) => call.method)).toEqual(['TEST', 'PUT', 'TEST'])
  })

  it('turns reminders off when the subscription is gone', async () => {
    await seedOn()
    const current = fakeSubscription()
    const server = fakeApi({ test: ['gone'] })
    expect(await sendTestNotification(deps(fakePush({ existing: current.subscription }).push, server.api))).toBe('failed')
    expect(current.state.unsubscribed).toBe(true)
    expect(await getSetting('birthdayReminders')).toEqual({ ...REMINDERS_OFF, lastError: 'revoked' })
  })

  it('reports any other failure', async () => {
    await seedOn()
    expect(await sendTestNotification(deps(fakePush().push, fakeApi({ test: ['error'] }).api))).toBe('failed')
  })
})
```

Run: `npx vitest run src/reminders/reminderStore.test.ts`
Expected: FAIL with `Error: Cannot find module './reminderStore' imported from .../src/reminders/reminderStore.test.ts`.

Create `src/reminders/reminderStore.ts`:

```ts
// Turning birthday reminders on and off, and keeping the server's schedule in step with the
// friends' birthdays. The browser (permission, subscription) and the network come in as `deps`,
// so all of this is tested with fakes. Calls run one at a time, so a sync still waiting on the
// network can't finish after "turn off" and undo it.

import { db } from '../db/db'
import { getSetting, setSetting } from '../db/settings'
import { base64urlToBytes, bytesToBase64url } from '../lib/base64'
import { buildReminders, scheduleHash, type PushSubscriptionData } from '../lib/reminders'
import type { ScheduleApi } from './api'
import { REMINDERS_OFF, type BirthdayReminders, type PushSupport } from './types'
import { VAPID_PUBLIC_KEY } from './vapidKey'

/** The parts of a PushSubscription this code uses. */
export interface SubscriptionLike {
  readonly options: { readonly applicationServerKey: ArrayBuffer | null }
  toJSON(): PushSubscriptionJSON
  unsubscribe(): Promise<boolean>
}

/** Notification permission and the push subscription (see browserPush.ts). */
export interface PushPort {
  support(): PushSupport
  requestPermission(): Promise<NotificationPermission>
  getSubscription(): Promise<SubscriptionLike | null>
  subscribe(applicationServerKey: Uint8Array<ArrayBuffer>): Promise<SubscriptionLike>
}

export interface ReminderDeps {
  push: PushPort
  api: ScheduleApi
  /** The current time in ms. */
  now: () => number
}

/** The schedule is sent again after a week even when nothing changed, in case the server lost it. */
export const REFRESH_MS = 7 * 86_400_000

let queue: Promise<unknown> = Promise.resolve()

function exclusive<T>(run: () => Promise<T>): Promise<T> {
  const result = queue.then(run, run)
  queue = result.catch(() => {})
  return result
}

/** Applies `change` to the stored setting in one transaction. `change` returns null to leave it alone. */
async function updateReminders(change: (current: BirthdayReminders) => BirthdayReminders | null): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const next = change(await getSetting('birthdayReminders'))
    if (next) await setSetting('birthdayReminders', next)
  })
}

function synced(hash: string, now: number): BirthdayReminders {
  return { enabled: true, lastSyncedHash: hash, lastSyncedAt: new Date(now).toISOString(), lastError: null }
}

function subscriptionData(subscription: SubscriptionLike): PushSubscriptionData {
  const { endpoint, keys } = subscription.toJSON()
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('The push subscription has no keys.')
  return { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }
}

/** Whether the subscription was made with this app's key (pushes signed with another key are refused). */
function hasAppKey(subscription: SubscriptionLike): boolean {
  const key = subscription.options.applicationServerKey
  // A browser that doesn't say is trusted.
  return key === null || bytesToBase64url(new Uint8Array(key)) === VAPID_PUBLIC_KEY
}

async function subscribeWithAppKey(push: PushPort): Promise<SubscriptionLike> {
  const existing = await push.getSubscription()
  if (existing && hasAppKey(existing)) return existing
  // A subscription made with another key can't be reused, and a new one can't be made while it exists.
  await existing?.unsubscribe()
  return push.subscribe(base64urlToBytes(VAPID_PUBLIC_KEY))
}

async function buildSchedule(subscription: SubscriptionLike, now: number) {
  const data = subscriptionData(subscription)
  const reminders = buildReminders(await db.friends.toArray(), now)
  return { body: { subscription: data, reminders }, hash: await scheduleHash(data, reminders) }
}

export type TurnOnResult = 'on' | 'denied' | 'failed'

/**
 * Turns reminders on, from a tap: asks for permission (right away, while iOS still counts the tap),
 * subscribes, and sends the schedule. If anything fails, reminders stay off.
 */
export function turnOnReminders(deps: ReminderDeps): Promise<TurnOnResult> {
  let asked: Promise<NotificationPermission>
  try {
    asked = deps.push.requestPermission()
  } catch {
    return Promise.resolve('failed')
  }
  return exclusive(async () => {
    let subscription: SubscriptionLike | null = null
    try {
      const permission = await asked
      if (permission === 'denied') return 'denied'
      if (permission !== 'granted') return 'failed'
      subscription = await subscribeWithAppKey(deps.push)
      const now = deps.now()
      const { body, hash } = await buildSchedule(subscription, now)
      if (!(await deps.api.putSchedule(body))) throw new Error('The server did not save the schedule.')
      await setSetting('birthdayReminders', synced(hash, now))
      return 'on'
    } catch {
      // Leave nothing behind.
      await subscription?.unsubscribe().catch(() => false)
      return 'failed'
    }
  })
}

/** Turns reminders off: drops the subscription and deletes the server's schedule. Off even if the delete fails. */
export function turnOffReminders(deps: ReminderDeps): Promise<void> {
  return exclusive(async () => {
    try {
      await (await deps.push.getSubscription())?.unsubscribe()
    } catch {
      // Already gone, or no service worker: nothing to drop.
    }
    const deleted = await deps.api.deleteSchedule()
    await setSetting('birthdayReminders', deleted ? REMINDERS_OFF : { ...REMINDERS_OFF, lastError: 'delete' })
  })
}

/** Reminders stopped from outside the app: the subscription is gone or notifications are off. */
async function stop(deps: ReminderDeps, subscription: SubscriptionLike | null): Promise<void> {
  await updateReminders((current) => (current.enabled ? { ...REMINDERS_OFF, lastError: 'revoked' } : null))
  await subscription?.unsubscribe().catch(() => false)
  await deps.api.deleteSchedule()
}

/** Sends the schedule when it changed, is a week old, or the last try failed (or always, with `force`). */
async function syncNow(deps: ReminderDeps, force: boolean): Promise<void> {
  const settings = await getSetting('birthdayReminders')
  if (!settings.enabled) {
    // Turned off, but the server didn't hear: try the delete again.
    if (settings.lastError === 'delete' && (await deps.api.deleteSchedule())) {
      await updateReminders((current) => (!current.enabled && current.lastError === 'delete' ? REMINDERS_OFF : null))
    }
    return
  }
  const support = deps.push.support()
  if (support === 'unavailable') return
  const subscription = support === 'denied' ? null : await deps.push.getSubscription()
  if (!subscription || !hasAppKey(subscription)) {
    await stop(deps, subscription)
    return
  }
  const now = deps.now()
  const { body, hash } = await buildSchedule(subscription, now)
  const syncedAt = settings.lastSyncedAt === null ? Number.NaN : Date.parse(settings.lastSyncedAt)
  const upToDate = hash === settings.lastSyncedHash && settings.lastError === null && now - syncedAt < REFRESH_MS
  if (upToDate && !force) return
  const saved = await deps.api.putSchedule(body)
  // Turned off meanwhile: leave it off.
  await updateReminders((current) =>
    !current.enabled ? null : saved ? synced(hash, now) : { ...current, lastError: 'sync' },
  )
}

/** Keeps the server's schedule current. Never throws: a failure is saved for the Settings footer. */
export function syncReminders(deps: ReminderDeps): Promise<void> {
  return exclusive(async () => {
    try {
      await syncNow(deps, false)
    } catch {
      await updateReminders((current) => (current.enabled ? { ...current, lastError: 'sync' } : null)).catch(() => {})
    }
  })
}

export type TestOutcome = 'sent' | 'failed'

/** Asks the server for a test notification. If it lost the schedule, sends it again first. */
export function sendTestNotification(deps: ReminderDeps): Promise<TestOutcome> {
  return exclusive(async () => {
    try {
      let answer = await deps.api.sendTest()
      if (answer === 'no-subscription') {
        await syncNow(deps, true)
        answer = await deps.api.sendTest()
      }
      if (answer === 'gone') await stop(deps, await deps.push.getSubscription().catch(() => null))
      return answer === 'sent' ? 'sent' : 'failed'
    } catch {
      return 'failed'
    }
  })
}
```

Notes for reviewers:
- `turnOnReminders` calls `requestPermission()` before its first `await`, and the Settings row calls `turnOnReminders` synchronously from the tap. iOS shows the prompt only from a user gesture; the first test checks the call happens synchronously.
- `subscribe` always gets `userVisibleOnly: true` (in `browserPush.ts`), which Safari requires.
- On, the setting is saved only after the server accepted the schedule, so a failure leaves nothing half on: the switch stays off and the new subscription is dropped.
- A subscription made with another key (for example the placeholder key, if anyone subscribed before Task 8) can't be reused or replaced while it exists: turning on unsubscribes it first, and a sync that finds one stops reminders so the owner turns them on again.

Run: `npx vitest run src/reminders/reminderStore.test.ts`
Expected: PASS, `Tests  26 passed (26)`.

- [ ] **Step 6: Write the failing end-to-end tests**

Append to the end of `e2e/helpers.ts`:

```ts

/** The push subscription `stubPush` hands out: an Apple endpoint and keys of the right sizes. */
export const FAKE_SUBSCRIPTION = {
  endpoint: 'https://web.push.apple.com/QGuQyavXutnMH-e2e',
  keys: { p256dh: `B${'A'.repeat(86)}`, auth: 'A'.repeat(22) },
}

/** Where `stubPush` keeps the subscription, so it survives reloads. Remove it to play iOS dropping it. */
export const FAKE_SUBSCRIPTION_KEY = 'e2e:push-subscription'

/**
 * Makes every later page load look like the installed Home Screen app with Web Push:
 * `navigator.standalone`, a Notification whose permission prompt answers `answer`, and a service
 * worker registration whose PushManager hands out FAKE_SUBSCRIPTION. (Real service workers are
 * blocked in these tests.)
 */
export async function stubPush(page: Page, { answer = 'granted' }: { answer?: NotificationPermission } = {}) {
  await page.addInitScript(
    ({ answer, subscription, storeKey }) => {
      const permissionKey = 'e2e:notification-permission'
      Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
      class FakeNotification {
        static get permission() {
          return localStorage.getItem(permissionKey) ?? 'default'
        }
        static async requestPermission() {
          localStorage.setItem(permissionKey, answer)
          return answer
        }
      }
      Object.defineProperty(window, 'Notification', { configurable: true, writable: true, value: FakeNotification })
      function FakePushManager() {}
      Object.defineProperty(window, 'PushManager', { configurable: true, writable: true, value: FakePushManager })
      // The subscription is stored as its application server key (base64), so a test can see which key made it.
      const subscriptionFor = (key: string) => ({
        endpoint: subscription.endpoint,
        expirationTime: null,
        options: {
          userVisibleOnly: true,
          applicationServerKey: Uint8Array.from(atob(key), (char) => char.charCodeAt(0)).buffer,
        },
        toJSON: () => ({ endpoint: subscription.endpoint, expirationTime: null, keys: subscription.keys }),
        unsubscribe: async () => {
          localStorage.removeItem(storeKey)
          return true
        },
      })
      const pushManager = {
        getSubscription: async () => {
          const key = localStorage.getItem(storeKey)
          return key === null ? null : subscriptionFor(key)
        },
        subscribe: async ({ applicationServerKey }: { applicationServerKey: Uint8Array }) => {
          const key = btoa(String.fromCharCode(...new Uint8Array(applicationServerKey)))
          localStorage.setItem(storeKey, key)
          return subscriptionFor(key)
        },
      }
      const registration = { pushManager }
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          ready: Promise.resolve(registration),
          register: async () => registration,
          controller: null,
          addEventListener() {},
          removeEventListener() {},
        },
      })
    },
    { answer, subscription: FAKE_SUBSCRIPTION, storeKey: FAKE_SUBSCRIPTION_KEY },
  )
}
```

Create `e2e/reminders.spec.ts`:

```ts
import { expect, test, type Page, type Route } from '@playwright/test'
import { addFriend, dayFromToday, FAKE_SUBSCRIPTION, FAKE_SUBSCRIPTION_KEY, goToTab, stubPush } from './helpers.ts'

interface ScheduleRequest {
  method: string
  contentType: string | undefined
  body: { subscription: unknown; reminders: { at: number; friendId: string }[] } | null
}

/** Answers /__reminders (with `status`) and /__reminders/test like the server, and records what the app sent. */
async function fakeServer(page: Page, status = 204) {
  const requests: ScheduleRequest[] = []
  const tests: string[] = []
  await page.route('**/__reminders', async (route: Route) => {
    const request = route.request()
    const isPut = request.method() === 'PUT'
    requests.push({
      method: request.method(),
      contentType: request.headers()['content-type'],
      body: isPut ? request.postDataJSON() : null,
    })
    await route.fulfill({ status })
  })
  await page.route('**/__reminders/test', async (route: Route) => {
    tests.push(route.request().method())
    await route.fulfill({ status: 204 })
  })
  return { requests, tests }
}

function remindersGroup(page: Page) {
  return page.getByRole('region', { name: 'Reminders' })
}

function reminderSwitch(page: Page) {
  return remindersGroup(page).getByRole('switch', { name: 'Birthday reminders' })
}

function storedSubscription(page: Page) {
  return page.evaluate((key) => localStorage.getItem(key), FAKE_SUBSCRIPTION_KEY)
}

/** 11:55 PM on the night before `date`, in this machine's time zone (which the browser shares). */
function nightBefore(date: { year: number; month: number; day: number }): number {
  return new Date(date.year, date.month - 1, date.day - 1, 23, 55).getTime()
}

test('asks for the Home Screen app in a Safari tab', async ({ page }) => {
  await page.goto('/#/settings')
  await expect(reminderSwitch(page)).toBeDisabled()
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'false')
  await expect(
    remindersGroup(page).getByText('Open Friend Tracker from your Home Screen to turn on reminders.'),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send a test notification' })).toHaveCount(0)
})

test('turns on, sends the schedule, and sends a test notification', async ({ page }) => {
  await stubPush(page)
  const server = await fakeServer(page)
  await page.goto('/')
  const birthday = dayFromToday(5)
  await addFriend(page, 'Alex Rivera', undefined, { month: birthday.month, day: birthday.day })
  await goToTab(page, 'Settings')
  await expect(remindersGroup(page).getByText('A notification at 11:55 PM the night before each birthday.')).toBeVisible()

  await reminderSwitch(page).click()
  await expect(page.getByRole('status')).toContainText('Birthday reminders are on')
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'true')
  await expect(
    remindersGroup(page).getByText("On. You'll get a note at 11:55 PM the night before each birthday."),
  ).toBeVisible()

  expect(server.requests).toHaveLength(1)
  const [put] = server.requests
  expect(put.method).toBe('PUT')
  expect(put.contentType).toContain('application/json')
  expect(put.body?.subscription).toEqual(FAKE_SUBSCRIPTION)
  const reminders = put.body?.reminders ?? []
  expect(reminders).toHaveLength(2)
  const [first, second] = reminders
  // Only a time and the friend's random id: never a name or a birthday.
  expect(Object.keys(first).sort()).toEqual(['at', 'friendId'])
  expect(first.friendId).toMatch(/^[0-9a-f-]{36}$/)
  expect(second.friendId).toBe(first.friendId)
  expect(first.at).toBe(nightBefore(birthday))
  const daysApart = (second.at - first.at) / 86_400_000
  expect(daysApart).toBeGreaterThan(364)
  expect(daysApart).toBeLessThan(367)

  await remindersGroup(page).getByRole('button', { name: 'Send a test notification' }).click()
  await expect(page.getByRole('status')).toContainText('Test notification sent')
  expect(server.tests).toEqual(['POST'])
})

test('turns off and deletes the schedule', async ({ page }) => {
  await stubPush(page)
  const server = await fakeServer(page)
  await page.goto('/#/settings')
  await reminderSwitch(page).click()
  await expect(page.getByRole('status')).toContainText('Birthday reminders are on')
  // A fresh start, as on another day (a second tap right away would count as a double tap).
  await page.reload()
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'true')

  await reminderSwitch(page).click()
  await expect(page.getByRole('status')).toContainText('Birthday reminders are off')
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'false')
  await expect(remindersGroup(page).getByText('A notification at 11:55 PM the night before each birthday.')).toBeVisible()
  await expect(remindersGroup(page).getByRole('button', { name: 'Send a test notification' })).toHaveCount(0)
  expect(server.requests.map((request) => request.method)).toEqual(['PUT', 'DELETE'])
  expect(await storedSubscription(page)).toBeNull()
})

test('explains how to allow notifications after a denial', async ({ page }) => {
  await stubPush(page, { answer: 'denied' })
  const server = await fakeServer(page)
  await page.goto('/#/settings')
  await reminderSwitch(page).click()
  await expect(
    remindersGroup(page).getByText(
      "Notifications are off for Friend Tracker. Turn them on in the iPhone's Settings app, under Notifications.",
    ),
  ).toBeVisible()
  await expect(reminderSwitch(page)).toBeDisabled()
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'false')
  expect(server.requests).toEqual([])
})

test('stays off when the schedule cannot be saved', async ({ page }) => {
  await stubPush(page)
  await fakeServer(page, 503)
  await page.goto('/#/settings')
  await reminderSwitch(page).click()
  await expect(page.getByRole('status')).toContainText("Couldn't turn on reminders. Please try again.")
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'false')
  expect(await storedSubscription(page)).toBeNull()
})

test('sends the schedule again when a birthday changes', async ({ page }) => {
  await stubPush(page)
  const server = await fakeServer(page)
  await page.goto('/#/settings')
  await reminderSwitch(page).click()
  await expect(page.getByRole('status')).toContainText('Birthday reminders are on')
  expect(server.requests[0].body?.reminders).toEqual([])

  await goToTab(page, 'Friends')
  const birthday = dayFromToday(10)
  await addFriend(page, 'Sam Chen', undefined, { month: birthday.month, day: birthday.day })
  // Sent about 2 seconds after the change.
  await expect.poll(() => server.requests.length, { timeout: 10_000 }).toBe(2)
  expect(server.requests[1].method).toBe('PUT')
  expect(server.requests[1].body?.reminders[0].at).toBe(nightBefore(birthday))
})

test('says when iOS stopped the reminders', async ({ page }) => {
  await stubPush(page)
  const server = await fakeServer(page)
  await page.goto('/#/settings')
  await reminderSwitch(page).click()
  await expect(page.getByRole('status')).toContainText('Birthday reminders are on')

  // iOS dropped the subscription, as it does after pushes that showed nothing.
  await page.evaluate((key) => localStorage.removeItem(key), FAKE_SUBSCRIPTION_KEY)
  await page.reload()
  await expect(remindersGroup(page).getByText('Reminders stopped. Turn them on again.')).toBeVisible({ timeout: 10_000 })
  await expect(reminderSwitch(page)).toHaveAttribute('aria-checked', 'false')
  expect(server.requests.map((request) => request.method)).toEqual(['PUT', 'DELETE'])
})
```

(`turns off and deletes the schedule` reloads between the two taps: a second tap on the same row within 300 ms of the first one's work counts as a double tap and is ignored.)

Run: `npx playwright test --project=iphone e2e/reminders.spec.ts`
Expected: `7 failed`: there's no Reminders group yet (`getByRole('region', { name: 'Reminders' })` finds nothing).

- [ ] **Step 7: The browser side and the sync hook**

Create `src/reminders/browserPush.ts`:

```ts
// The browser side of reminders: notification permission and the push subscription, which belongs
// to the service worker. On iPhone only the installed Home Screen app has Web Push.

import { isStandalone } from '../lib/platform'
import { scheduleApi } from './api'
import type { PushPort, ReminderDeps } from './reminderStore'
import type { PushSupport } from './types'

/** The service worker gets this long to be ready, so a missing worker can't leave a tap hanging. */
const READY_TIMEOUT_MS = 10_000

function registration(): Promise<ServiceWorkerRegistration> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error('The service worker is not ready.')), READY_TIMEOUT_MS)
    navigator.serviceWorker.ready.then(
      (ready) => {
        window.clearTimeout(timer)
        resolve(ready)
      },
      (error: unknown) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

export const browserPush: PushPort = {
  support(): PushSupport {
    const hasPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    if (!isStandalone() || !hasPush) return 'unavailable'
    return Notification.permission === 'denied' ? 'denied' : 'available'
  },
  requestPermission: () => Notification.requestPermission(),
  getSubscription: async () => (await registration()).pushManager.getSubscription(),
  subscribe: async (applicationServerKey) =>
    (await registration()).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey }),
}

export const browserReminderDeps: ReminderDeps = { push: browserPush, api: scheduleApi(), now: () => Date.now() }
```

Create `src/reminders/usePushSupport.ts`:

```ts
import { useCallback, useEffect, useState } from 'react'
import type { PushPort } from './reminderStore'
import type { PushSupport } from './types'

/**
 * Whether push works here, checked again whenever the app comes back to the foreground (the owner
 * may have changed notifications in the iPhone's Settings). The second value checks again now.
 */
export function usePushSupport(push: PushPort): [PushSupport, () => void] {
  const [support, setSupport] = useState(() => push.support())
  const recheck = useCallback(() => setSupport(push.support()), [push])
  useEffect(() => {
    document.addEventListener('visibilitychange', recheck)
    return () => document.removeEventListener('visibilitychange', recheck)
  }, [recheck])
  return [support, recheck]
}
```

Create `src/reminders/useReminderSync.ts`:

```ts
// Keeps the server's reminder schedule in step with the friends' birthdays: when the app opens,
// when it comes back to the foreground, and when a friend changes. Mounted once inside App, which
// only renders while the app is unlocked.

import { useEffect, useState } from 'react'
import { useFriends, useSetting } from '../data/hooks'
import { browserReminderDeps } from './browserPush'
import { syncReminders } from './reminderStore'

/** Sends this long after the last change, so a burst of edits sends once. */
export const SYNC_DEBOUNCE_MS = 2000

export function useReminderSync(): void {
  const settings = useSetting('birthdayReminders')
  const friends = useFriends()
  const [wakes, setWakes] = useState(0)
  // On, or off with a delete the server hasn't heard yet.
  const active = settings !== undefined && (settings.enabled || settings.lastError === 'delete')

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') setWakes((count) => count + 1)
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  // `friends` and `wakes` only trigger a sync, which reads everything fresh.
  useEffect(() => {
    if (!active || friends === undefined) return
    const timer = window.setTimeout(() => void syncReminders(browserReminderDeps), SYNC_DEBOUNCE_MS)
    return () => window.clearTimeout(timer)
  }, [active, friends, wakes])
}

/** Runs useReminderSync without re-rendering anything else when the friends change. */
export function ReminderSync(): null {
  useReminderSync()
  return null
}
```

(`ReminderSync` keeps the live friends query out of `App` itself, so a friend edit re-renders only this empty component, not the whole tree.)

In `src/App.tsx`, replace:

```tsx
import { ToastProvider } from './components/Toast'
```

with:

```tsx
import { ToastProvider } from './components/Toast'
import { ReminderSync } from './reminders/useReminderSync'
```

Replace:

```tsx
            <ScrollManager />
```

with:

```tsx
            <ScrollManager />
            <ReminderSync />
```

- [ ] **Step 8: A row that can be disabled**

In `src/components/InsetGroup.tsx`, replace:

```tsx
  /** Makes the row an on/off switch (a button with role "switch") showing a switch on the right. */
  switchOn?: boolean
```

with:

```tsx
  /** Makes the row an on/off switch (a button with role "switch") showing a switch on the right. */
  switchOn?: boolean
  /** Dims a button row and makes it unpressable (the group's footer says why). */
  disabled?: boolean
```

Replace:

```tsx
  switchOn,
  chevron,
  accent,
  destructive,
}: RowProps) {
```

with:

```tsx
  switchOn,
  disabled,
  chevron,
  accent,
  destructive,
}: RowProps) {
```

Replace:

```tsx
        onClick={onClick}
        role={switchOn === undefined ? undefined : 'switch'}
```

with:

```tsx
        onClick={onClick}
        disabled={disabled}
        role={switchOn === undefined ? undefined : 'switch'}
```

In `src/components/InsetGroup.css`, replace:

```css
.row--interactive:active {
  background: var(--surface-pressed);
}
```

with:

```css
.row--interactive:active:not(:disabled) {
  background: var(--surface-pressed);
}
.row:disabled {
  cursor: default;
}
.row:disabled .row__title {
  color: var(--ink-2);
}
.row:disabled .switch {
  opacity: 0.45;
}
```

(Warm Ink Secondary on Paper White is the footers' color, so the dimmed title still meets AA. The switch keeps `role="switch"` and `aria-checked`, and `disabled` makes VoiceOver say "dimmed".)

- [ ] **Step 9: The Settings group**

Create `src/reminders/RemindersSection.tsx`:

```tsx
import { useRef } from 'react'
import { InsetGroup, Row } from '../components/InsetGroup'
import { useToast } from '../components/Toast'
import { browserReminderDeps } from './browserPush'
import { reminderFooter } from './footer'
import { sendTestNotification, turnOffReminders, turnOnReminders } from './reminderStore'
import type { BirthdayReminders } from './types'
import { usePushSupport } from './usePushSupport'

/** How long after a tap's work is done that more taps on the same row are still ignored (a double tap). */
const TAP_GUARD_MS = 300

/**
 * Wraps a row's tap so it runs one at a time. The work starts right inside the tap, so iOS
 * still counts it as the tap when it shows the notification prompt.
 */
function useOneAtATime() {
  const busy = useRef(false)
  return (run: () => Promise<void>) => () => {
    if (busy.current) return
    busy.current = true
    void run().finally(() => {
      window.setTimeout(() => {
        busy.current = false
      }, TAP_GUARD_MS)
    })
  }
}

/** The "Reminders" group on the Settings screen. */
export function RemindersSection({ reminders }: { reminders: BirthdayReminders }) {
  const toast = useToast()
  const [support, recheckSupport] = usePushSupport(browserReminderDeps.push)
  const switchTap = useOneAtATime()
  const testTap = useOneAtATime()
  const usable = support === 'available'

  const toggle = switchTap(async () => {
    if (reminders.enabled) {
      await turnOffReminders(browserReminderDeps)
      toast({ message: 'Birthday reminders are off', tone: 'plain' })
      return
    }
    const result = await turnOnReminders(browserReminderDeps)
    if (result === 'on') toast({ message: 'Birthday reminders are on' })
    // The footer now says how to allow notifications.
    else if (result === 'denied') recheckSupport()
    else toast({ message: "Couldn't turn on reminders. Please try again.", tone: 'plain' })
  })

  const sendTest = testTap(async () => {
    const outcome = await sendTestNotification(browserReminderDeps)
    if (outcome === 'sent') toast({ message: 'Test notification sent' })
    else toast({ message: "Couldn't send a test notification. Please try again.", tone: 'plain' })
  })

  return (
    <InsetGroup title="Reminders" footer={reminderFooter(support, reminders)}>
      <Row title="Birthday reminders" switchOn={reminders.enabled} disabled={!usable} onClick={toggle} />
      {reminders.enabled && usable && <Row title="Send a test notification" accent onClick={sendTest} />}
    </InsetGroup>
  )
}
```

In `src/screens/SettingsScreen.tsx`, replace:

```tsx
import { usePasskeyAvailable } from '../lock/usePasskeyAvailable'
```

with:

```tsx
import { usePasskeyAvailable } from '../lock/usePasskeyAvailable'
import { RemindersSection } from '../reminders/RemindersSection'
```

Replace:

```tsx
  const appLock = useSetting('appLock')
```

with:

```tsx
  const appLock = useSetting('appLock')
  const birthdayReminders = useSetting('birthdayReminders')
```

Replace:

```tsx
  if (appLock === undefined || passkeyAvailable === undefined) return null
```

with:

```tsx
  if (appLock === undefined || passkeyAvailable === undefined || birthdayReminders === undefined) return null
```

Replace:

```tsx
        <Row to="/settings/types" title="Meetup types" trailing={meetupTypes.length} chevron />
      </InsetGroup>
```

with:

```tsx
        <Row to="/settings/types" title="Meetup types" trailing={meetupTypes.length} chevron />
      </InsetGroup>

      <RemindersSection reminders={birthdayReminders} />
```

Replace:

```tsx
          Everything you add stays on this iPhone. Nothing is sent anywhere. Open the app from its Home Screen icon:
          anything added in a Safari tab is kept separately. Export a backup now and then so you can restore it on a
          new phone.
```

with:

```tsx
          Everything you add stays on this iPhone. Nothing is sent anywhere, except the times for birthday reminders
          when they're on (never names). Open the app from its Home Screen icon: anything added in a Safari tab is kept
          separately. Export a backup now and then so you can restore it on a new phone.
```

- [ ] **Step 10: Run the end-to-end tests and see them pass**

Run: `npx tsc -b`
Expected: no output, exit code 0.

Run: `npx playwright test --project=iphone e2e/reminders.spec.ts`
Expected: `7 passed`.

- [ ] **Step 11: Screenshots of reminders on**

In `e2e/screenshots.spec.ts`, replace:

```ts
  setBirthday,
  stubFaceId,
} from './helpers.ts'
```

with:

```ts
  setBirthday,
  stubFaceId,
  stubPush,
} from './helpers.ts'
```

Replace:

```ts
async function captureLock(page: Page, prefix: string, largeText = false, faceId = false) {
```

with:

```ts
/** Settings with birthday reminders just turned on, as in the Home Screen app (push is faked). */
async function captureReminders(page: Page, prefix: string, largeText = false) {
  await stubPush(page)
  await page.route('**/__reminders', (route) => route.fulfill({ status: 204 }))
  await page.goto('/#/settings')
  if (largeText) await page.addStyleTag({ content: LARGE_TEXT })
  await page.getByRole('switch', { name: 'Birthday reminders' }).click()
  await expect(page.getByRole('status')).toContainText('Birthday reminders are on')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-11-reminders-on.png` })
}

async function captureLock(page: Page, prefix: string, largeText = false, faceId = false) {
```

Replace:

```ts
    test('lock screen', async ({ page }) => {
      await captureLock(page, scheme)
    })
  })
}
```

with:

```ts
    test('lock screen', async ({ page }) => {
      await captureLock(page, scheme)
    })

    test('reminders on', async ({ page }) => {
      await captureReminders(page, scheme)
    })
  })
}
```

Replace:

```ts
test('large text lock screen', async ({ page }) => {
```

with:

```ts
test('large text reminders on', async ({ page }) => {
  await captureReminders(page, 'large-text', true)
})

test('large text lock screen', async ({ page }) => {
```

Run: `npm run screenshots`
Expected: `14 passed`.

Open `e2e/screenshots/light-07-settings.png`, `dark-07-settings.png`, `large-text-07-settings.png`, `light-11-reminders-on.png`, `dark-11-reminders-on.png` and `large-text-11-reminders-on.png` with the Read tool and check:
- **`*-07-settings`** (a Safari tab, so push is unavailable): a "Reminders" group between Organize and Backup with one "Birthday reminders" row whose title is Warm Ink Secondary and whose switch is faded, and the footer "Open Friend Tracker from your Home Screen to turn on reminders.".
- **`*-11-reminders-on`:** the switch on (Peach track, thumb to the right), a Terracotta "Send a test notification" row under it, the footer "On. You'll get a note at 11:55 PM the night before each birthday.", and the "Birthday reminders are on" toast with its check.
- **Dark and large text:** everything readable; at large text the footer and the toast wrap instead of overflowing, and nothing runs past the 16px page margin.

If something is off, fix the markup or CSS from Steps 8 and 9, then run `npx playwright test --project=iphone e2e/reminders.spec.ts` and `npm run screenshots` again.

- [ ] **Step 12: Run everything**

Run: `npm test`
Expected: `Test Files  42 passed (42)` and `Tests  443 passed (443)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `93 passed`.

Run: `git status --short`
Expected: only the files listed for this task (the PNGs are ignored by git).

- [ ] **Step 13: Commit**

```bash
git add src/reminders src/db/settings.ts src/backup/storage.test.ts src/components/InsetGroup.tsx src/components/InsetGroup.css src/screens/SettingsScreen.tsx src/App.tsx e2e/helpers.ts e2e/reminders.spec.ts e2e/screenshots.spec.ts
git commit -F - <<'EOF'
feat: Birthday reminders switch in Settings, push subscription and schedule sync

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: The key script, the README, DESIGN.md and the spec's planning notes

**Files:**
- Create: `scripts/make-vapid-keys.ts`
- Modify: `README.md:11`, `:22`, `:30`, `:34`, `DESIGN.md:258`, `:300`, `:333`, `:348`, `docs/superpowers/specs/2026-10-03-birthday-reminders-design.md` (append)

- [ ] **Step 1: Write the key script**

Create `scripts/make-vapid-keys.ts`:

```ts
// Makes a new VAPID key pair for birthday reminders (see README.md, "Birthday reminders").
//
//   node scripts/make-vapid-keys.ts --out <file outside this repo>
//   node scripts/make-vapid-keys.ts --stdout | <a command that reads the key from its input>
//
// The public key goes into src/reminders/vapidKey.ts and reminders/wrangler.jsonc (commit both).
// The private key (a JWK) goes only where you send it: a new file outside this repo, or a pipe.
// It is never printed on the screen, and everything this script says goes to stderr.
// In Git Bash, --stdout can't tell a pipe from the screen, so use --out there.

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const KEY_MODULE = resolve(root, 'src/reminders/vapidKey.ts')
const WRANGLER_CONFIG = resolve(root, 'reminders/wrangler.jsonc')

function fail(message: string): never {
  console.error(message)
  console.error('Usage: node scripts/make-vapid-keys.ts --out <file outside this repo>')
  console.error('   or: node scripts/make-vapid-keys.ts --stdout | <a command that reads the key>')
  process.exit(2)
}

const [mode, target] = process.argv.slice(2)
let outFile: string | null = null
if (mode === '--out') {
  if (!target) fail('--out needs a file path.')
  outFile = resolve(target)
  const fromRoot = relative(root, outFile)
  if (!fromRoot.startsWith('..') && !isAbsolute(fromRoot)) fail('The private key must not go inside the repo.')
  if (existsSync(outFile)) fail(`${outFile} already exists. Pick a new file.`)
} else if (mode === '--stdout') {
  if (process.stdout.isTTY) fail('--stdout only writes into a pipe, never onto the screen.')
} else {
  fail('Say where the private key goes.')
}

const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey)).toString('base64url')
const privateJwk = JSON.stringify(await crypto.subtle.exportKey('jwk', pair.privateKey))

const wrangler = readFileSync(WRANGLER_CONFIG, 'utf8')
const keyVar = /"VAPID_PUBLIC_KEY": "[^"]*"/
if (!keyVar.test(wrangler)) fail('reminders/wrangler.jsonc has no "VAPID_PUBLIC_KEY" var to update.')

// The private key first: if that fails, the public key in the repo is still the old one.
if (outFile) writeFileSync(outFile, privateJwk, { flag: 'wx', mode: 0o600 })
else process.stdout.write(privateJwk)

writeFileSync(
  KEY_MODULE,
  `// The VAPID public key (the "application server key") that birthday reminder pushes are signed with.
// It isn't secret. scripts/make-vapid-keys.ts made it and wrote the same key into reminders/wrangler.jsonc;
// its private half is the reminders Worker's VAPID_PRIVATE_KEY secret.
export const VAPID_PUBLIC_KEY = '${publicKey}'
`,
)
writeFileSync(WRANGLER_CONFIG, wrangler.replace(keyVar, `"VAPID_PUBLIC_KEY": "${publicKey}"`))

console.error(`New public key: ${publicKey}`)
console.error('Updated src/reminders/vapidKey.ts and reminders/wrangler.jsonc. Commit both.')
if (outFile) console.error(`The private key is in ${outFile}. Delete it once it's the Worker's secret.`)
```

How it keeps the private key off the screen:
- With no option it refuses, so the default never prints a key.
- `--out` writes a new file (`wx`: never over an existing one) and refuses any path inside the repo, so the key can't be committed by accident.
- `--stdout` writes the JWK and nothing else to standard output, and refuses when standard output is a terminal. Every message goes to standard error. (Git Bash runs Node through pipes, so there it can't tell a pipe from the screen. Task 8 uses `--out` for that reason.)
- The private key is written first: if that fails, the repo still has the old public key.

- [ ] **Step 2: Try it, then put the placeholder back**

Run:

```bash
npx tsc -b
node scripts/make-vapid-keys.ts; echo "exit $?"
node scripts/make-vapid-keys.ts --out ./inside.json; echo "exit $?"
KEYDIR="$(mktemp -d)"
node scripts/make-vapid-keys.ts --out "$KEYDIR/vapid-private-key.json"; echo "exit $?"
node scripts/make-vapid-keys.ts --out "$KEYDIR/vapid-private-key.json"; echo "exit $?"
node -e "const k = JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8')); console.log(k.kty, k.crv, typeof k.d)" "$KEYDIR/vapid-private-key.json"
npx vitest run src/reminders/vapidKey.test.ts
git diff --stat
```

Expected, in order: `tsc -b` prints nothing; `Say where the private key goes.` with the usage lines and `exit 2`; `The private key must not go inside the repo.` and `exit 2`; `New public key: B…` (87 characters), `Updated src/reminders/vapidKey.ts and reminders/wrangler.jsonc. Commit both.`, `The private key is in C:\Users\…\vapid-private-key.json. Delete it once it's the Worker's secret.` and `exit 0`; `… already exists. Pick a new file.` and `exit 2`; `EC P-256 string`; `Tests  2 passed (2)` (the new key has the right format and matches `reminders/wrangler.jsonc`); and `git diff --stat` lists only `reminders/wrangler.jsonc` and `src/reminders/vapidKey.ts`. No key was printed: the JWK only went into the file.

This was only a try. Put the placeholder back and delete the throwaway key:

```bash
git checkout -- src/reminders/vapidKey.ts reminders/wrangler.jsonc
rm -r "$KEYDIR"
git status --short
```

Expected: `git status --short` lists only `?? scripts/make-vapid-keys.ts`.

- [ ] **Step 3: Document reminders in the README**

In `README.md`, replace:

```markdown
5. Back up now and then: **Settings → Export backup** → Save to Files (iCloud Drive).
```

with:

```markdown
5. Optional: **Settings → Reminders → Birthday reminders** sends a notification at 11:55 PM the night before each friend's birthday. Turn it on from the Home Screen icon and tap **Allow**, then tap **Send a test notification** to see one arrive. The limits are under "Birthday reminders" below.
6. Back up now and then: **Settings → Export backup** → Save to Files (iCloud Drive).
```

Replace:

```markdown
  - KV namespace binding `LOGIN_ATTEMPTS`: failed sign-ins. Ten wrong tries pause sign-in for 15 minutes.
```

with:

```markdown
  - KV namespace binding `LOGIN_ATTEMPTS`: failed sign-ins. Ten wrong tries pause sign-in for 15 minutes.
  - Service binding `REMINDERS` → the Worker `friend-tracker-reminders` (Production only): birthday reminders. Without it, `/__reminders` answers 503 and reminders can't be turned on.
- Settings → Runtime → Compatibility date: 2024-04-03 or later, so the Functions can call the reminders Worker's methods (RPC).
```

Replace:

```markdown
## Develop
```

with:

```markdown
## Birthday reminders

iPhone web apps can't schedule a notification themselves, so a small Cloudflare Worker sends each one as a Web Push.

- When reminders are on, the app sends its push subscription and a list of times to `PUT /__reminders` (behind the website password): 11:55 PM, in the phone's time zone, on the night before each friend's next two birthdays, each with the friend's random id. It sends the list again when a birthday changes, and at least once a week.
- `functions/__reminders.ts` (the logic is `server/reminders.ts`) checks the request and passes it to the Worker through the `REMINDERS` service binding.
- The Worker (`reminders/`, named `friend-tracker-reminders`) keeps the list in one Durable Object and wakes at each time with an alarm. The push says only `{"kind":"birthday"}`, encrypted (RFC 8291) and signed with VAPID (RFC 8292) by `@block65/webcrypto-web-push`. The Worker has no web address (`workers_dev` is off): only the binding reaches it.
- On the phone, the service worker (`src/sw.ts`, `src/sw/push.ts`) looks up whose birthday it is in the app's own data and shows "🎂 Alex's birthday starts in 5 minutes".

Setup (once):

1. `node scripts/make-vapid-keys.ts --out <a new file outside this folder>` makes the VAPID key pair. It writes the public key into `src/reminders/vapidKey.ts` and `reminders/wrangler.jsonc` (commit both) and the private key (a JWK) into that file only. Never commit or print the private key.
2. `npx --yes wrangler@4.147.0 login`, then `npx --yes wrangler@4.147.0 deploy --config reminders/wrangler.jsonc`.
3. `npx --yes wrangler@4.147.0 secret put VAPID_PRIVATE_KEY --config reminders/wrangler.jsonc < <that file>`, then delete the file.
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
```

Replace:

```markdown
    npm test              # unit tests (app and server)
```

with:

```markdown
    npm test              # unit tests (app, server and the reminders Worker)
```

- [ ] **Step 4: Document the Reminders group in DESIGN.md**

In `DESIGN.md`, replace:

```markdown
input text (never below 16px, so iOS doesn't zoom), and the lock screen's keypad and the Face ID switch (listed under "Lock screen and PIN pad").
```

with:

```markdown
input text (never below 16px, so iOS doesn't zoom), and the lock screen's keypad and the Settings switches (listed under "Lock screen and PIN pad").
```

Replace:

```markdown
- **Press:** Linen Pressed background over 160ms. Accent rows use Terracotta Ink titles; destructive rows use Danger Red.
```

with:

```markdown
- **Press:** Linen Pressed background over 160ms. Accent rows use Terracotta Ink titles; destructive rows use Danger Red.
- **Switch rows:** a button with `role="switch"` and the 51×31px switch at the end (Face ID, Birthday reminders). One that can't be used here is disabled: its title turns Warm Ink Secondary, the switch fades to 45%, it has no press state, and the group's footer says why.
```

Replace:

```markdown
### Stat row
One Paper White group
```

with:

```markdown
### Reminders group
The "Reminders" inset group in Settings, right after Organize: a "Birthday reminders" switch row and, while it's on, a "Send a test notification" accent row. The footer says in plain words what the switch does, that it's on, or why it can't be used: "A notification at 11:55 PM the night before each birthday.", "On. You'll get a note at 11:55 PM the night before each birthday." (plus "Couldn't update reminders just now. The app will try again next time it opens." after a failed update), "Open Friend Tracker from your Home Screen to turn on reminders.", "Notifications are off for Friend Tracker. Turn them on in the iPhone's Settings app, under Notifications.", or "Reminders stopped. Turn them on again.". Toasts: "Birthday reminders are on" and "Test notification sent" with the check; "Birthday reminders are off", "Couldn't turn on reminders. Please try again." and "Couldn't send a test notification. Please try again." plain.
- **The notification** is drawn by iOS: "🎂 Alex's birthday starts in 5 minutes" over "Send them a message.", one per night, naming everyone whose birthday it is ("🎂 Alex and Sam: birthdays at midnight"). Tapping it opens that friend, or the Friends tab for several. When the app can't tell who, it says "🎂 A birthday is coming up" and "Open Friend Tracker to see who.".

### Stat row
One Paper White group
```

Replace:

```markdown
the 14px dots, and the 51×31px Face ID switch in Settings stay in pixels.
```

with:

```markdown
the 14px dots, and the 51×31px switches in Settings (Face ID, Birthday reminders) stay in pixels.
```

- [ ] **Step 5: Record the planning decisions in the spec**

Append to the end of `docs/superpowers/specs/2026-10-03-birthday-reminders-design.md`:

```markdown

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
```

- [ ] **Step 6: Run every check**

Run: `npm test`
Expected: `Test Files  42 passed (42)` and `Tests  443 passed (443)`.

Run: `npm run build`
Expected: `tsc -b` passes (it type-checks `scripts/make-vapid-keys.ts` with `tsconfig.node.json`) and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `93 passed`.

Run: `grep -n '—' README.md DESIGN.md docs/superpowers/specs/2026-10-03-birthday-reminders-design.md scripts/make-vapid-keys.ts src/reminders/*.ts src/reminders/*.tsx src/sw/*.ts src/lib/reminders.ts server/reminders.ts reminders/src/*.ts`
Expected: no output (no em dashes in anything this plan added; the pre-existing docs have none either).

- [ ] **Step 7: Commit**

```bash
git add scripts/make-vapid-keys.ts README.md DESIGN.md docs/superpowers/specs/2026-10-03-birthday-reminders-design.md
git commit -F - <<'EOF'
docs: birthday reminders setup, limits and design; VAPID key script

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 8: Roll out (controller with the owner)

**Not subagent work.** The controller runs the commands and guides the owner through the steps marked **Owner**, waiting for the owner to confirm each one. Rules:
- Ask before each step that changes something outside this repo (the Cloudflare account, the Pages project, pushing to `main`).
- The VAPID private key goes from the key script into a file outside the repo, from there into `wrangler secret put` through standard input, and is then deleted. Never `cat` it, print it, paste it, or commit it. Never ask the owner to paste the website password into the chat.
- Each Bash call starts a fresh shell, so the commands below use one fixed path for the key file: `/tmp/friend-tracker-vapid-private-key.json` (Git Bash's `/tmp` is the Windows temp folder, outside the repo).
- The owner's Cloudflare account also has the unrelated "spin-wheel" Worker. Don't touch it. The new Worker is `friend-tracker-reminders`.

**Files:**
- Modify: `src/reminders/vapidKey.ts`, `reminders/wrangler.jsonc` (the real public key, Step 2)

- [ ] **Step 1: Check that everything is green and committed**

```bash
git status --short
git log --oneline main..feature/birthday-reminders
npm test
npm run build
npm run e2e
grep -c PLACEHOLDER src/reminders/vapidKey.ts
```

Expected: `git status` prints nothing. The log shows the design and plan commits and the seven task commits (plus any review fixes). `npm test` shows `Test Files  42 passed (42)` and `Tests  443 passed (443)`, the build passes, `npm run e2e` shows `93 passed`, and the placeholder is still there (`1`).

- [ ] **Step 2: Make the real VAPID keys and commit the public key**

```bash
rm -f /tmp/friend-tracker-vapid-private-key.json
node scripts/make-vapid-keys.ts --out /tmp/friend-tracker-vapid-private-key.json
grep -c PLACEHOLDER src/reminders/vapidKey.ts
npx vitest run src/reminders/vapidKey.test.ts
git diff --stat
```

Expected: `New public key: B…` (87 characters), `Updated src/reminders/vapidKey.ts and reminders/wrangler.jsonc. Commit both.` and `The private key is in C:\Users\luald\AppData\Local\Temp\friend-tracker-vapid-private-key.json. Delete it once it's the Worker's secret.`; then `0` (no placeholder left); `Tests  2 passed (2)` (the key's format, and the same key in `reminders/wrangler.jsonc`); and only those two files changed.

```bash
git add src/reminders/vapidKey.ts reminders/wrangler.jsonc
git commit -F - <<'EOF'
chore: VAPID public key for birthday reminders

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

If the key file is lost before Step 5, run this step again (it makes a new pair and replaces the committed public key) before deploying.

- [ ] **Step 3 (Owner): Sign Wrangler in to Cloudflare**

In a PowerShell window in the project folder, the owner runs:

```powershell
npx --yes wrangler@4.147.0 login
```

The browser opens a Cloudflare page; the owner signs in if asked and selects **Allow**. The terminal then says `Successfully logged in.`

Controller check:

```bash
npx --yes wrangler@4.147.0 whoami
```

Expected: `You are logged in with an OAuth Token, associated with the email …` and a table with the owner's account. (Wrangler keeps the token in the Windows user's profile, so the controller's shell sees it too.)

- [ ] **Step 4: Deploy the Worker**

Ask the owner first, then run:

```bash
npx --yes wrangler@4.147.0 deploy --config reminders/wrangler.jsonc
```

Expected: the bindings list shows `env.SCHEDULE (ReminderSchedule)` as a Durable Object and the `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` variables; then `Uploaded friend-tracker-reminders`, a note that it has no deploy targets (no `workers.dev` URL and no routes, which is intended: only the Pages binding will reach it), and `Current Version ID: …`. The `v1` migration creates the SQLite-backed `ReminderSchedule` class, which the free plan requires.

If Wrangler asks to register a `workers.dev` subdomain, answer no: the Worker must not have a URL.

- [ ] **Step 5: Give the Worker its private key, then delete the file**

```bash
npx --yes wrangler@4.147.0 secret put VAPID_PRIVATE_KEY --config reminders/wrangler.jsonc < /tmp/friend-tracker-vapid-private-key.json
npx --yes wrangler@4.147.0 secret list --config reminders/wrangler.jsonc
rm /tmp/friend-tracker-vapid-private-key.json
ls /tmp/friend-tracker-vapid-private-key.json
```

Expected: `✨ Success! Uploaded secret VAPID_PRIVATE_KEY` (Wrangler reads the value from standard input and doesn't print it), then a list containing `VAPID_PRIVATE_KEY`, and finally `ls: cannot access ...: No such file or directory`. The private key now exists only as the Worker's secret.

- [ ] **Step 6: Merge and push**

Ask the owner first, then:

```bash
git checkout main
git merge --ff-only feature/birthday-reminders
git push origin main
```

Expected: a fast-forward merge and a successful push. Cloudflare Pages builds (`npm test && npm run build`) and deploys. **Owner:** open **Workers & Pages → friend-tracker → Deployments** and wait for the new Production deployment to show **Success**. Until Step 7 is done, `/__reminders` answers 503 and the app can't turn reminders on.

- [ ] **Step 7 (Owner): Bind the Worker to the Pages project and redeploy**

In the Cloudflare dashboard, **Workers & Pages → friend-tracker → Settings**, with the **Production** environment selected:
1. **Bindings → Add → Service binding**: **Variable name** `REMINDERS`, **Service** `friend-tracker-reminders`, entrypoint left as the default. **Save**.
2. **Runtime → Compatibility date**: check that it's `2024-04-03` or later (calling the Worker's methods over the binding needs that). If it's earlier, set it to `2026-10-01` and save.
3. **Deployments → (the latest Production deployment) → ⋯ → Retry deployment**, and wait for **Success**. Bindings apply only to new deployments.

- [ ] **Step 8: Check the live site**

Controller:

```bash
node scripts/verify-live.ts https://friend.aldenlu.com/
```

Expected:

```text
ok 1 - a signed-out page load goes to the sign-in page
ok 2 - a signed-out file request gets 401 and nothing else
ok 3 - the sign-in page is served with the security headers
ok 4 - a wrong password is refused
ok 5 - a sign-in from another site is refused without being counted
ok 6 - the password check needs a signed-in session
ok 7 - the reminders endpoint needs a signed-in session
ok 8 - Safari shows the sign-in page first
Set FT_PASSWORD to also check signing in.
All 8 checks passed.
```

Owner, in their own PowerShell window in the project folder (the password is typed hidden and never lands in the shell history):

```powershell
$secure = Read-Host 'Website password' -AsSecureString
$env:FT_PASSWORD = [System.Net.NetworkCredential]::new('', $secure).Password
node scripts/verify-live.ts https://friend.aldenlu.com/
Remove-Item Env:FT_PASSWORD
```

Expected: `ok 1` to `ok 14`, ending with `All 14 checks passed.` (check 13 is `the reminders endpoint is set up (the Worker is bound)`). The owner reports only that last line, or the failing check's message.

If a check fails:
- 13 fails with `503` and "Birthday reminders aren't set up yet.": the `REMINDERS` binding is missing from Production, or Step 7's redeploy didn't happen.
- 7 fails with a `403` "Just a moment..." page: a Cloudflare challenge is on for the zone again (see the README's Hosting notes).

- [ ] **Step 9 (Owner): Turn reminders on and send a test notification**

On the iPhone:
1. Open **Friend Tracker from the Home Screen icon** (not Safari). If it was already open, swipe it away in the app switcher and open it again, twice if needed, so the new version is running: **Settings** now has a **Reminders** group between Organize and Backup.
2. Tap **Birthday reminders**. iOS asks whether Friends may send notifications: tap **Allow**. Expect the toast "Birthday reminders are on" and the footer "On. You'll get a note at 11:55 PM the night before each birthday.".
3. Tap **Send a test notification**. Expect the toast "Test notification sent", and within a few seconds the notification "🎂 Reminders work", "You'll get a note at 11:55 PM before each birthday.". Lock the phone and send one more to see it on the lock screen.
4. Tap the notification: the app opens on Settings.

If it doesn't work:
- The switch is dimmed with "Open Friend Tracker from your Home Screen to turn on reminders.": the app was opened in Safari, or iOS is older than 16.4.
- "Notifications are off for Friend Tracker…": iPhone **Settings → Notifications → Friends → Allow Notifications**, then back in the app turn reminders on.
- "Couldn't turn on reminders. Please try again.": run Step 8 again (a 503 means the binding; a 502 means the Worker failed).
- "Couldn't send a test notification. Please try again.": open **Workers & Pages → friend-tracker-reminders → Observability (Logs)**. "VAPID_PRIVATE_KEY is not the private key for VAPID_PUBLIC_KEY." means the secret and the committed key differ: redo Steps 2, 4, 5 and 6, then on the iPhone turn reminders off and on. A 403 from Apple's push service means Apple refused the VAPID token (check `VAPID_SUBJECT` in `reminders/wrangler.jsonc` is `https://friend.aldenlu.com`).

- [ ] **Step 10 (Owner): One real reminder tonight**

1. In the app, add a friend named "Reminder test" (or edit a real friend) with tomorrow's date as the birthday, no year. Keep the app open for about 5 seconds after saving, so the schedule is sent (it goes 2 seconds after the change).
2. At **11:55 PM tonight**, expect "🎂 Reminder test's birthday starts in 5 minutes" and "Send them a message.". Tapping it opens that friend's page.
3. Tomorrow, delete "Reminder test" (or put the real birthday back) and open the app once, so the schedule is updated.

If nothing arrives: check Focus and Low Power Mode on the phone, then the Worker's logs around 11:55 PM local time for the alarm and the push service's answer. A 404 or 410 there means the subscription is gone; the app then says "Reminders stopped. Turn them on again." the next time it opens.

- [ ] **Step 11: Report**

Tell the owner what was verified (the live checks, the test notification, the real reminder) and anything that needs a follow-up. Nothing in this task changes the repo after Step 2's commit.

---

## Spec coverage

| Spec requirement | Where |
| --- | --- |
| 11:55 PM the night before, "🎂 Alex's birthday starts in 5 minutes" | Task 1 (`reminderTime`, `birthdayNotice`), Task 3 |
| Web Push from a server; Home Screen app only; every push shows a notification | Tasks 3, 4, 6 (`browserPush.support`), Task 3 (`onPush`) |
| Server never learns names: only `{ at, friendId }` and `{ "kind" }` payloads | Task 1 (`Reminder`), Task 4 (`pushSender`), Task 5 (only known fields passed on), Task 6 e2e (PUT body has only `at` and `friendId`) |
| Worker `reminders/`: `workers_dev: false`, no routes, one SQLite Durable Object (`new_sqlite_classes`), free plan | Task 4 (`wrangler.jsonc`) |
| `WorkerEntrypoint` RPC to the DO `idFromName('owner')`: `sync`, `clear`, and the test push (`sendTest`, decision 1) | Task 4 (`index.ts`) |
| Storage: subscription and up to 1,000 `{ at, friendId }` | Task 4 (`Schedule`), Task 5 (limit), Task 1 (`MAX_REMINDERS`) |
| `alarm()`: due within 30 s, one push per minute, 2xx removes, 404/410 clears, 429/5xx retries in 60 s until 30 min late, next alarm at the next `at`, errors caught and rescheduled | Task 4 (`sendDue`, `alarm`, tests) |
| RFC 8291 `aes128gcm` payload, VAPID RFC 8292: ES256, `aud` = endpoint origin, `exp` ≤ 12 h, `sub` `https://friend.aldenlu.com`, `Authorization: vapid t=…, k=…`, `TTL: 10800`, `Urgency: high` | Task 4 (`push.ts`, `push.test.ts` with the RFC 8291 Appendix A check) |
| Secret `VAPID_PRIVATE_KEY` (JWK), vars `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT` | Task 4 (`wrangler.jsonc`, `vapidKeys`), Task 8 Steps 2 and 5 |
| `functions/__reminders.ts`: PUT → sync, DELETE → clear, POST `/__reminders/test` → test push, 204 | Task 5 |
| Same-origin (403), JSON (415), push host allowlist (400), limits (400), missing binding 503 "Birthday reminders aren't set up yet.", the gate's headers | Task 5 (`handleReminders`, tests) |
| Behind the existing gate | Task 5 (tests through `handleRequest`; `verify-live` check 7) |
| Service worker on `injectManifest` with the same precache, cleanup, `/__` deny list, skipWaiting, clientsClaim, `useCredentials` manifest | Task 2 (and its e2e checks) |
| `push`: inside `waitUntil`, exactly one notification; test text; birthday text for one, several, after midnight; fallback; tag `birthday-<date>`; `data.url` | Task 3 (`onPush`), Task 1 (`birthdayNotice`, `TEST_NOTICE`, `fallbackNotice`) |
| Feb 29 counts as Feb 28 in other years | Task 1 (`reminderTime`, `birthdaysOn`) |
| `notificationclick`: focus a window and navigate, or open one | Task 3 (`openApp`, `onNotificationClick`) |
| Setting `birthdayReminders { enabled, lastSyncedHash, lastSyncedAt, lastError }`, not in backups, kept on import | Task 6 Step 1 |
| Settings "Reminders" group: switch row (`role="switch"`), the five footers, "Send a test notification" | Task 6 (`RemindersSection`, `reminderFooter`, e2e) |
| Turning on: permission from the tap, `subscribe({ userVisibleOnly: true, applicationServerKey })` with the committed key, sync, toast "Birthday reminders are on"; failure toast; denial footer | Task 6 (`turnOnReminders`, `browserPush`, e2e) |
| Turning off: unsubscribe, DELETE, `enabled: false` even if the DELETE fails (retried later) | Task 6 (`turnOffReminders`, `syncNow`) |
| `useReminderSync` in `App` (only while unlocked): on open, on becoming visible, on birthday changes; next 2 occurrences; past skipped; hash or 7 days; 2 s debounce; revoked subscription; failed sync sets `lastError` without a toast | Task 6 (`useReminderSync`, `reminderStore`), Task 1 (`buildReminders`, `scheduleHash`) |
| Pure logic in `src/lib/reminders.ts`, unit tested with fixed dates (DST, Feb 29, Dec 31, past cut-off) | Task 1 |
| Setup: keys script (public committed, private never printed), `wrangler login`, deploy, secret via stdin, Pages service binding, redeploy, verify-live (401, never 503), iPhone test | Task 7 (script), Task 8 |
| README honest limits | Task 7 |
| Unit tests (app, Worker), e2e (Home Screen message, switch flow with stubs, PUT body, PWA tests still pass) | Tasks 1 to 6 |
| On device: test notification, a real reminder | Task 8 Steps 9 and 10 |
