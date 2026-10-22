# Friends First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ] `) syntax for tracking.

**Goal:** Make the app open on people, keep the keyboard's small window free for writing, put photos where a memory is read, and make it hard to lose data by accident: search and the chips at the top of the Friends tab with Birthdays soon as one swipeable row and Recent meetups as one row; toasts that belong to their page and none on the day page, which says "Logged with …" in its own note and gives The day room to write; photos always on the Meetup page, added and saved right there with Undo; and backups that say what's new, a quiet dot that suggests one, an import confirm that compares the backup with the app, and Undo for a restore.

**Architecture:** `ToastProvider` clears a toast on a push and drops one asked for on the day page (`isDayPage` in `src/lib/routes.ts`). The Friends tab moves `.friends-filters` up and draws Birthdays soon as a `.snap-strip` of tiles (`shortName`, `describeBirthdayCountdown`) and Recent meetups as one `MeetupRow` with an `InsetGroup` `action`. The day page reads `logged` from its router state for the Logged note, whose spent Undo `src/lib/loggedUndo.ts` remembers, and `useRevealFocusedField` learns `data-reveal="start"` (with the existing `topOffset`). `addMeetupPhoto` and `removeMeetupPhotos` save and undo page photos reading only index keys, `photoThumbs` takes thumbnails from the cache, and `usePhotoAdder` and `PhotoAddTile` are shared by the sheet and the page. `src/backup/nudge.ts` and `useBackupDot` decide the Settings tab's dot; `describeImport` builds the import confirm; Dexie version 4 adds the `restoreUndo` store that `restoreBackup`, `undoRestore` and `forgetOldRestore` keep for 7 days. The backup file stays at version 5.

