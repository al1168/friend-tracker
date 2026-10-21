# Sheet Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ] `) syntax for tracking.

**Goal:** Make logging a meetup complete and comfortable in one sheet: Save at the top right of the meetup and friend sheets with no footer (and no "Pick a friend" anywhere), a The day box right after When that saves with the meetup, a soft tint behind every line the grammar reads as a place (in the sheet and on The day page), every friend in Who as a swipeable two-row strip ordered by who you actually see, a friend search that goes to the top of the sheet so its results get the room above the keyboard, and a suggested meetup type instead of always the first.

**Architecture:** `Sheet` takes an optional trailing `action` and draws Save in the header, each side over an invisible copy of the other side's label so the title stays centered. `MeetupInput` takes an optional `note`, written in the meetup's own transaction. `isPlaceLine` (exported from the frozen grammar) and `placeRuns` (`src/lib/dayHighlight.ts`) cut a day into tinted and plain runs, which `GrowField`'s copy of its text, now a real `aria-hidden` element, paints behind a transparent textarea. `friendsToPick` and `suggestMeetupType` in `src/stats/` are the pure rules for the Who order and the suggested type. `useRevealFocusedField` learns an opt-in `data-reveal="top"` for the friend search, measured by the pure `topOffset`. No schema, Dexie version or backup change.

**Tech Stack:** Vite 8, React 19, TypeScript 6 (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`), react-router 7 (HashRouter), Dexie 4 with dexie-react-hooks, Vitest 5 with fake-indexeddb (TZ America/Los_Angeles), Playwright WebKit (iPhone 13, port 4174, service workers blocked).

---

**Spec:** [docs/superpowers/specs/2026-10-21-sheet-details-design.md](../specs/2026-10-21-sheet-details-design.md), the source of truth (approved, "Auto approve"; later the same day the owner removed "Pick a friend" and approved additions A, B and C). Design context: [DESIGN.md](../../../DESIGN.md) (section 5), [PRODUCT.md](../../../PRODUCT.md).

## Ground rules for every task

- Run every command from the project root in Git Bash: `/c/Users/luald/OneDrive/Desktop/Friend tracker`. The branch `feature/sheet-details` is already checked out.
- TypeScript: type-only imports use `import type` or an inline `type` specifier; no enums, namespaces or constructor parameter properties; no unused locals or parameters. Test files under `src/` and everything in `e2e/` are type-checked by `npm run build`. Keep lines within about 120 characters.
- Import paths are extensionless inside `src/`. Inside `e2e/`, local files are imported with `.ts` (`./helpers.ts`). The e2e project is type-checked as `nodenext`, so row shapes for seeding live in `e2e/helpers.ts`.
- Copy (UI text, comments, docs) never uses em dashes. Use commas, colons, periods or parentheses.
- **Nothing here touches the stored data.** No new table, index, field, Dexie version or backup format. The day box writes the meetup's existing `note`.
- **The grammar is frozen.** `isPlaceLine` is built on the private `readPlaceLine` and changes no rule; the golden fixtures stay as they are.
- Never run `npm run dev`, `npm run preview`, `vite preview` or wrangler yourself. `npm run e2e` and `npm run screenshots` build and start their own preview server on port 4174; only one Playwright run at a time.
- Commands:
  - Unit tests: `npm test` (one file: `npx vitest run <path>`)
  - Type check and production build: `npm run build` (quick type check only: `npx tsc -b`)
  - End-to-end tests: `npm run e2e` (one file: `npx playwright test --project=iphone <path>`)
  - Screenshots: `npm run screenshots`
- Baseline before Task 1: `npm test` shows `Test Files  58 passed (58)` and `Tests  713 passed (713)`; `npm run e2e` shows `173 passed`; `npm run screenshots` shows `15 passed`. Each task states the new totals, measured by building this plan task by task in a clone of the branch.
- **A known machine flake:** under 4-worker load an unrelated e2e test can stall (a click that waits for an element to be stable). Re-run that file alone (`npx playwright test --project=iphone <file>`) and note it.
- **Screenshots are not committed.** `e2e/screenshots` is in `.gitignore`; look at the PNGs locally and never `git add` them.
- **Shell escapes:** when an edit's text holds `\n` or `\b`, make it with an editor or a script file, not a shell one-liner, which can collapse the backslashes.
- Commit after each task with the exact `git add` paths and message given. Every commit message ends with a blank line and then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Decisions made while building

The spec records these at its end ("Decisions made while building"), in Task 10.

1. **No "Pick a friend" anywhere** (the owner's change, mid-build). Save is always "Save" and a native disabled button until a friend is picked, while photos are added and while saving; VoiceOver reads "dimmed". No hint, no `aria-describedby`.
2. **The header action is data:** `action: { label, onClick, disabled }`. Each side stacks its button over an invisible copy of the other side's label, so both sides are as wide as the wider one and the title stays centered (checked within a pixel) and wraps at large text. Group, type and lock sheets keep their footers.
3. **Errors show at the top of the body** and scroll into view (`scrollIntoView({ block: 'nearest' })`, as `BirthdayField` does).
4. **Without a footer** the body keeps its end clear of the home indicator, and gives that room up while the keyboard is up.
5. **`note` in `MeetupInput` is optional.** Log always gives it; Edit only when the box changed, so it can't overwrite a day written elsewhere. Same transaction as the meetup and photos. `updateMeetup` passes Dexie `{ ...fields }` because Dexie's update type won't take an interface.
6. **The tint:** `isPlaceLine` in `src/lib/dayText.ts`, `placeRuns` in `src/lib/dayHighlight.ts`, `GrowField`'s `highlightPlaces`. The copy is a real `aria-hidden` element that sizes the box and paints the tints; the Paper White moved to the GrowField cell and the textarea is transparent. Tints cover a line's words, reach 0.2em past them with a cancelling margin, and `box-decoration-break: clone` tints each line of a wrapped place.
7. **The strip:** up to 8 friends keep the still four-across grid filled by rows; more than 8 (`data-swipes`) make the column-filled strip, columns `(100% - 3 gaps) / 4.4`. Classes `.friend-strip`, `.friend-tile`. The e2e "swipe" scrolls the strip in script (Playwright's mobile WebKit has no wheel or touch scroll).
8. **Search to the top** is the reveal hook's opt-in `data-reveal="top"`, on the search's `label`; it runs a frame after focus and each input, and when the body shrinks, never on `selectionchange`.
9. **"At least 4 result rows"** can't mean four whole 60px rows on the 664px iPhone 13 profile (324px above the 340px fake keyboard): the e2e checks three whole rows and the fourth starting there, and plays the Home Screen app's 844px screen with its safe areas for at least four whole rows.
10. **The suggested type (A):** deleted types are dropped before taking the 10 or the 30; future meetups don't count; only a tapped type that differs from the opening one is a change. The chip is revealed by moving the row's `scrollLeft` with `revealOffset`, never with `scrollIntoView` (which would scroll the sheet when the row is out of view).
11. **The Who order (B):** `friendsToPick` replaces `recentFriends`. "Last 90 days" is today and the 89 days before; "last 12 months" is the 365 days ending today. Ties among companions keep the general order; the preset friend's tile keeps its place in the general order.
12. **E2e helpers:** `sheetSave(sheet)`; `logMeetup` always taps its type (Coffee by default) so no test depends on a suggestion; the strip is the group "Friends" (`exact: true`).
13. **Screenshots:** new `21-log-day` and `22-log-search` in light, dark and large text; still 15 screenshot tests.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/components/Sheet.tsx` / `.css` | Modify | `SheetAction`, the header's trailing button and the equal side columns; the footer-less body's bottom room |
| `src/sheets/MeetupSheet.tsx` / `.css` | Modify | Save in the header, errors at the top, The day box, "Save and write about the day" in the body, the friend strip, search to the top, the suggested type |
| `src/sheets/FriendSheet.tsx` | Modify | Save in the header |
| `src/sheets/BirthdayField.tsx` | Modify | A comment no longer about the footer |
| `src/db/meetups.ts` / `.test.ts` | Modify | `MeetupInput.note`, saved in the meetup's transaction |
| `src/lib/dayText.ts` / `.test.ts` | Modify | `isPlaceLine` |
| `src/lib/dayHighlight.ts` / `.test.ts` | Create | `placeRuns`, `TextRun` |
| `src/components/GrowField.tsx` / `.css` | Modify | The copy as a real element; `highlightPlaces`; `.day-place` |
| `src/screens/DayScreen.tsx` | Modify | The day page's box gets the tint |
| `src/hooks/useRevealFocusedField.ts` | Modify | `data-reveal="top"` |
| `src/lib/viewport.ts` / `.test.ts` | Modify | `topOffset`; `revealMargin`'s parameter renamed |
| `src/stats/friendsToPick.ts` / `.test.ts` | Create (replace `recent.ts`) | The Who order |
| `src/stats/suggestType.ts` / `.test.ts` | Create | `suggestMeetupType` |
| `e2e/helpers.ts` | Modify | `sheetSave`; `addFriend` and `logMeetup` use it; `logMeetup` taps its type |
| `e2e/sheetDetails.spec.ts` | Create | The day box, the tint, the strip, the order, the suggested type |
| `e2e/sheetKeyboard.spec.ts` | Modify | Placement without a footer; Save stays put; the body's bottom room; search to the top |
| `e2e/meetups.spec.ts`, `e2e/friends.spec.ts`, `e2e/day.spec.ts` | Modify | Header Save tests; the quick log; the "Friends" group |
| `e2e/birthdays.spec.ts`, `e2e/detail.spec.ts`, `e2e/history.spec.ts`, `e2e/memories.spec.ts` | Modify | Click the header Save |
| `e2e/screenshots.spec.ts` | Modify | Header Save; the "Friends" group; `03`, `21`, `22` captures |
| `DESIGN.md` | Modify | Buttons, Friend tiles, Inputs (the tint), Bottom sheets, Meetup sheet, The day page, Avatars, `place-tint` |
| `docs/superpowers/specs/2026-10-21-sheet-details-design.md` | Modify | The owner's changes and additions; the decisions made while building |

---
### Task 1: Save at the top right of the meetup and friend sheets, with no footer

**Files:**
- Modify: `src/components/Sheet.tsx`, `src/components/Sheet.css`, `src/sheets/MeetupSheet.tsx`, `src/sheets/MeetupSheet.css`, `src/sheets/FriendSheet.tsx`, `src/sheets/BirthdayField.tsx`
- Modify: `docs/superpowers/specs/2026-10-21-sheet-details-design.md` (the owner's "no Pick a friend")
- Test: `e2e/helpers.ts`, `e2e/meetups.spec.ts`, `e2e/friends.spec.ts`, `e2e/day.spec.ts`, `e2e/sheetKeyboard.spec.ts`, and the header Save in `e2e/birthdays.spec.ts`, `e2e/detail.spec.ts`, `e2e/history.spec.ts`, `e2e/memories.spec.ts`, `e2e/screenshots.spec.ts`

- [ ] **Step 1: Record the owner's change in the spec**

The owner, after the design: "I don't think there should be a pick friend button, it is implied when I click on their profile that I am picking that friend." No "Pick a friend" label, button or hint; Save just stays dimmed.

In `docs/superpowers/specs/2026-10-21-sheet-details-design.md`:

```diff
--- a/docs/superpowers/specs/2026-10-21-sheet-details-design.md
+++ b/docs/superpowers/specs/2026-10-21-sheet-details-design.md
@@ -70,7 +70,7 @@ Make logging a meetup complete and comfortable in one sheet: pick any friend wit
 - **The action.** A text button in Terracotta Ink, weight 600, 44 by 44px minimum, labeled "Save". It's disabled (45% opacity, `aria-disabled` handled as the codebase does) when saving isn't possible.
 - **Meetup sheets.**
   - Save is disabled until a friend is picked, while photos are being added, and while saving.
-  - The old "Pick a friend" label moves out of the button: when no friend is picked, the Who section shows a Footnote hint, "Pick at least one friend to save." The hint is hidden once a friend is picked.
+  - There is no "Pick a friend" label, button or hint anywhere (the owner, after this design: "I don't think there should be a pick friend button, it is implied when I click on their profile that I am picking that friend."). Save is always labeled "Save" and simply stays dimmed until a friend is picked, the standard iOS pattern; VoiceOver reads it as dimmed. Nothing else explains it.
   - Errors ("Couldn't save. Please try again." and validation messages) show at the top of the sheet body with `role="alert"`.
 - **Friend sheet.** Save moves to the header the same way. It's disabled while saving or processing a photo. A missing name still shows its existing error under Name and focuses the field.
 - **Footer.**
@@ -81,7 +81,7 @@ Make logging a meetup complete and comfortable in one sheet: pick any friend wit
 ## Accessibility
 
 - Header Save is a real `button`, named "Save", reachable after Cancel in focus order.
-- The no-friend hint is linked to Save with `aria-describedby` while it shows.
+- Before a friend is picked, Save is a disabled button, so VoiceOver reads "Save, dimmed". No hint or `aria-describedby` goes with it.
 - The day box has a label and a hint description.
 - The friend strip keeps a sensible VoiceOver order.
 - 44px targets everywhere, and Dynamic Type at the largest sizes: the header wraps the title, Save stays tappable, and the strip's tiles grow with their names.
@@ -106,7 +106,7 @@ Make logging a meetup complete and comfortable in one sheet: pick any friend wit
 - **Highlight.** A `mark.day-place` appears for "@ some place" and "@Blue willow 3:30", not for "@", nor for a sentence with "@" in the middle. It's on both the sheet box and The day page.
 - **Swiping friends.** With 12 friends, the 12th is reachable by scrolling the strip horizontally and can be picked, and the strip has more than 8 tiles.
 - **Header Save.**
-  - It's disabled with the hint before a friend is picked, and saves after.
+  - It's disabled before a friend is picked (and no "Pick a friend" text shows anywhere), and saves after.
   - Every existing e2e that clicked the footer Save or "Pick a friend" is updated to the header Save.
   - The friend sheet saves from the header too.
 - **Existing tests:** all existing e2e and unit tests stay green.
```

- [ ] **Step 2: Add `sheetSave` and use it in the helpers**

In `e2e/helpers.ts`:

```diff
--- a/e2e/helpers.ts
+++ b/e2e/helpers.ts
@@ -7,6 +7,11 @@ export const ONE_PIXEL_PNG =
 /** Roughly the iPhone's largest standard text size, for page.addStyleTag. */
 export const LARGE_TEXT = 'html { font: 23px/1.35 -apple-system, system-ui, sans-serif !important; }'
 
+/** The Save button at the top right of an open meetup or friend sheet's header. */
+export function sheetSave(sheet: Locator): Locator {
+  return sheet.locator('.sheet__header').getByRole('button', { name: 'Save', exact: true })
+}
+
 export async function goToTab(page: Page, name: 'Friends' | 'Stats' | 'Settings') {
   await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click()
   await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
@@ -28,7 +33,7 @@ export async function addFriend(page: Page, name: string, group?: string, birthd
     }
   }
   if (birthday) await setBirthday(sheet, birthday)
-  await sheet.getByRole('button', { name: 'Save' }).click()
+  await sheetSave(sheet).click()
   await expect(sheet).toBeHidden()
 }
 
@@ -48,7 +53,7 @@ export async function logMeetup(
   for (const activity of options.activities ?? []) await pickActivity(sheet, activity)
   if (options.photos) await addPhotos(sheet, options.photos)
   if (!options.note) {
-    await sheet.getByRole('button', { name: 'Save', exact: true }).click()
+    await sheetSave(sheet).click()
     await expect(sheet).toBeHidden()
     return
   }
```

- [ ] **Step 3: Write the failing header tests**

The meetup sheets: Cancel then Save in the header, Save dimmed with no "Pick a friend" text and no footer, the title centered within a pixel, and Edit saving from the header too.

In `e2e/meetups.spec.ts`:

```diff
--- a/e2e/meetups.spec.ts
+++ b/e2e/meetups.spec.ts
@@ -1,5 +1,5 @@
 import { expect, test } from '@playwright/test'
-import { addFriend, friendLink, logMeetup } from './helpers.ts'
+import { addFriend, editMeetup, friendLink, logMeetup, openFriendPage, sheetSave } from './helpers.ts'
 
 test('logs a meetup with two friends', async ({ page }) => {
   await page.goto('/')
@@ -21,14 +21,43 @@ test('undo removes the meetup', async ({ page }) => {
   await expect(friendLink(page, 'Alex')).toContainText('Not seen yet')
 })
 
-test('Save waits for a friend to be picked', async ({ page }) => {
+test('Save is at the top right, dimmed until a friend is picked, and there is no footer', async ({ page }) => {
   await page.goto('/')
   await addFriend(page, 'Alex')
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
-  await expect(sheet.getByRole('button', { name: 'Pick a friend' })).toBeDisabled()
+  const header = sheet.locator('.sheet__header')
+  // Cancel on the left, then Save: the order VoiceOver and the keyboard reach them in.
+  await expect(header.getByRole('button')).toHaveText(['Cancel', 'Save'])
+  await expect(sheetSave(sheet)).toBeDisabled()
+  // Picking a friend is the only step: nothing says "Pick a friend".
+  await expect(sheet.getByText(/pick a friend|pick at least one/i)).toHaveCount(0)
+  await expect(sheet.locator('.sheet__footer')).toHaveCount(0)
+  // The title stays centered between Cancel and Save.
+  const title = await header.getByRole('heading', { name: 'Log meetup' }).boundingBox()
+  const bar = await header.locator('.sheet__bar').boundingBox()
+  if (!title || !bar) throw new Error('The header is not on screen')
+  expect(Math.abs(title.x + title.width / 2 - (bar.x + bar.width / 2)), 'Within a pixel').toBeLessThanOrEqual(1)
+
   await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
-  await expect(sheet.getByRole('button', { name: 'Save', exact: true })).toBeEnabled()
+  await expect(sheetSave(sheet)).toBeEnabled()
+  await sheetSave(sheet).click()
+  await expect(sheet).toBeHidden()
+  await expect(page.getByRole('status')).toContainText('Logged with Alex')
+})
+
+test('the Edit meetup sheet saves from the top right too', async ({ page }) => {
+  await page.goto('/')
+  await addFriend(page, 'Alex')
+  await logMeetup(page, ['Alex'])
+  await openFriendPage(page, 'Alex')
+  const sheet = await editMeetup(page, /Coffee/)
+  await expect(sheet.locator('.sheet__footer')).toHaveCount(0)
+  await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
+  await sheetSave(sheet).click()
+  await expect(sheet).toBeHidden()
+  await expect(page.getByRole('status')).toContainText('Saved')
+  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
 })
 
 test('logs a meetup on another date', async ({ page }) => {
```

The friend sheet saves from the header, and its other Save clicks use `sheetSave`:

In `e2e/friends.spec.ts`:

```diff
--- a/e2e/friends.spec.ts
+++ b/e2e/friends.spec.ts
@@ -1,5 +1,5 @@
 import { expect, test } from '@playwright/test'
-import { addFriend, ONE_PIXEL_PNG } from './helpers.ts'
+import { addFriend, ONE_PIXEL_PNG, sheetSave } from './helpers.ts'
 
 test('shows a welcome state with no friends', async ({ page }) => {
   await page.goto('/')
@@ -15,11 +15,23 @@ test('adds friends and lists them', async ({ page }) => {
   await expect(page.getByRole('link', { name: /Sam/ })).toBeVisible()
 })
 
+test('the friend sheet saves from the top right, with no footer', async ({ page }) => {
+  await page.goto('/')
+  await page.getByRole('button', { name: 'Add friend' }).first().click()
+  const sheet = page.getByRole('dialog', { name: 'New friend' })
+  await expect(sheet.locator('.sheet__header').getByRole('button')).toHaveText(['Cancel', 'Save'])
+  await expect(sheet.locator('.sheet__footer')).toHaveCount(0)
+  await sheet.getByLabel('Name', { exact: true }).fill('Kim')
+  await sheetSave(sheet).click()
+  await expect(sheet).toBeHidden()
+  await expect(page.getByRole('status')).toContainText('Added Kim')
+})
+
 test('requires a name', async ({ page }) => {
   await page.goto('/')
   await page.getByRole('button', { name: 'Add friend' }).first().click()
   const sheet = page.getByRole('dialog', { name: 'New friend' })
-  await sheet.getByRole('button', { name: 'Save' }).click()
+  await sheetSave(sheet).click()
   await expect(sheet.getByText('Please enter a name.')).toBeVisible()
 })
 
@@ -94,7 +106,7 @@ test('keeps a typed new group when saving', async ({ page }) => {
   await sheet.getByLabel('Name', { exact: true }).fill('Kim')
   await sheet.getByRole('button', { name: 'New group' }).click()
   await sheet.getByLabel('New group name').fill('Work')
-  await sheet.getByRole('button', { name: 'Save' }).click()
+  await sheetSave(sheet).click()
   await expect(sheet).toBeHidden()
   await expect(page.getByRole('link', { name: /Kim/ })).toContainText('Work')
 })
@@ -103,7 +115,7 @@ test('empty name is announced', async ({ page }) => {
   await page.goto('/')
   await page.getByRole('button', { name: 'Add friend' }).first().click()
   const sheet = page.getByRole('dialog', { name: 'New friend' })
-  await sheet.getByRole('button', { name: 'Save' }).click()
+  await sheetSave(sheet).click()
   const input = sheet.getByLabel('Name', { exact: true })
   await expect(input).toHaveAttribute('aria-invalid', 'true')
   await expect(input).toHaveAccessibleDescription(/Please enter a name/)
```

The quick log: Save and "Save and write about the day" both wait for a friend, and the write button is the last thing in the body:

In `e2e/day.spec.ts`:

```diff
--- a/e2e/day.spec.ts
+++ b/e2e/day.spec.ts
@@ -14,6 +14,7 @@ import {
   readMeetups,
   reopenAfterAWhile,
   seedAppLock,
+  sheetSave,
   tinyPhoto,
 } from './helpers.ts'
 
@@ -60,28 +61,26 @@ async function hideApp(page: Page) {
   })
 }
 
-test('the quick log is unchanged: no Note, and Save stays put while "Save and write about the day" waits for a friend', async ({
+test('the quick log: Save at the top right and "Save and write about the day" at the end both wait for a friend', async ({
   page,
 }) => {
   await page.goto('/')
   await addFriend(page, 'Alex')
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
-  await expect(sheet.getByLabel('Note')).toHaveCount(0)
   const write = sheet.getByRole('button', { name: 'Save and write about the day' })
-  const save = sheet.locator('.sheet__footer .button--block')
+  const save = sheetSave(sheet)
   await expect(write).toBeDisabled()
-  await expect(save).toHaveText('Pick a friend')
-  // Measure once the sheet has finished rising.
-  await sheet.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)))
-  const before = await save.boundingBox()
+  await expect(save).toBeDisabled()
+  // A full-width button at the end of the sheet's body, not a footer.
+  await expect(sheet.locator('.sheet__body > :last-child')).toHaveText('Save and write about the day')
+  await expect(sheet.locator('.sheet__footer')).toHaveCount(0)
 
   await sheet.getByLabel('Search all friends').fill('Alex')
   await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Alex', exact: true }).click()
 
   await expect(write).toBeEnabled()
-  await expect(save).toHaveText('Save')
-  expect(await save.boundingBox(), 'Save did not move').toEqual(before)
+  await expect(save).toBeEnabled()
   await save.click()
   await expect(sheet).toBeHidden()
   await expect(page.getByRole('status')).toContainText('Logged with Alex')
```

The keyboard tests no longer need a footer. "Save and write about the day steps aside" becomes "Save stays at the top right and nothing rides on the keyboard", and the Save bar's home indicator test becomes the body's (24px plus the 34px safe area, 24px while the keyboard is up):

In `e2e/sheetKeyboard.spec.ts`:

```diff
--- a/e2e/sheetKeyboard.spec.ts
+++ b/e2e/sheetKeyboard.spec.ts
@@ -1,13 +1,12 @@
 import { expect, test, type Locator, type Page } from '@playwright/test'
-import { addFriend, LARGE_TEXT } from './helpers.ts'
+import { addFriend, LARGE_TEXT, sheetSave } from './helpers.ts'
 import { closeKeyboard, fakeVisualViewport, KEYBOARD, nextFrames, openKeyboard, setVisualViewport, tapFocus } from './keyboard.ts'
 
-/** Where a field inside a sheet is, against the part of the sheet's body you can see and its Save bar. */
+/** Where a field inside a sheet is, against the part of the sheet's body you can see (it ends at the keyboard). */
 async function placement(field: Locator) {
   return field.evaluate((element) => {
     const body = element.closest<HTMLElement>('.sheet__body')
-    const footer = element.closest('.sheet')?.querySelector('.sheet__footer')
-    if (!body || !footer) throw new Error('Not in a sheet with a footer')
+    if (!body) throw new Error('Not in a sheet')
     const top = body.getBoundingClientRect().top + body.clientTop
     const rect = element.getBoundingClientRect()
     return {
@@ -15,7 +14,6 @@ async function placement(field: Locator) {
       bottom: rect.bottom,
       visibleTop: top,
       visibleBottom: top + body.clientHeight,
-      footerTop: footer.getBoundingClientRect().top,
       focused: document.activeElement === element,
     }
   })
@@ -25,15 +23,16 @@ async function placement(field: Locator) {
 const MARGIN = 12
 
 /**
- * The field has focus and is all on screen: inside the sheet's visible scroll area, and above the Save bar
- * with `room` to spare.
+ * The field has focus and is all on screen: inside the sheet's visible scroll area, with `room` to spare above
+ * the end of it (the keyboard, or the bottom of the screen).
  */
 async function expectRevealed(field: Locator, name: string, { room = 0 } = {}) {
   const at = await placement(field)
   expect(at.focused, `${name} has focus`).toBe(true)
   expect(at.top, `The top of ${name} is inside the visible part of the sheet`).toBeGreaterThanOrEqual(at.visibleTop)
-  expect(at.bottom, `The bottom of ${name} is inside the visible part of the sheet`).toBeLessThanOrEqual(at.visibleBottom)
-  expect(at.bottom, `${name} is above the Save bar, with ${room}px to spare`).toBeLessThanOrEqual(at.footerTop - room)
+  expect(at.bottom, `The bottom of ${name} is inside the visible part of the sheet, with ${room}px to spare`).toBeLessThanOrEqual(
+    at.visibleBottom - room,
+  )
 }
 
 /** Scrolls to a field the way someone does before tapping it, and checks that its top shows. */
@@ -225,37 +224,40 @@ test('focusing a chip with the keyboard up leaves the scrolled sheet alone', asy
   expect(await scrollTop(body)).toBe(0)
 })
 
-test('"Save and write about the day" steps aside while the keyboard is up, and Save stays put', async ({ page }) => {
+test('with the keyboard up, Save stays at the top right and nothing rides on the keyboard', async ({ page }) => {
   const sheet = await openLogMeetup(page)
-  const write = sheet.getByRole('button', { name: 'Save and write about the day' })
-  const save = sheet.locator('.sheet__footer .button--block')
-  await expect(write).toBeVisible()
+  const save = sheetSave(sheet)
+  // Measure once the sheet has finished rising.
+  await sheet.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)))
   await tapFocus(sheet.getByLabel('Search all friends'))
   const before = await save.boundingBox()
 
-  await openKeyboard(page)
+  const { height } = await openKeyboard(page)
 
-  await expect(write).toBeHidden()
-  const after = await save.boundingBox()
-  if (!before || !after) throw new Error('Save is not on screen')
-  expect(after.y + after.height, 'Save sits on the keyboard').toBeCloseTo(before.y + before.height - KEYBOARD, 0)
+  expect(await save.boundingBox(), 'Save did not move').toEqual(before)
+  await expect(save).toBeInViewport()
+  await expect(sheet.locator('.sheet__footer')).toHaveCount(0)
+  const bodyBottom = await sheet.locator('.sheet__body').evaluate((element) => element.getBoundingClientRect().bottom)
+  expect(bodyBottom, 'The body runs down to the keyboard').toBeCloseTo(height, 0)
   await closeKeyboard(page)
-  await expect(write).toBeVisible()
 })
 
-test('the Save bar gives up its home indicator room while the keyboard is up', async ({ page }) => {
+test('the end of the sheet stays clear of the home indicator, and gives that room up while the keyboard is up', async ({
+  page,
+}) => {
   // Play a phone with a home indicator: 34px of safe area at the bottom.
   await page.addStyleTag({ content: ':root { --safe-bottom: 34px; }' })
   const sheet = await openNewFriend(page)
-  const footer = sheet.locator('.sheet__footer')
+  // With no footer, the body is the bottom of the sheet.
+  const body = sheet.locator('.sheet__body')
   const html = page.locator('html')
-  const paddingBottom = () => footer.evaluate((element) => getComputedStyle(element).paddingBottom)
+  const paddingBottom = () => body.evaluate((element) => getComputedStyle(element).paddingBottom)
   await tapFocus(sheet.getByLabel('Name', { exact: true }))
-  expect(await paddingBottom(), 'Room for the home indicator under Save').toBe('46px')
+  expect(await paddingBottom(), 'Room for the home indicator under the last row').toBe('58px')
 
   const { height } = await openKeyboard(page)
   await expect(html).toHaveClass(/\bkeyboard-open\b/)
-  expect(await paddingBottom(), 'The keyboard covers the home indicator').toBe('12px')
+  expect(await paddingBottom(), 'The keyboard covers the home indicator').toBe('24px')
 
   // iOS pans the visual viewport down over the keyboard: still up.
   await setVisualViewport(page, { height, offsetTop: KEYBOARD })
@@ -263,7 +265,7 @@ test('the Save bar gives up its home indicator room while the keyboard is up', a
 
   await closeKeyboard(page)
   await expect(html).not.toHaveClass(/\bkeyboard-open\b/)
-  expect(await paddingBottom()).toBe('46px')
+  expect(await paddingBottom()).toBe('58px')
 
   // Closing the sheet with the keyboard up takes the class away with it.
   await openKeyboard(page)
```

- [ ] **Step 4: Click the header Save everywhere else**

In `e2e/birthdays.spec.ts`:

```diff
--- a/e2e/birthdays.spec.ts
+++ b/e2e/birthdays.spec.ts
@@ -1,6 +1,6 @@
 import { readFile } from 'node:fs/promises'
 import { expect, test, type Locator, type Page } from '@playwright/test'
-import { addFriend, dayFromToday, goToTab, setBirthday } from './helpers.ts'
+import { addFriend, dayFromToday, goToTab, setBirthday, sheetSave } from './helpers.ts'
 
 /** "March" for 3. */
 function monthName(month: number): string {
@@ -24,7 +24,7 @@ async function editFriend(page: Page): Promise<Locator> {
 }
 
 async function save(sheet: Locator) {
-  await sheet.getByRole('button', { name: 'Save' }).click()
+  await sheetSave(sheet).click()
   await expect(sheet).toBeHidden()
 }
 
@@ -71,7 +71,7 @@ test('checks the birthday on Save, and sets one when adding a friend', async ({
   const { month, day, year } = birthdaySelects(sheet)
 
   await month.selectOption('3')
-  await sheet.getByRole('button', { name: 'Save' }).click()
+  await sheetSave(sheet).click()
   await expect(sheet.getByText('Pick a month and a day.')).toBeVisible()
   await expect(day).toHaveAttribute('aria-invalid', 'true')
   await expect(day).toHaveAccessibleDescription('Pick a month and a day.')
@@ -82,7 +82,7 @@ test('checks the birthday on Save, and sets one when adding a friend', async ({
   await expect(day).toHaveAttribute('aria-invalid', 'false')
   await day.selectOption('29')
   await year.selectOption('2023')
-  await sheet.getByRole('button', { name: 'Save' }).click()
+  await sheetSave(sheet).click()
   await expect(sheet.getByText("That date doesn't exist.")).toBeVisible()
   await expect(year).toHaveAccessibleDescription("That date doesn't exist.")
 
```

In `e2e/detail.spec.ts`:

```diff
--- a/e2e/detail.spec.ts
+++ b/e2e/detail.spec.ts
@@ -1,5 +1,5 @@
 import { expect, test } from '@playwright/test'
-import { addFriend, friendLink, LARGE_TEXT, logMeetup, tinyPhoto } from './helpers.ts'
+import { addFriend, friendLink, LARGE_TEXT, logMeetup, sheetSave, tinyPhoto } from './helpers.ts'
 
 test('shows a friend’s stats and history', async ({ page }) => {
   await page.goto('/')
@@ -64,7 +64,7 @@ test('logs from the friend page with them preselected', async ({ page }) => {
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
   await expect(sheet.getByRole('button', { name: 'Remove Alex' })).toBeVisible()
-  await sheet.getByRole('button', { name: 'Save', exact: true }).click()
+  await sheetSave(sheet).click()
   await expect(sheet).toBeHidden()
   await expect(page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ })).toBeVisible()
 })
@@ -75,7 +75,7 @@ test('the meetup just logged scrolls clear of its toast and opens with one tap',
   await friendLink(page, 'Alex').click()
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
-  await sheet.getByRole('button', { name: 'Save', exact: true }).click()
+  await sheetSave(sheet).click()
   await expect(sheet).toBeHidden()
   const toast = page.getByRole('status')
   await expect(toast).toContainText('Logged with Alex')
@@ -105,7 +105,7 @@ test('at large text, the meetup just logged scrolls clear of a toast that wraps,
   await friendLink(page, name).click()
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
-  await sheet.getByRole('button', { name: 'Save', exact: true }).click()
+  await sheetSave(sheet).click()
   await expect(sheet).toBeHidden()
   const toast = page.getByRole('status')
   await expect(toast).toContainText(`Logged with ${name}`)
@@ -135,7 +135,7 @@ test('at large text, the room for a toast that wrapped stays after it goes, unti
   await friendLink(page, name).click()
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
-  await sheet.getByRole('button', { name: 'Save', exact: true }).click()
+  await sheetSave(sheet).click()
   await expect(sheet).toBeHidden()
   const toast = page.getByRole('status')
   await expect(toast).toContainText(`Logged with ${name}`)
@@ -172,7 +172,7 @@ test('edits a meetup from its page, then deletes it with undo', async ({ page })
   await page.getByRole('button', { name: 'Edit', exact: true }).click()
   const editSheet = page.getByRole('dialog', { name: 'Edit meetup' })
   await editSheet.getByRole('button', { name: 'Drinks', exact: true }).click()
-  await editSheet.getByRole('button', { name: 'Save', exact: true }).click()
+  await sheetSave(editSheet).click()
   await expect(editSheet).toBeHidden()
   await expect(page.getByRole('heading', { level: 1, name: 'Drinks' })).toBeVisible()
 
@@ -193,7 +193,7 @@ test('edits and deletes a friend', async ({ page }) => {
   await page.getByRole('button', { name: 'Edit', exact: true }).click()
   const sheet = page.getByRole('dialog', { name: 'Edit friend' })
   await sheet.getByLabel('Name', { exact: true }).fill('Alexandra')
-  await sheet.getByRole('button', { name: 'Save', exact: true }).click()
+  await sheetSave(sheet).click()
   await expect(sheet).toBeHidden()
   await expect(page.getByRole('heading', { level: 1, name: 'Alexandra' })).toBeVisible()
 
```

In `e2e/history.spec.ts`:

```diff
--- a/e2e/history.spec.ts
+++ b/e2e/history.spec.ts
@@ -10,6 +10,7 @@ import {
   photoRow,
   seedAppLock,
   seedMeetups,
+  sheetSave,
 } from './helpers.ts'
 
 /** Mon, Oct 5, 2026, 12:00 PM on the phone's clock. */
@@ -355,7 +356,7 @@ test('a meetup opened from Meetups goes back to the same search', async ({ page
   await page.getByRole('button', { name: 'Edit', exact: true }).click()
   const sheet = page.getByRole('dialog', { name: 'Edit meetup' })
   await sheet.getByRole('button', { name: 'Drinks', exact: true }).click()
-  await sheet.getByRole('button', { name: 'Save', exact: true }).click()
+  await sheetSave(sheet).click()
   await expect(sheet).toBeHidden()
   await expect(page.getByRole('heading', { level: 1, name: 'Drinks' })).toBeVisible()
 
```

In `e2e/memories.spec.ts`:

```diff
--- a/e2e/memories.spec.ts
+++ b/e2e/memories.spec.ts
@@ -13,6 +13,7 @@ import {
   photoGrid,
   pickActivity,
   readMeetupPhotos,
+  sheetSave,
   tinyPhoto,
 } from './helpers.ts'
 
@@ -31,7 +32,7 @@ test('logs a meetup with activities, one of them new, and two photos', async ({
   await expect(activities.getByRole('button', { name: 'New activity' })).toBeFocused()
   await addPhotos(sheet, [tinyPhoto('one.png'), tinyPhoto('two.png')])
   await expect(photoGrid(sheet).getByRole('img', { name: 'Photo 2' })).toHaveAttribute('src', /^data:image\/jpeg/)
-  await sheet.getByRole('button', { name: 'Save', exact: true }).click()
+  await sheetSave(sheet).click()
   await expect(sheet).toBeHidden()
 
   await openFriendPage(page, 'Alex')
@@ -139,7 +140,7 @@ test('Save removes a photo', async ({ page }) => {
   await openFriendPage(page, 'Alex')
   let sheet = await editMeetup(page, /Coffee/)
   await photoGrid(sheet).getByRole('button', { name: 'Remove photo 2' }).click()
-  await sheet.getByRole('button', { name: 'Save', exact: true }).click()
+  await sheetSave(sheet).click()
   await expect(sheet).toBeHidden()
 
   await openFriendPage(page, 'Alex')
```

In `e2e/screenshots.spec.ts`:

```diff
--- a/e2e/screenshots.spec.ts
+++ b/e2e/screenshots.spec.ts
@@ -13,6 +13,7 @@ import {
   reopenAfterAWhile,
   seedAppLock,
   setBirthday,
+  sheetSave,
   stubFaceId,
   stubPush,
 } from './helpers.ts'
@@ -74,7 +75,7 @@ async function seed(page: Page) {
   await page.getByRole('region', { name: 'Birthday', exact: true }).getByRole('button', { name: 'Add birthday' }).click()
   const sheet = page.getByRole('dialog', { name: 'Edit friend' })
   await setBirthday(sheet, { ...inForty, year: inForty.year - 32 })
-  await sheet.getByRole('button', { name: 'Save' }).click()
+  await sheetSave(sheet).click()
   await expect(sheet).toBeHidden()
   await addToList(page, 'Likes', 'Ramen, Board games, Hiking')
   // Long enough to show an item wrapping inside its chip.
```

- [ ] **Step 5: Run them to see them fail**

Run: `npx playwright test --project=iphone e2e/meetups.spec.ts e2e/friends.spec.ts e2e/sheetKeyboard.spec.ts e2e/day.spec.ts -g "top right|quick log|home indicator"`
Expected: `6 failed` (no Save in the header yet, and the footer still there).

- [ ] **Step 6: Give the sheet a trailing action**

In `src/components/Sheet.tsx`:

```diff
--- a/src/components/Sheet.tsx
+++ b/src/components/Sheet.tsx
@@ -9,15 +9,25 @@ const EXIT_MS = 260
 const DISMISS_DISTANCE = 120
 const DISMISS_VELOCITY = 0.6 // px per ms
 
+/** The header's trailing text button, such as Save. */
+export interface SheetAction {
+  label: string
+  onClick: () => void
+  /** Dimmed and unpressable (VoiceOver reads it as dimmed). */
+  disabled?: boolean
+}
+
 interface SheetProps {
   open: boolean
   title: string
   onRequestClose: () => void | Promise<void>
+  /** On the right of the header, across from Cancel, as iOS sheets put Save. */
+  action?: SheetAction
   footer?: ReactNode
   children: ReactNode
 }
 
-export function Sheet({ open, title, onRequestClose, footer, children }: SheetProps) {
+export function Sheet({ open, title, onRequestClose, action, footer, children }: SheetProps) {
   const [mounted, setMounted] = useState(open)
   if (open && !mounted) setMounted(true)
   const closing = mounted && !open
@@ -111,16 +121,36 @@ export function Sheet({ open, title, onRequestClose, footer, children }: SheetPr
           onPointerCancel={onPointerCancel}
         >
           <span className="sheet__grabber" aria-hidden="true" />
+          {/* Each side holds its button over an invisible copy of the other side's label, so both sides are as
+              wide as the wider one: the title stays centered and can wrap at large text sizes. */}
           <div className="sheet__bar">
-            <button type="button" className="text-button sheet__cancel" onClick={() => void onRequestClose()}>
-              Cancel
-            </button>
+            <span className="sheet__side">
+              <button type="button" className="text-button sheet__cancel" onClick={() => void onRequestClose()}>
+                Cancel
+              </button>
+              {action && (
+                <span className="text-button sheet__action sheet__ghost" aria-hidden="true">
+                  {action.label}
+                </span>
+              )}
+            </span>
             <h2 id={titleId} className="sheet__title">
               {title}
             </h2>
-            {/* As wide as Cancel, so the title stays centered and can wrap at large text sizes. */}
-            <span className="text-button sheet__spacer" aria-hidden="true">
-              Cancel
+            <span className="sheet__side sheet__side--end">
+              {action && (
+                <button
+                  type="button"
+                  className="text-button sheet__action"
+                  onClick={action.onClick}
+                  disabled={action.disabled}
+                >
+                  {action.label}
+                </button>
+              )}
+              <span className="text-button sheet__ghost" aria-hidden="true">
+                Cancel
+              </span>
             </span>
           </div>
         </div>
```

In `src/components/Sheet.css`:

```diff
--- a/src/components/Sheet.css
+++ b/src/components/Sheet.css
@@ -62,13 +62,29 @@
   align-items: center;
   padding: 0 var(--space-2);
 }
-.sheet__cancel {
-  justify-self: start;
+/* A side stacks its button and the invisible copy of the other side's label in one cell. */
+.sheet__side {
+  display: grid;
+  justify-items: start;
+}
+.sheet__side--end {
+  justify-items: end;
 }
-.sheet__spacer {
+.sheet__side > * {
+  grid-area: 1 / 1;
+}
+.sheet__ghost {
   visibility: hidden;
   pointer-events: none;
 }
+/* Save: a Terracotta Ink text button in the header's trailing slot. */
+.sheet__action {
+  font-weight: 600;
+}
+.sheet__action:disabled {
+  opacity: 0.45;
+  cursor: default;
+}
 .sheet__title {
   margin: 0;
   font-size: var(--text-body);
@@ -86,12 +102,16 @@
   gap: var(--space-6);
   padding: var(--space-3) var(--space-4) var(--space-6);
 }
-/* Without a footer the body is the bottom of the sheet: keep its last row out of the home indicator. */
+/* Without a footer the body is the bottom of the sheet: keep its last row out of the home indicator. The keyboard
+   covers the home indicator, so while it's up the body needs no room for it. */
 .sheet__body:last-child {
   padding-bottom: calc(var(--space-6) + var(--safe-bottom));
 }
+.keyboard-open .sheet__body:last-child {
+  padding-bottom: var(--space-6);
+}
 /* The browser's own scrolling to a focused field leaves the same room as the app's (useRevealFocusedField),
-   so a field it brings up from under the Save bar doesn't end flush against it. */
+   so a field it brings up from under the keyboard doesn't end flush against it. */
 .sheet__body :is(input, textarea, select) {
   scroll-margin-block: var(--space-3);
 }
```

- [ ] **Step 7: Move Save to the header in the meetup and friend sheets**

The meetup sheet loses its footer: errors go to the top of the body (and scroll into view), and "Save and write about the day" becomes a Secondary block button at the end of the Log sheet's body.

In `src/sheets/MeetupSheet.tsx`:

```diff
--- a/src/sheets/MeetupSheet.tsx
+++ b/src/sheets/MeetupSheet.tsx
@@ -73,6 +73,7 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
   const [saving, setSaving] = useState(false)
   const savingRef = useRef(false)
   const searchRef = useRef<HTMLInputElement>(null)
+  const errorRef = useRef<HTMLParagraphElement>(null)
 
   // Photos change only in the sheet until Save. A saved meetup's photos load once, as ids and thumbnails.
   const storedPhotos = useMeetupPhotoThumbs(editing?.id)
@@ -92,6 +93,10 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
     }
   }, [request])
   const suggestions = useMemo(() => activitySuggestions(meetups ?? []), [meetups])
+  // Errors show at the top of the sheet, which may be scrolled away: bring one into view as it appears.
+  useEffect(() => {
+    if (error) errorRef.current?.scrollIntoView({ block: 'nearest' })
+  }, [error])
 
   const effectiveTypeId = typeId ?? types?.[0]?.id ?? null
   const yesterday = addDays(today, -1)
@@ -225,35 +230,14 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
       open={request !== null}
       title={editing ? 'Edit meetup' : 'Log meetup'}
       onRequestClose={requestClose}
-      footer={
-        <>
-          {error && (
-            <p className="field-error" role="alert">
-              {error}
-            </p>
-          )}
-          {/* Never hidden for a missing friend (only while the keyboard is up), so Save never moves. */}
-          {!editing && (
-            <button
-              type="button"
-              className="text-button meetup-sheet__write"
-              onClick={() => void save(true)}
-              disabled={saveDisabled}
-            >
-              Save and write about the day
-            </button>
-          )}
-          <button
-            type="button"
-            className="button button--primary button--block"
-            onClick={() => void save()}
-            disabled={saveDisabled}
-          >
-            {friendIds.length === 0 ? 'Pick a friend' : 'Save'}
-          </button>
-        </>
-      }
+      action={{ label: 'Save', onClick: () => void save(), disabled: saveDisabled }}
     >
+      {error && (
+        <p ref={errorRef} className="field-error" role="alert">
+          {error}
+        </p>
+      )}
+
       <section className="form-section" aria-labelledby={whoId}>
         <h3 id={whoId} className="form-section__label">
           Who
@@ -418,6 +402,18 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
         />
       )}
 
+      {/* Log meetup only: dimmed whenever Save is. */}
+      {!editing && (
+        <button
+          type="button"
+          className="button button--secondary button--block"
+          onClick={() => void save(true)}
+          disabled={saveDisabled}
+        >
+          Save and write about the day
+        </button>
+      )}
+
       {editing && (
         <InsetGroup>
           <Row title="Delete meetup" destructive onClick={remove} />
```

In `src/sheets/MeetupSheet.css`:

```diff
--- a/src/sheets/MeetupSheet.css
+++ b/src/sheets/MeetupSheet.css
@@ -83,20 +83,6 @@
   cursor: pointer;
 }
 
-/* "Save and write about the day": a centered text button above Save, in Log meetup only. It's dimmed whenever
-   Save is, and hidden only while the keyboard is up, so the friend search keeps its room and Save stays put. */
-.meetup-sheet__write {
-  align-self: center;
-  font-weight: 600;
-}
-.meetup-sheet__write:disabled {
-  opacity: 0.45;
-  cursor: default;
-}
-.keyboard-open .meetup-sheet__write {
-  display: none;
-}
-
 /* "+ New" activity: the field and its Add button on their own line under the chips. */
 .activity-new {
   display: flex;
```

In `src/sheets/FriendSheet.tsx`:

```diff
--- a/src/sheets/FriendSheet.tsx
+++ b/src/sheets/FriendSheet.tsx
@@ -180,11 +180,7 @@ export function FriendSheet({ request, onClose }: FriendSheetProps) {
       open={request !== null}
       title={editing ? 'Edit friend' : 'New friend'}
       onRequestClose={requestClose}
-      footer={
-        <button type="button" className="button button--primary button--block" onClick={save} disabled={saving || processingPhoto}>
-          Save
-        </button>
-      }
+      action={{ label: 'Save', onClick: () => void save(), disabled: saving || processingPhoto }}
     >
       <div className="friend-form__photo">
         <button
```

In `src/sheets/BirthdayField.tsx`:

```diff
--- a/src/sheets/BirthdayField.tsx
+++ b/src/sheets/BirthdayField.tsx
@@ -25,7 +25,8 @@ export function BirthdayField({ value, error, today, rowRef, onChange }: Birthda
   const errorRef = useRef<HTMLParagraphElement>(null)
   const isSet = value.month !== null || value.day !== null || value.year !== null
 
-  // At large text sizes the error can sit under the sheet's Save footer; bring it into view.
+  // At large text sizes the error can sit below the visible part of the sheet (or under the keyboard); bring it
+  // into view.
   useEffect(() => {
     if (error) errorRef.current?.scrollIntoView({ block: 'nearest' })
   }, [error])
```

- [ ] **Step 8: Run them to see them pass**

Run: the command from Step 5
Expected: `6 passed`.

- [ ] **Step 9: Run everything**

Run: `npx tsc -b`, then `npm test`
Expected: `Test Files  58 passed (58)` and `Tests  713 passed (713)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `175 passed`.

- [ ] **Step 10: Commit**

```bash
git add docs/superpowers/specs/2026-10-21-sheet-details-design.md e2e/birthdays.spec.ts e2e/day.spec.ts e2e/detail.spec.ts e2e/friends.spec.ts e2e/helpers.ts e2e/history.spec.ts e2e/meetups.spec.ts e2e/memories.spec.ts e2e/screenshots.spec.ts e2e/sheetKeyboard.spec.ts src/components/Sheet.css src/components/Sheet.tsx src/sheets/BirthdayField.tsx src/sheets/FriendSheet.tsx src/sheets/MeetupSheet.css src/sheets/MeetupSheet.tsx
git commit -F - <<'EOF'
feat: Save sits at the top right of the meetup and friend sheets, with no footer

The sheet header takes an optional trailing action. Each side holds its button
over an invisible copy of the other side's label, so the title stays centered
and still wraps at large text sizes. The Log and Edit meetup sheets and the
friend sheet put Save there and drop their footers. Save is dimmed until a
friend is picked (no "Pick a friend" anywhere, as the owner asked), errors show
at the top of the body, and "Save and write about the day" is a full-width
secondary button at the end of the Log sheet's body. Without a footer, the
body keeps its end clear of the home indicator until the keyboard covers it.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: The day box in the Log and Edit meetup sheets

**Files:**
- Modify: `src/db/meetups.ts`, `src/sheets/MeetupSheet.tsx`
- Create: `e2e/sheetDetails.spec.ts`
- Test: `src/db/meetups.test.ts`

- [ ] **Step 1: Write the failing data tests**

A new meetup keeps the typed day exactly but for line breaks; an Edit save that gives `note` writes it and leaves the rest of the day alone; a failed photo write rolls the note back.

In `src/db/meetups.test.ts`:

```diff
--- a/src/db/meetups.test.ts
+++ b/src/db/meetups.test.ts
@@ -142,6 +142,26 @@ describe('the day', () => {
     })
   })
 
+  it('is saved with a new meetup from the sheet, exactly as typed but for line breaks', async () => {
+    const meetup = await addMeetup({ ...base, note: '@Blue willow 3:30  \r\nJessie paid  ' })
+    expect(meetup.note).toBe('@Blue willow 3:30  \nJessie paid  ')
+    expect(await db.meetups.get(meetup.id)).toMatchObject({ note: '@Blue willow 3:30  \nJessie paid  ', mood: null })
+  })
+
+  it('is written by an Edit meetup save that gives it, and the rest of the day is left alone', async () => {
+    const meetup = await addMeetup(base)
+    await updateDay(meetup.id, day)
+    await updateMeetup(meetup.id, { ...base, date: '2026-09-05', note: 'Tacos\r\nThen karaoke ' })
+    expect(await db.meetups.get(meetup.id)).toMatchObject({ ...day, date: '2026-09-05', note: 'Tacos\nThen karaoke ' })
+  })
+
+  it('rolls back with the meetup when a photo write fails', async () => {
+    const meetup = await addMeetup({ ...base, note: 'Before' }, { add: [newPhoto('a')], removeIds: [], order: [] })
+    const sameIdAgain = { add: [newPhoto('a')], removeIds: [], order: [] }
+    await expect(updateMeetup(meetup.id, { ...base, note: 'After' }, sameIdAgain)).rejects.toThrow()
+    expect((await db.meetups.get(meetup.id))?.note).toBe('Before')
+  })
+
   it('is kept by delete and Undo', async () => {
     const alex = await addFriend(friendInput('Alex'))
     const meetup = await addMeetup({ ...base, friendIds: [alex.id] })
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/db/meetups.test.ts`
Expected: `3 failed | 46 passed`.

- [ ] **Step 3: Take `note` in `MeetupInput`**

In `src/db/meetups.ts`:

```diff
--- a/src/db/meetups.ts
+++ b/src/db/meetups.ts
@@ -16,6 +16,11 @@ export interface MeetupInput {
   friendIds: string[]
   /** In the order picked. Cleaned like likes: empties and repeats are dropped. */
   activities: string[]
+  /**
+   * The day, as typed in the sheet's The day box: kept exactly as typed but for line breaks, like the day page
+   * keeps it. Left out, a new meetup starts with an empty day and an edit leaves the stored day alone.
+   */
+  note?: string
 }
 
 /** The day page's fields. Only the fields given are written. */
@@ -55,7 +60,9 @@ function clean(input: MeetupInput): MeetupInput {
   const activities = cleanItems(input.activities)
   const problem = activitiesProblem(activities)
   if (problem) throw new ValidationError(problem)
-  return { date: input.date, typeId: input.typeId, friendIds, activities }
+  const cleaned: MeetupInput = { date: input.date, typeId: input.typeId, friendIds, activities }
+  if (input.note !== undefined) cleaned.note = normalizeLineBreaks(input.note)
+  return cleaned
 }
 
 /**
@@ -123,10 +130,11 @@ async function applyPhotoChanges(meetupId: string, changes: PhotoChanges, create
 }
 
 export async function addMeetup(input: MeetupInput, photos: PhotoChanges = NO_PHOTO_CHANGES): Promise<Meetup> {
+  const { note = '', ...fields } = clean(input)
   const meetup: Meetup = {
     id: newId(),
-    ...clean(input),
-    note: '',
+    ...fields,
+    note,
     weather: [],
     mood: null,
     feelings: '',
@@ -141,15 +149,17 @@ export async function addMeetup(input: MeetupInput, photos: PhotoChanges = NO_PH
 }
 
 /**
- * Saves the sheet's fields and photo changes. It never reads or writes the day's fields, so an Edit
- * meetup save can't overwrite a day being written on the day page.
+ * Saves the sheet's fields and photo changes, in one transaction. Of the day's fields it writes only the note, and
+ * only when it's given (the sheet gives it when its The day box changed), so an Edit meetup save can't overwrite a
+ * day being written on the day page.
  */
 export async function updateMeetup(id: string, input: MeetupInput, photos: PhotoChanges = NO_PHOTO_CHANGES): Promise<void> {
-  const { date, typeId, friendIds, activities } = clean(input)
+  const fields = clean(input)
   checkPhotos(photos)
   await db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
     if (!(await db.meetups.get(id))) throw new ValidationError('This meetup no longer exists.')
-    await db.meetups.update(id, { date, typeId, friendIds, activities })
+    // A plain copy: Dexie's update type takes an object literal's type, not the MeetupInput interface.
+    await db.meetups.update(id, { ...fields })
     await applyPhotoChanges(id, photos, new Date().toISOString())
   })
   forgetThumbs(photos.removeIds)
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/db/meetups.test.ts`
Expected: `49 passed`.

- [ ] **Step 5: Write the failing sheet tests**

Log with "@Blue willow 3:30" typed in the sheet (the place shows on the Meetup page), "Save and write about the day" carrying the words to the day page, Edit starting with the day and saving a change, and Cancel asking before discarding typed words.

Create `e2e/sheetDetails.spec.ts`:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, editMeetup, logMeetup, openDay, openFriendPage, readMeetups, sheetSave } from './helpers.ts'

// Most tests add a friend and log a meetup first, so they get more time than most.
test.describe.configure({ timeout: 60_000 })

/** In an open meetup sheet: The day box. */
function sheetDay(sheet: Locator): Locator {
  return sheet.getByRole('textbox', { name: 'The day' })
}

async function openLogMeetup(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await expect(sheet).toBeVisible()
  return sheet
}

test.describe('The day in the meetup sheets', () => {
  test('logs a meetup with The day typed in the sheet, and its place shows on the Meetup page', async ({ page }) => {
    await page.goto('/')
    await addFriend(page, 'Mariya')
    const sheet = await openLogMeetup(page)
    await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Mariya' }).click()
    await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
    const day = sheetDay(sheet)
    await expect(day).toHaveAttribute('placeholder', 'What happened? Start a line with @ for a place.')
    await expect(day).toHaveAccessibleDescription('Lines that start with @ show as places.')
    // Spaces at the end are kept exactly as typed, as the day page keeps them.
    await day.fill('@Blue willow 3:30\nKung pao chicken  ')
    await sheetSave(sheet).click()
    await expect(sheet).toBeHidden()
    expect((await readMeetups(page))[0].note).toBe('@Blue willow 3:30\nKung pao chicken  ')

    await openFriendPage(page, 'Mariya')
    await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
    const places = page.getByRole('region', { name: 'The day' }).getByRole('list', { name: 'Places, 1 stop' })
    await expect(places.getByRole('heading', { level: 3 })).toHaveText(['Blue willow'])
    await expect(places.locator('.day-stop__time')).toHaveText(['3:30 PM'])
  })

  test('"Save and write about the day" takes the words typed in the sheet to the day page', async ({ page }) => {
    await page.goto('/')
    await addFriend(page, 'Alex')
    const sheet = await openLogMeetup(page)
    await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
    await sheetDay(sheet).fill('@Cafe 10:30')
    await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'The day' })).toHaveValue('@Cafe 10:30')
  })

  test('the Edit meetup sheet starts with the day and saves a change, which the day page shows', async ({ page }) => {
    await page.goto('/')
    await addFriend(page, 'Alex')
    await logMeetup(page, ['Alex'], { note: 'Tacos' })
    await openFriendPage(page, 'Alex')
    let sheet = await editMeetup(page, /Coffee/)
    await expect(sheetDay(sheet)).toHaveValue('Tacos')
    // Unchanged, it closes without asking.
    await sheet.getByRole('button', { name: 'Cancel' }).click()
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('alertdialog')).toHaveCount(0)

    await page.getByRole('button', { name: 'Edit', exact: true }).click()
    sheet = page.getByRole('dialog', { name: 'Edit meetup' })
    await sheetDay(sheet).fill('Tacos\n@Blue willow 3:30')
    await sheetSave(sheet).click()
    await expect(sheet).toBeHidden()
    await openDay(page)
    await expect(page.getByRole('textbox', { name: 'The day' })).toHaveValue('Tacos\n@Blue willow 3:30')
  })

  test('Cancel with words typed in The day asks before throwing them away', async ({ page }) => {
    await page.goto('/')
    await addFriend(page, 'Alex')
    const sheet = await openLogMeetup(page)
    // Only the box changes, so it alone makes the sheet ask.
    await sheetDay(sheet).fill('A line I might keep')
    await sheet.getByRole('button', { name: 'Cancel' }).click()
    const confirm = page.getByRole('alertdialog')
    await expect(confirm).toContainText('Discard changes?')
    await confirm.getByRole('button', { name: 'Cancel' }).click()
    await expect(sheetDay(sheet)).toHaveValue('A line I might keep')

    await sheet.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
    await expect(sheet).toBeHidden()
    expect(await readMeetups(page)).toHaveLength(0)
  })
})
```

- [ ] **Step 6: Run them to see them fail**

Run: `npx playwright test --project=iphone e2e/sheetDetails.spec.ts`
Expected: `4 failed`.

- [ ] **Step 7: Add the box to the sheet**

It goes after Photos for now (Task 7 moves it right after When). Log always gives the box's words; Edit gives them only when they changed.

In `src/sheets/MeetupSheet.tsx`:

```diff
--- a/src/sheets/MeetupSheet.tsx
+++ b/src/sheets/MeetupSheet.tsx
@@ -3,6 +3,7 @@ import { useLocation, useNavigate } from 'react-router'
 import { useConfirmDiscard } from '../components/ActionSheet'
 import { Avatar } from '../components/Avatar'
 import { Chip } from '../components/Chip'