**Tech Stack:** Vite 8, React 19, TypeScript 6 (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`), react-router 7 (HashRouter), Dexie 4 with dexie-react-hooks, Vitest 5 with fake-indexeddb (TZ America/Los_Angeles), Playwright WebKit (iPhone 13, port 4174, service workers blocked).

---

**Spec:** [docs/superpowers/specs/2026-10-21-friends-first-design.md](../specs/2026-10-21-friends-first-design.md), the source of truth (approved: "Looks good", "Auto approve"). It was drafted before the sheet-details batch merged into `main`; where the two touch, this plan follows `main` as it is (see the spec's "Decisions made while building"). Design context: [DESIGN.md](../../../DESIGN.md) (sections 2, 5 and 6), [PRODUCT.md](../../../PRODUCT.md).

## Ground rules for every task

- Run every command from the project root in Git Bash: `/c/Users/luald/OneDrive/Desktop/Friend tracker`. The branch `feature/friends-first` is already checked out, on top of `main`.
- TypeScript: type-only imports use `import type` or an inline `type` specifier; no enums, namespaces or constructor parameter properties; no unused locals or parameters. Test files under `src/` and everything in `e2e/` are type-checked by `npm run build`. Keep lines within about 120 characters.
- Import paths are extensionless inside `src/`. Inside `e2e/`, local files are imported with `.ts` (`./helpers.ts`).
- Copy (UI text, comments, docs) never uses em dashes. Use commas, colons, periods or parentheses.
- **One schema change, in Task 7.** Dexie version 4 adds the `restoreUndo` store and changes nothing else, so there's no upgrade step and nothing new runs in the service worker. Upgrades stay free of `window` and `document`. The backup file stays at version 5.
- Never run `npm run dev`, `npm run preview`, `vite preview` or wrangler yourself. `npm run e2e` and `npm run screenshots` build and start their own preview server on port 4174; only one Playwright run at a time.
- Commands:
  - Unit tests: `npm test` (one file: `npx vitest run <path>`)
  - Type check and production build: `npm run build` (quick type check only: `npx tsc -b`)
  - End-to-end tests: `npm run e2e` (one file: `npx playwright test --project=iphone <path>`)
  - Screenshots: `npm run screenshots`
- Baseline before Task 1: `npm test` shows `Test Files  60 passed (60)` and `Tests  749 passed (749)`; `npm run e2e` shows `200 passed`; `npm run screenshots` shows `15 passed`. Each task states the new totals, measured by building this plan task by task in a clone of the branch. The full e2e runs after Tasks 1, 2, 4, 7 and 8; Tasks 3, 5 and 6 run the e2e files they touch.
- **A known machine flake:** under 4-worker load an unrelated e2e test can stall (a click that waits for an element to be stable). Re-run that file alone (`npx playwright test --project=iphone <file>`) and note it.
- **Screenshots are not committed.** `e2e/screenshots` is in `.gitignore`; look at the PNGs locally and never `git add` them.
- **Shell escapes:** when an edit's text holds `\n` or `\b`, make it with an editor or a script file, not a shell one-liner, which can collapse the backslashes.
- Commit after each task with the exact `git add` paths and message given. Every commit message ends with a blank line and then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Decisions made while building

The spec records these at its end ("Decisions made while building"), in Task 8.

1. **Toasts belong to their page:** a push clears the toast (and `--toast-space`); a pop or a replace keeps it; a toast asked for on the day page is dropped. Two detail tests that read the "Logged" toast on the opened meetup now expect it gone.
2. **Build order:** Task 1 stops the "Save and write about the day" toast; the Logged note comes in Task 3. The import confirm's "You can undo this in Settings for 7 days." comes with the undo (Task 7).
3. **The Logged note's Undo ends for good** at the first change (typing, a weather chip, a face, or tapping @ Place, Now or Paid), remembered for the session (`src/lib/loggedUndo.ts`), so the note shows again after the app lock or a reload but without Undo once something changed. A spent Undo is `visibility: hidden`, so its room stays.
4. **`topOffset` is the spec's `alignTopOffset`:** the sheet-details batch already added it, with the same math and tests. `data-reveal="start"` aligns only on the first shrink after the keyboard comes up.
5. **`.snap-strip`** holds the scroller the Who strip and Birthdays soon share; each keeps its own layout and snap strictness.
6. **Birthdays soon** is a `ul role="list"` of links named by `aria-label`; `shortName` ignores the friend itself by identity.
7. **"See all"** is `InsetGroup`'s `action`; its hit area is a `::before` from the row's top edge upward.
8. **"The search field stays put"** reads the friend list as the last `.inset-group`.
9. **`addMeetupPhoto` caches the new thumbnail,** so a page add reads no image at all; `usePhotoAdder` adds `onBusyChange` and `onDone(ids)`.
10. **The Settings tab is named by `aria-label`** while the dot shows (hidden words gave "Settings , backup suggested").
11. **Backup days are calendar days;** a restore's 7 days are exact time.
12. **Restore:** `replaceAllData` and `restoreBackup` share `writeAllData`; photos are copied 20 at a time both ways; `forgetOldRestore` also clears rows no setting names; `Row` gains `subtitleDescribes`.
13. **Dexie 4.4 opens a database newer than it declares,** so a service worker still on version 3 reads friends from a version 4 database (tested).
14. **Screenshots** are numbered 25 to 30 (21 to 24 are taken).

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/components/Toast.tsx` / `.css` | Modify | A push clears the toast; none on the day page; the shared check |
| `src/lib/routes.ts` / `.test.ts` | Create | `isDayPage` |
| `src/components/TabBar.tsx` / `.css` | Modify | `isDayPage`; `TabBarItems`; the backup dot |
| `src/components/Page.tsx` | Modify | `NavState.logged` |
| `src/sheets/MeetupSheet.tsx` / `.css` | Modify | "Save and write about the day" without a toast; the Who strip on `.snap-strip` |
| `src/screens/FriendsScreen.tsx` / `.css` | Modify | Search first, Birthdays soon tiles, one recent meetup, no scroll correction |
| `src/components/InsetGroup.tsx` / `.css` | Modify | `action` ("See all"); `Row`'s `subtitleDescribes` |
| `src/lib/text.ts` / `.test.ts` | Modify | `firstName`, `shortName`; `describeBackup` with `meetupsSince` |
| `src/lib/payers.ts` / `.test.ts` | Modify | `payerLabel` replaced by `shortName` |
| `src/lib/birthdays.ts` / `.test.ts` | Modify | `describeBirthdayCountdown` |
| `src/stats/meetupHistory.ts` / `.test.ts` | Modify | `RECENT_MEETUPS` is 1 |
| `src/styles/base.css` | Modify | `.snap-strip`, `.check-circle`, `.photo-add`, `.text-button:disabled` |
| `src/screens/DayScreen.tsx` / `.css` | Modify | The Logged note; `data-reveal="start"`; the Place row's CSS |
| `src/screens/DayHelperBar.tsx` | Modify | The Place field on a line of its own |
| `src/lib/loggedUndo.ts` / `.test.ts` | Create | A spent Undo stays spent for the session |
| `src/hooks/useRevealFocusedField.ts` | Modify | `data-reveal="start"` |
| `src/db/meetups.ts` / `.test.ts` | Modify | `addMeetupPhoto`, `removeMeetupPhotos`, cache-backed `photoThumbs` |
| `src/hooks/usePhotoAdder.ts` | Create | The picker and the one-at-a-time loop |
| `src/components/PhotoAddTile.tsx` | Create | The Add photos tile and its hint |
| `src/sheets/MeetupPhotos.tsx` | Modify | On top of `usePhotoAdder` |
| `src/screens/MeetupScreen.tsx` / `.css` | Modify | Photos always, between Activities and The day; Edit waits |
| `src/backup/nudge.ts` / `.test.ts` | Create | When a backup is due, and the dot |
| `src/backup/useBackupDot.ts` | Create | The dot's live query |
| `src/db/settings.ts` | Modify | `backupNudgeSeenAt`, `restoreUndo` |
| `src/screens/SettingsScreen.tsx` | Modify | Footer, seen dot, import confirm, restore with undo, "Undo restore" |
| `src/backup/format.ts` / `.test.ts` | Modify | `exportedAt` |
| `src/backup/importSummary.ts` / `.test.ts` | Create | The confirms' lines and the "Undo restore" subtitle |
| `src/components/ActionSheet.css` | Modify | A message keeps its line breaks |
| `src/db/db.ts` / `.test.ts` | Modify | Version 4 and `restoreUndo`; the upgrade and old-reader tests |
| `src/backup/storage.ts` / `.test.ts` | Modify | `restoreBackup`, `undoRestore`, `forgetOldRestore` |
| `src/backup/RestoreUndoCleanup.ts`, `src/App.tsx` | Create, Modify | The cleanup on every start |
| `src/sw/push.test.ts` | Modify | A version 3 worker on a version 4 database |
| `e2e/*.spec.ts` | Modify | The e2e named in each task |
| `e2e/screenshots.spec.ts` | Modify | Screenshots 25 to 30 |
| `DESIGN.md` | Modify | Colors, inset groups, search, Birthdays soon, Recent meetups, toast, the day page, helper bar, Meetup page, tab bar, action sheets, Backup group, Do's and Don'ts |
| `docs/superpowers/specs/2026-10-21-friends-first-design.md` | Modify | The decisions made while building |

---

### Task 1: Toasts belong to their page, and the day page shows none

**Files:**
- Create: `src/lib/routes.ts`
- Modify: `src/components/Page.tsx`, `src/components/TabBar.tsx`, `src/components/Toast.css`, `src/components/Toast.tsx`, `src/screens/DayScreen.tsx`, `src/sheets/MeetupSheet.tsx`
- Test: `e2e/day.spec.ts`, `e2e/detail.spec.ts`, `src/lib/routes.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

The day page shows no toast after "Save and write about the day"; following a link clears a toast; going back keeps "Meetup deleted" and its Undo. Two detail tests that read the "Logged" toast on the opened meetup now expect it gone, and `isDayPage` gets a unit test.

In `e2e/day.spec.ts`:

```diff
--- a/e2e/day.spec.ts
+++ b/e2e/day.spec.ts
@@ -102,13 +102,9 @@ test('"Save and write about the day" logs the meetup and opens its day; Back lan
   await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
 
   await expect(sheet).toBeHidden()
-  await expect(page.getByRole('status')).toContainText('Logged with Mariya')
   await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeFocused()
-  // The toast sits 8px above the helper bar.
-  const toast = await page.locator('.toast').boundingBox()
-  const bar = await page.locator('.day-page__footer').boundingBox()
-  if (!toast || !bar) throw new Error('The toast or the helper bar is not on screen')
-  expect(Math.abs(toast.y + toast.height - (bar.y - 8)), 'Within a pixel').toBeLessThanOrEqual(1)
+  // The day page shows no toast: nothing covers the box you're about to write in.
+  await expect(page.locator('.toast')).toHaveCount(0)
   await dayBox(page).fill('Tacos')
   await page.getByRole('button', { name: 'Meal' }).click()
   await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
@@ -118,20 +114,33 @@ test('"Save and write about the day" logs the meetup and opens its day; Back lan
   await expect(page.getByRole('heading', { level: 1, name: 'Mariya' })).toBeVisible()
 })
 
-test('Undo on the "Logged" toast takes the day with it, back to Friends', async ({ page }) => {
+test('a toast belongs to its page: following a link clears it', async ({ page }) => {
   await page.goto('/')
   await addFriend(page, 'Alex')
-  await page.getByRole('button', { name: 'Log meetup' }).click()
-  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
-  await sheet.getByLabel('Search all friends').fill('Alex')
-  await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Alex', exact: true }).click()
-  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
-  await dayBox(page).fill('A line I meant to keep')
+  await logMeetup(page, ['Alex'])
+  await expect(page.getByRole('status')).toContainText('Logged with Alex')
 
-  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
+  await page.getByRole('region', { name: 'Recent meetups' }).getByRole('link', { name: /^Coffee/ }).click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
+  await expect(page.locator('.toast')).toHaveCount(0)
+})
+
+test('going back keeps a toast: "Meetup deleted" shows on the page you land on, and Undo puts the row back', async ({
+  page,
+}) => {
+  await page.goto('/')
+  await addFriend(page, 'Alex')
+  await logMeetup(page, ['Alex'])
+  const recent = page.getByRole('region', { name: 'Recent meetups' })
+  await recent.getByRole('link', { name: /^Coffee/ }).click()
+  await page.getByRole('button', { name: 'Edit', exact: true }).click()
+  await page.getByRole('dialog', { name: 'Edit meetup' }).getByRole('button', { name: 'Delete meetup' }).click()
 
   await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
-  await expect.poll(async () => (await readMeetups(page)).length).toBe(0)
+  await expect(recent).toHaveCount(0)
+  await expect(page.getByRole('status')).toContainText('Meetup deleted')
+  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
+  await expect(recent.getByRole('link', { name: /^Coffee/ })).toBeVisible()
 })
 
 test('opens on its title, with the meetup on Back and who was there', async ({ page }) => {
@@ -659,9 +668,9 @@ test('the owner’s example, written on the walk home, reads back as their day',
   await pickActivity(sheet, 'Movie')
   await pickActivity(sheet, 'Shopping')
 
-  // 2. "Save and write about the day": the toast, and the day page slides in.
+  // 2. "Save and write about the day": the day page slides in, with no toast over it.
   await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
-  await expect(page.getByRole('status')).toContainText('Logged with Mariya, Jessie and Brandon')
+  await expect(page.locator('.toast')).toHaveCount(0)
   await expect(page.getByRole('button', { name: 'Meal' })).toBeVisible()
   await expect(page.getByText('Sat, Oct 3 · with Mariya, Jessie and Brandon', { exact: true })).toBeVisible()
 
```

In `e2e/detail.spec.ts`:

```diff
--- a/e2e/detail.spec.ts
+++ b/e2e/detail.spec.ts
@@ -92,7 +92,8 @@ test('the meetup just logged scrolls clear of its toast and opens with one tap',
   await expect(toast).toBeVisible()
   await row.click({ timeout: 2000 })
   await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
-  await expect(toast).toContainText('Logged with Alex')
+  // The toast belongs to the friend page: the meetup opens without it.
+  await expect(page.locator('.toast')).toHaveCount(0)
 })
 
 test('at large text, the meetup just logged scrolls clear of a toast that wraps, and opens with one tap', async ({
@@ -123,7 +124,7 @@ test('at large text, the meetup just logged scrolls clear of a toast that wraps,
   await expect(toast).toBeVisible()
   await row.click({ timeout: 2000 })
   await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
-  await expect(toast).toContainText(`Logged with ${name}`)
+  await expect(page.locator('.toast')).toHaveCount(0)
 })
 
 test('at large text, the room for a toast that wrapped stays after it goes, until the next page', async ({ page }) => {
```

In `src/lib/routes.test.ts`:

```diff
--- /dev/null
+++ b/src/lib/routes.test.ts
@@ -0,0 +1,18 @@
+import { describe, expect, it } from 'vitest'
+import { isDayPage } from './routes'
+
+describe('isDayPage', () => {
+  it('is a meetup’s day page', () => {
+    expect(isDayPage('/meetups/m1/day')).toBe(true)
+    expect(isDayPage('/meetups/abc-123/day')).toBe(true)
+  })
+
+  it('is no other page', () => {
+    expect(isDayPage('/')).toBe(false)
+    expect(isDayPage('/meetups')).toBe(false)
+    expect(isDayPage('/meetups/m1')).toBe(false)
+    expect(isDayPage('/meetups/m1/day/more')).toBe(false)
+    expect(isDayPage('/meetups//day')).toBe(false)
+    expect(isDayPage('/friends/day')).toBe(false)
+  })
+})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/routes.test.ts`
Expected: FAIL, `src/lib/routes` does not exist yet. (`npx playwright test --project=iphone e2e/day.spec.ts` fails too: the toast still follows onto the day page and onto the meetup.)

- [ ] **Step 3: Implement**

`ToastProvider` reads `useNavigationType()`: a push clears the toast and zeroes `--toast-space`; a pop or a replace keeps it. A toast asked for on the day page is dropped. `isDayPage` moves to `src/lib/routes.ts`. "Save and write about the day" shows no toast and opens the day page with `{ logged: true }`. The day page stops publishing `day-open` and `--day-bar-height`.

In `src/components/Page.tsx`:

```diff
--- a/src/components/Page.tsx
+++ b/src/components/Page.tsx
@@ -7,6 +7,8 @@ import './Page.css'
 export interface NavState {
   backLabel?: string
   tab?: string
+  /** On the day page: it was opened by "Save and write about the day", just after the meetup was logged. */
+  logged?: boolean
 }
 
 interface PageProps {
```

In `src/components/TabBar.tsx`:

```diff
--- a/src/components/TabBar.tsx
+++ b/src/components/TabBar.tsx
@@ -1,4 +1,5 @@
 import { Link, useLocation } from 'react-router'
+import { isDayPage } from '../lib/routes'
 import type { NavState } from './Page'
 import { IconFriends, IconSettings, IconStats } from './icons'
 import './TabBar.css'
@@ -14,14 +15,12 @@ const TABS = [
   { to: '/settings', label: 'Settings', Icon: IconSettings, matches: (path: string) => path.startsWith('/settings') },
 ]
 
-/** The day page fills the screen, so it has no tab bar. */
-const DAY_PAGE = /^\/meetups\/[^/]+\/day$/
-
 export function TabBar() {
   const location = useLocation()
   const { pathname } = location
   const originTab = (location.state as NavState | null)?.tab
-  if (DAY_PAGE.test(pathname)) return null
+  // The day page fills the screen, so it has no tab bar.
+  if (isDayPage(pathname)) return null
   return (
     <nav className="tabbar" aria-label="Main">
       {TABS.map(({ to, label, Icon, matches }) => {
```

In `src/components/Toast.css`:

```diff
--- a/src/components/Toast.css
+++ b/src/components/Toast.css
@@ -12,11 +12,6 @@
   pointer-events: none;
 }
 
-/* On the day page the toast sits 8px above the helper bar, which rides on the keyboard (see DayScreen). */
-.day-open .toast-region {
-  bottom: calc(var(--keyboard-inset, 0px) + var(--day-bar-height, 0px) + var(--space-2));
-}
-
 .toast {
   display: flex;
   align-items: center;
```

In `src/components/Toast.tsx`:

```diff
--- a/src/components/Toast.tsx
+++ b/src/components/Toast.tsx
@@ -1,6 +1,7 @@
 import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
 import { createPortal } from 'react-dom'
-import { useLocation } from 'react-router'
+import { useLocation, useNavigationType } from 'react-router'
+import { isDayPage } from '../lib/routes'
 import './Toast.css'
 
 export interface ToastOptions {
@@ -20,9 +21,13 @@ export function ToastProvider({ children }: { children: ReactNode }) {
   const [paused, setPaused] = useState(false)
   const nextId = useRef(0)
   const toastRef = useRef<HTMLDivElement>(null)
-  const { key: pageKey } = useLocation()
+  const { key: pageKey, pathname } = useLocation()
+  const navigationType = useNavigationType()
+  const pathRef = useRef(pathname)
 
   const show = useCallback((options: ToastOptions) => {
+    // The day page never shows a toast, so none covers the box being written in: it says what it needs itself.
+    if (isDayPage(pathRef.current)) return
     nextId.current += 1
     setPaused(false)
     setToast({ ...options, id: nextId.current })
@@ -46,11 +51,21 @@ export function ToastProvider({ children }: { children: ReactNode }) {
     observer.observe(element)
     return () => observer.disconnect()
   }, [toast])
-  // A new page keeps room only for a toast that is showing now.
+  // A toast belongs to the page it was shown on. Opening another page (a push) clears it at once, so an Undo never
+  // shows over a page it isn't about. Going back (a pop) keeps it, so a delete's Undo shows on the page you land on;
+  // so does a replace, which in this app stands in for Back or changes the same page. A new page keeps room only for
+  // a toast that is showing now (on a push the toast is still in the DOM here, so it isn't measured).
   useLayoutEffect(() => {
+    pathRef.current = pathname
+    if (navigationType === 'PUSH') {
+      setToast(null)
+      document.documentElement.style.setProperty('--toast-space', '0px')
+      return
+    }
     const element = toastRef.current
     const space = element ? Math.ceil(element.getBoundingClientRect().height) : 0
     document.documentElement.style.setProperty('--toast-space', `${space}px`)
+    // Only a new page runs this: its path and how it was reached are read with it.
   }, [pageKey])
   useLayoutEffect(
     () => () => {
```

In `src/lib/routes.ts`:

```diff
--- /dev/null
+++ b/src/lib/routes.ts
@@ -0,0 +1,9 @@
+const DAY_PAGE = /^\/meetups\/[^/]+\/day$/
+
+/**
+ * Whether `pathname` is a meetup's day page (`/meetups/:id/day`). It fills the screen, so it has no tab bar, and it
+ * shows no toast: it says what it needs in its own lines.
+ */
+export function isDayPage(pathname: string): boolean {
+  return DAY_PAGE.test(pathname)
+}
```

In `src/screens/DayScreen.tsx`:

```diff
--- a/src/screens/DayScreen.tsx
+++ b/src/screens/DayScreen.tsx
@@ -96,7 +96,7 @@ export function DayScreen() {
     [location.key, navigate],
   )
 
-  // Deleted (Undo on the "Logged" toast, another tab) or never there: go back, like the Meetup page does.
+  // Deleted (another tab) or never there: go back, like the Meetup page does.
   useEffect(() => {
     if (meetup === null) leave('/')
   }, [meetup, leave])
@@ -125,7 +125,6 @@ function DayPage({ meetup, people, typeName, onLeave }: DayPageProps) {
   const dayRef = useRef<HTMLTextAreaElement>(null)
   const placeRef = useRef<HTMLInputElement>(null)
   const paidRef = useRef<HTMLButtonElement>(null)
-  const footerRef = useRef<HTMLDivElement>(null)
   const weatherId = useId()
   const dayId = useId()
   const hintId = useId()
@@ -173,21 +172,6 @@ function DayPage({ meetup, people, typeName, onLeave }: DayPageProps) {
     if (status.gone) onLeave('/')
   }, [status.gone, onLeave])
 
-  // The toast sits 8px above the helper bar here (Toast.css): mark the page and publish the bar's height.
-  useLayoutEffect(() => {
-    const root = document.documentElement
-    root.classList.add('day-open')
-    const observer = new ResizeObserver(([entry]) => {
-      root.style.setProperty('--day-bar-height', `${Math.ceil(entry.borderBoxSize[0].blockSize)}px`)
-    })
-    if (footerRef.current) observer.observe(footerRef.current)
-    return () => {
-      observer.disconnect()
-      root.classList.remove('day-open')
-      root.style.removeProperty('--day-bar-height')
-    }
-  }, [])
-
   // A newer stored value (another tab, a backup restore) only goes into a field that isn't focused and has
   // nothing waiting to save, so nothing changes under your thumb.
   useEffect(() => {
@@ -518,7 +502,7 @@ function DayPage({ meetup, people, typeName, onLeave }: DayPageProps) {
 
       {/* With How it felt focused there's nothing to show until the keyboard is up ("Hide keyboard"), so the bar
           goes away rather than leave an empty band (DayScreen.css). */}
-      <div ref={footerRef} className="day-page__footer" data-bare={focused === 'feelings' && !status.failed}>
+      <div className="day-page__footer" data-bare={focused === 'feelings' && !status.failed}>
         {status.failed && (
           <p className="field-error" role="alert">
             {SAVE_FAILED}
```

In `src/sheets/MeetupSheet.tsx`:

```diff
--- a/src/sheets/MeetupSheet.tsx
+++ b/src/sheets/MeetupSheet.tsx
@@ -225,13 +225,16 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
       } else {
         const meetup = await addMeetup(input, photoChanges)
         added = meetup.id
-        toast({
-          message: `Logged with ${formatNameList(selected.map((f) => f.name))}`,
-          actionLabel: 'Undo',
-          onAction: () => {
-            deleteMeetup(meetup.id).catch(() => toast({ message: UNDO_FAILED, tone: 'plain' }))
-          },
-        })
+        // "Save and write about the day" confirms on the day page itself, which never shows a toast.
+        if (!writeDay) {
+          toast({
+            message: `Logged with ${formatNameList(selected.map((f) => f.name))}`,
+            actionLabel: 'Undo',
+            onAction: () => {
+              deleteMeetup(meetup.id).catch(() => toast({ message: UNDO_FAILED, tone: 'plain' }))
+            },
+          })
+        }
       }
       // Photos take real space, so ask Safari to keep the data when the phone runs low (best effort).
       if (photoChanges.add.length > 0) void askToKeepData()
@@ -242,7 +245,7 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
         const presetFriend = initial?.presetFriendId ? friendById.get(initial.presetFriendId) : undefined
         const fromHere: NavState = { backLabel: presetFriend?.name, tab: (location.state as NavState | null)?.tab }
         navigate(`/meetups/${added}`, { state: fromHere })
-        navigate(`/meetups/${added}/day`)
+        navigate(`/meetups/${added}/day`, { state: { logged: true } satisfies NavState })
       }
     } catch (caught) {
       setError(caught instanceof ValidationError ? caught.message : "Couldn't save. Please try again.")
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b` (no files written), then `npm test`
Expected: `Test Files  61 passed (61)` and `Tests  751 passed (751)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `201 passed`.

The first full run had 2 failures in `e2e/detail.spec.ts` (the "Logged" toast on the opened meetup); they are the two tests updated above.

- [ ] **Step 5: Commit**

```bash
git add e2e/day.spec.ts e2e/detail.spec.ts src/components/Page.tsx src/components/TabBar.tsx src/components/Toast.css src/components/Toast.tsx src/lib/routes.test.ts src/lib/routes.ts src/screens/DayScreen.tsx src/sheets/MeetupSheet.tsx
git commit -F - <<'EOF'
feat: a toast belongs to the page it was shown on, and the day page shows none

Opening another page (a push) clears any toast at once, so an Undo never
shows over a page it isn't about. Going back (a pop) keeps it, so "Meetup
deleted" and its Undo still show on the page you land on; a replace keeps it
too, since every replace in the app stands in for Back or changes the same
page. A toast asked for on the day page is dropped, so nothing covers the
box being written in. "Save and write about the day" no longer shows the
"Logged" toast and opens the day page with { logged: true } in its state.
isDayPage moves to src/lib/routes.ts for the tab bar and the toasts, and the
day page no longer publishes day-open or --day-bar-height.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: The Friends tab opens on friends

**Files:**
- Modify: `src/components/InsetGroup.css`, `src/components/InsetGroup.tsx`, `src/lib/birthdays.ts`, `src/lib/payers.ts`, `src/lib/text.ts`, `src/screens/DayScreen.tsx`, `src/screens/FriendsScreen.css`, `src/screens/FriendsScreen.tsx`, `src/sheets/MeetupSheet.css`, `src/sheets/MeetupSheet.tsx`, `src/stats/meetupHistory.ts`, `src/styles/base.css`
- Test: `e2e/birthdays.spec.ts`, `e2e/friends.spec.ts`, `e2e/history.spec.ts`, `src/lib/birthdays.test.ts`, `src/lib/payers.test.ts`, `src/lib/text.test.ts`, `src/stats/meetupHistory.test.ts`

- [ ] **Step 1: Write the failing tests**

Unit tests for `shortName` and `describeBirthdayCountdown`, and `RECENT_MEETUPS` at 1. The e2e "friends come first" checks the order and the positions; Birthdays soon is one strip of tiles; Recent meetups shows one row with "See all" in its header.

In `e2e/birthdays.spec.ts`:

```diff
--- a/e2e/birthdays.spec.ts
+++ b/e2e/birthdays.spec.ts
@@ -175,12 +175,14 @@ test('lists the birthdays in the next two weeks on the Friends tab', async ({ pa
   await addFriend(page, 'Sam', 'Work')
 
   const soon = page.getByRole('region', { name: 'Birthdays soon' })
-  const rows = soon.getByRole('link')
-  await expect(rows).toHaveCount(2)
-  await expect(rows.nth(0)).toContainText('Lee')
-  await expect(rows.nth(0)).toContainText('Today')
-  await expect(rows.nth(1)).toContainText('Alex')
-  await expect(rows.nth(1)).toContainText('In 5 days · turns 40')
+  const tiles = soon.getByRole('link')
+  await expect(tiles).toHaveCount(2)
+  // Each tile shows the first name and the countdown, and is named in full with the age.
+  await expect(tiles.locator('.birthday-tile__name')).toHaveText(['Lee', 'Alex'])
+  await expect(tiles.locator('.birthday-tile__when')).toHaveText(['Today', 'In 5 days'])
+  await expect(tiles.nth(0)).toHaveAccessibleName('Lee, Today')
+  await expect(tiles.nth(1)).toHaveAccessibleName('Alex, In 5 days · turns 40')
+  await expect(soon.getByRole('list')).toBeVisible()
 
   const search = page.getByLabel('Search friends')
   await search.fill('a')
@@ -194,23 +196,48 @@ test('lists the birthdays in the next two weeks on the Friends tab', async ({ pa
   await filters.getByRole('button', { name: 'All' }).click()
   await expect(soon).toBeVisible()
 
-  await rows.nth(1).click()
+  await tiles.nth(1).click()
   await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
   await page.getByRole('button', { name: 'Friends', exact: true }).click()
   await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
 })
 
-test('shows at most three birthdays soon, then how many more', async ({ page }) => {
+test('shows every birthday soon in one strip that scrolls sideways', async ({ page }) => {
   await page.goto('/')
-  for (const [days, name] of ['Ana', 'Ben', 'Cal', 'Dee', 'Eve', 'Fay'].entries()) {
+  const names = ['Ana', 'Ben', 'Cal', 'Dee', 'Eve', 'Fay']
+  for (const [days, name] of names.entries()) {
     const { month, day } = dayFromToday(days)
     await addFriend(page, name, undefined, { month, day })
   }
 
   const soon = page.getByRole('region', { name: 'Birthdays soon' })
-  await expect(soon.getByRole('link')).toHaveCount(3)
-  await expect(soon.getByRole('link').last()).toContainText('Cal')
-  await expect(soon).toContainText('And 3 more in the next two weeks.')
+  const tiles = soon.getByRole('link')
+  await expect(tiles.locator('.birthday-tile__name')).toHaveText(names)
+  await expect(soon).not.toContainText('more in the next two weeks')
+  // One row: every tile at the same height.
+  const tops = await tiles.evaluateAll((links) => links.map((link) => Math.round(link.getBoundingClientRect().top)))
+  expect(new Set(tops).size, 'One row').toBe(1)
+
+  // Playwright's mobile WebKit has no touch scrolling, so the swipe is played by scrolling the strip.
+  const sixth = tiles.nth(5)
+  await expect(sixth).not.toBeInViewport({ ratio: 1 })
+  await soon.getByRole('list').evaluate((strip) => {
+    strip.scrollLeft = strip.scrollWidth
+  })
+  await expect(sixth).toBeInViewport({ ratio: 1 })
+  await sixth.click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Fay' })).toBeVisible()
+})
+
+test('two friends with the same first name show their full names on their tiles', async ({ page }) => {
+  await page.goto('/')
+  for (const [days, name] of ['Sam Lee', 'Sam Park', 'Kim Ito'].entries()) {
+    const { month, day } = dayFromToday(days + 1)
+    await addFriend(page, name, undefined, { month, day })
+  }
+  const tiles = page.getByRole('region', { name: 'Birthdays soon' }).getByRole('link')
+  await expect(tiles.locator('.birthday-tile__name')).toHaveText(['Sam Lee', 'Sam Park', 'Kim'])
+  await expect(tiles.nth(0)).toHaveAccessibleName('Sam Lee, Tomorrow')
 })
 
 test('keeps birthdays through a backup', async ({ page }) => {
```

In `e2e/friends.spec.ts`:

```diff
--- a/e2e/friends.spec.ts
+++ b/e2e/friends.spec.ts
@@ -1,11 +1,64 @@
-import { expect, test } from '@playwright/test'
-import { addFriend, ONE_PIXEL_PNG, sheetSave } from './helpers.ts'
+import { expect, test, type Locator } from '@playwright/test'
+import { addFriend, friendRow, meetupRow, ONE_PIXEL_PNG, seedMeetups, sheetSave } from './helpers.ts'
+
+/** The top and bottom of an element on screen, in CSS pixels. */
+async function spanOf(locator: Locator): Promise<{ top: number; bottom: number }> {
+  const box = await locator.boundingBox()
+  if (!box) throw new Error('Not on screen')
+  return { top: box.y, bottom: box.y + box.height }
+}
 
 test('shows a welcome state with no friends', async ({ page }) => {
   await page.goto('/')
   await expect(page.getByText('Add the people you want to keep up with.')).toBeVisible()
 })
 
+test('friends come first: search, the chips, Birthdays soon and the latest meetup, then the list', async ({ page }) => {
+  // Wed, Oct 21, 2026, noon: three birthdays in the next two weeks.
+  await page.clock.setFixedTime(new Date(2026, 9, 21, 12))
+  await page.goto('/')
+  const groups = ['Climbing', 'College', 'Family', 'Work'].map((name) => ({ id: name.toLowerCase(), name }))
+  const friends = [
+    friendRow('alex', 'Alex Rivera', { groupId: 'college' }),
+    friendRow('aisha', 'Aisha Rahman', { groupId: 'work' }),
+    friendRow('maxi', 'Maximiliana Alexandra', { groupId: 'family' }),
+    friendRow('jordan', 'Jordan Lee', { groupId: 'climbing' }),
+    friendRow('kim', 'Kim Park', { groupId: 'work' }),
+    friendRow('brandon', 'Brandon Cao', { birthday: { month: 10, day: 23, year: 1999 } }),
+    friendRow('sam', 'Sam Chen', { groupId: 'college', birthday: { month: 10, day: 30, year: null } }),
+    friendRow('len', 'Len Foster', { birthday: { month: 11, day: 3, year: null } }),
+  ]
+  // A latest meetup whose subtitle runs to two lines.
+  const latest = meetupRow('karaoke', '2026-10-19', ['alex', 'aisha', 'maxi', 'jordan'], {
+    activities: ['Karaoke', 'Board games'],
+  })
+  await seedMeetups(page, { friends, groups, meetups: [latest, meetupRow('older', '2026-10-01', ['kim'])] })
+  await page.getByRole('complementary', { name: 'Install the app' }).getByRole('button', { name: 'Dismiss' }).click()
+
+  const search = await spanOf(page.locator('.friends-filters .search'))
+  expect(search.top, 'Search sits just under the large title').toBeLessThanOrEqual(110)
+  const birthdays = page.getByRole('region', { name: 'Birthdays soon' })
+  await expect(birthdays.getByRole('link')).toHaveCount(3)
+  const recent = page.getByRole('region', { name: 'Recent meetups' })
+  await expect(recent.locator('.row__title')).toHaveText(['Coffee'])
+  const list = page.locator('.inset-group').last().getByRole('link')
+  await expect(list).toHaveCount(8)
+
+  // Top to bottom: the search field, the chips, Birthdays soon, Recent meetups, then the friends.
+  const tops = [
+    search.top,
+    (await spanOf(page.getByRole('group', { name: 'Filter by group' }))).top,
+    (await spanOf(birthdays)).top,
+    (await spanOf(recent)).top,
+    (await spanOf(list.first())).top,
+  ]
+  expect([...tops].sort((a, b) => a - b), 'In that order').toEqual(tops)
+  expect(tops[4], 'The first friend row is on the first screen').toBeLessThanOrEqual(480)
+  // 645px is where the Home Screen app's Log pill starts, in these coordinates (713px less 16 and 52).
+  const third = await spanOf(list.nth(2).locator('.row__title'))
+  expect(third.bottom, 'The third friend’s name shows clear of the Log pill').toBeLessThanOrEqual(645)
+})
+
 test('adds friends and lists them', async ({ page }) => {
   await page.goto('/')
   await addFriend(page, 'Alex Smith')
```

In `e2e/history.spec.ts`:

```diff
--- a/e2e/history.spec.ts
+++ b/e2e/history.spec.ts
@@ -109,27 +109,44 @@ function visit(page: Page, n: number): Locator {
   return page.getByRole('link', { name: new RegExp(`Visit ${n}$`) })
 }
 
-test('Recent meetups shows the three latest that happened, naming everyone', async ({ page }) => {
-  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: [...PAST, PARTY] })
+test('Recent meetups shows the latest that happened, naming everyone, with "See all" in its header', async ({
+  page,
+}) => {
+  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: [MEAL, COFFEE, CALL, PARTY] })
   const recent = recentGroup(page)
-  await expect(recent.locator('.row__title')).toHaveText(['Drinks', 'Meal', 'Coffee', 'See all meetups'])
-  await expect(recent.getByRole('link', { name: /^Meal/ })).toHaveAccessibleName(
-    /^Meal\s*Sat, Oct 3 · with Alex and Sam · Tacos$/,
-  )
+  await expect(recent.locator('.row__title')).toHaveText(['Meal'])
+  // "See all" comes first: it's at the end of the title's line, above the row.
+  const links = recent.getByRole('link')
+  await expect(links).toHaveCount(2)
+  await expect(links.nth(0)).toHaveAccessibleName('See all meetups')
+  await expect(links.nth(0)).toHaveText('See all')
+  await expect(links.nth(1)).toHaveAccessibleName(/^Meal\s*Sat, Oct 3 · with Alex and Sam · Tacos$/)
   await expect(recent).not.toContainText('Party')
-  await expect(recent).not.toContainText('Call')
+  await expect(recent).not.toContainText('Coffee')
+
+  // A 44px hit area at least, ending where the row starts.
+  const area = await links.nth(0).evaluate((link) => {
+    const before = getComputedStyle(link, '::before')
+    return { width: parseFloat(before.width), height: parseFloat(before.height) }
+  })
+  expect(area.width).toBeGreaterThanOrEqual(44)
+  expect(area.height).toBeGreaterThanOrEqual(44)
+  const seeAll = await links.nth(0).boundingBox()
+  const row = await links.nth(1).boundingBox()
+  if (!seeAll || !row) throw new Error('Not on screen')
+  expect(seeAll.y + seeAll.height, 'Above the row, with the gap the title keeps').toBeLessThanOrEqual(row.y - 8 + 1)
 })
 
-test('Recent meetups shows two while Birthdays soon shows', async ({ page }) => {
+test('Recent meetups shows one row with or without Birthdays soon', async ({ page }) => {
   const lee = friendRow('lee', 'Lee', { birthday: { month: 10, day: 8, year: null } })
   await openWith(page, { friends: [ALEX, SAM, KIM, lee], meetups: PAST })
   await expect(page.getByRole('region', { name: 'Birthdays soon' })).toContainText('Lee')
-  await expect(recentGroup(page).locator('.row__title')).toHaveText(['Drinks', 'Meal', 'See all meetups'])
+  await expect(recentGroup(page).locator('.row__title')).toHaveText(['Drinks'])
 
-  // Two weeks on, no birthday is near: the third row comes back.
+  // Two weeks on, no birthday is near: still one row.
   await page.clock.setFixedTime(new Date(2026, 9, 20, 12))
   await page.reload()
-  await expect(recentGroup(page).locator('.row__title')).toHaveText(['Drinks', 'Meal', 'Coffee', 'See all meetups'])
+  await expect(recentGroup(page).locator('.row__title')).toHaveText(['Drinks'])
   await expect(page.getByRole('region', { name: 'Birthdays soon' })).toHaveCount(0)
 })
 
@@ -140,7 +157,7 @@ test('Recent meetups hides while searching or filtering, and until a meetup has
   await expect(recentGroup(page)).toHaveCount(0)
 
   await logMeetup(page, ['Kim'], { date: '2026-10-01' })
-  await expect(recentGroup(page).locator('.row__title')).toHaveText(['Coffee', 'See all meetups'])
+  await expect(recentGroup(page).locator('.row__title')).toHaveText(['Coffee'])
 
   const search = page.getByLabel('Search friends')
   await search.fill('k')
@@ -190,12 +207,12 @@ test('the search field stays put while the groups above it hide and come back',
   await search.fill('a')
   await expect(recentGroup(page)).toHaveCount(0)
   expect(Math.abs((await topOf(field)) - start), 'The field stays put when the groups hide').toBeLessThanOrEqual(4)
-  await expect(page.locator('.friends-filters + .inset-group').getByRole('link').first()).toBeInViewport()
+  await expect(page.locator('.inset-group').last().getByRole('link').first()).toBeInViewport()
 
   await search.fill('')
   await expect(recentGroup(page)).toBeVisible()
   expect(Math.abs((await topOf(field)) - start), 'The field stays put when they come back').toBeLessThanOrEqual(4)
-  await expect(page.locator('.friends-filters + .inset-group').getByRole('link').first()).toBeInViewport()
+  await expect(page.locator('.inset-group').last().getByRole('link').first()).toBeInViewport()
   // While Recent meetups comes back and its thumbnail arrives.
   for (const top of await topsOverFrames(page, '.friends-filters .search')) {
     expect(Math.abs(top - start), 'The field stays put as the thumbnail arrives').toBeLessThanOrEqual(4)
@@ -214,8 +231,8 @@ test('the search field stays put while the groups above it hide and come back',
 
 test('a recent meetup opens its page with "Friends" on the back button', async ({ page }) => {
   await openWith(page, { friends: [ALEX, SAM, KIM], meetups: PAST })
-  await recentGroup(page).getByRole('link', { name: /^Meal/ }).click()
-  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
+  await recentGroup(page).getByRole('link', { name: /^Drinks/ }).click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Drinks' })).toBeVisible()
   const back = page.locator('header.navbar .navbar__back')
   await expect(back).toHaveText('Friends')
   await back.click()
@@ -224,7 +241,7 @@ test('a recent meetup opens its page with "Friends" on the back button', async (
 })
 
 test('the friend page still leaves its friend out', async ({ page }) => {
-  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: PAST })
+  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: [MEAL, COFFEE, CALL] })
   const meal = recentGroup(page).getByRole('link', { name: /^Meal/ })
   await expect(meal).toHaveAccessibleName(/· with Alex and Sam · Tacos$/)
   await friendLink(page, 'Alex').click()
```

In `src/lib/birthdays.test.ts`:

```diff
--- a/src/lib/birthdays.test.ts
+++ b/src/lib/birthdays.test.ts
@@ -6,6 +6,7 @@ import {
   birthdayFromFields,
   birthdayProblem,
   daysUntilBirthday,
+  describeBirthdayCountdown,
   describeNextBirthday,
   EMPTY_BIRTHDAY_FIELDS,
   formatBirthday,
@@ -176,6 +177,14 @@ describe('formatBirthday', () => {
   })
 })
 
+describe('describeBirthdayCountdown', () => {
+  it('says how far off a birthday is', () => {
+    expect(describeBirthdayCountdown(0)).toBe('Today')
+    expect(describeBirthdayCountdown(1)).toBe('Tomorrow')
+    expect(describeBirthdayCountdown(5)).toBe('In 5 days')
+  })
+})
+
 describe('describeNextBirthday', () => {
   it('says today, tomorrow or in how many days', () => {
     expect(describeNextBirthday(bday(10, 2), TODAY)).toBe('Today')
```

In `src/lib/payers.test.ts`:

```diff
--- a/src/lib/payers.test.ts
+++ b/src/lib/payers.test.ts
@@ -1,21 +1,23 @@
 import { describe, expect, it } from 'vitest'
 import { friend } from '../test/fixtures'
-import { paidBy, payerLabel } from './payers'
+import { paidBy } from './payers'
+import { shortName } from './text'
 
 const mariya = friend('f-mariya', 'Mariya')
 const jessie = friend('f-jessie', 'Jessie Tran')
 const samLee = friend('f-sam-lee', 'Sam Lee')
 const samPark = friend('f-sam-park', 'sam Park')
 
-describe('payerLabel', () => {
+// "Who paid?" names each friend on the meetup by shortName.
+describe('shortName among the friends on a meetup', () => {
   it('uses the first name', () => {
-    expect(payerLabel(jessie, [mariya, jessie])).toBe('Jessie')
-    expect(payerLabel(mariya, [mariya, jessie])).toBe('Mariya')
+    expect(shortName(jessie, [mariya, jessie])).toBe('Jessie')
+    expect(shortName(mariya, [mariya, jessie])).toBe('Mariya')
   })
 
   it('uses the full name when two friends on the meetup share a first name, ignoring case', () => {
-    expect(payerLabel(samLee, [samLee, samPark, mariya])).toBe('Sam Lee')
-    expect(payerLabel(samPark, [samLee, samPark, mariya])).toBe('sam Park')
+    expect(shortName(samLee, [samLee, samPark, mariya])).toBe('Sam Lee')
+    expect(shortName(samPark, [samLee, samPark, mariya])).toBe('sam Park')
   })
 })
 
```

In `src/lib/text.test.ts`:

```diff
--- a/src/lib/text.test.ts
+++ b/src/lib/text.test.ts
@@ -10,6 +10,7 @@ import {
   initials,
   plural,
   sameName,
+  shortName,
 } from './text'
 
 describe('formatSince', () => {
@@ -97,6 +98,29 @@ describe('describeBackup', () => {
   })
 })
 
+describe('shortName', () => {
+  const brandonCao = { name: 'Brandon Cao' }
+  const brandonLee = { name: 'brandon lee' }
+  const mariya = { name: 'Mariya' }
+
+  it('is the first name when no other friend shares it', () => {
+    expect(shortName(brandonCao, [brandonCao])).toBe('Brandon')
+    expect(shortName(brandonCao, [brandonCao, mariya])).toBe('Brandon')
+    expect(shortName(mariya, [brandonCao, brandonLee, mariya])).toBe('Mariya')
+  })
+
+  it('is the full name when another friend has the same first name, ignoring case', () => {
+    expect(shortName(brandonCao, [brandonCao, brandonLee, mariya])).toBe('Brandon Cao')
+    expect(shortName(brandonLee, [brandonCao, brandonLee])).toBe('brandon lee')
+  })
+
+  it('ignores extra spaces', () => {
+    const spaced = { name: '  Brandon   Cao ' }
+    expect(shortName(spaced, [spaced])).toBe('Brandon')
+    expect(shortName(spaced, [spaced, brandonLee])).toBe('Brandon   Cao')
+  })
+})
+
 describe('displayText', () => {
   it('trims the ends of each line and drops blank lines at the start and end, keeping the ones between', () => {
     expect(displayText('  Tired\n\n\n')).toBe('Tired')
```

In `src/stats/meetupHistory.test.ts`:

```diff
--- a/src/stats/meetupHistory.test.ts
+++ b/src/stats/meetupHistory.test.ts
@@ -11,7 +11,6 @@ import {
   meetupSearchText,
   meetupSubtitle,
   RECENT_MEETUPS,
-  RECENT_MEETUPS_WITH_BIRTHDAYS,
   recentMeetups,
   searchKey,
 } from './meetupHistory'
@@ -27,9 +26,8 @@ function loggedAt(id: string, date: string, time: string, fields: Partial<Meetup
 const ids = (meetups: Meetup[]) => meetups.map((m) => m.id)
 
 describe('limits', () => {
-  it('shows 3 recent meetups, 2 while Birthdays soon shows, and 60 rows a page', () => {
-    expect(RECENT_MEETUPS).toBe(3)
-    expect(RECENT_MEETUPS_WITH_BIRTHDAYS).toBe(2)
+  it('shows the latest meetup on the Friends tab on every day, and 60 rows a page', () => {
+    expect(RECENT_MEETUPS).toBe(1)
     expect(MEETUPS_PAGE_SIZE).toBe(60)
   })
 })
@@ -43,8 +41,8 @@ describe('recentMeetups', () => {
     loggedAt('evening', TODAY, '18:00'),
   ]
 
-  it('gives the latest meetups that happened, newest first, the one logged later first on the same date', () => {
-    expect(ids(recentMeetups(meetups, TODAY))).toEqual(['evening', 'morning', 'oct1'])
+  it('gives the latest meetup that happened, the one logged later first on the same date', () => {
+    expect(ids(recentMeetups(meetups, TODAY))).toEqual(['evening'])
   })
 
   it('never gives a future meetup', () => {
@@ -57,7 +55,7 @@ describe('recentMeetups', () => {
   })
 
   it('takes another limit', () => {
-    expect(ids(recentMeetups(meetups, TODAY, RECENT_MEETUPS_WITH_BIRTHDAYS))).toEqual(['evening', 'morning'])
+    expect(ids(recentMeetups(meetups, TODAY, 3))).toEqual(['evening', 'morning', 'oct1'])
   })
 })
 
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/text.test.ts src/lib/payers.test.ts src/lib/birthdays.test.ts src/stats/meetupHistory.test.ts`
Expected: FAIL, `shortName is not a function` and `describeBirthdayCountdown is not a function`.

- [ ] **Step 3: Implement**

Search and the chips move under the large title; Birthdays soon becomes a `.snap-strip` of tiles; Recent meetups shows the latest meetup with `InsetGroup`'s new `action`; the scroll correction goes.

In `src/components/InsetGroup.css`:

```diff
--- a/src/components/InsetGroup.css
+++ b/src/components/InsetGroup.css
@@ -7,6 +7,41 @@
 .group-title:focus {
   outline: none;
 }
+/* A title with one text link at the end of its line. The line is as tall as any title's, and the link wraps under
+   the title at large text sizes. */
+.group-header {
+  display: flex;
+  flex-wrap: wrap;
+  align-items: baseline;
+  justify-content: space-between;
+  column-gap: var(--space-4);
+  margin: 0 var(--space-4) var(--space-2);
+}
+.group-header .group-title {
+  margin: 0;
+}
+/* Footnote 600 Terracotta Ink, 16px in from the group's right edge. Its hit area is 44px tall and at least 44px wide:
+   it ends where the group's first row starts, never over it, and reaches up into the space above the group. */
+.group-action {
+  position: relative;
+  color: var(--accent-ink);
+  font-size: var(--text-footnote);
+  font-weight: 600;
+  text-decoration: none;
+  transition: opacity var(--dur-fast);
+}
+.group-action::before {
+  content: '';
+  position: absolute;
+  bottom: calc(-1 * var(--space-2));
+  left: 50%;
+  width: max(100% + var(--space-4), var(--tap));
+  height: max(var(--tap), 100% + var(--space-2));
+  transform: translateX(-50%);
+}
+.group-action:active {
+  opacity: 0.5;
+}
 
 .inset-group__body {
   overflow: hidden;
```

In `src/components/InsetGroup.tsx`:

```diff
--- a/src/components/InsetGroup.tsx
+++ b/src/components/InsetGroup.tsx
@@ -8,6 +8,8 @@ interface InsetGroupProps {
   title?: string
   /** Heading level for the title (3 when nested inside a Section). */
   level?: 2 | 3
+  /** One text link at the end of the title's line ("See all"), with the `group-action` class. */
+  action?: ReactNode
   footer?: ReactNode
   /** An id for the footer, so a row can point at it with `describedBy`. */
   footerId?: string
@@ -16,15 +18,24 @@ interface InsetGroupProps {
   children: ReactNode
 }
 
-export function InsetGroup({ title, level = 2, footer, footerId, titleRef, children }: InsetGroupProps) {
+export function InsetGroup({ title, level = 2, action, footer, footerId, titleRef, children }: InsetGroupProps) {
   const titleId = useId()
   const Heading = level === 3 ? 'h3' : 'h2'
+  const heading = title && (
+    <Heading id={titleId} className="group-title" ref={titleRef} tabIndex={titleRef ? -1 : undefined}>
+      {title}
+    </Heading>
+  )
   return (
     <section className="inset-group" aria-labelledby={title && level !== 3 ? titleId : undefined}>
-      {title && (
-        <Heading id={titleId} className="group-title" ref={titleRef} tabIndex={titleRef ? -1 : undefined}>
-          {title}
-        </Heading>
+      {/* The action comes after the heading and before the rows, in the DOM as on screen. */}
+      {heading && action ? (
+        <div className="group-header">
+          {heading}
+          {action}
+        </div>
+      ) : (
+        heading
       )}
       <div className="inset-group__body">{children}</div>
       {footer && (
```

In `src/lib/birthdays.ts`:

```diff
--- a/src/lib/birthdays.ts
+++ b/src/lib/birthdays.ts
@@ -106,10 +106,14 @@ export function formatBirthday(birthday: Birthday): string {
   return birthday.year === null ? date : `${date}, ${birthday.year}`
 }
 
+/** How far off a birthday `days` from today is: "Today", "Tomorrow" or "In 12 days". */
+export function describeBirthdayCountdown(days: number): string {
+  return days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`
+}
+
 /** "Today", "Tomorrow" or "In 12 days", plus the age when the year is known: "In 12 days · turns 31". */
 export function describeNextBirthday(birthday: Birthday, today: ISODate): string {
-  const days = daysUntilBirthday(birthday, today)
-  const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`
+  const when = describeBirthdayCountdown(daysUntilBirthday(birthday, today))
   const age = ageOnNextBirthday(birthday, today)
   return age === null ? when : `${when} · turns ${age}`
 }
```

In `src/lib/payers.ts`:

```diff
--- a/src/lib/payers.ts
+++ b/src/lib/payers.ts
@@ -1,21 +1,11 @@
 import type { Friend } from '../types'
+import { firstName } from './text'
 
 // Who paid is a plain fact on one place, in your words: never totaled, counted or compared (the No Ledger Rule).
-// These only put names on the "Who paid?" chips and a face beside a paid line.
+// The "Who paid?" chips name a friend by shortName (src/lib/text.ts); this only puts a face beside a paid line.
 
 type Named = Pick<Friend, 'name'>
 
-function firstName(friend: Named): string {
-  return friend.name.trim().split(/\s+/)[0]
-}
-
-/** How the "Who paid?" row names a friend on the meetup: the first name, or the full name when two of them share it. */
-export function payerLabel(friend: Named, people: readonly Named[]): string {
-  const first = firstName(friend).toLowerCase()
-  const sharing = people.filter((other) => firstName(other).toLowerCase() === first).length
-  return sharing > 1 ? friend.name.trim() : firstName(friend)
-}
-
 /**
  * The friend a paid line names, when its words match exactly one friend on the meetup (their first or full name,
  * ignoring case). Null for a shared bill, "I paid", or a name that matches no one or more than one: the face is
```

In `src/lib/text.ts`:

```diff
--- a/src/lib/text.ts
+++ b/src/lib/text.ts
@@ -45,6 +45,23 @@ export function sameName(a: string, b: string): boolean {
   return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()
 }
 
+type Named = { name: string }
+
+/** The first word of a friend's name. */
+export function firstName(friend: Named): string {
+  return friend.name.trim().split(/\s+/)[0]
+}
+
+/**
+ * A friend's name kept short: their first name, or their full name when another friend in `among` has the same first
+ * name (ignoring case). "Who paid?" passes the friends on the meetup; Birthdays soon passes every friend.
+ */
+export function shortName(friend: Named, among: readonly Named[]): string {
+  const first = firstName(friend).toLowerCase()
+  const shared = among.some((other) => other !== friend && firstName(other).toLowerCase() === first)
+  return shared ? friend.name.trim() : firstName(friend)
+}
+
 // Intl.Segmenter arrived in iOS Safari 16.4; fall back to code points before that.
 const segmenter =
   typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null
```

In `src/screens/DayScreen.tsx`:

```diff
--- a/src/screens/DayScreen.tsx
+++ b/src/screens/DayScreen.tsx
@@ -18,8 +18,7 @@ import { formatDate } from '../lib/dates'
 import { changeBetween, insertAtCaret, insertPaidLine, insertPlaceLine, lineCaret, type DayEdit } from '../lib/dayEdit'
 import { BOX_FULL, DAY_MAX_TYPED, FEELINGS_MAX, readDay } from '../lib/dayText'
 import { feelingsApply } from '../lib/moods'
-import { payerLabel } from '../lib/payers'
-import { formatNameList } from '../lib/text'
+import { formatNameList, shortName } from '../lib/text'
 import { cleanWeather, WEATHER } from '../lib/weather'
 import type { Friend, Meetup, Mood, Weather } from '../types'
 import { DayHelperBar, type HelperRow, type Payer } from './DayHelperBar'
@@ -64,7 +63,7 @@ function payersFor(people: Friend[]): Payer[] {
   return [
     { key: 'me', label: 'Me', line: 'I paid' },
     ...people.map((friend) => {
-      const label = payerLabel(friend, people)
+      const label = shortName(friend, people)
       return { key: friend.id, label, line: `${label} paid`, friend }
     }),
     { key: 'split', label: 'Split', line: 'We split it' },
```

In `src/screens/FriendsScreen.css`:

```diff
--- a/src/screens/FriendsScreen.css
+++ b/src/screens/FriendsScreen.css
@@ -5,6 +5,54 @@
   margin-bottom: calc(-1 * var(--space-2));
 }
 
+/* Birthdays soon: one row of tiles that scrolls sideways (.snap-strip in base.css), each tile snapping to the margin. */
+.birthday-strip {
+  display: flex;
+  gap: var(--space-2);
+  margin-block: 0;
+  list-style: none;
+  scroll-snap-type: x proximity;
+}
+.birthday-strip > li {
+  flex: none;
+  scroll-snap-align: start;
+}
+/* Paper White with 14px corners: the 44px face, then the short name over the countdown. 60px tall at the default
+   size (the face and 8px above and below), taller as the text grows. */
+.birthday-tile {
+  display: flex;
+  align-items: center;
+  gap: 0.625rem;
+  padding: 0.5rem 0.875rem 0.5rem 0.5rem;
+  border-radius: var(--radius-group);
+  background: var(--surface);
+  color: var(--ink);
+  text-decoration: none;
+  transition: background-color var(--dur-fast);
+}
+.birthday-tile:active {
+  background: var(--surface-pressed);
+}
+.birthday-tile__text {
+  display: flex;
+  flex-direction: column;
+  min-width: 0;
+}
+/* One line: a first name longer than 10rem ends in an ellipsis. */
+.birthday-tile__name {
+  max-width: 10rem;
+  overflow: hidden;
+  font-size: var(--text-subhead);
+  font-weight: 600;
+  text-overflow: ellipsis;
+  white-space: nowrap;
+}
+.birthday-tile__when {
+  color: var(--ink-2);
+  font-size: var(--text-footnote);
+  white-space: nowrap;
+}
+
 .friend-count {
   display: flex;
   flex-direction: column;
```

In `src/screens/FriendsScreen.tsx`:

```diff
--- a/src/screens/FriendsScreen.tsx
+++ b/src/screens/FriendsScreen.tsx
@@ -1,4 +1,5 @@
-import { useLayoutEffect, useMemo, useRef, useState } from 'react'
+import { useId, useMemo, useState } from 'react'
+import { Link } from 'react-router'
 import { useActionSheet } from '../components/ActionSheet'
 import { Avatar } from '../components/Avatar'
 import { Chip } from '../components/Chip'
@@ -12,23 +13,22 @@ import { Page, type NavState } from '../components/Page'
 import { useFriends, useGroups, useMeetupIdsWithPhotosAmong, useMeetups, useMeetupTypes, useSetting } from '../data/hooks'
 import { setSetting } from '../db/settings'
 import { useToday } from '../hooks/useToday'
-import { describeNextBirthday, upcomingBirthdays } from '../lib/birthdays'
-import { daysBetween, yearOf } from '../lib/dates'
+import { describeBirthdayCountdown, describeNextBirthday, upcomingBirthdays, type UpcomingBirthday } from '../lib/birthdays'
+import { daysBetween, yearOf, type ISODate } from '../lib/dates'
 import { matchFriend, matchSubtitle } from '../lib/friendSearch'
 import { isPlainEnter } from '../lib/keys'
 import { isStandalone } from '../lib/platform'
-import { formatSince } from '../lib/text'
+import { formatSince, shortName } from '../lib/text'
 import { useSheets } from '../sheets/sheetsContext'
 import { countsByFriendForYear } from '../stats/counts'
 import { lastSeenByFriend } from '../stats/lastSeen'
-import { meetupNames, RECENT_MEETUPS, RECENT_MEETUPS_WITH_BIRTHDAYS, recentMeetups } from '../stats/meetupHistory'
+import { meetupNames, recentMeetups } from '../stats/meetupHistory'
 import { FRIEND_SORT_LABELS, sortFriends, type FriendSort } from '../stats/sortFriends'
+import type { Friend } from '../types'
 import './FriendsScreen.css'
 
 const SORT_KEY = 'friend-tracker:sort'
 const SORTS = Object.keys(FRIEND_SORT_LABELS) as FriendSort[]
-/** The most rows Birthdays soon shows. Its footer counts the rest. */
-const MAX_BIRTHDAYS_SOON = 3
 /** A meetup opened from Recent meetups says "Friends" on its back button. */
 const FROM_FRIENDS: NavState = { backLabel: 'Friends' }
 
@@ -57,19 +57,16 @@ export function FriendsScreen() {
   const types = useMeetupTypes()
   const hintDismissed = useSetting('installHintDismissed')
   const today = useToday()
-  // The 3 latest past meetups, whatever shows, so searching or Birthdays soon hiding never changes what's read.
-  const latest = useMemo(() => (meetups ? recentMeetups(meetups, today, RECENT_MEETUPS) : undefined), [meetups, today])
-  // Which of them have photos: a few key-only reads at once, so the screen the app opens on never waits for the
-  // app-wide walk of every meetup with photos (MeetupIdsWithPhotosProvider), which grows with the history.
+  // The latest past meetup: Recent meetups' one row, on every day.
+  const latest = useMemo(() => (meetups ? recentMeetups(meetups, today) : undefined), [meetups, today])
+  // Whether it has photos: one key-only read, so the screen the app opens on never waits for the app-wide walk of
+  // every meetup with photos (MeetupIdsWithPhotosProvider), which grows with the history.
   const latestWithPhotos = useMeetupIdsWithPhotosAmong(latest?.map((meetup) => meetup.id))
   const { openFriendSheet } = useSheets()
   const showActionSheet = useActionSheet()
   const [query, setQuery] = useState('')
   const [groupFilter, setGroupFilter] = useState<string | null>(null)
   const [sort, setSort] = useState<FriendSort>(readStoredSort)
-  const filtersRef = useRef<HTMLDivElement>(null)
-  // Where the search field was before a search or a chip hid or showed the groups above it.
-  const filtersTopBefore = useRef<number | null>(null)
 
   const activeGroup = groups?.find((group) => group.id === groupFilter) ?? null
   // Searching or filtering hides Birthdays soon and Recent meetups, so the list below stays a plain filtered list.
@@ -91,32 +88,9 @@ export function FriendsScreen() {
 
   const birthdaysSoon = useMemo(() => upcomingBirthdays(friends ?? [], today), [friends, today])
   const showBirthdaysSoon = birthdaysSoon.length > 0 && unfiltered
-  // Recent meetups gives up a row while Birthdays soon shows above it, so the search field stays nearer the top.
-  const recent = useMemo(
-    () => (latest ?? []).slice(0, showBirthdaysSoon ? RECENT_MEETUPS_WITH_BIRTHDAYS : RECENT_MEETUPS),
-    [latest, showBirthdaysSoon],
-  )
   const nameById = useMemo(() => new Map((friends ?? []).map((friend) => [friend.id, friend.name] as const)), [friends])
   const typeById = useMemo(() => new Map((types ?? []).map((type) => [type.id, type] as const)), [types])
 
-  // Safari has no scroll anchoring, so when the groups above the search field hide or come back, the page
-  // scrolls by what went away or came back, before paint: the field stays where your eyes are. The browser clamps
-  // the scroll at the top and bottom of the page, so there the field can come to rest a little off, never off screen.
-  useLayoutEffect(() => {
-    const before = filtersTopBefore.current
-    filtersTopBefore.current = null
-    const filters = filtersRef.current
-    if (before === null || !filters) return
-    window.scrollBy(0, filters.getBoundingClientRect().top - before)
-  }, [unfiltered])
-
-  /** Before a search or chip change: notes where the field is when the change will hide or show the groups. */
-  function keepFiltersStill(nextUnfiltered: boolean) {
-    if (nextUnfiltered !== unfiltered && filtersRef.current) {
-      filtersTopBefore.current = filtersRef.current.getBoundingClientRect().top
-    }
-  }
-
   async function chooseSort() {
     const choice = await showActionSheet<FriendSort>({
       title: 'Sort friends by',
@@ -128,9 +102,9 @@ export function FriendsScreen() {
     }
   }
 
-  if (!friends || !groups || !meetups || !types || !latestWithPhotos || hintDismissed === undefined) return null
-
-  const moreBirthdays = birthdaysSoon.length - MAX_BIRTHDAYS_SOON
+  if (!friends || !groups || !meetups || !types || !latest || !latestWithPhotos || hintDismissed === undefined) {
+    return null
+  }
 
   return (
     <Page
@@ -167,42 +141,9 @@ export function FriendsScreen() {
         />
       ) : (
         <>
-          {showBirthdaysSoon && (
-            <InsetGroup
-              title="Birthdays soon"
-              footer={moreBirthdays > 0 ? `And ${moreBirthdays} more in the next two weeks.` : undefined}
-            >
-              {birthdaysSoon.slice(0, MAX_BIRTHDAYS_SOON).map(({ friend, birthday }) => (
-                <Row
-                  key={friend.id}
-                  to={`/friends/${friend.id}`}
-                  leading={<Avatar name={friend.name} photo={friend.photo} seed={friend.id} />}
-                  title={friend.name}
-                  subtitle={describeNextBirthday(birthday, today)}
-                />
-              ))}
-            </InsetGroup>
-          )}
-
-          {unfiltered && recent.length > 0 && (
-            <InsetGroup title="Recent meetups">
-              {recent.map((meetup) => (
-                <MeetupRow
-                  key={meetup.id}
-                  meetup={meetup}
-                  type={typeById.get(meetup.typeId)}
-                  names={meetupNames(meetup, nameById)}
-                  today={today}
-                  state={FROM_FRIENDS}
-                  hasPhoto={latestWithPhotos.has(meetup.id)}
-                  subtitleLines={2}
-                />
-              ))}
-              <Row to="/meetups" title="See all meetups" accent chevron />
-            </InsetGroup>
-          )}
-
-          <div className="friends-filters" ref={filtersRef}>
+          {/* Search and the chips come first, under the title, as in Contacts. Nothing above them ever hides, so
+              typing or tapping a chip never moves them. */}
+          <div className="friends-filters">
             <label className="search">
               <IconSearch size={18} />
               <input
@@ -212,11 +153,7 @@ export function FriendsScreen() {
                 aria-label="Search friends"
                 enterKeyHint="search"
                 value={query}
-                onChange={(event) => {
-                  const value = event.target.value
-                  keepFiltersStill(value.trim() === '' && activeGroup === null)
-                  setQuery(value)
-                }}
+                onChange={(event) => setQuery(event.target.value)}
                 onKeyDown={(event) => {
                   if (isPlainEnter(event)) event.currentTarget.blur()
                 }}
@@ -224,24 +161,11 @@ export function FriendsScreen() {
             </label>
             {groups.length > 0 && (
               <div className="chip-row" role="group" aria-label="Filter by group">
-                <Chip
-                  selected={activeGroup === null}
-                  onClick={() => {
-                    keepFiltersStill(query.trim() === '')
-                    setGroupFilter(null)
-                  }}
-                >
+                <Chip selected={activeGroup === null} onClick={() => setGroupFilter(null)}>
                   All
                 </Chip>
                 {groups.map((group) => (
-                  <Chip
-                    key={group.id}
-                    selected={activeGroup?.id === group.id}
-                    onClick={() => {
-                      keepFiltersStill(false)
-                      setGroupFilter(group.id)
-                    }}
-                  >
+                  <Chip key={group.id} selected={activeGroup?.id === group.id} onClick={() => setGroupFilter(group.id)}>
                     {group.name}
                   </Chip>
                 ))}
@@ -249,6 +173,32 @@ export function FriendsScreen() {
             )}
           </div>
 
+          {showBirthdaysSoon && <BirthdaysSoon birthdays={birthdaysSoon} friends={friends} today={today} />}
+
+          {unfiltered && latest.length > 0 && (
+            <InsetGroup
+              title="Recent meetups"
+              action={
+                <Link to="/meetups" className="group-action" aria-label="See all meetups">
+                  See all
+                </Link>
+              }
+            >
+              {latest.map((meetup) => (
+                <MeetupRow
+                  key={meetup.id}
+                  meetup={meetup}
+                  type={typeById.get(meetup.typeId)}
+                  names={meetupNames(meetup, nameById)}
+                  today={today}
+                  state={FROM_FRIENDS}
+                  hasPhoto={latestWithPhotos.has(meetup.id)}
+                  subtitleLines={2}
+                />
+              ))}
+            </InsetGroup>
+          )}
+
           {rows.length > 0 ? (
             <InsetGroup>
               {rows.map(({ friend, match, lastSeen, count }) => (
@@ -286,3 +236,45 @@ export function FriendsScreen() {
     </Page>
   )
 }
+
+interface BirthdaysSoonProps {
+  /** Every birthday today or in the next 14 days, soonest first, then by name. */
+  birthdays: UpcomingBirthday[]
+  /** Every friend, so a tile can tell whether its first name is shared. */
+  friends: Friend[]
+  today: ISODate
+}
+
+/**
+ * Birthdays soon: one row of tiles that scrolls sideways, each a link to the friend's page with the face, the short
+ * name and the countdown. A tile is named in full for VoiceOver, starting with the word it shows ("Brandon Cao, In 2
+ * days · turns 27"), so Voice Control's "Tap Brandon" works.
+ */
+function BirthdaysSoon({ birthdays, friends, today }: BirthdaysSoonProps) {
+  const titleId = useId()
+  return (
+    <section className="birthdays-soon" aria-labelledby={titleId}>
+      <h2 id={titleId} className="group-title">
+        Birthdays soon
+      </h2>
+      {/* role="list": Safari drops a list from VoiceOver once its bullets are styled away. */}
+      <ul className="birthday-strip snap-strip" role="list">
+        {birthdays.map(({ friend, birthday, daysUntil }) => (
+          <li key={friend.id}>
+            <Link
+              to={`/friends/${friend.id}`}
+              className="birthday-tile"
+              aria-label={`${friend.name}, ${describeNextBirthday(birthday, today)}`}
+            >
+              <Avatar name={friend.name} photo={friend.photo} seed={friend.id} />
+              <span className="birthday-tile__text">
+                <span className="birthday-tile__name">{shortName(friend, friends)}</span>
+                <span className="birthday-tile__when">{describeBirthdayCountdown(daysUntil)}</span>
+              </span>
+            </Link>
+          </li>
+        ))}
+      </ul>
+    </section>
+  )
+}
```

In `src/sheets/MeetupSheet.css`:

```diff
--- a/src/sheets/MeetupSheet.css
+++ b/src/sheets/MeetupSheet.css
@@ -9,24 +9,15 @@
   grid-template-columns: repeat(4, minmax(0, 1fr));
   gap: var(--space-3) var(--space-2);
 }
-/* A strip that scrolls clips what spills out of it, so 4px above and below (cancelled by the margin, so nothing
-   moves) hold a focused tile's ring: 2px wide, 2px out. */
+/* The swiping strip scrolls as .snap-strip (base.css) does. The 4px it keeps above and below for a focused tile's ring
+   are cancelled by its margin here, so nothing moves. */
 .friend-strip[data-swipes='true'] {
   grid-template-columns: none;
   grid-template-rows: repeat(2, auto);
   grid-auto-flow: column;
   grid-auto-columns: calc((100% - 3 * var(--space-2)) / 4.4);
-  margin: -4px calc(-1 * var(--space-4));
-  padding: 4px var(--space-4);
-  overflow-x: auto;
-  overscroll-behavior-x: contain;
+  margin-block: calc(-1 * var(--space-1));
   scroll-snap-type: x mandatory;
-  scroll-padding-inline: var(--space-4);
-  touch-action: pan-x pan-y;
-  scrollbar-width: none;
-}
-.friend-strip[data-swipes='true']::-webkit-scrollbar {
-  display: none;
 }
 .friend-strip[data-swipes='true'] .friend-tile {
   scroll-snap-align: start;
```

In `src/sheets/MeetupSheet.tsx`:

```diff
--- a/src/sheets/MeetupSheet.tsx
+++ b/src/sheets/MeetupSheet.tsx
@@ -303,7 +303,7 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
         </h3>
         {toPick.length > 0 && (
           <div
-            className="friend-strip"
+            className={toPick.length > STILL_GRID_MAX ? 'friend-strip snap-strip' : 'friend-strip'}
             data-swipes={toPick.length > STILL_GRID_MAX}
             role="group"
             aria-label="Friends"
```

In `src/stats/meetupHistory.ts`:

```diff
--- a/src/stats/meetupHistory.ts
+++ b/src/stats/meetupHistory.ts
@@ -7,10 +7,8 @@ import { groupByMonth, newestFirst } from './history'
 
 // Pure: no window, document or Intl of its own, so it's tested in Node with fixed dates.
 
-/** How many meetups Recent meetups shows on the Friends tab. */
-export const RECENT_MEETUPS = 3
-/** How many it shows while Birthdays soon is showing above it. */
-export const RECENT_MEETUPS_WITH_BIRTHDAYS = 2
+/** How many meetups Recent meetups shows on the Friends tab: the latest, on every day, so the friends show on open. */
+export const RECENT_MEETUPS = 1
 /** Rows the Meetups page shows at first, and how many each "Show older meetups" adds. */
 export const MEETUPS_PAGE_SIZE = 60
 
```

In `src/styles/base.css`:

```diff
--- a/src/styles/base.css
+++ b/src/styles/base.css
@@ -258,6 +258,22 @@ textarea.field {
   gap: var(--space-2);
 }
 
+/* A strip that scrolls sideways (the meetup sheet's swiping Who strip, Birthdays soon). It bleeds to the screen edges
+   like a chip row, so its first tile sits on the 16px margin and each tile snaps to it; 4px above and below hold a
+   focused tile's ring, which the scroller would clip. Each strip sets its own layout and how firmly it snaps. */
+.snap-strip {
+  margin-inline: calc(-1 * var(--space-4));
+  padding: var(--space-1) var(--space-4);
+  overflow-x: auto;
+  overscroll-behavior-x: contain;
+  scroll-padding-inline: var(--space-4);
+  touch-action: pan-x pan-y;
+  scrollbar-width: none;
+}
+.snap-strip::-webkit-scrollbar {
+  display: none;
+}
+
 /* A friend as a link: avatar and name in a Paper White pill (Stats, the Meetup page). */
 .person-chip {
   display: inline-flex;
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b` (no files written), then `npm test`
Expected: `Test Files  61 passed (61)` and `Tests  755 passed (755)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `203 passed`.

- [ ] **Step 5: Commit**

```bash
git add e2e/birthdays.spec.ts e2e/friends.spec.ts e2e/history.spec.ts src/components/InsetGroup.css src/components/InsetGroup.tsx src/lib/birthdays.test.ts src/lib/birthdays.ts src/lib/payers.test.ts src/lib/payers.ts src/lib/text.test.ts src/lib/text.ts src/screens/DayScreen.tsx src/screens/FriendsScreen.css src/screens/FriendsScreen.tsx src/sheets/MeetupSheet.css src/sheets/MeetupSheet.tsx src/stats/meetupHistory.test.ts src/stats/meetupHistory.ts src/styles/base.css
git commit -F - <<'EOF'
feat: the Friends tab opens on friends, with search at the top

Search and the group chips move up under the large title, as in Contacts.
Birthdays soon becomes one row of Paper White tiles that scrolls sideways
(face, short name and countdown, named in full for VoiceOver), holding every
birthday in the next 14 days. Recent meetups shows only the latest meetup,
with "See all" at the end of its title's line. Nothing above the search
field hides any more, so the scroll correction that kept it still is gone.
shortName moves to src/lib/text.ts for the tiles and "Who paid?",
describeBirthdayCountdown is split out of describeNextBirthday, and the Who
strip and the birthday strip share the .snap-strip scroller.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: The day page's Logged note, The day at the top, and the Place row

**Files:**
- Create: `src/lib/loggedUndo.ts`
- Modify: `src/components/Toast.css`, `src/components/Toast.tsx`, `src/hooks/useRevealFocusedField.ts`, `src/screens/DayHelperBar.tsx`, `src/screens/DayScreen.css`, `src/screens/DayScreen.tsx`, `src/styles/base.css`
- Test: `e2e/day.spec.ts`, `e2e/dayKeyboard.spec.ts`, `src/lib/loggedUndo.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

The note and its Undo (before and after the first change, and after the app lock), The day box aligning under the nav bar when the keyboard comes up, and the two-line Place row. `loggedUndo` gets unit tests.

In `e2e/day.spec.ts`:

```diff
--- a/e2e/day.spec.ts
+++ b/e2e/day.spec.ts
@@ -1,5 +1,5 @@
 import { readFile } from 'node:fs/promises'
-import { expect, test, type Page } from '@playwright/test'
+import { expect, test, type Locator, type Page } from '@playwright/test'
 import { OWNER_DAY_TYPED, OWNER_FEELINGS, OWNER_MESSAGE } from '../src/test/dayFixtures.ts'
 import {
   addFriend,
@@ -103,8 +103,14 @@ test('"Save and write about the day" logs the meetup and opens its day; Back lan
 
   await expect(sheet).toBeHidden()
   await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeFocused()
-  // The day page shows no toast: nothing covers the box you're about to write in.
+  // The day page shows no toast: nothing covers the box you're about to write in. It says so in its own note, above
+  // the context line, and VoiceOver hears it once.
   await expect(page.locator('.toast')).toHaveCount(0)
+  const note = page.locator('.day-logged')
+  await expect(note).toContainText('Logged with Mariya')
+  await expect(note.getByRole('button', { name: 'Undo' })).toBeVisible()
+  await expect(page.locator('.day-page__body > :first-child')).toHaveClass('day-logged')
+  await expect(announcement(page)).toHaveText('Logged with Mariya.')
   await dayBox(page).fill('Tacos')
   await page.getByRole('button', { name: 'Meal' }).click()
   await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
@@ -114,6 +120,72 @@ test('"Save and write about the day" logs the meetup and opens its day; Back lan
   await expect(page.getByRole('heading', { level: 1, name: 'Mariya' })).toBeVisible()
 })
 
+/** Adds Alex and logs a Coffee with "Save and write about the day", which opens its day page. */
+async function logAndWrite(page: Page) {
+  await addFriend(page, 'Alex')
+  await page.getByRole('button', { name: 'Log meetup' }).click()
+  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
+  await sheet.getByLabel('Search all friends').fill('Alex')
+  await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Alex', exact: true }).click()
+  await sheet.getByRole('button', { name: 'Coffee', exact: true }).click()
+  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
+  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
+  // Once the sheet has slid away, its own The day box with it.
+  await expect(page.locator('.sheet-layer')).toHaveCount(0)
+}
+
+/** Where a box sits in the day page's body, wherever the body is scrolled. */
+function topInBody(box: Locator) {
+  return box.evaluate((element) => {
+    const body = element.closest('.day-page__body')
+    if (!body) throw new Error('Not in the day page')
+    return element.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop
+  })
+}
+
+test('Undo in the Logged note takes the meetup away before anything is written, back to Friends', async ({ page }) => {
+  await page.goto('/')
+  await logAndWrite(page)
+
+  await page.locator('.day-logged').getByRole('button', { name: 'Undo' }).click()
+
+  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
+  await expect.poll(async () => (await readMeetups(page)).length).toBe(0)
+  await expect(page.getByRole('region', { name: 'Recent meetups' })).toHaveCount(0)
+})
+
+test('after the first change the Logged note has no Undo, and nothing below it moves', async ({ page }) => {
+  await page.goto('/')
+  await logAndWrite(page)
+  const note = page.locator('.day-logged')
+  const before = await topInBody(dayBox(page))
+
+  await dayBox(page).focus()
+  await page.keyboard.type('T')
+
+  await expect(note).toContainText('Logged with Alex')
+  await expect(note.getByRole('button', { name: 'Undo' })).toHaveCount(0)
+  expect(Math.abs((await topInBody(dayBox(page))) - before), 'The day stays put').toBeLessThanOrEqual(1)
+  await expect.poll(async () => (await readMeetups(page))[0]?.note).toBe('T')
+})
+
+test('a weather chip is a change too, and the note comes back after the app lock without its Undo', async ({ page }) => {
+  await page.goto('/')
+  await seedAppLock(page, '135790')
+  await logAndWrite(page)
+  const note = page.locator('.day-logged')
+  await page.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Rainy' }).click()
+  await expect(note.getByRole('button', { name: 'Undo' })).toHaveCount(0)
+  await expect.poll(async () => (await readMeetups(page))[0]?.weather).toEqual(['rainy'])
+
+  await reopenAfterAWhile(page)
+  await expect(lockHeading(page)).toBeVisible()
+  await enterPin(page, '135790')
+  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
+  await expect(note).toContainText('Logged with Alex')
+  await expect(note.getByRole('button', { name: 'Undo' })).toHaveCount(0)
+})
+
 test('a toast belongs to its page: following a link clears it', async ({ page }) => {
   await page.goto('/')
   await addFriend(page, 'Alex')
@@ -668,8 +740,9 @@ test('the owner’s example, written on the walk home, reads back as their day',
   await pickActivity(sheet, 'Movie')
   await pickActivity(sheet, 'Shopping')
 
-  // 2. "Save and write about the day": the day page slides in, with no toast over it.
+  // 2. "Save and write about the day": the day page slides in, saying so in its note, with no toast over it.
   await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
+  await expect(page.locator('.day-logged')).toContainText('Logged with Mariya, Jessie and Brandon')
   await expect(page.locator('.toast')).toHaveCount(0)
   await expect(page.getByRole('button', { name: 'Meal' })).toBeVisible()
   await expect(page.getByText('Sat, Oct 3 · with Mariya, Jessie and Brandon', { exact: true })).toBeVisible()
```

In `e2e/dayKeyboard.spec.ts`:

```diff
--- a/e2e/dayKeyboard.spec.ts
+++ b/e2e/dayKeyboard.spec.ts
@@ -130,6 +130,83 @@ test('The day comes into view when the keyboard opens, before any typing', async
   await expectLineShown(page, await lineSpan(dayBox(page), 1), 'The first line of The day')
 })
 
+test('The day goes to the top when the keyboard comes up for it, its top 12px under the nav bar', async ({ page }) => {
+  await openDayPage(page)
+  await tapFocus(dayBox(page))
+
+  await openKeyboard(page)
+
+  const at = await layout(page)
+  const box = await dayBox(page).boundingBox()
+  if (!box) throw new Error('The day is not on screen')
+  expect(Math.abs(box.y - (at.visibleTop + MARGIN)), 'Its top is 12px under the nav bar').toBeLessThanOrEqual(2)
+  await expectLineShown(page, await lineSpan(dayBox(page), 1), 'The caret’s line')
+})
+
+test('a long day tapped at its end shows the caret’s line instead of its top', async ({ page }) => {
+  await openDayPage(page)
+  const box = dayBox(page)
+  await box.fill(Array.from({ length: 60 }, (_, i) => `Line ${i + 1}`).join('\n'))
+  await tapFocus(box)
+  await box.press('End')
+
+  await openKeyboard(page)
+
+  await expectLineShown(page, await lastLineSpan(box), 'Line 60')
+})
+
+test('adding a place from the Place row hands focus back without moving The day', async ({ page }) => {
+  await openDayPage(page)
+  await tapFocus(dayBox(page))
+  await openKeyboard(page)
+  const top = async () => {
+    const box = await dayBox(page).boundingBox()
+    if (!box) throw new Error('The day is not on screen')
+    return box.y
+  }
+  const before = await top()
+  const helpers = page.getByRole('group', { name: 'Writing helpers' })
+  const place = helpers.getByRole('textbox', { name: 'Place and time' })
+
+  await helpers.getByRole('button', { name: 'Place', exact: true }).click()
+  await place.fill('nonstopstyle 10:30')
+  await place.press('Enter')
+
+  await expect(dayBox(page)).toBeFocused()
+  await expect(dayBox(page)).toHaveValue('@nonstopstyle 10:30\n')
+  await nextFrames(page)
+  expect(Math.abs((await top()) - before), 'The day stays put').toBeLessThanOrEqual(1)
+})
+
+test('the Place field takes the whole bar, with Now, Add, Close and "Hide keyboard" on a line under it', async ({
+  page,
+}) => {
+  await openDayPage(page)
+  await tapFocus(dayBox(page))
+  await openKeyboard(page)
+  const helpers = page.getByRole('group', { name: 'Writing helpers' })
+
+  await helpers.getByRole('button', { name: 'Place', exact: true }).click()
+  const place = helpers.getByRole('textbox', { name: 'Place and time' })
+  await expect(place).toBeFocused()
+  await place.fill('nonstopstyle 10:30')
+
+  const field = await place.boundingBox()
+  const bar = await page.locator('.day-page__footer').boundingBox()
+  if (!field || !bar) throw new Error('The Place row is not on screen')
+  expect(Math.abs(field.width - (bar.width - 32)), 'As wide as the bar less its sides').toBeLessThanOrEqual(2)
+  const below = helpers.getByRole('button')
+  await expect(below).toHaveCount(4)
+  const names = await below.evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label') ?? button.textContent))
+  expect(names, 'In the order they show').toEqual([expect.stringMatching(/^Now, /), 'Add', 'Close', 'Hide keyboard'])
+  for (const button of await below.all()) {
+    const box = await button.boundingBox()
+    if (!box) throw new Error('A button is not on screen')
+    expect(box.y, 'On the line under the field').toBeGreaterThanOrEqual(field.y + field.height)
+    await expect(button).toBeInViewport({ ratio: 1 })
+  }
+})
+
 test('typing new lines at the end of a long day keeps the caret’s line above the helper bar', async ({ page }) => {
   await openDayPage(page)
   const box = dayBox(page)
```

In `src/lib/loggedUndo.test.ts`:

```diff
--- /dev/null
+++ b/src/lib/loggedUndo.test.ts
@@ -0,0 +1,54 @@
+import { afterEach, describe, expect, it, vi } from 'vitest'
+
+afterEach(() => {
+  vi.unstubAllGlobals()
+  vi.resetModules()
+})
+
+/** A sessionStorage that keeps what it's given in a Map. */
+function fakeStorage() {
+  const items = new Map<string, string>()
+  return {
+    getItem: (key: string) => items.get(key) ?? null,
+    setItem: (key: string, value: string) => void items.set(key, value),
+    items,
+  }
+}
+
+describe('the Logged note’s Undo', () => {
+  it('is offered until a change spends it, for that meetup only', async () => {
+    const { loggedUndoSpent, spendLoggedUndo } = await import('./loggedUndo')
+    expect(loggedUndoSpent('m1')).toBe(false)
+    spendLoggedUndo('m1')
+    expect(loggedUndoSpent('m1')).toBe(true)
+    expect(loggedUndoSpent('m2')).toBe(false)
+  })
+
+  it('stays spent after a reload, through sessionStorage', async () => {
+    const storage = fakeStorage()
+    vi.stubGlobal('sessionStorage', storage)
+    const first = await import('./loggedUndo')
+    first.spendLoggedUndo('m1')
+    expect(JSON.parse(storage.items.get('friend-tracker:logged-undo-spent') ?? '[]')).toEqual(['m1'])
+
+    // A reload empties memory: a fresh copy of the module reads what was stored.
+    vi.resetModules()
+    const reloaded = await import('./loggedUndo')
+    expect(reloaded.loggedUndoSpent('m1')).toBe(true)
+    expect(reloaded.loggedUndoSpent('m2')).toBe(false)
+  })
+
+  it('keeps working in memory when sessionStorage throws', async () => {
+    vi.stubGlobal('sessionStorage', {
+      getItem: () => {
+        throw new Error('SecurityError')
+      },
+      setItem: () => {
+        throw new Error('QuotaExceededError')
+      },
+    })
+    const { loggedUndoSpent, spendLoggedUndo } = await import('./loggedUndo')
+    spendLoggedUndo('m1')
+    expect(loggedUndoSpent('m1')).toBe(true)
+  })
+})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/loggedUndo.test.ts`
Expected: FAIL, `src/lib/loggedUndo` does not exist yet.

- [ ] **Step 3: Implement**

The note in `DayScreen`, the spent Undo kept by `src/lib/loggedUndo.ts`, `data-reveal="start"` in `useRevealFocusedField` (with the existing `topOffset`), the Place field on a line of its own in `DayHelperBar`, and the toast's check shared as `.check-circle`.

In `src/components/Toast.css`:

```diff
--- a/src/components/Toast.css
+++ b/src/components/Toast.css
@@ -34,36 +34,6 @@
   }
 }
 
-.toast__check {
-  flex: none;
-  display: grid;
-  place-items: center;
-  width: 24px;
-  height: 24px;
-  border-radius: 50%;
-  background: var(--accent);
-  color: var(--on-accent);
-}
-.toast__check svg {
-  width: 16px;
-  height: 16px;
-  fill: none;
-  stroke: currentColor;
-  stroke-width: 3;
-  stroke-linecap: round;
-  stroke-linejoin: round;
-}
-.toast__check path {
-  stroke-dasharray: 1;
-  stroke-dashoffset: 1;
-  animation: draw-check 420ms var(--ease-out-quart) 120ms forwards;
-}
-@keyframes draw-check {
-  to {
-    stroke-dashoffset: 0;
-  }
-}
-
 .toast__message {
   padding: var(--space-2) var(--space-2) var(--space-2) 0;
   font-weight: 500;
@@ -82,8 +52,4 @@
   .toast {
     animation-name: fade-in;
   }
-  .toast__check path {
-    animation: none;
-    stroke-dashoffset: 0;
-  }
 }
```

In `src/components/Toast.tsx`:

```diff
--- a/src/components/Toast.tsx
+++ b/src/components/Toast.tsx
@@ -90,7 +90,7 @@ export function ToastProvider({ children }: { children: ReactNode }) {
               onPointerLeave={() => setPaused(false)}
             >
               {toast.tone !== 'plain' && (
-                <span className="toast__check" aria-hidden="true">
+                <span className="check-circle" aria-hidden="true">
                   <svg viewBox="0 0 24 24">
                     <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
                   </svg>
```

In `src/hooks/useRevealFocusedField.ts`:

```diff
--- a/src/hooks/useRevealFocusedField.ts
+++ b/src/hooks/useRevealFocusedField.ts
@@ -19,6 +19,11 @@ function topAligned(field: Element): HTMLElement | null {
   return field.closest<HTMLElement>('[data-reveal="top"]')
 }
 
+/** Whether a field is marked `data-reveal="start"`: The day page's The day box (see useRevealFocusedField). */
+function startAligned(field: Element): boolean {
+  return field.closest('[data-reveal="start"]') !== null
+}
+
 /**
  * Keeps the focused field on screen inside a sheet's (or the day page's) scrolling body. iOS shows a tapped
  * field while the sheet is still full height; then the keyboard comes up and the sheet shrinks above it (see
@@ -31,6 +36,12 @@ function topAligned(field: Element): HTMLElement | null {
  * the top of the view instead, that element's top its scroll margin below the header, so what comes up under it (the
  * search's results) gets all the room down to the keyboard. It goes there when it takes focus and whenever its text
  * changes, keyboard or not, and when the body shrinks; moving its caret moves nothing.
+ *
+ * A text box marked `data-reveal="start"` (The day page's The day) goes to the top once, when the keyboard comes up
+ * while it has focus: its top its scroll margin below the header, so the most of it shows, as long as the caret's line
+ * still shows there (a long day tapped near its end shows the caret's line instead). Typing and moving the caret then
+ * follow the caret as for any field. A helper row opening later (Who paid, Place) shrinks the body with the keyboard
+ * already up, so it never moves the box.
  */
 export function useRevealFocusedField(active: boolean, bodyRef: RefObject<HTMLElement | null>) {
   useEffect(() => {
@@ -42,11 +53,16 @@ export function useRevealFocusedField(active: boolean, bodyRef: RefObject<HTMLEl
      * browser's own focus scrolling and this agree at every text size); `onlyIfHidden` leaves it while all of
      * it shows.
      */
+    /** The part of the body on screen. */
+    const view = (): Span => {
+      const top = body.getBoundingClientRect().top + body.clientTop
+      return { top, bottom: top + body.clientHeight }
+    }
+
     const reveal = (onlyIfHidden: boolean) => {
       const field = document.activeElement
       if (!isEditable(field) || !body.contains(field)) return
-      const top = body.getBoundingClientRect().top + body.clientTop
-      const port = { top, bottom: top + body.clientHeight }
+      const port = view()
       const box = topAligned(field)
       if (box) {
         const offset = topOffset(port, box.getBoundingClientRect(), revealMargin(getComputedStyle(field).scrollMarginTop))
@@ -71,16 +87,41 @@ export function useRevealFocusedField(active: boolean, bodyRef: RefObject<HTMLEl
       if (offset !== 0) body.scrollTop += offset
     }
 
+    /**
+     * Scrolls a "start" box's top to its scroll margin under the top of the view, if the caret's line still shows
+     * there with its margin to spare. Says whether it did.
+     */
+    const alignStart = (field: HTMLElement): boolean => {
+      const port = view()
+      const style = getComputedStyle(field)
+      const wanted = topOffset(port, field.getBoundingClientRect(), revealMargin(style.scrollMarginTop))
+      // No further than the body can scroll.
+      const offset = Math.max(-body.scrollTop, Math.min(wanted, body.scrollHeight - body.clientHeight - body.scrollTop))
+      const line = field instanceof HTMLTextAreaElement ? caretLineSpan(field) : field.getBoundingClientRect()
+      const moved = { top: line.top - offset, bottom: line.bottom - offset }
+      if (revealOffset(port, moved, revealMargin(style.scrollMarginBottom)) !== 0) return false
+      if (offset !== 0) body.scrollTop += offset
+      return true
+    }
+
     // The body shrinks when the keyboard opens, as the sheet follows --keyboard-inset and
     // --viewport-height. This runs after that layout and before paint, so the field never shows hidden.
     // Growing (the keyboard closing) reveals nothing, so it never pulls the sheet back to a field someone has
     // scrolled away from.
     let lastHeight: number | null = null
+    // Whether the body has shrunk since the keyboard came up: only that first shrink can align a "start" box.
+    let shrankForKeyboard = false
     const observer = new ResizeObserver(() => {
       const height = body.clientHeight
       const shrank = lastHeight !== null && height < lastHeight
       lastHeight = height
-      if (shrank) reveal(false)
+      const keyboardUp = keyboardIsUp(window.innerHeight, window.visualViewport)
+      const keyboardCameUp = shrank && keyboardUp && !shrankForKeyboard
+      shrankForKeyboard = keyboardUp && (shrankForKeyboard || shrank)
+      if (!shrank) return
+      const field = document.activeElement
+      if (keyboardCameUp && isEditable(field) && body.contains(field) && startAligned(field) && alignStart(field)) return
+      reveal(false)
     })
     observer.observe(body)
 
```

In `src/lib/loggedUndo.ts`:

```diff
--- /dev/null
+++ b/src/lib/loggedUndo.ts
@@ -0,0 +1,35 @@
+// The day page's "Logged" note offers Undo until the first change on the page. A change ends it for good: when the
+// app lock or a reload brings the page back with its `logged` state, the note shows again but its Undo doesn't, so
+// one tap can never take away a day that was written. Kept for this tab's session: in memory, and in sessionStorage
+// when it can be used (a reload empties memory).
+
+const KEY = 'friend-tracker:logged-undo-spent'
+/** The most kept: only a day page just opened by "Save and write about the day" asks. */
+const KEPT = 20
+const spent = new Set<string>()
+
+function readStored(): string[] {
+  try {
+    const value: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? '[]')
+    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
+  } catch {
+    return []
+  }
+}
+
+/** Whether a change on this meetup's day page has already ended its "Logged" note's Undo. */
+export function loggedUndoSpent(meetupId: string): boolean {
+  return spent.has(meetupId) || readStored().includes(meetupId)
+}
+
+/** Ends the "Logged" note's Undo for this meetup, for the rest of the session. */
+export function spendLoggedUndo(meetupId: string): void {
+  if (spent.has(meetupId)) return
+  spent.add(meetupId)
+  try {
+    const ids = [...readStored().filter((id) => id !== meetupId), meetupId].slice(-KEPT)
+    sessionStorage.setItem(KEY, JSON.stringify(ids))
+  } catch {
+    // Memory alone still covers the app lock.
+  }
+}
```

In `src/screens/DayHelperBar.tsx`:

```diff
--- a/src/screens/DayHelperBar.tsx
+++ b/src/screens/DayHelperBar.tsx
@@ -45,9 +45,10 @@ function keepFocus(event: SyntheticEvent) {
 const keepFocusProps = { onPointerDown: keepFocus, onMouseDown: keepFocus }
 
 /**
- * The day page's helper bar, riding on the keyboard: "@ Place", "Now" (today only) and "Paid", or the Place field,
- * or the "Who paid?" chips. Close (for the Place and Who paid rows) and "Hide keyboard" (while the keyboard is up,
- * see DayScreen.css) are pinned at its end, outside the part that scrolls, so they're always on screen.
+ * The day page's helper bar, riding on the keyboard: "@ Place", "Now" (today only) and "Paid", or the Place field
+ * (across the whole bar, with "Now" and "Add" on a line under it), or the "Who paid?" chips. Close (for the Place and
+ * Who paid rows) and "Hide keyboard" (while the keyboard is up, see DayScreen.css) are pinned at its end, outside the
+ * part that scrolls, so they're always on screen.
  *
  * Every control's name starts with the word it shows, so Voice Control's "Tap Now" works: "Now" is named
  * "Now, 9:52 PM", and the "@" in "@ Place" is hidden from VoiceOver.
@@ -71,6 +72,22 @@ export function DayHelperBar(props: DayHelperBarProps) {
 
   return (
     <div className="day-helpers" role="group" aria-label="Writing helpers" data-row={shown ?? 'none'}>
+      {/* The Place field gets a line of its own, so a place and its time show whole as you type them. */}
+      {shown === 'place' && (
+        <input
+          ref={placeRef}
+          className="field day-place"
+          aria-label="Place and time"
+          placeholder="Place, then a time if you like"
+          autoCapitalize="none"
+          autoCorrect="off"
+          spellCheck={false}
+          enterKeyHint="next"
+          value={placeDraft}
+          onChange={(event) => props.onPlaceDraftChange(event.target.value)}
+          onKeyDown={onPlaceKeyDown}
+        />
+      )}
       <div className="day-helpers__row">
         {shown === 'helpers' && (
           <>
@@ -96,19 +113,6 @@ export function DayHelperBar(props: DayHelperBarProps) {
 
         {shown === 'place' && (
           <>
-            <input
-              ref={placeRef}
-              className="field day-place"
-              aria-label="Place and time"
-              placeholder="Place, then a time if you like"
-              autoCapitalize="none"
-              autoCorrect="off"
-              spellCheck={false}
-              enterKeyHint="next"
-              value={placeDraft}
-              onChange={(event) => props.onPlaceDraftChange(event.target.value)}
-              onKeyDown={onPlaceKeyDown}
-            />
             {now !== null && (
               <button
                 type="button"
```

In `src/screens/DayScreen.css`:

```diff
--- a/src/screens/DayScreen.css
+++ b/src/screens/DayScreen.css
@@ -62,6 +62,33 @@
 .day-page__body :is(input, textarea) {
   scroll-margin-block: var(--space-3);
 }
+/* The Logged note: a Paper White box with the toast's check, "Logged with Mariya and Jessie" and an Undo that lasts
+   until the first change on the page. Hidden once used up, Undo keeps its room, so the box keeps its height. */
+.day-logged {
+  display: flex;
+  align-items: center;
+  gap: var(--space-3);
+  min-height: var(--tap);
+  padding: var(--space-1) var(--space-1) var(--space-1) var(--space-4);
+  border-radius: var(--radius-group);
+  background: var(--surface);
+}
+.day-logged__message {
+  flex: 1;
+  min-width: 0;
+  margin: 0;
+  padding: var(--space-2) 0;
+  font-size: var(--text-subhead);
+  font-weight: 600;
+  overflow-wrap: anywhere;
+}
+.day-logged__undo {
+  flex: none;
+  font-weight: 600;
+}
+.day-logged__undo[data-gone='true'] {
+  visibility: hidden;
+}
 .day-page__context {
   margin: 0;
   color: var(--ink-2);
@@ -181,11 +208,19 @@ html:not(.keyboard-open) .day-page__footer[data-bare='true'] {
   opacity: 0.45;
   cursor: default;
 }
+/* The Place row: the field across the whole bar, then a line under it with Now at its start and Add, Close and
+   "Hide keyboard" at its end. The bar grows upward, like Who paid. */
+.day-helpers[data-row='place'] {
+  flex-wrap: wrap;
+  row-gap: var(--space-2);
+}
 .day-place.field {
-  flex: 1;
-  min-width: 6em;
+  width: 100%;
   height: var(--tap);
 }
+.day-helpers[data-row='place'] .day-helpers__add {
+  margin-left: auto;
+}
 
 @media (prefers-reduced-motion: reduce) {
   .day-page {
```

In `src/screens/DayScreen.tsx`:

```diff
--- a/src/screens/DayScreen.tsx
+++ b/src/screens/DayScreen.tsx
@@ -6,8 +6,9 @@ import { Chip } from '../components/Chip'
 import { GrowField } from '../components/GrowField'
 import { IconChevronLeft } from '../components/icons'
 import { MoodTiles } from '../components/MoodTiles'
+import type { NavState } from '../components/Page'
 import { useFriends, useMeetup, useMeetupTypes } from '../data/hooks'
-import { updateDay } from '../db/meetups'
+import { deleteMeetup, updateDay } from '../db/meetups'
 import { useAutosave } from '../hooks/useAutosave'
 import { useKeyboardInset } from '../hooks/useKeyboardInset'
 import { useRevealFocusedField } from '../hooks/useRevealFocusedField'
@@ -17,6 +18,7 @@ import { clockStyle, describeStopTime, typedClock } from '../lib/clock'
 import { formatDate } from '../lib/dates'
 import { changeBetween, insertAtCaret, insertPaidLine, insertPlaceLine, lineCaret, type DayEdit } from '../lib/dayEdit'
 import { BOX_FULL, DAY_MAX_TYPED, FEELINGS_MAX, readDay } from '../lib/dayText'
+import { loggedUndoSpent, spendLoggedUndo } from '../lib/loggedUndo'
 import { feelingsApply } from '../lib/moods'
 import { formatNameList, shortName } from '../lib/text'
 import { cleanWeather, WEATHER } from '../lib/weather'
@@ -43,6 +45,7 @@ function sameValue(a: DayFields[keyof DayFields], b: DayFields[keyof DayFields])
 }
 
 const SAVE_FAILED = "Couldn't save just now. Your words are still here, and the app will try again."
+const UNDO_FAILED = "Couldn't undo. Please try again."
 
 /** Minutes past midnight now, refreshed every 10 seconds (the "Now" chip's name follows the clock). */
 function useMinutesNow(): number {
@@ -95,7 +98,7 @@ export function DayScreen() {
     [location.key, navigate],
   )
 
-  // Deleted (another tab) or never there: go back, like the Meetup page does.
+  // Deleted (Undo in the Logged note, another tab) or never there: go back, like the Meetup page does.
   useEffect(() => {
     if (meetup === null) leave('/')
   }, [meetup, leave])
@@ -104,18 +107,23 @@ export function DayScreen() {
   const typeName = types.find((type) => type.id === meetup.typeId)?.name ?? 'Meetup'
   const friendById = new Map(friends.map((friend) => [friend.id, friend] as const))
   const people = meetup.friendIds.map((friendId) => friendById.get(friendId)).filter((f): f is Friend => !!f)
-  return <DayPage key={meetup.id} meetup={meetup} people={people} typeName={typeName} onLeave={leave} />
+  const logged = (location.state as NavState | null)?.logged === true
+  return (
+    <DayPage key={meetup.id} meetup={meetup} people={people} typeName={typeName} logged={logged} onLeave={leave} />
+  )
 }
 
 interface DayPageProps {
   meetup: Meetup
   people: Friend[]
   typeName: string
+  /** Opened by "Save and write about the day", just after the meetup was logged: the body starts with the Logged note. */
+  logged: boolean
   /** Goes back (once, however often it's called), or to `fallback` when the page was opened directly. */
   onLeave: (fallback: string) => void
 }
 
-function DayPage({ meetup, people, typeName, onLeave }: DayPageProps) {
+function DayPage({ meetup, people, typeName, logged, onLeave }: DayPageProps) {
   const today = useToday()
   const minutesNow = useMinutesNow()
   const confirmDiscard = useConfirmDiscard()
@@ -147,6 +155,11 @@ function DayPage({ meetup, people, typeName, onLeave }: DayPageProps) {
   const [feelingsRefused, setFeelingsRefused] = useState(false)
   // Back was tapped and is on its way out (saving first): another tap does nothing.
   const leavingRef = useRef(false)
+  // The Logged note's Undo: offered until the first change on the page (markChanged), even one made before the app
+  // lock brought the page back.
+  const [undoOffered, setUndoOffered] = useState(() => logged && !loggedUndoSpent(meetup.id))
+  const [undoFailed, setUndoFailed] = useState(false)
+  const loggedWith = people.length > 0 ? `Logged with ${formatNameList(people.map((friend) => friend.name))}` : 'Logged'
 
   const { saver, status } = useAutosave<DayFields>((changes) => updateDay(meetup.id, changes), {
     beforeHide: commitPlaceDraft,
@@ -167,6 +180,12 @@ function DayPage({ meetup, people, typeName, onLeave }: DayPageProps) {
     titleRef.current?.focus({ preventScroll: true })
   }, [])
 
+  // Then VoiceOver hears the Logged note once, through the page's announcer.
+  useEffect(() => {
+    if (logged) announce(`${loggedWith}.`)
+    // Once, as the page opens.
+  }, [])
+
   useEffect(() => {
     if (status.gone) onLeave('/')
   }, [status.gone, onLeave])
@@ -187,6 +206,7 @@ function DayPage({ meetup, people, typeName, onLeave }: DayPageProps) {
   }, [meetup, saver])
 
   function setField<K extends keyof DayFields>(key: K, value: DayFields[K], now: boolean) {
+    markChanged()
     fieldsRef.current = { ...fieldsRef.current, [key]: value }
     setFields(fieldsRef.current)
     const change: Partial<DayFields> = { [key]: value }
@@ -194,6 +214,27 @@ function DayPage({ meetup, people, typeName, onLeave }: DayPageProps) {
     else saver.change(change)
   }
 
+  /**
+   * The first change on the page (typing in either box, a weather chip, a face or any helper) ends the Logged note's
+   * Undo for good. The note stays; after this, the meetup goes with Edit, then "Delete meetup".
+   */
+  function markChanged() {
+    if (!logged) return
+    spendLoggedUndo(meetup.id)
+    setUndoOffered(false)
+    setUndoFailed(false)
+  }
+
+  /** Undo in the Logged note: nothing was written yet, so the meetup goes, and the page goes back with it. */
+  async function undoLogged() {
+    setUndoFailed(false)
+    try {
+      await deleteMeetup(meetup.id)
+    } catch {
+      setUndoFailed(true)
+    }
+  }
+
   function setFocus(field: 'note' | 'feelings' | null) {
     focusedRef.current = field
     setFocused(field)
@@ -290,6 +331,7 @@ function DayPage({ meetup, people, typeName, onLeave }: DayPageProps) {
   }
 
   function openPlace() {
+    markChanged()
     // The field has to be there to take focus inside this tap, so iOS raises (or keeps) the keyboard.
     flushSync(() => setRow('place'))
     placeRef.current?.focus()
@@ -328,6 +370,7 @@ function DayPage({ meetup, people, typeName, onLeave }: DayPageProps) {
   }
 
   function openPaid() {
+    markChanged()
     setRow('paid')
     announce('Pick who paid.')
   }
@@ -398,6 +441,35 @@ function DayPage({ meetup, people, typeName, onLeave }: DayPageProps) {
       </header>
 
       <div ref={bodyRef} className="day-page__body" onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}>
+        {/* "Save and write about the day" confirms here, never with a toast over the box being written in. */}
+        {logged && (
+          <div className="day-logged">
+            <span className="check-circle" aria-hidden="true">
+              <svg viewBox="0 0 24 24">
+                <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
+              </svg>
+            </span>
+            {undoFailed ? (
+              <p key="failed" className="day-logged__message" role="alert">
+                {UNDO_FAILED}
+              </p>
+            ) : (
+              <p key="logged" className="day-logged__message">
+                {loggedWith}
+              </p>
+            )}
+            {/* After the first change Undo is gone, but its room stays, so nothing below moves. */}
+            <button
+              type="button"
+              className="text-button day-logged__undo"
+              data-gone={!undoOffered}
+              onClick={() => void undoLogged()}
+            >
+              Undo
+            </button>
+          </div>
+        )}
+
         <p className="day-page__context">{context}</p>
 
         <section className="day-section" aria-labelledby={weatherId}>
@@ -421,8 +493,10 @@ function DayPage({ meetup, people, typeName, onLeave }: DayPageProps) {
           <p id={hintId} className="day-section__hint">
             Start a line with @ for each place, with a time if you like. Lines under a place go with it.
           </p>
+          {/* When the keyboard comes up for it, its top goes just under the nav bar (useRevealFocusedField). */}
           <GrowField
             ref={dayRef}
+            data-reveal="start"
             minLines={12}
             highlightPlaces
             aria-labelledby={dayId}
```

In `src/styles/base.css`:

```diff
--- a/src/styles/base.css
+++ b/src/styles/base.css
@@ -292,6 +292,38 @@ textarea.field {
   background: var(--surface-pressed);
 }
 
+/* The success check: a 24px Peach circle whose check draws itself in over 420ms (a toast, the day page's Logged
+   note). With Reduce Motion it's simply drawn. */
+.check-circle {
+  flex: none;
+  display: grid;
+  place-items: center;
+  width: 24px;
+  height: 24px;
+  border-radius: 50%;
+  background: var(--accent);
+  color: var(--on-accent);
+}
+.check-circle svg {
+  width: 16px;
+  height: 16px;
+  fill: none;
+  stroke: currentColor;
+  stroke-width: 3;
+  stroke-linecap: round;
+  stroke-linejoin: round;
+}
+.check-circle path {
+  stroke-dasharray: 1;
+  stroke-dashoffset: 1;
+  animation: draw-check 420ms var(--ease-out-quart) 120ms forwards;
+}
+@keyframes draw-check {
+  to {
+    stroke-dashoffset: 0;
+  }
+}
+
 /* A future meetup (the friend page's history, the Meetup page). */
 .upcoming-badge {
   display: inline-block;
@@ -369,4 +401,8 @@ textarea.field {
   .button:active:not(:disabled) {
     transform: none;
   }
+  .check-circle path {
+    animation: none;
+    stroke-dashoffset: 0;
+  }
 }
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b` (no files written), then `npm test`
Expected: `Test Files  62 passed (62)` and `Tests  758 passed (758)`.

Run: `npm run build`, then `npx playwright test --project=iphone e2e/day.spec.ts e2e/dayKeyboard.spec.ts e2e/sheetKeyboard.spec.ts e2e/sheetDetails.spec.ts`
Expected: the build passes, and these pass.

`day.spec.ts` and `dayKeyboard.spec.ts`: 42 passed; `sheetKeyboard.spec.ts` and `sheetDetails.spec.ts` (the same reveal hook): 35 passed. The full e2e runs after Task 4.

- [ ] **Step 5: Commit**

```bash
git add e2e/day.spec.ts e2e/dayKeyboard.spec.ts src/components/Toast.css src/components/Toast.tsx src/hooks/useRevealFocusedField.ts src/lib/loggedUndo.test.ts src/lib/loggedUndo.ts src/screens/DayHelperBar.tsx src/screens/DayScreen.css src/screens/DayScreen.tsx src/styles/base.css
git commit -F - <<'EOF'
feat: the day page says "Logged with" in its own note, and gives The day room to write

"Save and write about the day" now confirms with a quiet Paper White note
at the top of the day page: the toast's check, "Logged with Mariya and
Jessie" and an Undo that deletes the meetup. The Undo lasts until the first
change on the page (typing, a weather chip, a face or a helper), for good:
after the app lock or a reload the note comes back without it. Its room
stays, so nothing below moves, and VoiceOver hears the note once.

When the keyboard comes up for The day, its top goes 12px under the nav
bar (data-reveal="start" in useRevealFocusedField), as long as the caret's
line still shows; a helper row opening later never moves it. The Place row
gives the field the whole bar, with Now, Add, Close and Hide keyboard on a
line under it. The success check is shared as .check-circle.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Photos on the Meetup page

**Files:**
- Create: `src/components/PhotoAddTile.tsx`, `src/hooks/usePhotoAdder.ts`
- Modify: `src/db/meetups.ts`, `src/screens/MeetupScreen.css`, `src/screens/MeetupScreen.tsx`, `src/sheets/MeetupPhotos.tsx`, `src/sheets/MeetupSheet.css`, `src/styles/base.css`
- Test: `e2e/meetupPage.spec.ts`, `src/db/meetups.test.ts`

- [ ] **Step 1: Write the failing tests**

`addMeetupPhoto`, `removeMeetupPhotos` and the cache-backed `photoThumbs` (with spies on `get` and `bulkGet`); the Meetup page always shows Photos, between Activities and The day, and adds photos with an Undo.

In `e2e/meetupPage.spec.ts`:

```diff
--- a/e2e/meetupPage.spec.ts
+++ b/e2e/meetupPage.spec.ts
@@ -1,5 +1,18 @@
-import { expect, test } from '@playwright/test'
-import { addFriend, logMeetup, openDay, openFriendPage, readMeetups, tinyPhoto } from './helpers.ts'
+import { expect, test, type Page } from '@playwright/test'
+import {
+  addFriend,
+  brokenPhoto,
+  friendRow,
+  logMeetup,
+  meetupRow,
+  openDay,
+  openFriendPage,
+  photoRow,
+  readMeetupPhotos,
+  readMeetups,
+  seedMeetups,
+  tinyPhoto,
+} from './helpers.ts'
 
 /** Today as the app writes it in the current year ("Sat, Oct 3"). */
 function todayLabel(): string {
@@ -57,9 +70,13 @@ test('hides what a meetup does not have, and marks one that is upcoming', async
   await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
   await expect(page.getByText('Upcoming', { exact: true })).toBeVisible()
   await expect(page.getByRole('list', { name: 'With' }).getByRole('link')).toContainText(['Alex'])
-  for (const name of ['Activities', 'The day', 'How it felt', 'Photos']) {
+  for (const name of ['Activities', 'The day', 'How it felt']) {
     await expect(page.getByRole('region', { name, exact: true })).toHaveCount(0)
   }
+  // Photos always shows, here with only its Add photos tile.
+  const photos = page.getByRole('region', { name: 'Photos' })
+  await expect(photos.getByRole('button')).toHaveText(['Add photos'])
+  await expect(photos.getByRole('img')).toHaveCount(0)
   await expect(page.getByRole('link', { name: /^Write about the day/ })).toHaveAccessibleName(
     'Write about the day Places, what happened, how it felt',
   )
@@ -128,6 +145,90 @@ test('shows the weather in the hero and how it felt, and never in the history',
   await expect(row).not.toContainText('Good')
 })
 
+/** Opens the Meetup page of a Coffee with Alex logged today. */
+async function openCoffee(page: Page) {
+  await page.goto('/')
+  await addFriend(page, 'Alex')
+  await logMeetup(page, ['Alex'])
+  await page.getByRole('region', { name: 'Recent meetups' }).getByRole('link', { name: /^Coffee/ }).click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
+}
+
+test('the sections come in the order Activities, Photos, The day, How it felt, then the day row', async ({ page }) => {
+  await page.goto('/')
+  await addFriend(page, 'Alex')
+  await logMeetup(page, ['Alex'], { type: 'Meal', activities: ['Karaoke'], note: 'Tacos' })
+  await openFriendPage(page, 'Alex')
+  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
+  await openDay(page)
+  await page.getByRole('group', { name: 'Mood' }).getByRole('button', { name: 'Good' }).click()
+  await page.getByRole('button', { name: 'Meal' }).click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
+
+  await expect(page.locator('.page__body > .section > .group-title')).toHaveText([
+    'Activities',
+    'Photos',
+    'The day',
+    'How it felt',
+  ])
+  // The day row comes last.
+  await expect(page.locator('.page__body > .inset-group').last()).toContainText('Edit the day')
+})
+
+test('adds photos right from the Meetup page, and Undo takes the batch back', async ({ page }) => {
+  await openCoffee(page)
+  const photos = page.getByRole('region', { name: 'Photos' })
+  const thumbnails = photos.getByRole('img')
+  await expect(photos.getByRole('button', { name: 'Add photos' })).toBeVisible()
+
+  await page.locator('input[type="file"]').setInputFiles([tinyPhoto('one.png'), tinyPhoto('two.png')])
+
+  // Saved at once, with no Edit sheet.
+  await expect(thumbnails).toHaveCount(2)
+  await expect(thumbnails.nth(1)).toHaveAccessibleName('Photo 2 of 2')
+  await expect(page.getByRole('dialog')).toHaveCount(0)
+  await expect.poll(async () => (await readMeetupPhotos(page)).length).toBe(2)
+  const toast = page.getByRole('status')
+  await expect(toast).toContainText('Added 2 photos')
+  await expect(page.getByRole('button', { name: 'Edit', exact: true })).toBeEnabled()
+  // The last tile is still Add photos.
+  await expect(photos.getByRole('button').last()).toHaveAccessibleName('Add photos')
+
+  await toast.getByRole('button', { name: 'Undo' }).click()
+  await expect(thumbnails).toHaveCount(0)
+  await expect.poll(async () => (await readMeetupPhotos(page)).length).toBe(0)
+})
+
+test('a photo that cannot be read is skipped with a hint, and the rest are added', async ({ page }) => {
+  await openCoffee(page)
+  const photos = page.getByRole('region', { name: 'Photos' })
+  await page.locator('input[type="file"]').setInputFiles([tinyPhoto('one.png'), brokenPhoto()])
+  await expect(photos.getByRole('img')).toHaveCount(1)
+  await expect(photos.getByRole('alert')).toHaveText("1 photo couldn't be added.")
+  await expect(page.getByRole('status')).toContainText('Added 1 photo')
+})
+
+test('with 19 photos, choosing 3 adds 1 and says a meetup can have up to 20', async ({ page }) => {
+  await page.goto('/')
+  const meetup = meetupRow('coffee', '2026-10-01', ['alex'])
+  const nineteen = Array.from({ length: 19 }, (_, i) => ({ ...photoRow(`p${i}`, 'coffee'), order: i }))
+  await seedMeetups(page, { friends: [friendRow('alex', 'Alex')], meetups: [meetup], photos: nineteen })
+  await page.goto('/#/meetups/coffee')
+  const photos = page.getByRole('region', { name: 'Photos' })
+  await expect(photos.getByRole('img')).toHaveCount(19)
+
+  await page.locator('input[type="file"]').setInputFiles([tinyPhoto('a.png'), tinyPhoto('b.png'), tinyPhoto('c.png')])
+
+  await expect(photos.getByRole('img')).toHaveCount(20)
+  await expect(photos.getByRole('alert')).toHaveText('A meetup can have up to 20 photos.')
+  await expect(page.getByRole('status')).toContainText('Added 1 photo')
+  expect((await readMeetupPhotos(page)).find((photo) => !photo.id.startsWith('p'))?.order).toBe(19)
+
+  // Full: the tile says so instead of opening the picker.
+  await photos.getByRole('button', { name: 'Add photos' }).click()
+  await expect(photos.getByRole('alert')).toHaveText('A meetup can have up to 20 photos.')
+})
+
 test('redirects to Friends for an unknown meetup', async ({ page }) => {
   await page.goto('/#/meetups/nope')
   await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
```

In `src/db/meetups.test.ts`:

```diff
--- a/src/db/meetups.test.ts
+++ b/src/db/meetups.test.ts
@@ -5,6 +5,7 @@ import { ValidationError } from './errors'
 import { addFriend, deleteFriend } from './friends'
 import {
   addMeetup,
+  addMeetupPhoto,
   deleteMeetup,
   firstPhotoThumb,
   forgetPhotoThumbs,
@@ -12,6 +13,7 @@ import {
   meetupIdsWithPhotosAmong,
   photoCount,
   photoThumbs,
+  removeMeetupPhotos,
   restoreMeetup,
   updateDay,
   updateMeetup,
@@ -506,6 +508,119 @@ describe('the thumbnail cache', () => {
   })
 })
 
+describe('addMeetupPhoto', () => {
+  it('puts the photo after the last one, reading only index keys', async () => {
+    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: [] })
+    const gets = vi.spyOn(db.meetupPhotos, 'get')
+    const bulkGets = vi.spyOn(db.meetupPhotos, 'bulkGet')
+    expect(await addMeetupPhoto(meetup.id, newPhoto('c'))).toBe(true)
+    expect(gets).not.toHaveBeenCalled()
+    expect(bulkGets).not.toHaveBeenCalled()
+    gets.mockRestore()
+    bulkGets.mockRestore()
+    expect(await photoIds(meetup.id)).toEqual(['a', 'b', 'c'])
+    expect(await db.meetupPhotos.get('c')).toMatchObject({ ...newPhoto('c'), meetupId: meetup.id, order: 2 })
+  })
+
+  it('goes after the highest order, gaps and all, and starts a meetup without photos at 0', async () => {
+    const meetup = await addMeetup(base)
+    expect(await addMeetupPhoto(meetup.id, newPhoto('a'))).toBe(true)
+    expect(await db.meetupPhotos.get('a')).toMatchObject({ order: 0 })
+    await db.meetupPhotos.update('a', { order: 5 })
+    await addMeetupPhoto(meetup.id, newPhoto('b'))
+    expect(await db.meetupPhotos.get('b')).toMatchObject({ order: 6 })
+    expect(await photoIds(meetup.id)).toEqual(['a', 'b'])
+  })
+
+  it('refuses a 21st photo and a photo that is not an image, and adds nothing to a deleted meetup', async () => {
+    const twenty = Array.from({ length: 20 }, (_, i) => newPhoto(`p${i}`))
+    const full = await addMeetup(base, { add: twenty, removeIds: [], order: [] })
+    await expect(addMeetupPhoto(full.id, newPhoto('one-more'))).rejects.toThrow('A meetup can have up to 20 photos.')
+    expect(await db.meetupPhotos.count()).toBe(20)
+
+    const other = await addMeetup(base)
+    const bad = { ...newPhoto('bad'), full: 'https://example.com/a.jpg' }
+    await expect(addMeetupPhoto(other.id, bad)).rejects.toThrow("A photo couldn't be saved.")
+
+    await deleteMeetup(other.id)
+    expect(await addMeetupPhoto(other.id, newPhoto('late'))).toBe(false)
+    expect(await db.meetupPhotos.get('late')).toBeUndefined()
+  })
+
+  it('keeps the new thumbnail, so the grid that shows it next reads no image', async () => {
+    const meetup = await addMeetup(base, { add: [newPhoto('a')], removeIds: [], order: [] })
+    expect(await photoThumbs(meetup.id)).toHaveLength(1)
+    await addMeetupPhoto(meetup.id, newPhoto('b'))
+    const bulkGets = vi.spyOn(db.meetupPhotos, 'bulkGet')
+    expect((await photoThumbs(meetup.id)).map((photo) => photo.id)).toEqual(['a', 'b'])
+    expect(bulkGets).not.toHaveBeenCalled()
+    bulkGets.mockRestore()
+  })
+})
+
+describe('removeMeetupPhotos', () => {
+  it('deletes only the listed photos of that meetup, and forgets their thumbnails', async () => {
+    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b'), newPhoto('c')], removeIds: [], order: [] })
+    const other = await addMeetup(base, { add: [newPhoto('x')], removeIds: [], order: [] })
+    expect(await photoThumbs(meetup.id)).toHaveLength(3)
+
+    await removeMeetupPhotos(meetup.id, ['b', 'c', 'x', 'gone'])
+
+    expect(await photoIds(meetup.id)).toEqual(['a'])
+    expect(await photoIds(other.id)).toEqual(['x'])
+    // Ids are never reused in the app; reusing one here shows the cache let go of the old thumbnail.
+    const again = { ...newPhoto('b'), thumb: 'data:image/jpeg;base64,THUMBagain' }
+    await db.meetupPhotos.add({ ...again, meetupId: meetup.id, order: 1, createdAt: '2026-09-01T12:00:00.000Z' })
+    expect((await photoThumbs(meetup.id)).map((photo) => photo.thumb)).toEqual([
+      'data:image/jpeg;base64,THUMBa',
+      'data:image/jpeg;base64,THUMBagain',
+    ])
+  })
+
+  it('reads no image', async () => {
+    const meetup = await addMeetup(base, { add: [newPhoto('a')], removeIds: [], order: [] })
+    const gets = vi.spyOn(db.meetupPhotos, 'get')
+    const bulkGets = vi.spyOn(db.meetupPhotos, 'bulkGet')
+    await removeMeetupPhotos(meetup.id, ['a'])
+    expect(gets).not.toHaveBeenCalled()
+    expect(bulkGets).not.toHaveBeenCalled()
+    gets.mockRestore()
+    bulkGets.mockRestore()
+    expect(await db.meetupPhotos.count()).toBe(0)
+  })
+})
+
+describe('photoThumbs', () => {
+  it('gives ids and thumbnails in order, and reads each photo once', async () => {
+    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: ['b', 'a'] })
+    const bulkGets = vi.spyOn(db.meetupPhotos, 'bulkGet')
+    expect(await photoThumbs(meetup.id)).toEqual([
+      { id: 'b', thumb: 'data:image/jpeg;base64,THUMBb' },
+      { id: 'a', thumb: 'data:image/jpeg;base64,THUMBa' },
+    ])
+    expect(bulkGets).toHaveBeenCalledTimes(1)
+    await photoThumbs(meetup.id)
+    expect(bulkGets, 'A second call reads no record').toHaveBeenCalledTimes(1)
+
+    // A reorder changes only the order the ids come in.
+    await updateMeetup(meetup.id, base, { add: [], removeIds: [], order: ['a', 'b'] })
+    expect((await photoThumbs(meetup.id)).map((photo) => photo.id)).toEqual(['a', 'b'])
+    expect(bulkGets).toHaveBeenCalledTimes(1)
+
+    // A photo added by the sheet: only its record is read.
+    await updateMeetup(meetup.id, base, { add: [newPhoto('c')], removeIds: [], order: [] })
+    expect((await photoThumbs(meetup.id)).map((photo) => photo.id)).toEqual(['a', 'b', 'c'])
+    expect(bulkGets).toHaveBeenCalledTimes(2)
+    expect(bulkGets).toHaveBeenLastCalledWith(['c'])
+    bulkGets.mockRestore()
+  })
+
+  it('gives none for a meetup without photos', async () => {
+    const meetup = await addMeetup(base)
+    expect(await photoThumbs(meetup.id)).toEqual([])
+  })
+})
+
 describe('meetupIdsWithPhotos', () => {
   it('names each meetup with photos once, without reading a photo', async () => {
     const three = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b'), newPhoto('c')], removeIds: [], order: [] })
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/db/meetups.test.ts`
Expected: 7 FAIL (`addMeetupPhoto` and `removeMeetupPhotos` don't exist, and `photoThumbs` reads every record).

- [ ] **Step 3: Implement**

The data functions, the shared `usePhotoAdder` and `PhotoAddTile`, the sheet's `MeetupPhotos` on top of them, and the Meetup page's Photos section.

In `src/components/PhotoAddTile.tsx`:

```diff
--- /dev/null
+++ b/src/components/PhotoAddTile.tsx
@@ -0,0 +1,45 @@
+import type { PhotoAdder } from '../hooks/usePhotoAdder'
+import { IconCameraPlus } from './icons'
+
+/**
+ * The Add photos tile, last in a photo grid, with the picker it opens. While a batch is added it reads "Adding 2 of
+ * 5…" and is aria-disabled, never disabled, so focus stays on it.
+ */
+export function PhotoAddTile({ adder }: { adder: PhotoAdder }) {
+  const { progress, message } = adder
+  return (
+    <li className="photo-tile">
+      <button
+        type="button"
+        className="photo-add"
+        aria-disabled={progress !== null}
+        aria-describedby={message ? adder.messageId : undefined}
+        onClick={adder.open}
+      >
+        <IconCameraPlus size={26} />
+        <span>{progress ? `Adding ${progress.current} of ${progress.total}…` : 'Add photos'}</span>
+      </button>
+      <input
+        ref={adder.inputRef}
+        type="file"
+        accept="image/*"
+        multiple
+        className="visually-hidden"
+        tabIndex={-1}
+        aria-hidden="true"
+        onChange={adder.onChange}
+      />
+    </li>
+  )
+}
+
+/** Why some photos weren't added, under the grid: a Footnote hint (never red), said as it appears. */
+export function PhotoAddHint({ adder }: { adder: PhotoAdder }) {
+  const { message } = adder
+  if (!message) return null
+  return (
+    <p key={message.n} id={adder.messageId} className="field-hint" role="alert">
+      {message.text}
+    </p>
+  )
+}
```

In `src/db/meetups.ts`:

```diff
--- a/src/db/meetups.ts
+++ b/src/db/meetups.ts
@@ -193,6 +193,48 @@ export async function deleteMeetup(id: string): Promise<DeletedMeetup | undefine
   return deleted
 }
 
+/**
+ * Adds one photo after a meetup's others, in one transaction: the Meetup page's Add photos tile saves each photo the
+ * moment it's ready. Reads only the [meetupId+order] index keys of the meetup's photos (how many, and the last order),
+ * never an image. Resolves false when the meetup is gone; refuses a 21st photo with TOO_MANY_PHOTOS. Its thumbnail is
+ * kept in memory, so the grid that shows it next reads no image either.
+ */
+export async function addMeetupPhoto(meetupId: string, photo: NewPhoto): Promise<boolean> {
+  if (!photo.id || !isValidPhotoData(photo)) throw new ValidationError(PHOTO_NOT_SAVED)
+  const added = await db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
+    if (!(await db.meetups.get(meetupId))) return false
+    // Each key is [meetupId, order], in order: how many there are, and the last order.
+    const keys = await db.meetupPhotos
+      .where('[meetupId+order]')
+      .between([meetupId, -Infinity], [meetupId, Infinity])
+      .keys()
+    if (keys.length >= MAX_PHOTOS) throw new ValidationError(TOO_MANY_PHOTOS)
+    const last = keys.at(-1)
+    const order = Array.isArray(last) && typeof last[1] === 'number' ? last[1] + 1 : 0
+    const { id, full, thumb, width, height } = photo
+    await db.meetupPhotos.add({ id, meetupId, order, full, thumb, width, height, createdAt: new Date().toISOString() })
+    return true
+  })
+  if (added) cacheThumb(photo.id, photo.thumb)
+  return added
+}
+
+/**
+ * Undo for photos added on the Meetup page: deletes these photos of this meetup (others' are ignored) and forgets
+ * their thumbnails. Reads only the meetup's photo ids, never an image. The orders left with gaps are fine: an order
+ * is only ever compared.
+ */
+export async function removeMeetupPhotos(meetupId: string, ids: readonly string[]): Promise<void> {
+  const listed = new Set(ids)
+  const removed = await db.transaction('rw', db.meetupPhotos, async () => {
+    const own = (await db.meetupPhotos.where('meetupId').equals(meetupId).primaryKeys()) as string[]
+    const doomed = own.filter((id) => listed.has(id))
+    await db.meetupPhotos.bulkDelete(doomed)
+    return doomed
+  })
+  forgetThumbs(removed)
+}
+
 /**
  * Undo: puts a meetup and its photos back, dropping friends who were deleted since.
  * Does nothing if it would be empty or its type is gone.
@@ -296,14 +338,35 @@ export async function meetupIdsWithPhotosAmong(meetupIds: readonly string[]): Pr
   return new Set(meetupIds.filter((_, i) => firsts[i] !== undefined))
 }
 
-/** A meetup's photos as ids and thumbnails, in order. Never returns a full image (see firstPhotoThumb). */
+/**
+ * A meetup's photos as ids and thumbnails, in order. The ids come key-only from [meetupId+order]; each thumbnail
+ * comes from the cache, and only the photos it doesn't hold are read (once each), so a live query that runs again
+ * after a photo is added reads that one photo, not them all. Never returns a full image (see firstPhotoThumb).
+ */
 export async function photoThumbs(meetupId: string): Promise<Pick<MeetupPhoto, 'id' | 'thumb'>[]> {
-  const ids = await db.meetupPhotos.where('meetupId').equals(meetupId).primaryKeys()
-  const rows = await db.meetupPhotos.bulkGet(ids)
-  return rows
-    .filter((row): row is MeetupPhoto => !!row)
-    .sort((a, b) => a.order - b.order)
-    .map(({ id, thumb }) => ({ id, thumb }))
+  const ids = (await db.meetupPhotos
+    .where('[meetupId+order]')
+    .between([meetupId, -Infinity], [meetupId, Infinity])
+    .primaryKeys()) as string[]
+  const thumbs = new Map<string, string>()
+  const missing: string[] = []
+  for (const id of ids) {
+    const thumb = cachedThumb(id)
+    if (thumb === undefined) missing.push(id)
+    else thumbs.set(id, thumb)
+  }
+  if (missing.length > 0) {
+    // IndexedDB can't read part of a record, so these read their full images too, and drop them at once.
+    for (const row of await db.meetupPhotos.bulkGet(missing)) {
+      if (!row) continue
+      cacheThumb(row.id, row.thumb)
+      thumbs.set(row.id, row.thumb)
+    }
+  }
+  return ids.flatMap((id) => {
+    const thumb = thumbs.get(id)
+    return thumb === undefined ? [] : [{ id, thumb }]
+  })
 }
 
 /** One photo with its full image, or null: the viewer reads only the photo it shows. */
```

In `src/hooks/usePhotoAdder.ts`:

```diff
--- /dev/null
+++ b/src/hooks/usePhotoAdder.ts
@@ -0,0 +1,122 @@
+import { useEffect, useId, useRef, useState, type ChangeEvent, type RefObject } from 'react'
+import type { NewPhoto } from '../db/meetups'
+import { newId } from '../lib/ids'
+import { processPhoto } from '../lib/image'
+import { describeSkippedPhotos, isValidPhotoData, TOO_MANY_PHOTOS } from '../lib/photos'
+
+const NOT_SAVED = "A photo couldn't be saved."
+
+export interface PhotoAdderOptions {
+  /** How many more photos fit: 20 less those the meetup has. */
+  room: number
+  /**
+   * Keeps one resized photo: the meetup sheet adds it to its draft, the Meetup page saves it. Resolving false stops
+   * the batch quietly (the meetup is gone); throwing stops it with "A photo couldn't be saved.".
+   */
+  onPhoto: (photo: NewPhoto) => boolean | void | Promise<boolean | void>
+  /** False once the sheet closes or the page goes: the batch stops after the photo in hand, and says nothing. */
+  active: boolean
+  /** True from the first photo of a batch to its end (the sheet's Save and the page's Edit wait). */
+  onBusyChange?: (busy: boolean) => void
+  /** At the end of a batch that wasn't stopped by `active`: the ids of the photos kept, in order. */
+  onDone?: (ids: string[]) => void
+}
+
+export interface PhotoAdder {
+  /** Opens the picker, or says there's no room. */
+  open: () => void
+  inputRef: RefObject<HTMLInputElement | null>
+  onChange: (event: ChangeEvent<HTMLInputElement>) => void
+  /** Which photo of the batch is being added. */
+  progress: { current: number; total: number } | null
+  /** Why some weren't added, under the grid; `n` makes the same words again a new alert. */
+  message: { text: string; n: number } | null
+  messageId: string
+  clearMessage: () => void
+}
+
+/**
+ * The Add photos tile's picker and its one-at-a-time loop, shared by the meetup sheet and the Meetup page. Each
+ * chosen photo is resized (1600px and 320px JPEGs) and handed to `onPhoto` before the next is read, so the loop holds
+ * at most one photo's full image (the sheet then keeps its own until Save).
+ */
+export function usePhotoAdder({ room, onPhoto, active, onBusyChange, onDone }: PhotoAdderOptions): PhotoAdder {
+  const inputRef = useRef<HTMLInputElement>(null)
+  const messageId = useId()
+  const busyRef = useRef(false)
+  const activeRef = useRef(active)
+  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
+  const [message, setMessage] = useState<{ text: string; n: number } | null>(null)
+
+  useEffect(() => {
+    activeRef.current = active
+  }, [active])
+  // A full unmount (leaving the page, a relock) stops the loop too.
+  useEffect(
+    () => () => {
+      activeRef.current = false
+    },
+    [],
+  )
+
+  function showMessage(text: string | null) {
+    setMessage((current) => (text === null ? null : { text, n: (current?.n ?? 0) + 1 }))
+  }
+
+  function open() {
+    if (busyRef.current) return
+    if (room <= 0) {
+      showMessage(TOO_MANY_PHOTOS)
+      return
+    }
+    inputRef.current?.click()
+  }
+
+  async function onChange(event: ChangeEvent<HTMLInputElement>) {
+    const files = Array.from(event.target.files ?? [])
+    event.target.value = ''
+    if (files.length === 0 || busyRef.current) return
+    // The first ones that fit are added.
+    const chosen = files.slice(0, Math.max(0, room))
+    const skipped = files.length - chosen.length
+    const added: string[] = []
+    let failed = 0
+    let notSaved = false
+    busyRef.current = true
+    onBusyChange?.(true)
+    showMessage(null)
+    try {
+      for (const [index, file] of chosen.entries()) {
+        if (!activeRef.current) return
+        setProgress({ current: index + 1, total: chosen.length })
+        let photo: NewPhoto
+        try {
+          const processed = await processPhoto(file)
+          if (!isValidPhotoData(processed)) throw new Error('The photo is too large')
+          photo = { id: newId(), ...processed }
+        } catch {
+          failed += 1
+          continue
+        }
+        try {
+          if ((await onPhoto(photo)) === false) return
+        } catch {
+          // A write that fails stops the batch; the photos kept before it stay.
+          notSaved = true
+          break
+        }
+        added.push(photo.id)
+      }
+    } finally {
+      busyRef.current = false
+      setProgress(null)
+      onBusyChange?.(false)
+    }
+    if (!activeRef.current) return
+    const problems = [describeSkippedPhotos(skipped, failed), notSaved ? NOT_SAVED : null].filter(Boolean)
+    showMessage(problems.length > 0 ? problems.join(' ') : null)
+    onDone?.(added)
+  }
+
+  return { open, inputRef, onChange, progress, message, messageId, clearMessage: () => showMessage(null) }
+}
```

In `src/screens/MeetupScreen.css`:

```diff
--- a/src/screens/MeetupScreen.css
+++ b/src/screens/MeetupScreen.css
@@ -114,6 +114,12 @@
   overflow-wrap: anywhere;
 }
 
+/* Photos: the grid, then the adder's hint under it. */
+.meetup-photos {
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-2);
+}
 /* A thumbnail opens the photo viewer. */
 .photo-tile__open {
   display: block;
```

In `src/screens/MeetupScreen.tsx`:

```diff
--- a/src/screens/MeetupScreen.tsx
+++ b/src/screens/MeetupScreen.tsx
@@ -4,19 +4,27 @@ import { Avatar } from '../components/Avatar'
 import { DayView } from '../components/DayView'
 import { InsetGroup, Row, Section } from '../components/InsetGroup'
 import { Page, type NavState } from '../components/Page'
+import { PhotoAddHint, PhotoAddTile } from '../components/PhotoAddTile'
 import { PhotoViewer } from '../components/PhotoViewer'
+import { useToast } from '../components/Toast'
 import { useFriends, useMeetup, useMeetupPhotoThumbs, useMeetupTypes } from '../data/hooks'
+import { addMeetupPhoto, removeMeetupPhotos } from '../db/meetups'
+import { usePhotoAdder } from '../hooks/usePhotoAdder'
 import { useToday } from '../hooks/useToday'
 import { formatDate } from '../lib/dates'
 import { isDayEmpty, readDay } from '../lib/dayText'
 import { feelingsApply, moodInfo } from '../lib/moods'
-import { displayText } from '../lib/text'
+import { askToKeepData } from '../lib/persist'
+import { MAX_PHOTOS } from '../lib/photos'
+import { displayText, plural } from '../lib/text'
 import { weatherInfo } from '../lib/weather'
 import { useSheets } from '../sheets/sheetsContext'
 import type { Friend } from '../types'
 import './MeetupScreen.css'
 
-/** The memory view of one meetup: what, when, who, what you did, the day, how it felt and the photos. */
+const UNDO_FAILED = "Couldn't undo. Please try again."
+
+/** The memory view of one meetup: what, when, who, what you did, the photos, the day and how it felt. */
 export function MeetupScreen() {
   const { id } = useParams()
   const meetup = useMeetup(id)
@@ -32,6 +40,28 @@ export function MeetupScreen() {
   // The photo open in the viewer, by position. Its thumbnail takes focus back when the viewer closes.
   const [viewing, setViewing] = useState<number | null>(null)
   const thumbnails = useRef<(HTMLButtonElement | null)[]>([])
+  const toast = useToast()
+  // While photos are being added, Edit waits, so the sheet never opens on a photo list about to change.
+  const [addingPhotos, setAddingPhotos] = useState(false)
+  // Add photos saves each photo the moment it's ready, and the live query shows it at once.
+  const adder = usePhotoAdder({
+    room: MAX_PHOTOS - (photos?.length ?? 0),
+    active: true,
+    onBusyChange: setAddingPhotos,
+    onPhoto: (photo) => (id ? addMeetupPhoto(id, photo) : false),
+    onDone: (ids) => {
+      if (!id || ids.length === 0) return
+      // Photos take real space, so ask Safari to keep the data when the phone runs low (best effort).
+      void askToKeepData()
+      toast({
+        message: `Added ${plural(ids.length, 'photo')}`,
+        actionLabel: 'Undo',
+        onAction: () => {
+          removeMeetupPhotos(id, ids).catch(() => toast({ message: UNDO_FAILED, tone: 'plain' }))
+        },
+      })
+    },
+  })
 
   // Deleted from the sheet (or never there): go back, like the friend page does for a deleted friend.
   useEffect(() => {
@@ -69,7 +99,12 @@ export function MeetupScreen() {
       back={{ label: 'Back', fallback: '/' }}
       pushed
       actions={
-        <button type="button" className="text-button" onClick={() => openMeetupSheet({ meetup })}>
+        <button
+          type="button"
+          className="text-button"
+          disabled={addingPhotos}
+          onClick={() => openMeetupSheet({ meetup })}
+        >
           Edit
         </button>
       }
@@ -129,6 +164,34 @@ export function MeetupScreen() {
         </Section>
       )}
 
+      {/* Always here, ending with Add photos; removing and reordering stay in the Edit sheet. */}
+      <Section title="Photos">
+        <div className="meetup-photos">
+          <ul className="photo-grid">
+            {photos.map((photo, index) => (
+              <li key={photo.id} className="photo-tile">
+                <button
+                  ref={(element) => {
+                    thumbnails.current[index] = element
+                  }}
+                  type="button"
+                  className="photo-tile__open"
+                  onClick={() => setViewing(index)}
+                >
+                  <img
+                    className="photo-tile__image"
+                    src={photo.thumb}
+                    alt={`Photo ${index + 1} of ${photos.length}`}
+                  />
+                </button>
+              </li>
+            ))}
+            <PhotoAddTile adder={adder} />
+          </ul>
+          <PhotoAddHint adder={adder} />
+        </div>
+      </Section>
+
       {dayParts.length > 0 && (
         <Section title="The day">
           <DayView parts={dayParts} people={people} />
@@ -169,31 +232,6 @@ export function MeetupScreen() {
         />
       </InsetGroup>
 
-      {photos.length > 0 && (
-        <Section title="Photos">
-          <ul className="photo-grid">
-            {photos.map((photo, index) => (
-              <li key={photo.id} className="photo-tile">
-                <button
-                  ref={(element) => {
-                    thumbnails.current[index] = element
-                  }}
-                  type="button"
-                  className="photo-tile__open"
-                  onClick={() => setViewing(index)}
-                >
-                  <img
-                    className="photo-tile__image"
-                    src={photo.thumb}
-                    alt={`Photo ${index + 1} of ${photos.length}`}
-                  />
-                </button>
-              </li>
-            ))}
-          </ul>
-        </Section>
-      )}
-
       {viewing !== null && (
         <PhotoViewer
           photos={photos}
```

In `src/sheets/MeetupPhotos.tsx`:

```diff
--- a/src/sheets/MeetupPhotos.tsx
+++ b/src/sheets/MeetupPhotos.tsx
@@ -1,9 +1,9 @@
-import { useEffect, useId, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react'
-import { IconCameraPlus, IconClose } from '../components/icons'
+import { useEffect, useId, useRef, useState, type Dispatch, type SetStateAction } from 'react'
+import { PhotoAddHint, PhotoAddTile } from '../components/PhotoAddTile'
+import { IconClose } from '../components/icons'
 import type { NewPhoto } from '../db/meetups'
-import { newId } from '../lib/ids'
-import { processPhoto } from '../lib/image'
-import { describeSkippedPhotos, isValidPhotoData, MAX_PHOTOS, TOO_MANY_PHOTOS } from '../lib/photos'
+import { usePhotoAdder } from '../hooks/usePhotoAdder'
+import { MAX_PHOTOS } from '../lib/photos'
 import { plural } from '../lib/text'
 
 /** A photo in the meetup sheet: a saved one (its id and thumbnail), or a new one waiting for Save. */
@@ -26,27 +26,22 @@ interface MeetupPhotosProps {
 /** The meetup sheet's Photos section: a grid of thumbnails with remove buttons, and the Add photos tile. */
 export function MeetupPhotos({ photos, setPhotos, onBusyChange, open }: MeetupPhotosProps) {
   const labelId = useId()
-  const messageId = useId()
-  const fileInput = useRef<HTMLInputElement>(null)
   const gridRef = useRef<HTMLUListElement>(null)
-  const busyRef = useRef(false)
-  const openRef = useRef(open)
-  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
-  const [message, setMessage] = useState<{ text: string; n: number } | null>(null)
-  const [announcement, setAnnouncement] = useState('')
+  const [announcement, setAnnouncement] = useState({ text: '', n: 0 })
   // After a remove, focus goes to the remove button that took its place (else the one before, else Add photos).
   const pendingFocus = useRef<number | null>(null)
-
-  useEffect(() => {
-    openRef.current = open
-  }, [open])
-  // A full unmount (a relock, say) stops the decode loop too.
-  useEffect(
-    () => () => {
-      openRef.current = false
+  const adder = usePhotoAdder({
+    room: MAX_PHOTOS - photos.length,
+    active: open,
+    onBusyChange,
+    // The sheet holds each new photo, full image and all, until Save.
+    onPhoto: (photo) => {
+      setPhotos((current) => current && [...current, { id: photo.id, thumb: photo.thumb, added: photo }])
     },
-    [],
-  )
+    onDone: (ids) => {
+      if (ids.length > 0) setAnnouncement((last) => ({ text: `Added ${plural(ids.length, 'photo')}.`, n: last.n + 1 }))
+    },
+  })
 
   useEffect(() => {
     const index = pendingFocus.current
@@ -58,60 +53,11 @@ export function MeetupPhotos({ photos, setPhotos, onBusyChange, open }: MeetupPh
     target?.focus({ preventScroll: true })
   }, [photos])
 
-  function showMessage(text: string | null) {
-    setMessage((current) => (text === null ? null : { text, n: (current?.n ?? 0) + 1 }))
-  }
-
-  function openPicker() {
-    if (busyRef.current) return
-    if (photos.length >= MAX_PHOTOS) {
-      showMessage(TOO_MANY_PHOTOS)
-      return
-    }
-    fileInput.current?.click()
-  }
-
-  /** Resizes the chosen files one at a time (to keep memory low), adding each as it's ready. */
-  async function choose(event: ChangeEvent<HTMLInputElement>) {
-    const files = Array.from(event.target.files ?? [])
-    event.target.value = ''
-    if (files.length === 0 || busyRef.current) return
-    const chosen = files.slice(0, Math.max(0, MAX_PHOTOS - photos.length))
-    const skipped = files.length - chosen.length
-    let added = 0
-    let failed = 0
-    busyRef.current = true
-    onBusyChange(true)
-    showMessage(null)
-    setAnnouncement('')
-    try {
-      for (const [index, file] of chosen.entries()) {
-        if (!openRef.current) return
-        setProgress({ current: index + 1, total: chosen.length })
-        try {
-          const processed = await processPhoto(file)
-          if (!isValidPhotoData(processed)) throw new Error('The photo is too large')
-          const id = newId()
-          setPhotos((current) => current && [...current, { id, thumb: processed.thumb, added: { id, ...processed } }])
-          added += 1
-        } catch {
-          failed += 1
-        }
-      }
-    } finally {
-      busyRef.current = false
-      setProgress(null)
-      onBusyChange(false)
-    }
-    showMessage(describeSkippedPhotos(skipped, failed))
-    if (added > 0) setAnnouncement(`Added ${plural(added, 'photo')}.`)
-  }
-
   function remove(id: string, index: number) {
     pendingFocus.current = index
     setPhotos((current) => current && current.filter((photo) => photo.id !== id))
-    showMessage(null)
-    setAnnouncement('')
+    adder.clearMessage()
+    setAnnouncement((last) => ({ text: '', n: last.n }))
   }
 
   return (
@@ -135,36 +81,11 @@ export function MeetupPhotos({ photos, setPhotos, onBusyChange, open }: MeetupPh
             </button>
           </li>
         ))}
-        <li className="photo-tile">
-          <button
-            type="button"
-            className="photo-add"
-            aria-disabled={progress !== null}
-            aria-describedby={message ? messageId : undefined}
-            onClick={openPicker}
-          >
-            <IconCameraPlus size={26} />
-            <span>{progress ? `Adding ${progress.current} of ${progress.total}…` : 'Add photos'}</span>
-          </button>
-        </li>
+        <PhotoAddTile adder={adder} />
       </ul>
-      <input
-        ref={fileInput}
-        type="file"
-        accept="image/*"
-        multiple
-        className="visually-hidden"
-        tabIndex={-1}
-        aria-hidden="true"
-        onChange={choose}
-      />
-      {message && (
-        <p key={message.n} id={messageId} className="field-hint" role="alert">
-          {message.text}
-        </p>
-      )}
+      <PhotoAddHint adder={adder} />
       <span className="visually-hidden" aria-live="polite">
-        {announcement}
+        <span key={announcement.n}>{announcement.text}</span>
       </span>
     </section>
   )
```

In `src/sheets/MeetupSheet.css`:

```diff
--- a/src/sheets/MeetupSheet.css
+++ b/src/sheets/MeetupSheet.css
@@ -143,34 +143,6 @@
 .photo-tile__remove:active .photo-tile__remove-glyph {
   transform: scale(0.9);
 }
-/* The dashed outline marks an empty slot to fill, not a container. */
-.photo-add {
-  display: flex;
-  flex-direction: column;
-  align-items: center;
-  justify-content: center;
-  gap: var(--space-1);
-  width: 100%;
-  height: 100%;
-  padding: var(--space-2);
-  border: 1.5px dashed var(--ink-3);
-  border-radius: var(--radius-field);
-  background: var(--surface-2);
-  color: var(--ink-2);
-  font-size: var(--text-footnote);
-  font-weight: 600;
-  line-height: 1.25;
-  text-align: center;
-  overflow-wrap: anywhere;
-  transition: background-color var(--dur-fast);
-}
-.photo-add:active {
-  background: var(--surface-pressed);
-}
-.photo-add[aria-disabled='true'] {
-  cursor: progress;
-}
-
 @media (prefers-reduced-motion: reduce) {
   .friend-tile__check {
     animation: fade-in var(--dur) linear;
```

In `src/styles/base.css`:

```diff
--- a/src/styles/base.css
+++ b/src/styles/base.css
@@ -151,6 +151,10 @@ img {
 .text-button:active {
   opacity: 0.5;
 }
+.text-button:disabled {
+  opacity: 0.45;
+  cursor: default;
+}
 
 .icon-button {
   display: inline-grid;
@@ -357,6 +361,33 @@ textarea.field {
   background: var(--surface-2);
   object-fit: cover;
 }
+/* The Add photos tile, last in a grid. The dashed outline marks an empty slot to fill, not a container. */
+.photo-add {
+  display: flex;
+  flex-direction: column;
+  align-items: center;
+  justify-content: center;
+  gap: var(--space-1);
+  width: 100%;
+  height: 100%;
+  padding: var(--space-2);
+  border: 1.5px dashed var(--ink-3);
+  border-radius: var(--radius-field);
+  background: var(--surface-2);
+  color: var(--ink-2);
+  font-size: var(--text-footnote);
+  font-weight: 600;
+  line-height: 1.25;
+  text-align: center;
+  overflow-wrap: anywhere;
+  transition: background-color var(--dur-fast);
+}
+.photo-add:active {
+  background: var(--surface-pressed);
+}
+.photo-add[aria-disabled='true'] {
+  cursor: progress;
+}
 
 .list-message {
   margin: var(--space-2) var(--space-4);
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b` (no files written), then `npm test`
Expected: `Test Files  62 passed (62)` and `Tests  766 passed (766)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `214 passed`.

One full run had 1 failure: `dayKeyboard.spec.ts` "the page sits on the keyboard" (a click on "Hide keyboard" waiting to be stable, the known 4-worker stall). The file alone, twice over: 28 passed.

- [ ] **Step 5: Commit**

```bash
git add e2e/meetupPage.spec.ts src/components/PhotoAddTile.tsx src/db/meetups.test.ts src/db/meetups.ts src/hooks/usePhotoAdder.ts src/screens/MeetupScreen.css src/screens/MeetupScreen.tsx src/sheets/MeetupPhotos.tsx src/sheets/MeetupSheet.css src/styles/base.css
git commit -F - <<'EOF'
feat: photos on the Meetup page, added right there and saved at once

The Photos section always shows, between Activities and The day, ending
with the Add photos tile. Each chosen photo is resized and saved the moment
it's ready (addMeetupPhoto, which reads only index keys), shows in the grid
at once, and a batch ends with "Added 3 photos" and an Undo that removes
exactly those photos (removeMeetupPhotos). Edit waits while photos are
added, leaving the page stops the batch quietly, and hints say what didn't
fit or couldn't be read. The picker, the one-at-a-time loop, the progress
label and the hints are shared with the meetup sheet as usePhotoAdder and
PhotoAddTile. photoThumbs reads ids key-only in order and takes thumbnails
from the cache, so adding a photo reads one record, not all of them.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: The Backup footer and the Settings tab's dot

**Files:**
- Create: `src/backup/nudge.ts`, `src/backup/useBackupDot.ts`
- Modify: `src/components/TabBar.css`, `src/components/TabBar.tsx`, `src/db/settings.ts`, `src/lib/text.ts`, `src/screens/SettingsScreen.tsx`
- Test: `e2e/settings.spec.ts`, `src/backup/nudge.test.ts` (new), `src/lib/text.test.ts`

- [ ] **Step 1: Write the failing tests**

`describeBackup` with meetups since, the pure rules in `src/backup/nudge.ts`, and the dot end to end with the clock moved on.

In `e2e/settings.spec.ts`:

```diff
--- a/e2e/settings.spec.ts
+++ b/e2e/settings.spec.ts
@@ -1,6 +1,28 @@
-import { expect, test } from '@playwright/test'
+import { expect, test, type Page } from '@playwright/test'
 import { addFriend, friendLink, goToTab, logMeetup } from './helpers.ts'
 
+/** Forces the download path for a backup: the share sheet can't be driven in tests. */
+async function downloadBackups(page: Page) {
+  await page.addInitScript(() => {
+    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
+  })
+}
+
+/** Exports a backup from Settings and returns where the file was saved. */
+async function exportFile(page: Page): Promise<string> {
+  await goToTab(page, 'Settings')
+  const download = page.waitForEvent('download')
+  await page.getByRole('button', { name: 'Export backup' }).click()
+  const path = await (await download).path()
+  await expect(page.getByText('Last backup: today')).toBeVisible()
+  return path
+}
+
+/** The Settings tab in the tab bar, by its exact name. */
+function settingsTab(page: Page, name: string) {
+  return page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name, exact: true })
+}
+
 test('manages groups', async ({ page }) => {
   await page.goto('/#/settings/groups')
   await page.getByRole('button', { name: 'Add group' }).first().click()
@@ -78,6 +100,48 @@ test('exports and imports a backup', async ({ page }) => {
   await expect(friendLink(page, 'Kim')).toHaveCount(0)
 })
 
+test('a quiet dot on the Settings tab suggests a backup once meetups are logged after one 30 days old', async ({
+  page,
+}) => {
+  await downloadBackups(page)
+  await page.clock.setFixedTime(new Date(2026, 8, 1, 12))
+  await page.goto('/')
+  await addFriend(page, 'Alex')
+  await exportFile(page)
+  await page.clock.setFixedTime(new Date(2026, 8, 1, 13))
+  await goToTab(page, 'Friends')
+  await logMeetup(page, ['Alex'])
+  await expect(settingsTab(page, 'Settings')).toBeVisible()
+
+  // 31 days after the backup: the dot, and the tab says why.
+  await page.clock.setFixedTime(new Date(2026, 9, 2, 12))
+  await page.reload()
+  const suggested = settingsTab(page, 'Settings, backup suggested')
+  await expect(suggested).toBeVisible()
+  await expect(suggested.locator('.tabbar__dot')).toBeVisible()
+
+  // Opening Settings sees it: it goes, and the footer has the facts.
+  await suggested.click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
+  await expect(settingsTab(page, 'Settings')).toBeVisible()
+  await expect(page.locator('.tabbar__dot')).toHaveCount(0)
+  await expect(page.getByText('Last backup: 4 weeks ago. 1 meetup since then.')).toBeVisible()
+  await page.reload()
+  await expect(settingsTab(page, 'Settings')).toBeVisible()
+  await goToTab(page, 'Friends')
+  await expect(page.locator('.tabbar__dot')).toHaveCount(0)
+
+  // 30 days on, a backup is still due: the dot again.
+  await page.clock.setFixedTime(new Date(2026, 10, 1, 12))
+  await page.reload()
+  await expect(settingsTab(page, 'Settings, backup suggested')).toBeVisible()
+
+  // A backup ends it.
+  await exportFile(page)
+  await expect(settingsTab(page, 'Settings')).toBeVisible()
+  await expect(page.locator('.tabbar__dot')).toHaveCount(0)
+})
+
 test('rejects a file that is not a backup', async ({ page }) => {
   await page.goto('/#/settings')
   await page.locator('input[type="file"]').setInputFiles({
```

In `src/backup/nudge.test.ts`:

```diff
--- /dev/null
+++ b/src/backup/nudge.test.ts
@@ -0,0 +1,59 @@
+import { describe, expect, it } from 'vitest'
+import { BACKUP_NUDGE_DAYS, backupDue, meetupsSinceBackup, showBackupDot } from './nudge'
+
+/** Noon on a day of 2026, in the phone's time zone (America/Los_Angeles in the tests). */
+function noon(month: number, day: number): Date {
+  return new Date(2026, month - 1, day, 12)
+}
+
+function logged(date: Date) {
+  return { createdAt: date.toISOString() }
+}
+
+const BACKUP = noon(9, 1).toISOString()
+
+describe('meetupsSinceBackup', () => {
+  it('counts only meetups logged after the backup', () => {
+    const meetups = [logged(noon(8, 30)), logged(new Date(2026, 8, 1, 11)), logged(noon(9, 2)), logged(noon(9, 20))]
+    expect(meetupsSinceBackup(meetups, BACKUP)).toBe(2)
+    expect(meetupsSinceBackup([logged(noon(9, 1))], BACKUP)).toBe(0)
+  })
+
+  it('counts every meetup when there has been no backup', () => {
+    expect(meetupsSinceBackup([logged(noon(1, 1)), logged(noon(9, 2))], null)).toBe(2)
+    expect(meetupsSinceBackup([], null)).toBe(0)
+  })
+})
+
+describe('backupDue', () => {
+  const since = [logged(noon(9, 2))]
+
+  it('is due 30 days after a backup with a meetup logged since, not at 29', () => {
+    expect(BACKUP_NUDGE_DAYS).toBe(30)
+    expect(backupDue(since, BACKUP, noon(9, 30))).toBe(false)
+    expect(backupDue(since, BACKUP, noon(10, 1))).toBe(true)
+  })
+
+  it('is never due with nothing new since the backup', () => {
+    expect(backupDue([logged(noon(8, 20))], BACKUP, noon(10, 31))).toBe(false)
+    expect(backupDue([], BACKUP, noon(10, 31))).toBe(false)
+  })
+
+  it('with no backup, is due once the first meetup is 30 days old', () => {
+    const meetups = [logged(noon(9, 20)), logged(noon(9, 1))]
+    expect(backupDue(meetups, null, noon(9, 30))).toBe(false)
+    expect(backupDue(meetups, null, noon(10, 1))).toBe(true)
+    expect(backupDue([], null, noon(12, 1))).toBe(false)
+  })
+})
+
+describe('showBackupDot', () => {
+  const now = noon(10, 21)
+
+  it('shows while a backup is due and the dot was not seen in the last 30 days', () => {
+    expect(showBackupDot(true, null, now)).toBe(true)
+    expect(showBackupDot(true, noon(10, 11).toISOString(), now)).toBe(false)
+    expect(showBackupDot(true, noon(9, 21).toISOString(), now)).toBe(true)
+    expect(showBackupDot(false, null, now)).toBe(false)
+  })
+})
```

In `src/lib/text.test.ts`:

```diff
--- a/src/lib/text.test.ts
+++ b/src/lib/text.test.ts
@@ -92,9 +92,23 @@ describe('describeLastBackup', () => {
 describe('describeBackup', () => {
   it('adds the photo count when there are photos', () => {
     const today = new Date(2026, 9, 2, 9, 30).toISOString()
-    expect(describeBackup(today, '2026-10-02', 0)).toBe('Last backup: today')
-    expect(describeBackup(today, '2026-10-02', 12)).toBe('Last backup: today. Includes 12 photos.')
-    expect(describeBackup(null, '2026-10-02', 1)).toBe('Never backed up. Includes 1 photo.')
+    expect(describeBackup(today, '2026-10-02', 0, 0)).toBe('Last backup: today')
+    expect(describeBackup(today, '2026-10-02', 12, 0)).toBe('Last backup: today. Includes 12 photos.')
+    expect(describeBackup(null, '2026-10-02', 1, 0)).toBe('Never backed up. Includes 1 photo.')
+  })
+
+  it('says how many meetups were logged since the last backup', () => {
+    const sixWeeks = new Date(2026, 7, 20, 9, 30).toISOString()
+    const twoMonths = new Date(2026, 7, 2, 9, 30).toISOString()
+    expect(describeBackup(sixWeeks, '2026-10-02', 9, 12)).toBe(
+      'Last backup: 6 weeks ago. 12 meetups since then. Includes 9 photos.',
+    )
+    expect(describeBackup(twoMonths, '2026-10-02', 0, 1)).toBe('Last backup: 2 months ago. 1 meetup since then.')
+  })
+
+  it('never counts meetups when there has been no backup', () => {
+    expect(describeBackup(null, '2026-10-02', 9, 39)).toBe('Never backed up. Includes 9 photos.')
+    expect(describeBackup('garbage', '2026-10-02', 0, 3)).toBe('Never backed up')
   })
 })
 
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/text.test.ts src/backup/nudge.test.ts`
Expected: FAIL, `./nudge` does not exist, and the footer has no "since then".

- [ ] **Step 3: Implement**

`describeBackup` takes `meetupsSince`; `nudge.ts` and `useBackupDot` decide the dot; Settings records `backupNudgeSeenAt`; the tab bar draws the dot after returning early on the day page.

In `src/backup/nudge.ts`:

```diff
--- /dev/null
+++ b/src/backup/nudge.ts
@@ -0,0 +1,47 @@
+import { daysBetween, toISODate } from '../lib/dates'
+import type { Meetup } from '../types'
+
+// When the app suggests a backup: a quiet dot on the Settings tab, never red, never a count of days. Pure, so it's
+// tested in Node with fixed dates. Days are the phone's calendar days, like the Backup footer's "4 weeks ago".
+
+/** Days between a backup and the first suggestion to make another, and between suggestions. */
+export const BACKUP_NUDGE_DAYS = 30
+
+type Logged = Pick<Meetup, 'createdAt'>
+
+/** The time an ISO string names, or null when it names none. */
+function timeOf(iso: string | null): number | null {
+  if (iso === null) return null
+  const time = Date.parse(iso)
+  return Number.isNaN(time) ? null : time
+}
+
+/** Calendar days from `iso` to `now`, or null when `iso` isn't a time. */
+export function daysSince(iso: string | null, now: Date): number | null {
+  const time = timeOf(iso)
+  return time === null ? null : daysBetween(toISODate(new Date(time)), toISODate(now))
+}
+
+/** Meetups logged after the last backup (all of them when there has been none). */
+export function meetupsSinceBackup(meetups: readonly Logged[], lastBackupAt: string | null): number {
+  const last = timeOf(lastBackupAt)
+  if (last === null) return meetups.length
+  return meetups.filter((meetup) => (timeOf(meetup.createdAt) ?? -Infinity) > last).length
+}
+
+/** A backup is due: something logged since, and 30 or more days since the last backup (or since the first meetup, with none). */
+export function backupDue(meetups: readonly Logged[], lastBackupAt: string | null, now: Date): boolean {
+  if (meetupsSinceBackup(meetups, lastBackupAt) === 0) return false
+  const sinceBackup = daysSince(lastBackupAt, now)
+  if (sinceBackup !== null) return sinceBackup >= BACKUP_NUDGE_DAYS
+  let first = Infinity
+  for (const meetup of meetups) first = Math.min(first, timeOf(meetup.createdAt) ?? Infinity)
+  return Number.isFinite(first) && daysBetween(toISODate(new Date(first)), toISODate(now)) >= BACKUP_NUDGE_DAYS
+}
+
+/** The Settings tab's dot: due, and not seen in the last 30 days. */
+export function showBackupDot(due: boolean, seenAt: string | null, now: Date): boolean {
+  if (!due) return false
+  const seen = daysSince(seenAt, now)
+  return seen === null || seen >= BACKUP_NUDGE_DAYS
+}
```

In `src/backup/useBackupDot.ts`:

```diff
--- /dev/null
+++ b/src/backup/useBackupDot.ts
@@ -0,0 +1,24 @@
+import { useLiveQuery } from 'dexie-react-hooks'
+import { db } from '../db/db'
+import { getSetting } from '../db/settings'
+import { useToday } from '../hooks/useToday'
+import { BACKUP_NUDGE_DAYS, backupDue, daysSince, showBackupDot } from './nudge'
+
+/**
+ * Whether the Settings tab shows its backup dot, as one live query. It reads no meetup while the dot was seen in the
+ * last 30 days or the last backup is less than 30 days old; otherwise it stops at the first meetup that makes a backup
+ * due (`createdAt` has no index, but meetups hold no photos). Asked again as the day changes. `undefined` while it
+ * loads.
+ */
+export function useBackupDot(): boolean | undefined {
+  const today = useToday()
+  return useLiveQuery(async () => {
+    const now = new Date()
+    const [lastBackupAt, seenAt] = await Promise.all([getSetting('lastBackupAt'), getSetting('backupNudgeSeenAt')])
+    if (!showBackupDot(true, seenAt, now)) return false
+    const sinceBackup = daysSince(lastBackupAt, now)
+    if (sinceBackup !== null && sinceBackup < BACKUP_NUDGE_DAYS) return false
+    const first = await db.meetups.filter((meetup) => backupDue([meetup], lastBackupAt, now)).first()
+    return showBackupDot(first !== undefined, seenAt, now)
+  }, [today])
+}
```

In `src/components/TabBar.css`:

```diff
--- a/src/components/TabBar.css
+++ b/src/components/TabBar.css
@@ -25,8 +25,22 @@
   text-decoration: none;
   transition: color var(--dur-fast);
 }
-.tabbar__item svg {
+.tabbar__icon {
+  position: relative;
   flex: none;
+  display: grid;
+}
+/* The backup suggestion: an 8px Terracotta Ink dot at the top right of the Settings icon, ringed in the bar's Paper
+   White so it stands off the icon's lines. Never red, never a number, never moving. */
+.tabbar__dot {
+  position: absolute;
+  top: 0;
+  right: -2px;
+  width: 8px;
+  height: 8px;
+  border-radius: 50%;
+  background: var(--accent-ink);
+  box-shadow: 0 0 0 2px var(--surface);
 }
 .tabbar__item[aria-current='page'] {
   color: var(--accent-ink);
```

In `src/components/TabBar.tsx`:

```diff
--- a/src/components/TabBar.tsx
+++ b/src/components/TabBar.tsx
@@ -1,4 +1,5 @@
-import { Link, useLocation } from 'react-router'
+import { Link, useLocation, type Location } from 'react-router'
+import { useBackupDot } from '../backup/useBackupDot'
 import { isDayPage } from '../lib/routes'
 import type { NavState } from './Page'
 import { IconFriends, IconSettings, IconStats } from './icons'
@@ -17,17 +18,34 @@ const TABS = [
 
 export function TabBar() {
   const location = useLocation()
+  // The day page fills the screen, so it has no tab bar, and the tabs' query never runs there.
+  if (isDayPage(location.pathname)) return null
+  return <TabBarItems location={location} />
+}
+
+function TabBarItems({ location }: { location: Location }) {
   const { pathname } = location
   const originTab = (location.state as NavState | null)?.tab
-  // The day page fills the screen, so it has no tab bar.
-  if (isDayPage(pathname)) return null
+  // A quiet suggestion to back up: a dot on the Settings icon, and VoiceOver hears "Settings, backup suggested" (a
+  // name that starts with the tab's own word, so Voice Control's "Tap Settings" still works).
+  const backupDot = useBackupDot() === true
   return (
     <nav className="tabbar" aria-label="Main">
       {TABS.map(({ to, label, Icon, matches }) => {
         const active = originTab ? to === originTab : matches(pathname)
+        const dot = backupDot && to === '/settings'
         return (
-          <Link key={to} to={to} className="tabbar__item" aria-current={active ? 'page' : undefined}>
-            <Icon size={26} strokeWidth={active ? 2.2 : 1.8} />
+          <Link
+            key={to}
+            to={to}
+            className="tabbar__item"
+            aria-current={active ? 'page' : undefined}
+            aria-label={dot ? `${label}, backup suggested` : undefined}
+          >
+            <span className="tabbar__icon">
+              <Icon size={26} strokeWidth={active ? 2.2 : 1.8} />
+              {dot && <span className="tabbar__dot" aria-hidden="true" />}
+            </span>
             <span>{label}</span>
           </Link>
         )
```

In `src/db/settings.ts`:

```diff
--- a/src/db/settings.ts
+++ b/src/db/settings.ts
@@ -4,6 +4,8 @@ import { db } from './db'
 
 export interface Settings {
   lastBackupAt: string | null
+  /** When Settings was last opened while its tab showed the backup dot (src/backup/nudge.ts). */
+  backupNudgeSeenAt: string | null
   installHintDismissed: boolean
   appLock: AppLock
   appLockFailures: LockFailures
@@ -12,6 +14,7 @@ export interface Settings {
 
 export const DEFAULT_SETTINGS: Settings = {
   lastBackupAt: null,
+  backupNudgeSeenAt: null,
   installHintDismissed: false,
   appLock: LOCK_OFF,
   appLockFailures: NO_FAILURES,
```

In `src/lib/text.ts`:

```diff
--- a/src/lib/text.ts
+++ b/src/lib/text.ts
@@ -88,8 +88,22 @@ export function describeLastBackup(lastBackupAt: string | null, today: ISODate):
   return `Last backup: ${since.charAt(0).toLowerCase()}${since.slice(1)}`
 }
 
-/** The Backup group's footer: the last backup, then how many photos a backup carries (they make it large). */
-export function describeBackup(lastBackupAt: string | null, today: ISODate, photoCount: number): string {
+/**
+ * The Backup group's footer, facts only: the last backup, how many meetups were logged since it (when there was one
+ * and some since), then how many photos a backup carries (they make it large).
+ */
+export function describeBackup(
+  lastBackupAt: string | null,
+  today: ISODate,
+  photoCount: number,
+  meetupsSince: number,
+): string {
   const last = describeLastBackup(lastBackupAt, today)
-  return photoCount > 0 ? `${last}. Includes ${plural(photoCount, 'photo')}.` : last
+  const backedUp = lastBackupAt !== null && !Number.isNaN(new Date(lastBackupAt).getTime())
+  const parts = [
+    last,
+    backedUp && meetupsSince > 0 ? `${plural(meetupsSince, 'meetup')} since then` : null,
+    photoCount > 0 ? `Includes ${plural(photoCount, 'photo')}` : null,
+  ].filter((part): part is string => part !== null)
+  return parts.length === 1 ? last : `${parts.join('. ')}.`
 }
```

In `src/screens/SettingsScreen.tsx`:

```diff
--- a/src/screens/SettingsScreen.tsx
+++ b/src/screens/SettingsScreen.tsx
@@ -1,11 +1,14 @@
-import { useRef, useState, type ChangeEvent } from 'react'
+import { useEffect, useRef, useState, type ChangeEvent } from 'react'
 import { exportBackup, shareBackupFile } from '../backup/exportBackup'
+import { meetupsSinceBackup } from '../backup/nudge'
 import { parseBackupFile, readAllData, replaceAllData } from '../backup/storage'
+import { useBackupDot } from '../backup/useBackupDot'
 import { useConfirm } from '../components/ActionSheet'
 import { InsetGroup, Row } from '../components/InsetGroup'
 import { Page } from '../components/Page'
 import { useToast } from '../components/Toast'
 import { useFriends, useGroups, useMeetups, useMeetupTypes, usePhotoCount, useSetting } from '../data/hooks'
+import { setSetting } from '../db/settings'
 import { useToday } from '../hooks/useToday'
 import { describeBackup, plural } from '../lib/text'
 import { AppLockSection } from '../lock/AppLockSection'
@@ -30,6 +33,13 @@ export function SettingsScreen() {
   const fileInput = useRef<HTMLInputElement>(null)
   const exportingRef = useRef(false)
   const [importError, setImportError] = useState<{ message: string; n: number } | null>(null)
+  const backupDot = useBackupDot()
+
+  // Opening Settings while the tab shows the backup dot is seeing it: the dot goes, and comes back 30 days later only
+  // if a backup is still due. The Backup footer keeps the facts.
+  useEffect(() => {
+    if (backupDot) void setSetting('backupNudgeSeenAt', new Date().toISOString())
+  }, [backupDot])
 
   if (!friends || !groups || !meetupTypes || !meetups || lastBackupAt === undefined) return null
   if (appLock === undefined || passkeyAvailable === undefined || birthdayReminders === undefined) return null
@@ -111,7 +121,10 @@ export function SettingsScreen() {
 
       <RemindersSection reminders={birthdayReminders} />
 
-      <InsetGroup title="Backup" footer={describeBackup(lastBackupAt, today, photoCount)}>
+      <InsetGroup
+        title="Backup"
+        footer={describeBackup(lastBackupAt, today, photoCount, meetupsSinceBackup(meetups, lastBackupAt))}
+      >
         <Row title="Export backup" accent onClick={exportData} />
         <Row title="Import backup" accent onClick={() => fileInput.current?.click()} />
       </InsetGroup>
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b` (no files written), then `npm test`
Expected: `Test Files  63 passed (63)` and `Tests  774 passed (774)`.

Run: `npm run build`, then `npx playwright test --project=iphone e2e/settings.spec.ts e2e/shell.spec.ts e2e/stats.spec.ts`
Expected: the build passes, and these pass.

The first run of the dot test failed on the tab's name ("Settings , backup suggested", from visually hidden words); the link is named with `aria-label` instead, as above. Then `settings.spec.ts`: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add e2e/settings.spec.ts src/backup/nudge.test.ts src/backup/nudge.ts src/backup/useBackupDot.ts src/components/TabBar.css src/components/TabBar.tsx src/db/settings.ts src/lib/text.test.ts src/lib/text.ts src/screens/SettingsScreen.tsx
git commit -F - <<'EOF'
feat: the Backup footer says what's new, and a quiet dot suggests a backup

The Backup footer adds how many meetups were logged since the last backup
("Last backup: 6 weeks ago. 12 meetups since then. Includes 9 photos.").
While a backup is due (meetups logged since a backup 30 or more days old,
or since a first meetup that old with no backup), an 8px Terracotta Ink dot
sits at the top right of the Settings icon, and the tab is named
"Settings, backup suggested". Opening Settings sees it (backupNudgeSeenAt),
so it comes back only 30 days later, and a backup ends it. Never red, never
a number, never moving. The rules are pure in src/backup/nudge.ts, and
useBackupDot is one live query that reads no meetup while the dot was seen
lately or the last backup is recent. The tab bar returns before any query on
the day page.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: The import confirm compares the backup with the app

**Files:**
- Create: `src/backup/importSummary.ts`
- Modify: `src/backup/format.ts`, `src/components/ActionSheet.css`, `src/screens/SettingsScreen.tsx`
- Test: `e2e/settings.spec.ts`, `src/backup/format.test.ts`, `src/backup/importSummary.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

`parseBackup` gives `exportedAt`, `describeImport` gives exact lines, and the e2e reads the confirm's lines.

In `e2e/settings.spec.ts`:

```diff
--- a/e2e/settings.spec.ts
+++ b/e2e/settings.spec.ts
@@ -142,6 +142,38 @@ test('a quiet dot on the Settings tab suggests a backup once meetups are logged
   await expect(page.locator('.tabbar__dot')).toHaveCount(0)
 })
 
+test('the import confirm compares the backup with the app', async ({ page }) => {
+  await downloadBackups(page)
+  await page.clock.setFixedTime(new Date(2026, 8, 2, 12))
+  await page.goto('/')
+  await addFriend(page, 'Alex')
+  await logMeetup(page, ['Alex'])
+  const backupPath = await exportFile(page)
+
+  // Seven weeks on: one more friend and two more meetups.
+  await page.clock.setFixedTime(new Date(2026, 9, 21, 12))
+  await page.reload()
+  await goToTab(page, 'Friends')
+  await addFriend(page, 'Kim')
+  await logMeetup(page, ['Kim'])
+  await logMeetup(page, ['Alex', 'Kim'], { type: 'Meal' })
+  await goToTab(page, 'Settings')
+  await page.locator('input[type="file"]').setInputFiles(backupPath)
+
+  const confirm = page.getByRole('alertdialog', { name: 'Replace all data with this backup?' })
+  const message = await confirm.locator('.action-sheet__message').evaluate((element) => element.textContent)
+  expect(message?.split('\n')).toEqual([
+    'Backup from Wed, Sep 2: 1 friend, 1 meetup.',
+    'In the app now: 2 friends, 3 meetups.',
+    "1 friend and 2 meetups in the app now aren't in this backup.",
+    'Everything in the app now will be replaced.',
+  ])
+  // One line each.
+  await expect(confirm.locator('.action-sheet__message')).toHaveCSS('white-space', 'pre-line')
+  await confirm.getByRole('button', { name: 'Cancel' }).click()
+  await expect(confirm).toHaveCount(0)
+})
+
 test('rejects a file that is not a backup', async ({ page }) => {
   await page.goto('/#/settings')
   await page.locator('input[type="file"]').setInputFiles({
```

In `src/backup/format.test.ts`:

```diff
--- a/src/backup/format.test.ts
+++ b/src/backup/format.test.ts
@@ -50,7 +50,7 @@ describe('createBackup and parseBackup', () => {
   it('accepts a backup it created', () => {
     const file = createBackup(sample, new Date('2026-10-02T09:00:00Z'))
     expect(file).toMatchObject({ app: 'friend-tracker', version: 5, exportedAt: '2026-10-02T09:00:00.000Z' })
-    expect(parseBackup(jsonCopy(file))).toEqual({ ok: true, data: sample })
+    expect(parseBackup(jsonCopy(file))).toEqual({ ok: true, data: sample, exportedAt: '2026-10-02T09:00:00.000Z' })
   })
 
   it('drops fields it does not know about', () => {
@@ -60,7 +60,17 @@ describe('createBackup and parseBackup', () => {
       ;(list(f, 'friends')[1].birthday as Record<string, unknown>).sign = 'Pisces'
       list(f, 'meetupPhotos')[0].caption = 'Hi'
     })
-    expect(parseBackup(file)).toEqual({ ok: true, data: sample })
+    expect(parseBackup(file)).toEqual({ ok: true, data: sample, exportedAt: '2026-10-02T09:00:00.000Z' })
+  })
+
+  it('gives no date for a file whose exportedAt is missing, not a string or not a date, and still accepts it', () => {
+    for (const exportedAt of [undefined, 1_700_000_000_000, null, 'yesterday', '']) {
+      const file = broken((f) => {
+        if (exportedAt === undefined) delete f.exportedAt
+        else f.exportedAt = exportedAt
+      })
+      expect(parseBackup(file), String(exportedAt)).toEqual({ ok: true, data: sample, exportedAt: null })
+    }
   })
 })
 
@@ -210,7 +220,7 @@ describe('parseBackup reads version 5 backups', () => {
     const file = jsonCopy(createBackup(withDay, new Date('2026-10-04T05:00:00Z')))
     expect(file.version).toBe(5)
     const result = parseBackup(file)
-    expect(result).toEqual({ ok: true, data: withDay })
+    expect(result).toEqual({ ok: true, data: withDay, exportedAt: '2026-10-04T05:00:00.000Z' })
     if (result.ok) {
       expect(result.data.meetups[2].note).toBe(OWNER_DAY_TYPED)
       expect(result.data.meetups[2].activities).toEqual(['Movie', 'Shopping'])
```

In `src/backup/importSummary.test.ts`:

```diff
--- /dev/null
+++ b/src/backup/importSummary.test.ts
@@ -0,0 +1,76 @@
+import { describe, expect, it } from 'vitest'
+import { friend, meetup, meetupPhoto, meetupType } from '../test/fixtures'
+import type { BackupData } from './format'
+import { describeImport, type AppNow } from './importSummary'
+
+const TODAY = '2026-10-21'
+/** Exported on Wed, Sep 2, 2026, at 9 AM on the phone's clock. */
+const SEP_2 = new Date(2026, 8, 2, 9).toISOString()
+
+/** A backup with `friends` friends (f0, f1, ...), `meetups` meetups (m0, ...) and `photos` photos of the first meetup. */
+function backup(friends: number, meetups: number, photos = 0): BackupData {
+  return {
+    friends: Array.from({ length: friends }, (_, i) => friend(`f${i}`, `Friend ${i}`)),
+    groups: [],
+    meetupTypes: [meetupType('t1', 'Coffee', 0)],
+    meetups: Array.from({ length: meetups }, (_, i) => meetup(`m${i}`, '2026-09-01', ['f0'], 't1')),
+    meetupPhotos: Array.from({ length: photos }, (_, i) => meetupPhoto(`p${i}`, 'm0', i)),
+  }
+}
+
+/** What the app holds now: the given ids, and `photos` photos. */
+function app(friendIds: string[], meetupIds: string[], photos = 0): AppNow {
+  return { friends: friendIds.length, meetups: meetupIds.length, photos, friendIds, meetupIds }
+}
+
+function ids(prefix: string, count: number): string[] {
+  return Array.from({ length: count }, (_, i) => `${prefix}${i}`)
+}
+
+describe('describeImport', () => {
+  it('compares a dated backup with the app, photos on both sides', () => {
+    expect(describeImport(backup(15, 30, 6), SEP_2, app(ids('f', 15), ids('m', 39), 9), TODAY).split('\n')).toEqual([
+      'Backup from Wed, Sep 2: 15 friends, 30 meetups, 6 photos.',
+      'In the app now: 15 friends, 39 meetups, 9 photos.',
+      "9 meetups in the app now aren't in this backup.",
+      'Everything in the app now will be replaced.',
+    ])
+  })
+
+  it('says "This backup" without a date it can read, and gives last year’s with its year', () => {
+    expect(describeImport(backup(1, 1), null, app(['f0'], ['m0']), TODAY).split('\n')[0]).toBe(
+      'This backup: 1 friend, 1 meetup.',
+    )
+    const lastYear = new Date(2025, 8, 2, 9).toISOString()
+    expect(describeImport(backup(1, 1), lastYear, app(['f0'], ['m0']), TODAY).split('\n')[0]).toBe(
+      'Backup from Tue, Sep 2, 2025: 1 friend, 1 meetup.',
+    )
+  })
+
+  it('into an empty app: nothing to lose or replace', () => {
+    expect(describeImport(backup(15, 30, 6), SEP_2, app([], []), TODAY)).toBe(
+      'Backup from Wed, Sep 2: 15 friends, 30 meetups, 6 photos.\nNo friends or meetups in the app yet.',
+    )
+  })
+
+  it('leaves out photo counts when neither side has any, and keeps them when one does', () => {
+    expect(describeImport(backup(2, 3), SEP_2, app(ids('f', 2), ids('m', 3)), TODAY).split('\n').slice(0, 2)).toEqual([
+      'Backup from Wed, Sep 2: 2 friends, 3 meetups.',
+      'In the app now: 2 friends, 3 meetups.',
+    ])
+    expect(describeImport(backup(2, 3), SEP_2, app(ids('f', 2), ids('m', 3), 1), TODAY).split('\n').slice(0, 2)).toEqual(
+      ['Backup from Wed, Sep 2: 2 friends, 3 meetups, 0 photos.', 'In the app now: 2 friends, 3 meetups, 1 photo.'],
+    )
+  })
+
+  it('names what in the app isn’t in the backup: meetups, friends and meetups, or friends', () => {
+    const line = (friendIds: string[], meetupIds: string[]) =>
+      describeImport(backup(2, 2), SEP_2, app(friendIds, meetupIds), TODAY).split('\n')[2]
+    expect(line(['f0', 'f1'], ['m0', 'm1', 'x1'])).toBe("1 meetup in the app now isn't in this backup.")
+    expect(line(['f0', 'x1'], ['m0', 'x1', 'x2'])).toBe("1 friend and 2 meetups in the app now aren't in this backup.")
+    expect(line(['f0', 'x1', 'x2'], ['m0'])).toBe("2 friends in the app now aren't in this backup.")
+    expect(line(['x1'], ['m0'])).toBe("1 friend in the app now isn't in this backup.")
+    // Nothing missing: straight on to the last line.
+    expect(line(['f0'], ['m0'])).toBe('Everything in the app now will be replaced.')
+  })
+})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/backup`
Expected: FAIL, `./importSummary` does not exist and the parse results have no `exportedAt`.

- [ ] **Step 3: Implement**

`exportedAt` in `ParseResult`, `src/backup/importSummary.ts`, `white-space: pre-line` on an action sheet's message, and Settings' confirm.

In `src/backup/format.ts`:

```diff
--- a/src/backup/format.ts
+++ b/src/backup/format.ts
@@ -22,7 +22,8 @@ export interface BackupFile extends BackupData {
   exportedAt: string
 }
 
-export type ParseResult = { ok: true; data: BackupData } | { ok: false; error: string }
+/** A file that imports, with when it was made (`exportedAt` when it's a time `Date.parse` reads, else null). */
+export type ParseResult = { ok: true; data: BackupData; exportedAt: string | null } | { ok: false; error: string }
 
 export function createBackup(data: BackupData, exportedAt: Date): BackupFile {
   return { app: 'friend-tracker', version: 5, exportedAt: exportedAt.toISOString(), ...data }
@@ -38,7 +39,8 @@ export function backupFileName(today: ISODate): string {
  */
 export function parseBackup(raw: unknown, today: ISODate = todayISO()): ParseResult {
   try {
-    return { ok: true, data: readBackup(raw, today) }
+    const data = readBackup(raw, today)
+    return { ok: true, data, exportedAt: exportedAtOf(raw as Obj) }
   } catch (error) {
     if (error instanceof BackupError) return { ok: false, error: error.message }
     throw error
@@ -47,6 +49,12 @@ export function parseBackup(raw: unknown, today: ISODate = todayISO()): ParseRes
 
 class BackupError extends Error {}
 
+/** When the file says it was made. Never a reason to refuse it: older and edited files still import. */
+function exportedAtOf(file: Obj): string | null {
+  const value = file.exportedAt
+  return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null
+}
+
 type Obj = Record<string, unknown>
 
 function isObj(value: unknown): value is Obj {
```

In `src/backup/importSummary.ts`:

```diff
--- /dev/null
+++ b/src/backup/importSummary.ts
@@ -0,0 +1,66 @@
+import { formatDate, toISODate, type ISODate } from '../lib/dates'
+import { plural } from '../lib/text'
+import type { BackupData } from './format'
+
+// The words of the import confirm, which compares a backup with what's in the app before replacing it. Pure: the
+// counts, ids and dates come in as arguments.
+
+/** How much a set of data holds. */
+export interface DataCounts {
+  friends: number
+  meetups: number
+  photos: number
+}
+
+/** What's in the app now: its counts, and the ids of its friends and meetups. */
+export interface AppNow extends DataCounts {
+  friendIds: readonly string[]
+  meetupIds: readonly string[]
+}
+
+/** The last line of a confirm that replaces the app's data. */
+const REPLACED = 'Everything in the app now will be replaced.'
+
+/** "15 friends, 30 meetups, 6 photos", the photos only `withPhotos` (when either side has any). */
+function countList(counts: DataCounts, withPhotos: boolean): string {
+  const parts = [plural(counts.friends, 'friend'), plural(counts.meetups, 'meetup')]
+  if (withPhotos) parts.push(plural(counts.photos, 'photo'))
+  return parts.join(', ')
+}
+
+/** "In the app now: 15 friends, 39 meetups, 9 photos.", or that there's nothing yet. */
+export function appNowLine(app: DataCounts, withPhotos: boolean): string {
+  if (app.friends === 0 && app.meetups === 0) return 'No friends or meetups in the app yet.'
+  return `In the app now: ${countList(app, withPhotos)}.`
+}
+
+/** "9 meetups in the app now aren't in this backup.", or null when nothing in the app would be lost. */
+function lostLine(backup: BackupData, app: AppNow): string | null {
+  const friendIds = new Set(backup.friends.map((friend) => friend.id))
+  const meetupIds = new Set(backup.meetups.map((meetup) => meetup.id))
+  const friends = app.friendIds.filter((id) => !friendIds.has(id)).length
+  const meetups = app.meetupIds.filter((id) => !meetupIds.has(id)).length
+  const parts = [friends > 0 ? plural(friends, 'friend') : null, meetups > 0 ? plural(meetups, 'meetup') : null]
+  const named = parts.filter((part): part is string => part !== null)
+  if (named.length === 0) return null
+  const one = friends + meetups === 1
+  return `${named.join(' and ')} in the app now ${one ? "isn't" : "aren't"} in this backup.`
+}
+
+/**
+ * The import confirm's message, a line each: the backup (when it was made, and what it holds), what's in the app
+ * now, what in the app isn't in the backup, and that the app's data will be replaced. The last two show only when
+ * there's something in the app to lose or replace.
+ */
+export function describeImport(backup: BackupData, exportedAt: string | null, app: AppNow, today: ISODate): string {
+  const counts = { friends: backup.friends.length, meetups: backup.meetups.length, photos: backup.meetupPhotos.length }
+  const withPhotos = counts.photos > 0 || app.photos > 0
+  const from = exportedAt === null ? 'This backup' : `Backup from ${formatDate(toISODate(new Date(exportedAt)), today)}`
+  const lines = [`${from}: ${countList(counts, withPhotos)}.`, appNowLine(app, withPhotos)]
+  if (app.friends > 0 || app.meetups > 0) {
+    const lost = lostLine(backup, app)
+    if (lost) lines.push(lost)
+    lines.push(REPLACED)
+  }
+  return lines.join('\n')
+}
```

In `src/components/ActionSheet.css`:

```diff
--- a/src/components/ActionSheet.css
+++ b/src/components/ActionSheet.css
@@ -53,10 +53,12 @@
   font-weight: 600;
   color: var(--ink-2);
 }
+/* A message may run to several short lines, one fact each (the import confirm). */
 .action-sheet__message {
   margin: var(--space-1) 0 0;
   font-size: var(--text-footnote);
   color: var(--ink-2);
+  white-space: pre-line;
 }
 .action-sheet__button {
   display: flex;
```

In `src/screens/SettingsScreen.tsx`:

```diff
--- a/src/screens/SettingsScreen.tsx
+++ b/src/screens/SettingsScreen.tsx
@@ -1,5 +1,6 @@
 import { useEffect, useRef, useState, type ChangeEvent } from 'react'
 import { exportBackup, shareBackupFile } from '../backup/exportBackup'
+import { describeImport } from '../backup/importSummary'
 import { meetupsSinceBackup } from '../backup/nudge'
 import { parseBackupFile, readAllData, replaceAllData } from '../backup/storage'
 import { useBackupDot } from '../backup/useBackupDot'
@@ -10,7 +11,7 @@ import { useToast } from '../components/Toast'
 import { useFriends, useGroups, useMeetups, useMeetupTypes, usePhotoCount, useSetting } from '../data/hooks'
 import { setSetting } from '../db/settings'
 import { useToday } from '../hooks/useToday'
-import { describeBackup, plural } from '../lib/text'
+import { describeBackup } from '../lib/text'
 import { AppLockSection } from '../lock/AppLockSection'
 import { usePasskeyAvailable } from '../lock/usePasskeyAvailable'
 import { RemindersSection } from '../reminders/RemindersSection'
@@ -96,10 +97,17 @@ export function SettingsScreen() {
       return
     }
     setImportError(null)
-    const { data } = result
+    const { data, exportedAt } = result
+    const app = {
+      friends: friends.length,
+      meetups: meetups.length,
+      photos: photoCount,
+      friendIds: friends.map((friend) => friend.id),
+      meetupIds: meetups.map((meetup) => meetup.id),
+    }
     const confirmed = await confirm({
       title: 'Replace all data with this backup?',
-      message: `It has ${plural(data.friends.length, 'friend')} and ${plural(data.meetups.length, 'meetup')}. Everything in the app now will be replaced.`,
+      message: describeImport(data, exportedAt, app, today),
       confirmLabel: 'Replace all data',
       destructive: true,
     })
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b` (no files written), then `npm test`
Expected: `Test Files  64 passed (64)` and `Tests  780 passed (780)`.

Run: `npm run build`, then `npx playwright test --project=iphone e2e/settings.spec.ts e2e/birthdays.spec.ts e2e/day.spec.ts e2e/memories.spec.ts e2e/preferences.spec.ts`
Expected: the build passes, and these pass.

Every spec that imports a backup: 60 passed.

- [ ] **Step 5: Commit**

```bash
git add e2e/settings.spec.ts src/backup/format.test.ts src/backup/format.ts src/backup/importSummary.test.ts src/backup/importSummary.ts src/components/ActionSheet.css src/screens/SettingsScreen.tsx
git commit -F - <<'EOF'
feat: the import confirm compares the backup with what's in the app

parseBackup now also gives the file's exportedAt (null when it's missing
or not a time; it never refuses a file for it). The confirm's message is a
line each: when the backup was made and what it holds, what's in the app
now, what in the app isn't in the backup, and that everything will be
replaced. Photo counts show when either side has any. describeImport in
src/backup/importSummary.ts builds the lines, and an action sheet's
message keeps its line breaks.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: Undo a restore, with Dexie version 4

**Files:**
- Create: `src/backup/RestoreUndoCleanup.ts`
- Modify: `src/App.tsx`, `src/backup/importSummary.ts`, `src/backup/storage.ts`, `src/components/InsetGroup.tsx`, `src/db/db.ts`, `src/db/settings.ts`, `src/screens/SettingsScreen.tsx`
- Test: `e2e/day.spec.ts`, `e2e/settings.spec.ts`, `src/backup/importSummary.test.ts`, `src/backup/storage.test.ts`, `src/db/db.test.ts`, `src/sw/push.test.ts`

- [ ] **Step 1: Write the failing tests**

The snapshot, the undo and the 7 days in `storage.test.ts` (photos at most 20 per `bulkAdd`, a failed restore changing nothing); the version 3 to 4 upgrade and a version 3 reader on a version 4 database in `db.test.ts`; the service worker's birthday push read that way in `push.test.ts`; and the toast's Undo, "Undo restore", the 7 days and a fresh app end to end.

In `e2e/day.spec.ts`:

```diff
--- a/e2e/day.spec.ts
+++ b/e2e/day.spec.ts
@@ -744,6 +744,8 @@ test('the owner’s example, written on the walk home, reads back as their day',
   await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
   await expect(page.locator('.day-logged')).toContainText('Logged with Mariya, Jessie and Brandon')
   await expect(page.locator('.toast')).toHaveCount(0)
+  // The note shows at once, while the sheet is still sliding away with its own Meal chip.
+  await expect(page.locator('.sheet-layer')).toHaveCount(0)
   await expect(page.getByRole('button', { name: 'Meal' })).toBeVisible()
   await expect(page.getByText('Sat, Oct 3 · with Mariya, Jessie and Brandon', { exact: true })).toBeVisible()
 
```

In `e2e/settings.spec.ts`:

```diff
--- a/e2e/settings.spec.ts
+++ b/e2e/settings.spec.ts
@@ -1,5 +1,5 @@
 import { expect, test, type Page } from '@playwright/test'
-import { addFriend, friendLink, goToTab, logMeetup } from './helpers.ts'
+import { addFriend, friendLink, goToTab, logMeetup, readMeetupPhotos, readMeetups, tinyPhoto } from './helpers.ts'
 
 /** Forces the download path for a backup: the share sheet can't be driven in tests. */
 async function downloadBackups(page: Page) {
@@ -94,12 +94,139 @@ test('exports and imports a backup', async ({ page }) => {
   await page.locator('input[type="file"]').setInputFiles(backupPath)
   await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
   await expect(page.getByRole('status')).toContainText('Backup restored')
+  await expect(page.getByRole('status').getByRole('button', { name: 'Undo' })).toBeVisible()
 
+  // The toast belongs to Settings: going to Friends clears it.
   await goToTab(page, 'Friends')
+  await expect(page.locator('.toast')).toHaveCount(0)
   await expect(friendLink(page, 'Alex')).toBeVisible()
   await expect(friendLink(page, 'Kim')).toHaveCount(0)
 })
 
+/** The rows kept to undo a restore, counted straight from IndexedDB. */
+async function countRestoreUndo(page: Page): Promise<number> {
+  return page.evaluate(
+    () =>
+      new Promise<number>((resolve, reject) => {
+        const request = indexedDB.open('friend-tracker')
+        request.onerror = () => reject(request.error)
+        request.onsuccess = () => {
+          const database = request.result
+          const count = database.transaction('restoreUndo').objectStore('restoreUndo').count()
+          count.onsuccess = () => {
+            database.close()
+            resolve(count.result)
+          }
+          count.onerror = () => reject(count.error)
+        }
+      }),
+  )
+}
+
+/**
+ * On Wed, Oct 21: Alex and a Coffee with a photo, backed up; then Kim and a Meal with her, which the backup doesn't
+ * have. Returns the backup file.
+ */
+async function backUpThenAddMore(page: Page): Promise<string> {
+  await downloadBackups(page)
+  await page.clock.setFixedTime(new Date(2026, 9, 21, 10))
+  await page.goto('/')
+  await addFriend(page, 'Alex')
+  await logMeetup(page, ['Alex'], { photos: [tinyPhoto('one.png')] })
+  const backupPath = await exportFile(page)
+  await goToTab(page, 'Friends')
+  await addFriend(page, 'Kim')
+  await logMeetup(page, ['Kim'], { type: 'Meal', photos: [tinyPhoto('two.png'), tinyPhoto('three.png')] })
+  return backupPath
+}
+
+/** Imports a backup file from Settings, confirming. */
+async function restore(page: Page, backupPath: string) {
+  await goToTab(page, 'Settings')
+  await page.locator('input[type="file"]').setInputFiles(backupPath)
+  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
+  await expect(page.getByRole('status')).toContainText('Backup restored')
+}
+
+test('Undo on the "Backup restored" toast puts everything back', async ({ page }) => {
+  const backupPath = await backUpThenAddMore(page)
+  await restore(page, backupPath)
+  expect(await readMeetups(page)).toHaveLength(1)
+
+  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
+
+  await expect(page.getByRole('status')).toContainText('Restore undone')
+  await expect.poll(async () => (await readMeetups(page)).length).toBe(2)
+  expect(await readMeetupPhotos(page)).toHaveLength(3)
+  expect(await countRestoreUndo(page)).toBe(0)
+  await expect(page.getByRole('button', { name: 'Undo restore' })).toHaveCount(0)
+  await goToTab(page, 'Friends')
+  await expect(friendLink(page, 'Kim')).toBeVisible()
+  await expect(friendLink(page, 'Alex')).toBeVisible()
+})
+
+test('"Undo restore" in Settings asks first, puts everything back, and then goes', async ({ page }) => {
+  const backupPath = await backUpThenAddMore(page)
+  await restore(page, backupPath)
+  // The toast goes with the page; Settings still offers the undo.
+  await goToTab(page, 'Friends')
+  await expect(friendLink(page, 'Kim')).toHaveCount(0)
+  await goToTab(page, 'Settings')
+
+  const row = page.getByRole('button', { name: 'Undo restore', exact: true })
+  await expect(row).toHaveAccessibleDescription('Puts back the data from before Wed, Oct 21. Kept until Wed, Oct 28.')
+  await row.click()
+  const confirm = page.getByRole('alertdialog', { name: 'Undo the restore?' })
+  const message = await confirm.locator('.action-sheet__message').evaluate((element) => element.textContent)
+  expect(message?.split('\n')).toEqual([
+    'Before Wed, Oct 21: 2 friends, 2 meetups, 3 photos.',
+    'In the app now: 1 friend, 1 meetup, 1 photo.',
+    'Everything in the app now will be replaced.',
+  ])
+  await confirm.getByRole('button', { name: 'Undo restore' }).click()
+
+  await expect(page.getByRole('status')).toContainText('Restore undone')
+  await expect(row).toHaveCount(0)
+  await expect.poll(async () => (await readMeetups(page)).length).toBe(2)
+  expect(await readMeetupPhotos(page)).toHaveLength(3)
+})
+
+test('a restore can be undone for 7 days, then its snapshot is gone', async ({ page }) => {
+  const backupPath = await backUpThenAddMore(page)
+  await restore(page, backupPath)
+  expect(await countRestoreUndo(page)).toBeGreaterThan(0)
+
+  // Six days on, still offered.
+  await page.clock.setFixedTime(new Date(2026, 9, 27, 10))
+  await page.reload()
+  await expect(page.getByRole('button', { name: 'Undo restore', exact: true })).toBeVisible()
+
+  // Seven days on, the next start lets it go.
+  await page.clock.setFixedTime(new Date(2026, 9, 28, 10))
+  await page.reload()
+  await expect(page.getByRole('button', { name: 'Import backup' })).toBeVisible()
+  await expect(page.getByRole('button', { name: 'Undo restore', exact: true })).toHaveCount(0)
+  await expect.poll(() => countRestoreUndo(page)).toBe(0)
+})
+
+test('a restore into a fresh app has nothing to undo', async ({ page }) => {
+  const backupPath = await backUpThenAddMore(page)
+  await page.evaluate(() => indexedDB.deleteDatabase('friend-tracker'))
+  await page.reload()
+  await expect(page.getByText('Add the people you want to keep up with.')).toBeVisible()
+
+  await goToTab(page, 'Settings')
+  await page.locator('input[type="file"]').setInputFiles(backupPath)
+  const confirm = page.getByRole('alertdialog')
+  await expect(confirm).toContainText('No friends or meetups in the app yet.')
+  await expect(confirm).not.toContainText('undo')
+  await confirm.getByRole('button', { name: 'Replace all data' }).click()
+  await expect(page.getByRole('status')).toContainText('Backup restored')
+  await expect(page.getByRole('status').getByRole('button')).toHaveCount(0)
+  await expect(page.getByRole('button', { name: 'Undo restore', exact: true })).toHaveCount(0)
+  expect(await countRestoreUndo(page)).toBe(0)
+})
+
 test('a quiet dot on the Settings tab suggests a backup once meetups are logged after one 30 days old', async ({
   page,
 }) => {
@@ -166,7 +293,7 @@ test('the import confirm compares the backup with the app', async ({ page }) =>
     'Backup from Wed, Sep 2: 1 friend, 1 meetup.',
     'In the app now: 2 friends, 3 meetups.',
     "1 friend and 2 meetups in the app now aren't in this backup.",
-    'Everything in the app now will be replaced.',
+    'Everything in the app now will be replaced. You can undo this in Settings for 7 days.',
   ])
   // One line each.
   await expect(confirm.locator('.action-sheet__message')).toHaveCSS('white-space', 'pre-line')
```

In `src/backup/importSummary.test.ts`:

```diff
--- a/src/backup/importSummary.test.ts
+++ b/src/backup/importSummary.test.ts
@@ -1,7 +1,7 @@
 import { describe, expect, it } from 'vitest'
 import { friend, meetup, meetupPhoto, meetupType } from '../test/fixtures'
 import type { BackupData } from './format'
-import { describeImport, type AppNow } from './importSummary'
+import { describeImport, describeRestoreKept, describeUndoRestore, type AppNow } from './importSummary'
 
 const TODAY = '2026-10-21'
 /** Exported on Wed, Sep 2, 2026, at 9 AM on the phone's clock. */
@@ -33,7 +33,7 @@ describe('describeImport', () => {
       'Backup from Wed, Sep 2: 15 friends, 30 meetups, 6 photos.',
       'In the app now: 15 friends, 39 meetups, 9 photos.',
       "9 meetups in the app now aren't in this backup.",
-      'Everything in the app now will be replaced.',
+      'Everything in the app now will be replaced. You can undo this in Settings for 7 days.',
     ])
   })
 
@@ -71,6 +71,27 @@ describe('describeImport', () => {
     expect(line(['f0', 'x1', 'x2'], ['m0'])).toBe("2 friends in the app now aren't in this backup.")
     expect(line(['x1'], ['m0'])).toBe("1 friend in the app now isn't in this backup.")
     // Nothing missing: straight on to the last line.
-    expect(line(['f0'], ['m0'])).toBe('Everything in the app now will be replaced.')
+    expect(line(['f0'], ['m0'])).toBe('Everything in the app now will be replaced. You can undo this in Settings for 7 days.')
+  })
+})
+
+describe('the undo of a restore', () => {
+  const kept = { takenAt: new Date(2026, 9, 21, 9).toISOString(), friends: 15, meetups: 39, photos: 9 }
+
+  it('says what it puts back, and until when', () => {
+    expect(describeRestoreKept(kept, TODAY)).toBe('Puts back the data from before Wed, Oct 21. Kept until Wed, Oct 28.')
+  })
+
+  it('compares what the app held before the restore with what it holds now', () => {
+    expect(describeUndoRestore(kept, { friends: 15, meetups: 30, photos: 6 }, TODAY).split('\n')).toEqual([
+      'Before Wed, Oct 21: 15 friends, 39 meetups, 9 photos.',
+      'In the app now: 15 friends, 30 meetups, 6 photos.',
+      'Everything in the app now will be replaced.',
+    ])
+    expect(describeUndoRestore({ ...kept, photos: 0 }, { friends: 1, meetups: 2, photos: 0 }, TODAY).split('\n')).toEqual([
+      'Before Wed, Oct 21: 15 friends, 39 meetups.',
+      'In the app now: 1 friend, 2 meetups.',
+      'Everything in the app now will be replaced.',
+    ])
   })
 })
```

In `src/backup/storage.test.ts`:

```diff
--- a/src/backup/storage.test.ts
+++ b/src/backup/storage.test.ts
@@ -1,4 +1,4 @@
-import { beforeEach, describe, expect, it } from 'vitest'
+import { beforeEach, describe, expect, it, vi } from 'vitest'
 import { db, resetDatabase } from '../db/db'
 import { addFriend } from '../db/friends'
 import { getSetting, setSetting } from '../db/settings'
@@ -10,7 +10,16 @@ import type { BirthdayReminders } from '../reminders/types'
 import { OWNER_DAY_TYPED, OWNER_FEELINGS } from '../test/dayFixtures'
 import { friend, meetup, meetupPhoto, meetupType } from '../test/fixtures'
 import { createBackup, type BackupData } from './format'
-import { parseBackupFile, readAllData, readAllPhotos, replaceAllData } from './storage'
+import {
+  forgetOldRestore,
+  parseBackupFile,
+  readAllData,
+  readAllPhotos,
+  replaceAllData,
+  restoreBackup,
+  restoreUndoExpired,
+  undoRestore,
+} from './storage'
 
 beforeEach(resetDatabase)
 
@@ -179,3 +188,154 @@ describe('backup storage', () => {
     expect((await db.meetupPhotos.toArray()).map((p) => p.id)).toEqual(['p1'])
   })
 })
+
+describe('restoring a backup, and undoing it', () => {
+  /** Wed, Oct 21, 2026, at noon. */
+  const NOW = new Date(2026, 9, 21, 12)
+  const HOUR = 60 * 60 * 1000
+  const BACKUP: BackupData = {
+    friends: [friend('f1', 'Sam')],
+    groups: [],
+    meetupTypes: [meetupType('t1', 'Coffee', 0)],
+    meetups: [meetup('m1', '2026-09-01', ['f1'], 't1')],
+    meetupPhotos: [meetupPhoto('p9', 'm1', 0)],
+  }
+
+  /** An app with a group, a friend in it, a custom type, two meetups and three photos. */
+  async function fillApp() {
+    const college = await addGroup('College')
+    const alex = await addFriend({ name: 'Alex', groupId: college.id, photo: null, notes: '', birthday: null })
+    await db.meetupTypes.add(meetupType('type-hike', 'Hike', 9, '🥾'))
+    const photo = (id: string) => ({ id, full: `data:image/jpeg;base64,FULL${id}`, thumb: `data:image/jpeg;base64,THUMB${id}`, width: 4, height: 3 })
+    const input = { date: '2026-09-01', typeId: 'type-hike', friendIds: [alex.id], activities: [] }
+    await addMeetup(input, { add: [photo('a'), photo('b')], removeIds: [], order: [] })
+    await addMeetup({ ...input, date: '2026-10-01' }, { add: [photo('c')], removeIds: [], order: [] })
+  }
+
+  /** The snapshot, table by table, as BackupData. */
+  async function snapshot(): Promise<BackupData> {
+    const rows = await db.restoreUndo.toArray()
+    const of = <T,>(table: string) => rows.filter((row) => row.table === table).map((row) => row.row as T)
+    return {
+      friends: of('friends'),
+      groups: of('groups'),
+      meetupTypes: of('meetupTypes'),
+      meetups: of('meetups'),
+      meetupPhotos: of('meetupPhotos'),
+    }
+  }
+
+  it('keeps what it replaces, types and photos included, with its counts, then replaces it', async () => {
+    await fillApp()
+    const before = await readAllData()
+    expect(await restoreBackup(BACKUP, NOW)).toEqual({ undoable: true })
+    expect(sortById(await readAllData())).toEqual(sortById(BACKUP))
+    expect(sortById(await snapshot())).toEqual(sortById(before))
+    expect(await getSetting('restoreUndo')).toEqual({ takenAt: NOW.toISOString(), friends: 1, meetups: 2, photos: 3 })
+  })
+
+  it('into an app with no friends or meetups keeps nothing, drops an older snapshot, and cannot be undone', async () => {
+    await fillApp()
+    await restoreBackup(BACKUP, NOW)
+    expect(await db.restoreUndo.count()).toBeGreaterThan(0)
+    // A new phone: no friends and no meetups.
+    await db.friends.clear()
+    await db.meetups.clear()
+    expect(await restoreBackup(BACKUP, NOW)).toEqual({ undoable: false })
+    expect(await db.restoreUndo.count()).toBe(0)
+    expect(await getSetting('restoreUndo')).toBeNull()
+    expect(await undoRestore()).toBe(false)
+    expect(sortById(await readAllData())).toEqual(sortById(BACKUP))
+  })
+
+  it('undo puts back exactly what was there and lets the snapshot go; a second undo does nothing', async () => {
+    await fillApp()
+    const before = await readAllData()
+    await restoreBackup(BACKUP, NOW)
+    expect(await undoRestore()).toBe(true)
+    expect(sortById(await readAllData())).toEqual(sortById(before))
+    expect(await db.restoreUndo.count()).toBe(0)
+    expect(await getSetting('restoreUndo')).toBeNull()
+    expect(await undoRestore()).toBe(false)
+    expect(sortById(await readAllData())).toEqual(sortById(before))
+  })
+
+  it('keeps a snapshot for 7 days', async () => {
+    await fillApp()
+    await restoreBackup(BACKUP, NOW)
+    const kept = await getSetting('restoreUndo')
+    if (!kept) throw new Error('Nothing kept')
+    const later = (hours: number) => new Date(NOW.getTime() + hours * HOUR)
+    expect(restoreUndoExpired(kept, later(7 * 24 - 1))).toBe(false)
+    expect(restoreUndoExpired(kept, later(7 * 24))).toBe(true)
+
+    await forgetOldRestore(later(7 * 24 - 1))
+    expect(await db.restoreUndo.count()).toBeGreaterThan(0)
+    expect(await getSetting('restoreUndo')).toEqual(kept)
+    await forgetOldRestore(later(7 * 24))
+    expect(await db.restoreUndo.count()).toBe(0)
+    expect(await getSetting('restoreUndo')).toBeNull()
+  })
+
+  it('forgets rows no setting names', async () => {
+    await db.restoreUndo.add({ table: 'friends', id: 'f1', row: friend('f1', 'Alex') })
+    await forgetOldRestore(NOW)
+    expect(await db.restoreUndo.count()).toBe(0)
+  })
+
+  it('a restore that fails changes nothing, the snapshot included', async () => {
+    await fillApp()
+    await restoreBackup(BACKUP, NOW)
+    const app = await readAllData()
+    const kept = await db.restoreUndo.toArray()
+    const keptInfo = await getSetting('restoreUndo')
+    const twice = meetup('twice', '2026-09-02', ['f1'], 't1')
+    await expect(restoreBackup({ ...BACKUP, meetups: [twice, twice] }, new Date(NOW.getTime() + HOUR))).rejects.toThrow()
+    expect(sortById(await readAllData())).toEqual(sortById(app))
+    expect(await db.restoreUndo.toArray()).toEqual(kept)
+    expect(await getSetting('restoreUndo')).toEqual(keptInfo)
+  })
+
+  it('copies photos at most 20 at a time, both ways', async () => {
+    await db.friends.add(friend('f1', 'Alex'))
+    await db.meetups.add(meetup('m1', '2026-09-01', ['f1'], 'type-coffee'))
+    await db.meetupPhotos.bulkAdd(Array.from({ length: 45 }, (_, i) => meetupPhoto(`p${String(i).padStart(2, '0')}`, 'm1', i)))
+    const kept = vi.spyOn(db.restoreUndo, 'bulkAdd')
+    await restoreBackup(BACKUP, NOW)
+    const keptPhotos = kept.mock.calls
+      .map(([rows]) => rows.filter((row) => row.table === 'meetupPhotos').length)
+      .filter((count) => count > 0)
+    expect(keptPhotos).toEqual([20, 20, 5])
+    kept.mockRestore()
+
+    const putBack = vi.spyOn(db.meetupPhotos, 'bulkAdd')
+    expect(await undoRestore()).toBe(true)
+    expect(putBack.mock.calls.map(([rows]) => rows.length)).toEqual([20, 20, 5])
+    putBack.mockRestore()
+    expect((await readAllPhotos()).map((photo) => photo.id)).toHaveLength(45)
+  })
+
+  it('shows a restored photo’s own thumbnail, and an undone one’s', async () => {
+    await db.friends.add(friend('f1', 'Alex'))
+    await db.meetups.add(meetup('m1', '2026-09-01', ['f1'], 'type-coffee'))
+    await db.meetupPhotos.add(meetupPhoto('p1', 'm1', 0))
+    expect(await firstPhotoThumb('m1')).toBe('data:image/jpeg;base64,THUMBp1')
+    const restored = { ...meetupPhoto('p1', 'm1', 0), thumb: 'data:image/jpeg;base64,RESTORED' }
+    await restoreBackup({ ...BACKUP, meetups: [meetup('m1', '2026-09-01', ['f1'], 't1')], meetupPhotos: [restored] }, NOW)
+    expect(await firstPhotoThumb('m1')).toBe('data:image/jpeg;base64,RESTORED')
+    await undoRestore()
+    expect(await firstPhotoThumb('m1')).toBe('data:image/jpeg;base64,THUMBp1')
+  })
+
+  it('never puts the snapshot in a backup, and keeps the settings', async () => {
+    await fillApp()
+    await setSetting('lastBackupAt', '2026-09-02T10:00:00.000Z')
+    await restoreBackup(BACKUP, NOW)
+    const all = await readAllData()
+    expect(sortById(all)).toEqual(sortById(BACKUP))
+    expect(JSON.stringify(createBackup(all, NOW))).not.toContain('restoreUndo')
+    expect(await getSetting('lastBackupAt')).toBe('2026-09-02T10:00:00.000Z')
+    await undoRestore()
+    expect(await getSetting('lastBackupAt')).toBe('2026-09-02T10:00:00.000Z')
+  })
+})
```

In `src/db/db.test.ts`:

```diff
--- a/src/db/db.test.ts
+++ b/src/db/db.test.ts
@@ -44,7 +44,7 @@ describe('upgrade from version 1', () => {
     expect(await db.friends.get('f1')).toEqual({ ...v1Friend, likes: [], dislikes: [], birthday: null })
     expect(await db.friends.get('f2')).toEqual({ ...nullListsFriend, likes: [], dislikes: [], birthday: null })
     // Dexie stores the version times 10. Read it from the native database to prove the upgrades ran.
-    expect(db.backendDB().version).toBe(30)
+    expect(db.backendDB().version).toBe(40)
   })
 })
 
@@ -102,13 +102,14 @@ describe('upgrade from version 2', () => {
 
     // Dexie stores the version times 10. Read it from the native database to prove the upgrade ran.
     const native = db.backendDB()
-    expect(native.version).toBe(30)
+    expect(native.version).toBe(40)
     expect([...native.objectStoreNames].sort()).toEqual([
       'friends',
       'groups',
       'meetupPhotos',
       'meetupTypes',
       'meetups',
+      'restoreUndo',
       'settings',
     ])
     const photoIndexes = native.transaction('meetupPhotos').objectStore('meetupPhotos').indexNames
@@ -127,6 +128,112 @@ describe('upgrade from version 2', () => {
   })
 })
 
+/** Version 3 of the database's stores, as the app (and its service worker) declared them before version 4. */
+const V3_STORES = {
+  friends: 'id, groupId',
+  groups: 'id',
+  meetupTypes: 'id, order',
+  meetups: 'id, date, typeId, *friendIds',
+  settings: 'key',
+  meetupPhotos: 'id, meetupId, [meetupId+order]',
+}
+
+describe('upgrade from version 3', () => {
+  it('adds the restoreUndo store and changes nothing else', async () => {
+    const v3Friend = {
+      id: 'f1',
+      name: 'Alex',
+      groupId: null,
+      photo: null,
+      notes: '',
+      likes: [],
+      dislikes: [],
+      birthday: { month: 3, day: 14, year: null },
+      createdAt: '2026-01-01T00:00:00.000Z',
+    }
+    const v3Meetup = {
+      id: 'm1',
+      date: '2026-09-01',
+      typeId: 'type-coffee',
+      friendIds: ['f1'],
+      note: '@Blue willow 3:30',
+      activities: ['Karaoke'],
+      weather: ['rainy'],
+      mood: 'okay',
+      feelings: 'Good',
+      createdAt: '2026-09-01T12:00:00.000Z',
+    }
+    const v3Photo = {
+      id: 'p1',
+      meetupId: 'm1',
+      order: 0,
+      full: 'data:image/jpeg;base64,FULL',
+      thumb: 'data:image/jpeg;base64,THUMB',
+      width: 4,
+      height: 3,
+      createdAt: '2026-09-01T12:00:00.000Z',
+    }
+    // Build the database as version 3 of the app left it, under the app's own name.
+    db.close()
+    await Dexie.delete('friend-tracker')
+    const v3 = new Dexie('friend-tracker')
+    v3.version(3).stores(V3_STORES)
+    try {
+      await v3.table('friends').add(v3Friend)
+      await v3.table('meetups').add(v3Meetup)
+      await v3.table('meetupPhotos').add(v3Photo)
+      await v3.table('settings').put({ key: 'lastBackupAt', value: '2026-10-02T10:00:00.000Z' })
+    } finally {
+      v3.close()
+    }
+
+    await db.open()
+
+    const native = db.backendDB()
+    expect(native.version).toBe(40)
+    const store = native.transaction('restoreUndo').objectStore('restoreUndo')
+    expect(store.keyPath).toEqual(['table', 'id'])
+    expect([...store.indexNames]).toEqual([])
+    expect(await db.restoreUndo.count()).toBe(0)
+    expect(await db.friends.get('f1')).toEqual(v3Friend)
+    expect(await db.meetups.get('m1')).toEqual(v3Meetup)
+    expect(await db.meetupPhotos.get('p1')).toEqual(v3Photo)
+    expect(await getSetting('lastBackupAt')).toBe('2026-10-02T10:00:00.000Z')
+    expect(await getSetting('restoreUndo')).toBeNull()
+  })
+
+  it('code still on version 3 (the service worker before it updates, a second tab) reads a version 4 database', async () => {
+    await db.friends.add({ ...friendRecord('f1', 'Alex'), birthday: { month: 10, day: 14, year: null } })
+    await db.restoreUndo.add({ table: 'friends', id: 'gone', row: friendRecord('gone', 'Gone') })
+    db.close()
+    const old = new Dexie('friend-tracker')
+    old.version(3).stores(V3_STORES)
+    try {
+      // Dexie 4 opens a database newer than it declares (no VersionError), and reads its stores as before.
+      expect((await old.table('friends').toArray()).map((row: Friend) => row.name)).toEqual(['Alex'])
+      expect(old.backendDB().version).toBe(40)
+    } finally {
+      old.close()
+      await db.open()
+    }
+  })
+})
+
+/** A complete friend record, as the database holds one. */
+function friendRecord(id: string, name: string): Friend {
+  return {
+    id,
+    name,
+    groupId: null,
+    photo: null,
+    notes: '',
+    likes: [],
+    dislikes: [],
+    birthday: null,
+    createdAt: '2026-01-01T00:00:00.000Z',
+  }
+}
+
 describe('meetups read from the database', () => {
   /** Writes rows the way version 3 of the database holds them, without the reading hook or the app's types. */
   async function writeRaw(rows: Record<string, unknown>[]) {
```

In `src/sw/push.test.ts`:

```diff
--- a/src/sw/push.test.ts
+++ b/src/sw/push.test.ts
@@ -1,3 +1,4 @@
+import Dexie from 'dexie'
 import { beforeEach, describe, expect, it, vi } from 'vitest'
 import { db, resetDatabase } from '../db/db'
 import { friend } from '../test/fixtures'
@@ -126,6 +127,31 @@ describe('onPush', () => {
     expect(registration.showNotification.mock.calls[0][0]).toBe('🎂 A birthday is coming up')
   })
 
+  it('still names the friend when the worker is older than the database (version 3 code, version 4 data)', async () => {
+    await db.friends.add(withBirthday('alex', 'Alex', { month: 10, day: 14, year: 1990 }))
+    db.close()
+    // The worker as it was before version 4: it declares version 3 of the same database.
+    const old = new Dexie('friend-tracker')
+    old.version(3).stores({
+      friends: 'id, groupId',
+      groups: 'id',
+      meetupTypes: 'id, order',
+      meetups: 'id, date, typeId, *friendIds',
+      settings: 'key',
+      meetupPhotos: 'id, meetupId, [meetupId+order]',
+    })
+    const registration = fakeRegistration()
+    const push = pushEvent(jsonData({ kind: 'birthday' }))
+    try {
+      onPush(push.event, { registration, readFriends: () => old.table('friends').toArray(), now: () => NIGHT_BEFORE })
+      await push.settled()
+    } finally {
+      old.close()
+      await db.open()
+    }
+    expect(registration.showNotification.mock.calls[0][0]).toBe("🎂 Alex's birthday starts in 5 minutes")
+  })
+
   it('shows the fallback when nobody has a birthday that night', async () => {
     await db.friends.add(withBirthday('sam', 'Sam', { month: 3, day: 2, year: null }))
     const registration = fakeRegistration()
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/backup src/db/db.test.ts src/sw`
Expected: 17 FAIL (no `restoreBackup`, `undoRestore` or `forgetOldRestore`, no `restoreUndo` store, version 30 instead of 40). The push test with the version 3 reader passes already: nothing is newer yet.

- [ ] **Step 3: Implement**

Dexie version 4 adds `restoreUndo`; `restoreBackup`, `undoRestore` and `forgetOldRestore` in `src/backup/storage.ts`; `RestoreUndoCleanup` in `App`; Settings' toast Undo, "Undo restore" row and confirm.

In `src/App.tsx`:

```diff
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,4 +1,5 @@
 import { HashRouter, Navigate, Route, Routes } from 'react-router'
+import { RestoreUndoCleanup } from './backup/RestoreUndoCleanup'
 import { ActionSheetProvider } from './components/ActionSheet'
 import { PlaceMemoryProvider } from './components/PlaceMemory'
 import { ScrollManager } from './components/ScrollManager'
@@ -28,6 +29,7 @@ export default function App() {
               <MeetupIdsWithPhotosProvider>
                 <ScrollManager />
                 <ReminderSync />
+                <RestoreUndoCleanup />
                 <main className="app">
                   <Routes>
                     <Route path="/" element={<FriendsScreen />} />
```

In `src/backup/RestoreUndoCleanup.ts`:

```diff
--- /dev/null
+++ b/src/backup/RestoreUndoCleanup.ts
@@ -0,0 +1,11 @@
+import { useEffect } from 'react'
+import { forgetOldRestore } from './storage'
+
+/** Lets a restore's snapshot go once it's 7 days old, each time the app starts. Mounted once inside App. */
+export function RestoreUndoCleanup(): null {
+  useEffect(() => {
+    // Best effort: a snapshot left over is deleted next time, and Settings never offers one past its 7 days.
+    forgetOldRestore(new Date()).catch(() => {})
+  }, [])
+  return null
+}
```

In `src/backup/importSummary.ts`:

```diff
--- a/src/backup/importSummary.ts
+++ b/src/backup/importSummary.ts
@@ -1,4 +1,5 @@
-import { formatDate, toISODate, type ISODate } from '../lib/dates'
+import type { RestoreUndoInfo } from '../db/settings'
+import { addDays, formatDate, toISODate, type ISODate } from '../lib/dates'
 import { plural } from '../lib/text'
 import type { BackupData } from './format'
 
@@ -20,6 +21,8 @@ export interface AppNow extends DataCounts {
 
 /** The last line of a confirm that replaces the app's data. */
 const REPLACED = 'Everything in the app now will be replaced.'
+/** How long a restore can be undone (RESTORE_UNDO_DAYS in storage.ts). */
+const UNDO_DAYS = 7
 
 /** "15 friends, 30 meetups, 6 photos", the photos only `withPhotos` (when either side has any). */
 function countList(counts: DataCounts, withPhotos: boolean): string {
@@ -60,7 +63,27 @@ export function describeImport(backup: BackupData, exportedAt: string | null, ap
   if (app.friends > 0 || app.meetups > 0) {
     const lost = lostLine(backup, app)
     if (lost) lines.push(lost)
-    lines.push(REPLACED)
+    lines.push(`${REPLACED} You can undo this in Settings for ${UNDO_DAYS} days.`)
   }
   return lines.join('\n')
 }
+
+/** The local date a restore's snapshot was taken. */
+function takenOn(kept: RestoreUndoInfo): ISODate {
+  return toISODate(new Date(kept.takenAt))
+}
+
+/** The "Undo restore" row's subtitle: "Puts back the data from before Wed, Oct 21. Kept until Wed, Oct 28." */
+export function describeRestoreKept(kept: RestoreUndoInfo, today: ISODate): string {
+  const taken = takenOn(kept)
+  const until = addDays(taken, UNDO_DAYS)
+  return `Puts back the data from before ${formatDate(taken, today)}. Kept until ${formatDate(until, today)}.`
+}
+
+/** The "Undo the restore?" confirm's message: what the app held before the restore, what it holds now, and that it goes. */
+export function describeUndoRestore(kept: RestoreUndoInfo, app: DataCounts, today: ISODate): string {
+  const withPhotos = kept.photos > 0 || app.photos > 0
+  const lines = [`Before ${formatDate(takenOn(kept), today)}: ${countList(kept, withPhotos)}.`, appNowLine(app, withPhotos)]
+  if (app.friends > 0 || app.meetups > 0) lines.push(REPLACED)
+  return lines.join('\n')
+}
```

In `src/backup/storage.ts`:

```diff
--- a/src/backup/storage.ts
+++ b/src/backup/storage.ts
@@ -1,11 +1,24 @@
-import { db } from '../db/db'
+import Dexie from 'dexie'
+import { db, type DataTable, type RestoreUndoRow } from '../db/db'
 import { forgetPhotoThumbs } from '../db/meetups'
-import type { MeetupPhoto } from '../types'
+import { getSetting, setSetting, type RestoreUndoInfo } from '../db/settings'
+import type { Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'
 import { parseBackup, type BackupData, type ParseResult } from './format'
 
+/** How long a restore can be undone. */
+export const RESTORE_UNDO_DAYS = 7
+const RESTORE_UNDO_MS = RESTORE_UNDO_DAYS * 24 * 60 * 60 * 1000
+/** Photos are copied for an undo this many at a time, so it holds at most this many full images at once. */
+const PHOTO_BATCH = 20
+
+/** The five tables a backup holds and a restore replaces, by name: never restoreUndo or settings. */
+function dataTables() {
+  return [db.friends, db.groups, db.meetupTypes, db.meetups, db.meetupPhotos]
+}
+
 /** Reads everything in one snapshot, every full photo included: only for backups and tests. */
 export async function readAllData(): Promise<BackupData> {
-  return db.transaction('r', [db.friends, db.groups, db.meetupTypes, db.meetups, db.meetupPhotos], async () => {
+  return db.transaction('r', dataTables(), async () => {
     const [friends, groups, meetupTypes, meetups, meetupPhotos] = await Promise.all([
       db.friends.toArray(),
       db.groups.toArray(),
@@ -22,26 +35,131 @@ export function readAllPhotos(): Promise<MeetupPhoto[]> {
   return db.meetupPhotos.toArray()
 }
 
-/** Replaces everything in one transaction. If anything fails, nothing changes. */
+/** Empties the five tables and writes `data` into them, inside the caller's transaction. */
+async function writeAllData(data: BackupData): Promise<void> {
+  await Promise.all(dataTables().map((table) => table.clear()))
+  await db.groups.bulkAdd(data.groups)
+  await db.meetupTypes.bulkAdd(data.meetupTypes)
+  await db.friends.bulkAdd(data.friends)
+  await db.meetups.bulkAdd(data.meetups)
+  await db.meetupPhotos.bulkAdd(data.meetupPhotos)
+}
+
+/** Replaces everything in one transaction. If anything fails, nothing changes. Keeps nothing to undo with. */
 export async function replaceAllData(data: BackupData): Promise<void> {
-  await db.transaction('rw', [db.friends, db.groups, db.meetupTypes, db.meetups, db.meetupPhotos], async () => {
-    await Promise.all([
-      db.friends.clear(),
-      db.groups.clear(),
-      db.meetupTypes.clear(),
-      db.meetups.clear(),
-      db.meetupPhotos.clear(),
-    ])
-    await db.groups.bulkAdd(data.groups)
-    await db.meetupTypes.bulkAdd(data.meetupTypes)
-    await db.friends.bulkAdd(data.friends)
-    await db.meetups.bulkAdd(data.meetups)
-    await db.meetupPhotos.bulkAdd(data.meetupPhotos)
-  })
+  await db.transaction('rw', dataTables(), () => writeAllData(data))
   // Every photo was replaced, so no thumbnail kept in memory can be trusted.
   forgetPhotoThumbs()
 }
 
+function undoRows(table: DataTable, rows: readonly { id: string }[]): RestoreUndoRow[] {
+  return rows.map((row) => ({ table, id: row.id, row }))
+}
+
+/**
+ * Copies what's in the five tables into restoreUndo, inside the caller's transaction, and says how many photos it
+ * copied. Friends, groups, types and meetups are small and copied whole (friends' photos are 400px avatars, and
+ * meetups hold no images); meetup photos are copied 20 at a time by primary key, so this holds at most 20 full images
+ * however many the app has.
+ */
+async function keepForUndo(): Promise<number> {
+  const [friends, groups, meetupTypes, meetups] = await Promise.all([
+    db.friends.toArray(),
+    db.groups.toArray(),
+    db.meetupTypes.toArray(),
+    db.meetups.toArray(),
+  ])
+  await db.restoreUndo.bulkAdd([
+    ...undoRows('friends', friends),
+    ...undoRows('groups', groups),
+    ...undoRows('meetupTypes', meetupTypes),
+    ...undoRows('meetups', meetups),
+  ])
+  let photos = 0
+  let lastId: string | null = null
+  for (;;) {
+    const batch: MeetupPhoto[] = await (lastId === null
+      ? db.meetupPhotos.orderBy(':id').limit(PHOTO_BATCH).toArray()
+      : db.meetupPhotos.where(':id').above(lastId).limit(PHOTO_BATCH).toArray())
+    if (batch.length === 0) return photos
+    await db.restoreUndo.bulkAdd(undoRows('meetupPhotos', batch))
+    photos += batch.length
+    lastId = batch[batch.length - 1].id
+  }
+}
+
+/**
+ * Restores a backup over everything in the app. First, in the same transaction, it keeps what it replaces (friends,
+ * groups, meetup types, meetups and their photos) in restoreUndo, replacing any older snapshot, so either both happen
+ * or neither. Into an app with no friends and no meetups (a new phone) there's nothing to keep: it keeps none, drops
+ * any older one, and the restore can't be undone. Settings data is never part of it, as it's never part of a backup.
+ */
+export async function restoreBackup(data: BackupData, now: Date): Promise<{ undoable: boolean }> {
+  const undoable = await db.transaction('rw', [...dataTables(), db.restoreUndo, db.settings], async () => {
+    await db.restoreUndo.clear()
+    const [friends, meetups] = await Promise.all([db.friends.count(), db.meetups.count()])
+    const kept: RestoreUndoInfo | null =
+      friends > 0 || meetups > 0 ? { takenAt: now.toISOString(), friends, meetups, photos: await keepForUndo() } : null
+    await setSetting('restoreUndo', kept)
+    await writeAllData(data)
+    return kept !== null
+  })
+  forgetPhotoThumbs()
+  return { undoable }
+}
+
+/** The rows restoreUndo keeps of one table (photos: up to `limit` after `afterId`). */
+function keptRows(table: DataTable, afterId: string | null = null, limit = Infinity): Promise<RestoreUndoRow[]> {
+  const rows = db.restoreUndo
+    .where('[table+id]')
+    .between([table, afterId ?? Dexie.minKey], [table, Dexie.maxKey], afterId === null, true)
+  return (Number.isFinite(limit) ? rows.limit(limit) : rows).toArray()
+}
+
+/**
+ * Undoes the last restore: puts back exactly what the app held just before it, in one transaction, and lets the
+ * snapshot go. Photos are copied back 20 at a time. Resolves false when there's no snapshot.
+ */
+export async function undoRestore(): Promise<boolean> {
+  const undone = await db.transaction('rw', [...dataTables(), db.restoreUndo, db.settings], async () => {
+    if ((await getSetting('restoreUndo')) === null || (await db.restoreUndo.count()) === 0) return false
+    await Promise.all(dataTables().map((table) => table.clear()))
+    await db.groups.bulkAdd((await keptRows('groups')).map(({ row }) => row as Group))
+    await db.meetupTypes.bulkAdd((await keptRows('meetupTypes')).map(({ row }) => row as MeetupType))
+    await db.friends.bulkAdd((await keptRows('friends')).map(({ row }) => row as Friend))
+    await db.meetups.bulkAdd((await keptRows('meetups')).map(({ row }) => row as Meetup))
+    let lastId: string | null = null
+    for (;;) {
+      const batch = await keptRows('meetupPhotos', lastId, PHOTO_BATCH)
+      if (batch.length === 0) break
+      await db.meetupPhotos.bulkAdd(batch.map(({ row }) => row as MeetupPhoto))
+      lastId = batch[batch.length - 1].id
+    }
+    await db.restoreUndo.clear()
+    await setSetting('restoreUndo', null)
+    return true
+  })
+  if (undone) forgetPhotoThumbs()
+  return undone
+}
+
+/** Whether a restore's snapshot is past its 7 days: Settings stops offering it even before it's deleted. */
+export function restoreUndoExpired(kept: RestoreUndoInfo, now: Date): boolean {
+  const taken = Date.parse(kept.takenAt)
+  return Number.isNaN(taken) || now.getTime() - taken >= RESTORE_UNDO_MS
+}
+
+/** Deletes a restore's snapshot once it's 7 days old (and any rows no setting names). Runs on every app start. */
+export async function forgetOldRestore(now: Date): Promise<void> {
+  await db.transaction('rw', db.restoreUndo, db.settings, async () => {
+    const kept = await getSetting('restoreUndo')
+    if (kept !== null && !restoreUndoExpired(kept, now)) return
+    if (kept === null && (await db.restoreUndo.count()) === 0) return
+    await db.restoreUndo.clear()
+    await setSetting('restoreUndo', null)
+  })
+}
+
 export async function parseBackupFile(file: Blob): Promise<ParseResult> {
   let raw: unknown
   try {
```

In `src/components/InsetGroup.tsx`:

```diff
--- a/src/components/InsetGroup.tsx
+++ b/src/components/InsetGroup.tsx
@@ -74,6 +74,8 @@ interface RowProps {
   disabled?: boolean
   /** The id of text that describes this button row (for a disabled one: why it is). */
   describedBy?: string
+  /** A button row's subtitle is read as its description, after its name (the title). */
+  subtitleDescribes?: boolean
   chevron?: boolean
   accent?: boolean
   destructive?: boolean
@@ -92,11 +94,15 @@ export function Row({
   switchOn,
   disabled,
   describedBy,
+  subtitleDescribes,
   chevron,
   accent,
   destructive,
   ref,
 }: RowProps) {
+  const titleId = useId()
+  const subtitleId = useId()
+  const describing = subtitleDescribes === true && subtitle !== undefined
   const className = [
     'row',
     (to || onClick) && 'row--interactive',
@@ -110,8 +116,14 @@ export function Row({
     <>
       {leading && <span className="row__leading">{leading}</span>}
       <span className="row__main">
-        <span className="row__title">{title}</span>
-        {subtitle && <span className="row__subtitle">{subtitle}</span>}
+        <span className="row__title" id={describing ? titleId : undefined}>
+          {title}
+        </span>
+        {subtitle && (
+          <span className="row__subtitle" id={describing ? subtitleId : undefined}>
+            {subtitle}
+          </span>
+        )}
       </span>
       {trailing !== undefined && <span className="row__trailing">{trailing}</span>}
       {switchOn !== undefined && <span className="switch" data-on={switchOn} aria-hidden="true" />}
@@ -137,7 +149,8 @@ export function Row({
         className={className}
         onClick={onClick}
         disabled={disabled}
-        aria-describedby={describedBy}
+        aria-labelledby={describing ? titleId : undefined}
+        aria-describedby={describing ? subtitleId : describedBy}
         role={switchOn === undefined ? undefined : 'switch'}
         aria-checked={switchOn}
       >
```

In `src/db/db.ts`:

```diff
--- a/src/db/db.ts
+++ b/src/db/db.ts
@@ -1,4 +1,4 @@
-import Dexie, { type EntityTable } from 'dexie'
+import Dexie, { type EntityTable, type Table } from 'dexie'
 import { isMood } from '../lib/moods'
 import { cleanWeather } from '../lib/weather'
 import type { Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'
@@ -9,6 +9,16 @@ export interface SettingRow {
   value: unknown
 }
 
+/** The tables a backup holds, and a restore replaces. */
+export type DataTable = 'friends' | 'groups' | 'meetupTypes' | 'meetups' | 'meetupPhotos'
+
+/** One row of what the app held just before a backup was restored, so the restore can be undone. */
+export interface RestoreUndoRow {
+  table: DataTable
+  id: string
+  row: unknown
+}
+
 export type FriendTrackerDB = Dexie & {
   friends: EntityTable<Friend, 'id'>
   groups: EntityTable<Group, 'id'>
@@ -16,6 +26,7 @@ export type FriendTrackerDB = Dexie & {
   meetups: EntityTable<Meetup, 'id'>
   meetupPhotos: EntityTable<MeetupPhoto, 'id'>
   settings: EntityTable<SettingRow, 'key'>
+  restoreUndo: Table<RestoreUndoRow, [DataTable, string]>
 }
 
 export const db = new Dexie('friend-tracker') as FriendTrackerDB
@@ -61,6 +72,20 @@ db.version(3).stores({
   meetupPhotos: 'id, meetupId, [meetupId+order]',
 })
 
+// Version 4 adds restoreUndo: what the app held just before a backup was restored, kept 7 days so the restore can
+// be undone (src/backup/storage.ts). Rows are { table, id, row }, keyed by [table+id]. Never read by backups or lists.
+// No other store changes, so there is no upgrade step. Older code that is still running (the service worker until it
+// updates, a second tab) opens this version too: Dexie 4 opens a database newer than it declares (tested).
+db.version(4).stores({
+  friends: 'id, groupId',
+  groups: 'id',
+  meetupTypes: 'id, order',
+  meetups: 'id, date, typeId, *friendIds',
+  settings: 'key',
+  meetupPhotos: 'id, meetupId, [meetupId+order]',
+  restoreUndo: '[table+id]',
+})
+
 // The version 2 upgrade runs once, but older code that is still running (a second tab, or a
 // rollback) can write friends without lists later. Fill them in on every read.
 // Birthdays came without a version bump (no index changed), so friends saved before them
```

In `src/db/settings.ts`:

```diff
--- a/src/db/settings.ts
+++ b/src/db/settings.ts
@@ -2,6 +2,14 @@ import { LOCK_OFF, NO_FAILURES, type AppLock, type LockFailures } from '../lock/
 import { REMINDERS_OFF, type BirthdayReminders } from '../reminders/types'
 import { db } from './db'
 
+/** What the last restore kept so it can be undone: when, and what the app held then (src/backup/storage.ts). */
+export interface RestoreUndoInfo {
+  takenAt: string
+  friends: number
+  meetups: number
+  photos: number
+}
+
 export interface Settings {
   lastBackupAt: string | null
   /** When Settings was last opened while its tab showed the backup dot (src/backup/nudge.ts). */
@@ -10,6 +18,8 @@ export interface Settings {
   appLock: AppLock
   appLockFailures: LockFailures
   birthdayReminders: BirthdayReminders
+  /** The snapshot a restore kept, while restoreUndo holds one. */
+  restoreUndo: RestoreUndoInfo | null
 }
 
 export const DEFAULT_SETTINGS: Settings = {
@@ -19,6 +29,7 @@ export const DEFAULT_SETTINGS: Settings = {
   appLock: LOCK_OFF,
   appLockFailures: NO_FAILURES,
   birthdayReminders: REMINDERS_OFF,
+  restoreUndo: null,
 }
 
 export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
```

In `src/screens/SettingsScreen.tsx`:

```diff
--- a/src/screens/SettingsScreen.tsx
+++ b/src/screens/SettingsScreen.tsx
@@ -1,15 +1,15 @@
 import { useEffect, useRef, useState, type ChangeEvent } from 'react'
 import { exportBackup, shareBackupFile } from '../backup/exportBackup'
-import { describeImport } from '../backup/importSummary'
+import { describeImport, describeRestoreKept, describeUndoRestore } from '../backup/importSummary'
 import { meetupsSinceBackup } from '../backup/nudge'
-import { parseBackupFile, readAllData, replaceAllData } from '../backup/storage'
+import { parseBackupFile, readAllData, restoreBackup, restoreUndoExpired, undoRestore } from '../backup/storage'
 import { useBackupDot } from '../backup/useBackupDot'
 import { useConfirm } from '../components/ActionSheet'
 import { InsetGroup, Row } from '../components/InsetGroup'
 import { Page } from '../components/Page'
 import { useToast } from '../components/Toast'
 import { useFriends, useGroups, useMeetups, useMeetupTypes, usePhotoCount, useSetting } from '../data/hooks'
-import { setSetting } from '../db/settings'
+import { setSetting, type RestoreUndoInfo } from '../db/settings'
 import { useToday } from '../hooks/useToday'
 import { describeBackup } from '../lib/text'
 import { AppLockSection } from '../lock/AppLockSection'
@@ -17,6 +17,8 @@ import { usePasskeyAvailable } from '../lock/usePasskeyAvailable'
 import { RemindersSection } from '../reminders/RemindersSection'
 import './SettingsScreen.css'
 
+const UNDO_FAILED = "Couldn't undo. Please try again."
+
 export function SettingsScreen() {
   const friends = useFriends()
   const groups = useGroups()
@@ -27,6 +29,7 @@ export function SettingsScreen() {
   const lastBackupAt = useSetting('lastBackupAt')
   const appLock = useSetting('appLock')
   const birthdayReminders = useSetting('birthdayReminders')
+  const restoreUndo = useSetting('restoreUndo')
   const passkeyAvailable = usePasskeyAvailable()
   const today = useToday()
   const toast = useToast()
@@ -44,7 +47,28 @@ export function SettingsScreen() {
 
   if (!friends || !groups || !meetupTypes || !meetups || lastBackupAt === undefined) return null
   if (appLock === undefined || passkeyAvailable === undefined || birthdayReminders === undefined) return null
-  if (photoCount === undefined) return null
+  if (photoCount === undefined || restoreUndo === undefined) return null
+  // Offered for 7 days after a restore, even before the snapshot is deleted at the next start.
+  const undoable = restoreUndo !== null && !restoreUndoExpired(restoreUndo, new Date()) ? restoreUndo : null
+
+  /** Undo for a restore: from the toast, or from "Undo restore" here. A failed one keeps the snapshot to try again. */
+  const undoTheRestore = async () => {
+    try {
+      if (await undoRestore()) toast({ message: 'Restore undone' })
+    } catch {
+      toast({ message: UNDO_FAILED, tone: 'plain' })
+    }
+  }
+
+  const confirmUndoRestore = async (kept: RestoreUndoInfo) => {
+    const confirmed = await confirm({
+      title: 'Undo the restore?',
+      message: describeUndoRestore(kept, { friends: friends.length, meetups: meetups.length, photos: photoCount }, today),
+      confirmLabel: 'Undo restore',
+      destructive: true,
+    })
+    if (confirmed) await undoTheRestore()
+  }
 
   // Shares a backup made earlier, from the fresh tap on the toast's Share action.
   const shareReadyBackup = async (file: File) => {
@@ -113,8 +137,12 @@ export function SettingsScreen() {
     })
     if (!confirmed) return
     try {
-      await replaceAllData(data)
-      toast({ message: 'Backup restored' })
+      const { undoable: canUndo } = await restoreBackup(data, new Date())
+      toast(
+        canUndo
+          ? { message: 'Backup restored', actionLabel: 'Undo', onAction: () => void undoTheRestore() }
+          : { message: 'Backup restored' },
+      )
     } catch {
       toast({ message: "Couldn't restore the backup. Nothing was changed.", tone: 'plain' })
     }
@@ -135,6 +163,15 @@ export function SettingsScreen() {
       >
         <Row title="Export backup" accent onClick={exportData} />
         <Row title="Import backup" accent onClick={() => fileInput.current?.click()} />
+        {undoable && (
+          <Row
+            title="Undo restore"
+            subtitle={describeRestoreKept(undoable, today)}
+            subtitleDescribes
+            accent
+            onClick={() => void confirmUndoRestore(undoable)}
+          />
+        )}
       </InsetGroup>
       <input
         ref={fileInput}
```

- [ ] **Step 4: Run everything**

Run: `npx tsc -b` (no files written), then `npm test`
Expected: `Test Files  64 passed (64)` and `Tests  794 passed (794)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `220 passed`.

The first full run had 1 failure: the owner's example in `day.spec.ts` read the day page's back button while the Log sheet was still sliding away with its own Meal chip (the Logged note shows sooner than the toast did). The test now waits for the sheet, in this task's `day.spec.ts` change; `day.spec.ts` alone: 28 passed.

- [ ] **Step 5: Commit**

```bash
git add e2e/day.spec.ts e2e/settings.spec.ts src/App.tsx src/backup/RestoreUndoCleanup.ts src/backup/importSummary.test.ts src/backup/importSummary.ts src/backup/storage.test.ts src/backup/storage.ts src/components/InsetGroup.tsx src/db/db.test.ts src/db/db.ts src/db/settings.ts src/screens/SettingsScreen.tsx src/sw/push.test.ts
git commit -F - <<'EOF'
feat: a restore can be undone for 7 days, kept in Dexie version 4

Restoring a backup first copies everything it replaces (friends, groups,
meetup types, meetups and their photos) into a new restoreUndo store, in
the restore's own transaction, so both happen or neither. Photos are copied
20 at a time, there and back, so a restore holds at most 20 more full images
than before. Into an app with no friends and no meetups nothing is kept.
"Backup restored" now has an Undo, and Settings offers "Undo restore" (with
a confirm comparing before and now) for 7 days; every app start deletes an
older snapshot. The import confirm says the restore can be undone.

Dexie version 4 adds only the restoreUndo store, so there is no upgrade
step. A version 3 reader, like a service worker still on the old code,
still opens the version 4 database and reads its friends (tested in
db.test.ts and push.test.ts). The owner's example e2e now waits for the
Log sheet to slide away before reading the day page's back button.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 8: Screenshots, DESIGN.md and the decisions in the spec

**Files:**
- Modify: `DESIGN.md`, `docs/superpowers/specs/2026-10-21-friends-first-design.md`
- Test: `e2e/screenshots.spec.ts`

- [ ] **Step 1: Make the changes**

New screenshots 25 to 30 in light, dark and large text (the next free numbers), DESIGN.md for every changed component, and the decisions made while building at the end of the spec.

In `DESIGN.md`:

```diff
--- a/DESIGN.md
+++ b/DESIGN.md
@@ -194,6 +194,22 @@ components:
     backgroundColor: "{colors.peach-wash}"
     rounded: "0.35em"
     padding: "0.1em 0"
+  birthday-tile:
+    backgroundColor: "{colors.paper-white}"
+    textColor: "{colors.warm-ink}"
+    typography: "{typography.subhead}"
+    rounded: "{rounded.group}"
+    padding: "0.5rem 0.875rem 0.5rem 0.5rem"
+  logged-note:
+    backgroundColor: "{colors.paper-white}"
+    textColor: "{colors.warm-ink}"
+    typography: "{typography.subhead}"
+    rounded: "{rounded.group}"
+    padding: "0.25rem 0.25rem 0.25rem 1rem"
+  tab-bar-dot:
+    backgroundColor: "{colors.terracotta-ink}"
+    rounded: "50%"
+    size: "8px"
 ---
 
 # Design System: Friend Tracker
@@ -222,8 +238,8 @@ Motion is responsive, not choreographed: 160ms for taps and color changes (`--du
 Warm, paper-toned neutrals tinted toward peach, with a single soft peach accent in two strengths: a fill for things you press and a deeper terracotta for peach-colored text.
 
 ### Primary
-- **Peach** (`--accent`, light `oklch(81% 0.095 50)`, dark `oklch(80% 0.1 50)`): the fill for primary buttons, the "+ Log meetup" pill, selected chips, the selected-friend ring and check, the picked mood's ring and check, the camera badge on the friend photo, and the toast's check mark. Text on it is always **On-Peach** (`--on-accent`, `oklch(29% 0.06 40)` / `oklch(26% 0.05 40)`), 7.8:1 in light and 8.2:1 in dark. Pressed: **Peach Pressed** (`--accent-pressed`).
-- **Terracotta Ink** (`--accent-ink`, light `oklch(53% 0.15 38)`, dark `oklch(81% 0.1 52)`): peach-family text and icons. Nav bar actions (Edit, Cancel, back), header icon buttons, the active tab, accent rows such as "Export backup", and the 2px focus ring. 5.1:1 on paper in light, 10.1:1 in dark.
+- **Peach** (`--accent`, light `oklch(81% 0.095 50)`, dark `oklch(80% 0.1 50)`): the fill for primary buttons, the "+ Log meetup" pill, selected chips, the selected-friend ring and check, the picked mood's ring and check, the camera badge on the friend photo, and the check mark of the toast and the day page's Logged note. Text on it is always **On-Peach** (`--on-accent`, `oklch(29% 0.06 40)` / `oklch(26% 0.05 40)`), 7.8:1 in light and 8.2:1 in dark. Pressed: **Peach Pressed** (`--accent-pressed`).
+- **Terracotta Ink** (`--accent-ink`, light `oklch(53% 0.15 38)`, dark `oklch(81% 0.1 52)`): peach-family text and icons. Nav bar actions (Edit, Cancel, back), header icon buttons, the active tab, accent rows such as "Export backup", a group title's "See all", the Settings tab's backup dot, and the 2px focus ring. 5.1:1 on paper in light, 10.1:1 in dark.
 - **Peach Wash** (`--accent-soft`, light `oklch(94.5% 0.03 55)`, dark `oklch(31% 0.04 50)`): a quiet tint for the install hint card, the "Upcoming" badge, and the back circle of the empty-state art.
 
 ### Secondary: chart pair
@@ -232,7 +248,7 @@ Warm, paper-toned neutrals tinted toward peach, with a single soft peach accent
 
 ### Neutral
 - **Warm Paper** (`--bg`, light `oklch(96.4% 0.009 60)`, dark `oklch(18.5% 0.008 55)`): the page and sheet background. The PWA `theme-color` matches it (#F8F2ED light, #16120F dark).
-- **Paper White** (`--surface`, light `oklch(99.4% 0.004 60)`, dark `oklch(23.5% 0.009 55)`): inset groups, the tab bar, text fields inside sheets, the stat row, chart containers, the "Last seen" pill, action sheet groups, the day view and How it felt boxes on the Meetup page, and the day page's text boxes and Place field.
+- **Paper White** (`--surface`, light `oklch(99.4% 0.004 60)`, dark `oklch(23.5% 0.009 55)`): inset groups, the tab bar, text fields inside sheets, the stat row, chart containers, the "Last seen" pill, action sheet groups, the day view and How it felt boxes on the Meetup page, the day page's text boxes and Place field, Birthdays soon tiles and the day page's Logged note.
 - **Linen** (`--surface-2`, light `oklch(93.6% 0.011 60)`, dark `oklch(29% 0.011 55)`): unselected chips, search fields, secondary buttons, emoji badges, icon-button press, mood faces, helper chips and paid tags. **Linen Pressed** (`--surface-pressed`) is the row and action-sheet press state.
 - **Soft Rule** (`--separator`, light `oklch(89.5% 0.009 60)`, dark `oklch(32% 0.01 55)`): 0.5px hairlines between rows, the sheet grabber, the tab bar's top edge, and the compact nav bar's bottom edge.
 - **Warm Ink** (`--ink`, light `oklch(25% 0.014 50)`, dark `oklch(95% 0.008 70)`): primary text, 14.4:1 on paper.
@@ -252,7 +268,7 @@ Six soft pastel pairs (`.tint-0` to `.tint-5`, hues 50, 85, 145, 215, 285, 350),
 
 **The Two Peaches Rule.** Peach is a fill; Terracotta Ink is a text color. Never set text in Peach on paper (1.7:1) and never put Terracotta Ink text on a Peach fill. Text on a Peach fill is On-Peach.
 
-**The No Alarm Rule.** No red, orange, or warning colors for "haven't seen in a while". Time since is plain Warm Ink Secondary text. Danger Red is reserved for destructive actions only.
+**The No Alarm Rule.** No red, orange, or warning colors for "haven't seen in a while". Time since is plain Warm Ink Secondary text. Danger Red is reserved for destructive actions only. A suggestion to back up is a small Terracotta Ink dot and plain facts in Settings, never red and never a count of days.
 
 **The One Dark Room Rule.** Only the photo viewer sits on the near-black Viewer Ground, in both themes, so photos look true and nothing competes with them. Everything else, dark mode included, stays on warm paper.
 
@@ -318,7 +334,7 @@ The meetup sheets' **Who** shows every friend as a tile (a 52px avatar over a Fo
 - **More than 8:** a strip two rows high that swipes sideways, filled a column at a time, so the first 8 show first. It bleeds to the sheet's edges with its first column on the 16px margin, like the meetup type chips, and its columns are a little narrower than a quarter of the width (`(100% - 3 gaps) / 4.4`), so the fifth peeks in to say there's more. Each column snaps to the margin (`scroll-snap-type: x mandatory`), overscroll stays in the strip, and there's no visible scrollbar. A tile that takes keyboard focus scrolls into view. "Search all friends" sits below it.
 
 ### Inset groups and rows
-- **Container:** Paper White, 14px corners, no shadow, no border. A Footnote section label sits above (inset 16px from the group edge, aligned with row text) and an optional footer below.
+- **Container:** Paper White, 14px corners, no shadow, no border. A Footnote section label sits above (inset 16px from the group edge, aligned with row text) and an optional footer below. A group title can end with one text link ("See all"), Footnote 600 Terracotta Ink, with a 44px hit area that reaches into the space above the group, never over its first row; at large text sizes it wraps under the title.
 - **Row:** at least 52px tall, `0.5rem 1rem` padding, `0.75rem` gap. Leading slot is 44px wide (avatar or emoji badge); main text is a Body title with a Subhead Warm Ink Secondary subtitle, both wrapping; trailing values in Warm Ink Secondary; an 18px Warm Ink Tertiary chevron for navigation.
 - **Separators:** 0.5px Soft Rule hairlines, inset to the text edge (past the 44px leading slot when rows have one), never full-bleed.
 - **Press:** Linen Pressed background over 160ms. Accent rows use Terracotta Ink titles; destructive rows use Danger Red.
@@ -326,7 +342,7 @@ The meetup sheets' **Who** shows every friend as a tile (a 52px avatar over a Fo
 
 ### Inputs and fields
 - **Field:** Paper White on Warm Paper (inside sheets), 12px corners, 44px minimum height, `0.6rem 0.9rem` padding, no border. Labels are Footnote 600 Warm Ink Secondary above the field. Placeholders are Warm Ink Tertiary.
-- **Search:** Linen, 12px corners, 44px tall, an 18px magnifier in Warm Ink Tertiary. Focus draws the 2px Terracotta Ink outline around the whole field. Friends and Meetups each have one, above their list.
+- **Search:** Linen, 12px corners, 44px tall, an 18px magnifier in Warm Ink Tertiary. Focus draws the 2px Terracotta Ink outline around the whole field. On Friends it sits just under the large title, with the group chips under it; Meetups has one above its list.
 - **Error:** Footnote Danger Red text under the field, announced with `role="alert"`.
 - **Hint (`.field-hint`):** a neutral note under a field for things that aren't errors, such as "Already in Likes.". Footnote Warm Ink Secondary, announced with `role="alert"`, never red. The same look without the alert describes a field (`aria-describedby`), such as "Lines that start with @ show as places." under the sheets' The day box.
 - **Place tint (The day boxes):** while you type, every line the grammar reads as a place (`isPlaceLine`: "@ some place", "@Blue willow 3:30"; never "@" alone, "@ 3:30" or an "@" mid-sentence) gets a Peach Wash rounded background behind its words (0.35em corners, 0.1em above and below; spaces around the line stay untinted), with the text itself unchanged. It reaches 0.2em past the words with a Peach Wash shadow on each side, so it takes no width and a long place line wraps exactly as in the box; each line of a wrapped place line is tinted. The box's own copy of its text, which sizes it, paints the tints from behind with transparent glyphs; the box is transparent over its Paper White cell, so the tints show through under its text. On iOS the copy wraps with the textarea's own rules (`line-break: after-white-space`, `-webkit-nbsp-mode: space`); with forced colors it's hidden, tints and all, so the words never show twice. It's only a look: the copy is `aria-hidden`, and a place line also reads as a place on the Meetup page. In the meetup sheets and on the day page.
@@ -345,10 +361,10 @@ The day, Activities and Photos follow **When**, in that order, in the Log and Ed
 - **"Save and write about the day":** Log meetup only, the last thing in the body: a full-width Secondary block button, dimmed whenever Save is. It saves, then opens the day page for weather, mood and How it felt.
 
 ### The day page
-A pushed, full-screen layer at `/meetups/:id/day` that fills the screen above the keyboard (bottom at `--keyboard-inset`, height `--viewport-height`), with no tab bar. Nav bar: back (the meetup type), the title "The day". Body: the context line, Weather chips, The day box with its hint and the place tint, How it felt (mood tiles and a box, only for today or earlier), and "Saves as you type, and stays on this iPhone.". Boxes are Paper White, grow with their text and never scroll inside themselves. It saves as you type; a failed save shows a Footnote Danger Red line above the helper bar.
+A pushed, full-screen layer at `/meetups/:id/day` that fills the screen above the keyboard (bottom at `--keyboard-inset`, height `--viewport-height`), with no tab bar. Nav bar: back (the meetup type), the title "The day". Body: the context line, Weather chips, The day box with its hint and the place tint, How it felt (mood tiles and a box, only for today or earlier), and "Saves as you type, and stays on this iPhone.". Boxes are Paper White, grow with their text and never scroll inside themselves. It saves as you type; a failed save shows a Footnote Danger Red line above the helper bar. Opened by "Save and write about the day", the body starts with the **Logged note**: a Paper White box (14px corners, at least 44px tall) with the toast's check, "Logged with Mariya and Jessie" in Subhead 600 and an "Undo" text button that lasts until the first change on the page (typing, a weather chip, a face or a helper; after the app lock it stays gone). Its room stays when Undo goes, so nothing moves; VoiceOver hears the note once. When the keyboard comes up for The day, the box's top goes 12px under the nav bar, unless that would hide the caret's line. The page never shows a toast.
 
 ### Helper bar
-The day page's footer, riding on the keyboard: a row of chips ("@ Place", "Now" for today's meetups, "Paid") with a 44px "Hide keyboard" button pinned at the end while the keyboard is up. "@ Place" swaps the row for a one-line Place field (autocorrect off) with Now and Add (dimmed until there's text); "Paid" swaps it for a "Who paid?" label over chips that wrap (Me, each friend, Split). Both pin a 44px Close just before "Hide keyboard", outside the part that scrolls. Helpers never take focus from the box you're typing in, and every control's name starts with the word it shows.
+The day page's footer, riding on the keyboard: a row of chips ("@ Place", "Now" for today's meetups, "Paid") with a 44px "Hide keyboard" button pinned at the end while the keyboard is up. "@ Place" swaps the row for the Place field across the whole bar (autocorrect off), with Now, Add (dimmed until there's text), Close and Hide keyboard on a line under it, so a place and its time show whole; "Paid" swaps it for a "Who paid?" label over chips that wrap (Me, each friend, Split). Both grow upward and pin a 44px Close just before "Hide keyboard", outside the part that scrolls. Helpers never take focus from the box you're typing in, and every control's name starts with the word it shows.
 
 ### Mood tiles
 Four tiles, low to high: 😔 Heavy, 🙂 Okay, 😊 Good, 😄 Great. Each is a 44px Linen circle with a 26px emoji over a Footnote Warm Ink word, four across, or two by two once a quarter of the row is narrower than 3.25rem. Nothing is picked at first. The picked tile gets the selected-friend ring and check and a 600 word; tapping it again clears it. Press is Linen Pressed, with no scale.
@@ -357,14 +373,14 @@ Four tiles, low to high: 😔 Heavy, 🙂 Okay, 😊 Good, 😄 Great. Each is a
 Eight chips in a scrolling row, ☀️ Sunny, ⛅ Cloudy, 🌧️ Rainy, ⛈️ Stormy, ❄️ Snowy, 🌬️ Windy, 🌡️ Hot, 🧣 Cold. Never a face emoji. Any number can be picked.
 
 ### Action sheets and confirms
-iOS-style stacks pinned to the bottom with 8px margins: a Paper White group (14px corners) with an optional centered Footnote 600 title and message, 56px buttons in Terracotta Ink at 1.1rem divided by hairlines, then a separate Cancel group in 600. Destructive buttons use Danger Red. The sort chooser is a `dialog`; destructive confirms are an `alertdialog`.
+iOS-style stacks pinned to the bottom with 8px margins: a Paper White group (14px corners) with an optional centered Footnote 600 title and message, 56px buttons in Terracotta Ink at 1.1rem divided by hairlines, then a separate Cancel group in 600. Destructive buttons use Danger Red. The sort chooser is a `dialog`; destructive confirms are an `alertdialog`. A message may run to several short lines, one fact each (the import confirm, "Undo the restore?").
 
 ### Toast
-The one happy moment. An inverted pill (Warm Ink background, Warm Paper text, Float shadow), 52px tall on one line, above the Log pill. Its 26px corners keep it a pill on one line and make it a soft box when a long message wraps; the end of a page then makes room for its real height. It layers above sheets but below action sheets, so an open action sheet's scrim covers it. A 24px Peach circle draws its check mark in over 420ms; an optional "Undo" pill sits at the end. It stays 5 seconds, 8 with an action, and pauses while touched or focused. When it goes, the room it took stays until the next page, so the end of a page never jumps. On the day page it sits 8px above the helper bar.
+The one happy moment. An inverted pill (Warm Ink background, Warm Paper text, Float shadow), 52px tall on one line, above the Log pill. Its 26px corners keep it a pill on one line and make it a soft box when a long message wraps; the end of a page then makes room for its real height. It layers above sheets but below action sheets, so an open action sheet's scrim covers it. A 24px Peach circle draws its check mark in over 420ms; an optional "Undo" pill sits at the end. It stays 5 seconds, 8 with an action, and pauses while touched or focused. When it goes, the room it took stays until the next page, so the end of a page never jumps. It belongs to the page it was shown on: opening another page clears it, and going back keeps it (so "Meetup deleted" and its Undo show on the page you land on). The day page never shows one, and no toast covers a field being typed in. A batch of photos added on the Meetup page ends with "Added 3 photos" and Undo; a restored backup with "Backup restored" and Undo, then "Restore undone".
 
 ### Navigation
 - **Nav bar:** sticky, 44px plus the safe area, solid Warm Paper. Back and actions in Terracotta Ink. When the large title scrolls away, a centered Body 600 title fades in and a 0.5px Soft Rule appears underneath.
-- **Tab bar:** fixed, Paper White, 50px plus the safe area, hairline on top. Three tabs (Friends, Stats, Settings) with 26px line icons over Caption labels: Warm Ink Tertiary at rest, Terracotta Ink with a heavier stroke and 600 label when current. A friend's page, a Meetup page and the Meetups page belong to Friends, unless they were opened from Stats, which then stays current. The tab bar is hidden on the day page.
+- **Tab bar:** fixed, Paper White, 50px plus the safe area, hairline on top. Three tabs (Friends, Stats, Settings) with 26px line icons over Caption labels: Warm Ink Tertiary at rest, Terracotta Ink with a heavier stroke and 600 label when current. A friend's page, a Meetup page and the Meetups page belong to Friends, unless they were opened from Stats, which then stays current. The tab bar is hidden on the day page. While a backup is suggested (meetups logged since a backup 30 or more days old, at most once every 30 days), an 8px Terracotta Ink dot, ringed in Paper White, sits at the top right of the Settings icon, and the tab is named "Settings, backup suggested". Never red, never a number, no motion; opening Settings sees it.
 
 ### Avatars
 Circles. Initials in the rounded face (600, 40% of the size) on a per-friend pastel tint, or a cropped photo. Sizes: 44px in rows, 52px in the friend tiles, 96px in the detail hero, 24 to 28px inside chips.
@@ -379,9 +395,9 @@ Reads as one calm column, not a grid of cards: centered 96px avatar, Title name,
 One row for a meetup, the same everywhere (a friend's History, Recent meetups, the Meetups page): the type's emoji badge, the type as the title (with "Upcoming" for a future date, except under the Meetups page's "Upcoming" title, which already says it), a subtitle of the date, "with" the friends, the activities, and the day's first places ("and 5 more") or its first line cut at 80 characters, then the first photo as a 40px thumbnail with 8px corners, before the chevron (its Linen box shows from the start, so a row never shifts when the photo arrives). On a friend's page "with" leaves that friend out; everywhere else it names everyone. In Recent meetups the subtitle stops at two lines; elsewhere it wraps in full. Moods, weather and How it felt never show. Tapping it opens the Meetup page.
 
 ### Meetup page
-The memory view of one meetup, pushed like a friend's page. Nav bar: back ("Back", the friend's name from their history, "Friends" from Recent meetups, or "Meetups" from the Meetups page) and **Edit**, which opens the Edit meetup sheet.
+The memory view of one meetup, pushed like a friend's page. Nav bar: back ("Back", the friend's name from their history, "Friends" from Recent meetups, or "Meetups" from the Meetups page) and **Edit**, which opens the Edit meetup sheet (dimmed to 45% while photos are being added).
 - **Hero:** centered: the type's emoji in a 96px Linen circle (a 48px emoji), the type name in Title, the date in Warm Ink Secondary, then the weather after a middle dot ("Sat, Oct 3 · 🌧️ Rainy", the emoji hidden from VoiceOver), with the "Upcoming" badge for a future date, then a Footnote "With" label over the friends as person chips (a 28px avatar and the name in a Paper White pill) that open the friend.
-- **Then, each hidden when empty:** **Activities** as read-only chips (the chip look without a press state), **The day** (the day view, below), **How it felt** (the face in a 44px Linen circle and its word in Body 600, then the words, in a Paper White box with 14px corners; never for an upcoming meetup), the day row ("Write about the day" as an accent row with the subtitle "Places, what happened, how it felt", or "Edit the day", with a 📝 emoji badge; always there), and **Photos** in the 3-across grid; a thumbnail opens the photo viewer.
+- **Then, in this order:** **Activities** as read-only chips (the chip look without a press state; hidden when empty), **Photos** (always shown: the 3-across grid ending with the Add photos tile, which saves each photo as soon as it's ready, with "Adding 2 of 5…" on the tile while it works; a thumbnail opens the photo viewer; removing and reordering are in the Edit sheet), **The day** (the day view, below; hidden when empty), **How it felt** (the face in a 44px Linen circle and its word in Body 600, then the words, in a Paper White box with 14px corners; never for an upcoming meetup; hidden when empty), then the day row ("Write about the day" as an accent row with the subtitle "Places, what happened, how it felt", or "Edit the day", with a 📝 emoji badge; always there).
 - When the meetup is deleted from the sheet, the page goes back.
 
 ### Day view
@@ -391,10 +407,10 @@ The day's text read back: Paper White, 14px corners. Places form an ordered list
 Full screen over everything, on the Viewer Ground with Viewer Ink controls: a Close button top left; the photo fit between the bars, letterboxed, with no zoom; and Previous, "2 of 5" (rounded, tabular) and Next along the bottom, all 44px. A sideways swipe or the arrow keys change photos: the next one slides 32px and fades in over 220ms (with Reduce Motion it only fades). Previous and Next dim to 35% at the ends. Escape closes it. It is a modal dialog named "Photo 2 of 5", the image's alt names the photo, the type and the date ("Photo 2 of 5, Coffee, Sat, Sep 12"), focus stays inside, and closing puts focus back on the photo's thumbnail.
 
 ### Birthdays soon
-An inset group titled "Birthdays soon" at the top of the Friends tab, above Recent meetups and the search field, listing friends whose birthday is today or in the next 14 days, soonest first. Each row is a link with the 44px avatar, the name and the countdown ("Today · turns 31", "Tomorrow", "In 5 days"), like the friend rows below it. At most 3 rows; the footer counts the rest ("And 3 more in the next two weeks."). The group is hidden when no birthday is that close, while searching, and while a group filter is on, so the list below stays a plain filtered list. Searching or picking a group hides it (and Recent meetups) without moving the search field: the page scrolls by what went away.
+A row of tiles on the Friends tab, after the search field and chips: every friend whose birthday is today or in the next 14 days, soonest first, in one strip that scrolls sideways and bleeds to the screen edges. A tile is a Paper White link with 14px corners: the 44px avatar, then the short name (the first name, or the full name when another friend shares it) in Subhead 600 over the countdown ("Today", "Tomorrow", "In 5 days") in Footnote Warm Ink Secondary. It's named in full for VoiceOver ("Brandon Cao, In 2 days · turns 27"). Hidden when no birthday is that close, while searching, and while a group filter is on. Tiles are 60px tall, press to Linen Pressed, and snap to the 16px margin; with three birthdays the third peeks in, which says there's more.
 
 ### Recent meetups
-An inset group titled "Recent meetups" on the Friends tab, after Birthdays soon and before the search field: the 3 latest meetups dated today or earlier (the 2 latest while Birthdays soon shows), newest first, as Meetup rows naming everyone, each subtitle stopped at two lines, then "See all meetups", an accent row with a chevron and no badge, which opens the Meetups page. Hidden when no meetup has happened yet, while searching, and while a group filter is on; searching or picking a group hides it without moving the search field.
+An inset group titled "Recent meetups" on the Friends tab, after Birthdays soon: the latest meetup dated today or earlier as a Meetup row naming everyone, its subtitle stopped at two lines, with "See all" at the end of the title's line, which opens the Meetups page (named "See all meetups"). Hidden when no meetup has happened yet, while searching, and while a group filter is on. Nothing above the search field hides, so searching or picking a group never moves it.
 
 ### Meetups page
 Every meetup, pushed from Recent meetups: back "Friends", the large title "Meetups", a search field ("Search meetups"), then "Upcoming" (soonest first, its rows without the "Upcoming" badge) and one group per month, newest first ("October 2026"), as Meetup rows naming everyone. The search looks in friend names, the type, activities, the day and, for meetups that have happened, How it felt's words, ignoring case and accents, and every word typed must be found; never weather, moods or dates. It shows 60 rows, then "Show older meetups" adds 60. Going back to it keeps the search, the rows shown and the scroll; the app lock starts it fresh. Empty: "No meetups yet." with "Your first meetup will show up here."; no match: "No meetups match “zebra”." The "+ Log meetup" pill shows whenever there's a friend.
@@ -403,6 +419,9 @@ Every meetup, pushed from Recent meetups: back "Friends", the large title "Meetu
 The "Reminders" inset group in Settings, right after Organize: a "Birthday reminders" switch row and, while it's on, a "Send a test notification" accent row. The footer says in plain words what the switch does, that it's on, or why it can't be used: "A notification at 11:55 PM the night before each birthday.", "On. You'll get a note at 11:55 PM the night before each birthday." (plus "Couldn't update reminders just now. The app will try again next time it opens." after a failed update), "Open Friend Tracker from your Home Screen to turn on reminders.", "Notifications are off for Friend Tracker. Turn them on in the iPhone's Settings app, under Notifications → Friends.", or "Reminders stopped. Turn them on again.". Toasts: "Birthday reminders are on" and "Test notification sent" with the check; "Birthday reminders are off", "Couldn't turn on reminders. Please try again.", "Birthday reminders aren't set up yet.", "Couldn't turn off reminders. Please try again." and "Couldn't send a test notification. Please try again." plain, and the denied footer's words as a plain toast when notifications are refused.
 - **The notification** is drawn by iOS: "🎂 Alex's birthday starts in 5 minutes" over "Send them a message.", one per night, naming everyone whose birthday it is ("🎂 Alex and Sam: birthdays at midnight"). Tapping it opens that friend, or the Friends tab for several. When the app can't tell who, it says "🎂 A birthday is coming up" and "Open Friend Tracker to see who.".
 
+### Backup group
+The "Backup" inset group in Settings: "Export backup" and "Import backup" accent rows, and for 7 days after a restore an "Undo restore" accent row whose subtitle ("Puts back the data from before Wed, Oct 21. Kept until Wed, Oct 28.") is read as its description. The footer is facts only: "Last backup: 6 weeks ago. 12 meetups since then. Includes 9 photos.", or "Never backed up.". The import confirm compares the backup with the app, a line each: "Backup from Wed, Sep 2: 15 friends, 30 meetups, 6 photos.", "In the app now: …", what in the app isn't in the backup, and "Everything in the app now will be replaced. You can undo this in Settings for 7 days." "Undo restore" asks first ("Undo the restore?", with what the app held before and holds now).
+
 ### Stat row
 One Paper White group (not three cards) with three centered items: a 1.6rem rounded numeral over a Footnote Warm Ink Secondary label. Wraps to one item per line only at accessibility text sizes.
 
@@ -439,7 +458,7 @@ Shown instead of the app, never over it, when the app lock is on and the app has
 - **Do** make every tap target at least 44×44pt; extend small visuals (36px chips) with an invisible hit area.
 - **Do** keep every left edge on the 16px page margin: large title, search, chips, and inset groups.
 - **Do** phrase "time since" neutrally ("Last seen 3 months ago", "Not seen yet"), never as a warning.
-- **Do** let text wrap and rows grow at large text sizes. Truncate only where iOS does (the back label, a two-line name under an avatar, a Recent meetups row's subtitle, which stops at two lines like a Mail preview).
+- **Do** let text wrap and rows grow at large text sizes. Truncate only where iOS does (the back label, a two-line name under an avatar, a Recent meetups row's subtitle, which stops at two lines like a Mail preview, and a Birthdays soon tile's very long first name).
 - **Do** use undo toasts instead of confirmation dialogs where the action is easily reversible; confirm only destructive, hard-to-undo actions.
 - **Do** pair every chart color with a legend and the numbers themselves.
 - **Do** check both themes: every text pair passes WCAG AA (Warm Ink Tertiary on Linen is the floor at 4.6:1).
@@ -457,6 +476,7 @@ Shown instead of the app, never over it, when the app lock is on and the app has
 - **Don't** center fixed elements with `left: 50%` and a translate; use auto margins.
 - **Don't** use bouncy or elastic animations; ease out smoothly, and fade instead when Reduce Motion is on.
 - **Don't** open a modal as the first answer; prefer sheets, inline editing, and undo.
+- **Don't** show a toast over a field being typed in.
 - **Don't** use em dashes in UI copy; use commas, colons, periods, or parentheses.
 - **Don't** show moods or weather in lists, rows, Stats or summaries.
 - **Don't** draw timeline rails, dots or connecting lines; stops are separated by hairlines.
```

In `docs/superpowers/specs/2026-10-21-friends-first-design.md`:

```diff
--- a/docs/superpowers/specs/2026-10-21-friends-first-design.md
+++ b/docs/superpowers/specs/2026-10-21-friends-first-design.md
@@ -612,3 +612,26 @@ Within this batch, build in this order: toasts and the day page (4), the Friends
 - Moving the group chips into a menu.
 - A Birthdays page.
 - Showing the age on Birthdays soon tiles.
+
+## Decisions made while building
+
+The sheet-details batch merged into `main` before this one was built, so this batch was reconciled with `main` as it is; where the two disagreed on something that batch decided, today's code won.
+
+- **Toasts belong to their page.** `ToastProvider`'s layout effect on the location key clears the toast and sets `--toast-space` to 0 on a `PUSH`, and measures as before otherwise (`POP` and `REPLACE` keep it). It drops a toast asked for while the path is a day page (`isDayPage`, read from a ref of the current path). Two e2e tests that checked the "Logged" toast after opening the meetup now check it's gone.
+- **The build order.** Task 1 stopped "Save and write about the day" from showing a toast and gave the day page `{ logged: true }`; the Logged note came in Task 3. The import confirm's "You can undo this in Settings for 7 days." came with the undo itself (Task 7), so no commit promises an undo it doesn't have.
+- **The Logged note's Undo ends for good.** The first change on the page (typing in either box, a weather chip, a face, or tapping any helper: @ Place, Now or Paid) ends it, and that's remembered for the session (in memory and in `sessionStorage`, `src/lib/loggedUndo.ts`). After the app lock or a reload the note shows again, as the spec says, but without Undo once something was changed, so one tap can never delete a day that was written. A spent Undo is hidden with `visibility: hidden`, so its room stays and nothing moves. A failed undo swaps the words for a new `role="alert"` line, so VoiceOver hears it.
+- **The day box aligns with `topOffset`.** The sheet-details batch already added `topOffset(port, target, margin)`, which is exactly the spec's `alignTopOffset` (the offset that puts `target.top` at `port.top + margin`, 0 within a pixel), with tests for a target below, above and at the margin. `data-reveal="start"` reuses it rather than adding a twin. The hook aligns only on the first shrink after the keyboard comes up (it tracks whether the body has shrunk since the keyboard came up, reset when the keyboard goes), so a Who paid or Place row opening later never moves the box. The caret check uses `caretLineSpan` and `revealOffset` with the field's scroll margin, and the offset is clamped to what the body can scroll.
+- **The Place row** puts the field before the scrolling part as a direct child of the bar, which wraps (`flex-wrap`); Add is pushed to the end of the second line with `margin-left: auto`.
+- **The shared strip.** `.snap-strip` in `base.css` holds what the Who strip and Birthdays soon share: the edge-to-edge bleed, 4px above and below for a focus ring, sideways scrolling, `overscroll-behavior-x`, the scroll padding, `touch-action` and the hidden scrollbar. Each strip keeps its own layout and how firmly it snaps (the Who strip a `mandatory` grid of columns, Birthdays soon a `proximity` flex row); the Who strip cancels the 4px with a negative block margin, as before.
+- **Birthdays soon** is a `ul` with `role="list"` (Safari drops a list from VoiceOver once its bullets are styled away). A tile's name is its `aria-label`, the full name and `describeNextBirthday`. `shortName(friend, among)` ignores the friend itself by identity, so `among` can include it; "Who paid?" gets the same results as `payerLabel` did.
+- **"See all"** is passed to `InsetGroup` as `action`, rendered in a wrapping flex header after the heading. Its hit area is a `::before` 44px tall and at least 44px wide, from the row's top edge (8px below the line) upward into the gap above the group.
+- **"The search field stays put"** stays, but the friend list's locator changed from `.friends-filters + .inset-group` to the last `.inset-group`: with Birthdays soon between the field and the list, the sibling selector no longer found the list. It passes without the scroll correction. Recent meetups tests that read Meal seed meetups so Meal is the latest, or read Drinks.
+- **Positions.** The e2e "friends come first" checks the search field's top at most 110px, the first friend row's top at most 480px and the third friend's name ending at or above 645px, in Playwright's iPhone 13 profile.
+- **Photos on the Meetup page.** `addMeetupPhoto` also keeps the new photo's thumbnail in the cache, so the grid's live query reads no image at all after a page add; a photo added by the sheet's Save is read once (only its record). `usePhotoAdder` takes `room`, `onPhoto` and `active`, plus `onBusyChange` and `onDone(ids)`; `onPhoto` resolving false (the meetup is gone) stops quietly. The hidden file input lives in the Add photos tile's `li`, and `PhotoAddHint` shows the hints. Edit is a native disabled button while photos are added (`.text-button:disabled`, 45%).
+- **The Settings tab's name.** While the dot shows, the link is named with `aria-label="Settings, backup suggested"` instead of visually hidden words: the hidden words are absolutely positioned, so the computed name came out "Settings , backup suggested". The dot has a 2px Paper White ring so it stands off the icon's lines.
+- **Backup days.** "30 or more days" is counted in the phone's calendar days, like the footer's "4 weeks ago". `backupNudgeSeenAt` is written when Settings opens while the dot shows. `useBackupDot` filters meetups with the pure `backupDue([meetup], lastBackupAt, now)` and stops at the first; it's asked again as the day changes (`useToday`). `nudge.ts` also exports `daysSince`.
+- **The import confirm.** One item missing is singular: "1 meetup in the app now isn't in this backup."; two or more, or a friend and a meetup, are plural. The lines come from `describeImport`; `describeRestoreKept` and `describeUndoRestore` build the "Undo restore" subtitle and its confirm, in the same file.
+- **Restore and its undo.** `replaceAllData` stays as the restore without a snapshot; it and `restoreBackup` share the inner `writeAllData`. The setting is written inside the restore's transaction (settings is one of its tables). Photos are copied 20 at a time by primary key (`orderBy(':id')`, then `where(':id').above(lastId)`) and back the same way (`[table+id]` ranges); the snapshot holds the rows as the reading hooks give them. `undoRestore` resolving false (no snapshot left) shows nothing; a failed one rolls back, keeps the snapshot and says "Couldn't undo. Please try again.". `forgetOldRestore` also deletes rows that no setting names, in one transaction on every start. The 7 days are exact time (7 times 24 hours).
+- **"Undo restore" reads its subtitle as its description** through a new `Row` prop, `subtitleDescribes` (`aria-labelledby` the title, `aria-describedby` the subtitle).
+- **Dexie version 4 and the service worker.** Dexie 4.4 opens a database newer than it declares: a version 3 reader on a version 4 database reads its friends, and a birthday push read that way names the friend (`db.test.ts`, `push.test.ts`). There's no upgrade step, so nothing new runs in the worker.
+- **Screenshots** take the next free numbers: `25-day-logged`, `26-day-place-row`, `27-meetup-photos`, `28-import-confirm`, `29-settings-undo-restore` and `30-tab-dot`, in light, dark and large text. `07-settings` now shows the footer's "8 meetups since then". Still 15 screenshot tests.
```

In `e2e/screenshots.spec.ts`:

```diff
--- a/e2e/screenshots.spec.ts
+++ b/e2e/screenshots.spec.ts
@@ -10,6 +10,7 @@ import {
   LARGE_TEXT,
   lockHeading,
   logMeetup,
+  putSetting,
   reopenAfterAWhile,
   seedAppLock,
   setBirthday,
@@ -32,6 +33,10 @@ function daysAgo(days: number): string {
 async function seed(page: Page) {
   // The day page's Place and Who paid rows are captured over the fake keyboard.
   await fakeVisualViewport(page)
+  // A backup is exported for the import confirm: the download path, since the share sheet can't be driven in tests.
+  await page.addInitScript(() => {
+    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
+  })
   await page.goto('/')
   await page.getByRole('complementary', { name: 'Install the app' }).getByRole('button', { name: 'Dismiss' }).click()
   // Birthdays soon shows Maya (today), Sam (in 3 days, with an age) and Theo (in 9 days).
@@ -119,7 +124,7 @@ async function writeOwnersDay(page: Page) {
   await page.getByRole('textbox', { name: 'How it felt, in your words' }).fill(OWNER_FEELINGS)
 }
 
-async function captureAll(page: Page, prefix: string) {
+async function captureAll(page: Page, prefix: string, largeText = false) {
   await page.screenshot({ path: `${DIR}/${prefix}-02-friends.png` })
   // Where the search field, the chips and the friend list land below Birthdays soon and Recent meetups.
   await captureFullList(page, `${DIR}/${prefix}-02-friends-full.png`)
@@ -180,6 +185,18 @@ async function captureAll(page: Page, prefix: string) {
   await page.waitForTimeout(500)
   await page.screenshot({ path: `${DIR}/${prefix}-15-day-empty.png` })
 
+  // Just logged, the keyboard up for The day: its top goes under the nav bar, with the Logged note above it.
+  const loggedDay = page.getByRole('textbox', { name: 'The day' })
+  await loggedDay.focus()
+  await openKeyboard(page)
+  await page.waitForTimeout(500)
+  await page.screenshot({ path: `${DIR}/${prefix}-25-day-logged.png` })
+  await loggedDay.blur()
+  await closeKeyboard(page)
+  await page.locator('.day-page__body').evaluate((element) => {
+    element.scrollTop = 0
+  })
+
   await writeOwnersDay(page)
   await expect(page.getByRole('status')).toBeEmpty({ timeout: 12_000 })
   await captureFullDay(page, `${DIR}/${prefix}-16-day-written.png`)
@@ -193,6 +210,10 @@ async function captureAll(page: Page, prefix: string) {
   await helpers.getByRole('textbox', { name: 'Place and time' }).fill('Blue willow 3:30')
   await page.waitForTimeout(500)
   await page.screenshot({ path: `${DIR}/${prefix}-17-day-place.png` })
+  // The Place field across the whole bar, with a place and its time showing whole.
+  await helpers.getByRole('textbox', { name: 'Place and time' }).fill('nonstopstyle 10:30')
+  await page.waitForTimeout(300)
+  await page.screenshot({ path: `${DIR}/${prefix}-26-day-place-row.png` })
   await helpers.getByRole('button', { name: 'Close' }).click()
   await helpers.getByRole('button', { name: 'Paid' }).click()
   await page.waitForTimeout(500)
@@ -221,6 +242,17 @@ async function captureAll(page: Page, prefix: string) {
   await page.locator('header.navbar .navbar__back').click()
   await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
 
+  // A meetup with no photos and no day: Photos, just the Add photos tile, comes before "Write about the day".
+  await friendLink(page, 'Kim Park').click()
+  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
+  await page.waitForTimeout(500)
+  await page.screenshot({ path: `${DIR}/${prefix}-27-meetup-photos.png` })
+  await page.locator('header.navbar .navbar__back').click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Kim Park' })).toBeVisible()
+  await page.locator('header.navbar .navbar__back').click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
+
   await friendLink(page, 'Alex Rivera').click()
   await page.waitForTimeout(500)
   await page.screenshot({ path: `${DIR}/${prefix}-04-friend.png` })
@@ -245,8 +277,39 @@ async function captureAll(page: Page, prefix: string) {
   await goToTab(page, 'Stats')
   await page.screenshot({ path: `${DIR}/${prefix}-06-stats.png`, fullPage: true })
 
+  // A backup is due: the last one 40 days ago, and every meetup logged since. The dot on the Settings tab.
+  await goToTab(page, 'Friends')
+  await putSetting(page, 'lastBackupAt', new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString())
+  await page.reload()
+  if (largeText) await page.addStyleTag({ content: LARGE_TEXT })
+  await expect(page.getByRole('link', { name: 'Settings, backup suggested' })).toBeVisible()
+  await page.waitForTimeout(500)
+  await page.screenshot({ path: `${DIR}/${prefix}-30-tab-dot.png` })
+
+  // Settings, where the footer says what's new since that backup (opening it sees the dot, which goes).
   await goToTab(page, 'Settings')
+  await expect(page.locator('.tabbar__dot')).toHaveCount(0)
   await page.screenshot({ path: `${DIR}/${prefix}-07-settings.png` })
+
+  // A backup made now, then one more meetup, then that backup imported: the confirm compares the two.
+  const download = page.waitForEvent('download')
+  await page.getByRole('button', { name: 'Export backup' }).click()
+  const backupPath = await (await download).path()
+  await goToTab(page, 'Friends')
+  await logMeetup(page, ['Jordan Lee'], { type: 'Coffee' })
+  await goToTab(page, 'Settings')
+  await page.locator('input[type="file"]').setInputFiles(backupPath)
+  const confirm = page.getByRole('alertdialog', { name: 'Replace all data with this backup?' })
+  await expect(confirm).toBeVisible()
+  await page.waitForTimeout(500)
+  await page.screenshot({ path: `${DIR}/${prefix}-28-import-confirm.png` })
+
+  // Restored: the toast's Undo, and "Undo restore" in the Backup group for 7 days.
+  await confirm.getByRole('button', { name: 'Replace all data' }).click()
+  await expect(page.getByRole('status')).toContainText('Backup restored')
+  await page.getByRole('button', { name: 'Undo restore', exact: true }).scrollIntoViewIfNeeded()
+  await page.waitForTimeout(500)
+  await page.screenshot({ path: `${DIR}/${prefix}-29-settings-undo-restore.png` })
 }
 
 /** Settings with birthday reminders just turned on, as in the Home Screen app (push is faked). */
@@ -302,7 +365,7 @@ test('large text', async ({ page }) => {
   test.setTimeout(120_000)
   await seed(page)
   await page.addStyleTag({ content: LARGE_TEXT })
-  await captureAll(page, 'large-text')
+  await captureAll(page, 'large-text', true)
 })
 
 test('accessibility text size day page and memory', async ({ page }) => {
```

- [ ] **Step 2: Run everything**

Run: `npx tsc -b` (no files written), then `npm test`
Expected: `Test Files  64 passed (64)` and `Tests  794 passed (794)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `220 passed`.

Run: `npm run screenshots`
Expected: `15 passed`. Look at the new PNGs in `e2e/screenshots` (never committed).

Look at `02-friends` (search first, the strip, one recent meetup, friends on the first screen), `25-day-logged`, `26-day-place-row`, `27-meetup-photos`, `28-import-confirm`, `29-settings-undo-restore`, `30-tab-dot` and `07-settings` in each theme and at large text. `07-settings` waits for the dot to go, since opening Settings sees it. The final full e2e had 2 failures in `sheetDetails.spec.ts` ("with 8 friends or fewer" measured two tiles 1.4px apart while the sheet rose, and a tab click stalled under load); the file alone, three times over: 66 passed.

- [ ] **Step 3: Commit**

```bash
git add DESIGN.md docs/superpowers/specs/2026-10-21-friends-first-design.md e2e/screenshots.spec.ts
git commit -F - <<'EOF'
docs: DESIGN.md, screenshots and the decisions made while building

DESIGN.md covers the Friends tab opening on friends (search first, the
Birthdays soon strip, one recent meetup with "See all"), toasts that belong
to their page, the day page's Logged note and The day at the top, the
two-line Place row, Photos on the Meetup page, the Backup group with its
footer, import confirm and "Undo restore", and the Settings tab's backup
dot. The screenshots add the day page just logged with the keyboard up
(25), the Place row (26), a meetup's Photos with no photos (27), the import
confirm (28), Undo restore (29) and the tab dot (30), in light, dark and
large text. The spec records the decisions made while building.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Spec coverage

| Spec requirement | Where |
| --- | --- |
| Toasts belong to their page: a push clears one (and `--toast-space`), a pop or a replace keeps it | Task 1; e2e "a toast belongs to its page", "going back keeps a toast" |
| The day page shows no toast; `isDayPage` in `src/lib/routes.ts`; `day-open` and `--day-bar-height` removed | Task 1; unit tests in `routes.test.ts`; e2e "Save and write about the day" |
| "Save and write about the day" pushes the day page with `{ logged: true }` | Task 1 |
| Search and chips under the large title; the scroll correction deleted | Task 2; e2e "friends come first", "the search field stays put" |
| Birthdays soon: one swipeable row of tiles, short names, countdowns, full accessible names, no footer | Task 2; unit tests for `shortName` and `describeBirthdayCountdown`; e2e in `birthdays.spec.ts` |
| Recent meetups: one row, "See all" in the header with a 44px hit area | Task 2; unit test for `RECENT_MEETUPS`; e2e in `history.spec.ts` |
| Positions: search at most 110px, first friend row at most 480px, third friend's name at or above 645px | Task 2; e2e "friends come first" |
| The Logged note: check, "Logged with …", Undo until the first change, room kept, announced once | Task 3; e2e "Undo in the Logged note", "after the first change", "a weather chip is a change too" |
| The day box aligns under the nav bar when the keyboard comes up, unless the caret's line would hide | Task 3; e2e "The day goes to the top", "a long day tapped at its end" |
| The Place field across the whole bar, with Now, Add, Close and Hide keyboard under it | Task 3; e2e "the Place field takes the whole bar", "adding a place … without moving The day" |
| Photos always on the Meetup page, between Activities and The day, ending with Add photos | Task 4; e2e "hides what a meetup does not have", "the sections come in the order …" |
| Add photos saves each photo at once, "Added 2 photos" with Undo, Edit waits, hints, 20 at most | Task 4; e2e "adds photos right from the Meetup page", "with 19 photos …", "a photo that cannot be read …" |
| `addMeetupPhoto`, `removeMeetupPhotos`, `photoThumbs` from the cache, no full image for a list | Task 4; unit tests in `meetups.test.ts` (spies on `get` and `bulkGet`) |
| `usePhotoAdder` and `PhotoAddTile` shared by the sheet and the page; `.photo-add` in `base.css` | Task 4; e2e in `memories.spec.ts` (the sheet) and `meetupPage.spec.ts` |
| The Backup footer's "N meetups since then" | Task 5; unit tests in `text.test.ts`; e2e "a quiet dot …" |
| The Settings tab's dot: due rules, seen for 30 days, a backup ends it, "Settings, backup suggested" | Task 5; unit tests in `nudge.test.ts`; e2e "a quiet dot on the Settings tab …" |
| `TabBar` returns before any query on the day page | Task 5 |
| `parseBackup` gives `exportedAt`; the import confirm's lines | Tasks 6 and 7; unit tests in `format.test.ts` and `importSummary.test.ts`; e2e "the import confirm compares …" |
| Dexie version 4 adds `restoreUndo`; the upgrade; an older reader (the service worker) still reads | Task 7; unit tests in `db.test.ts` and `push.test.ts` |
| Restore keeps a snapshot in its own transaction, 20 photos at a time; none into an empty app | Task 7; unit tests in `storage.test.ts`; e2e "a restore into a fresh app …" |
| Undo from the toast and from "Undo restore" (subtitle, confirm), 7 days, cleanup on every start | Task 7; unit tests in `storage.test.ts` and `importSummary.test.ts`; e2e in `settings.spec.ts` |
| DESIGN.md | Task 8 |
| Screenshots: 02 with the new Friends tab; new 25 to 30 in light, dark and large text | Task 8 |
| Counts: unit 60 to 64 files and 749 to 794 tests; e2e 200 to 220; screenshots stay 15 | Tasks 1 to 8 |