+import { GrowField } from '../components/GrowField'
 import { IconCalendar, IconCheck, IconClose, IconSearch } from '../components/icons'
 import { InsetGroup, Row } from '../components/InsetGroup'
 import type { NavState } from '../components/Page'
@@ -16,11 +17,13 @@ import {
   NO_PHOTO_CHANGES,
   restoreMeetup,
   updateMeetup,
+  type MeetupInput,
   type PhotoChanges,
 } from '../db/meetups'
 import { useToday } from '../hooks/useToday'
 import { activitySuggestions } from '../lib/activities'
 import { addDays, formatDate, isISODate, todayISO } from '../lib/dates'
+import { DAY_MAX_TYPED } from '../lib/dayText'
 import { isPlainEnter } from '../lib/keys'
 import { askToKeepData } from '../lib/persist'
 import { compareNames, formatNameList } from '../lib/text'
@@ -56,18 +59,22 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
   const whoId = useId()
   const whatId = useId()
   const whenId = useId()
+  const dayId = useId()
+  const dayHintId = useId()
 
   const [start] = useState(() => ({
     friendIds: editing?.friendIds ?? (initial?.presetFriendId ? [initial.presetFriendId] : []),
     typeId: editing?.typeId ?? null,
     date: editing?.date ?? todayISO(),
     activities: editing?.activities ?? [],
+    note: editing?.note ?? '',
   }))
   const [friendIds, setFriendIds] = useState<string[]>(start.friendIds)
   const [typeId, setTypeId] = useState<string | null>(start.typeId)
   const [date, setDate] = useState(start.date)
   const [activities, setActivities] = useState<string[]>(start.activities)
   const [activityDraft, setActivityDraft] = useState<string | null>(null)
+  const [note, setNote] = useState(start.note)
   const [query, setQuery] = useState('')
   const [error, setError] = useState<string | null>(null)
   const [saving, setSaving] = useState(false)
@@ -125,6 +132,7 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
     date !== start.date ||
     activities.join('\n') !== start.activities.join('\n') ||
     !!activityDraft?.trim() ||
+    note !== start.note ||
     (photos !== null && photos.map((photo) => photo.id).join() !== startPhotoIds.join())
 
   function toggleFriend(id: string) {
@@ -150,7 +158,9 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
     try {
       // An activity typed into "+ New" but not added yet is saved too.
       const typed = activityDraft?.trim() ? [...activities, activityDraft] : activities
-      const input = { date, typeId: effectiveTypeId, friendIds, activities: typed }
+      const input: MeetupInput = { date, typeId: effectiveTypeId, friendIds, activities: typed }
+      // An edit writes The day only when it changed, so it can't overwrite a day written elsewhere since it opened.
+      if (!editing || note !== start.note) input.note = note
       const unchanged =
         !photos ||
         (photos.every((photo) => !photo.added) &&
@@ -402,6 +412,30 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
         />
       )}
 
+      <section className="form-section" aria-labelledby={dayId}>
+        <h3 id={dayId} className="form-section__label">
+          The day
+        </h3>
+        <GrowField
+          minLines={4}
+          aria-labelledby={dayId}
+          aria-describedby={dayHintId}
+          value={note}
+          placeholder="What happened? Start a line with @ for a place."
+          autoCapitalize="sentences"
+          autoCorrect="on"
+          spellCheck
+          maxLength={DAY_MAX_TYPED}
+          onChange={(event) => {
+            setNote(event.target.value)
+            setError(null)
+          }}
+        />
+        <p id={dayHintId} className="field-hint">
+          Lines that start with @ show as places.
+        </p>
+      </section>
+
       {/* Log meetup only: dimmed whenever Save is. */}
       {!editing && (
         <button
```

- [ ] **Step 8: Run them to see them pass**

Run: `npx playwright test --project=iphone e2e/sheetDetails.spec.ts`
Expected: `4 passed`.

- [ ] **Step 9: Run everything**

Run: `npx tsc -b`, then `npm test`
Expected: `Test Files  58 passed (58)` and `Tests  716 passed (716)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `179 passed`. (Seen once while building: `memories.spec.ts` "Cancel discards photo changes" stalled on a click under load; it passed alone and five times in a row.)

- [ ] **Step 10: Commit**

```bash
git add e2e/sheetDetails.spec.ts src/db/meetups.test.ts src/db/meetups.ts src/sheets/MeetupSheet.tsx
git commit -F - <<'EOF'
feat: write The day right in the Log and Edit meetup sheets

A "The day" box after Photos edits the meetup's note, the same text the day
page edits, with the hint "Lines that start with @ show as places." It saves
with the meetup in the same transaction: MeetupInput takes an optional note,
kept exactly as typed but for line breaks. A new meetup takes the box's words;
an edit writes them only when they changed, so it can't overwrite a day
written elsewhere since the sheet opened. Typed words count as changes, so
Cancel asks before discarding them.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: The place tint in The day boxes

**Files:**
- Create: `src/lib/dayHighlight.ts`, `src/lib/dayHighlight.test.ts`
- Modify: `src/lib/dayText.ts`, `src/components/GrowField.tsx`, `src/components/GrowField.css`, `src/screens/DayScreen.tsx`, `src/sheets/MeetupSheet.tsx`
- Test: `src/lib/dayText.test.ts`, `e2e/sheetDetails.spec.ts`

- [ ] **Step 1: Write the failing tests for the predicate and the runs**

The predicate must agree with `readDay` on every line of both golden fixtures:

In `src/lib/dayText.test.ts`:

```diff
--- a/src/lib/dayText.test.ts
+++ b/src/lib/dayText.test.ts
@@ -10,6 +10,7 @@ import {
   type DayTime,
   FEELINGS_MAX,
   isDayEmpty,
+  isPlaceLine,
   normalizeLineBreaks,
   readDay,
   TOO_LONG_FEELINGS,
@@ -194,6 +195,38 @@ describe('place lines', () => {
   })
 })
 
+describe('isPlaceLine', () => {
+  /** The stops readDay makes from one line read on its own. */
+  const stopsFrom = (line: string) => readDay(line).flatMap((part) => (part.kind === 'timeline' ? part.stops : []))
+
+  it.each([
+    ['A', OWNER_DAY_TYPED],
+    ['B', OWNER_MESSAGE],
+  ])('is true for a line of golden fixture %s exactly when the grammar makes a stop from it', (_, note) => {
+    for (const line of note.split('\n')) expect(isPlaceLine(line), line).toBe(stopsFrom(line).length === 1)
+  })
+
+  it.each([
+    ['A', OWNER_DAY_TYPED, 8],
+    ['B', OWNER_MESSAGE, 8],
+  ])('finds as many place lines in golden fixture %s as readDay makes stops', (_, note, stops) => {
+    expect(note.split('\n').filter(isPlaceLine)).toHaveLength(stops)
+    expect(readDay(note).flatMap((part) => (part.kind === 'timeline' ? part.stops : []))).toHaveLength(stops)
+  })
+
+  it('reads "@ some place" and a place with a time as places, with spaces around them', () => {
+    for (const line of ['@ some place', '@Blue willow 3:30', '  @Cafe ', '@Blue willow 3:30, ', '@Bar 25:00']) {
+      expect(isPlaceLine(line), line).toBe(true)
+    }
+  })
+
+  it('never reads "@" alone, a time alone or an "@" after the start of a line as a place', () => {
+    for (const line of ['@', ' @ ', '@ 3:30', 'Then walked to dinner @seoulsaloon', '', 'Jessie paid', 'Plan:']) {
+      expect(isPlaceLine(line), line).toBe(false)
+    }
+  })
+})
+
 describe('paid lines', () => {
   it('reads one to three words before "paid" as who paid', () => {
     expect(readDay('Jessie paid\nI paid\nJessie paid for dinner\nMary Ann Lee paid.\nSam paid!')).toEqual([
```

Create `src/lib/dayHighlight.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { OWNER_DAY_TYPED, OWNER_MESSAGE } from '../test/dayFixtures'
import { placeRuns, type TextRun } from './dayHighlight'

const plain = (text: string): TextRun => ({ text, place: false })
const place = (text: string): TextRun => ({ text, place: true })

describe('placeRuns', () => {
  it('gives nothing for an empty box, and one plain run for text without places', () => {
    expect(placeRuns('')).toEqual([])
    expect(placeRuns('Tacos\nThen karaoke')).toEqual([plain('Tacos\nThen karaoke')])
  })

  it('marks each place line, with the line breaks and the lines between in plain runs', () => {
    expect(placeRuns('Rainy\n@Cafe 10:30\nCoffee\n@Park')).toEqual([
      plain('Rainy\n'),
      place('@Cafe 10:30'),
      plain('\nCoffee\n'),
      place('@Park'),
    ])
  })

  it('keeps two place lines in a row apart', () => {
    expect(placeRuns('@A\n@B')).toEqual([place('@A'), plain('\n'), place('@B')])
  })

  it('marks only the words of a place line, never the spaces around them', () => {
    expect(placeRuns('  @Blue willow 3:30, ')).toEqual([plain('  '), place('@Blue willow 3:30,'), plain(' ')])
  })

  it('keeps a line break at the end, and an empty last line after it', () => {
    expect(placeRuns('@Cafe\n')).toEqual([place('@Cafe'), plain('\n')])
    expect(placeRuns('@Cafe\n\n')).toEqual([place('@Cafe'), plain('\n\n')])
    expect(placeRuns('\n@Cafe')).toEqual([plain('\n'), place('@Cafe')])
  })

  it('leaves "@" alone, a time alone and an "@" mid-sentence plain', () => {
    const text = '@\n@ 3:30\nThen walked to dinner @seoulsaloon'
    expect(placeRuns(text)).toEqual([plain(text)])
  })

  it('keeps \\r\\n line breaks from a backup as they are', () => {
    expect(placeRuns('@Cafe\r\nCoffee\r@Park')).toEqual([place('@Cafe'), plain('\r\nCoffee\r'), place('@Park')])
  })

  it.each([
    ['A', OWNER_DAY_TYPED],
    ['B', OWNER_MESSAGE],
  ])('gives back golden fixture %s exactly, with its 8 places marked', (_, note) => {
    const runs = placeRuns(note)
    expect(runs.map((run) => run.text).join('')).toBe(note)
    expect(runs.filter((run) => run.place)).toHaveLength(8)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/dayText.test.ts src/lib/dayHighlight.test.ts`
Expected: the `isPlaceLine` tests fail and `dayHighlight.test.ts` can't find its module.

- [ ] **Step 3: Export `isPlaceLine` and write `placeRuns`**

In `src/lib/dayText.ts`:

```diff
--- a/src/lib/dayText.ts
+++ b/src/lib/dayText.ts
@@ -122,6 +122,15 @@ function readPlaceLine(line: string): PlaceLine | 'skip' | null {
   return place === '' ? null : { place, start, end }
 }
 
+/**
+ * Whether a line, read on its own, is a place line: one readDay makes a stop of. Spaces around it don't count;
+ * "@" alone, "@ 3:30" and an "@" after the start of a line aren't places. The day boxes tint these lines.
+ */
+export function isPlaceLine(line: string): boolean {
+  const place = readPlaceLine(line.trim())
+  return place !== null && place !== 'skip'
+}
+
 function minutesOf(hour: number, minute: number, half: 'am' | 'pm'): number {
   return (hour % 12) * 60 + minute + (half === 'pm' ? NOON : 0)
 }
```

Create `src/lib/dayHighlight.ts`:

```ts
import { isPlaceLine } from './dayText'

/** A stretch of a day's text: a place line's words, or everything between them. */
export interface TextRun {
  text: string
  place: boolean
}

/** A line break as readDay splits on it, kept in the pieces (a backup's "\r\n" stays as it is). */
const LINE_BREAK = /(\r\n?|\n)/

/**
 * A day's text cut into runs for The day boxes' place tint: each place line's words (isPlaceLine) in a run of
 * their own, and everything else, line breaks and the spaces around a place included, in plain runs between.
 * Joined back together, the runs are the text exactly.
 */
export function placeRuns(text: string): TextRun[] {
  const runs: TextRun[] = []
  const add = (part: string, place: boolean) => {
    if (part === '') return
    const last = runs.at(-1)
    if (last && !last.place && !place) last.text += part
    else runs.push({ text: part, place })
  }
  // Lines at even indexes, the line breaks between them at odd ones.
  text.split(LINE_BREAK).forEach((piece, index) => {
    if (index % 2 === 1 || !isPlaceLine(piece)) {
      add(piece, false)
      return
    }
    const start = piece.length - piece.trimStart().length
    const end = piece.trimEnd().length
    add(piece.slice(0, start), false)
    add(piece.slice(start, end), true)
    add(piece.slice(end), false)
  })
  return runs
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/dayText.test.ts src/lib/dayHighlight.test.ts`
Expected: `65 passed`.

- [ ] **Step 5: Write the failing tint test**

Tints for "@ some place" and "@Blue willow 3:30" only, each on its line and starting with the text within a pixel, in the sheet and on the day page, following the typing:

In `e2e/sheetDetails.spec.ts`:

```diff
--- a/e2e/sheetDetails.spec.ts
+++ b/e2e/sheetDetails.spec.ts
@@ -46,6 +46,7 @@ test.describe('The day in the meetup sheets', () => {
     await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
     await sheetDay(sheet).fill('@Cafe 10:30')
     await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
+    await expect(sheet).toBeHidden()
     await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
     await expect(page.getByRole('textbox', { name: 'The day' })).toHaveValue('@Cafe 10:30')
   })
@@ -89,3 +90,62 @@ test.describe('The day in the meetup sheets', () => {
     expect(await readMeetups(page)).toHaveLength(0)
   })
 })
+
+/**
+ * Each tint sits behind its line of a The day box: centered on the line it marks (`lines`, from 0), and starting
+ * where the box's text starts, reaching 0.2em past it into the padding.
+ */
+async function expectTintsOnLines(box: Locator, tints: Locator, lines: number[]) {
+  const text = await box.evaluate((element) => {
+    const rect = element.getBoundingClientRect()
+    const style = getComputedStyle(element)
+    return {
+      top: rect.top + parseFloat(style.paddingTop),
+      left: rect.left + parseFloat(style.paddingLeft),
+      lineHeight: parseFloat(style.lineHeight),
+      fontSize: parseFloat(style.fontSize),
+    }
+  })
+  await expect(tints).toHaveCount(lines.length)
+  for (const [index, line] of lines.entries()) {
+    const tint = await tints.nth(index).evaluate((element) => {
+      const [first] = element.getClientRects()
+      return { top: first.top, bottom: first.bottom, left: first.left }
+    })
+    const middle = (tint.top + tint.bottom) / 2
+    expect(Math.abs(middle - (text.top + (line + 0.5) * text.lineHeight)), `Tint ${index + 1} is on line ${line + 1}`).toBeLessThanOrEqual(1)
+    expect(Math.abs(tint.left - (text.left - 0.2 * text.fontSize)), `Tint ${index + 1} starts with the text`).toBeLessThanOrEqual(1)
+  }
+}
+
+test.describe('@ highlighting', () => {
+  const TYPED = ['@ some place', '@Blue willow 3:30', '@', 'Then dinner @seoulsaloon', '@ 3:30', 'Kung pao chicken'].join('\n')
+
+  test('tints each place line in the sheet box and on the day page, and nothing else', async ({ page }) => {
+    await page.goto('/')
+    await addFriend(page, 'Alex')
+    const sheet = await openLogMeetup(page)
+    await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
+    const box = sheetDay(sheet)
+    await box.fill(TYPED)
+    const tints = sheet.locator('mark.day-place')
+    await expect(tints).toHaveText(['@ some place', '@Blue willow 3:30'])
+    await expectTintsOnLines(box, tints, [0, 1])
+    // Only a look: the copy behind the box is hidden from VoiceOver, and the box reads exactly as typed.
+    await expect(sheet.locator('.grow-field__copy')).toHaveAttribute('aria-hidden', 'true')
+    await expect(box).toHaveValue(TYPED)
+
+    await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
+    await expect(sheet).toBeHidden()
+    const dayBox = page.getByRole('textbox', { name: 'The day' })
+    await expect(dayBox).toHaveValue(TYPED)
+    const dayTints = page.locator('.day-page mark.day-place')
+    await expect(dayTints).toHaveText(['@ some place', '@Blue willow 3:30'])
+    await expectTintsOnLines(dayBox, dayTints, [0, 1])
+
+    // The tints follow the typing: a new place line gets one, and a line that stops being a place loses its own.
+    await dayBox.fill(TYPED.replace('@ some place', 'Some place') + '\n@Park')
+    await expect(dayTints).toHaveText(['@Blue willow 3:30', '@Park'])
+    await expectTintsOnLines(dayBox, dayTints, [1, 6])
+  })
+})
```

- [ ] **Step 6: Run it to see it fail**

Run: `npx playwright test --project=iphone e2e/sheetDetails.spec.ts -g "highlighting"`
Expected: `1 failed`.

- [ ] **Step 7: Paint the tints from GrowField's copy**

Replace `src/components/GrowField.tsx` with:

```tsx
import { useMemo, type CSSProperties, type Ref, type TextareaHTMLAttributes } from 'react'
import { placeRuns } from '../lib/dayHighlight'
import './GrowField.css'

interface GrowFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> {
  ref?: Ref<HTMLTextAreaElement>
  value: string
  /** How many lines tall the box is at least. */
  minLines: number
  /** Tints each line that reads as a place (an "@" line) behind its words: The day boxes. */
  highlightPlaces?: boolean
}

/**
 * A text box that grows with its text and never scrolls inside itself. The textarea and a copy of its text share
 * one grid cell (the replicated-value technique), so the box is always as tall as what's in it, with no height
 * measuring and no jump in the scroll.
 *
 * With `highlightPlaces`, the copy also sits behind the box as a backdrop: its glyphs are transparent, the box's
 * own background is too, and each place line's words are wrapped in a tinted `mark.day-place` that shows through
 * under the box's text. The copy lays out its text exactly as the box does, so the tints land on their lines; if
 * the two ever disagree by a pixel, only a tint shifts, and the text is never doubled or hidden.
 */
export function GrowField({ ref, value, minLines, highlightPlaces = false, className, ...props }: GrowFieldProps) {
  const runs = useMemo(() => (highlightPlaces ? placeRuns(value) : null), [highlightPlaces, value])
  return (
    <div
      className={highlightPlaces ? 'grow-field grow-field--places' : 'grow-field'}
      style={{ '--min-lines': minLines } as CSSProperties}
    >
      {/* Before the box, so it paints beneath it. A trailing space keeps a last empty line in the copy as tall as it
          is in the box. */}
      <div className="grow-field__copy" aria-hidden="true">
        {runs
          ? runs.map((run, index) =>
              run.place ? (
                <mark key={index} className="day-place">
                  {run.text}
                </mark>
              ) : (
                run.text
              ),
            )
          : value}{' '}
      </div>
      <textarea ref={ref} className={className ? `grow-field__box ${className}` : 'grow-field__box'} value={value} {...props} />
    </div>
  )
}
```

Replace `src/components/GrowField.css` with:

```css
/* The box and a copy of its text share one grid cell, so the box is as tall as its text. Both must lay out text the
   same way: same font, padding, line height and wrapping. The field's Paper White is on the cell, and the box itself
   is transparent, so a backdrop in the copy can show through. */
.grow-field {
  display: grid;
  border-radius: var(--radius-field);
  background: var(--surface);
}
.grow-field__copy {
  visibility: hidden;
}
.grow-field__box,
.grow-field__copy {
  grid-area: 1 / 1 / 2 / 2;
  min-width: 0;
  margin: 0;
  padding: 0.75rem 0.9rem;
  border: 0;
  font-family: var(--font-text);
  /* 16px minimum stops iOS from zooming into the box. */
  font-size: max(16px, 1rem);
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: normal;
}
.grow-field__box {
  width: 100%;
  min-height: calc(var(--min-lines) * 1.5em + 1.5rem);
  overflow: hidden;
  resize: none;
  border-radius: var(--radius-field);
  background: transparent;
  color: var(--ink);
}
.grow-field__box::placeholder {
  color: var(--ink-3);
}

/* The place tint (The day boxes): the copy shows beneath the box, with transparent glyphs, so only its tints show. */
.grow-field--places .grow-field__copy {
  visibility: visible;
  color: transparent;
  pointer-events: none;
  -webkit-user-select: none;
  user-select: none;
}
/* Peach Wash behind a place line's words. The side padding and the negative margin cancel out, so the tint reaches
   a little past the words without moving them; padding above and below never changes the line's height. */
.day-place {
  margin: 0 -0.2em;
  padding: 0.1em 0.2em;
  border-radius: 0.35em;
  background: var(--accent-soft);
  color: inherit;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
```

Both The day boxes turn it on:

In `src/sheets/MeetupSheet.tsx`:

```diff
--- a/src/sheets/MeetupSheet.tsx
+++ b/src/sheets/MeetupSheet.tsx
@@ -418,6 +418,7 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
         </h3>
         <GrowField
           minLines={4}
+          highlightPlaces
           aria-labelledby={dayId}
           aria-describedby={dayHintId}
           value={note}
```

In `src/screens/DayScreen.tsx`:

```diff
--- a/src/screens/DayScreen.tsx
+++ b/src/screens/DayScreen.tsx
@@ -441,6 +441,7 @@ function DayPage({ meetup, people, typeName, onLeave }: DayPageProps) {
           <GrowField
             ref={dayRef}
             minLines={12}
+            highlightPlaces
             aria-labelledby={dayId}
             aria-describedby={hintId}
             value={fields.note}
```

- [ ] **Step 8: Run them to see them pass**

Run: `npx playwright test --project=iphone e2e/day.spec.ts e2e/dayKeyboard.spec.ts e2e/sheetKeyboard.spec.ts e2e/sheetDetails.spec.ts e2e/meetupPage.spec.ts`
Expected: `56 passed`.

- [ ] **Step 9: Run everything**

Run: `npx tsc -b`, then `npm test`
Expected: `Test Files  59 passed (59)` and `Tests  731 passed (731)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `180 passed`.

- [ ] **Step 10: Commit**

```bash
git add e2e/sheetDetails.spec.ts src/components/GrowField.css src/components/GrowField.tsx src/lib/dayHighlight.test.ts src/lib/dayHighlight.ts src/lib/dayText.test.ts src/lib/dayText.ts src/screens/DayScreen.tsx src/sheets/MeetupSheet.tsx
git commit -F - <<'EOF'
feat: tint each place line in The day boxes as it's typed

Every line the frozen grammar reads as a place ("@ some place", "@Blue willow
3:30", never "@" alone or an "@" mid-sentence) gets a soft Peach Wash tint
behind its words, in the meetup sheets' box and on The day page. isPlaceLine,
exported from the grammar, is the one test, so a tint never disagrees with the
timeline; placeRuns cuts the text into tinted and plain runs. GrowField's copy
of the text, which already sizes the box, now also paints the tints behind it
with transparent glyphs while the box keeps its own text, so a pixel's
disagreement could only shift a tint. Purely visual: the copy is aria-hidden.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Every friend in Who, in a swipeable two-row strip

**Files:**
- Modify: `src/stats/recent.ts`, `src/sheets/MeetupSheet.tsx`, `src/sheets/MeetupSheet.css`
- Test: `src/stats/recent.test.ts`, `e2e/sheetDetails.spec.ts`, and the group "Friends" in `e2e/day.spec.ts`, `e2e/meetups.spec.ts`, `e2e/memories.spec.ts`, `e2e/screenshots.spec.ts`

- [ ] **Step 1: Write the failing ordering test**

In `src/stats/recent.test.ts`:

```diff
--- a/src/stats/recent.test.ts
+++ b/src/stats/recent.test.ts
@@ -14,6 +14,25 @@ describe('recentFriends', () => {
     expect(recentFriends(friends, meetups, TODAY).map((f) => f.id)).toEqual(['alex', 'cal', 'dee', 'bea'])
   })
 
+  it('lists every friend when no limit is given, however many there are', () => {
+    const twelve = Array.from({ length: 12 }, (_, i) => friend(`f${i + 1}`, `Friend ${String(i + 1).padStart(2, '0')}`))
+    const seen = [meetup('m1', '2026-09-30', ['f12']), meetup('m2', '2026-09-01', ['f7'])]
+    expect(recentFriends(twelve, seen, TODAY).map((f) => f.id)).toEqual([
+      'f12',
+      'f7',
+      'f1',
+      'f2',
+      'f3',
+      'f4',
+      'f5',
+      'f6',
+      'f8',
+      'f9',
+      'f10',
+      'f11',
+    ])
+  })
+
   it('caps the list', () => {
     expect(recentFriends(friends, meetups, TODAY, 2).map((f) => f.id)).toEqual(['alex', 'cal'])
   })
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/stats/recent.test.ts`
Expected: `1 failed | 3 passed`.

- [ ] **Step 3: Drop the limit of 8**

In `src/stats/recent.ts`:

```diff
--- a/src/stats/recent.ts
+++ b/src/stats/recent.ts
@@ -3,8 +3,11 @@ import { compareNames } from '../lib/text'
 import type { Friend, Meetup } from '../types'
 import { lastSeenByFriend } from './lastSeen'
 
-/** Friends for one-tap picking: most recently seen first, then never-seen friends by name. */
-export function recentFriends(friends: Friend[], meetups: Meetup[], today: ISODate, limit = 8): Friend[] {
+/**
+ * Friends for one-tap picking: most recently seen first, then never-seen friends by name. Every friend, or the
+ * first `limit` of them.
+ */
+export function recentFriends(friends: Friend[], meetups: Meetup[], today: ISODate, limit?: number): Friend[] {
   const lastSeen = lastSeenByFriend(meetups, today)
   const seen = friends
     .filter((friend) => lastSeen.has(friend.id))
```

- [ ] **Step 4: Write the failing strip tests**

Twelve friends: two rows filled a column at a time, the first column on the margin, the fifth peeking in, the 12th reached by scrolling and picked; a focused tile scrolls into view; eight or fewer stay a still grid. The group is now "Friends" (exact, since "Selected friends" also matches):

In `e2e/sheetDetails.spec.ts`:

```diff
--- a/e2e/sheetDetails.spec.ts
+++ b/e2e/sheetDetails.spec.ts
@@ -1,5 +1,15 @@
 import { expect, test, type Locator, type Page } from '@playwright/test'
-import { addFriend, editMeetup, logMeetup, openDay, openFriendPage, readMeetups, sheetSave } from './helpers.ts'
+import {
+  addFriend,
+  editMeetup,
+  friendRow,
+  logMeetup,
+  openDay,
+  openFriendPage,
+  readMeetups,
+  seedMeetups,
+  sheetSave,
+} from './helpers.ts'
 
 // Most tests add a friend and log a meetup first, so they get more time than most.
 test.describe.configure({ timeout: 60_000 })
@@ -21,7 +31,7 @@ test.describe('The day in the meetup sheets', () => {
     await page.goto('/')
     await addFriend(page, 'Mariya')
     const sheet = await openLogMeetup(page)
-    await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Mariya' }).click()
+    await sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name: 'Mariya' }).click()
     await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
     const day = sheetDay(sheet)
     await expect(day).toHaveAttribute('placeholder', 'What happened? Start a line with @ for a place.')
@@ -43,7 +53,7 @@ test.describe('The day in the meetup sheets', () => {
     await page.goto('/')
     await addFriend(page, 'Alex')
     const sheet = await openLogMeetup(page)
-    await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
+    await sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name: 'Alex' }).click()
     await sheetDay(sheet).fill('@Cafe 10:30')
     await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
     await expect(sheet).toBeHidden()
@@ -125,7 +135,7 @@ test.describe('@ highlighting', () => {
     await page.goto('/')
     await addFriend(page, 'Alex')
     const sheet = await openLogMeetup(page)
-    await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
+    await sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name: 'Alex' }).click()
     const box = sheetDay(sheet)
     await box.fill(TYPED)
     const tints = sheet.locator('mark.day-place')
@@ -149,3 +159,79 @@ test.describe('@ highlighting', () => {
     await expectTintsOnLines(dayBox, dayTints, [1, 6])
   })
 })
+
+/** Whether a friend's tile shows whole inside the strip's visible part. */
+function shownInStrip(tile: Locator): Promise<boolean> {
+  return tile.evaluate((element) => {
+    const strip = element.closest('[role="group"]')
+    if (!strip) throw new Error('Not in the strip')
+    const tileRect = element.getBoundingClientRect()
+    const stripRect = strip.getBoundingClientRect()
+    return tileRect.left >= stripRect.left - 0.5 && tileRect.right <= stripRect.right + 0.5
+  })
+}
+
+test.describe('swiping through friends', () => {
+  const NAMES = Array.from({ length: 12 }, (_, i) => `Friend ${String(i + 1).padStart(2, '0')}`)
+
+  test('Who has every friend: the strip swipes sideways to the 12th, which can be picked', async ({ page }) => {
+    await page.goto('/')
+    // None seen yet, so they come in name order.
+    await seedMeetups(page, { friends: NAMES.map((name, i) => friendRow(`f${i + 1}`, name)) })
+    const sheet = await openLogMeetup(page)
+    const strip = sheet.getByRole('group', { name: 'Friends', exact: true })
+    const tiles = strip.getByRole('button')
+    await expect(strip.locator('.friend-tile__name')).toHaveText(NAMES)
+    // Two rows, filled a column at a time: the first two friends share the first column.
+    const [first, second, third] = await Promise.all([0, 1, 2].map((i) => tiles.nth(i).boundingBox()))
+    if (!first || !second || !third) throw new Error('The tiles are not on screen')
+    expect(Math.abs(second.x - first.x), 'Friend 02 is under Friend 01').toBeLessThanOrEqual(1)
+    expect(second.y).toBeGreaterThan(first.y + first.height - 1)
+    expect(third.x).toBeGreaterThan(first.x + first.width)
+    // The first column starts on the sheet's 16px margin, and the fifth peeks in at the edge.
+    const sheetBox = await sheet.boundingBox()
+    if (!sheetBox) throw new Error('The sheet is not on screen')
+    expect(Math.abs(first.x - (sheetBox.x + 16)), 'On the margin').toBeLessThanOrEqual(1)
+    const fifth = await tiles.nth(8).boundingBox()
+    if (!fifth) throw new Error('The fifth column is not on screen')
+    expect(fifth.x, 'The fifth column starts on screen').toBeLessThan(sheetBox.x + sheetBox.width)
+    expect(fifth.x + fifth.width, 'and runs off it').toBeGreaterThan(sheetBox.x + sheetBox.width)
+
+    const twelfth = tiles.nth(11)
+    expect(await shownInStrip(twelfth)).toBe(false)
+    // A sideways swipe scrolls the strip (Playwright's mobile WebKit can't swipe or use a wheel, so it scrolls it).
+    await strip.evaluate((element) => element.scrollBy({ left: element.scrollWidth, behavior: 'instant' }))
+    await expect.poll(() => shownInStrip(twelfth)).toBe(true)
+    await twelfth.click()
+    await expect(twelfth).toHaveAttribute('aria-pressed', 'true')
+    await expect(sheet.getByRole('group', { name: 'Selected friends' })).toContainText('Friend 12')
+    await sheetSave(sheet).click()
+    await expect(page.getByRole('status')).toContainText('Logged with Friend 12')
+  })
+
+  test('a tile that takes keyboard focus scrolls into view', async ({ page }) => {
+    await page.goto('/')
+    await seedMeetups(page, { friends: NAMES.map((name, i) => friendRow(`f${i + 1}`, name)) })
+    const sheet = await openLogMeetup(page)
+    const twelfth = sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name: 'Friend 12' })
+    expect(await shownInStrip(twelfth)).toBe(false)
+    await twelfth.focus()
+    await expect.poll(() => shownInStrip(twelfth)).toBe(true)
+  })
+
+  test('with 8 friends or fewer, Who is a still grid of four across', async ({ page }) => {
+    await page.goto('/')
+    await seedMeetups(page, { friends: NAMES.slice(0, 8).map((name, i) => friendRow(`f${i + 1}`, name)) })
+    const sheet = await openLogMeetup(page)
+    const strip = sheet.getByRole('group', { name: 'Friends', exact: true })
+    const tiles = strip.getByRole('button')
+    await expect(strip.locator('.friend-tile__name')).toHaveText(NAMES.slice(0, 8))
+    // Filled a row at a time, as before: Friend 05 starts the second row.
+    const [first, second, fifth] = await Promise.all([0, 1, 4].map((i) => tiles.nth(i).boundingBox()))
+    if (!first || !second || !fifth) throw new Error('The tiles are not on screen')
+    expect(Math.abs(second.y - first.y)).toBeLessThanOrEqual(1)
+    expect(Math.abs(fifth.x - first.x)).toBeLessThanOrEqual(1)
+    expect(fifth.y).toBeGreaterThan(first.y)
+    expect(await strip.evaluate((element) => element.scrollWidth <= element.clientWidth), 'Nothing to swipe').toBe(true)
+  })
+})
```

In `e2e/day.spec.ts`:

```diff
--- a/e2e/day.spec.ts
+++ b/e2e/day.spec.ts
@@ -652,7 +652,7 @@ test('the owner’s example, written on the walk home, reads back as their day',
   // 1. Friends tab, "+ Log meetup": Mariya, Jessie and Brandon under Recent, Meal, Today, Movie and Shopping.
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
-  const recent = sheet.getByRole('group', { name: 'Recent friends' })
+  const recent = sheet.getByRole('group', { name: 'Friends', exact: true })
   for (const name of FRIENDS) await recent.getByRole('button', { name }).click()
   await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
   await expect(sheet.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true')
```

In `e2e/meetups.spec.ts`:

```diff
--- a/e2e/meetups.spec.ts
+++ b/e2e/meetups.spec.ts
@@ -39,7 +39,7 @@ test('Save is at the top right, dimmed until a friend is picked, and there is no
   if (!title || !bar) throw new Error('The header is not on screen')
   expect(Math.abs(title.x + title.width / 2 - (bar.x + bar.width / 2)), 'Within a pixel').toBeLessThanOrEqual(1)
 
-  await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
+  await sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name: 'Alex' }).click()
   await expect(sheetSave(sheet)).toBeEnabled()
   await sheetSave(sheet).click()
   await expect(sheet).toBeHidden()
@@ -72,7 +72,7 @@ test('asks before discarding a started meetup', async ({ page }) => {
   await addFriend(page, 'Alex')
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
-  await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
+  await sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name: 'Alex' }).click()
   await sheet.getByRole('button', { name: 'Cancel' }).click()
   await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
   await expect(sheet).toBeHidden()
```

In `e2e/memories.spec.ts`:

```diff
--- a/e2e/memories.spec.ts
+++ b/e2e/memories.spec.ts
@@ -22,7 +22,7 @@ test('logs a meetup with activities, one of them new, and two photos', async ({
   await addFriend(page, 'Alex')
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
-  await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
+  await sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name: 'Alex' }).click()
   const activities = sheet.getByRole('group', { name: 'Activities' })
   // The starters, in order, then "+ New".
   await expect(activities.getByRole('button').first()).toHaveText('Board games')
```

In `e2e/screenshots.spec.ts`:

```diff
--- a/e2e/screenshots.spec.ts
+++ b/e2e/screenshots.spec.ts
@@ -272,7 +272,7 @@ test('accessibility text size day page and memory', async ({ page }) => {
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
   for (const name of ['Mariya', 'Jessie', 'Brandon']) {
-    await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name }).click()
+    await sheet.getByRole('group', { name: 'Friends', exact: true }).getByRole('button', { name }).click()
   }
   await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
   await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
```

- [ ] **Step 5: Run them to see them fail**

Run: `npx playwright test --project=iphone e2e/sheetDetails.spec.ts -g "swip|still grid|keyboard focus"`
Expected: `3 failed`.

- [ ] **Step 6: Make the strip**

In `src/sheets/MeetupSheet.tsx`:

```diff
--- a/src/sheets/MeetupSheet.tsx
+++ b/src/sheets/MeetupSheet.tsx
@@ -45,6 +45,9 @@ function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
 
 const UNDO_FAILED = "Couldn't undo. Please try again."
 
+/** Up to this many friends fill a still grid four across; more make a strip two rows high that swipes sideways. */
+const STILL_GRID_MAX = 8
+
 export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
   const [initial] = useState(request)
   const editing = initial?.meetup
@@ -111,7 +114,7 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
 
   const friendById = useMemo(() => new Map((friends ?? []).map((f) => [f.id, f] as const)), [friends])
   const selected = friendIds.map((id) => friendById.get(id)).filter((f): f is Friend => f !== undefined)
-  const recent = useMemo(
+  const byLastSeen = useMemo(
     () => (friends && meetups ? recentFriends(friends, meetups, today) : []),
     [friends, meetups, today],
   )
@@ -268,27 +271,32 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
             ))}
           </div>
         )}
-        {recent.length > 0 && (
-          <div className="recent-friends" role="group" aria-label="Recent friends">
-            {recent.map((friend) => {
+        {byLastSeen.length > 0 && (
+          <div
+            className="friend-strip"
+            data-swipes={byLastSeen.length > STILL_GRID_MAX}
+            role="group"
+            aria-label="Friends"
+          >
+            {byLastSeen.map((friend) => {
               const on = friendIds.includes(friend.id)
               return (
                 <button
                   key={friend.id}
                   type="button"
-                  className="recent-friend"
+                  className="friend-tile"
                   aria-pressed={on}
                   onClick={() => toggleFriend(friend.id)}
                 >
-                  <span className="recent-friend__avatar">
+                  <span className="friend-tile__avatar">
                     <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={52} />
                     {on && (
-                      <span className="recent-friend__check">
+                      <span className="friend-tile__check">
                         <IconCheck size={14} strokeWidth={3} />
                       </span>
                     )}
                   </span>
-                  <span className="recent-friend__name">{friend.name}</span>
+                  <span className="friend-tile__name">{friend.name}</span>
                 </button>
               )
             })}
```

In `src/sheets/MeetupSheet.css`:

```diff
--- a/src/sheets/MeetupSheet.css
+++ b/src/sheets/MeetupSheet.css
@@ -1,9 +1,33 @@
-.recent-friends {
+/* Who: every friend as a tile, most recently seen first. Up to 8 fill a still grid four across. More make a strip
+   two rows high, filled a column at a time, that swipes sideways: it runs to the sheet's edges with its first column
+   on the 16px margin (like the meetup type chips), and its columns are a little narrower than a quarter of the
+   width, so the fifth peeks in to show there's more. Each column snaps to the margin. */
+.friend-strip {
   display: grid;
   grid-template-columns: repeat(4, minmax(0, 1fr));
   gap: var(--space-3) var(--space-2);
 }
-.recent-friend {
+.friend-strip[data-swipes='true'] {
+  grid-template-columns: none;
+  grid-template-rows: repeat(2, auto);
+  grid-auto-flow: column;
+  grid-auto-columns: calc((100% - 3 * var(--space-2)) / 4.4);
+  margin: 0 calc(-1 * var(--space-4));
+  padding: 0 var(--space-4);
+  overflow-x: auto;
+  overscroll-behavior-x: contain;
+  scroll-snap-type: x mandatory;
+  scroll-padding-inline: var(--space-4);
+  touch-action: pan-x pan-y;
+  scrollbar-width: none;
+}
+.friend-strip[data-swipes='true']::-webkit-scrollbar {
+  display: none;
+}
+.friend-strip[data-swipes='true'] .friend-tile {
+  scroll-snap-align: start;
+}
+.friend-tile {
   display: flex;
   flex-direction: column;
   align-items: center;
@@ -13,20 +37,20 @@
   border-radius: var(--radius-field);
   transition: background-color var(--dur-fast);
 }
-.recent-friend:active {
+.friend-tile:active {
   background: var(--surface-2);
 }
-.recent-friend__avatar {
+.friend-tile__avatar {
   position: relative;
   border-radius: 50%;
   outline: 3px solid transparent;
   outline-offset: 2px;
   transition: outline-color var(--dur-fast) var(--ease-out-quart);
 }
-.recent-friend[aria-pressed='true'] .recent-friend__avatar {
+.friend-tile[aria-pressed='true'] .friend-tile__avatar {
   outline-color: var(--accent);
 }
-.recent-friend__check {
+.friend-tile__check {
   position: absolute;
   right: -4px;
   bottom: -4px;
@@ -41,7 +65,7 @@
   animation: pop-in var(--dur) var(--ease-out-quart);
 }
 /* Up to two lines, so first and last names both show at large text sizes. */
-.recent-friend__name {
+.friend-tile__name {
   display: -webkit-box;
   max-width: 100%;
   overflow: hidden;
@@ -147,7 +171,7 @@
 }
 
 @media (prefers-reduced-motion: reduce) {
-  .recent-friend__check {
+  .friend-tile__check {
     animation: fade-in var(--dur) linear;
   }
   .photo-tile__remove:active .photo-tile__remove-glyph {
```

- [ ] **Step 7: Run them to see them pass**

Run: `npx playwright test --project=iphone e2e/sheetDetails.spec.ts`
Expected: `8 passed`.

- [ ] **Step 8: Run everything**

Run: `npx tsc -b`, then `npm test`
Expected: `Test Files  59 passed (59)` and `Tests  732 passed (732)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `183 passed`.

- [ ] **Step 9: Commit**

```bash
git add e2e/day.spec.ts e2e/meetups.spec.ts e2e/memories.spec.ts e2e/screenshots.spec.ts e2e/sheetDetails.spec.ts src/sheets/MeetupSheet.css src/sheets/MeetupSheet.tsx src/stats/recent.test.ts src/stats/recent.ts
git commit -F - <<'EOF'
feat: swipe through every friend in Who, two rows high

Who shows every friend, not just 8, in the same order (most recently seen
first, then never seen, by name). Up to 8 still fill the grid four across. More
make a strip two rows high, filled a column at a time, that swipes sideways and
snaps each column to the 16px margin; it runs to the sheet's edges, and its
columns are a little narrower than a quarter so the fifth peeks in. The group is
named "Friends" and each tile stays a toggle named by the friend. recentFriends
lists every friend when it's given no limit.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: The friend search goes to the top of the sheet

**Files:**
- Modify: `src/lib/viewport.ts`, `src/hooks/useRevealFocusedField.ts`, `src/sheets/MeetupSheet.tsx`
- Test: `src/lib/viewport.test.ts`, `e2e/sheetKeyboard.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `src/lib/viewport.test.ts`:

```diff
--- a/src/lib/viewport.test.ts
+++ b/src/lib/viewport.test.ts
@@ -1,5 +1,5 @@
 import { describe, expect, it } from 'vitest'
-import { caretEdge, keyboardInset, keyboardIsUp, revealMargin, revealOffset } from './viewport'
+import { caretEdge, keyboardInset, keyboardIsUp, revealMargin, revealOffset, topOffset } from './viewport'
 
 describe('keyboardInset', () => {
   it('is zero with no keyboard', () => {
@@ -130,6 +130,29 @@ describe('revealOffset', () => {
   })
 })
 
+describe('topOffset', () => {
+  const port = { top: 100, bottom: 400 }
+
+  it('scrolls a field below the top of the view up to `margin` under it', () => {
+    expect(topOffset(port, { top: 300, bottom: 344 }, 12)).toBe(188)
+  })
+
+  it('scrolls a field above the view back down to it', () => {
+    expect(topOffset(port, { top: 40, bottom: 84 }, 12)).toBe(-72)
+  })
+
+  it('leaves a field already there, within a pixel, where it is', () => {
+    expect(topOffset(port, { top: 112, bottom: 156 }, 12)).toBe(0)
+    expect(topOffset(port, { top: 112.4, bottom: 156.4 }, 12)).toBe(0)
+    expect(topOffset(port, { top: 111.6, bottom: 155.6 }, 12)).toBe(0)
+  })
+
+  it('rounds to whole pixels', () => {
+    expect(topOffset(port, { top: 200.6, bottom: 244.6 }, 12)).toBe(89)
+    expect(topOffset(port, { top: 50.4, bottom: 94.4 }, 12)).toBe(-62)
+  })
+})
+
 describe('revealMargin', () => {
   it('is the field’s own scroll margin, so the CSS sets it at every text size', () => {
     expect(revealMargin('12px')).toBe(12)
```

With 12 friends and the fake keyboard: the field 12px below the header, three whole results and the fourth starting at the keyboard on the 664px profile, nothing moving for a hand scroll or a `selectionchange`, the next letter going back to the top, and at least four whole results on the Home Screen app's 844px screen:

In `e2e/sheetKeyboard.spec.ts`:

```diff
--- a/e2e/sheetKeyboard.spec.ts
+++ b/e2e/sheetKeyboard.spec.ts
@@ -1,5 +1,5 @@
 import { expect, test, type Locator, type Page } from '@playwright/test'
-import { addFriend, LARGE_TEXT, sheetSave } from './helpers.ts'
+import { addFriend, friendRow, LARGE_TEXT, seedMeetups, sheetSave } from './helpers.ts'
 import { closeKeyboard, fakeVisualViewport, KEYBOARD, nextFrames, openKeyboard, setVisualViewport, tapFocus } from './keyboard.ts'
 
 /** Where a field inside a sheet is, against the part of the sheet's body you can see (it ends at the keyboard). */
@@ -198,6 +198,87 @@ test('closing the keyboard leaves the sheet where it was scrolled', async ({ pag
   await expect(notes).toBeFocused()
 })
 
+/** 12 friends with an "a" in every name. */
+const SEARCHABLE = ['Alex', 'Sam', 'Kim Park', 'Jordan', 'Maya', 'Theo Banks', 'Mariya', 'Jessica', 'Brandon', 'Priya', 'Lana', 'Zara']
+
+/** Opens Log meetup over the 12 friends, focuses "Search all friends", brings up the keyboard and types "a". */
+async function searchWithKeyboardUp(page: Page) {
+  await seedMeetups(page, { friends: SEARCHABLE.map((name, i) => friendRow(`f${i + 1}`, name)) })
+  await page.getByRole('button', { name: 'Log meetup' }).click()
+  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
+  await sheet.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)))
+  const input = sheet.getByLabel('Search all friends')
+  await tapFocus(input)
+  await openKeyboard(page)
+  await page.keyboard.type('a')
+  await nextFrames(page)
+  const rows = sheet.getByRole('group', { name: 'Search results' }).getByRole('button')
+  await expect(rows).toHaveCount(SEARCHABLE.length)
+  // The whole field, not just the text inside it.
+  return { sheet, input, field: sheet.locator('label.search'), rows }
+}
+
+/** How many result rows show above the keyboard: whole, and at least in part. */
+async function resultsShown(rows: Locator, visibleBottom: number) {
+  return rows.evaluateAll(
+    (elements, bottom) => ({
+      whole: elements.filter((row) => row.getBoundingClientRect().bottom <= bottom + 0.5).length,
+      started: elements.filter((row) => row.getBoundingClientRect().top < bottom).length,
+    }),
+    visibleBottom,
+  )
+}
+
+test('the friend search goes to the top of the sheet as you type, so its results fill the room above the keyboard', async ({
+  page,
+}) => {
+  const { sheet, input, field, rows } = await searchWithKeyboardUp(page)
+  const body = sheet.locator('.sheet__body')
+  await expect(sheet.locator('.sheet__footer')).toHaveCount(0)
+  let at = await placement(field)
+  expect(at.top - at.visibleTop, 'The field sits 12px below the header').toBeCloseTo(MARGIN, 0)
+  // This profile is Safari's 664px-tall page, 324px above the keyboard: three whole rows, and the fourth starting
+  // at the keyboard's edge (a Home Screen app has more room: see the next test).
+  const shown = await resultsShown(rows, at.visibleBottom)
+  expect(shown.whole, 'Three whole results above the keyboard').toBeGreaterThanOrEqual(3)
+  expect(shown.started, 'The results run on to the keyboard').toBeGreaterThanOrEqual(4)
+  await expect(input).toBeFocused()
+
+  // Scrolling the results by hand moves nothing, and neither does the app when the caret moves (the browser's own
+  // caret reveal aside, which this leaves out).
+  await body.evaluate((element) => {
+    element.scrollTop += 80
+  })
+  await nextFrames(page)
+  await nextFrames(page)
+  const scrolled = await scrollTop(body)
+  expect(scrolled, 'Scrolled by hand').toBeGreaterThan(0)
+  await page.evaluate(() => document.dispatchEvent(new Event('selectionchange')))
+  await nextFrames(page)
+  await nextFrames(page)
+  expect(await scrollTop(body)).toBe(scrolled)
+
+  // The next letter brings the field back to the top.
+  await page.keyboard.type('r')
+  await nextFrames(page)
+  at = await placement(field)
+  expect(at.top - at.visibleTop).toBeCloseTo(MARGIN, 0)
+  await expect(rows).toHaveCount(SEARCHABLE.filter((name) => name.toLowerCase().includes('ar')).length)
+})
+
+test.describe('as the Home Screen app', () => {
+  // The iPhone 13's whole 844px screen, with its 47px status bar and 34px home indicator.
+  test.use({ viewport: { width: 390, height: 844 } })
+
+  test('the friend search shows at least four whole results above the keyboard', async ({ page }) => {
+    await page.addStyleTag({ content: ':root { --safe-top: 47px; --safe-bottom: 34px; }' })
+    const { field, rows } = await searchWithKeyboardUp(page)
+    const at = await placement(field)
+    expect(at.top - at.visibleTop, 'The field sits 12px below the header').toBeCloseTo(MARGIN, 0)
+    expect((await resultsShown(rows, at.visibleBottom)).whole).toBeGreaterThanOrEqual(4)
+  })
+})
+
 test('focusing a chip with the keyboard up leaves the scrolled sheet alone', async ({ page }) => {
   const sheet = await openLogMeetup(page)
   const body = sheet.locator('.sheet__body')
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/viewport.test.ts`
Expected: the `topOffset` tests fail. Add `topOffset` (next step's `viewport.ts` change) so the build compiles, then run `npx playwright test --project=iphone e2e/sheetKeyboard.spec.ts -g "friend search"`
Expected: it fails with the field about 199px below the header instead of 12.

- [ ] **Step 3: Write `topOffset` and the opt-in**

In `src/lib/viewport.ts`:

```diff
--- a/src/lib/viewport.ts
+++ b/src/lib/viewport.ts
@@ -19,12 +19,12 @@ export interface TextBox {
 const DEFAULT_REVEAL_MARGIN = 12
 
 /**
- * The room to keep between a revealed field and the edges of the visible area: the field's own
- * `scroll-margin-bottom` (a computed length such as "17.25px"), so the CSS that also guides the browser's
- * own focus scrolling is the one source at every text size. 12px when it can't be read.
+ * The room to keep between a revealed field and the edges of the visible area: the field's own scroll margin
+ * (a computed length such as "17.25px"), so the CSS that also guides the browser's own focus scrolling is the
+ * one source at every text size. 12px when it can't be read.
  */
-export function revealMargin(scrollMarginBottom: string): number {
-  const margin = parseFloat(scrollMarginBottom)
+export function revealMargin(scrollMargin: string): number {
+  const margin = parseFloat(scrollMargin)
   return Number.isNaN(margin) ? DEFAULT_REVEAL_MARGIN : margin
 }
 
@@ -92,6 +92,16 @@ export function revealOffset(port: Span, target: Span, margin: number, caret: Ca
   return 0
 }
 
+/**
+ * How far to scroll a box whose visible area is `port` so that `target`'s top sits `margin` below the top of it,
+ * wherever the target is now: the friend search goes there so its results fill the room below. Positive scrolls
+ * down. Whole pixels, and 0 within a pixel, so a field already there is never nudged.
+ */
+export function topOffset(port: Span, target: Span, margin: number): number {
+  const offset = Math.round(target.top - (port.top + margin))
+  return offset === 0 ? 0 : offset
+}
+
 /** Rounds away from zero. */
 function wholePixels(offset: number): number {
   return offset > 0 ? Math.ceil(offset) : Math.floor(offset)
```

In `src/hooks/useRevealFocusedField.ts`:

```diff
--- a/src/hooks/useRevealFocusedField.ts
+++ b/src/hooks/useRevealFocusedField.ts
@@ -1,6 +1,6 @@
 import { useEffect, type RefObject } from 'react'
 import { caretLineSpan } from '../lib/caret'
-import { caretEdge, keyboardIsUp, revealMargin, revealOffset, type CaretEdge, type Span } from '../lib/viewport'
+import { caretEdge, keyboardIsUp, revealMargin, revealOffset, topOffset, type CaretEdge, type Span } from '../lib/viewport'
 
 /** Input types that type no text and open no picker, so they bring up no keyboard. */
 const NO_KEYBOARD = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'])
@@ -14,6 +14,11 @@ function isEditable(element: Element | null): element is HTMLElement {
   )
 }
 
+/** The element marked `data-reveal="top"` around a field, if any (see useRevealFocusedField). */
+function topAligned(field: Element): HTMLElement | null {
+  return field.closest<HTMLElement>('[data-reveal="top"]')
+}
+
 /**
  * Keeps the focused field on screen inside a sheet's (or the day page's) scrolling body. iOS shows a tapped
  * field while the sheet is still full height; then the keyboard comes up and the sheet shrinks above it (see
@@ -21,6 +26,11 @@ function isEditable(element: Element | null): element is HTMLElement {
  * taller than the view shows the line with the caret instead, and follows it as you type and move the caret.
  * Only the body scrolls, and only when it shrinks, focus moves, or the caret's line is hidden: never the
  * locked page or the visual viewport, and never while someone is just scrolling.
+ *
+ * A field inside an element marked `data-reveal="top"` (the meetup sheet's friend search) goes to the top of the
+ * view instead, that element's top its scroll margin below the header, so what comes up under it (the search's
+ * results) gets all the room down to the keyboard. It goes there when it takes focus and whenever its text
+ * changes, keyboard or not, and when the body shrinks; moving its caret moves nothing.
  */
 export function useRevealFocusedField(active: boolean, bodyRef: RefObject<HTMLElement | null>) {
   useEffect(() => {
@@ -37,6 +47,12 @@ export function useRevealFocusedField(active: boolean, bodyRef: RefObject<HTMLEl
       if (!isEditable(field) || !body.contains(field)) return
       const top = body.getBoundingClientRect().top + body.clientTop
       const port = { top, bottom: top + body.clientHeight }
+      const box = topAligned(field)
+      if (box) {
+        const offset = topOffset(port, box.getBoundingClientRect(), revealMargin(getComputedStyle(field).scrollMarginTop))
+        if (offset !== 0) body.scrollTop += offset
+        return
+      }
       let target: Span = field.getBoundingClientRect()
       let caret: CaretEdge = 'start'
       if (field instanceof HTMLTextAreaElement) {
@@ -57,8 +73,8 @@ export function useRevealFocusedField(active: boolean, bodyRef: RefObject<HTMLEl
 
     // The body shrinks when the keyboard opens, as the sheet follows --keyboard-inset and
     // --viewport-height. This runs after that layout and before paint, so the field never shows hidden.
-    // Growing (the keyboard closing, the Save bar's note going away) reveals nothing, so it never pulls
-    // the sheet back to a field someone has scrolled away from.
+    // Growing (the keyboard closing) reveals nothing, so it never pulls the sheet back to a field someone has
+    // scrolled away from.
     let lastHeight: number | null = null
     const observer = new ResizeObserver(() => {
       const height = body.clientHeight
@@ -73,10 +89,19 @@ export function useRevealFocusedField(active: boolean, bodyRef: RefObject<HTMLEl
     // they left the field (or, in a tall box, the caret's line) out of view: one just in view, close to an edge,
     // is not nudged. Acting, it leaves the same margin as above. Scrolling moves no caret, so it is left alone.
     let frame = 0
-    const onChange = () => {
-      if (!keyboardIsUp(window.innerHeight, window.visualViewport)) return
+    const later = (run: () => void) => {
       cancelAnimationFrame(frame)
-      frame = requestAnimationFrame(() => reveal(true))
+      frame = requestAnimationFrame(run)
+    }
+    const onChange = (event: Event) => {
+      const field = document.activeElement
+      if (field && body.contains(field) && topAligned(field)) {
+        // Its results come and go with each letter, so it goes back to the top on focus and on every change.
+        if (event.type !== 'selectionchange') later(() => reveal(false))
+        return
+      }
+      if (!keyboardIsUp(window.innerHeight, window.visualViewport)) return
+      later(() => reveal(true))
     }
     body.addEventListener('focusin', onChange)
     body.addEventListener('input', onChange)
```

In `src/sheets/MeetupSheet.tsx`:

```diff
--- a/src/sheets/MeetupSheet.tsx
+++ b/src/sheets/MeetupSheet.tsx
@@ -302,7 +302,9 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
             })}
           </div>
         )}
-        <label className="search">
+        {/* Goes to the top of the sheet when it takes focus or its text changes, so the results get the room
+            (useRevealFocusedField). */}
+        <label className="search" data-reveal="top">
           <IconSearch size={18} />
           <input
             ref={searchRef}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/viewport.test.ts`, then `npx playwright test --project=iphone e2e/sheetKeyboard.spec.ts`
Expected: `32 passed`, then `12 passed`.

- [ ] **Step 5: Run everything**

Run: `npx tsc -b`, then `npm test`
Expected: `Test Files  59 passed (59)` and `Tests  736 passed (736)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `185 passed`.

- [ ] **Step 6: Commit**

```bash
git add e2e/sheetKeyboard.spec.ts src/hooks/useRevealFocusedField.ts src/lib/viewport.test.ts src/lib/viewport.ts src/sheets/MeetupSheet.tsx
git commit -F - <<'EOF'
feat: the friend search goes to the top of the sheet, so its results get the room

With Save in the header there's no footer riding on the keyboard, and now
"Search all friends" also goes to the top of the sheet's visible body, 12px
below the header, when it takes focus and whenever its text changes, so the
results fill the room down to the keyboard. It's an opt-in of the reveal hook
(data-reveal="top"), so the two never fight; moving the caret or scrolling the
results by hand moves nothing. topOffset is the pure measure.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: The owner's three additions in the spec

**Files:**
- Modify: `docs/superpowers/specs/2026-10-21-sheet-details-design.md`

After a hands-on UX review of the Log sheet the owner approved: A, a suggested meetup type instead of always the first; B, Who ordered by who you actually see, with a preset friend's usual companions first; C, The day box right after When.

- [ ] **Step 1: Add them to the spec**

In `docs/superpowers/specs/2026-10-21-sheet-details-design.md`:

```diff
--- a/docs/superpowers/specs/2026-10-21-sheet-details-design.md
+++ b/docs/superpowers/specs/2026-10-21-sheet-details-design.md
@@ -1,6 +1,6 @@
 # Sheet details, @ highlighting, swipeable friends and Save in the corner: design
 
-Date: 2026-10-21. Status: approved (the owner asked for best-practice decisions without approval stops: "Auto approve").
+Date: 2026-10-21. Status: approved (the owner asked for best-practice decisions without approval stops: "Auto approve"). Later the same day the owner approved two changes: no "Pick a friend" anywhere (see Save in the top right), and three additions from a hands-on UX review of the Log sheet (A, B and C below: a suggested meetup type, Who ordered by who you actually see, and The day box right after When).
 
 ## Owner feedback (verbatim)
 
@@ -16,16 +16,18 @@ Make logging a meetup complete and comfortable in one sheet: pick any friend wit
 
 ## Decisions
 
-- **The day box in the meetup sheets.** The Log meetup and Edit meetup sheets get a "The day" text box after Photos. It edits the meetup's `note` (the same text The day page edits) and saves with the meetup. No new data and no backup change.
+- **The day box in the meetup sheets.** The Log meetup and Edit meetup sheets get a "The day" text box right after When, before Activities and Photos, so it's easy to reach (addition C). It edits the meetup's `note` (the same text The day page edits) and saves with the meetup. No new data and no backup change.
 - **@ highlighting everywhere the day is typed.** While typing, every line the frozen grammar reads as a place (exactly the lines `readPlaceLine` in `src/lib/dayText.ts` accepts, so "@ some place" and "@Blue willow 3:30" both count, "@" alone does not) gets a soft highlight behind it. This applies in the sheet's The day box and on The day page. The highlight means "this line will show as a place in the timeline".
-- **Swipe through every friend.** The Who section's 8-friend grid becomes a horizontally swipeable strip of all friends, two rows high, in the same order as today (most recently seen first, then never seen, by name). Search stays below it.
+- **Swipe through every friend.** The Who section's 8-friend grid becomes a horizontally swipeable strip of all friends, two rows high, ordered by who you actually see (addition B, below). Search stays below it.
+- **A suggested meetup type (addition A).** A new meetup no longer always starts on the first type. Until the owner taps a type, the sheet suggests one from the picked friends' recent meetups, then from the owner's own habits, then the first type. Edit keeps the meetup's own type.
+- **Who you actually see comes first (addition B).** The friend tiles are ranked by how often you met in the last 90 days, then by the most recent meetup, then never-seen friends by name. Opened from a friend's page, the friends most often seen with that friend come first.
 - **Save in the top right.** The meetup sheets and the friend sheet put Save in the header's trailing slot (Cancel left, title centered, Save right), as iOS sheets do. The footer's block Save button goes away.
 - **"Save and write about the day" stays** in the Log sheet as a full-width secondary button at the end of the sheet body, for weather, mood and How it felt on The day page.
-- **Out of scope:** changing the frozen grammar, highlighting anything the grammar doesn't read as a place (an "@" in the middle of a sentence), times or paid lines highlighting, reordering friends, favorites, and the Groups/Types screens.
+- **Out of scope:** changing the frozen grammar, highlighting anything the grammar doesn't read as a place (an "@" in the middle of a sentence), times or paid lines highlighting, reordering friends by hand, favorites, and the Groups/Types screens.
 
 ## The day box in the meetup sheets
 
-- **Placement.** A new section after Photos: a label "The day" (`form-section__label`, the same look as Who, What, When) and a `GrowField` with `minLines={4}`.
+- **Placement.** A new section right after When, before Activities and Photos (addition C: easy to reach without scrolling past the activity chips and photos): a label "The day" (`form-section__label`, the same look as Who, What, When) and a `GrowField` with `minLines={4}`.
 - **Copy.** Placeholder "What happened? Start a line with @ for a place." The hint under the box, in Footnote Warm Ink Secondary, reads "Lines that start with @ show as places." It is linked with `aria-describedby`.
 - **Typing.** `autoCapitalize="sentences"`, `autoCorrect="on"`, `spellCheck`, `maxLength={DAY_MAX_TYPED}` (the same limit as The day page), and `enterKeyHint` left at its default so Return makes a new line.
 - **Saving.**
@@ -46,7 +48,14 @@ Make logging a meetup complete and comfortable in one sheet: pick any friend wit
 
 ## Swipeable friends in Who
 
-- **Order.** All friends, in `recentFriends` order without the 8 limit: most recently seen first, then never seen, by name. Selected friends keep showing as chips above, as now.
+- **Order (addition B).** All friends, with no limit:
+  1. Friends ranked by how many meetups you had with them in the last 90 days (more first).
+  2. Then by their most recent meetup (more recent first), so a friend seen only longer ago still comes before anyone never seen.
+  3. Then never-seen friends, by name.
+  - Only meetups dated today or earlier count, as for "Last seen".
+  - **Opened from a friend's page** (a preset friend): the friends most often seen together with that friend in the last 12 months come first (more meetups together first, then the most recent together), then everyone else in the general order. The preset friend stays selected, as now, and their own tile keeps its place in the general order.
+  - The order is taken when the sheet opens and doesn't move while friends are picked.
+  - Selected friends keep showing as chips above, as now.
 - **Layout.**
   - A horizontal scroller with two rows (`grid-auto-flow: column`, `grid-template-rows: repeat(2, auto)`). Columns are a little narrower than a quarter of the width, so the fifth column peeks in and shows there is more.
   - `overflow-x: auto`, `overscroll-behavior-x: contain`, `scroll-snap-type: x mandatory`, with each column snapping at its start.
@@ -58,6 +67,21 @@ Make logging a meetup complete and comfortable in one sheet: pick any friend wit
   - Keyboard focus scrolls the focused tile into view.
 - **Search** ("Search all friends") stays below the strip, unchanged.
 
+## A suggested meetup type (addition A)
+
+- **Today.** `typeId ?? types[0]`: every new log starts on Coffee, and a quick log silently saves the wrong type.
+- **The suggestion.** For a new meetup, until the owner taps a type, the effective type comes from a pure, unit-tested `suggestMeetupType(meetups, friendIds, types, today)` in `src/stats/`:
+  1. The most common type among the last 10 meetups that include any of the picked friends.
+  2. If there's none, the owner's most-used type across their last 30 meetups.
+  3. If there's none, the first type.
+  - "Last" is newest first by date, then by when it was logged, and only meetups dated today or earlier count.
+  - Ties go to the type used most recently.
+  - Type ids that no longer exist are ignored (those meetups don't count toward the 10 or the 30).
+- **It follows the friends.** It's worked out again whenever the picked friends change, until the owner taps a type chip; from then on their choice sticks.
+- **The chip shows.** When the suggestion changes, the suggested chip is scrolled into view in the What chip row, "nearest" style, moving only that row's horizontal scroll and never the sheet body.
+- **Edit** keeps the meetup's own type.
+- **Changes count** only when the owner taps a type that differs from the type the sheet opened with, so the suggestion alone never asks "Discard changes?".
+
 ## Room to search friends (owner feedback 5)
 
 - **Today the footer eats the space.** The sheet's footer (the block Save button, plus "Save and write about the day" when the keyboard is down) stays above the keyboard, so with the keyboard up the friend search results get about half the screen. Removing the footer (Save moves to the header, below) gives that room back.
@@ -84,6 +108,7 @@ Make logging a meetup complete and comfortable in one sheet: pick any friend wit
 - Before a friend is picked, Save is a disabled button, so VoiceOver reads "Save, dimmed". No hint or `aria-describedby` goes with it.
 - The day box has a label and a hint description.
 - The friend strip keeps a sensible VoiceOver order.
+- The suggested type is an ordinary selected chip (`aria-pressed="true"`), so VoiceOver reads it as selected.
 - 44px targets everywhere, and Dynamic Type at the largest sizes: the header wraps the title, Save stays tappable, and the strip's tiles grow with their names.
 
 ## DESIGN.md
@@ -96,7 +121,8 @@ Make logging a meetup complete and comfortable in one sheet: pick any friend wit
 
 **Unit tests:**
 - the place-line predicate matches `readDay` for every golden fixture line (each line is a place exactly when the grammar makes a stop from it);
-- friend ordering without the limit;
+- friend ordering without the limit: the general order (meetups in the last 90 days, then the most recent, then never seen by name) and the order from a friend's page (most often seen with them in the last 12 months first);
+- `suggestMeetupType`: the picked friends' last 10 meetups, the owner's last 30, the first type, ties by the most recent use, deleted types ignored, future meetups ignored;
 - any pure helper the highlight uses (for example, splitting text into marked and unmarked runs, including trailing newlines and an empty last line).
 
 **E2E tests:**
@@ -105,6 +131,9 @@ Make logging a meetup complete and comfortable in one sheet: pick any friend wit
 - **Discard.** Cancel with typed text asks to discard.
 - **Highlight.** A `mark.day-place` appears for "@ some place" and "@Blue willow 3:30", not for "@", nor for a sentence with "@" in the middle. It's on both the sheet box and The day page.
 - **Swiping friends.** With 12 friends, the 12th is reachable by scrolling the strip horizontally and can be picked, and the strip has more than 8 tiles.
+- **Who order.** The strip follows the general order, and from a friend's page their usual companions come first. E2e tests that depended on the old order are updated.
+- **Suggested type.** A friend whose meetups are all Meals gets Meal preselected when logging from their page; picking friends moves the suggestion (its chip scrolled into view without moving the sheet) until a type is tapped, which then sticks.
+- **Placement.** The day box comes right after When.
 - **Header Save.**
   - It's disabled before a friend is picked (and no "Pick a friend" text shows anywhere), and saves after.
   - Every existing e2e that clicked the footer Save or "Pick a friend" is updated to the header Save.
```

- [ ] **Step 2: Run everything**

Nothing to run: the spec only. The totals stay as Task 5 left them.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-10-21-sheet-details-design.md
git commit -F - <<'EOF'
docs: the owner's three additions to the sheet details design

After a hands-on UX review of the Log sheet the owner approved: a suggested
meetup type instead of always the first one (A), Who ordered by who you
actually see, with a preset friend's usual companions first (B), and The day
box right after When (C).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: The day comes right after When (addition C)

**Files:**
- Modify: `src/sheets/MeetupSheet.tsx`
- Test: `e2e/sheetDetails.spec.ts`

- [ ] **Step 1: Write the failing order test**

In `e2e/sheetDetails.spec.ts`:

```diff
--- a/e2e/sheetDetails.spec.ts
+++ b/e2e/sheetDetails.spec.ts
@@ -27,6 +27,21 @@ async function openLogMeetup(page: Page): Promise<Locator> {
 }
 
 test.describe('The day in the meetup sheets', () => {
+  test('comes right after When, before Activities and Photos', async ({ page }) => {
+    await page.goto('/')
+    await addFriend(page, 'Alex')
+    const sheet = await openLogMeetup(page)
+    await expect(sheet.locator('.sheet__body .form-section__label')).toHaveText([
+      'Who',
+      'What',
+      'When',
+      'The day',
+      'Activities',
+      'Photos',
+    ])
+    await expect(sheet.locator('.sheet__body > :last-child')).toHaveText('Save and write about the day')
+  })
+
   test('logs a meetup with The day typed in the sheet, and its place shows on the Meetup page', async ({ page }) => {
     await page.goto('/')
     await addFriend(page, 'Mariya')
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx playwright test --project=iphone e2e/sheetDetails.spec.ts -g "right after When"`
Expected: `1 failed`.

- [ ] **Step 3: Move the section**

In `src/sheets/MeetupSheet.tsx`:

```diff
--- a/src/sheets/MeetupSheet.tsx
+++ b/src/sheets/MeetupSheet.tsx
@@ -402,26 +402,6 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
         </div>
       </section>
 
-      <MeetupActivities
-        suggestions={suggestions}
-        selected={activities}
-        onChange={(next) => {
-          setActivities(next)
-          setError(null)
-        }}
-        draft={activityDraft}
-        onDraftChange={setActivityDraft}
-      />
-
-      {photos && (
-        <MeetupPhotos
-          photos={photos}
-          setPhotos={setPhotos}
-          onBusyChange={setAddingPhotos}
-          open={request !== null}
-        />
-      )}
-
       <section className="form-section" aria-labelledby={dayId}>
         <h3 id={dayId} className="form-section__label">
           The day
@@ -447,6 +427,26 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
         </p>
       </section>
 
+      <MeetupActivities
+        suggestions={suggestions}
+        selected={activities}
+        onChange={(next) => {
+          setActivities(next)
+          setError(null)
+        }}
+        draft={activityDraft}
+        onDraftChange={setActivityDraft}
+      />
+
+      {photos && (
+        <MeetupPhotos
+          photos={photos}
+          setPhotos={setPhotos}
+          onBusyChange={setAddingPhotos}
+          open={request !== null}
+        />
+      )}
+
       {/* Log meetup only: dimmed whenever Save is. */}
       {!editing && (
         <button
```

- [ ] **Step 4: Run the sheet tests**

Run: `npx playwright test --project=iphone e2e/sheetDetails.spec.ts`, then `npx playwright test --project=iphone e2e/sheetKeyboard.spec.ts e2e/memories.spec.ts e2e/meetups.spec.ts e2e/day.spec.ts`
Expected: `9 passed`, then `51 passed`.

- [ ] **Step 5: Run everything**

Run: `npx tsc -b`, then `npm test`
Expected: `Test Files  59 passed (59)` and `Tests  736 passed (736)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `186 passed`.

- [ ] **Step 6: Commit**

```bash
git add e2e/sheetDetails.spec.ts src/sheets/MeetupSheet.tsx
git commit -F - <<'EOF'
feat: The day comes right after When in the meetup sheets

The day box moves up from after Photos to right after When, before Activities
and Photos, so it's easy to reach (the owner's addition C).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 8: Who puts the friends you actually see first (addition B)

**Files:**
- Create: `src/stats/friendsToPick.ts`, `src/stats/friendsToPick.test.ts`
- Delete: `src/stats/recent.ts`, `src/stats/recent.test.ts` (replaced by the two above)
- Modify: `src/sheets/MeetupSheet.tsx`
- Test: `e2e/sheetDetails.spec.ts`

- [ ] **Step 1: Write the failing order tests**

The general order, the 90-day edge, ties by name, future meetups, every friend, and the order from a friend's page:

Create `src/stats/friendsToPick.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { friend, meetup, TODAY } from '../test/fixtures'
import type { Friend, Meetup } from '../types'
import { friendsToPick, OFTEN_DAYS, TOGETHER_DAYS } from './friendsToPick'

// TODAY is Fri, Oct 2, 2026. The last 90 days start on Jul 5; the last 12 months on Oct 3, 2025.

const ids = (friends: Friend[]) => friends.map((f) => f.id)
const people = (...names: string[]) => names.map((name) => friend(name.toLowerCase(), name))

describe('friendsToPick', () => {
  it('looks back 90 days for how often, and 12 months for who you see together', () => {
    expect(OFTEN_DAYS).toBe(90)
    expect(TOGETHER_DAYS).toBe(365)
  })

  it('puts the friends you met most in the last 90 days first, then the most recently seen, then the rest by name', () => {
    const friends = people('Ann', 'Bo', 'Cy', 'Di', 'Ed', 'al')
    const meetups = [
      meetup('m1', '2026-09-01', ['bo']),
      meetup('m2', '2026-08-15', ['bo']),
      meetup('m3', '2026-07-10', ['bo']),
      meetup('m4', '2026-10-01', ['ann']),
      meetup('m5', '2026-09-20', ['cy']),
      // Seen, but not in the last 90 days: after everyone met lately, before anyone never seen.
      meetup('m6', '2025-12-01', ['di']),
    ]
    expect(ids(friendsToPick(friends, meetups, TODAY))).toEqual(['bo', 'ann', 'cy', 'di', 'al', 'ed'])
  })

  it('counts a meetup 89 days ago as within the 90 days, and one 90 days ago as not', () => {
    const friends = people('Pat', 'Quin', 'Rae')
    const meetups = [
      meetup('p1', '2026-07-05', ['pat']),
      meetup('p2', '2026-09-01', ['pat']),
      meetup('q1', '2026-09-30', ['quin']),
      meetup('r1', '2026-07-04', ['rae']),
      meetup('r2', '2026-09-01', ['rae']),
    ]
    // Pat: 2 lately. Quin: 1, on Sep 30. Rae: 1 lately (Jul 4 is too long ago), on Sep 1.
    expect(ids(friendsToPick(friends, meetups, TODAY))).toEqual(['pat', 'quin', 'rae'])
  })

  it('breaks a tie of counts and dates by name', () => {
    const friends = people('Zoe', 'amy')
    const meetups = [meetup('m1', '2026-09-01', ['zoe', 'amy'])]
    expect(ids(friendsToPick(friends, meetups, TODAY))).toEqual(['amy', 'zoe'])
  })

  it('treats friends with only future meetups as never seen', () => {
    const friends = people('Bob', 'Ann')
    expect(ids(friendsToPick(friends, [meetup('m1', '2026-12-01', ['bob'])], TODAY))).toEqual(['ann', 'bob'])
  })

  it('lists every friend, however many there are', () => {
    const twelve = Array.from({ length: 12 }, (_, i) => friend(`f${i + 1}`, `Friend ${String(i + 1).padStart(2, '0')}`))
    const seen = [meetup('m1', '2026-09-30', ['f12']), meetup('m2', '2026-09-01', ['f7'])]
    expect(ids(friendsToPick(twelve, seen, TODAY))).toEqual([
      'f12',
      'f7',
      'f1',
      'f2',
      'f3',
      'f4',
      'f5',
      'f6',
      'f8',
      'f9',
      'f10',
      'f11',
    ])
  })

  describe('opened from a friend’s page', () => {
    const friends = people('Alex', 'Bo', 'Cy', 'Di', 'Ed', 'Fay')
    const meetups: Meetup[] = [
      // With Alex in the last 12 months: Bo twice, Cy once lately, Di once earlier.
      meetup('a1', '2026-06-01', ['alex', 'bo']),
      meetup('a2', '2026-03-01', ['bo', 'alex']),
      meetup('a3', '2026-09-01', ['alex', 'cy']),
      meetup('a4', '2025-11-01', ['alex', 'di']),
      // With Alex, but 12 months ago or more: not counted together.
      meetup('a5', '2025-10-02', ['alex', 'ed']),
      meetup('a6', '2025-06-01', ['alex', 'ed']),
      // Fay is seen most of all, never with Alex.
      meetup('f1', '2026-09-28', ['fay']),
      meetup('f2', '2026-09-20', ['fay']),
      meetup('f3', '2026-09-10', ['fay']),
      // Planned with Alex: not seen together yet.
      meetup('u1', '2026-12-01', ['alex', 'fay']),
    ]

    it('puts the friends most often seen with them first, then the most recent together, then everyone else', () => {
      // Everyone else, in the general order: Fay (3 lately), Alex (1 lately), Ed (seen longest ago).
      expect(ids(friendsToPick(friends, meetups, TODAY, 'alex'))).toEqual(['bo', 'cy', 'di', 'fay', 'alex', 'ed'])
    })

    it('keeps the general order without a friend, or for a friend seen with no one', () => {
      expect(ids(friendsToPick(friends, meetups, TODAY))).toEqual(['fay', 'alex', 'cy', 'bo', 'di', 'ed'])
      expect(ids(friendsToPick(friends, meetups, TODAY, 'nobody'))).toEqual(ids(friendsToPick(friends, meetups, TODAY)))
    })

    it('keeps the general order between companions seen together as often and as recently', () => {
      // Di and Ed were each with Alex once, on the same day; Ed is seen more in general, so Ed comes first.
      const together = meetup('t1', '2026-09-01', ['alex', 'ed', 'di'])
      const order = ids(friendsToPick(friends, [together, meetup('e1', '2026-09-15', ['ed'])], TODAY, 'alex'))
      expect(order.slice(0, 2)).toEqual(['ed', 'di'])
    })
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/stats/friendsToPick.test.ts`
Expected: every test fails (`friendsToPick` isn't there yet).

- [ ] **Step 3: Write the order**

Create `src/stats/friendsToPick.ts`:

```ts
import { addDays, type ISODate } from '../lib/dates'
import { compareNames } from '../lib/text'
import type { Friend, Meetup } from '../types'
import { lastSeenByFriend } from './lastSeen'

/** "How often you meet" counts the meetups of the 90 days ending today. */
export const OFTEN_DAYS = 90
/** From a friend's page, "seen together" counts the meetups of the 12 months (365 days) ending today. */
export const TOGETHER_DAYS = 365

/** How many meetups a friend was at, and the latest of them. */
interface Tally {
  count: number
  last: ISODate
}

/** Each friend's tally over the meetups given. */
function tallyByFriend(meetups: Meetup[], skip?: string): Map<string, Tally> {
  const tallies = new Map<string, Tally>()
  for (const meetup of meetups) {
    for (const friendId of meetup.friendIds) {
      if (friendId === skip) continue
      const tally = tallies.get(friendId)
      if (!tally) tallies.set(friendId, { count: 1, last: meetup.date })
      else {
        tally.count += 1
        if (meetup.date > tally.last) tally.last = meetup.date
      }
    }
  }
  return tallies
}

/**
 * Every friend, in the order the meetup sheet's Who shows them: the friends you met most in the last 90 days first,
 * then by their most recent meetup, then never-seen friends by name. Only meetups dated today or earlier count.
 *
 * With `presetFriendId` (the sheet opened from that friend's page), the friends most often seen together with them in
 * the last 12 months come first (more meetups together first, then the most recent together), then everyone else in
 * the order above, the preset friend included.
 */
export function friendsToPick(
  friends: Friend[],
  meetups: Meetup[],
  today: ISODate,
  presetFriendId?: string | null,
): Friend[] {
  const past = meetups.filter((meetup) => meetup.date <= today)
  const lastSeen = lastSeenByFriend(past, today)
  const oftenFrom = addDays(today, -(OFTEN_DAYS - 1))
  const often = tallyByFriend(past.filter((meetup) => meetup.date >= oftenFrom))
  const ordered = [...friends].sort((a, b) => {
    const seenA = lastSeen.get(a.id)
    const seenB = lastSeen.get(b.id)
    if (seenA === undefined || seenB === undefined) {
      if (seenA !== seenB) return seenA === undefined ? 1 : -1
      return compareNames(a.name, b.name)
    }
    const byCount = (often.get(b.id)?.count ?? 0) - (often.get(a.id)?.count ?? 0)
    if (byCount !== 0) return byCount
    if (seenA !== seenB) return seenA > seenB ? -1 : 1
    return compareNames(a.name, b.name)
  })
  if (!presetFriendId) return ordered

  const togetherFrom = addDays(today, -(TOGETHER_DAYS - 1))
  const together = tallyByFriend(
    past.filter((meetup) => meetup.date >= togetherFrom && meetup.friendIds.includes(presetFriendId)),
    presetFriendId,
  )
  // A stable sort, so companions seen together as often and as recently keep the order above.
  const companions = ordered
    .filter((friend) => together.has(friend.id))
    .sort((a, b) => {
      const withA = together.get(a.id)!
      const withB = together.get(b.id)!
      if (withA.count !== withB.count) return withB.count - withA.count
      if (withA.last !== withB.last) return withA.last > withB.last ? -1 : 1
      return 0
    })
  return [...companions, ...ordered.filter((friend) => !together.has(friend.id))]
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/stats/friendsToPick.test.ts`
Expected: `9 passed`.

- [ ] **Step 5: Use it in the sheet, with an e2e for both orders**

Delete `src/stats/recent.ts` and `src/stats/recent.test.ts`, which nothing uses now, and switch the sheet:

In `src/sheets/MeetupSheet.tsx`:

```diff
--- a/src/sheets/MeetupSheet.tsx
+++ b/src/sheets/MeetupSheet.tsx
@@ -27,7 +27,7 @@ import { DAY_MAX_TYPED } from '../lib/dayText'
 import { isPlainEnter } from '../lib/keys'
 import { askToKeepData } from '../lib/persist'
 import { compareNames, formatNameList } from '../lib/text'
-import { recentFriends } from '../stats/recent'
+import { friendsToPick } from '../stats/friendsToPick'
 import type { Friend } from '../types'
 import { MeetupActivities } from './MeetupActivities'
 import { MeetupPhotos, type DraftPhoto } from './MeetupPhotos'
@@ -114,9 +114,11 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
 
   const friendById = useMemo(() => new Map((friends ?? []).map((f) => [f.id, f] as const)), [friends])
   const selected = friendIds.map((id) => friendById.get(id)).filter((f): f is Friend => f !== undefined)
-  const byLastSeen = useMemo(
-    () => (friends && meetups ? recentFriends(friends, meetups, today) : []),
-    [friends, meetups, today],
+  // Who you see most first; from a friend's page, the friends usually with them. Picking friends never reorders it.
+  const presetFriendId = initial?.presetFriendId
+  const toPick = useMemo(
+    () => (friends && meetups ? friendsToPick(friends, meetups, today, presetFriendId) : []),
+    [friends, meetups, today, presetFriendId],
   )
   const results = useMemo(() => {
     const q = query.trim().toLocaleLowerCase()
@@ -271,14 +273,14 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
             ))}
           </div>
         )}
-        {byLastSeen.length > 0 && (
+        {toPick.length > 0 && (
           <div
             className="friend-strip"
-            data-swipes={byLastSeen.length > STILL_GRID_MAX}
+            data-swipes={toPick.length > STILL_GRID_MAX}
             role="group"
             aria-label="Friends"
           >
-            {byLastSeen.map((friend) => {
+            {toPick.map((friend) => {
               const on = friendIds.includes(friend.id)
               return (
                 <button
```

In `e2e/sheetDetails.spec.ts`:

```diff
--- a/e2e/sheetDetails.spec.ts
+++ b/e2e/sheetDetails.spec.ts
@@ -4,6 +4,7 @@ import {
   editMeetup,
   friendRow,
   logMeetup,
+  meetupRow,
   openDay,
   openFriendPage,
   readMeetups,
@@ -14,6 +15,13 @@ import {
 // Most tests add a friend and log a meetup first, so they get more time than most.
 test.describe.configure({ timeout: 60_000 })
 
+/** The local date `days` ago (negative for the future), as an ISO date. */
+function daysAgo(days: number): string {
+  const date = new Date()
+  date.setDate(date.getDate() - days)
+  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
+}
+
 /** In an open meetup sheet: The day box. */
 function sheetDay(sheet: Locator): Locator {
   return sheet.getByRole('textbox', { name: 'The day' })
@@ -250,3 +258,39 @@ test.describe('swiping through friends', () => {
     expect(await strip.evaluate((element) => element.scrollWidth <= element.clientWidth), 'Nothing to swipe').toBe(true)
   })
 })
+
+test.describe('who comes first in Who', () => {
+  // Bo: 3 meetups lately. Cy: 1, yesterday. Di and Ed: only months ago, together with each other and once Cy and Di.
+  // Ana: never.
+  const friends = ['Ana', 'Bo', 'Cy', 'Di', 'Ed'].map((name) => friendRow(name.toLowerCase(), name))
+  const meetups = [
+    meetupRow('b1', daysAgo(10), ['bo']),
+    meetupRow('b2', daysAgo(20), ['bo']),
+    meetupRow('b3', daysAgo(30), ['bo']),
+    meetupRow('c1', daysAgo(1), ['cy']),
+    meetupRow('d1', daysAgo(200), ['di', 'ed']),
+    meetupRow('d2', daysAgo(250), ['ed', 'di']),
+    meetupRow('d3', daysAgo(300), ['di', 'cy']),
+  ]
+
+  test('the friends you met most lately come first, then the most recently seen, then the rest by name', async ({
+    page,
+  }) => {
+    await page.goto('/')
+    await seedMeetups(page, { friends, meetups })
+    const sheet = await openLogMeetup(page)
+    const names = sheet.getByRole('group', { name: 'Friends', exact: true }).locator('.friend-tile__name')
+    await expect(names).toHaveText(['Bo', 'Cy', 'Di', 'Ed', 'Ana'])
+  })
+
+  test('from a friend’s page, the friends usually with them come first', async ({ page }) => {
+    await page.goto('/')
+    await seedMeetups(page, { friends, meetups })
+    await openFriendPage(page, 'Di')
+    const sheet = await openLogMeetup(page)
+    const strip = sheet.getByRole('group', { name: 'Friends', exact: true })
+    // Ed was with Di twice, Cy once; then everyone else as above, Di included and picked.
+    await expect(strip.locator('.friend-tile__name')).toHaveText(['Ed', 'Cy', 'Bo', 'Di', 'Ana'])
+    await expect(strip.getByRole('button', { name: 'Di' })).toHaveAttribute('aria-pressed', 'true')
+  })
+})
```

- [ ] **Step 6: Run the sheet tests**

Run: `npx playwright test --project=iphone e2e/sheetDetails.spec.ts`
Expected: `11 passed`. No existing e2e depended on the old order.

- [ ] **Step 7: Run everything**

Run: `npx tsc -b`, then `npm test`
Expected: `Test Files  59 passed (59)` and `Tests  741 passed (741)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `188 passed`.

- [ ] **Step 8: Commit**

```bash
git rm src/stats/recent.test.ts src/stats/recent.ts
git add e2e/sheetDetails.spec.ts src/sheets/MeetupSheet.tsx src/stats/friendsToPick.test.ts src/stats/friendsToPick.ts
git commit -F - <<'EOF'
feat: Who puts the friends you actually see first

The friend tiles are ranked by how many meetups you had with each friend in the
last 90 days, then by the most recent meetup, then never-seen friends by name.
Opened from a friend's page, the friends most often seen together with that
friend in the last 12 months come first (more together first, then the most
recent together), then everyone else in that order. Only meetups dated today
or earlier count, and picking friends never reorders the tiles. recentFriends
becomes friendsToPick (the owner's addition B).

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 9: A suggested meetup type (addition A)

**Files:**
- Create: `src/stats/suggestType.ts`, `src/stats/suggestType.test.ts`
- Modify: `src/sheets/MeetupSheet.tsx`, `e2e/helpers.ts`
- Test: `e2e/sheetDetails.spec.ts`

- [ ] **Step 1: Write the failing rule tests**

Create `src/stats/suggestType.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { meetup, meetupType, TODAY } from '../test/fixtures'
import type { Meetup } from '../types'
import { SUGGEST_FROM_ALL, SUGGEST_FROM_FRIENDS, suggestMeetupType } from './suggestType'

const types = [meetupType('coffee', 'Coffee', 0), meetupType('meal', 'Meal', 1), meetupType('drinks', 'Drinks', 2)]

/** `count` meetups of one type with these friends, one a day going back from `newest` days before Oct 2. */
function run(prefix: string, count: number, friendIds: string[], typeId: string, newest = 1): Meetup[] {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(Date.UTC(2026, 9, 2 - newest - i)).toISOString().slice(0, 10)
    return meetup(`${prefix}${i}`, date, friendIds, typeId)
  })
}

describe('suggestMeetupType', () => {
  it('looks at the picked friends’ last 10 meetups, then the owner’s last 30', () => {
    expect(SUGGEST_FROM_FRIENDS).toBe(10)
    expect(SUGGEST_FROM_ALL).toBe(30)
  })

  it('suggests the type most common among the meetups with any of the picked friends', () => {
    const meetups = [...run('a', 3, ['alex'], 'meal'), ...run('s', 2, ['sam'], 'drinks'), ...run('o', 9, ['other'], 'coffee')]
    expect(suggestMeetupType(meetups, ['alex'], types, TODAY)).toBe('meal')
    expect(suggestMeetupType(meetups, ['sam'], types, TODAY)).toBe('drinks')
    expect(suggestMeetupType(meetups, ['alex', 'sam'], types, TODAY)).toBe('meal')
  })

  it('counts only the last 10 meetups with them', () => {
    // The newest 10 with Alex: 6 coffees and 4 meals. Five more meals before them don't count.
    const meetups = [...run('c', 6, ['alex'], 'coffee', 1), ...run('m', 4, ['alex'], 'meal', 7), ...run('o', 5, ['alex'], 'meal', 11)]
    expect(suggestMeetupType(meetups, ['alex'], types, TODAY)).toBe('coffee')
  })

  it('falls back to the owner’s most-used type in their last 30 meetups', () => {
    // The newest 30: 16 drinks and 14 coffees. Twenty older coffees don't count.
    const meetups = [...run('d', 16, ['sam'], 'drinks', 1), ...run('c', 14, ['kim'], 'coffee', 17), ...run('o', 20, ['kim'], 'coffee', 31)]
    expect(suggestMeetupType(meetups, ['new-friend'], types, TODAY)).toBe('drinks')
    expect(suggestMeetupType(meetups, [], types, TODAY)).toBe('drinks')
  })

  it('falls back to the first type with no meetups, and to nothing with no types', () => {
    expect(suggestMeetupType([], ['alex'], types, TODAY)).toBe('coffee')
    expect(suggestMeetupType([], [], [], TODAY)).toBeNull()
  })

  it('breaks a tie with the type used most recently', () => {
    const meetups = [
      meetup('m1', '2026-09-10', ['alex'], 'meal'),
      meetup('c1', '2026-09-01', ['alex'], 'coffee'),
      meetup('c2', '2026-08-01', ['alex'], 'coffee'),
      meetup('m2', '2026-07-01', ['alex'], 'meal'),
    ]
    expect(suggestMeetupType(meetups, ['alex'], types, TODAY)).toBe('meal')
    // On the same day, the one logged later is the more recent.
    const sameDay = [
      { ...meetup('d1', '2026-09-10', ['alex'], 'drinks'), createdAt: '2026-09-10T20:00:00.000Z' },
      { ...meetup('c3', '2026-09-10', ['alex'], 'coffee'), createdAt: '2026-09-10T09:00:00.000Z' },
    ]
    expect(suggestMeetupType(sameDay, ['alex'], types, TODAY)).toBe('drinks')
  })

  it('ignores types that no longer exist, which take none of the 10', () => {
    // Alex's 10 newest are of a deleted type, so his one Meal before them decides (not the owner's Drinks).
    const meetups = [
      ...run('g', 10, ['alex'], 'deleted-type', 1),
      meetup('m1', '2026-01-01', ['alex'], 'meal'),
      ...run('d', 2, ['sam'], 'drinks', 20),
    ]
    expect(suggestMeetupType(meetups, ['alex'], types, TODAY)).toBe('meal')
    // Only deleted types with the friend: the owner's habits decide.
    expect(suggestMeetupType([...run('g', 3, ['alex'], 'deleted-type'), ...run('d', 2, ['sam'], 'drinks')], ['alex'], types, TODAY)).toBe(
      'drinks',
    )
  })

  it('ignores meetups that haven’t happened yet', () => {
    const meetups = [...run('t', 3, ['alex'], 'drinks', -10), meetup('m1', '2026-09-01', ['alex'], 'meal')]
    expect(suggestMeetupType(meetups, ['alex'], types, TODAY)).toBe('meal')
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/stats/suggestType.test.ts`
Expected: it can't find `./suggestType`.

- [ ] **Step 3: Write the rule**

Create `src/stats/suggestType.ts`:

```ts
import type { ISODate } from '../lib/dates'
import type { Meetup, MeetupType } from '../types'
import { newestFirst } from './history'

/** How many of the picked friends' latest meetups the suggestion looks at. */
export const SUGGEST_FROM_FRIENDS = 10
/** How many of the owner's latest meetups it looks at when the picked friends have none. */
export const SUGGEST_FROM_ALL = 30

/** The most common type among meetups listed newest first; a tie goes to the type used most recently. */
function mostCommonType(meetups: Meetup[]): string | null {
  // A Map keeps the order types were first met in, newest first, so a strict "more" keeps the newer on a tie.
  const counts = new Map<string, number>()
  for (const meetup of meetups) counts.set(meetup.typeId, (counts.get(meetup.typeId) ?? 0) + 1)
  let best: string | null = null
  for (const [typeId, count] of counts) {
    if (best === null || count > counts.get(best)!) best = typeId
  }
  return best
}

/**
 * The type a new meetup starts on until the owner taps one: the most common among the last 10 meetups with any of
 * the picked friends; with none, the owner's most-used type across their last 30 meetups; with none, the first type.
 * "Last" is newest first (by date, then when it was logged), counting only meetups dated today or earlier whose
 * type still exists. A tie goes to the type used most recently. Null only when there are no types at all.
 */
export function suggestMeetupType(
  meetups: Meetup[],
  friendIds: readonly string[],
  types: readonly MeetupType[],
  today: ISODate,
): string | null {
  const known = new Set(types.map((type) => type.id))
  const history = meetups.filter((meetup) => meetup.date <= today && known.has(meetup.typeId)).sort(newestFirst)
  const picked = new Set(friendIds)
  const withFriends = history.filter((meetup) => meetup.friendIds.some((id) => picked.has(id)))
  return (
    mostCommonType(withFriends.slice(0, SUGGEST_FROM_FRIENDS)) ??
    mostCommonType(history.slice(0, SUGGEST_FROM_ALL)) ??
    types[0]?.id ??
    null
  )
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/stats/suggestType.test.ts`
Expected: `8 passed`.

- [ ] **Step 5: Write the failing sheet tests**

Meal from the page of a friend whose meetups are all Meals (and no "Discard changes?" for a suggestion), the suggestion following the friends picked until a type is tapped, a far chip scrolled into view in its row while the sheet stays put (started from a friend's page, so no row of picked friends appears above and WebKit's scroll anchoring stays out of it), and Edit keeping its own type. `logMeetup` now always taps its type:

In `e2e/sheetDetails.spec.ts`:

```diff
--- a/e2e/sheetDetails.spec.ts
+++ b/e2e/sheetDetails.spec.ts
@@ -183,11 +183,11 @@ test.describe('@ highlighting', () => {
   })
 })
 
-/** Whether a friend's tile shows whole inside the strip's visible part. */
+/** Whether a friend's tile (or a type chip) shows whole, side to side, inside the strip (or row) that scrolls it. */
 function shownInStrip(tile: Locator): Promise<boolean> {
   return tile.evaluate((element) => {
     const strip = element.closest('[role="group"]')
-    if (!strip) throw new Error('Not in the strip')
+    if (!strip) throw new Error('Not in a group')
     const tileRect = element.getBoundingClientRect()
     const stripRect = strip.getBoundingClientRect()
     return tileRect.left >= stripRect.left - 0.5 && tileRect.right <= stripRect.right + 0.5
@@ -294,3 +294,99 @@ test.describe('who comes first in Who', () => {
     await expect(strip.getByRole('button', { name: 'Di' })).toHaveAttribute('aria-pressed', 'true')
   })
 })
+
+test.describe('the suggested meetup type', () => {
+  // Jamie's meetups are all Meals. Kim's are Drinks, the owner's most-used type. Lee's one meetup is a Trip, a type
+  // far along the What row.
+  const friends = [friendRow('jamie', 'Jamie'), friendRow('kim', 'Kim'), friendRow('lee', 'Lee')]
+  const meetups = [
+    ...[3, 10, 20].map((days, i) => meetupRow(`j${i}`, daysAgo(days), ['jamie'], { typeId: 'type-meal' })),
+    ...[2, 5, 8, 12, 15].map((days, i) => meetupRow(`k${i}`, daysAgo(days), ['kim'], { typeId: 'type-drinks' })),
+    meetupRow('l0', daysAgo(40), ['lee'], { typeId: 'type-trip' }),
+  ]
+
+  /** In an open meetup sheet: the What row's selected chip. */
+  function pickedType(sheet: Locator): Locator {
+    return sheet.getByRole('group', { name: 'What' }).locator('[aria-pressed="true"]')
+  }
+
+  test('a friend whose meetups are all Meals gets Meal when logging from their page', async ({ page }) => {
+    await page.goto('/')
+    await seedMeetups(page, { friends, meetups })
+    await openFriendPage(page, 'Jamie')
+    let sheet = await openLogMeetup(page)
+    await expect(pickedType(sheet)).toHaveCount(1)
+    await expect(pickedType(sheet)).toHaveText(/Meal/)
+    // A suggestion isn't a change: Cancel closes without asking.
+    await sheet.getByRole('button', { name: 'Cancel' }).click()
+    await expect(sheet).toBeHidden()
+    await expect(page.getByRole('alertdialog')).toHaveCount(0)
+
+    sheet = await openLogMeetup(page)
+    await expect(pickedType(sheet)).toHaveText(/Meal/)
+    await sheetSave(sheet).click()
+    await expect(sheet).toBeHidden()
+    expect((await readMeetups(page)).at(-1)).toMatchObject({ typeId: 'type-meal', friendIds: ['jamie'] })
+  })
+
+  test('the suggestion follows the friends picked until a type is tapped, which then sticks', async ({ page }) => {
+    await page.goto('/')
+    await seedMeetups(page, { friends, meetups })
+    const sheet = await openLogMeetup(page)
+    const strip = sheet.getByRole('group', { name: 'Friends', exact: true })
+    // No friend yet: the owner's most-used type.
+    await expect(pickedType(sheet)).toHaveText(/Drinks/)
+    await strip.getByRole('button', { name: 'Jamie' }).click()
+    await expect(pickedType(sheet)).toHaveText(/Meal/)
+    // With Kim too: 5 Drinks to 3 Meals.
+    await strip.getByRole('button', { name: 'Kim' }).click()
+    await expect(pickedType(sheet)).toHaveText(/Drinks/)
+
+    await sheet.getByRole('group', { name: 'What' }).getByRole('button', { name: 'Coffee', exact: true }).click()
+    await strip.getByRole('button', { name: 'Kim' }).click()
+    await expect(pickedType(sheet)).toHaveText(/Coffee/)
+    await sheetSave(sheet).click()
+    expect((await readMeetups(page)).at(-1)).toMatchObject({ typeId: 'type-coffee', friendIds: ['jamie'] })
+  })
+
+  test('a suggestion far along the What row scrolls into view there, and the sheet stays where it is', async ({ page }) => {
+    await page.goto('/')
+    await seedMeetups(page, { friends, meetups })
+    // From Kim's page, so the row of picked friends is already there and nothing above moves the sheet's content.
+    await openFriendPage(page, 'Kim')
+    const sheet = await openLogMeetup(page)
+    await sheet.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)))
+    const what = sheet.getByRole('group', { name: 'What' })
+    const trip = what.getByRole('button', { name: 'Trip', exact: true })
+    await expect(pickedType(sheet)).toHaveText(/Drinks/)
+    expect(await shownInStrip(trip)).toBe(false)
+    // Scrolled to the end of the sheet, away from Who and What. The taps on the tiles are made in the page, so the
+    // test doesn't scroll the sheet to reach them.
+    const body = sheet.locator('.sheet__body')
+    await body.evaluate((element) => {
+      element.scrollTop = element.scrollHeight
+    })
+    const before = await body.evaluate((element) => element.scrollTop)
+    const strip = sheet.getByRole('group', { name: 'Friends', exact: true })
+    const tap = (name: string) => strip.getByRole('button', { name }).evaluate((element) => (element as HTMLElement).click())
+    await tap('Lee')
+    await expect(pickedType(sheet)).toHaveText(/Drinks/)
+    // Lee alone: his Trip.
+    await tap('Kim')
+    await expect(trip).toHaveAttribute('aria-pressed', 'true')
+    await expect.poll(() => shownInStrip(trip)).toBe(true)
+    expect(await body.evaluate((element) => element.scrollTop), 'The sheet did not move').toBe(before)
+  })
+
+  test('Edit keeps the meetup’s own type', async ({ page }) => {
+    await page.goto('/')
+    // A Coffee with Kim, whose other meetups are all Drinks.
+    await seedMeetups(page, { friends, meetups: [...meetups, meetupRow('kc', daysAgo(1), ['kim'], { typeId: 'type-coffee' })] })
+    await openFriendPage(page, 'Kim')
+    const sheet = await editMeetup(page, /Coffee/)
+    await expect(pickedType(sheet)).toHaveText(/Coffee/)
+    await sheet.getByRole('button', { name: 'Cancel' }).click()
+    await expect(sheet).toBeHidden()
+    await expect(page.getByRole('alertdialog')).toHaveCount(0)
+  })
+})
```

In `e2e/helpers.ts`:

```diff
--- a/e2e/helpers.ts
+++ b/e2e/helpers.ts
@@ -48,7 +48,8 @@ export async function logMeetup(
     await sheet.getByLabel('Search all friends').fill(name)
     await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name, exact: true }).click()
   }
-  if (options.type) await sheet.getByRole('button', { name: options.type, exact: true }).click()
+  // Always tapped, so the type never depends on the sheet's suggestion: Coffee unless `type` says otherwise.
+  await sheet.getByRole('button', { name: options.type ?? 'Coffee', exact: true }).click()
   if (options.date) await sheet.getByLabel('Pick date').fill(options.date)
   for (const activity of options.activities ?? []) await pickActivity(sheet, activity)
   if (options.photos) await addPhotos(sheet, options.photos)
```

- [ ] **Step 6: Run them to see them fail**

Run: `npx playwright test --project=iphone e2e/sheetDetails.spec.ts -g "suggest|Edit keeps"`
Expected: `3 failed | 1 passed` (Edit already keeps its type).

- [ ] **Step 7: Suggest the type in the sheet**

In `src/sheets/MeetupSheet.tsx`:

```diff
--- a/src/sheets/MeetupSheet.tsx
+++ b/src/sheets/MeetupSheet.tsx
@@ -1,4 +1,4 @@
-import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
+import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
 import { useLocation, useNavigate } from 'react-router'
 import { useConfirmDiscard } from '../components/ActionSheet'
 import { Avatar } from '../components/Avatar'
@@ -27,7 +27,9 @@ import { DAY_MAX_TYPED } from '../lib/dayText'
 import { isPlainEnter } from '../lib/keys'
 import { askToKeepData } from '../lib/persist'
 import { compareNames, formatNameList } from '../lib/text'
+import { revealOffset } from '../lib/viewport'
 import { friendsToPick } from '../stats/friendsToPick'
+import { suggestMeetupType } from '../stats/suggestType'
 import type { Friend } from '../types'
 import { MeetupActivities } from './MeetupActivities'
 import { MeetupPhotos, type DraftPhoto } from './MeetupPhotos'
@@ -84,6 +86,7 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
   const savingRef = useRef(false)
   const searchRef = useRef<HTMLInputElement>(null)
   const errorRef = useRef<HTMLParagraphElement>(null)
+  const typeRowRef = useRef<HTMLDivElement>(null)
 
   // Photos change only in the sheet until Save. A saved meetup's photos load once, as ids and thumbnails.
   const storedPhotos = useMeetupPhotoThumbs(editing?.id)
@@ -108,7 +111,26 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
     if (error) errorRef.current?.scrollIntoView({ block: 'nearest' })
   }, [error])
 
-  const effectiveTypeId = typeId ?? types?.[0]?.id ?? null
+  // A new meetup starts on a suggested type, worked out again as friends are picked, until a type is tapped; from
+  // then on the tapped one sticks. An edit keeps its own type, which typeId starts as.
+  const suggestedTypeId = useMemo(
+    () => (types ? suggestMeetupType(meetups ?? [], friendIds, types, today) : null),
+    [meetups, friendIds, types, today],
+  )
+  const effectiveTypeId = typeId ?? suggestedTypeId
+  // A new suggestion's chip comes into view in the What row, as little as it takes, moving only the row's own
+  // sideways scroll and never the sheet (the row may be scrolled out of sight while friends are picked).
+  useLayoutEffect(() => {
+    const row = typeRowRef.current
+    const chip = row?.children[types?.findIndex((type) => type.id === suggestedTypeId) ?? -1]
+    if (typeId !== null || !row || !(chip instanceof HTMLElement)) return
+    const view = row.getBoundingClientRect()
+    const target = chip.getBoundingClientRect()
+    // Spans along the row: its visible part and the chip, with the row's side padding to spare.
+    const margin = parseFloat(getComputedStyle(row).paddingLeft) || 0
+    const offset = revealOffset({ top: view.left, bottom: view.right }, { top: target.left, bottom: target.right }, margin)
+    if (offset !== 0) row.scrollLeft += offset
+  }, [suggestedTypeId, typeId, types])
   const yesterday = addDays(today, -1)
   const isOtherDate = date !== today && date !== yesterday
 
@@ -129,11 +151,11 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
       .slice(0, 20)
   }, [friends, query])
 
-  const startTypeId = start.typeId ?? types?.[0]?.id ?? null
   const sameFriends = [...friendIds].sort().join() === [...start.friendIds].sort().join()
+  // Only a tapped type counts as a change: a suggestion alone never asks "Discard changes?".
   const dirty =
     !sameFriends ||
-    effectiveTypeId !== startTypeId ||
+    typeId !== start.typeId ||
     date !== start.date ||
     activities.join('\n') !== start.activities.join('\n') ||
     !!activityDraft?.trim() ||
@@ -348,7 +370,7 @@ export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
         <h3 id={whatId} className="form-section__label">
           What
         </h3>
-        <div className="chip-row" role="group" aria-labelledby={whatId}>
+        <div ref={typeRowRef} className="chip-row" role="group" aria-labelledby={whatId}>
           {(types ?? []).map((type) => (
             <Chip key={type.id} selected={type.id === effectiveTypeId} onClick={() => {
                 setTypeId(type.id)
```

- [ ] **Step 8: Run them to see them pass**

Run: `npx playwright test --project=iphone e2e/sheetDetails.spec.ts`
Expected: `15 passed`.

- [ ] **Step 9: Run everything**

Run: `npx tsc -b`, then `npm test`
Expected: `Test Files  60 passed (60)` and `Tests  749 passed (749)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `192 passed`.

- [ ] **Step 10: Commit**

```bash
git add e2e/helpers.ts e2e/sheetDetails.spec.ts src/sheets/MeetupSheet.tsx src/stats/suggestType.test.ts src/stats/suggestType.ts
git commit -F - <<'EOF'
feat: a new meetup starts on a suggested type, not always the first

Until the owner taps a type, a new meetup's type is suggested by
suggestMeetupType: the most common among the last 10 meetups with any of the
picked friends, else the owner's most-used type in their last 30 meetups, else
the first type. Ties go to the type used most recently; deleted types and
future meetups don't count. It follows the picked friends until a type is
tapped, which then sticks, and its chip scrolls into view in the What row
without moving the sheet. Edit keeps the meetup's own type, and a suggestion
alone never asks "Discard changes?" (the owner's addition A). The e2e logMeetup
helper now always taps its type, Coffee unless told otherwise.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 10: Screenshots, DESIGN.md, and the decisions in the spec

**Files:**
- Modify: `e2e/screenshots.spec.ts`, `DESIGN.md`, `docs/superpowers/specs/2026-10-21-sheet-details-design.md`

- [ ] **Step 1: Capture the sheet**

`03-log-sheet` now shows the strip and the header Save with the body at its top; `21-log-day` shows The day with a tinted place line; `22-log-search` shows the search at the top over the fake keyboard. The day box is emptied again before "Save and write about the day", so `15-day-empty` stays empty.

In `e2e/screenshots.spec.ts`:

```diff
--- a/e2e/screenshots.spec.ts
+++ b/e2e/screenshots.spec.ts
@@ -124,16 +124,38 @@ async function captureAll(page: Page, prefix: string) {
   // Where the search field, the chips and the friend list land below Birthdays soon and Recent meetups.
   await captureFullList(page, `${DIR}/${prefix}-02-friends-full.png`)
 
-  // The Log sheet's footer, then the day page written through it.
+  // The Log sheet: the friend search over the keyboard, then Save at the top right over every friend's tile, then The
+  // day with a place line tinted, then the day page written through it.
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
+  const body = sheet.locator('.sheet__body')
+  const search = sheet.getByLabel('Search all friends')
+  await search.focus()
+  await openKeyboard(page)
+  await search.fill('a')
+  await page.waitForTimeout(500)
+  await page.screenshot({ path: `${DIR}/${prefix}-22-log-search.png` })
+  await search.fill('')
+  await closeKeyboard(page)
   for (const name of ['Mariya', 'Jessie', 'Brandon']) {
-    await sheet.getByLabel('Search all friends').fill(name)
+    await search.fill(name)
     await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name, exact: true }).click()
   }
   await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
+  await search.blur()
+  await body.evaluate((element) => {
+    element.scrollTop = 0
+  })
   await page.waitForTimeout(500)
   await page.screenshot({ path: `${DIR}/${prefix}-03-log-sheet.png` })
+  const sheetDay = sheet.getByRole('textbox', { name: 'The day' })
+  await sheetDay.fill('@Blue willow 3:30\nKung pao chicken, garlic string beans and jasmine dragon pearl tea\nJessie paid')
+  await sheetDay.blur()
+  await sheetDay.evaluate((element) => element.scrollIntoView({ block: 'center' }))
+  await page.waitForTimeout(500)
+  await page.screenshot({ path: `${DIR}/${prefix}-21-log-day.png` })
+  // The day page opens empty for the captures that follow.
+  await sheetDay.fill('')
   await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
   await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
   await page.waitForTimeout(500)
```

- [ ] **Step 2: Take them and look**

Run: `npm run screenshots`
Expected: `15 passed`. Look at `light-03-log-sheet.png`, `dark-21-log-day.png`, `large-text-03-log-sheet.png`, `large-text-21-log-day.png`, `light-22-log-search.png` and `light-16-day-written.png` (eight tinted places; the "@seoulsaloon" mid-sentence untinted).

- [ ] **Step 3: Update DESIGN.md**

In `DESIGN.md`:

```diff
--- a/DESIGN.md
+++ b/DESIGN.md
@@ -190,6 +190,10 @@ components:
   photo-viewer:
     backgroundColor: "{colors.viewer-ground}"
     textColor: "{colors.viewer-ink}"
+  place-tint:
+    backgroundColor: "{colors.peach-wash}"
+    rounded: "0.35em"
+    padding: "0.1em 0.2em"
 ---
 
 # Design System: Friend Tracker
@@ -292,9 +296,9 @@ Flat by default, with depth from tonal layering, as in iOS Settings: Paper White
 
 ### Buttons
 - **Shape:** fully rounded pills (`999px`), at least 44px tall.
-- **Primary:** Peach fill, On-Peach 600 text, `0 1.25rem` padding. Pressed: Peach Pressed and a 0.97 scale over 160ms. Disabled: 45% opacity. The sheet footer uses the block variant: full width, 52px tall, 1.06rem.
+- **Primary:** Peach fill, On-Peach 600 text, `0 1.25rem` padding. Pressed: Peach Pressed and a 0.97 scale over 160ms. Disabled: 45% opacity. The block variant is full width, 52px tall, 1.06rem: the buttons in the group, type and lock sheets' footers, and (Secondary) "Save and write about the day" at the end of the Log meetup sheet.
 - **Secondary:** Linen fill, Warm Ink text, same shape.
-- **Text button:** no fill, Terracotta Ink text, 44×44 minimum, fades to 50% opacity on press. Used for Cancel, Edit, and the back button. The back button always keeps its chevron; a long label truncates with an ellipsis instead.
+- **Text button:** no fill, Terracotta Ink text, 44×44 minimum, fades to 50% opacity on press. Used for Cancel, Edit, the back button, and a sheet's Save at the top right (600 weight; dimmed to 45% while it can't save). The back button always keeps its chevron; a long label truncates with an ellipsis instead.
 - **Icon button:** 44px circle, Terracotta Ink glyph, Linen circle on press. Neutral (Warm Ink Secondary) when repeated in a list, such as reorder arrows. Disabled: Warm Ink Tertiary at 45%.
 - **Show more:** a long list ends with a centered secondary button that adds the next rows ("Show older meetups"). Rows never load by themselves as you scroll.
 - **Focus:** a 2px Terracotta Ink outline with a 2px offset on every focusable element.
@@ -308,6 +312,11 @@ The thumb-reachable primary action on Friends, friend detail and Meetups. Peach
 - **Wrapping (`.chip--wrap`):** for user-entered items, such as a friend's likes and dislikes and a meetup's activities. Long text wraps inside the chip instead of overflowing. It keeps the 36px minimum height with `6px 14px` padding, is capped at the full width, and has `1.2em` corners: a pill on one line, a soft rounded box when the text wraps.
 - **Layouts:** a horizontally scrolling row that bleeds to the screen edges for filters and meetup types; a wrapping cluster for group pickers, dates, a friend's likes and dislikes, and a meetup's activities.
 
+### Friend tiles (Who)
+The meetup sheets' **Who** shows every friend as a tile (a 52px avatar over a Footnote name of up to two lines), the friends you actually see first: most meetups in the last 90 days first, then the most recently seen, then never-seen friends by name (only meetups dated today or earlier count). Opened from a friend's page, the friends most often seen with that friend in the last 12 months lead (more together first, then the most recent together), then everyone else in that order. The order is taken as the sheet opens; picking friends never moves a tile. Each tile is a toggle (`aria-pressed`) named by the friend, in a group named "Friends"; a picked tile gets a 3px Peach ring and a 22px Peach check badge, and the friend also shows as a selected chip above. Pressed: Linen.
+- **Up to 8 friends:** a still grid, four across, filled a row at a time.
+- **More than 8:** a strip two rows high that swipes sideways, filled a column at a time, so the first 8 show first. It bleeds to the sheet's edges with its first column on the 16px margin, like the meetup type chips, and its columns are a little narrower than a quarter of the width (`(100% - 3 gaps) / 4.4`), so the fifth peeks in to say there's more. Each column snaps to the margin (`scroll-snap-type: x mandatory`), overscroll stays in the strip, and there's no visible scrollbar. A tile that takes keyboard focus scrolls into view. "Search all friends" sits below it.
+
 ### Inset groups and rows
 - **Container:** Paper White, 14px corners, no shadow, no border. A Footnote section label sits above (inset 16px from the group edge, aligned with row text) and an optional footer below.
 - **Row:** at least 52px tall, `0.5rem 1rem` padding, `0.75rem` gap. Leading slot is 44px wide (avatar or emoji badge); main text is a Body title with a Subhead Warm Ink Secondary subtitle, both wrapping; trailing values in Warm Ink Secondary; an 18px Warm Ink Tertiary chevron for navigation.
@@ -319,20 +328,24 @@ The thumb-reachable primary action on Friends, friend detail and Meetups. Peach
 - **Field:** Paper White on Warm Paper (inside sheets), 12px corners, 44px minimum height, `0.6rem 0.9rem` padding, no border. Labels are Footnote 600 Warm Ink Secondary above the field. Placeholders are Warm Ink Tertiary.
 - **Search:** Linen, 12px corners, 44px tall, an 18px magnifier in Warm Ink Tertiary. Focus draws the 2px Terracotta Ink outline around the whole field. Friends and Meetups each have one, above their list.
 - **Error:** Footnote Danger Red text under the field, announced with `role="alert"`.
-- **Hint (`.field-hint`):** a neutral note under a field for things that aren't errors, such as "Already in Likes.". Footnote Warm Ink Secondary, announced with `role="alert"`, never red.
+- **Hint (`.field-hint`):** a neutral note under a field for things that aren't errors, such as "Already in Likes.". Footnote Warm Ink Secondary, announced with `role="alert"`, never red. The same look without the alert describes a field (`aria-describedby`), such as "Lines that start with @ show as places." under the sheets' The day box.
+- **Place tint (The day boxes):** while you type, every line the grammar reads as a place (`isPlaceLine`: "@ some place", "@Blue willow 3:30"; never "@" alone, "@ 3:30" or an "@" mid-sentence) gets a Peach Wash rounded background behind its words (0.35em corners, reaching 0.2em past them; spaces around the line stay untinted), with the text itself unchanged. The box's own copy of its text, which sizes it, paints the tints from behind with transparent glyphs; the box is transparent over its Paper White cell, so the tints show through under its text. It's only a look: the copy is `aria-hidden`, and a place line also reads as a place on the Meetup page. In the meetup sheets and on the day page.
 - **Select row (`.birthday-row`):** native selects, so iOS shows its wheel, with the Field look, `appearance: none` and a 16px Warm Ink Tertiary chevron. The empty choice ("Month", "Day", "No year") is Warm Ink Tertiary, like a placeholder. The friend sheet's Birthday puts Month, Day and Year in one row of equal-height fields, Month widest (flex bases 7.5em, 4.5em and 6em); at large text sizes the row wraps. Each select has its own accessible name ("Birthday month"); an error sits under the row and the selects point to it with `aria-describedby`. A "Remove birthday" text button under the row clears all three.
 
 ### Bottom sheets
-Used for adding or editing a friend, logging a meetup, and editing groups and types. Warm Paper with 22px top corners and the Float shadow, rising over 340ms with ease-out-expo, draggable to dismiss from its header. Header: a 36×5px Soft Rule grabber, then a three-column bar with Cancel (text button), a centered Body 600 title, and an optional trailing action. Body: 16px side padding, sections 1.5rem apart. Footer: a hairline-topped bar holding the block primary button above the safe area. Cancelling with unsaved changes asks first through an action sheet.
+Used for adding or editing a friend, logging a meetup, and editing groups and types. Warm Paper with 22px top corners and the Float shadow, rising over 340ms with ease-out-expo, draggable to dismiss from its header. Header: a 36×5px Soft Rule grabber, then a three-column bar with Cancel (text button), a centered Body 600 title, and an optional trailing action. The meetup and friend sheets put **Save** there, at the top right as iOS sheets do: a Terracotta Ink 600 text button, 44px at least, dimmed to 45% (and disabled, so VoiceOver reads "dimmed") while it can't save. Each side of the bar holds its button over an invisible copy of the other side's label, so both sides are as wide as the wider one and the title stays centered, wrapping at large text sizes. Body: 16px side padding, sections 1.5rem apart. Errors show at the top of the body (`role="alert"`) and scroll into view. Those sheets have no footer: the body runs down to the keyboard, and its last row clears the home indicator (that room goes while the keyboard is up). The group, type and lock sheets keep a footer: a hairline-topped bar holding the block primary button above the safe area. Cancelling with unsaved changes asks first through an action sheet.
 
-### Meetup sheet: Activities, Photos and footer
-Activities and Photos follow **When** and end the Log and Edit meetup sheet; there is no Note (the day is written on the day page). Both hold their changes until Save, so Cancel (after "Discard changes?") throws them away.
+### Meetup sheet: The day, Activities and Photos
+The day, Activities and Photos follow **When**, in that order, in the Log and Edit meetup sheets: The day comes first so it's easy to reach. All three hold their changes until Save, so Cancel (after "Discard changes?") throws them away. Save, at the top right, is dimmed until a friend is picked (no "Pick a friend" anywhere: picking a face is the step), while photos are being added, and while saving.
+- **Who:** the friend tiles (above), then "Search all friends". When the search takes focus or its text changes, the sheet scrolls it to the top of the body, 12px below the header, so its results fill the room down to the keyboard (`data-reveal="top"`, see useRevealFocusedField); scrolling the results by hand moves nothing.
+- **What:** the meetup type chips in a row that bleeds to the edges. A new meetup starts on a suggested type, never just the first: the most common type among the last 10 meetups with any of the picked friends, else the owner's most-used type in their last 30 meetups, else the first type (ties go to the type used most recently; deleted types and future meetups don't count). It follows the picked friends until a chip is tapped, which then sticks, and a new suggestion's chip scrolls into view in the row (only the row moves, never the sheet). It's an ordinary selected chip, and a suggestion alone is no change to discard. Edit keeps the meetup's own type.
+- **The day:** a Footnote label "The day" over a Paper White box four lines tall at least that grows with its text, with the place tint. Placeholder "What happened? Start a line with @ for a place."; under it, the hint "Lines that start with @ show as places.". Sentence capitals, autocorrect and spelling on, Return makes a new line, and it stops typing at 10,000 characters like the day page. It edits the same words as the day page and saves with the meetup; an edit writes them only if they changed.
 - **Activities:** a wrapping cluster of chips (the wrapping variant): activities used before, most used first, then the starters (Board games, Karaoke, Movie, Walk, Concert, Shopping, Cooking, Sports, Beach, Museum). Twelve show at first and a "More" chip shows the rest; an activity already on the meetup always shows. Selected chips are Peach, announced with `aria-pressed`, and a chip tapped off stays where it is until the sheet closes. The cluster ends with "+ New", which puts a Paper White field and a secondary **Add** button on their own line under the chips, like the friend sheet's New group; adding selects it. "A meetup can have up to 20 activities." is a Footnote Warm Ink Secondary hint, never red.
 - **Photos:** a 3-across grid of square thumbnails (12px corners, 8px gaps), shared with the Meetup page. Each has a remove button ("Remove photo 2"): a 44px hit area in the corner around a 24px Warm Ink circle with a Warm Paper cross and a 1.5px Warm Paper ring that keeps it visible on any photo. The grid ends with the **Add photos** tile: Linen with a 1.5px dashed Warm Ink Tertiary outline (an empty slot, not a container), a 26px camera-plus icon, and a Footnote 600 Warm Ink Secondary label that reads "Adding 2 of 5…" while photos are resized. Hints under the grid, never red: "A meetup can have up to 20 photos." and "1 photo couldn't be added.".
-- **Footer:** Log meetup's footer has a centered 44px Terracotta Ink text button, "Save and write about the day", above the Save block button. It's disabled whenever Save is, never hidden for a missing friend, and hidden only while the keyboard is up, so Save never moves.
+- **"Save and write about the day":** Log meetup only, the last thing in the body: a full-width Secondary block button, dimmed whenever Save is. It saves, then opens the day page for weather, mood and How it felt.
 
 ### The day page
-A pushed, full-screen layer at `/meetups/:id/day` that fills the screen above the keyboard (bottom at `--keyboard-inset`, height `--viewport-height`), with no tab bar. Nav bar: back (the meetup type), the title "The day". Body: the context line, Weather chips, The day box with its hint, How it felt (mood tiles and a box, only for today or earlier), and "Saves as you type, and stays on this iPhone.". Boxes are Paper White, grow with their text and never scroll inside themselves. It saves as you type; a failed save shows a Footnote Danger Red line above the helper bar.
+A pushed, full-screen layer at `/meetups/:id/day` that fills the screen above the keyboard (bottom at `--keyboard-inset`, height `--viewport-height`), with no tab bar. Nav bar: back (the meetup type), the title "The day". Body: the context line, Weather chips, The day box with its hint and the place tint, How it felt (mood tiles and a box, only for today or earlier), and "Saves as you type, and stays on this iPhone.". Boxes are Paper White, grow with their text and never scroll inside themselves. It saves as you type; a failed save shows a Footnote Danger Red line above the helper bar.
 
 ### Helper bar
 The day page's footer, riding on the keyboard: a row of chips ("@ Place", "Now" for today's meetups, "Paid") with a 44px "Hide keyboard" button pinned at the end while the keyboard is up. "@ Place" swaps the row for a one-line Place field (autocorrect off) with Now and Add (dimmed until there's text); "Paid" swaps it for a "Who paid?" label over chips that wrap (Me, each friend, Split). Both pin a 44px Close just before "Hide keyboard", outside the part that scrolls. Helpers never take focus from the box you're typing in, and every control's name starts with the word it shows.
@@ -354,7 +367,7 @@ The one happy moment. An inverted pill (Warm Ink background, Warm Paper text, Fl
 - **Tab bar:** fixed, Paper White, 50px plus the safe area, hairline on top. Three tabs (Friends, Stats, Settings) with 26px line icons over Caption labels: Warm Ink Tertiary at rest, Terracotta Ink with a heavier stroke and 600 label when current. A friend's page, a Meetup page and the Meetups page belong to Friends, unless they were opened from Stats, which then stays current. The tab bar is hidden on the day page.
 
 ### Avatars
-Circles. Initials in the rounded face (600, 40% of the size) on a per-friend pastel tint, or a cropped photo. Sizes: 44px in rows, 52px in the recent-friends grid, 96px in the detail hero, 24 to 28px inside chips.
+Circles. Initials in the rounded face (600, 40% of the size) on a per-friend pastel tint, or a cropped photo. Sizes: 44px in rows, 52px in the friend tiles, 96px in the detail hero, 24 to 28px inside chips.
 
 ### Friend detail column
 Reads as one calm column, not a grid of cards: centered 96px avatar, Title name, group in Warm Ink Secondary, then a Paper White "Last seen" pill (Subhead, 1em corners so it becomes a soft box if large text wraps it between the date and the time since). Below: the notes, then **Birthday**, **Likes** and **Dislikes** (people before numbers), then the stat row, "Month by month", and the history grouped by month.
```

- [ ] **Step 4: Record the decisions in the spec**

In `docs/superpowers/specs/2026-10-21-sheet-details-design.md`:

```diff
--- a/docs/superpowers/specs/2026-10-21-sheet-details-design.md
+++ b/docs/superpowers/specs/2026-10-21-sheet-details-design.md
@@ -141,3 +141,20 @@ Make logging a meetup complete and comfortable in one sheet: pick any friend wit
 - **Existing tests:** all existing e2e and unit tests stay green.
 
 **Screenshots:** the Log sheet with the strip, The day box with a highlighted place line, and the header Save, in light, dark and large text; The day page with highlights.
+
+## Decisions made while building
+
+- **No "Pick a friend" anywhere (the owner's change, mid-build).** Save is always labeled "Save" and is a native disabled button until a friend is picked, while photos are being added and while saving, as the footer Save was; VoiceOver reads "Save, dimmed". There's no hint and no `aria-describedby`. (`aria-disabled` stays for buttons in the codebase that must keep focus, such as the photo viewer's arrows.)
+- **The header action is data, not a node.** `Sheet` takes `action: { label, onClick, disabled }` and draws the button itself. Each side of the bar stacks its button over an invisible copy of the other side's label in one grid cell, so both sides are as wide as the wider label; the title stays centered (checked within a pixel in the e2e) and still wraps at large text. The group, type and lock sheets keep their footers (out of scope).
+- **Errors at the top of the body scroll into view** (`scrollIntoView({ block: 'nearest' })`, as `BirthdayField` already does), since the owner may be down at "Save and write about the day" when one appears.
+- **No footer, so the body keeps its end clear of the home indicator,** and gives that room up while the keyboard is up (`.keyboard-open .sheet__body:last-child`), as the footer did.
+- **`note` is back in `MeetupInput`, optional.** `clean` only normalizes its line breaks. Log always gives it; Edit gives it only when the box changed, so an Edit save can't overwrite a day written elsewhere since the sheet opened, and an untouched box still leaves the day alone. It's written in the same transaction as the meetup and its photos (a failed photo write rolls the note back, unit tested). `updateMeetup` passes Dexie a plain copy of the cleaned fields (`{ ...fields }`), because Dexie's update type won't take an interface.
+- **The highlight's pieces.** `isPlaceLine(line)` is exported from `src/lib/dayText.ts`, built on the private `readPlaceLine` with no rule changed; `placeRuns(text)` in `src/lib/dayHighlight.ts` cuts the text into place and plain runs that join back to the text exactly (a backup's `\r\n` kept). `GrowField` takes `highlightPlaces`. Its replicated copy became a real `aria-hidden` element (in place of `::after` and `data-value`) that both sizes the box and, with `highlightPlaces`, paints the tints with transparent glyphs; the Paper White moved from the textarea to the GrowField cell and the textarea is transparent. A tint covers a place line's words, not the spaces around them; it reaches 0.2em past them with a cancelling negative margin, and `box-decoration-break: clone` tints each line of a wrapped place line. The e2e checks each tint sits on its line and starts with the text, within a pixel.
+- **The strip's two layouts.** Up to 8 friends keep the still grid, four across and filled a row at a time, so a small list looks as before. More than 8 (`data-swipes`) make the column-filled strip, columns `(100% - 3 gaps) / 4.4`. The classes are now `.friend-strip` and `.friend-tile`. Keyboard focus relies on the browser's own focus scrolling (tested). Playwright's mobile WebKit has no wheel or touch scrolling, so the e2e "swipe" scrolls the strip in script.
+- **Search to the top is an opt-in of the reveal hook.** `data-reveal="top"` goes on the search's `label`, so the whole field, not just its text, goes to the top. It runs a frame after focus and after each input (keyboard or not) and when the body shrinks, never on `selectionchange`; `topOffset` is the pure measure. The browser's own caret reveal (WebKit scrolls a field back into view when its caret moves) is left alone.
+- **"At least 4 result rows" on the iPhone 13 profile.** Result rows are 60px (a 44px avatar), and the profile's page is Safari's 664px, 324px above the fake 340px keyboard: after the header and the field, three whole rows fit and the fourth starts at the keyboard's edge. Four whole rows can't fit there without shrinking the standard row, so the e2e checks three whole rows and the fourth starting on that profile, and plays the Home Screen app's whole 844px screen (47px and 34px safe areas) for at least four whole rows.
+- **The suggested type (A).** `suggestMeetupType(meetups, friendIds, types, today)` lives in `src/stats/suggestType.ts`, using `newestFirst`. Meetups of deleted types are dropped before taking the 10 or the 30, so they use up no slots; future meetups don't count. While meetups load it works on none, so it's the first type until they arrive. Only a tapped type differing from the one the sheet opened with is a change (`typeId !== start.typeId`). The chip is revealed by moving the row's `scrollLeft` by `revealOffset` (as little as it takes, keeping the row's 16px padding), in a layout effect, rather than with `scrollIntoView`, which with `block: 'nearest'` would scroll the sheet when the What row is out of view. WebKit anchors the sheet's scroll when the selected friends' row first appears above, so the e2e for "the sheet doesn't move" starts from a friend's page, where that row is already there.
+- **The Who order (B).** `friendsToPick(friends, meetups, today, presetFriendId)` in `src/stats/friendsToPick.ts` replaces `recentFriends` (the file is renamed). "The last 90 days" is the 90 days ending today (today and the 89 before it); "the last 12 months" is the 365 days ending today. Friends seen, but not in the last 90 days, follow the friends met lately by their most recent meetup, before anyone never seen. Companions seen together as often and as recently keep the general order (a stable sort). The preset friend's own tile keeps its place in the general order; their chip and pressed tile show they're picked.
+- **The day after When (C).** The body reads Who, What, When, The day, Activities, Photos, then "Save and write about the day" (Log) or Delete meetup (Edit).
+- **E2e helpers.** `sheetSave(sheet)` is the header Save; `logMeetup` always taps its type (Coffee unless told otherwise), so no test depends on a suggestion; the strip is the group "Friends" (`exact: true`, since "Selected friends" also matches).
+- **Screenshots.** New `21-log-day` (The day with a tinted place line, centered in the sheet) and `22-log-search` (the search at the top over the fake keyboard), in light, dark and large text. `03-log-sheet` shows the strip and the header Save with the body at its top, and `16-day-written` shows the day page's tints. Still 15 screenshot tests.
```

- [ ] **Step 5: Run everything**

Run: `npx tsc -b`, then `npm test`
Expected: `Test Files  60 passed (60)` and `Tests  749 passed (749)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `192 passed`. `npm run screenshots`: `15 passed`.

- [ ] **Step 6: Commit**

```bash
git add DESIGN.md docs/superpowers/specs/2026-10-21-sheet-details-design.md e2e/screenshots.spec.ts
git commit -F - <<'EOF'
docs: DESIGN.md, screenshots and the decisions made while building

DESIGN.md covers Save at the top right of the meetup and friend sheets with
no footer, the friend tiles and their swipeable strip, the place tint in The
day boxes, the suggested type and the new order of the meetup sheet. The
screenshots add The day with a tinted place line (21) and the friend search at
the top over the keyboard (22), in light, dark and large text. The spec
records the decisions made while building.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Spec coverage

| Spec requirement | Where |
| --- | --- |
| Save in the header's trailing slot of the meetup and friend sheets; Cancel left, title centered (equal sides), wrapping at large text | Task 1; e2e "Save is at the top right", "the friend sheet saves from the top right" |
| Save disabled until a friend is picked, while adding photos and while saving; no "Pick a friend" and no hint (the owner's change) | Task 1; e2e "Save is at the top right" and "the quick log" |
| No footers; "Save and write about the day" a Secondary block button at the end of the Log body; errors at the top with `role="alert"` | Task 1; e2e "the quick log" |
| The friend sheet: Save in the header; a missing name still shows its error and takes focus | Task 1; e2e "requires a name", "empty name is announced" |
| Every e2e that used the footer Save or "Pick a friend" updated | Task 1 |
| The day box: label, placeholder, hint (`aria-describedby`), typing settings, `DAY_MAX_TYPED` | Task 2; e2e "logs a meetup with The day typed in the sheet" |
| `note` saved in the meetup's transaction, exactly as typed but for line breaks; Edit starts with it and saves a change | Task 2; unit tests in `meetups.test.ts`; e2e "the Edit meetup sheet starts with the day" |
| The box counts as a change ("Discard changes?") | Task 2; e2e "Cancel with words typed in The day asks" |
| The day box right after When, before Activities and Photos (addition C) | Task 7; e2e "comes right after When" |
| Place tint: exactly the grammar's place lines, in the sheet and on The day page; a backdrop behind a transparent textarea; `aria-hidden`; tokens only | Task 3; unit tests for `isPlaceLine` (golden fixtures) and `placeRuns`; e2e "tints each place line" |
| Every friend in Who, two rows, swipeable, snapping, edges like the type chips, the fifth column peeking; 8 or fewer as before | Task 4; e2e "swiping through friends" |
| Group "Friends", tiles as toggles named by the friend; keyboard focus scrolls a tile into view | Task 4; e2e "a tile that takes keyboard focus scrolls into view" |
| Who order: 90-day count, then most recent, then never seen by name; from a friend's page, companions of the last 12 months first (addition B) | Task 8; unit tests in `friendsToPick.test.ts`; e2e "who comes first in Who" |
| The friend search goes to the top, 12px below the header, on focus and as its text changes; no fight with the reveal; nothing moves on a hand scroll | Task 5; unit tests for `topOffset`; e2e "the friend search goes to the top" |
| At least 4 result rows above the keyboard, and no footer | Task 5 (see Decision 9); e2e "as the Home Screen app" |
| Suggested type: friends' last 10, the owner's last 30, the first type; ties by recency; deleted types ignored; follows the friends until tapped; chip scrolled into view in its row only; Edit keeps its type (addition A) | Task 9; unit tests in `suggestType.test.ts`; e2e "the suggested meetup type" |
| DESIGN.md: Bottom sheets, Chips and tiles, Inputs and fields | Task 10 |
| Screenshots: the Log sheet with the strip, The day box with a tinted place line and the header Save in light, dark and large text; The day page with tints | Task 10 |
| No data, Dexie or backup change | All tasks |
| Counts: unit 58 to 60 files and 713 to 749 tests; e2e 173 to 192; screenshots stay 15 | Tasks 1 to 10 |
