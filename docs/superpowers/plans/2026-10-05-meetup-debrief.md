# Meetup Debrief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every meetup an optional day written the way the owner already writes it (places with "@", times, who paid, the story, weather, a mood and how it felt) on a new full-screen day page that saves as you type, read back on the Meetup page as a calm timeline, with the quick log unchanged and every existing note kept as it is.

**Architecture:** The meetup's existing `note` becomes The day, stored exactly as typed; `weather`, `mood` and `feelings` join the meetup row without a Dexie version bump (the reading hook fills them). A pure, frozen reader (`readDay`, grammar 1, pinned by golden fixtures) turns the text into headings, timelines of places and prose for display only. The day page (`/meetups/:id/day`) is a fixed layer on the sheets' keyboard hooks (now reference-counted, with a caret-following reveal) and saves through a one-write-at-a-time autosave (`updateDay`). The Log sheet loses its Note and gains "Save and write about the day"; backups move to version 5 with the `>= 4` fix.

**Tech Stack:** Vite 8, React 19, TypeScript 6 (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`), react-router 7 (HashRouter), Dexie 4 with dexie-react-hooks, Vitest 5 (Node environment, fake-indexeddb, TZ America/Los_Angeles), Playwright WebKit (iPhone 13, port 4174, service workers blocked).

---

**Spec:** [docs/superpowers/specs/2026-10-05-meetup-debrief-design.md](../specs/2026-10-05-meetup-debrief-design.md), the source of truth. Design context: [DESIGN.md](../../../DESIGN.md), [PRODUCT.md](../../../PRODUCT.md).

## Ground rules for every task

- Run every command from the project root in Git Bash: `/c/Users/luald/OneDrive/Desktop/Friend tracker`. The branch `feature/meetup-day` is already checked out.
- TypeScript: type-only imports use `import type` or an inline `type` specifier; no enums, namespaces or constructor parameter properties; no unused locals or parameters. Test files under `src/` and everything in `e2e/` are type-checked by `npm run build`.
- Import paths are extensionless inside `src/`. Inside `e2e/`, local files are imported with `.ts` (`./helpers.ts`, `../src/test/dayFixtures.ts`).
- Copy (UI text, comments, docs) never uses em dashes. Use commas, colons, periods or parentheses. The day grammar reads en and em dashes inside times, so `src/lib/dayText.ts` and its tests name them with escapes (U+2013, U+2014), never as typed characters; the same goes for the no-break space (U+00A0) in `src/lib/clock.ts` and the zero-width space (U+200B) in `src/lib/caret.ts`.
- **The service worker opens the app database.** `src/sw/push.ts` imports `src/db/db.ts`, which now imports `src/lib/weather.ts` and `src/lib/moods.ts`. Nothing in them may touch `window`, `document` or `Intl`; `tsconfig.sw.json` type-checks them with the WebWorker library, so `npm run build` catches a slip. `src/lib/dayText.ts` stays pure too.
- **Your words are kept exactly.** Nothing in this plan trims, sorts, rewrites or moves the text of a day. Reading it (`readDay`) only changes how it looks on the Meetup page.
- **The golden fixtures are frozen.** `src/test/dayFixtures.ts` and the expectations marked "FROZEN for grammar 1" in `src/lib/dayText.test.ts` are never edited after Task 1. A change to the reading rules is a new grammar with fixtures of its own.
- Never run `npm run dev`, `npm run preview`, `vite preview` or wrangler yourself. `npm run e2e` and `npm run screenshots` build and start their own preview server.
- Commands:
  - Unit tests: `npm test` (one file: `npx vitest run <path>`)
  - Type check and production build: `npm run build` (quick type check only: `npx tsc -b`)
  - End-to-end tests: `npm run e2e` (one file: `npx playwright test --project=iphone <path>`)
  - Screenshots: `npm run screenshots`
- Baseline before Task 0: `npm test` shows `Test Files  49 passed (49)` and `Tests  551 passed (551)`; `npm run e2e` shows `122 passed`; `npm run screenshots` shows `14 passed`. Each task states the new totals, measured by applying this plan task by task to a clean clone of the branch. Under the full suite's load, `e2e/detail.spec.ts` "history rows show activities and the first photo" (photos being resized) can time out once; it passes on its own and on a rerun.
- **E2E and the keyboard.** Playwright's WebKit has no on-screen keyboard. `e2e/keyboard.ts` (Task 4, moved out of `e2e/sheetKeyboard.spec.ts`) fakes the iPhone's visual viewport; call `fakeVisualViewport(page)` before the page loads.
- **E2E and time.** The owner wrote their day on Saturday, Oct 3, 2026 at 9:52 PM. `e2e/day.spec.ts` uses `test.use({ timezoneId: 'America/Los_Angeles' })` and `page.clock.setFixedTime(...)`, which fixes `Date` while timers keep running, so autosave still works.
- **Screenshots are not committed.** `e2e/screenshots` is in `.gitignore`; look at the PNGs locally and never `git add` them.
- Commit after each task with the exact `git add` paths and message given. Every commit message ends with a blank line and then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Decisions made while planning

The spec leaves these open. Task 7 records them at the end of the spec.

1. **Golden fixtures** live in `src/test/dayFixtures.ts`, shared by the unit tests and `e2e/day.spec.ts`: fixture A (`OWNER_DAY_TYPED`) is the note in the spec's stored record (808 characters) and fixture B (`OWNER_MESSAGE`) the owner's message exactly as they sent it, from "Rainy day" to the last sentence (925 characters, 31 lines, curly apostrophes, trailing spaces, a leading space before "@seoulSaloon", two blank lines before "How I felt:"). Both lengths are pinned by tests.
2. **Times.** "~" may have spaces after it; "about", "around", "to", "am" and "pm" are read in any case. A range's end needs minutes or am/pm like any lone clock, so "@Show 11am-1" has no time. A 24-hour phone shows two-digit hours ("09:05"). "Now" types an ordinary space before AM or PM ("9:52 PM"), since it becomes your words; only what the app shows uses the no-break space.
3. **Lines.** "paid" and "for" are read in any case, and one trailing "." or "!" is dropped before matching; a tag shows the line as written ("Mariya paid."). Four words before "paid" is text. A line that is only "@" is skipped as if it weren't there, so it doesn't end a stop's lines. Headings count characters as code points; ":" alone is text. Lines split at `\r\n`, `\r` and `\n`, so a note from a backup with Windows line breaks reads the same.
4. **The timeline's large-text layout** switches below 16em, not the spec's 22em. The box's content on a 390pt iPhone is 326px wide, which is under 22em at every iPhone text size (the default body is 17px), so 22em would put every time above its place even at the default size, unlike the spec's mock-up. 16em keeps the side-by-side timeline at the default and larger standard sizes and moves times above places from about 21px: the largest standard sizes and every accessibility size.
5. **Who paid** names live in `src/lib/payers.ts`: `payerLabel` names a chip (the first name, or the full name when two friends on the meetup share a first name, ignoring case) and `paidBy` finds a tag's face (exactly one friend on the meetup whose first or full name matches, ignoring case).
6. **Announcements** read a new place in the day as it now stands ("Added holister + h&m, 7:30 PM to about 8:10 PM."), so its time reads in day order. Escape closes the Place row, as Close does.
7. **The day page** starts the scroll lock and the keyboard publishing as soon as its route opens, before its data loads, so a Log sheet still closing always hands the keyboard over. Focus moves to its title before the first paint. The layer sits at z-index 40: above pages and the tab bar, below sheets (50), the toast (55) and action sheets (60). After a failed save, "Discard changes" also stops the saver, so nothing is written later.
8. **The toast's room** (Task 0) stays after a tall toast goes and resets on the next page; a new page keeps room only for a toast that is showing then.
9. **Tests without jsdom.** The unit tests run in Node, and the project has no DOM library. The keyboard and autosave logic live in plain functions (`startKeyboardInset`, `createAutosave`, `flushWhenHidden`) that the tests drive with fakes and fake timers; `useKeyboardInset` and `useAutosave` are thin wrappers. The caret mirror (`src/lib/caret.ts`) is covered end to end in `e2e/dayKeyboard.spec.ts`.
10. **Between tasks** every check stays green: in Task 1 the Log sheet's one-line Note saves through `updateDay` (the new data function) until Task 5 takes the Note out. E2E tests reach the day page through the hash URL until Task 6 adds the day row (`openDay` in `e2e/helpers.ts`).
11. **E2E `logMeetup` with a note** (Task 5) taps "Save and write about the day", fills The day, and goes back twice, to where the sheet was opened, so tests like "Tacos" keep their meaning.
12. **Screenshots.** The seed adds Mariya, Jessie and Brandon; `12-meetup` now shows the owner's example, logged through "Save and write about the day", while the viewer and the Edit sheet still use the seed's Meal. One more test captures the accessibility size (33px): `ax-16-day-written` (faces two by two) and `ax-12-meetup` (times above places, since the timeline is on the Meetup page). `16-day-written` is a full-page capture of the day page, so the capture turns the fixed layer into a plain block for that moment.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/components/Toast.tsx`, `src/styles/base.css` | Modify (Task 0) | Keep the toast's room until the next page |
| `src/lib/viewport.ts` / `.test.ts` | Modify (Tasks 0, 3) | `revealMargin`; caret-line `revealOffset` test |
| `src/hooks/useRevealFocusedField.ts` | Modify (Tasks 0, 3) | Margin from the CSS; follow the caret's line on typing and caret moves |
| `src/types.ts` | Modify | `Weather`, `Mood`; `Meetup.weather`, `mood`, `feelings` |
| `src/lib/weather.ts` / `.test.ts` | Create | `WEATHER`, `isWeather`, `cleanWeather`, `weatherInfo` |
| `src/lib/moods.ts` / `.test.ts` | Create | `MOODS`, `isMood`, `moodInfo`, `INVALID_MOOD`, `feelingsApply` |
| `src/lib/dayText.ts` / `.test.ts` | Create | Grammar 1: `readDay`, `daySnippet`, `isDayEmpty`, limits, `normalizeLineBreaks` |
| `src/lib/dayEdit.ts` / `.test.ts` | Create | Helper bar string edits: `insertPlaceLine`, `insertPaidLine`, `insertAtCaret`, `changeBetween` |
| `src/lib/clock.ts` / `.test.ts` | Create | `clockStyle`, `formatClock`, `typedClock`, `formatDayTime`, `describeStopTime`, `speakTime` |
| `src/test/dayFixtures.ts` | Create | Golden fixtures A and B (frozen) and the owner's feelings |
| `src/test/fixtures.ts` | Modify | `meetup()` gets an empty day |
| `src/db/db.ts` / `.test.ts` | Modify | Reading hook fills and cleans the day's fields |
| `src/db/meetups.ts` / `.test.ts` | Modify | `MeetupInput` without `note`; `DayInput`, `updateDay`; `updateMeetup` leaves the day alone |
| `src/backup/format.ts` / `.test.ts`, `src/backup/storage.test.ts` | Modify | Version 5, strict day fields, the `>= 4` fix |
| `src/hooks/useKeyboardInset.ts` / `.test.ts` | Modify / Create | Reference-counted `startKeyboardInset` |
| `src/lib/caret.ts` | Create | `caretLineSpan`, the hidden mirror |
| `src/hooks/useAutosave.ts` / `.test.ts` | Create | `createAutosave`, `flushWhenHidden`, `useAutosave` |
| `src/lib/payers.ts` / `.test.ts` | Create | `payerLabel`, `paidBy` |
| `src/components/GrowField.tsx` / `.css` | Create | A text box that grows with its text |
| `src/components/MoodTiles.tsx` / `.css` | Create | The four faces |
| `src/screens/DayHelperBar.tsx` | Create | The helper bar's rows |
| `src/screens/DayScreen.tsx` / `.css` | Create | The day page |
| `src/App.tsx` | Modify | Route `/meetups/:id/day` |
| `src/sheets/MeetupSheet.tsx` / `.css` | Modify | Note out (a bridge in Task 1), "Save and write about the day" in |
| `src/components/DayView.tsx` / `.css` | Create | The day read back on the Meetup page |
| `src/screens/MeetupScreen.tsx` / `.css` | Modify | Hero weather, The day, How it felt, the day row |
| `src/screens/FriendDetailScreen.tsx` | Modify | History subtitle uses `daySnippet` |
| `src/components/TabBar.tsx`, `src/components/Toast.css` | Modify | No tab bar on the day page; toast above the helper bar |
| `e2e/keyboard.ts` | Create | The fake visual viewport, shared |
| `e2e/day.spec.ts`, `e2e/dayKeyboard.spec.ts` | Create | The day page end to end |
| `e2e/helpers.ts` | Modify | `readMeetups`, `openDay`; `logMeetup`'s note goes through the day page |
| `e2e/sheetKeyboard.spec.ts`, `e2e/detail.spec.ts`, `e2e/meetupPage.spec.ts`, `e2e/meetups.spec.ts`, `e2e/memories.spec.ts`, `e2e/birthdays.spec.ts`, `e2e/preferences.spec.ts`, `e2e/screenshots.spec.ts` | Modify | Follow-ups, version 5, the Note's removal, the reading view, screenshots |
| `DESIGN.md` | Modify | Colors, the Dynamic Type Rule, new components, named rules, don'ts |
| `docs/superpowers/specs/2026-10-05-meetup-debrief-design.md` | Modify | Appends the planning decisions |

---

### Task 0: Sheet keyboard follow-ups (toast room, one reveal margin, the large-text toast check)

Three small follow-ups from the last review of the sheet keyboard fix:
(a) When a tall toast hides, `--toast-space` drops back to `0px` and the end of the page jumps under your thumb. Keep the last measured room after the toast hides, and reset it on the next page (ToastProvider is inside HashRouter, so `useLocation().key` drives it).
(b) `src/components/Sheet.css` sets `scroll-margin-block: var(--space-3)` while `useRevealFocusedField` uses a fixed 12px. Read the field's computed `scroll-margin-bottom` instead (falling back to 12), so the CSS is the one source at every text size.
(c) The large-text toast test in `e2e/detail.spec.ts` ends with the same toast check as its sibling.

**Files:**
- Modify: `src/lib/viewport.ts` (`revealMargin`), `src/hooks/useRevealFocusedField.ts`, `src/components/Toast.tsx`, `src/styles/base.css` (comment)
- Test: `src/lib/viewport.test.ts`, `e2e/detail.spec.ts`, `e2e/sheetKeyboard.spec.ts`

- [ ] **Step 1: Write the failing test for the reveal margin**

In `src/lib/viewport.test.ts`, replace:

```ts
import { describe, expect, it } from 'vitest'
import { caretEdge, keyboardInset, keyboardIsUp, revealOffset } from './viewport'

describe('keyboardInset', () => {
  it('is zero with no keyboard', () => {
```

with:

```ts
import { describe, expect, it } from 'vitest'
import { caretEdge, keyboardInset, keyboardIsUp, revealMargin, revealOffset } from './viewport'

describe('keyboardInset', () => {
  it('is zero with no keyboard', () => {
```

Replace:

```ts
  })
})

describe('caretEdge', () => {
  /** A Notes box 88px tall: `text` with the caret at `caret` (the end by default), its text `textHeight` tall. */
  function box(text: string, textHeight: number, caret: number | null = text.length) {
```

with:

```ts
  })
})

describe('revealMargin', () => {
  it('is the field’s own scroll margin, so the CSS sets it at every text size', () => {
    expect(revealMargin('12px')).toBe(12)
    expect(revealMargin('17.25px')).toBe(17.25)
    expect(revealMargin('0px')).toBe(0)
  })

  it('is 12px when the field has no margin it can read', () => {
    expect(revealMargin('')).toBe(12)
    expect(revealMargin('auto')).toBe(12)
  })
})

describe('caretEdge', () => {
  /** A Notes box 88px tall: `text` with the caret at `caret` (the end by default), its text `textHeight` tall. */
  function box(text: string, textHeight: number, caret: number | null = text.length) {
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run src/lib/viewport.test.ts`
Expected: FAIL, 2 failed: `TypeError: revealMargin is not a function`.

- [ ] **Step 3: Add `revealMargin`**

In `src/lib/viewport.ts`, replace:

```ts
  clientHeight: number
}

/** How much shorter than the layout viewport the visual viewport must be before it counts as the keyboard. */
const KEYBOARD_MIN_HEIGHT = 50
```

with:

```ts
  clientHeight: number
}

/** The room kept around a field the app scrolls into view when its CSS sets none it can read. */
const DEFAULT_REVEAL_MARGIN = 12

/**
 * The room to keep between a revealed field and the edges of the visible area: the field's own
 * `scroll-margin-bottom` (a computed length such as "17.25px"), so the CSS that also guides the browser's
 * own focus scrolling is the one source at every text size. 12px when it can't be read.
 */
export function revealMargin(scrollMarginBottom: string): number {
  const margin = parseFloat(scrollMarginBottom)
  return Number.isNaN(margin) ? DEFAULT_REVEAL_MARGIN : margin
}

/** How much shorter than the layout viewport the visual viewport must be before it counts as the keyboard. */
const KEYBOARD_MIN_HEIGHT = 50
```

- [ ] **Step 4: Run it to see it pass**

Run: `npx vitest run src/lib/viewport.test.ts`
Expected: PASS, `Tests  27 passed (27)`.

- [ ] **Step 5: Write the failing end-to-end tests**

The large-text toast test gets its closing check (c), and a new test proves the room stays after the toast goes and resets on the next page (a). It installs Playwright's clock so the 8-second toast can be fast-forwarded.

In `e2e/detail.spec.ts`, replace:

```ts
  await expect(toast).toBeVisible()
  await row.click({ timeout: 2000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
})

test('edits a meetup from its page, then deletes it with undo', async ({ page }) => {
```

with:

```ts
  await expect(toast).toBeVisible()
  await row.click({ timeout: 2000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  await expect(toast).toContainText(`Logged with ${name}`)
})

test('at large text, the room for a toast that wrapped stays after it goes, until the next page', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await page.addStyleTag({ content: LARGE_TEXT })
  const name = 'Bartholomew Fitzgerald-Montgomery'
  await addFriend(page, name)
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  const toast = page.getByRole('status')
  await expect(toast).toContainText(`Logged with ${name}`)
  const toastSpace = () => page.evaluate(() => document.documentElement.style.getPropertyValue('--toast-space'))
  const pageEnd = () => page.evaluate(() => document.documentElement.scrollHeight)
  await expect.poll(async () => parseFloat(await toastSpace()), 'Room for the wrapped toast').toBeGreaterThan(100)
  const space = await toastSpace()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  const end = await pageEnd()
  const scrolled = await page.evaluate(() => window.scrollY)

  // The toast goes after 8 seconds; the end of the page stays where it was.
  await page.clock.fastForward(9000)
  await expect(toast).toBeEmpty()
  expect(await toastSpace(), 'The room stays').toBe(space)
  expect(await pageEnd(), 'The end of the page does not move').toBe(end)
  expect(await page.evaluate(() => window.scrollY), 'Nothing scrolls').toBe(scrolled)

  // The next page starts with no room kept for a toast that has gone.
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  expect(await toastSpace()).toBe('0px')
})

test('edits a meetup from its page, then deletes it with undo', async ({ page }) => {
```

At large text `var(--space-3)` is 17.25px, so a reveal that still uses 12px leaves too little room under Notes (b). Layout positions are fractions of a pixel, so the test allows for rounding below the margin's whole pixels.

In `e2e/sheetKeyboard.spec.ts`, replace:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, editMeetup, logMeetup, openFriendPage } from './helpers.ts'

declare global {
  interface Window {
```

with:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, editMeetup, LARGE_TEXT, logMeetup, openFriendPage } from './helpers.ts'

declare global {
  interface Window {
```

Replace:

```ts
  await expectRevealed(notes, 'Notes', { room: MARGIN })
})

test('moving to Notes brings it into view while iOS has panned the visual viewport over the keyboard', async ({
  page,
}) => {
```

with:

```ts
  await expectRevealed(notes, 'Notes', { room: MARGIN })
})

test('at large text, moving to Notes leaves the room the CSS sets, which grows with the text', async ({ page }) => {
  await page.addStyleTag({ content: LARGE_TEXT })
  const sheet = await openNewFriend(page)
  const name = sheet.getByLabel('Name', { exact: true })
  const notes = sheet.getByLabel('Notes')
  await tapFocus(name)
  await openKeyboard(page)
  const room = await notes.evaluate((element) => parseFloat(getComputedStyle(element).scrollMarginBottom))
  expect(room, 'var(--space-3) at this text size').toBeGreaterThan(MARGIN)
  const before = await placement(notes)
  expect(before.top, 'Notes starts below the visible part of the sheet').toBeGreaterThan(before.visibleBottom)

  await notes.evaluate((element) => element.focus({ preventScroll: true }))
  await nextFrames(page)

  // Layout positions are fractions of a pixel, so allow for rounding below the margin's whole pixels.
  await expectRevealed(notes, 'Notes', { room: Math.floor(room) })
})

test('moving to Notes brings it into view while iOS has panned the visual viewport over the keyboard', async ({
  page,
}) => {
```

- [ ] **Step 6: Run them to see them fail**

Run: `npx playwright test --project=iphone e2e/detail.spec.ts e2e/sheetKeyboard.spec.ts -g "at large text"`
Expected: FAIL, `2 failed` and `1 passed`: the room is `"0px"` after the toast goes (expected `"159px"` or near it), and Notes ends up about 12px above the Save bar instead of 17.

- [ ] **Step 7: Keep the toast's room until the next page**

In `src/components/Toast.tsx`, replace:

```tsx
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Toast.css'

export interface ToastOptions {
```

with:

```tsx
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router'
import './Toast.css'

export interface ToastOptions {
```

Replace:

```tsx
  const [paused, setPaused] = useState(false)
  const nextId = useRef(0)
  const toastRef = useRef<HTMLDivElement>(null)

  const show = useCallback((options: ToastOptions) => {
    nextId.current += 1
```

with:

```tsx
  const [paused, setPaused] = useState(false)
  const nextId = useRef(0)
  const toastRef = useRef<HTMLDivElement>(null)
  const { key: pageKey } = useLocation()

  const show = useCallback((options: ToastOptions) => {
    nextId.current += 1
```

Replace:

```tsx
    return () => window.clearTimeout(timer)
  }, [toast, paused])

  // Publishes the shown toast's real height on <html> as --toast-space (0 with none), so the end of a page
  // scrolls clear of a toast that wraps taller than its one line (see .app in base.css). Set before paint.
  useLayoutEffect(() => {
    const root = document.documentElement
    const element = toastRef.current
    if (!element) {
      root.style.setProperty('--toast-space', '0px')
      return
    }
    const observer = new ResizeObserver(([entry]) => {
      root.style.setProperty('--toast-space', `${Math.ceil(entry.borderBoxSize[0].blockSize)}px`)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [toast])
  useLayoutEffect(
    () => () => {
      document.documentElement.style.removeProperty('--toast-space')
```

with:

```tsx
    return () => window.clearTimeout(timer)
  }, [toast, paused])

  // Publishes the shown toast's real height on <html> as --toast-space, so the end of a page scrolls clear of a
  // toast that wraps taller than its one line (see .app in base.css). Set before paint. When the toast goes, its
  // room stays until the next page, so the end of this one doesn't jump up under your thumb.
  useLayoutEffect(() => {
    const element = toastRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      document.documentElement.style.setProperty('--toast-space', `${Math.ceil(entry.borderBoxSize[0].blockSize)}px`)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [toast])
  // A new page keeps room only for a toast that is showing now.
  useLayoutEffect(() => {
    const element = toastRef.current
    const space = element ? Math.ceil(element.getBoundingClientRect().height) : 0
    document.documentElement.style.setProperty('--toast-space', `${space}px`)
  }, [pageKey])
  useLayoutEffect(
    () => () => {
      document.documentElement.style.removeProperty('--toast-space')
```

In `src/styles/base.css`, replace:

```css
/* The phone layout, centered on wider screens. Bottom padding lets the end of a page scroll clear of the
   tab bar, the Log button and a toast above it: a toast stays 5 to 8 seconds and pauses while touched,
   so a last row left under it can't be tapped until it goes. The room for the toast is its one-line
   height, or the shown toast's real height when it wraps taller (large text, a long name). */
.app {
  max-width: 600px;
  margin: 0 auto;
```

with:

```css
/* The phone layout, centered on wider screens. Bottom padding lets the end of a page scroll clear of the
   tab bar, the Log button and a toast above it: a toast stays 5 to 8 seconds and pauses while touched,
   so a last row left under it can't be tapped until it goes. The room for the toast is its one-line
   height, or the toast's real height when it wraps taller (large text, a long name), kept until the next page
   so the end of this one doesn't jump when the toast goes. */
.app {
  max-width: 600px;
  margin: 0 auto;
```

- [ ] **Step 8: Read the reveal margin from the CSS**

In `src/hooks/useRevealFocusedField.ts`, replace:

```ts
import { useEffect, type RefObject } from 'react'
import { caretEdge, keyboardIsUp, revealOffset } from '../lib/viewport'

/** Room kept between a field the app scrolls into view and the edges of the sheet's visible area. */
const MARGIN = 12

/** Input types that type no text and open no picker, so they bring up no keyboard. */
const NO_KEYBOARD = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'])
```

with:

```ts
import { useEffect, type RefObject } from 'react'
import { caretEdge, keyboardIsUp, revealMargin, revealOffset } from '../lib/viewport'

/** Input types that type no text and open no picker, so they bring up no keyboard. */
const NO_KEYBOARD = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'])
```

Replace:

```ts
    const body = bodyRef.current
    if (!active || !body) return

    /** Scrolls the focused field into view with MARGIN to spare; `onlyIfHidden` leaves it while all of it shows. */
    const reveal = (onlyIfHidden: boolean) => {
      const field = document.activeElement
      if (!isEditable(field) || !body.contains(field)) return
```

with:

```ts
    const body = bodyRef.current
    if (!active || !body) return

    /**
     * Scrolls the focused field into view with its scroll margin to spare (var(--space-3) in the CSS, so the
     * browser's own focus scrolling and this agree at every text size); `onlyIfHidden` leaves it while all of
     * it shows.
     */
    const reveal = (onlyIfHidden: boolean) => {
      const field = document.activeElement
      if (!isEditable(field) || !body.contains(field)) return
```

Replace:

```ts
      // A note taller than the view shows the end you're typing at, when its text runs to the bottom.
      const caret = field instanceof HTMLTextAreaElement ? caretEdge(field) : 'start'
      if (onlyIfHidden && revealOffset(port, rect, 0, caret) === 0) return
      const offset = revealOffset(port, rect, MARGIN, caret)
      if (offset !== 0) body.scrollTop += offset
    }
```

with:

```ts
      // A note taller than the view shows the end you're typing at, when its text runs to the bottom.
      const caret = field instanceof HTMLTextAreaElement ? caretEdge(field) : 'start'
      if (onlyIfHidden && revealOffset(port, rect, 0, caret) === 0) return
      const offset = revealOffset(port, rect, revealMargin(getComputedStyle(field).scrollMarginBottom), caret)
      if (offset !== 0) body.scrollTop += offset
    }
```

- [ ] **Step 9: Run the end-to-end tests to see them pass**

Run: `npx playwright test --project=iphone e2e/detail.spec.ts e2e/sheetKeyboard.spec.ts -g "at large text"`
Expected: `3 passed`.

- [ ] **Step 10: Run everything**

Run: `npm test`
Expected: `Test Files  49 passed (49)` and `Tests  553 passed (553)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `124 passed`.

- [ ] **Step 11: Commit**

```bash
git add src/lib/viewport.ts src/lib/viewport.test.ts src/hooks/useRevealFocusedField.ts src/components/Toast.tsx src/styles/base.css e2e/detail.spec.ts e2e/sheetKeyboard.spec.ts
git commit -F - <<'EOF'
fix: keep a tall toast's room until the next page, and take the reveal margin from the CSS

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 1: The day's data: weather, moods, the grammar, helper edits, clock, and `updateDay`

**Files:**
- Create: `src/test/dayFixtures.ts`, `src/lib/weather.ts`, `src/lib/moods.ts`, `src/lib/dayText.ts`, `src/lib/dayEdit.ts`, `src/lib/clock.ts` and a test file for each of the five libraries
- Modify: `src/types.ts`, `src/test/fixtures.ts`, `src/db/db.ts`, `src/db/meetups.ts`, `src/backup/format.ts` (meetups read with an empty day until Task 2), `src/sheets/MeetupSheet.tsx` (its Note saves through `updateDay` until Task 5)
- Test: `src/db/db.test.ts`, `src/db/meetups.test.ts`, and the `addMeetup` inputs in `src/db/friends.test.ts`, `src/db/meetupTypes.test.ts`, `src/backup/storage.test.ts`

- [ ] **Step 1: Write the failing tests for weather and moods**

Create `src/lib/weather.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MOODS } from './moods'
import { cleanWeather, isWeather, WEATHER, weatherInfo } from './weather'

describe('WEATHER', () => {
  it('lists the eight chips in order, each with its own label and emoji', () => {
    expect(WEATHER.map((weather) => weather.key)).toEqual([
      'sunny',
      'cloudy',
      'rainy',
      'stormy',
      'snowy',
      'windy',
      'hot',
      'cold',
    ])
    expect(WEATHER.map((weather) => `${weather.emoji} ${weather.label}`)).toEqual([
      '☀️ Sunny',
      '⛅ Cloudy',
      '🌧️ Rainy',
      '⛈️ Stormy',
      '❄️ Snowy',
      '🌬️ Windy',
      '🌡️ Hot',
      '🧣 Cold',
    ])
    expect(new Set(WEATHER.map((weather) => weather.label)).size).toBe(8)
    expect(new Set(WEATHER.map((weather) => weather.emoji)).size).toBe(8)
  })

  it('never uses a face, so nothing competes with the mood faces', () => {
    for (const { emoji } of WEATHER) {
      expect(emoji).not.toMatch(/[\u{1F600}-\u{1F64F}\u{1F910}-\u{1F92F}\u{1F970}-\u{1F97A}]/u)
      expect(MOODS.map((mood) => mood.emoji)).not.toContain(emoji)
    }
  })

  it('finds a chip by its key', () => {
    expect(weatherInfo('rainy')).toEqual({ key: 'rainy', emoji: '🌧️', label: 'Rainy' })
  })
})

describe('isWeather', () => {
  it('knows the eight keys and nothing else', () => {
    expect(isWeather('rainy')).toBe(true)
    for (const value of ['Rainy', 'fog', '', 'toString', 3, null, undefined]) expect(isWeather(value)).toBe(false)
  })
})

describe('cleanWeather', () => {
  it('gives an empty list for anything that is not a list', () => {
    expect(cleanWeather('rainy')).toEqual([])
    expect(cleanWeather(null)).toEqual([])
    expect(cleanWeather(undefined)).toEqual([])
    expect(cleanWeather({ 0: 'rainy' })).toEqual([])
  })

  it('drops unknown keys and repeats, and puts the rest in chip order', () => {
    expect(cleanWeather(['windy', 'fog', 'rainy', 'rainy', 3])).toEqual(['rainy', 'windy'])
    expect(cleanWeather([])).toEqual([])
  })
})
```

Create `src/lib/moods.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { feelingsApply, INVALID_MOOD, isMood, moodInfo, MOODS } from './moods'

describe('MOODS', () => {
  it('lists the four faces low to high, each with its own label and emoji', () => {
    expect(MOODS.map((mood) => `${mood.key} ${mood.emoji} ${mood.label}`)).toEqual([
      'heavy 😔 Heavy',
      'okay 🙂 Okay',
      'good 😊 Good',
      'great 😄 Great',
    ])
    expect(new Set(MOODS.map((mood) => mood.emoji)).size).toBe(4)
  })

  it('has a message for a mood that is not on the list', () => {
    expect(INVALID_MOOD).toBe('Please pick a mood from the list.')
  })
})

describe('isMood', () => {
  it('knows the four keys and nothing else', () => {
    for (const key of ['heavy', 'okay', 'good', 'great']) expect(isMood(key)).toBe(true)
    for (const value of ['Good', 'amazing', 3, '', 'toString', null, undefined]) expect(isMood(value)).toBe(false)
  })
})

describe('moodInfo', () => {
  it('finds a face by its key, and gives null for anything else without throwing', () => {
    expect(moodInfo('okay')).toEqual({ key: 'okay', emoji: '🙂', label: 'Okay' })
    expect(moodInfo('amazing')).toBeNull()
    expect(moodInfo(null)).toBeNull()
    expect(moodInfo({ key: 'okay' })).toBeNull()
  })
})

describe('feelingsApply', () => {
  it('is true for meetups dated today or earlier', () => {
    expect(feelingsApply({ date: '2026-10-03' }, '2026-10-03')).toBe(true)
    expect(feelingsApply({ date: '2026-09-30' }, '2026-10-03')).toBe(true)
    expect(feelingsApply({ date: '2026-10-04' }, '2026-10-03')).toBe(false)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/weather.test.ts src/lib/moods.test.ts`
Expected: FAIL, `Test Files  2 failed (2)`: `Error: Cannot find module './weather'` and `Error: Cannot find module './moods'`.

- [ ] **Step 3: Add the types, the weather chips and the moods**

In `src/types.ts`, replace:

```ts
  order: number
}

export interface Meetup {
  id: string
  date: ISODate
  typeId: string
  friendIds: string[]
  note: string
  /** What you did, in the order picked. Cleaned like likes (see src/lib/activities.ts). */
  activities: string[]
  createdAt: string
}
```

with:

```ts
  order: number
}

/** The day's weather. Emoji and labels live in src/lib/weather.ts. */
export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'windy' | 'hot' | 'cold'

/** How a meetup felt to you. Emoji and labels live in src/lib/moods.ts. A word, never a number (the No Score Rule). */
export type Mood = 'heavy' | 'okay' | 'good' | 'great'

export interface Meetup {
  id: string
  date: ISODate
  typeId: string
  friendIds: string[]
  /**
   * The day, in your words ("The day" in the app). This was the one-line note, so every existing note is
   * already a day. Stored exactly as typed (line breaks as \n). Lines that start with "@" read back as
   * places (src/lib/dayText.ts); reading never changes the text.
   */
  note: string
  /** What you did, in the order picked. Cleaned like likes (see src/lib/activities.ts). */
  activities: string[]
  /** Weather picked, in chip order, no repeats. [] when none. */
  weather: Weather[]
  /** One of four faces, or null. Never preselected, scored, averaged, counted or charted. */
  mood: Mood | null
  /** "How it felt", in your words. Stored as typed (line breaks as \n), at most 4,000 characters. '' when none. */
  feelings: string
  createdAt: string
}
```

Create `src/lib/weather.ts`:

```ts
import type { Weather } from '../types'

// The service worker opens the database, which imports this file: nothing here may touch window, document or Intl.

export interface WeatherInfo {
  key: Weather
  emoji: string
  label: string
}

/** The weather chips, in order. Never a face emoji, so nothing competes with the mood faces. */
export const WEATHER: readonly WeatherInfo[] = [
  { key: 'sunny', emoji: '☀️', label: 'Sunny' },
  { key: 'cloudy', emoji: '⛅', label: 'Cloudy' },
  { key: 'rainy', emoji: '🌧️', label: 'Rainy' },
  { key: 'stormy', emoji: '⛈️', label: 'Stormy' },
  { key: 'snowy', emoji: '❄️', label: 'Snowy' },
  { key: 'windy', emoji: '🌬️', label: 'Windy' },
  { key: 'hot', emoji: '🌡️', label: 'Hot' },
  { key: 'cold', emoji: '🧣', label: 'Cold' },
]

const KEYS: readonly string[] = WEATHER.map((weather) => weather.key)

export function isWeather(value: unknown): value is Weather {
  return typeof value === 'string' && KEYS.includes(value)
}

/** A weather list as the app keeps it: something that isn't a list gives []; unknown keys and repeats are dropped; the rest go in chip order. */
export function cleanWeather(value: unknown): Weather[] {
  if (!Array.isArray(value)) return []
  return WEATHER.filter(({ key }) => value.includes(key)).map(({ key }) => key)
}

/** The chip for a weather key. */
export function weatherInfo(key: Weather): WeatherInfo {
  return WEATHER.find((weather) => weather.key === key)!
}
```

Create `src/lib/moods.ts`:

```ts
import type { Meetup, Mood } from '../types'
import type { ISODate } from './dates'

// The service worker opens the database, which imports this file: nothing here may touch window, document or Intl.

export interface MoodInfo {
  key: Mood
  emoji: string
  label: string
}

/** The four faces, low to high. A mood is a word, never a number (the No Score Rule). */
export const MOODS: readonly MoodInfo[] = [
  { key: 'heavy', emoji: '😔', label: 'Heavy' },
  { key: 'okay', emoji: '🙂', label: 'Okay' },
  { key: 'good', emoji: '😊', label: 'Good' },
  { key: 'great', emoji: '😄', label: 'Great' },
]

export const INVALID_MOOD = 'Please pick a mood from the list.'

export function isMood(value: unknown): value is Mood {
  return typeof value === 'string' && MOODS.some((mood) => mood.key === value)
}

/** The face for a mood, or null for anything unknown. Never throws. */
export function moodInfo(value: unknown): MoodInfo | null {
  return MOODS.find((mood) => mood.key === value) ?? null
}

/** How it felt is for meetups dated today or earlier. */
export function feelingsApply(meetup: Pick<Meetup, 'date'>, today: ISODate): boolean {
  return meetup.date <= today
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/weather.test.ts src/lib/moods.test.ts`
Expected: PASS, `Tests  11 passed (11)`.

- [ ] **Step 5: Add the golden fixtures and an empty day to the meetup fixture**

The fixtures are the acceptance test: fixture A is the note in the spec's stored record, character for character; fixture B is the owner's message exactly as sent. Copy them exactly (the trailing spaces inside the quotes are part of the message). They are never edited after this step.

Create `src/test/dayFixtures.ts`:

```ts
// Golden fixtures for reading a day (grammar 1). FROZEN: never edit them. They pin how every saved day reads
// back, so a memory never reads differently after an update. A change to the reading rules is a new grammar
// with fixtures of its own (see src/lib/dayText.ts). Shared by the unit tests and e2e/day.spec.ts.

/** Fixture A: the owner's day of Sat, Oct 3, 2026 as written in the app with the helpers (the spec's stored record). */
export const OWNER_DAY_TYPED = [
  '@nonstopstyle 10:30',
  'Took haircut with dyno',
  '@strand bookstore 11:30',
  '@Sammy L coffee 11:53',
  'Read book and vibe code until 2:50',
  '@Blue willow 3:30',
  'Walked to mariya at blue willow. Then Jessie came, then Brandon (late) due to construction',
  'Ordered Kong pao chicken (salty) garlic string beans, szcheuan beef and jasmine dragon pearl tea.',
  'Jessie paid',
  '@hey tea Broadway',
  'Walked to hey tea (got the king jasmine honeydew)',
  '@amc 34 5:30',
  'Walked to amc and watch prime time(didn’t like it)',
  '@holister + @h&m 7:30 - ~8:10',
  'Stalled time for dinner at holister and H&M',
  '@seoulSaloon 8:30',
  'Then walked to dinner @seoulsaloon',
  'Ate rose tteboki, fried chicken(chicken nuggets?), octopus kimbap',
  'Talked about relationship + movie',
  'Jessie Brandon age gap like 3 years',
  'Mariya like 3 years older 1/2 younger',
  'Mariya paid',
  'Split ways went home',
].join('\n')

/** Fixture B: the owner's message exactly as sent, curly apostrophes, trailing spaces and blank lines included. */
export const OWNER_MESSAGE = [
  'Rainy day',
  'Locations:',
  '',
  '@nonstopstyle 10:30',
  '@strand bookstore 11:30',
  '@Sammy L coffee 11:53',
  '@Blue willow 3:30, ',
  '@hey tea Broadway ',
  '@amc 34 5:30',
  '@holister + @h&m 7:30 - ~8:10',
  ' @seoulSaloon 8:30. ',
  '',
  'Took haircut with dyno ',
  'Read book and vibe code until 2:50',
  'Walked to mariya at blue willow. Then Jessie came, then Brandon (late) due to construction',
  'Ordered Kong pao chicken (salty) garlic string beans, szcheuan beef and jasmine dragon pearl tea. ',
  'Jessie paid',
  'Walked to hey tea (got the king jasmine honeydew)',
  'Walked to amc and watch prime time(didn’t like it)',
  'Stalled time for dinner at holister and H&M ',
  'Then walked to dinner @seoulsaloon',
  'Ate rose tteboki, fried chicken(chicken nuggets?), octopus kimbap ',
  'Talked about relationship + movie ',
  'Jessie Brandon age gap like 3 years ',
  'Mariya like 3 years older 1/2 younger',
  'Mariya paid ',
  'Split ways went home ',
  '',
  '',
  'How I felt:',
  'It was an ok day. I still do feel almost outsidery but it’s okay.',
].join('\n')

/** The rest of the owner's stored record: How it felt, in their words. */
export const OWNER_FEELINGS = 'It was an ok day. I still do feel almost outsidery but it’s okay.'
```

In `src/test/fixtures.ts`, replace:

```ts
}

export function meetup(id: string, date: string, friendIds: string[], typeId = 'coffee'): Meetup {
  return { id, date, typeId, friendIds, note: '', activities: [], createdAt: `${date}T12:00:00.000Z` }
}

/** A stored photo with tiny stand-in images (not real JPEGs, but the right shape). */
```

with:

```ts
}

export function meetup(id: string, date: string, friendIds: string[], typeId = 'coffee'): Meetup {
  return {
    id,
    date,
    typeId,
    friendIds,
    note: '',
    activities: [],
    weather: [],
    mood: null,
    feelings: '',
    createdAt: `${date}T12:00:00.000Z`,
  }
}

/** A stored photo with tiny stand-in images (not real JPEGs, but the right shape). */
```

- [ ] **Step 6: Write the failing tests for reading a day**

Create `src/lib/dayText.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { meetup } from '../test/fixtures'
import { OWNER_DAY_TYPED, OWNER_MESSAGE } from '../test/dayFixtures'
import {
  DAY_MAX_TYPED,
  daySnippet,
  type DayLine,
  type DayPart,
  type DayStop,
  type DayTime,
  FEELINGS_MAX,
  isDayEmpty,
  normalizeLineBreaks,
  readDay,
  TOO_LONG_FEELINGS,
} from './dayText'

const text = (value: string): DayLine => ({ kind: 'text', text: value })
const paid = (value: string, who: string | null): DayLine => ({ kind: 'paid', text: value, who })
const at = (minutes: number, approx = false): DayTime => ({ minutes, approx })
const stop = (place: string, start: DayTime | null, end: DayTime | null = null, lines: DayLine[] = []): DayStop => ({
  place,
  start,
  end,
  lines,
})

/** The stops of a day that is one timeline. */
function stopsOf(note: string): DayStop[] {
  const parts = readDay(note)
  expect(parts).toHaveLength(1)
  const [part] = parts
  if (part.kind !== 'timeline') throw new Error(`Expected a timeline, got ${part.kind}`)
  return part.stops
}

/** Each stop's start (and end) in minutes after midnight. */
function timesOf(note: string): (number | [number, number] | null)[] {
  return stopsOf(note).map(({ start, end }) => (start && end ? [start.minutes, end.minutes] : (start?.minutes ?? null)))
}

describe('limits', () => {
  it('stops typing at 10,000 characters for the day and 4,000 for how it felt', () => {
    expect(DAY_MAX_TYPED).toBe(10_000)
    expect(FEELINGS_MAX).toBe(4_000)
    expect(TOO_LONG_FEELINGS).toBe('Keep how it felt under 4,000 characters.')
  })
})

describe('normalizeLineBreaks', () => {
  it('turns \\r\\n and \\r into \\n and changes nothing else', () => {
    expect(normalizeLineBreaks('a\r\nb\rc\n d ')).toBe('a\nb\nc\n d ')
  })
})

// FROZEN for grammar 1: never edit these expectations. A change to the rules is a new grammar.
describe('golden fixture A: the owner’s day as written in the app', () => {
  it('is the stored record’s note, character for character', () => {
    expect(OWNER_DAY_TYPED).toHaveLength(808)
  })

  it('reads as one timeline of 8 stops, with their lines and payers, and no prose', () => {
    expect(readDay(OWNER_DAY_TYPED)).toEqual<DayPart[]>([
      {
        kind: 'timeline',
        stops: [
          stop('nonstopstyle', at(630), null, [text('Took haircut with dyno')]),
          stop('strand bookstore', at(690)),
          stop('Sammy L coffee', at(713), null, [text('Read book and vibe code until 2:50')]),
          stop('Blue willow', at(930), null, [
            text('Walked to mariya at blue willow. Then Jessie came, then Brandon (late) due to construction'),
            text('Ordered Kong pao chicken (salty) garlic string beans, szcheuan beef and jasmine dragon pearl tea.'),
            paid('Jessie paid', 'Jessie'),
          ]),
          stop('hey tea Broadway', null, null, [text('Walked to hey tea (got the king jasmine honeydew)')]),
          stop('amc 34', at(1050), null, [text('Walked to amc and watch prime time(didn’t like it)')]),
          stop('holister + h&m', at(1170), at(1210, true), [text('Stalled time for dinner at holister and H&M')]),
          stop('seoulSaloon', at(1230), null, [
            text('Then walked to dinner @seoulsaloon'),
            text('Ate rose tteboki, fried chicken(chicken nuggets?), octopus kimbap'),
            text('Talked about relationship + movie'),
            text('Jessie Brandon age gap like 3 years'),
            text('Mariya like 3 years older 1/2 younger'),
            paid('Mariya paid', 'Mariya'),
            text('Split ways went home'),
          ]),
        ],
      },
    ])
  })
})

// FROZEN for grammar 1: never edit these expectations. A change to the rules is a new grammar.
describe('golden fixture B: the owner’s message exactly as sent', () => {
  it('is the message byte for byte', () => {
    expect(OWNER_MESSAGE).toHaveLength(925)
    expect(OWNER_MESSAGE).toContain('(didn’t like it)')
    expect(OWNER_MESSAGE).toContain('@Blue willow 3:30, \n')
    expect(OWNER_MESSAGE).toContain('Split ways went home \n\n\nHow I felt:\n')
  })

  it('reads as prose, a heading, the timeline, the story, a heading and the last sentence', () => {
    expect(readDay(OWNER_MESSAGE)).toEqual<DayPart[]>([
      { kind: 'prose', lines: [text('Rainy day')] },
      { kind: 'heading', text: 'Locations' },
      {
        kind: 'timeline',
        stops: [
          stop('nonstopstyle', at(630)),
          stop('strand bookstore', at(690)),
          stop('Sammy L coffee', at(713)),
          stop('Blue willow', at(930)),
          stop('hey tea Broadway', null),
          stop('amc 34', at(1050)),
          stop('holister + h&m', at(1170), at(1210, true)),
          stop('seoulSaloon', at(1230)),
        ],
      },
      {
        kind: 'prose',
        lines: [
          text('Took haircut with dyno'),
          text('Read book and vibe code until 2:50'),
          text('Walked to mariya at blue willow. Then Jessie came, then Brandon (late) due to construction'),
          text('Ordered Kong pao chicken (salty) garlic string beans, szcheuan beef and jasmine dragon pearl tea.'),
          paid('Jessie paid', 'Jessie'),
          text('Walked to hey tea (got the king jasmine honeydew)'),
          text('Walked to amc and watch prime time(didn’t like it)'),
          text('Stalled time for dinner at holister and H&M'),
          text('Then walked to dinner @seoulsaloon'),
          text('Ate rose tteboki, fried chicken(chicken nuggets?), octopus kimbap'),
          text('Talked about relationship + movie'),
          text('Jessie Brandon age gap like 3 years'),
          text('Mariya like 3 years older 1/2 younger'),
          paid('Mariya paid', 'Mariya'),
          text('Split ways went home'),
        ],
      },
      { kind: 'heading', text: 'How I felt' },
      { kind: 'prose', lines: [text('It was an ok day. I still do feel almost outsidery but it’s okay.')] },
    ])
  })
})

describe('place lines', () => {
  it.each([
    ['@nonstopstyle 10:30', 'nonstopstyle', at(630), null],
    ['@Blue willow 3:30, ', 'Blue willow', at(930), null],
    [' @seoulSaloon 8:30. ', 'seoulSaloon', at(510), null],
    ['@hey tea Broadway ', 'hey tea Broadway', null, null],
    ['@amc 34 5:30', 'amc 34', at(1050), null],
    ['@amc 34', 'amc 34', null, null],
    ['@holister + @h&m 7:30 - ~8:10', 'holister + h&m', at(450), at(490, true)],
    ['@Bar 7-9pm', 'Bar', at(1140), at(1260)],
    ['@Cafe 3pm', 'Cafe', at(900), null],
    ['@Cafe 10.30', 'Cafe', at(630), null],
    ['@Park about 8:10', 'Park', at(490, true), null],
    ['@Gym 15:30', 'Gym', at(930), null],
    ['@Bar 25:00', 'Bar 25:00', null, null],
  ])('reads %j as the place %j', (line, place, start, end) => {
    expect(stopsOf(line)).toEqual([stop(place, start, end)])
  })

  it('reads more ways of writing a time', () => {
    expect(timesOf('@Cafe 3 PM')).toEqual([900])
    expect(timesOf('@Cafe around 3pm')).toEqual([900])
    expect(stopsOf('@Cafe around 3pm')[0].start).toEqual(at(900, true))
    expect(timesOf('@Show 7 to 9pm')).toEqual([[1140, 1260]])
    expect(timesOf('@Show 7:30\u20139:15')).toEqual([[450, 555]])
    expect(timesOf('@Show 7:30 \u2014 9:15')).toEqual([[450, 555]])
  })

  it('never reads a bare number or an impossible clock as a time', () => {
    expect(stopsOf('@Meet 10 - 11')[0]).toEqual(stop('Meet 10 - 11', null))
    expect(stopsOf('@Cafe 13pm')[0]).toEqual(stop('Cafe 13pm', null))
    expect(stopsOf('@Cafe 9:75')[0]).toEqual(stop('Cafe 9:75', null))
    // A range's end needs minutes or am/pm too.
    expect(stopsOf('@Show 11am-1')[0]).toEqual(stop('Show 11am-1', null))
  })

  it('skips a line that is only "@"', () => {
    expect(readDay('@')).toEqual([])
    expect(readDay('@Cafe\n@\nCoffee')).toEqual([{ kind: 'timeline', stops: [stop('Cafe', null, null, [text('Coffee')])] }])
  })

  it('reads a line with nothing left once the time is taken off as ordinary text', () => {
    expect(readDay('@ 3:30')).toEqual([{ kind: 'prose', lines: [text('@ 3:30')] }])
  })

  it('reads an "@" anywhere but the start of a line as ordinary text', () => {
    expect(readDay('Then walked to dinner @seoulsaloon')).toEqual([
      { kind: 'prose', lines: [text('Then walked to dinner @seoulsaloon')] },
    ])
  })
})

describe('paid lines', () => {
  it('reads one to three words before "paid" as who paid', () => {
    expect(readDay('Jessie paid\nI paid\nJessie paid for dinner\nMary Ann Lee paid.\nSam paid!')).toEqual([
      {
        kind: 'prose',
        lines: [
          paid('Jessie paid', 'Jessie'),
          paid('I paid', 'I'),
          paid('Jessie paid for dinner', 'Jessie'),
          paid('Mary Ann Lee paid.', 'Mary Ann Lee'),
          paid('Sam paid!', 'Sam'),
        ],
      },
    ])
  })

  it('reads a shared bill', () => {
    const lines = ['split', 'Split it', 'we split', 'We split it.', 'split the bill', 'Split the check']
    expect(readDay(lines.join('\n'))).toEqual([{ kind: 'prose', lines: lines.map((line) => paid(line, null)) }])
  })

  it('keeps everything else as text', () => {
    const lines = ['Nobody paid', 'No one paid', 'Split ways went home', 'Me and my mom paid', 'paid', 'Who paid?']
    expect(readDay(lines.join('\n'))).toEqual([{ kind: 'prose', lines: lines.map(text) }])
  })
})

describe('headings', () => {
  it('reads a line of up to 40 characters ending with ":" as a heading', () => {
    const forty = `${'x'.repeat(39)}:`
    expect(readDay(forty)).toEqual([{ kind: 'heading', text: 'x'.repeat(39) }])
    expect(readDay(`x${forty}`)).toEqual([{ kind: 'prose', lines: [text(`x${forty}`)] }])
    expect(readDay('Note to self: buy milk')).toEqual([{ kind: 'prose', lines: [text('Note to self: buy milk')] }])
    expect(readDay(':')).toEqual([{ kind: 'prose', lines: [text(':')] }])
  })
})

describe('grouping', () => {
  it('keeps place lines in a row as one timeline, even with blank lines between them', () => {
    expect(readDay('@A\n\n@B\n\n\n@C')).toEqual([{ kind: 'timeline', stops: [stop('A', null), stop('B', null), stop('C', null)] }])
  })

  it('gives the lines under a place to its stop, up to a blank line', () => {
    expect(readDay('@A\nOne\nTwo\n\nThree')).toEqual([
      { kind: 'timeline', stops: [stop('A', null, null, [text('One'), text('Two')])] },
      { kind: 'prose', lines: [text('Three')] },
    ])
  })

  it('ends a timeline at a heading, which stands on its own', () => {
    expect(readDay('@A\nOne\nLater:\n@B')).toEqual([
      { kind: 'timeline', stops: [stop('A', null, null, [text('One')])] },
      { kind: 'heading', text: 'Later' },
      { kind: 'timeline', stops: [stop('B', null)] },
    ])
  })

  it('makes one small gap of any number of blank lines inside prose, and none at its ends', () => {
    expect(readDay('\n\nOne\n\n\n\nTwo\n\n')).toEqual([{ kind: 'prose', lines: [text('One'), { kind: 'gap' }, text('Two')] }])
  })

  it('runs prose until a place line, and keeps paid lines where they are', () => {
    expect(readDay('Rainy\nI paid\n@A\nJessie paid')).toEqual([
      { kind: 'prose', lines: [text('Rainy'), paid('I paid', 'I')] },
      { kind: 'timeline', stops: [stop('A', null, null, [paid('Jessie paid', 'Jessie')])] },
    ])
  })

  it('reads \\r\\n line breaks from a backup the same way', () => {
    expect(readDay('@A 10:30\r\nOne')).toEqual(readDay('@A 10:30\nOne'))
  })
})

describe('AM or PM', () => {
  it('reads the owner’s day in day order', () => {
    expect(timesOf(OWNER_DAY_TYPED)).toEqual([630, 690, 713, 930, null, 1050, [1170, 1210], 1230])
  })

  it('reads the first time of the day as a morning from 7 to 11, and an afternoon for 12 and 1 to 6', () => {
    expect(timesOf('@A 7:00')).toEqual([420])
    expect(timesOf('@A 11:00')).toEqual([660])
    expect(timesOf('@A 12:00')).toEqual([720])
    expect(timesOf('@A 6:00')).toEqual([1080])
  })

  it('reads a late unmarked time past midnight', () => {
    expect(timesOf('@A 9pm\n@B 12:30')).toEqual([1260, 1470])
  })

  it('counts a fixed time earlier than the latest so far as past midnight, and reads on from it', () => {
    expect(timesOf('@A 9pm\n@B 1am\n@C 2:00')).toEqual([1260, 1500, 1560])
  })

  it('gives a range with am or pm only on its end the same half when that keeps the start first', () => {
    expect(timesOf('@A 7-9pm')).toEqual([[1140, 1260]])
    expect(timesOf('@A 11-1pm')).toEqual([[660, 780]])
  })

  it('reads 24-hour times and a leading zero exactly as typed', () => {
    expect(timesOf('@A 15:30')).toEqual([930])
    expect(timesOf('@A 08:30')).toEqual([510])
    expect(timesOf('@A 0:15')).toEqual([15])
    // A leading zero is a morning even as the first time, where "5:30" reads 5:30 PM.
    expect(timesOf('@A 05:30')).toEqual([330])
    expect(timesOf('@A 5:30')).toEqual([1050])
  })

  it('reads a range end after its start', () => {
    expect(timesOf('@A 11am-1:30')).toEqual([[660, 810]])
  })

  it('changes how a later time reads when a place is added above it, and never the text', () => {
    expect(timesOf('@B 3:30')).toEqual([930])
    expect(timesOf('@A 9pm\n@B 3:30')).toEqual([1260, 1650])
  })
})

describe('daySnippet', () => {
  it('lists the first three places, then how many more', () => {
    expect(daySnippet(OWNER_DAY_TYPED)).toBe('nonstopstyle, strand bookstore, Sammy L coffee and 5 more')
    expect(daySnippet(OWNER_MESSAGE)).toBe('nonstopstyle, strand bookstore, Sammy L coffee and 5 more')
  })

  it('lists one, two or three places like names', () => {
    expect(daySnippet('@Cafe 10:30\nCoffee')).toBe('Cafe')
    expect(daySnippet('@Cafe\n@Park')).toBe('Cafe and Park')
    expect(daySnippet('@Cafe\n@Park\n@Bar')).toBe('Cafe, Park and Bar')
    expect(daySnippet('@Cafe\n@Park\n@Bar\n@Gym')).toBe('Cafe, Park, Bar and 1 more')
  })

  it('counts a place once, ignoring case, spelled as it first appears', () => {
    expect(daySnippet('@Cafe 9am\n@Park\n@cafe 5pm')).toBe('Cafe and Park')
  })

  it('without places, shows the first line', () => {
    expect(daySnippet('Tacos')).toBe('Tacos')
    expect(daySnippet('\n  Tacos  \nThen karaoke')).toBe('Tacos')
  })

  it('cuts a long first line at the last space within 80 characters, or at 80 for one long word', () => {
    const words = 'We walked all the way along the river to the old bridge and back again before dinner'
    expect(words.length).toBeGreaterThan(80)
    expect(daySnippet(words)).toBe('We walked all the way along the river to the old bridge and back again before…')
    expect(daySnippet('x'.repeat(100))).toBe(`${'x'.repeat(80)}…`)
    const eighty = 'y'.repeat(80)
    expect(daySnippet(eighty)).toBe(eighty)
  })

  it('is null for an empty day', () => {
    expect(daySnippet('')).toBeNull()
    expect(daySnippet(' \n\n ')).toBeNull()
  })
})

describe('isDayEmpty', () => {
  const empty = meetup('m1', '2026-10-03', ['f1'])

  it('is true with nothing written, picked or felt', () => {
    expect(isDayEmpty(empty)).toBe(true)
    expect(isDayEmpty({ ...empty, note: ' \n ', feelings: ' ' })).toBe(true)
  })

  it('is false with any of the day’s fields', () => {
    expect(isDayEmpty({ ...empty, note: 'Tacos' })).toBe(false)
    expect(isDayEmpty({ ...empty, feelings: 'Good' })).toBe(false)
    expect(isDayEmpty({ ...empty, weather: ['rainy'] })).toBe(false)
    expect(isDayEmpty({ ...empty, mood: 'okay' })).toBe(false)
  })
})
```

- [ ] **Step 7: Run them to see them fail**

Run: `npx vitest run src/lib/dayText.test.ts`
Expected: FAIL, `Error: Cannot find module './dayText'`.

- [ ] **Step 8: Write the grammar**

`readDay` reads place lines (a time at the end is the longest one that reads as a time, after a space), paid lines, headings and prose, top to bottom, resolving each unmarked time in day order. Nothing in it touches `window`, `document` or `Intl`.

Create `src/lib/dayText.ts`:

```ts
import type { Meetup } from '../types'

// Reading a day (grammar 1). Pure: no window, document or Intl, so the service worker and tests can use it.
// FROZEN: these rules never change, so a memory reads the same after every update. A change is a new grammar
// (stored as `dayGrammar: 2` on days saved after it); meetups without a grammar field are grammar 1. The golden
// fixtures in dayText.test.ts pin it.

/** The day box stops typing here. A longer day from before, or from a backup, is kept and still editable. */
export const DAY_MAX_TYPED = 10_000
export const FEELINGS_MAX = 4_000
export const TOO_LONG_FEELINGS = 'Keep how it felt under 4,000 characters.'

export type DayLine =
  | { kind: 'text'; text: string }
  /** "Jessie paid": `who` is the words before "paid"; null for a shared bill ("We split it"). */
  | { kind: 'paid'; text: string; who: string | null }

export interface DayTime {
  /** Minutes after the day's midnight, 0 to 2879: a reading past midnight adds 1,440. */
  minutes: number
  /** Typed with "~", "about" or "around". */
  approx: boolean
}

export interface DayStop {
  place: string
  start: DayTime | null
  end: DayTime | null
  lines: DayLine[]
}

export interface DayGap {
  kind: 'gap'
}

export type DayPart =
  | { kind: 'heading'; text: string }
  | { kind: 'timeline'; stops: DayStop[] }
  | { kind: 'prose'; lines: (DayLine | DayGap)[] }

/** "\r\n" and "\r" become "\n". Nothing else about the text changes. */
export function normalizeLineBreaks(text: string): string {
  return text.replace(/\r\n?/g, '\n')
}

const LINE_BREAK = /\r\n?|\n/
const DAY_MINUTES = 1440
const NOON = 720

/** A clock as typed at the end of a place line. */
interface Clock {
  hour: number
  minute: number
  half: 'am' | 'pm' | null
  /** "08:30": a leading zero fixes the time as typed. */
  leadingZero: boolean
  /** An hour with no minutes and no am or pm ("7" in "7-9pm"). */
  bare: boolean
  approx: boolean
}

const APPROX = String.raw`(~\s*|(?:about|around)\s+)?`
const CLOCK = String.raw`(\d{1,2})(?:[:.](\d{2}))?(?:\s*([ap]m))?`
const TIME = new RegExp(String.raw`^${APPROX}${CLOCK}(?:(?:\s*[-\u2013\u2014]\s*|\s+to\s+)${APPROX}${CLOCK})?$`, 'i')

function clockOf(approx: string | undefined, hourText: string, minuteText: string | undefined, halfText: string | undefined): Clock | null {
  const hour = Number(hourText)
  const minute = minuteText === undefined ? 0 : Number(minuteText)
  const half = halfText === undefined ? null : halfText.toLowerCase() === 'am' ? 'am' : 'pm'
  if (minute > 59) return null
  if (half ? hour < 1 || hour > 12 : hour > 23) return null
  return {
    hour,
    minute,
    half,
    leadingZero: hourText.length === 2 && hourText.startsWith('0'),
    bare: minuteText === undefined && half === null,
    approx: approx !== undefined,
  }
}

/** A time, or a range of two, filling all of `text`. A lone clock needs minutes or am/pm; so does a range's end. */
function readTimeText(text: string): { start: Clock; end: Clock | null } | null {
  const match = TIME.exec(text)
  if (!match) return null
  const start = clockOf(match[1], match[2], match[3], match[4])
  if (!start) return null
  if (match[6] === undefined) return start.bare ? null : { start, end: null }
  const end = clockOf(match[5], match[6], match[7], match[8])
  return end && !end.bare ? { start, end } : null
}

interface PlaceLine {
  place: string
  start: Clock | null
  end: Clock | null
}

/** A trimmed line read as a place line; 'skip' for "@" alone; null when it isn't one. */
function readPlaceLine(line: string): PlaceLine | 'skip' | null {
  if (!line.startsWith('@')) return null
  if (line === '@') return 'skip'
  let rest = line.replace(/[\s,.;!]+$/, '')
  let start: Clock | null = null
  let end: Clock | null = null
  // A time at the end, after a space: the longest that reads as a time.
  for (let i = 0; i < rest.length; i += 1) {
    if (!/\s/.test(rest[i])) continue
    const time = readTimeText(rest.slice(i + 1))
    if (time) {
      start = time.start
      end = time.end
      rest = rest.slice(0, i)
      break
    }
  }
  const place = rest
    .split(/\s+/)
    .map((word) => word.replace(/^@+/, ''))
    .filter((word) => word !== '')
    .join(' ')
  return place === '' ? null : { place, start, end }
}

function minutesOf(hour: number, minute: number, half: 'am' | 'pm'): number {
  return (hour % 12) * 60 + minute + (half === 'pm' ? NOON : 0)
}

/** Typed with am or pm, an hour of 0 or 13 to 23, or a leading zero: read exactly as typed. */
function isFixed(clock: Clock): boolean {
  return clock.half !== null || clock.hour === 0 || clock.hour >= 13 || clock.leadingZero
}

/** A fixed time earlier than the latest so far is past midnight. */
function afterLatest(minutes: number, latest: number | null): number {
  return latest !== null && minutes < latest ? minutes + DAY_MINUTES : minutes
}

/** Reads a clock in day order: the earliest reading (AM, PM, then both past midnight) not before the latest so far. */
function resolve(clock: Clock, latest: number | null): number {
  if (clock.half) return afterLatest(minutesOf(clock.hour, clock.minute, clock.half), latest)
  if (isFixed(clock)) return afterLatest(clock.hour * 60 + clock.minute, latest)
  const am = minutesOf(clock.hour, clock.minute, 'am')
  const pm = am + NOON
  // The first time of the day: 7 to 11 are mornings; 12 and 1 to 6 are afternoons.
  if (latest === null) return clock.hour >= 7 && clock.hour <= 11 ? am : pm
  const readings = [am, pm, am + DAY_MINUTES, pm + DAY_MINUTES]
  return readings.find((reading) => reading >= latest) ?? readings[readings.length - 1]
}

/** A range with am or pm only on its end: the start takes the same half when that keeps it before the end. */
function startFromEnd(start: Clock, end: Clock & { half: 'am' | 'pm' }): number {
  const same = minutesOf(start.hour, start.minute, end.half)
  return same < minutesOf(end.hour, end.minute, end.half)
    ? same
    : minutesOf(start.hour, start.minute, end.half === 'am' ? 'pm' : 'am')
}

const PAID = /^(\S+(?:\s+\S+){0,2})\s+paid(?:\s+for\s.*)?$/i
const NOBODY = /^(?:nobody|no one)$/i
const SPLIT = new Set(['split', 'split it', 'we split', 'we split it', 'split the bill', 'split the check'])

/** A line that isn't a place line: who paid, a shared bill, or text. */
function readLine(line: string): DayLine {
  const words = line.replace(/[.!]$/, '')
  if (SPLIT.has(words.toLowerCase())) return { kind: 'paid', text: line, who: null }
  const paid = PAID.exec(words)
  if (paid && !NOBODY.test(paid[1])) return { kind: 'paid', text: line, who: paid[1] }
  return { kind: 'text', text: line }
}

/** "Locations:" reads as the heading "Locations": a line ending with ":", at most 40 characters. */
function headingOf(line: string): string | null {
  if (!line.endsWith(':') || Array.from(line).length > 40) return null
  const text = line.slice(0, -1).trim()
  return text === '' ? null : text
}

/**
 * Reads a day (grammar 1) into headings, timelines of places and prose, top to bottom. The text itself is
 * never changed: this is only how it reads back.
 */
export function readDay(note: string): DayPart[] {
  const parts: DayPart[] = []
  let timeline: DayStop[] | null = null
  let stop: DayStop | null = null
  let prose: (DayLine | DayGap)[] | null = null
  let gap = false
  let latest: number | null = null

  for (const raw of note.split(LINE_BREAK)) {
    const line = raw.trim()
    if (line === '') {
      // A blank line ends a stop's lines (the timeline goes on with the next place) and makes a gap in prose.
      stop = null
      if (prose) gap = true
      continue
    }

    const place = readPlaceLine(line)
    if (place === 'skip') continue
    if (place) {
      if (!timeline) {
        timeline = []
        parts.push({ kind: 'timeline', stops: timeline })
      }
      prose = null
      gap = false
      let start: DayTime | null = null
      let end: DayTime | null = null
      if (place.start) {
        const startMinutes =
          place.end?.half && !isFixed(place.start)
            ? afterLatest(startFromEnd(place.start, { ...place.end, half: place.end.half }), latest)
            : resolve(place.start, latest)
        start = { minutes: startMinutes, approx: place.start.approx }
        latest = Math.max(latest ?? startMinutes, startMinutes)
        if (place.end) {
          const endMinutes = resolve(place.end, latest)
          end = { minutes: endMinutes, approx: place.end.approx }
          latest = Math.max(latest, endMinutes)
        }
      }
      stop = { place: place.place, start, end, lines: [] }
      timeline.push(stop)
      continue
    }

    const dayLine = readLine(line)
    const heading = dayLine.kind === 'text' ? headingOf(line) : null
    if (heading !== null) {
      timeline = null
      stop = null
      prose = null
      gap = false
      parts.push({ kind: 'heading', text: heading })
      continue
    }
    if (stop) {
      stop.lines.push(dayLine)
      continue
    }
    timeline = null
    if (!prose) {
      prose = []
      parts.push({ kind: 'prose', lines: prose })
    } else if (gap) {
      prose.push({ kind: 'gap' })
    }
    gap = false
    prose.push(dayLine)
  }
  return parts
}

const SNIPPET_LENGTH = 80

/** Places written like names: "a", "a and b", "a, b and c", then "a, b, c and 5 more". */
function listPlaces(places: string[]): string {
  if (places.length === 1) return places[0]
  if (places.length === 2) return `${places[0]} and ${places[1]}`
  if (places.length === 3) return `${places[0]}, ${places[1]} and ${places[2]}`
  return `${places[0]}, ${places[1]}, ${places[2]} and ${places.length - 3} more`
}

/**
 * A history row's glimpse of the day: its first places (each counted once, ignoring case), or else its first
 * line, cut at 80 characters. Null for an empty day.
 */
export function daySnippet(note: string): string | null {
  const places: string[] = []
  const seen = new Set<string>()
  for (const part of readDay(note)) {
    if (part.kind !== 'timeline') continue
    for (const { place } of part.stops) {
      const key = place.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      places.push(place)
    }
  }
  if (places.length > 0) return listPlaces(places)
  const first = note
    .split(LINE_BREAK)
    .map((line) => line.trim())
    .find((line) => line !== '')
  if (first === undefined) return null
  const characters = Array.from(first)
  if (characters.length <= SNIPPET_LENGTH) return first
  const head = characters.slice(0, SNIPPET_LENGTH).join('')
  const space = head.lastIndexOf(' ')
  return `${(space > 0 ? head.slice(0, space) : head).trimEnd()}…`
}

/** Nothing written about the day: no words in either box, no weather and no mood. */
export function isDayEmpty(meetup: Pick<Meetup, 'note' | 'feelings' | 'weather' | 'mood'>): boolean {
  return meetup.note.trim() === '' && meetup.feelings.trim() === '' && meetup.weather.length === 0 && meetup.mood === null
}
```

- [ ] **Step 9: Run them to see them pass**

Run: `npx vitest run src/lib/dayText.test.ts`
Expected: PASS, `Tests  50 passed (50)`.

- [ ] **Step 10: Write the failing tests for the helper bar's edits**

The last test replays the owner's walk home (the helpers plus the typing) and must give fixture A exactly.

Create `src/lib/dayEdit.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { OWNER_DAY_TYPED } from '../test/dayFixtures'
import { changeBetween, type DayEdit, insertAtCaret, insertPaidLine, insertPlaceLine } from './dayEdit'

describe('insertPlaceLine', () => {
  it('starts an empty day with the place, and leaves the caret on the line under it', () => {
    expect(insertPlaceLine('', 0, 'Blue willow 3:30')).toEqual({ value: '@Blue willow 3:30\n', caret: 18 })
  })

  it('puts the place on a blank line the caret is on', () => {
    expect(insertPlaceLine('Rainy\n\nWalked home', 6, 'Cafe')).toEqual({ value: 'Rainy\n@Cafe\nWalked home', caret: 11 })
    expect(insertPlaceLine('Rainy\n  ', 8, 'Cafe')).toEqual({ value: 'Rainy\n@Cafe\n', caret: 12 })
  })

  it('at the end, adds the place after the caret’s line with an empty line under it', () => {
    expect(insertPlaceLine('Took haircut', 12, 'strand bookstore 11:30')).toEqual({
      value: 'Took haircut\n@strand bookstore 11:30\n',
      caret: 37,
    })
    // Anywhere on the last line, the place still goes after it.
    expect(insertPlaceLine('Took haircut', 4, 'Cafe')).toEqual({ value: 'Took haircut\n@Cafe\n', caret: 19 })
  })

  it('in the middle, adds the place after the caret’s line with the caret at its end and no empty line', () => {
    expect(insertPlaceLine('One\nTwo', 2, 'Cafe')).toEqual({ value: 'One\n@Cafe\nTwo', caret: 9 })
  })

  it('drops a leading "@" typed into the field and keeps one inside', () => {
    expect(insertPlaceLine('', 0, '@Cafe').value).toBe('@Cafe\n')
    expect(insertPlaceLine('', 0, ' @@ Cafe ').value).toBe('@Cafe\n')
    expect(insertPlaceLine('', 0, 'holister + @h&m 7:30 - ~8:10').value).toBe('@holister + @h&m 7:30 - ~8:10\n')
  })

  it('changes nothing for an empty field', () => {
    expect(insertPlaceLine('One', 3, ' @ ')).toEqual({ value: 'One', caret: 3 })
  })

  it('reads a caret at the very start as the first line', () => {
    expect(insertPlaceLine('\nOne', 0, 'Cafe')).toEqual({ value: '@Cafe\nOne', caret: 5 })
  })
})

describe('insertPaidLine', () => {
  it('adds the line after the caret’s line with the caret at its end, and no empty line after it', () => {
    expect(insertPaidLine('Ordered tea.', 12, 'Jessie paid')).toEqual({ value: 'Ordered tea.\nJessie paid', caret: 24 })
    expect(insertPaidLine('One\nTwo', 1, 'I paid')).toEqual({ value: 'One\nI paid\nTwo', caret: 10 })
  })

  it('puts the line on a blank line the caret is on', () => {
    expect(insertPaidLine('One\n', 4, 'We split it')).toEqual({ value: 'One\nWe split it', caret: 15 })
    expect(insertPaidLine('', 0, 'I paid')).toEqual({ value: 'I paid', caret: 6 })
  })
})

describe('insertAtCaret', () => {
  it('puts a space before the text unless the caret follows a space or starts a line', () => {
    expect(insertAtCaret('Left at', 7, '9:52 PM')).toEqual({ value: 'Left at 9:52 PM', caret: 15 })
    expect(insertAtCaret('Left at ', 8, '9:52 PM')).toEqual({ value: 'Left at 9:52 PM', caret: 15 })
    expect(insertAtCaret('Left\n', 5, '9:52 PM')).toEqual({ value: 'Left\n9:52 PM', caret: 12 })
    expect(insertAtCaret('', 0, '21:52')).toEqual({ value: '21:52', caret: 5 })
    expect(insertAtCaret('Home by end', 7, '9:52 PM')).toEqual({ value: 'Home by 9:52 PM end', caret: 15 })
  })
})

describe('changeBetween', () => {
  it('finds the one stretch to replace', () => {
    expect(changeBetween('Took', 'Took\n@Cafe\n')).toEqual({ from: 4, to: 4, text: '\n@Cafe\n' })
    expect(changeBetween('One\n\nTwo', 'One\n@Cafe\nTwo')).toEqual({ from: 4, to: 4, text: '@Cafe' })
    expect(changeBetween('abc', 'abc')).toEqual({ from: 3, to: 3, text: '' })
  })
})

describe('the owner’s walk home, replayed', () => {
  it('writes golden fixture A exactly, with the helpers and the typing in the walkthrough', () => {
    let day: DayEdit = { value: '', caret: 0 }
    const type = (text: string) => {
      day = { value: day.value.slice(0, day.caret) + text + day.value.slice(day.caret), caret: day.caret + text.length }
    }
    const place = (text: string) => {
      day = insertPlaceLine(day.value, day.caret, text)
    }
    const paid = (line: string) => {
      day = insertPaidLine(day.value, day.caret, line)
    }

    place('nonstopstyle 10:30')
    type('Took haircut with dyno')
    place('strand bookstore 11:30')
    place('Sammy L coffee 11:53')
    type('Read book and vibe code until 2:50')
    place('Blue willow 3:30')
    type('Walked to mariya at blue willow. Then Jessie came, then Brandon (late) due to construction')
    type('\n')
    type('Ordered Kong pao chicken (salty) garlic string beans, szcheuan beef and jasmine dragon pearl tea.')
    paid('Jessie paid')
    place('hey tea Broadway')
    type('Walked to hey tea (got the king jasmine honeydew)')
    place('amc 34 5:30')
    type('Walked to amc and watch prime time(didn’t like it)')
    place('holister + @h&m 7:30 - ~8:10')
    type('Stalled time for dinner at holister and H&M')
    place('seoulSaloon 8:30')
    for (const line of [
      'Then walked to dinner @seoulsaloon',
      'Ate rose tteboki, fried chicken(chicken nuggets?), octopus kimbap',
      'Talked about relationship + movie',
      'Jessie Brandon age gap like 3 years',
    ]) {
      type(line)
      type('\n')
    }
    type('Mariya like 3 years older 1/2 younger')
    paid('Mariya paid')
    type('\n')
    type('Split ways went home')

    expect(day.value).toBe(OWNER_DAY_TYPED)
  })
})
```

- [ ] **Step 11: Run them to see them fail**

Run: `npx vitest run src/lib/dayEdit.test.ts`
Expected: FAIL, `Error: Cannot find module './dayEdit'`.

- [ ] **Step 12: Write the edits**

Create `src/lib/dayEdit.ts`:

```ts
// Pure string edits for the day page's helper bar. Each returns the new text and where the caret goes.
// Everything is placed relative to the caret in The day.

export interface DayEdit {
  value: string
  caret: number
}

/** The start and end of the line holding the caret. */
function lineAround(value: string, caret: number): { start: number; end: number } {
  const start = caret === 0 ? 0 : value.lastIndexOf('\n', caret - 1) + 1
  const next = value.indexOf('\n', caret)
  return { start, end: next === -1 ? value.length : next }
}

/**
 * Puts `line` on its own line: it replaces a blank line holding the caret, or goes on a new line after the
 * caret's line. `openLine` adds an empty line after it, with the caret there, when it lands at the end of the text.
 */
function placeLine(value: string, caret: number, line: string, openLine: boolean): DayEdit {
  const { start, end } = lineAround(value, caret)
  const blank = value.slice(start, end).trim() === ''
  const before = blank ? value.slice(0, start) : `${value.slice(0, end)}\n`
  const after = value.slice(end)
  if (after === '' && openLine) {
    const next = `${before}${line}\n`
    return { value: next, caret: next.length }
  }
  return { value: `${before}${line}${after}`, caret: before.length + line.length }
}

/**
 * Adds a place line ("@Blue willow 3:30") from the Place field's text. A leading "@" typed into the field is
 * dropped, so there's never "@@". At the end of the text an empty line follows with the caret on it, ready for
 * what happened there; in the middle the caret goes to the end of the place line, so no blank line splits what's
 * below. Text that is empty once trimmed changes nothing.
 */
export function insertPlaceLine(value: string, caret: number, text: string): DayEdit {
  const place = text.trim().replace(/^@+/, '').trim()
  if (place === '') return { value, caret }
  return placeLine(value, caret, `@${place}`, true)
}

/** Adds "Jessie paid" (or "I paid", "We split it") as its own line, with the caret at its end. */
export function insertPaidLine(value: string, caret: number, line: string): DayEdit {
  return placeLine(value, caret, line, false)
}

/** Puts text at the caret, with a space before it unless the caret follows a space or starts a line. */
export function insertAtCaret(value: string, caret: number, text: string): DayEdit {
  const space = caret > 0 && !/\s/.test(value[caret - 1]) ? ' ' : ''
  const insert = `${space}${text}`
  return { value: `${value.slice(0, caret)}${insert}${value.slice(caret)}`, caret: caret + insert.length }
}

/** The smallest change that turns `before` into `after`: replace `from` to `to` with `text`. */
export function changeBetween(before: string, after: string): { from: number; to: number; text: string } {
  let from = 0
  while (from < before.length && from < after.length && before[from] === after[from]) from += 1
  let tail = 0
  while (
    tail < before.length - from &&
    tail < after.length - from &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail += 1
  }
  return { from, to: before.length - tail, text: after.slice(from, after.length - tail) }
}
```

- [ ] **Step 13: Run them to see them pass**

Run: `npx vitest run src/lib/dayEdit.test.ts`
Expected: PASS, `Tests  12 passed (12)`.

- [ ] **Step 14: Write the failing tests for the clock**

Create `src/lib/clock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { describeStopTime, formatClock, formatDayTime, speakTime, typedClock } from './clock'

const NBSP = '\u00a0'

describe('formatClock', () => {
  it('writes a 12-hour time with a no-break space before AM or PM', () => {
    expect(formatClock(630, '12h')).toBe(`10:30${NBSP}AM`)
    expect(formatClock(930, '12h')).toBe(`3:30${NBSP}PM`)
    expect(formatClock(0, '12h')).toBe(`12:00${NBSP}AM`)
    expect(formatClock(720, '12h')).toBe(`12:00${NBSP}PM`)
    expect(formatClock(1312, '12h')).toBe(`9:52${NBSP}PM`)
  })

  it('writes a 24-hour time with two-digit hours', () => {
    expect(formatClock(930, '24h')).toBe('15:30')
    expect(formatClock(1312, '24h')).toBe('21:52')
    expect(formatClock(65, '24h')).toBe('01:05')
  })

  it('shows a time past midnight as the clock reads it', () => {
    expect(formatClock(1470, '12h')).toBe(`12:30${NBSP}AM`)
    expect(formatClock(1500, '24h')).toBe('01:00')
  })
})

describe('typedClock', () => {
  it('uses an ordinary space, as you would type it', () => {
    expect(typedClock(1312, '12h')).toBe('9:52 PM')
    expect(typedClock(1312, '24h')).toBe('21:52')
  })
})

describe('formatDayTime', () => {
  it('marks a rough time with "~"', () => {
    expect(formatDayTime({ minutes: 1210, approx: true }, '12h')).toBe(`~8:10${NBSP}PM`)
    expect(formatDayTime({ minutes: 1170, approx: false }, '12h')).toBe(`7:30${NBSP}PM`)
  })
})

describe('speakTime', () => {
  it('gives VoiceOver a sentence for each kind of time', () => {
    expect(speakTime({ start: { minutes: 630, approx: false }, end: null }, '12h')).toBe(`At 10:30${NBSP}AM.`)
    expect(speakTime({ start: { minutes: 1050, approx: true }, end: null }, '12h')).toBe(`About 5:30${NBSP}PM.`)
    expect(
      speakTime({ start: { minutes: 1170, approx: false }, end: { minutes: 1210, approx: true } }, '12h'),
    ).toBe(`From 7:30${NBSP}PM to about 8:10${NBSP}PM.`)
    expect(speakTime({ start: { minutes: 930, approx: false }, end: null }, '24h')).toBe('At 15:30.')
    expect(speakTime({ start: null, end: null }, '12h')).toBeNull()
  })
})

describe('describeStopTime', () => {
  it('says a stop’s time in words for an announcement', () => {
    expect(describeStopTime({ start: { minutes: 930, approx: false }, end: null }, '12h')).toBe(`3:30${NBSP}PM`)
    expect(
      describeStopTime({ start: { minutes: 1170, approx: false }, end: { minutes: 1210, approx: true } }, '12h'),
    ).toBe(`7:30${NBSP}PM to about 8:10${NBSP}PM`)
    expect(describeStopTime({ start: null, end: null }, '12h')).toBeNull()
  })
})
```

- [ ] **Step 15: Run them to see them fail**

Run: `npx vitest run src/lib/clock.test.ts`
Expected: FAIL, `Error: Cannot find module './clock'`.

- [ ] **Step 16: Write the clock**

Create `src/lib/clock.ts`:

```ts
import type { DayStop, DayTime } from './dayText'

/** How the phone shows times: "3:30 PM" or "15:30". */
export type ClockStyle = '12h' | '24h'

let phoneStyle: ClockStyle | null = null

/** The phone's clock style, read once: a 24-hour clock when its hour cycle is h23 or h24. */
export function clockStyle(): ClockStyle {
  if (phoneStyle === null) {
    const { hourCycle } = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions()
    phoneStyle = hourCycle === 'h23' || hourCycle === 'h24' ? '24h' : '12h'
  }
  return phoneStyle
}

const NO_BREAK_SPACE = '\u00a0'

/**
 * "3:30 PM" (a no-break space before AM or PM, built here so the spacing never depends on the browser) or
 * "15:30". Minutes past midnight (1,440 and up) show as the clock reads them.
 */
export function formatClock(minutes: number, style: ClockStyle): string {
  const inDay = ((minutes % 1440) + 1440) % 1440
  const hour = Math.floor(inDay / 60)
  const minute = String(inDay % 60).padStart(2, '0')
  if (style === '24h') return `${String(hour).padStart(2, '0')}:${minute}`
  return `${hour % 12 || 12}:${minute}${NO_BREAK_SPACE}${hour < 12 ? 'AM' : 'PM'}`
}

/** The time as text you'd type: an ordinary space before AM or PM ("9:52 PM"). */
export function typedClock(minutes: number, style: ClockStyle): string {
  return formatClock(minutes, style).replace(NO_BREAK_SPACE, ' ')
}

/** A time on the Meetup page: rough times get "~" ("~8:10 PM"). */
export function formatDayTime(time: DayTime, style: ClockStyle): string {
  return `${time.approx ? '~' : ''}${formatClock(time.minutes, style)}`
}

function spoken(time: DayTime, style: ClockStyle): string {
  return `${time.approx ? 'about ' : ''}${formatClock(time.minutes, style)}`
}

/** A stop's time in words, for announcements: "3:30 PM", "about 5:30 PM", "7:30 PM to about 8:10 PM". */
export function describeStopTime(stop: Pick<DayStop, 'start' | 'end'>, style: ClockStyle): string | null {
  if (!stop.start) return null
  return stop.end ? `${spoken(stop.start, style)} to ${spoken(stop.end, style)}` : spoken(stop.start, style)
}

/** The VoiceOver sentence for a stop's time: "At 10:30 AM.", "About 5:30 PM.", "From 7:30 PM to about 8:10 PM.". */
export function speakTime(stop: Pick<DayStop, 'start' | 'end'>, style: ClockStyle): string | null {
  if (!stop.start) return null
  if (stop.end) return `From ${spoken(stop.start, style)} to ${spoken(stop.end, style)}.`
  const time = formatClock(stop.start.minutes, style)
  return stop.start.approx ? `About ${time}.` : `At ${time}.`
}
```

- [ ] **Step 17: Run them to see them pass**

Run: `npx vitest run src/lib/clock.test.ts`
Expected: PASS, `Tests  7 passed (7)`.

- [ ] **Step 18: Write the failing tests for the data functions and the reading hook**

`MeetupInput` loses `note`, so the tests that logged a note through `addMeetup` or `updateMeetup` now change the date instead, and the new "the day" tests cover `updateDay`.

In `src/db/meetups.test.ts`, replace:

```ts
  photoCount,
  photoThumbs,
  restoreMeetup,
  updateMeetup,
  type MeetupInput,
  NO_PHOTO_CHANGES,
  type NewPhoto,
} from './meetups'

const base: MeetupInput = { date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], note: '', activities: [] }

beforeEach(resetDatabase)

describe('addMeetup', () => {
  it('saves a meetup with unique friends and a trimmed note', async () => {
    const meetup = await addMeetup({ ...base, friendIds: ['alex', 'sam', 'alex'], note: ' Tacos ' })
    expect(meetup.friendIds).toEqual(['alex', 'sam'])
    expect(meetup.note).toBe('Tacos')
    expect(await db.meetups.get(meetup.id)).toEqual(meetup)
  })
```

with:

```ts
  photoCount,
  photoThumbs,
  restoreMeetup,
  updateDay,
  updateMeetup,
  type DayInput,
  type MeetupInput,
  NO_PHOTO_CHANGES,
  type NewPhoto,
} from './meetups'

const base: MeetupInput = { date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], activities: [] }

beforeEach(resetDatabase)

describe('addMeetup', () => {
  it('saves a meetup with unique friends and nothing written about the day yet', async () => {
    const meetup = await addMeetup({ ...base, friendIds: ['alex', 'sam', 'alex'] })
    expect(meetup.friendIds).toEqual(['alex', 'sam'])
    expect(meetup).toMatchObject({ note: '', weather: [], mood: null, feelings: '' })
    expect(await db.meetups.get(meetup.id)).toEqual(meetup)
  })
```

Replace:

```ts
describe('updateMeetup', () => {
  it('changes the stored fields', async () => {
    const meetup = await addMeetup(base)
    await updateMeetup(meetup.id, { ...base, date: '2026-09-05', note: 'Pizza' })
    expect(await db.meetups.get(meetup.id)).toMatchObject({ date: '2026-09-05', note: 'Pizza' })
  })

  it('replaces the activities with the cleaned list', async () => {
```

with:

```ts
describe('updateMeetup', () => {
  it('changes the stored fields', async () => {
    const meetup = await addMeetup(base)
    await updateMeetup(meetup.id, { ...base, date: '2026-09-05', typeId: 'type-meal' })
    expect(await db.meetups.get(meetup.id)).toMatchObject({ date: '2026-09-05', typeId: 'type-meal' })
  })

  it('replaces the activities with the cleaned list', async () => {
```

Replace:

```ts
  })
})

describe('updateMeetup on a missing meetup', () => {
  it('rejects', async () => {
    await expect(updateMeetup('nope', base)).rejects.toThrow('This meetup no longer exists.')
```

with:

```ts
  })
})

describe('the day', () => {
  const day: DayInput = {
    note: '@Blue willow 3:30  \nJessie paid  ',
    weather: ['rainy'],
    mood: 'okay',
    feelings: 'It was an ok day.  ',
  }

  it('is left alone by an Edit meetup save, trailing spaces included', async () => {
    const meetup = await addMeetup({ ...base, activities: ['Walk'] })
    expect(await updateDay(meetup.id, day)).toBe(true)
    await updateMeetup(meetup.id, { ...base, date: '2026-09-05', activities: ['Movie'] })
    expect(await db.meetups.get(meetup.id)).toMatchObject({ ...day, date: '2026-09-05', activities: ['Movie'] })
  })

  it('saves only the fields given, and never the date, type, friends or activities', async () => {
    const meetup = await addMeetup({ ...base, activities: ['Walk'] })
    await updateDay(meetup.id, day)
    const sneaky = { mood: 'good', date: '2030-01-01', typeId: 'type-meal', friendIds: [], activities: [] }
    expect(await updateDay(meetup.id, sneaky as DayInput)).toBe(true)
    expect(await db.meetups.get(meetup.id)).toEqual({ ...meetup, ...day, mood: 'good' })
  })

  it('resolves false for a meetup that is gone, and creates nothing', async () => {
    expect(await updateDay('nope', { note: 'Tacos' })).toBe(false)
    expect(await db.meetups.count()).toBe(0)
  })

  it('refuses an unknown mood or long feelings, and writes nothing', async () => {
    const meetup = await addMeetup(base)
    await expect(updateDay(meetup.id, { note: 'New', mood: 'amazing' } as unknown as DayInput)).rejects.toThrow(
      'Please pick a mood from the list.',
    )
    await expect(updateDay(meetup.id, { note: 'New', feelings: 'x'.repeat(4_001) })).rejects.toThrow(
      'Keep how it felt under 4,000 characters.',
    )
    expect(await db.meetups.get(meetup.id)).toEqual(meetup)
    expect(await updateDay(meetup.id, { feelings: 'x'.repeat(4_000), mood: null })).toBe(true)
  })

  it('saves a day of any length', async () => {
    const meetup = await addMeetup(base)
    const long = 'Walked along the river.\n'.repeat(1_250)
    expect(long.length).toBe(30_000)
    await updateDay(meetup.id, { note: long })
    expect((await db.meetups.get(meetup.id))?.note).toBe(long)
  })

  it('normalizes line breaks and cleans the weather', async () => {
    const meetup = await addMeetup(base)
    const weather = ['windy', 'fog', 'rainy', 'rainy'] as unknown as DayInput['weather']
    await updateDay(meetup.id, { note: 'One\r\nTwo\rThree', feelings: 'Good\r\nday', weather })
    expect(await db.meetups.get(meetup.id)).toMatchObject({
      note: 'One\nTwo\nThree',
      feelings: 'Good\nday',
      weather: ['rainy', 'windy'],
    })
  })

  it('is kept by delete and Undo', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const meetup = await addMeetup({ ...base, friendIds: [alex.id] })
    await updateDay(meetup.id, day)
    const deleted = await deleteMeetup(meetup.id)
    expect(await restoreMeetup(deleted!)).toBe(true)
    expect(await db.meetups.get(meetup.id)).toEqual({ ...meetup, ...day })
  })
})

describe('updateMeetup on a missing meetup', () => {
  it('rejects', async () => {
    await expect(updateMeetup('nope', base)).rejects.toThrow('This meetup no longer exists.')
```

Replace:

```ts
    })
    await updateMeetup(
      meetup.id,
      { ...base, note: 'Pizza' },
      { add: [newPhoto('d')], removeIds: ['b'], order: ['d', 'c', 'a'] },
    )
    expect(await photoIds(meetup.id)).toEqual(['d', 'c', 'a'])
    const orders = (await db.meetupPhotos.where('meetupId').equals(meetup.id).sortBy('order')).map((p) => p.order)
    expect(orders).toEqual([0, 1, 2])
    expect(await db.meetupPhotos.get('b')).toBeUndefined()
    expect(await db.meetups.get(meetup.id)).toMatchObject({ note: 'Pizza' })
  })

  it('keeps photos left out of the order after the listed ones, and ignores other meetups photos', async () => {
```

with:

```ts
    })
    await updateMeetup(
      meetup.id,
      { ...base, date: '2026-09-05' },
      { add: [newPhoto('d')], removeIds: ['b'], order: ['d', 'c', 'a'] },
    )
    expect(await photoIds(meetup.id)).toEqual(['d', 'c', 'a'])
    const orders = (await db.meetupPhotos.where('meetupId').equals(meetup.id).sortBy('order')).map((p) => p.order)
    expect(orders).toEqual([0, 1, 2])
    expect(await db.meetupPhotos.get('b')).toBeUndefined()
    expect(await db.meetups.get(meetup.id)).toMatchObject({ date: '2026-09-05' })
  })

  it('keeps photos left out of the order after the listed ones, and ignores other meetups photos', async () => {
```

Replace:

```ts

  it('leaves the photos alone when nothing about them changes', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: [] })
    await updateMeetup(meetup.id, { ...base, note: 'Pizza' })
    expect(await photoIds(meetup.id)).toEqual(['a', 'b'])
  })
```

with:

```ts

  it('leaves the photos alone when nothing about them changes', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: [] })
    await updateMeetup(meetup.id, { ...base, date: '2026-09-05' })
    expect(await photoIds(meetup.id)).toEqual(['a', 'b'])
  })
```

Replace:

```ts
    const meetup = await addMeetup(base, { add: [newPhoto('a')], removeIds: [], order: [] })
    // Adding a photo id that is already stored fails inside the transaction.
    const sameIdAgain = { add: [newPhoto('a')], removeIds: [], order: [] }
    await expect(updateMeetup(meetup.id, { ...base, note: 'Pizza' }, sameIdAgain)).rejects.toThrow()
    expect(await db.meetups.get(meetup.id)).toMatchObject({ note: '' })
    expect(await photoIds(meetup.id)).toEqual(['a'])

    await expect(addMeetup(base, sameIdAgain)).rejects.toThrow()
```

with:

```ts
    const meetup = await addMeetup(base, { add: [newPhoto('a')], removeIds: [], order: [] })
    // Adding a photo id that is already stored fails inside the transaction.
    const sameIdAgain = { add: [newPhoto('a')], removeIds: [], order: [] }
    await expect(updateMeetup(meetup.id, { ...base, date: '2026-09-05' }, sameIdAgain)).rejects.toThrow()
    expect(await db.meetups.get(meetup.id)).toMatchObject({ date: '2026-09-01' })
    expect(await photoIds(meetup.id)).toEqual(['a'])

    await expect(addMeetup(base, sameIdAgain)).rejects.toThrow()
```

Replace:

```ts
    const twenty = Array.from({ length: 20 }, (_, i) => newPhoto(`p${i}`))
    const meetup = await addMeetup(base, { add: twenty, removeIds: [], order: [] })
    const oneMore = { add: [newPhoto('one-more')], removeIds: [], order: [] }
    await expect(updateMeetup(meetup.id, { ...base, note: 'Pizza' }, oneMore)).rejects.toThrow(
      'A meetup can have up to 20 photos.',
    )
    expect(await db.meetups.get(meetup.id)).toMatchObject({ note: '' })
    expect(await db.meetupPhotos.count()).toBe(20)

    // Removing one makes room for another in the same update.
```

with:

```ts
    const twenty = Array.from({ length: 20 }, (_, i) => newPhoto(`p${i}`))
    const meetup = await addMeetup(base, { add: twenty, removeIds: [], order: [] })
    const oneMore = { add: [newPhoto('one-more')], removeIds: [], order: [] }
    await expect(updateMeetup(meetup.id, { ...base, date: '2026-09-05' }, oneMore)).rejects.toThrow(
      'A meetup can have up to 20 photos.',
    )
    expect(await db.meetups.get(meetup.id)).toMatchObject({ date: '2026-09-01' })
    expect(await db.meetupPhotos.count()).toBe(20)

    // Removing one makes room for another in the same update.
```

The reading-hook tests write rows the way a bare version 3 database holds them, then read them back through the app and raw.

In `src/db/db.test.ts`, replace:

```ts
    const meetupIndexes = native.transaction('meetups').objectStore('meetups').indexNames
    expect([...meetupIndexes].sort()).toEqual(['date', 'friendIds', 'typeId'])
    expect(await db.meetupPhotos.count()).toBe(0)
    // The stored meetup is untouched; the reading hook gives it activities.
    expect(await db.meetups.get('m1')).toEqual({ ...v2Meetup, activities: [] })
    expect(await db.friends.get('f1')).toEqual(v2Friend)
    expect(await db.groups.get('g1')).toEqual(v2Group)
    expect(await db.meetupTypes.get('type-custom')).toEqual(v2Type)
```

with:

```ts
    const meetupIndexes = native.transaction('meetups').objectStore('meetups').indexNames
    expect([...meetupIndexes].sort()).toEqual(['date', 'friendIds', 'typeId'])
    expect(await db.meetupPhotos.count()).toBe(0)
    // The stored meetup is untouched; the reading hook gives it activities and an empty day.
    expect(await db.meetups.get('m1')).toEqual({ ...v2Meetup, activities: [], weather: [], mood: null, feelings: '' })
    expect(await db.friends.get('f1')).toEqual(v2Friend)
    expect(await db.groups.get('g1')).toEqual(v2Group)
    expect(await db.meetupTypes.get('type-custom')).toEqual(v2Type)
```

Replace:

```ts
})

describe('meetups read from the database', () => {
  it('get empty activities when the stored record has none', async () => {
    await db.meetups.put({
      id: 'old',
```

with:

```ts
})

describe('meetups read from the database', () => {
  /** Writes rows the way version 3 of the database holds them, without the reading hook or the app's types. */
  async function writeRaw(rows: Record<string, unknown>[]) {
    db.close()
    const raw = new Dexie('friend-tracker')
    raw.version(3).stores({ meetups: 'id, date, typeId, *friendIds' })
    try {
      await raw.table('meetups').bulkPut(rows)
    } finally {
      raw.close()
    }
    await db.open()
  }

  /** The stored rows as they are, read without the reading hook. */
  async function readRaw(): Promise<Record<string, unknown>[]> {
    db.close()
    const raw = new Dexie('friend-tracker')
    raw.version(3).stores({ meetups: 'id, date, typeId, *friendIds' })
    try {
      return await raw.table('meetups').orderBy('id').toArray()
    } finally {
      raw.close()
      await db.open()
    }
  }

  const stored = {
    date: '2026-09-01',
    typeId: 'type-coffee',
    friendIds: ['alex'],
    note: 'Tacos',
    activities: [],
    createdAt: '2026-09-01T12:00:00.000Z',
  }

  it('get an empty day when the stored record has none of its fields, and the rows stay untouched', async () => {
    await writeRaw([{ ...stored, id: 'a' }])
    expect(await db.meetups.get('a')).toEqual({ ...stored, id: 'a', weather: [], mood: null, feelings: '' })
    expect(await db.meetups.where('friendIds').equals('alex').first()).toMatchObject({ weather: [], mood: null })
    expect(await readRaw()).toEqual([{ ...stored, id: 'a' }])
  })

  it('read a weather or mood they do not know as none, and keep the known ones', async () => {
    const rows = [
      { ...stored, id: 'a', mood: 'amazing', weather: 'rainy', feelings: 3 },
      { ...stored, id: 'b', mood: 'okay', weather: ['rainy', 'fog', 'rainy'], feelings: 'Good' },
    ]
    await writeRaw(rows)
    expect(await db.meetups.get('a')).toMatchObject({ mood: null, weather: [], feelings: '' })
    expect(await db.meetups.get('b')).toMatchObject({ mood: 'okay', weather: ['rainy'], feelings: 'Good' })
    expect(await readRaw()).toEqual(rows)
  })

  it('get empty activities when the stored record has none', async () => {
    await db.meetups.put({
      id: 'old',
```

In `src/db/friends.test.ts`, replace:

```ts
      date: '2026-09-01',
      typeId: 'type-coffee',
      friendIds: [alex.id],
      note: '',
      activities: [],
    })
    const shared = await addMeetup({
      date: '2026-09-02',
      typeId: 'type-meal',
      friendIds: [alex.id, sam.id],
      note: '',
      activities: [],
    })
```

with:

```ts
      date: '2026-09-01',
      typeId: 'type-coffee',
      friendIds: [alex.id],
      activities: [],
    })
    const shared = await addMeetup({
      date: '2026-09-02',
      typeId: 'type-meal',
      friendIds: [alex.id, sam.id],
      activities: [],
    })
```

Replace:

```ts
      width: 4,
      height: 3,
    })
    const meetup = { date: '2026-09-01', typeId: 'type-coffee', note: '', activities: [] }
    const solo = await addMeetup(
      { ...meetup, friendIds: [alex.id] },
      { add: [photo('a'), photo('b')], removeIds: [], order: [] },
```

with:

```ts
      width: 4,
      height: 3,
    })
    const meetup = { date: '2026-09-01', typeId: 'type-coffee', activities: [] }
    const solo = await addMeetup(
      { ...meetup, friendIds: [alex.id] },
      { add: [photo('a'), photo('b')], removeIds: [], order: [] },
```

In `src/db/meetupTypes.test.ts`, replace:

```ts

describe('deleteMeetupType', () => {
  it('refuses to delete a type that is in use', async () => {
    await addMeetup({ date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], note: '', activities: [] })
    expect(await countMeetupsUsingType('type-coffee')).toBe(1)
    await expect(deleteMeetupType('type-coffee')).rejects.toThrow('This type is used by 1 meetup')
    expect(await db.meetupTypes.get('type-coffee')).toBeDefined()
```

with:

```ts

describe('deleteMeetupType', () => {
  it('refuses to delete a type that is in use', async () => {
    await addMeetup({ date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], activities: [] })
    expect(await countMeetupsUsingType('type-coffee')).toBe(1)
    await expect(deleteMeetupType('type-coffee')).rejects.toThrow('This type is used by 1 meetup')
    expect(await db.meetupTypes.get('type-coffee')).toBeDefined()
```

In `src/backup/storage.test.ts`, replace:

```ts
        date: '2026-09-01',
        typeId: 'type-meal',
        friendIds: [alex.id, sam.id],
        note: 'Tacos',
        activities: ['Karaoke', 'Walk'],
      },
      {
```

with:

```ts
        date: '2026-09-01',
        typeId: 'type-meal',
        friendIds: [alex.id, sam.id],
        activities: ['Karaoke', 'Walk'],
      },
      {
```

- [ ] **Step 19: Run them to see them fail**

Run: `npx vitest run src/db`
Expected: FAIL, `Tests  37 failed | 64 passed (101)`. Most fail with `TypeError: Cannot read properties of undefined (reading 'trim')`, since `addMeetup` still trims the note it is no longer given; the "the day" tests also need `updateDay`, and the reading-hook tests find rows without the day's fields.

- [ ] **Step 20: Fill the day's fields on every read**

In `src/db/db.ts`, replace:

```ts
import Dexie, { type EntityTable } from 'dexie'
import type { Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'
import { DEFAULT_MEETUP_TYPES } from './defaults'
```

with:

```ts
import Dexie, { type EntityTable } from 'dexie'
import { isMood } from '../lib/moods'
import { cleanWeather } from '../lib/weather'
import type { Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'
import { DEFAULT_MEETUP_TYPES } from './defaults'
```

Replace:

```ts
  return friend
})

// Meetups saved before activities existed have none.
db.meetups.hook('reading', (meetup) => {
  if (meetup) meetup.activities ??= []
  return meetup
})
```

with:

```ts
  return friend
})

// Meetups saved before activities existed have none. The day's fields came without a version bump
// (no index changed), so older meetups get empty ones here, and anything that isn't a known weather
// or mood (from older code in a second tab, or a rollback) reads as none.
db.meetups.hook('reading', (meetup) => {
  if (meetup) {
    meetup.activities ??= []
    meetup.weather = cleanWeather(meetup.weather)
    if (!isMood(meetup.mood)) meetup.mood = null
    if (typeof meetup.feelings !== 'string') meetup.feelings = ''
  }
  return meetup
})
```

- [ ] **Step 21: Add `updateDay`, and keep `updateMeetup` away from the day**

In `src/db/meetups.ts`, replace:

```ts
import { activitiesProblem } from '../lib/activities'
import { isISODate, type ISODate } from '../lib/dates'
import { newId } from '../lib/ids'
import { isValidPhotoData, MAX_PHOTOS, TOO_MANY_PHOTOS } from '../lib/photos'
import { cleanItems } from '../lib/preferences'
import type { Meetup, MeetupPhoto } from '../types'
import { db } from './db'
import { ValidationError } from './errors'
```

with:

```ts
import { activitiesProblem } from '../lib/activities'
import { isISODate, type ISODate } from '../lib/dates'
import { FEELINGS_MAX, normalizeLineBreaks, TOO_LONG_FEELINGS } from '../lib/dayText'
import { newId } from '../lib/ids'
import { INVALID_MOOD, isMood } from '../lib/moods'
import { isValidPhotoData, MAX_PHOTOS, TOO_MANY_PHOTOS } from '../lib/photos'
import { cleanItems } from '../lib/preferences'
import { cleanWeather } from '../lib/weather'
import type { Meetup, MeetupPhoto } from '../types'
import { db } from './db'
import { ValidationError } from './errors'
```

Replace:

```ts
  date: ISODate
  typeId: string
  friendIds: string[]
  note: string
  /** In the order picked. Cleaned like likes: empties and repeats are dropped. */
  activities: string[]
}

/** A photo the meetup sheet has resized and is adding. Its id is chosen up front, so `order` can place it. */
export type NewPhoto = Pick<MeetupPhoto, 'id' | 'full' | 'thumb' | 'width' | 'height'>
```

with:

```ts
  date: ISODate
  typeId: string
  friendIds: string[]
  /** In the order picked. Cleaned like likes: empties and repeats are dropped. */
  activities: string[]
}

/** The day page's fields. Only the fields given are written. */
export type DayInput = Partial<Pick<Meetup, 'note' | 'weather' | 'mood' | 'feelings'>>

/** A photo the meetup sheet has resized and is adding. Its id is chosen up front, so `order` can place it. */
export type NewPhoto = Pick<MeetupPhoto, 'id' | 'full' | 'thumb' | 'width' | 'height'>
```

Replace:

```ts
  const activities = cleanItems(input.activities)
  const problem = activitiesProblem(activities)
  if (problem) throw new ValidationError(problem)
  return { date: input.date, typeId: input.typeId, friendIds, note: input.note.trim(), activities }
}

function checkPhotos(changes: PhotoChanges) {
```

with:

```ts
  const activities = cleanItems(input.activities)
  const problem = activitiesProblem(activities)
  if (problem) throw new ValidationError(problem)
  return { date: input.date, typeId: input.typeId, friendIds, activities }
}

/**
 * The day's fields as they are kept: line breaks normalized and weather cleaned, with your words otherwise
 * exactly as typed. An unknown mood or feelings over 4,000 characters are refused (only code can reach either).
 */
function cleanDay(input: DayInput): DayInput {
  const day: DayInput = {}
  if (input.note !== undefined) day.note = normalizeLineBreaks(input.note)
  if (input.weather !== undefined) day.weather = cleanWeather(input.weather)
  if (input.mood !== undefined) {
    if (input.mood !== null && !isMood(input.mood)) throw new ValidationError(INVALID_MOOD)
    day.mood = input.mood
  }
  if (input.feelings !== undefined) {
    const feelings = normalizeLineBreaks(input.feelings)
    if (feelings.length > FEELINGS_MAX) throw new ValidationError(TOO_LONG_FEELINGS)
    day.feelings = feelings
  }
  return day
}

function checkPhotos(changes: PhotoChanges) {
```

Replace:

```ts
}

export async function addMeetup(input: MeetupInput, photos: PhotoChanges = NO_PHOTO_CHANGES): Promise<Meetup> {
  const meetup: Meetup = { id: newId(), ...clean(input), createdAt: new Date().toISOString() }
  checkPhotos(photos)
  await db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
    await db.meetups.add(meetup)
```

with:

```ts
}

export async function addMeetup(input: MeetupInput, photos: PhotoChanges = NO_PHOTO_CHANGES): Promise<Meetup> {
  const meetup: Meetup = {
    id: newId(),
    ...clean(input),
    note: '',
    weather: [],
    mood: null,
    feelings: '',
    createdAt: new Date().toISOString(),
  }
  checkPhotos(photos)
  await db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
    await db.meetups.add(meetup)
```

Replace:

```ts
  return meetup
}

export async function updateMeetup(id: string, input: MeetupInput, photos: PhotoChanges = NO_PHOTO_CHANGES): Promise<void> {
  const { date, typeId, friendIds, note, activities } = clean(input)
  checkPhotos(photos)
  await db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
    if (!(await db.meetups.get(id))) throw new ValidationError('This meetup no longer exists.')
    await db.meetups.update(id, { date, typeId, friendIds, note, activities })
    await applyPhotoChanges(id, photos, new Date().toISOString())
  })
}

/** Deletes a meetup and its photos, and returns them so `restoreMeetup` can put them back (Undo). */
export async function deleteMeetup(id: string): Promise<DeletedMeetup | undefined> {
  return db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
```

with:

```ts
  return meetup
}

/**
 * Saves the sheet's fields and photo changes. It never reads or writes the day's fields, so an Edit
 * meetup save can't overwrite a day being written on the day page.
 */
export async function updateMeetup(id: string, input: MeetupInput, photos: PhotoChanges = NO_PHOTO_CHANGES): Promise<void> {
  const { date, typeId, friendIds, activities } = clean(input)
  checkPhotos(photos)
  await db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
    if (!(await db.meetups.get(id))) throw new ValidationError('This meetup no longer exists.')
    await db.meetups.update(id, { date, typeId, friendIds, activities })
    await applyPhotoChanges(id, photos, new Date().toISOString())
  })
}

/**
 * Saves the day page's fields: only the fields given, and never the date, type, friends or activities.
 * Resolves false, and never throws for this, when the meetup is gone (a partial update, never a put, so a
 * deleted meetup can't come back).
 */
export async function updateDay(id: string, input: DayInput): Promise<boolean> {
  const fields = cleanDay(input)
  return db.transaction('rw', db.meetups, async () => {
    if (!(await db.meetups.get(id))) return false
    await db.meetups.update(id, fields)
    return true
  })
}

/** Deletes a meetup and its photos, and returns them so `restoreMeetup` can put them back (Undo). */
export async function deleteMeetup(id: string): Promise<DeletedMeetup | undefined> {
  return db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
```

- [ ] **Step 22: Read backups with an empty day for now (Task 2 reads version 5)**

In `src/backup/format.ts`, replace:

```ts
      note: text(r, 'note', where),
      // Versions 1 to 3 were made before activities existed.
      activities: version === 4 ? activityList(r, where) : [],
      createdAt: text(r, 'createdAt', where),
    }
  })
```

with:

```ts
      note: text(r, 'note', where),
      // Versions 1 to 3 were made before activities existed.
      activities: version === 4 ? activityList(r, where) : [],
      weather: [],
      mood: null,
      feelings: '',
      createdAt: text(r, 'createdAt', where),
    }
  })
```

- [ ] **Step 23: Keep the sheet's Note working through `updateDay` until Task 5 takes it out**

In `src/sheets/MeetupSheet.tsx`, replace:

```tsx
  deleteMeetup,
  NO_PHOTO_CHANGES,
  restoreMeetup,
  updateMeetup,
  type PhotoChanges,
} from '../db/meetups'
```

with:

```tsx
  deleteMeetup,
  NO_PHOTO_CHANGES,
  restoreMeetup,
  updateDay,
  updateMeetup,
  type PhotoChanges,
} from '../db/meetups'
```

Replace:

```tsx
    try {
      // An activity typed into "+ New" but not added yet is saved too.
      const typed = activityDraft?.trim() ? [...activities, activityDraft] : activities
      const input = { date, typeId: effectiveTypeId, friendIds, note, activities: typed }
      const unchanged =
        !photos ||
        (photos.every((photo) => !photo.added) &&
```

with:

```tsx
    try {
      // An activity typed into "+ New" but not added yet is saved too.
      const typed = activityDraft?.trim() ? [...activities, activityDraft] : activities
      const input = { date, typeId: effectiveTypeId, friendIds, activities: typed }
      const unchanged =
        !photos ||
        (photos.every((photo) => !photo.added) &&
```

Replace:

```tsx
        : NO_PHOTO_CHANGES
      if (editing) {
        await updateMeetup(editing.id, input, photoChanges)
        toast({ message: 'Saved' })
      } else {
        const meetup = await addMeetup(input, photoChanges)
        toast({
          message: `Logged with ${formatNameList(selected.map((f) => f.name))}`,
          actionLabel: 'Undo',
```

with:

```tsx
        : NO_PHOTO_CHANGES
      if (editing) {
        await updateMeetup(editing.id, input, photoChanges)
        // The one-line Note is the start of the day, saved with the day's fields.
        if (note.trim() !== editing.note) await updateDay(editing.id, { note: note.trim() })
        toast({ message: 'Saved' })
      } else {
        const meetup = await addMeetup(input, photoChanges)
        if (note.trim()) await updateDay(meetup.id, { note: note.trim() })
        toast({
          message: `Logged with ${formatNameList(selected.map((f) => f.name))}`,
          actionLabel: 'Undo',
```

- [ ] **Step 24: Run everything**

Run: `npm test`
Expected: `Test Files  54 passed (54)` and `Tests  642 passed (642)`.

Run: `npm run build`
Expected: `tsc -b` passes (it also type-checks `db.ts`, `weather.ts` and `moods.ts` for the service worker) and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `124 passed`.

- [ ] **Step 25: Commit**

```bash
git add src/types.ts src/test/dayFixtures.ts src/test/fixtures.ts src/lib/weather.ts src/lib/weather.test.ts src/lib/moods.ts src/lib/moods.test.ts src/lib/dayText.ts src/lib/dayText.test.ts src/lib/dayEdit.ts src/lib/dayEdit.test.ts src/lib/clock.ts src/lib/clock.test.ts src/db/db.ts src/db/db.test.ts src/db/meetups.ts src/db/meetups.test.ts src/db/friends.test.ts src/db/meetupTypes.test.ts src/backup/format.ts src/backup/storage.test.ts src/sheets/MeetupSheet.tsx
git commit -F - <<'EOF'
feat: the day's data: weather, moods, the frozen day grammar, helper edits and updateDay

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Backups at version 5, with the `>= 4` fix

**Files:**
- Modify: `src/backup/format.ts`
- Test: `src/backup/format.test.ts`, `src/backup/storage.test.ts`, and the version checks in `e2e/birthdays.spec.ts`, `e2e/memories.spec.ts`, `e2e/preferences.spec.ts`

- [ ] **Step 1: Write the failing tests**

The test that refused version 5 now refuses version 6. Version 4 files keep their activities, photos and note and get an empty day; version 5 is strict about the day's fields.

In `src/backup/format.test.ts`, replace:

```ts
import { describe, expect, it } from 'vitest'
import { MAX_FULL_LENGTH, MAX_THUMB_LENGTH } from '../lib/photos'
import { friend, group, meetup, meetupPhoto, meetupType } from '../test/fixtures'
import { backupFileName, createBackup, parseBackup, type BackupData } from './format'

const sample: BackupData = {
```

with:

```ts
import { describe, expect, it } from 'vitest'
import { MAX_FULL_LENGTH, MAX_THUMB_LENGTH } from '../lib/photos'
import { OWNER_DAY_TYPED, OWNER_FEELINGS } from '../test/dayFixtures'
import { friend, group, meetup, meetupPhoto, meetupType } from '../test/fixtures'
import type { Meetup } from '../types'
import { backupFileName, createBackup, parseBackup, type BackupData } from './format'

const sample: BackupData = {
```

Replace:

```ts
describe('createBackup and parseBackup', () => {
  it('accepts a backup it created', () => {
    const file = createBackup(sample, new Date('2026-10-02T09:00:00Z'))
    expect(file).toMatchObject({ app: 'friend-tracker', version: 4, exportedAt: '2026-10-02T09:00:00.000Z' })
    expect(parseBackup(jsonCopy(file))).toEqual({ ok: true, data: sample })
  })
```

with:

```ts
describe('createBackup and parseBackup', () => {
  it('accepts a backup it created', () => {
    const file = createBackup(sample, new Date('2026-10-02T09:00:00Z'))
    expect(file).toMatchObject({ app: 'friend-tracker', version: 5, exportedAt: '2026-10-02T09:00:00.000Z' })
    expect(parseBackup(jsonCopy(file))).toEqual({ ok: true, data: sample })
  })
```

Replace:

```ts
      ])
      expect(result.data.friends[1]).toMatchObject({ name: 'Sam', notes: 'Likes jazz' })
      expect(result.data.meetups.map((m) => m.activities)).toEqual([[], []])
      expect(result.data.meetupPhotos).toEqual([])
    }
  })
```

with:

```ts
      ])
      expect(result.data.friends[1]).toMatchObject({ name: 'Sam', notes: 'Likes jazz' })
      expect(result.data.meetups.map((m) => m.activities)).toEqual([[], []])
      expect(result.data.meetups.map((m) => [m.weather, m.mood, m.feelings])).toEqual([
        [[], null, ''],
        [[], null, ''],
      ])
      expect(result.data.meetupPhotos).toEqual([])
    }
  })
```

Replace:

```ts
      expect(result.data.friends.map((f) => f.birthday)).toEqual([null, null])
      expect(result.data.friends[1]).toMatchObject({ likes: ['Jazz', 'Board games'], dislikes: ['Early mornings'] })
      expect(result.data.meetups.map((m) => m.activities)).toEqual([[], []])
      expect(result.data.meetupPhotos).toEqual([])
    }
  })
```

with:

```ts
      expect(result.data.friends.map((f) => f.birthday)).toEqual([null, null])
      expect(result.data.friends[1]).toMatchObject({ likes: ['Jazz', 'Board games'], dislikes: ['Early mornings'] })
      expect(result.data.meetups.map((m) => m.activities)).toEqual([[], []])
      expect(result.data.meetups.map((m) => [m.weather, m.mood, m.feelings])).toEqual([
        [[], null, ''],
        [[], null, ''],
      ])
      expect(result.data.meetupPhotos).toEqual([])
    }
  })
```

Replace:

```ts
    if (result.ok) {
      expect(result.data.friends[1].birthday).toEqual({ month: 3, day: 14, year: 1996 })
      expect(result.data.meetups.map((m) => m.activities)).toEqual([[], []])
      expect(result.data.meetupPhotos).toEqual([])
    }
    const withoutLists = broken((f) => {
```

with:

```ts
    if (result.ok) {
      expect(result.data.friends[1].birthday).toEqual({ month: 3, day: 14, year: 1996 })
      expect(result.data.meetups.map((m) => m.activities)).toEqual([[], []])
      expect(result.data.meetups.map((m) => [m.weather, m.mood, m.feelings])).toEqual([
        [[], null, ''],
        [[], null, ''],
      ])
      expect(result.data.meetupPhotos).toEqual([])
    }
    const withoutLists = broken((f) => {
```

Replace:

```ts
  })
})

describe('parseBackup rejects bad files', () => {
  it('rejects things that are not backups', () => {
    expectError('hello', "This isn't a Friend Tracker backup file.")
```

with:

```ts
  })
})

describe('parseBackup reads version 4 backups', () => {
  it('keeps activities, photos and the note byte for byte, and gives every meetup an empty day', () => {
    // Version 4 had no weather, mood or feelings, so any in a version 4 file are ignored.
    const note = 'Tacos\r\nThen karaoke  '
    const file = broken((f) => {
      f.version = 4
      list(f, 'meetups')[0].note = note
      list(f, 'meetups')[0].mood = 'okay'
      delete list(f, 'meetups')[1].weather
      delete list(f, 'meetups')[1].mood
      delete list(f, 'meetups')[1].feelings
    })
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.meetups[0]).toMatchObject({
        note,
        activities: ['Karaoke', 'Board games'],
        weather: [],
        mood: null,
        feelings: '',
      })
      expect(result.data.meetups[1]).toMatchObject({ weather: [], mood: null, feelings: '' })
      expect(result.data.meetupPhotos).toEqual(sample.meetupPhotos)
    }
  })
})

describe('parseBackup reads version 5 backups', () => {
  const ownersDay: Meetup = {
    ...meetup('m3', '2026-10-03', ['f1', 'f2'], 't1'),
    note: OWNER_DAY_TYPED,
    activities: ['Movie', 'Shopping'],
    weather: ['rainy'],
    mood: 'okay',
    feelings: OWNER_FEELINGS,
  }
  const withDay: BackupData = {
    ...sample,
    meetups: [...sample.meetups, ownersDay],
    meetupPhotos: [...sample.meetupPhotos, meetupPhoto('p3', 'm3', 0)],
  }

  it('keeps the owner’s day, its weather, mood and feelings, and every activity and photo', () => {
    const file = jsonCopy(createBackup(withDay, new Date('2026-10-04T05:00:00Z')))
    expect(file.version).toBe(5)
    const result = parseBackup(file)
    expect(result).toEqual({ ok: true, data: withDay })
    if (result.ok) {
      expect(result.data.meetups[2].note).toBe(OWNER_DAY_TYPED)
      expect(result.data.meetups[2].activities).toEqual(['Movie', 'Shopping'])
      expect(result.data.meetups[1].mood).toBeNull()
      expect(result.data.meetupPhotos.map((photo) => photo.id)).toEqual(['p1', 'p2', 'p3'])
    }
  })

  it('drops repeated weather quietly and puts it in chip order', () => {
    const file = broken((f) => (list(f, 'meetups')[0].weather = ['windy', 'rainy', 'windy']))
    const result = parseBackup(file)
    expect(result.ok && result.data.meetups[0].weather).toEqual(['rainy', 'windy'])
  })

  it('keeps a note of any length exactly', () => {
    const note = 'Walked.\r\n'.repeat(5_000)
    const result = parseBackup(broken((f) => (list(f, 'meetups')[0].note = note)))
    expect(result.ok && result.data.meetups[0].note).toBe(note)
  })
})

describe('parseBackup rejects bad files', () => {
  it('rejects things that are not backups', () => {
    expectError('hello', "This isn't a Friend Tracker backup file.")
```

Replace:

```ts
  })

  it('rejects other versions', () => {
    expectError(broken((f) => (f.version = 5)), 'This backup was made by a different version of Friend Tracker.')
    expectError(broken((f) => (f.version = '4')), 'This backup was made by a different version of Friend Tracker.')
  })

  it('rejects a missing or invalid activities list', () => {
```

with:

```ts
  })

  it('rejects other versions', () => {
    expectError(broken((f) => (f.version = 6)), 'This backup was made by a different version of Friend Tracker.')
    expectError(broken((f) => (f.version = '5')), 'This backup was made by a different version of Friend Tracker.')
    expectError(broken((f) => (f.version = 0)), 'This backup was made by a different version of Friend Tracker.')
  })

  it('rejects a missing or invalid activities list', () => {
```

Replace:

```ts
    )
  })

  it('rejects an invalid photo', () => {
    const jpeg = 'data:image/jpeg;base64,'
    const changes: ((photo: Record<string, unknown>) => void)[] = [
```

with:

```ts
    )
  })

  it('rejects a version 5 meetup with an invalid weather list, mood or feelings', () => {
    const meetupTwo = (change: (meetup: Record<string, unknown>) => void) => broken((f) => change(list(f, 'meetups')[1]))
    for (const weather of ['rainy', ['fog'], ['rainy', 3], null]) {
      expectError(meetupTwo((m) => (m.weather = weather)), 'Meetup 2 has an invalid "weather" list.')
    }
    expectError(meetupTwo((m) => delete m.weather), 'Meetup 2 has an invalid "weather" list.')
    for (const mood of ['Good', 'amazing', 3, '']) {
      expectError(meetupTwo((m) => (m.mood = mood)), 'Meetup 2 has an invalid "mood".')
    }
    expectError(meetupTwo((m) => delete m.mood), 'Meetup 2 has an invalid "mood".')
    for (const feelings of ['x'.repeat(4_001), 3, null]) {
      expectError(meetupTwo((m) => (m.feelings = feelings)), 'Meetup 2 has a missing or invalid "feelings".')
    }
    expectError(meetupTwo((m) => delete m.feelings), 'Meetup 2 has a missing or invalid "feelings".')
    expect(parseBackup(meetupTwo((m) => (m.feelings = 'x'.repeat(4_000)))).ok).toBe(true)
  })

  it('rejects an invalid photo', () => {
    const jpeg = 'data:image/jpeg;base64,'
    const changes: ((photo: Record<string, unknown>) => void)[] = [
```

In `src/backup/storage.test.ts`, replace:

```ts
import { addPreferences } from '../db/preferences'
import type { AppLock, LockFailures } from '../lock/types'
import type { BirthdayReminders } from '../reminders/types'
import { friend, meetup, meetupPhoto, meetupType } from '../test/fixtures'
import { createBackup, type BackupData } from './format'
import { parseBackupFile, readAllData, readAllPhotos, replaceAllData } from './storage'
```

with:

```ts
import { addPreferences } from '../db/preferences'
import type { AppLock, LockFailures } from '../lock/types'
import type { BirthdayReminders } from '../reminders/types'
import { OWNER_DAY_TYPED, OWNER_FEELINGS } from '../test/dayFixtures'
import { friend, meetup, meetupPhoto, meetupType } from '../test/fixtures'
import { createBackup, type BackupData } from './format'
import { parseBackupFile, readAllData, readAllPhotos, replaceAllData } from './storage'
```

Replace:

```ts
    expect((await readAllPhotos()).map((photo) => photo.id).sort()).toEqual(['p1', 'p2'])
  })

  it('leaves existing data untouched if writing fails', async () => {
    const alex = await addFriend({ name: 'Alex', groupId: null, photo: null, notes: '', birthday: null })
    await db.meetupPhotos.add(meetupPhoto('p1', 'm1', 0))
```

with:

```ts
    expect((await readAllPhotos()).map((photo) => photo.id).sort()).toEqual(['p1', 'p2'])
  })

  it('keeps the day’s note, weather, mood and feelings through replace and read', async () => {
    const data: BackupData = {
      friends: [friend('f1', 'Alex')],
      groups: [],
      meetupTypes: [meetupType('t1', 'Coffee', 0)],
      meetups: [
        {
          ...meetup('m1', '2026-10-03', ['f1'], 't1'),
          note: OWNER_DAY_TYPED,
          weather: ['rainy', 'windy'],
          mood: 'okay',
          feelings: OWNER_FEELINGS,
        },
        meetup('m2', '2026-10-04', ['f1'], 't1'),
      ],
      meetupPhotos: [],
    }
    await replaceAllData(data)
    expect(sortById(await readAllData())).toEqual(sortById(data))
  })

  it('leaves existing data untouched if writing fails', async () => {
    const alex = await addFriend({ name: 'Alex', groupId: null, photo: null, notes: '', birthday: null })
    await db.meetupPhotos.add(meetupPhoto('p1', 'm1', 0))
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/backup`
Expected: FAIL. The created file is still version 4, version 5 files are refused, and a version 5 round trip drops the owner's weather, mood and feelings.

- [ ] **Step 3: Read and write version 5**

Activities and photos test `version >= 4` now, or a version 5 file would silently lose every activity and photo.

In `src/backup/format.ts`, replace:

```ts
import { activitiesProblem } from '../lib/activities'
import { isValidBirthday } from '../lib/birthdays'
import { addDays, isISODate, todayISO, type ISODate } from '../lib/dates'
import { isPhotoDataUrl, isPixelSize, MAX_FULL_LENGTH, MAX_PHOTOS, MAX_THUMB_LENGTH } from '../lib/photos'
import { cleanItems, indexOfItem, MAX_ITEM_LENGTH, MAX_ITEMS, type PreferenceKind } from '../lib/preferences'
import type { Birthday, Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'

export interface BackupData {
  friends: Friend[]
```

with:

```ts
import { activitiesProblem } from '../lib/activities'
import { isValidBirthday } from '../lib/birthdays'
import { addDays, isISODate, todayISO, type ISODate } from '../lib/dates'
import { FEELINGS_MAX } from '../lib/dayText'
import { isMood } from '../lib/moods'
import { isPhotoDataUrl, isPixelSize, MAX_FULL_LENGTH, MAX_PHOTOS, MAX_THUMB_LENGTH } from '../lib/photos'
import { cleanItems, indexOfItem, MAX_ITEM_LENGTH, MAX_ITEMS, type PreferenceKind } from '../lib/preferences'
import { cleanWeather, isWeather } from '../lib/weather'
import type { Birthday, Friend, Group, Meetup, MeetupPhoto, MeetupType, Mood, Weather } from '../types'

export interface BackupData {
  friends: Friend[]
```

Replace:

```ts

export interface BackupFile extends BackupData {
  app: 'friend-tracker'
  version: 4
  exportedAt: string
}

export type ParseResult = { ok: true; data: BackupData } | { ok: false; error: string }

export function createBackup(data: BackupData, exportedAt: Date): BackupFile {
  return { app: 'friend-tracker', version: 4, exportedAt: exportedAt.toISOString(), ...data }
}

export function backupFileName(today: ISODate): string {
```

with:

```ts

export interface BackupFile extends BackupData {
  app: 'friend-tracker'
  version: 5
  exportedAt: string
}

export type ParseResult = { ok: true; data: BackupData } | { ok: false; error: string }

export function createBackup(data: BackupData, exportedAt: Date): BackupFile {
  return { app: 'friend-tracker', version: 5, exportedAt: exportedAt.toISOString(), ...data }
}

export function backupFileName(today: ISODate): string {
```

Replace:

```ts
  return activities
}

/** A version 4 photo (copied, so stray fields are dropped). Whatever is wrong with it, the message is the same. */
function photoOf(value: unknown, where: string): MeetupPhoto {
  const invalid = () => new BackupError(`${where} is invalid.`)
```

with:

```ts
  return activities
}

/** A version 5 meetup's weather: a list of known keys. Repeats are dropped quietly and the rest put in chip order. */
function weatherList(record: Obj, where: string): Weather[] {
  const value = record.weather
  if (!Array.isArray(value) || !value.every(isWeather)) throw new BackupError(`${where} has an invalid "weather" list.`)
  return cleanWeather(value)
}

/** A version 5 meetup's mood: null or a known key. A missing one is refused too. */
function moodOf(record: Obj, where: string): Mood | null {
  const value = record.mood
  if (value === null) return null
  if (!isMood(value)) throw new BackupError(`${where} has an invalid "mood".`)
  return value
}

/** A version 5 meetup's feelings: words of at most 4,000 characters, kept exactly. */
function feelingsOf(record: Obj, where: string): string {
  const feelings = text(record, 'feelings', where)
  if (feelings.length > FEELINGS_MAX) throw new BackupError(`${where} has a missing or invalid "feelings".`)
  return feelings
}

/** A version 4 photo (copied, so stray fields are dropped). Whatever is wrong with it, the message is the same. */
function photoOf(value: unknown, where: string): MeetupPhoto {
  const invalid = () => new BackupError(`${where} is invalid.`)
```

Replace:

```ts
function readBackup(raw: unknown, today: ISODate): BackupData {
  if (!isObj(raw) || raw.app !== 'friend-tracker') throw new BackupError("This isn't a Friend Tracker backup file.")
  const { version } = raw
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4) {
    throw new BackupError('This backup was made by a different version of Friend Tracker.')
  }
```

with:

```ts
function readBackup(raw: unknown, today: ISODate): BackupData {
  if (!isObj(raw) || raw.app !== 'friend-tracker') throw new BackupError("This isn't a Friend Tracker backup file.")
  const { version } = raw
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5) {
    throw new BackupError('This backup was made by a different version of Friend Tracker.')
  }
```

Replace:

```ts
      friendIds: [...new Set(friendIds as string[])],
      note: text(r, 'note', where),
      // Versions 1 to 3 were made before activities existed.
      activities: version === 4 ? activityList(r, where) : [],
      weather: [],
      mood: null,
      feelings: '',
      createdAt: text(r, 'createdAt', where),
    }
  })

  // Versions 1 to 3 were made before photos existed.
  const meetupPhotos: MeetupPhoto[] =
    version === 4 ? list(raw, 'meetupPhotos').map((value, i) => photoOf(value, `Photo ${i + 1}`)) : []

  assertUnique(groups.map((g) => g.id), 'groups')
  assertUnique(meetupTypes.map((t) => t.id), 'meetup types')
```

with:

```ts
      friendIds: [...new Set(friendIds as string[])],
      note: text(r, 'note', where),
      // Versions 1 to 3 were made before activities existed.
      activities: version >= 4 ? activityList(r, where) : [],
      // Versions 1 to 4 were made before the day's weather, mood and feelings existed.
      weather: version >= 5 ? weatherList(r, where) : [],
      mood: version >= 5 ? moodOf(r, where) : null,
      feelings: version >= 5 ? feelingsOf(r, where) : '',
      createdAt: text(r, 'createdAt', where),
    }
  })

  // Versions 1 to 3 were made before photos existed.
  const meetupPhotos: MeetupPhoto[] =
    version >= 4 ? list(raw, 'meetupPhotos').map((value, i) => photoOf(value, `Photo ${i + 1}`)) : []

  assertUnique(groups.map((g) => g.id), 'groups')
  assertUnique(meetupTypes.map((t) => t.id), 'meetup types')
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/backup`
Expected: PASS, `Test Files  3 passed (3)` and `Tests  50 passed (50)`.

- [ ] **Step 5: Expect version 5 in the exported files**

In `e2e/birthdays.spec.ts`, replace:

```ts
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.version).toBe(4)
  expect(backup.friends[0]).toMatchObject({ name: 'Alex', birthday: { month: 3, day: 14, year: 1996 } })

  await goToTab(page, 'Friends')
```

with:

```ts
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.version).toBe(5)
  expect(backup.friends[0]).toMatchObject({ name: 'Alex', birthday: { month: 3, day: 14, year: 1996 } })

  await goToTab(page, 'Friends')
```

In `e2e/memories.spec.ts`, replace:

```ts
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.version).toBe(4)
  expect(backup.meetups[0].activities).toEqual(['Karaoke'])
  expect(backup.meetupPhotos).toHaveLength(2)
```

with:

```ts
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.version).toBe(5)
  expect(backup.meetups[0].activities).toEqual(['Karaoke'])
  expect(backup.meetupPhotos).toHaveLength(2)
```

In `e2e/preferences.spec.ts`, replace:

```ts
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.version).toBe(4)
  expect(backup.friends[0]).toMatchObject({ name: 'Alex', likes: ['Sushi'], dislikes: ['Cilantro'] })

  await goToTab(page, 'Friends')
```

with:

```ts
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.version).toBe(5)
  expect(backup.friends[0]).toMatchObject({ name: 'Alex', likes: ['Sushi'], dislikes: ['Cilantro'] })

  await goToTab(page, 'Friends')
```

- [ ] **Step 6: Run everything**

Run: `npm test`
Expected: `Test Files  54 passed (54)` and `Tests  648 passed (648)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `124 passed`, including "keeps photos and activities through a backup" in `e2e/memories.spec.ts`, now through a version 5 file.

- [ ] **Step 7: Commit**

```bash
git add src/backup/format.ts src/backup/format.test.ts src/backup/storage.test.ts e2e/birthdays.spec.ts e2e/memories.spec.ts e2e/preferences.spec.ts
git commit -F - <<'EOF'
feat: backups at version 5 with the day's weather, mood and feelings

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Shared hooks: a counted keyboard inset, the caret mirror, and a caret-following reveal

**Files:**
- Create: `src/hooks/useKeyboardInset.test.ts`, `src/lib/caret.ts`
- Modify: `src/hooks/useKeyboardInset.ts`, `src/hooks/useRevealFocusedField.ts`
- Test: `src/lib/viewport.test.ts`

- [ ] **Step 1: Write the failing tests**

The tests stub `window` and `document` with a fake visual viewport and a fake `<html>` (the project has no DOM library), then use two users the way the closing Log sheet and the day page will.

Create `src/hooks/useKeyboardInset.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startKeyboardInset } from './useKeyboardInset'

/**
 * A page with a fake visual viewport, like an iPhone's: the layout viewport (innerHeight) keeps its size and
 * only the visual viewport shrinks for the keyboard. <html> keeps its custom properties and classes in a Map
 * and a Set, so the test can read them.
 */
function fakePage() {
  const viewport = Object.assign(new EventTarget(), { height: 664, offsetTop: 0, scale: 1 })
  const properties = new Map<string, string>()
  const classes = new Set<string>()
  const documentElement = {
    style: {
      setProperty: (name: string, value: string) => properties.set(name, value),
      removeProperty: (name: string) => properties.delete(name),
    },
    classList: {
      toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
      remove: (name: string) => classes.delete(name),
    },
  }
  vi.stubGlobal('window', { innerHeight: 664, visualViewport: viewport })
  vi.stubGlobal('document', { documentElement })
  return {
    properties,
    classes,
    /** Slides the keyboard to `height` px tall (0 to close it). */
    keyboard(height: number) {
      viewport.height = 664 - height
      viewport.dispatchEvent(new Event('resize'))
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('startKeyboardInset', () => {
  it('publishes the keyboard while it has a user', () => {
    const page = fakePage()
    const stop = startKeyboardInset()
    expect(page.properties.get('--keyboard-inset')).toBe('0px')
    page.keyboard(340)
    expect(page.properties.get('--keyboard-inset')).toBe('340px')
    expect(page.properties.get('--viewport-height')).toBe('324px')
    expect(page.classes.has('keyboard-open')).toBe(true)
    stop()
    expect(page.properties.get('--keyboard-inset')).toBe('0px')
    expect(page.properties.has('--viewport-height')).toBe(false)
    expect(page.classes.has('keyboard-open')).toBe(false)
  })

  it('keeps publishing until the last of two users stops', () => {
    const page = fakePage()
    const stopSheet = startKeyboardInset()
    const stopDayPage = startKeyboardInset()
    page.keyboard(340)

    // The Log sheet finishes closing while the day page has the keyboard up.
    stopSheet()
    expect(page.properties.get('--keyboard-inset')).toBe('340px')
    expect(page.properties.get('--viewport-height')).toBe('324px')
    expect(page.classes.has('keyboard-open')).toBe(true)
    page.keyboard(300)
    expect(page.properties.get('--keyboard-inset')).toBe('300px')

    stopDayPage()
    expect(page.properties.get('--keyboard-inset')).toBe('0px')
    expect(page.properties.has('--viewport-height')).toBe(false)
    expect(page.classes.has('keyboard-open')).toBe(false)
  })

  it('counts a user once, however many times it stops', () => {
    const page = fakePage()
    const stopSheet = startKeyboardInset()
    const stopDayPage = startKeyboardInset()
    page.keyboard(340)
    stopSheet()
    stopSheet()
    expect(page.classes.has('keyboard-open')).toBe(true)
    stopDayPage()
    expect(page.classes.has('keyboard-open')).toBe(false)
  })

  it('stops listening once nobody uses it', () => {
    const page = fakePage()
    startKeyboardInset()()
    page.keyboard(340)
    expect(page.properties.get('--keyboard-inset')).toBe('0px')
    expect(page.classes.has('keyboard-open')).toBe(false)
  })

  it('does nothing without a visual viewport', () => {
    vi.stubGlobal('window', { innerHeight: 664, visualViewport: null })
    vi.stubGlobal('document', { documentElement: {} })
    const stop = startKeyboardInset()
    expect(() => stop()).not.toThrow()
  })
})
```

In `src/lib/viewport.test.ts`, replace:

```ts
    expect(revealOffset(port, { top: 50, bottom: 350 }, 12)).toBe(0)
    expect(revealOffset(port, { top: 50, bottom: 350 }, 12, 'end')).toBe(50)
  })
})

describe('revealMargin', () => {
```

with:

```ts
    expect(revealOffset(port, { top: 50, bottom: 350 }, 12)).toBe(0)
    expect(revealOffset(port, { top: 50, bottom: 350 }, 12, 'end')).toBe(50)
  })

  it('shows the caret’s line inside a box taller than the view, with the margin around the line', () => {
    // A 60-line day box runs from 40 to 1480; its caret is on the line from 400 to 424, under the view.
    const line = { top: 400, bottom: 424 }
    expect(revealOffset(port, line, 12)).toBe(136)
    // Above the view: the line comes down to the margin under the top.
    expect(revealOffset(port, { top: 40, bottom: 64 }, 12)).toBe(-72)
    // Already in view with room to spare: nothing to do.
    expect(revealOffset(port, { top: 150, bottom: 174 }, 0)).toBe(0)
  })
})

describe('revealMargin', () => {
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/hooks/useKeyboardInset.test.ts src/lib/viewport.test.ts`
Expected: FAIL, the five `startKeyboardInset` tests with `TypeError: startKeyboardInset is not a function`. The new `revealOffset` test already passes: the caret's line is just a span `revealOffset` can show.

- [ ] **Step 3: Count the keyboard's users**

Replace the whole of `src/hooks/useKeyboardInset.ts`:

```ts
import { useEffect } from 'react'
import { keyboardInset, keyboardIsUp } from '../lib/viewport'

/** How many sheets and pages are publishing the keyboard right now, like useScrollLock's count. */
let users = 0
let stopListening: (() => void) | null = null

/**
 * Starts publishing the on-screen keyboard for one more user (a sheet, the day page) and returns that user's
 * stop. The first user starts listening to the visual viewport; only the last one to stop resets
 * --keyboard-inset, removes --viewport-height and drops `keyboard-open`, so a sheet still closing can't
 * clear them while the day page is using them.
 */
export function startKeyboardInset(): () => void {
  const viewport = window.visualViewport
  if (!viewport) return () => {}
  users += 1
  if (users === 1) {
    const root = document.documentElement
    const update = () => {
      root.style.setProperty('--keyboard-inset', `${keyboardInset(window.innerHeight, viewport)}px`)
      root.style.setProperty('--viewport-height', `${Math.round(viewport.height)}px`)
      root.classList.toggle('keyboard-open', keyboardIsUp(window.innerHeight, viewport))
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    stopListening = () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      root.style.setProperty('--keyboard-inset', '0px')
      root.style.removeProperty('--viewport-height')
      root.classList.remove('keyboard-open')
    }
  }
  let stopped = false
  return () => {
    if (stopped) return
    stopped = true
    users -= 1
    if (users === 0) {
      stopListening?.()
      stopListening = null
    }
  }
}

/**
 * Publishes the on-screen keyboard height as --keyboard-inset and the visual viewport's height as
 * --viewport-height, so sheets and the day page stay above it, and marks <html> with `keyboard-open` while
 * the keyboard is up (it covers the home indicator then).
 */
export function useKeyboardInset(active: boolean) {
  useEffect(() => (active ? startKeyboardInset() : undefined), [active])
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/hooks/useKeyboardInset.test.ts src/lib/viewport.test.ts`
Expected: PASS, `Tests  33 passed (33)`.

- [ ] **Step 5: Add the caret mirror**

Create `src/lib/caret.ts`:

```ts
import type { Span } from './viewport'

/** What the mirror copies from the box, so its text wraps exactly the same way. */
const COPIED = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderTopStyle',
  'borderRightStyle',
  'borderBottomStyle',
  'borderLeftStyle',
  'fontFamily',
  'fontSize',
  'fontStyle',
  'fontWeight',
  'fontStretch',
  'fontVariant',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'textTransform',
  'textIndent',
  'tabSize',
  'overflowWrap',
  'wordBreak',
] as const

/**
 * The screen top and bottom of the line holding the caret in a text box. A box that grows to fit its text never
 * scrolls, so the browser can't say where its caret is: this measures it with a hidden mirror copy of the box
 * (same width, font, padding, line height and wrapping) holding the text up to the caret and a marker.
 */
export function caretLineSpan(box: HTMLTextAreaElement): Span {
  const style = getComputedStyle(box)
  const mirror = document.createElement('div')
  for (const name of COPIED) mirror.style[name] = style[name]
  mirror.style.position = 'absolute'
  mirror.style.top = '0'
  mirror.style.left = '-9999px'
  mirror.style.height = 'auto'
  mirror.style.overflow = 'hidden'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.textContent = box.value.slice(0, box.selectionEnd)
  const marker = document.createElement('span')
  marker.textContent = '\u200b'
  mirror.append(marker)
  document.body.append(mirror)
  const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2
  // The marker's box sits inside its line, half the leading below the line's top.
  const top = marker.offsetTop - (lineHeight - marker.offsetHeight) / 2
  mirror.remove()
  const lineTop = box.getBoundingClientRect().top + box.clientTop + top - box.scrollTop
  return { top: lineTop, bottom: lineTop + lineHeight }
}
```

- [ ] **Step 6: Follow the caret's line**

A box grown to fit its text never overflows, so `caretEdge` would show its top; for such a box taller than the view the reveal measures the caret's line with the mirror. It also acts on typing and caret moves, one frame later, only with the keyboard up and only when the caret's line is hidden. The day page (Task 4) is the first box that grows; its e2e tests cover this.

Replace the whole of `src/hooks/useRevealFocusedField.ts`:

```ts
import { useEffect, type RefObject } from 'react'
import { caretLineSpan } from '../lib/caret'
import { caretEdge, keyboardIsUp, revealMargin, revealOffset, type CaretEdge, type Span } from '../lib/viewport'

/** Input types that type no text and open no picker, so they bring up no keyboard. */
const NO_KEYBOARD = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'])

function isEditable(element: Element | null): element is HTMLElement {
  if (element instanceof HTMLInputElement) return !NO_KEYBOARD.has(element.type)
  return (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  )
}

/**
 * Keeps the focused field on screen inside a sheet's (or the day page's) scrolling body. iOS shows a tapped
 * field while the sheet is still full height; then the keyboard comes up and the sheet shrinks above it (see
 * useKeyboardInset), which left a field low in the sheet out of sight until the first keystroke. A text box
 * taller than the view shows the line with the caret instead, and follows it as you type and move the caret.
 * Only the body scrolls, and only when it shrinks, focus moves, or the caret's line is hidden: never the
 * locked page or the visual viewport, and never while someone is just scrolling.
 */
export function useRevealFocusedField(active: boolean, bodyRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const body = bodyRef.current
    if (!active || !body) return

    /**
     * Scrolls the focused field into view with its scroll margin to spare (var(--space-3) in the CSS, so the
     * browser's own focus scrolling and this agree at every text size); `onlyIfHidden` leaves it while all of
     * it shows.
     */
    const reveal = (onlyIfHidden: boolean) => {
      const field = document.activeElement
      if (!isEditable(field) || !body.contains(field)) return
      const top = body.getBoundingClientRect().top + body.clientTop
      const port = { top, bottom: top + body.clientHeight }
      let target: Span = field.getBoundingClientRect()
      let caret: CaretEdge = 'start'
      if (field instanceof HTMLTextAreaElement) {
        if (field.scrollHeight > field.clientHeight + 1) {
          // A box that scrolls inside itself (the friend sheet's Notes) shows the end you're typing at, when its
          // text runs to the bottom.
          caret = caretEdge(field)
        } else if (target.bottom - target.top > port.bottom - port.top) {
          // A box grown to fit its text never overflows, so its caret can't be read from its scroll: show the
          // caret's line, measured with a mirror of the box.
          target = caretLineSpan(field)
        }
      }
      if (onlyIfHidden && revealOffset(port, target, 0, caret) === 0) return
      const offset = revealOffset(port, target, revealMargin(getComputedStyle(field).scrollMarginBottom), caret)
      if (offset !== 0) body.scrollTop += offset
    }

    // The body shrinks when the keyboard opens, as the sheet follows --keyboard-inset and
    // --viewport-height. This runs after that layout and before paint, so the field never shows hidden.
    // Growing (the keyboard closing, the Save bar's note going away) reveals nothing, so it never pulls
    // the sheet back to a field someone has scrolled away from.
    let lastHeight: number | null = null
    const observer = new ResizeObserver(() => {
      const height = body.clientHeight
      const shrank = lastHeight !== null && height < lastHeight
      lastHeight = height
      if (shrank) reveal(false)
    })
    observer.observe(body)

    // Moving to another field with the keyboard already up changes no size, and neither does typing or moving
    // the caret. Wait a frame so the browser's own scrolling and the text's layout go first, then only act if
    // they left the field (or, in a tall box, the caret's line) out of view: one just in view, close to an edge,
    // is not nudged. Acting, it leaves the same margin as above. Scrolling moves no caret, so it is left alone.
    let frame = 0
    const onChange = () => {
      if (!keyboardIsUp(window.innerHeight, window.visualViewport)) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => reveal(true))
    }
    body.addEventListener('focusin', onChange)
    body.addEventListener('input', onChange)
    document.addEventListener('selectionchange', onChange)

    return () => {
      observer.disconnect()
      body.removeEventListener('focusin', onChange)
      body.removeEventListener('input', onChange)
      document.removeEventListener('selectionchange', onChange)
      cancelAnimationFrame(frame)
    }
  }, [active, bodyRef])
}
```

- [ ] **Step 7: Run everything**

Run: `npm test`
Expected: `Test Files  55 passed (55)` and `Tests  654 passed (654)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `124 passed` (the sheets' keyboard tests keep passing with one counted user each).

- [ ] **Step 8: Commit**

```bash
git add src/hooks/useKeyboardInset.ts src/hooks/useKeyboardInset.test.ts src/lib/caret.ts src/hooks/useRevealFocusedField.ts src/lib/viewport.test.ts
git commit -F - <<'EOF'
feat: a counted keyboard inset and a reveal that follows the caret's line

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: The day page: the layer, its sections, mood tiles, weather chips, the helper bar and autosave

**Files:**
- Create: `src/hooks/useAutosave.ts` / `.test.ts`, `src/lib/payers.ts` / `.test.ts`, `src/components/GrowField.tsx` / `.css`, `src/components/MoodTiles.tsx` / `.css`, `src/screens/DayHelperBar.tsx`, `src/screens/DayScreen.tsx` / `.css`, `e2e/keyboard.ts`, `e2e/day.spec.ts`, `e2e/dayKeyboard.spec.ts`
- Modify: `src/App.tsx` (the route), `e2e/helpers.ts` (`readMeetups`, `openDay`), `e2e/sheetKeyboard.spec.ts` (the keyboard fake moves to `e2e/keyboard.ts`)

- [ ] **Step 1: Write the failing tests for autosave**

Create `src/hooks/useAutosave.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosave, flushWhenHidden, type SaveStatus } from './useAutosave'

interface Day {
  note: string
  mood: string | null
}

/** A save that waits until the test settles it, like a slow IndexedDB write. */
function deferredSave() {
  const calls: { fields: Partial<Day>; settle: (result: boolean | Error) => void }[] = []
  const save = vi.fn(
    (fields: Partial<Day>) =>
      new Promise<boolean>((resolve, reject) => {
        calls.push({ fields, settle: (result) => (result instanceof Error ? reject(result) : resolve(result)) })
      }),
  )
  return { save, calls }
}

function setup(save: (fields: Partial<Day>) => Promise<boolean>) {
  const statuses: SaveStatus[] = []
  const saver = createAutosave<Day>(save, (status) => statuses.push(status))
  return { saver, statuses }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('createAutosave', () => {
  it('saves text 600ms after the last change, and not before', async () => {
    const save = vi.fn(async () => true)
    const { saver } = setup(save)
    saver.change({ note: 'T' })
    await vi.advanceTimersByTimeAsync(400)
    saver.change({ note: 'Ta' })
    await vi.advanceTimersByTimeAsync(599)
    expect(save).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(save).toHaveBeenCalledExactlyOnceWith({ note: 'Ta' })
    expect(saver.isUnsaved()).toBe(false)
  })

  it('saves a chip tap at once, with any text waiting', async () => {
    const save = vi.fn(async () => true)
    const { saver } = setup(save)
    saver.change({ note: 'Tacos' })
    saver.changeNow({ mood: 'okay' })
    await vi.advanceTimersByTimeAsync(0)
    expect(save).toHaveBeenCalledExactlyOnceWith({ note: 'Tacos', mood: 'okay' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('saves everything waiting on flush (blur, the background, Back and unmount)', async () => {
    const save = vi.fn(async () => true)
    const { saver } = setup(save)
    saver.change({ note: 'Tacos' })
    expect(saver.isUnsaved('note')).toBe(true)
    await saver.flush()
    expect(save).toHaveBeenCalledExactlyOnceWith({ note: 'Tacos' })
    expect(saver.isUnsaved()).toBe(false)
    await saver.flush()
    expect(save).toHaveBeenCalledTimes(1)
  })

  it('writes one at a time, and the latest value wins', async () => {
    const { save, calls } = deferredSave()
    const { saver } = setup(save)
    saver.changeNow({ note: 'A' })
    saver.change({ note: 'AB' })
    saver.changeNow({ note: 'ABC' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(calls).toHaveLength(1)
    expect(saver.isUnsaved('note')).toBe(true)

    calls[0].settle(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.map((call) => call.fields)).toEqual([{ note: 'A' }, { note: 'ABC' }])
    calls[1].settle(true)
    const flushed = saver.flush()
    await vi.advanceTimersByTimeAsync(0)
    await flushed
    expect(calls).toHaveLength(2)
    expect(saver.isUnsaved()).toBe(false)
  })

  it('waits for a write in flight before flushing what came after it', async () => {
    const { save, calls } = deferredSave()
    const { saver } = setup(save)
    saver.changeNow({ note: 'A' })
    saver.change({ note: 'AB' })
    const flushed = saver.flush()
    calls[0].settle(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.map((call) => call.fields)).toEqual([{ note: 'A' }, { note: 'AB' }])
    calls[1].settle(true)
    await flushed
    expect(saver.isUnsaved()).toBe(false)
  })

  it('on a failure, keeps the words, retries every 5 seconds and with the next change, and clears on success', async () => {
    const { save, calls } = deferredSave()
    const { saver, statuses } = setup(save)
    saver.changeNow({ note: 'Tacos' })
    calls[0].settle(new Error('QuotaExceededError'))
    await vi.advanceTimersByTimeAsync(0)
    expect(statuses).toEqual([{ failed: true, gone: false }])
    expect(saver.isUnsaved('note')).toBe(true)

    await vi.advanceTimersByTimeAsync(4999)
    expect(calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls[1].fields).toEqual({ note: 'Tacos' })
    calls[1].settle(new Error('QuotaExceededError'))
    await vi.advanceTimersByTimeAsync(0)

    // The next change tries again after its pause, with the newest words.
    saver.change({ note: 'Tacos and karaoke' })
    await vi.advanceTimersByTimeAsync(600)
    expect(calls[2].fields).toEqual({ note: 'Tacos and karaoke' })
    calls[2].settle(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(statuses.at(-1)).toEqual({ failed: false, gone: false })
    expect(saver.isUnsaved()).toBe(false)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toHaveLength(3)
  })

  it('stops quietly when the record is gone', async () => {
    const save = vi.fn(async () => false)
    const { saver, statuses } = setup(save)
    saver.changeNow({ note: 'Tacos' })
    await vi.advanceTimersByTimeAsync(0)
    expect(statuses).toEqual([{ failed: false, gone: true }])
    saver.change({ note: 'More' })
    saver.changeNow({ mood: 'okay' })
    await saver.flush()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(save).toHaveBeenCalledTimes(1)
    expect(saver.isUnsaved()).toBe(false)
  })

  it('drops what is waiting on discard, and saves nothing more', async () => {
    const save = vi.fn(async () => true)
    const { saver } = setup(save)
    saver.change({ note: 'Tacos' })
    saver.discard()
    await saver.flush()
    await vi.advanceTimersByTimeAsync(1000)
    expect(save).not.toHaveBeenCalled()
    expect(saver.isUnsaved()).toBe(false)
  })
})

describe('flushWhenHidden', () => {
  it('flushes when the app goes to the background or the page is hidden, until stopped', () => {
    const document = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState })
    const window = new EventTarget()
    const flush = vi.fn()
    const stop = flushWhenHidden({ document, window }, flush)

    document.dispatchEvent(new Event('visibilitychange'))
    expect(flush).not.toHaveBeenCalled()
    document.visibilityState = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    expect(flush).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('pagehide'))
    expect(flush).toHaveBeenCalledTimes(2)

    stop()
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pagehide'))
    expect(flush).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/hooks/useAutosave.test.ts`
Expected: FAIL, `Error: Cannot find module './useAutosave'`.

- [ ] **Step 3: Write autosave**

One write at a time, only the fields that changed, text after a 600ms pause, chips at once, a retry every 5 seconds after a failure, and a quiet stop when the meetup is gone. `useAutosave` flushes when the app goes to the background and when the page unmounts.

Create `src/hooks/useAutosave.ts`:

```ts
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

/** Text saves this long after the last change. */
export const SAVE_PAUSE_MS = 600
/** After a failed write, the next try comes this much later (or with the next change, if sooner). */
export const RETRY_MS = 5000

export interface SaveStatus {
  /** The last write failed; the words are still waiting to save. */
  failed: boolean
  /** The record is gone (save resolved false): saving has stopped. */
  gone: boolean
}

export interface Autosave<T extends object> {
  /** Text changed: saves after a pause. */
  change(fields: Partial<T>): void
  /** A chip was tapped: saves right away. */
  changeNow(fields: Partial<T>): void
  /** Saves everything waiting now, and resolves once it is written or the write has failed. */
  flush(): Promise<void>
  /** Whether anything (or this field) changed and isn't written yet. */
  isUnsaved(field?: keyof T): boolean
  /** Drops what's waiting and stops saving ("Discard changes"). */
  discard(): void
}

/**
 * Saves a page's fields as they change, one write at a time, sending only the fields that changed. Changes made
 * while a write is out go in the next one, so an older value never lands after a newer one. A failed write keeps
 * its fields (under anything newer) and tries again every 5 seconds and with the next change. `save` resolves
 * false when the record is gone, which stops saving quietly.
 */
export function createAutosave<T extends object>(
  save: (fields: Partial<T>) => Promise<boolean>,
  onStatus: (status: SaveStatus) => void,
): Autosave<T> {
  let waiting: Partial<T> = {}
  let writing: Partial<T> | null = null
  let current: Promise<void> | null = null
  let writeAgain = false
  let pause: ReturnType<typeof setTimeout> | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let status: SaveStatus = { failed: false, gone: false }
  let stopped = false

  const hasWaiting = () => Object.keys(waiting).length > 0

  function report(next: SaveStatus) {
    if (next.failed === status.failed && next.gone === status.gone) return
    status = next
    onStatus(next)
  }

  function write(): Promise<void> {
    clearTimeout(pause)
    if (stopped) return Promise.resolve()
    if (current) {
      writeAgain = true
      return current
    }
    if (!hasWaiting()) return Promise.resolve()
    clearTimeout(retry)
    const fields = waiting
    waiting = {}
    writing = fields
    current = save(fields)
      .then(
        (found) => {
          if (found) {
            report({ failed: false, gone: false })
            return
          }
          stopped = true
          waiting = {}
          report({ failed: false, gone: true })
        },
        () => {
          waiting = { ...fields, ...waiting }
          report({ failed: true, gone: false })
          retry = setTimeout(() => void write(), RETRY_MS)
        },
      )
      .finally(() => {
        writing = null
        current = null
        if (writeAgain) {
          writeAgain = false
          void write()
        }
      })
    return current
  }

  return {
    change(fields) {
      if (stopped) return
      waiting = { ...waiting, ...fields }
      clearTimeout(pause)
      pause = setTimeout(() => void write(), SAVE_PAUSE_MS)
    },
    changeNow(fields) {
      if (stopped) return
      waiting = { ...waiting, ...fields }
      void write()
    },
    async flush() {
      clearTimeout(pause)
      while (current) await current
      if (stopped || !hasWaiting()) return
      await write()
      while (current) await current
    },
    isUnsaved(field) {
      if (field === undefined) return hasWaiting() || writing !== null
      return field in waiting || (writing !== null && field in writing)
    },
    discard() {
      stopped = true
      waiting = {}
      clearTimeout(pause)
      clearTimeout(retry)
    },
  }
}

/** What the page listens to for "the app is going away": the document and the window, or fakes in tests. */
export interface PageEvents {
  document: EventTarget & { visibilityState: DocumentVisibilityState }
  window: EventTarget
}

/** Calls `flush` when the app goes to the background (`visibilitychange` to hidden, and `pagehide`). Returns a stop. */
export function flushWhenHidden(page: PageEvents, flush: () => void): () => void {
  const onVisibilityChange = () => {
    if (page.document.visibilityState === 'hidden') flush()
  }
  page.document.addEventListener('visibilitychange', onVisibilityChange)
  page.window.addEventListener('pagehide', flush)
  return () => {
    page.document.removeEventListener('visibilitychange', onVisibilityChange)
    page.window.removeEventListener('pagehide', flush)
  }
}

/**
 * Saves a page's fields as you type (see createAutosave): everything waiting is saved when the app goes to the
 * background and when the page unmounts (the app lock included). `beforeHide` runs first, so text still in an
 * open field can join the save.
 */
export function useAutosave<T extends object>(
  save: (fields: Partial<T>) => Promise<boolean>,
  beforeHide?: () => void,
): { saver: Autosave<T>; status: SaveStatus } {
  const [status, setStatus] = useState<SaveStatus>({ failed: false, gone: false })
  const saveRef = useRef(save)
  const beforeHideRef = useRef(beforeHide)
  useLayoutEffect(() => {
    saveRef.current = save
    beforeHideRef.current = beforeHide
  })
  const [saver] = useState(() => createAutosave<T>((fields) => saveRef.current(fields), setStatus))

  useEffect(() => {
    const flush = () => {
      beforeHideRef.current?.()
      void saver.flush()
    }
    const stop = flushWhenHidden({ document, window }, flush)
    return () => {
      stop()
      flush()
    }
  }, [saver])

  return { saver, status }
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/hooks/useAutosave.test.ts`
Expected: PASS, `Tests  9 passed (9)`.

- [ ] **Step 5: Write the failing tests for who paid**

Create `src/lib/payers.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { friend } from '../test/fixtures'
import { paidBy, payerLabel } from './payers'

const mariya = friend('f-mariya', 'Mariya')
const jessie = friend('f-jessie', 'Jessie Tran')
const samLee = friend('f-sam-lee', 'Sam Lee')
const samPark = friend('f-sam-park', 'sam Park')

describe('payerLabel', () => {
  it('uses the first name', () => {
    expect(payerLabel(jessie, [mariya, jessie])).toBe('Jessie')
    expect(payerLabel(mariya, [mariya, jessie])).toBe('Mariya')
  })

  it('uses the full name when two friends on the meetup share a first name, ignoring case', () => {
    expect(payerLabel(samLee, [samLee, samPark, mariya])).toBe('Sam Lee')
    expect(payerLabel(samPark, [samLee, samPark, mariya])).toBe('sam Park')
  })
})

describe('paidBy', () => {
  const people = [mariya, jessie, samLee, samPark]

  it('finds the one friend a paid line names, by first or full name, ignoring case', () => {
    expect(paidBy('Jessie', people)).toBe(jessie)
    expect(paidBy('jessie tran', people)).toBe(jessie)
    expect(paidBy('MARIYA', people)).toBe(mariya)
    expect(paidBy('Sam Lee', people)).toBe(samLee)
  })

  it('finds no one for a shared bill, "I", an unknown name or a name that fits two friends', () => {
    expect(paidBy(null, people)).toBeNull()
    expect(paidBy('I', people)).toBeNull()
    expect(paidBy('Brandon', people)).toBeNull()
    expect(paidBy('Sam', people)).toBeNull()
    expect(paidBy('Jessie', [])).toBeNull()
  })
})
```

- [ ] **Step 6: Run them to see them fail**

Run: `npx vitest run src/lib/payers.test.ts`
Expected: FAIL, `Error: Cannot find module './payers'`.

- [ ] **Step 7: Write the payer names**

Create `src/lib/payers.ts`:

```ts
import type { Friend } from '../types'

// Who paid is a plain fact on one place, in your words: never totaled, counted or compared (the No Ledger Rule).
// These only put names on the "Who paid?" chips and a face beside a paid line.

type Named = Pick<Friend, 'name'>

function firstName(friend: Named): string {
  return friend.name.trim().split(/\s+/)[0]
}

/** How the "Who paid?" row names a friend on the meetup: the first name, or the full name when two of them share it. */
export function payerLabel(friend: Named, people: readonly Named[]): string {
  const first = firstName(friend).toLowerCase()
  const sharing = people.filter((other) => firstName(other).toLowerCase() === first).length
  return sharing > 1 ? friend.name.trim() : firstName(friend)
}

/**
 * The friend a paid line names, when its words match exactly one friend on the meetup (their first or full name,
 * ignoring case). Null for a shared bill, "I paid", or a name that matches no one or more than one: the face is
 * only decoration, so a rename just loses it.
 */
export function paidBy<T extends Named>(who: string | null, people: readonly T[]): T | null {
  if (who === null) return null
  const name = who.trim().toLowerCase()
  const matches = people.filter(
    (friend) => friend.name.trim().toLowerCase() === name || firstName(friend).toLowerCase() === name,
  )
  return matches.length === 1 ? matches[0] : null
}
```

- [ ] **Step 8: Run them to see them pass**

Run: `npx vitest run src/lib/payers.test.ts`
Expected: PASS, `Tests  4 passed (4)`.

- [ ] **Step 9: Share the keyboard fake, and add the e2e helpers**

Create `e2e/keyboard.ts`:

```ts
import { expect, type Locator, type Page } from '@playwright/test'

declare global {
  interface Window {
    /**
     * Set by `fakeVisualViewport`: resizes and moves the visual viewport, firing `resize` when its
     * height changes and `scroll` when it moves, as iOS does.
     */
    setVisualViewport?: (next: { height: number; offsetTop: number }) => void
  }
}

/** About the height of the iPhone keyboard with its suggestion bar. */
export const KEYBOARD = 340

/**
 * Playwright's WebKit has no on-screen keyboard, so this plays the iPhone's: `window.visualViewport`
 * becomes a fake whose height and offsetTop the test sets. Like iOS, the layout viewport
 * (innerHeight) keeps its size; only the visual viewport shrinks, and iOS may also pan it down
 * (offsetTop) to show a field. Call it before the page loads.
 */
export async function fakeVisualViewport(page: Page) {
  await page.addInitScript(() => {
    const state = { height: window.innerHeight, offsetTop: 0, resized: false }
    const viewport = new EventTarget()
    const getters: Record<string, () => number> = {
      width: () => window.innerWidth,
      height: () => (state.resized ? state.height : window.innerHeight),
      offsetTop: () => state.offsetTop,
      offsetLeft: () => 0,
      pageTop: () => window.scrollY + state.offsetTop,
      pageLeft: () => window.scrollX,
      scale: () => 1,
    }
    for (const [name, get] of Object.entries(getters)) Object.defineProperty(viewport, name, { get, enumerable: true })
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => viewport })
    window.setVisualViewport = ({ height, offsetTop }) => {
      const resized = height !== getters.height()
      const moved = offsetTop !== state.offsetTop
      state.height = height
      state.offsetTop = offsetTop
      state.resized = true
      if (resized) viewport.dispatchEvent(new Event('resize'))
      if (moved) viewport.dispatchEvent(new Event('scroll'))
    }
  })
}

export async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

/** A custom property the app sets on <html>, such as --keyboard-inset. */
export async function rootProperty(page: Page, name: string) {
  return page.evaluate((name) => document.documentElement.style.getPropertyValue(name), name)
}

/** Moves the fake visual viewport. Throws when the fake is missing, so no test can run without a keyboard. */
export async function setVisualViewport(page: Page, next: { height: number; offsetTop: number }) {
  await page.evaluate((next) => {
    if (!window.setVisualViewport) throw new Error('The fake visualViewport is missing')
    window.setVisualViewport(next)
  }, next)
  await nextFrames(page)
}

/**
 * Slides the keyboard up, with iOS panning the visual viewport `offsetTop` down as well, then lets
 * the page lay out and paint. Checks that the app knows where the keyboard is.
 */
export async function openKeyboard(page: Page, { offsetTop = 0 } = {}) {
  const height = (await page.evaluate(() => window.innerHeight)) - KEYBOARD
  await setVisualViewport(page, { height, offsetTop })
  const inset = `${KEYBOARD - offsetTop}px`
  expect(await rootProperty(page, '--keyboard-inset'), 'The sheet or page sits on the keyboard').toBe(inset)
  expect(await rootProperty(page, '--viewport-height'), 'It fits above the keyboard').toBe(`${height}px`)
  return { height, offsetTop }
}

/** Slides the keyboard back down, with focus staying where it is. */
export async function closeKeyboard(page: Page) {
  await setVisualViewport(page, { height: await page.evaluate(() => window.innerHeight), offsetTop: 0 })
  expect(await rootProperty(page, '--keyboard-inset'), 'Back at the bottom').toBe('0px')
}

/**
 * Focuses a field the way a tap does before the keyboard is up: WebKit scrolls a newly focused field
 * into view a frame later, so let that happen first.
 */
export async function tapFocus(field: Locator) {
  await field.focus()
  await nextFrames(field.page())
}
```

The sheet keyboard tests import it instead of defining it:

In `e2e/sheetKeyboard.spec.ts`, replace:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, editMeetup, LARGE_TEXT, logMeetup, openFriendPage } from './helpers.ts'

declare global {
  interface Window {
    /**
     * Set by `fakeVisualViewport`: resizes and moves the visual viewport, firing `resize` when its
     * height changes and `scroll` when it moves, as iOS does.
     */
    setVisualViewport?: (next: { height: number; offsetTop: number }) => void
  }
}

/** About the height of the iPhone keyboard with its suggestion bar. */
const KEYBOARD = 340

/**
 * Playwright's WebKit has no on-screen keyboard, so this plays the iPhone's: `window.visualViewport`
 * becomes a fake whose height and offsetTop the test sets. Like iOS, the layout viewport
 * (innerHeight) keeps its size; only the visual viewport shrinks, and iOS may also pan it down
 * (offsetTop) to show a field.
 */
async function fakeVisualViewport(page: Page) {
  await page.addInitScript(() => {
    const state = { height: window.innerHeight, offsetTop: 0, resized: false }
    const viewport = new EventTarget()
    const getters: Record<string, () => number> = {
      width: () => window.innerWidth,
      height: () => (state.resized ? state.height : window.innerHeight),
      offsetTop: () => state.offsetTop,
      offsetLeft: () => 0,
      pageTop: () => window.scrollY + state.offsetTop,
      pageLeft: () => window.scrollX,
      scale: () => 1,
    }
    for (const [name, get] of Object.entries(getters)) Object.defineProperty(viewport, name, { get, enumerable: true })
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => viewport })
    window.setVisualViewport = ({ height, offsetTop }) => {
      const resized = height !== getters.height()
      const moved = offsetTop !== state.offsetTop
      state.height = height
      state.offsetTop = offsetTop
      state.resized = true
      if (resized) viewport.dispatchEvent(new Event('resize'))
      if (moved) viewport.dispatchEvent(new Event('scroll'))
    }
  })
}

async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

/** A custom property the app sets on <html>, such as --keyboard-inset. */
async function rootProperty(page: Page, name: string) {
  return page.evaluate((name) => document.documentElement.style.getPropertyValue(name), name)
}

/** Moves the fake visual viewport. Throws when the fake is missing, so no test can run without a keyboard. */
async function setVisualViewport(page: Page, next: { height: number; offsetTop: number }) {
  await page.evaluate((next) => {
    if (!window.setVisualViewport) throw new Error('The fake visualViewport is missing')
    window.setVisualViewport(next)
  }, next)
  await nextFrames(page)
}

/**
 * Slides the keyboard up, with iOS panning the visual viewport `offsetTop` down as well, then lets
 * the page lay out and paint. Checks that the sheet really sits on the keyboard.
 */
async function openKeyboard(page: Page, { offsetTop = 0 } = {}) {
  const height = (await page.evaluate(() => window.innerHeight)) - KEYBOARD
  await setVisualViewport(page, { height, offsetTop })
  const inset = `${KEYBOARD - offsetTop}px`
  expect(await rootProperty(page, '--keyboard-inset'), 'The sheet sits on the keyboard').toBe(inset)
  expect(await rootProperty(page, '--viewport-height'), 'The sheet fits above the keyboard').toBe(`${height}px`)
  return { height, offsetTop }
}

/** Slides the keyboard back down, with focus staying where it is. */
async function closeKeyboard(page: Page) {
  await setVisualViewport(page, { height: await page.evaluate(() => window.innerHeight), offsetTop: 0 })
  expect(await rootProperty(page, '--keyboard-inset'), 'The sheet is back at the bottom').toBe('0px')
}

/**
 * Focuses a field the way a tap does before the keyboard is up: WebKit scrolls a newly focused field
 * into view a frame later, so let that happen first.
 */
async function tapFocus(field: Locator) {
  await field.focus()
  await nextFrames(field.page())
}

/** Where a field inside a sheet is, against the part of the sheet's body you can see and its Save bar. */
async function placement(field: Locator) {
```

with:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, editMeetup, LARGE_TEXT, logMeetup, openFriendPage } from './helpers.ts'
import { closeKeyboard, fakeVisualViewport, KEYBOARD, nextFrames, openKeyboard, setVisualViewport, tapFocus } from './keyboard.ts'

/** Where a field inside a sheet is, against the part of the sheet's body you can see and its Save bar. */
async function placement(field: Locator) {
```

`openDay` reaches the day page through the URL until Task 6 adds the Meetup page's day row; `readMeetups` reads what is stored, without the app.

In `e2e/helpers.ts`, replace:

```ts
  )
}

/** The pixel size of an image data URL, decoded in the page. */
export async function imageSize(page: Page, src: string): Promise<{ width: number; height: number }> {
  return page.evaluate(async (src) => {
```

with:

```ts
  )
}

/** A meetup as IndexedDB stores it, read without the app's reading hook. */
export type StoredMeetup = Record<string, unknown> & { id: string; note: string }

/** Every stored meetup, read straight from IndexedDB, oldest first. */
export async function readMeetups(page: Page): Promise<StoredMeetup[]> {
  const meetups = await page.evaluate(
    () =>
      new Promise<StoredMeetup[]>((resolve, reject) => {
        const request = indexedDB.open('friend-tracker')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const getAll = database.transaction('meetups').objectStore('meetups').getAll()
          getAll.onsuccess = () => {
            database.close()
            resolve(getAll.result)
          }
          getAll.onerror = () => reject(getAll.error)
        }
      }),
  )
  return meetups.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
}

/** On a Meetup page: opens its day page. */
export async function openDay(page: Page) {
  await page.evaluate(() => {
    location.hash = `${location.hash}/day`
  })
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
}

/** The pixel size of an image data URL, decoded in the page. */
export async function imageSize(page: Page, src: string): Promise<{ width: number; height: number }> {
  return page.evaluate(async (src) => {
```

- [ ] **Step 10: Write the failing end-to-end tests**

Create `e2e/day.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'
import {
  addFriend,
  enterPin,
  lockHeading,
  logMeetup,
  openDay,
  openFriendPage,
  readMeetups,
  reopenAfterAWhile,
  seedAppLock,
} from './helpers.ts'

// Most tests add three friends and log a meetup first, so they get more time than most.
test.describe.configure({ timeout: 60_000 })

// The owner wrote their day on Saturday, Oct 3, 2026, at about 9:52 PM, walking home.
test.use({ timezoneId: 'America/Los_Angeles' })
const SATURDAY_NIGHT = new Date('2026-10-03T21:52:00-07:00')
const FRIENDS = ['Mariya', 'Jessie', 'Brandon']

/** Adds Mariya, Jessie and Brandon and logs a Meal with them (today, unless `date` says otherwise). */
async function logMeal(page: Page, options: { date?: string } = {}) {
  for (const name of FRIENDS) await addFriend(page, name)
  await logMeetup(page, FRIENDS, { type: 'Meal', ...options })
}

/** Opens the Meal's day page from Mariya's history. */
async function openMealDay(page: Page) {
  await openFriendPage(page, 'Mariya')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await openDay(page)
}

function dayBox(page: Page) {
  return page.getByRole('textbox', { name: 'The day' })
}

function helpers(page: Page) {
  return page.getByRole('group', { name: 'Writing helpers' })
}

/** What the day page last announced to VoiceOver. */
function announcement(page: Page) {
  return page.locator('.day-page > [aria-live="polite"]')
}

/** Plays the app going to the background: the document turns hidden. */
async function hideApp(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

test('opens on its title, with the meetup on Back and who was there', async ({ page }) => {
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)

  await expect(page).toHaveTitle('The day · Friend Tracker')
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeFocused()
  await expect(page.getByText('Sat, Oct 3 · with Mariya, Jessie and Brandon', { exact: true })).toBeVisible()
  for (const name of ['Weather', 'The day', 'How it felt']) {
    await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible()
  }
  await expect(dayBox(page)).toHaveAccessibleDescription(
    'Start a line with @ for each place, with a time if you like. Lines under a place go with it.',
  )
  await expect(page.getByRole('textbox', { name: 'How it felt, in your words' })).toBeVisible()
  await expect(page.getByText('Saves as you type, and stays on this iPhone.')).toBeVisible()

  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
})

test('saves the weather and the face on the tap', async ({ page }) => {
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  const weather = page.getByRole('group', { name: 'Weather' })
  await expect(weather.getByRole('button')).toHaveText([
    /Sunny$/,
    /Cloudy$/,
    /Rainy$/,
    /Stormy$/,
    /Snowy$/,
    /Windy$/,
    /Hot$/,
    /Cold$/,
  ])
  await weather.getByRole('button', { name: 'Windy' }).click()
  await weather.getByRole('button', { name: 'Rainy' }).click()
  await expect(weather.getByRole('button', { name: 'Rainy' })).toHaveAttribute('aria-pressed', 'true')
  const mood = page.getByRole('group', { name: 'Mood' })
  await expect(mood.getByRole('button')).toHaveText([/Heavy$/, /Okay$/, /Good$/, /Great$/])
  await expect(mood.getByRole('button', { pressed: true })).toHaveCount(0)
  await mood.getByRole('button', { name: 'Okay' }).click()
  await expect(mood.getByRole('button', { name: 'Okay' })).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(async () => (await readMeetups(page))[0]).toMatchObject({ weather: ['rainy', 'windy'], mood: 'okay' })

  // Tapping the picked face again clears it.
  await mood.getByRole('button', { name: 'Okay' }).click()
  await expect(mood.getByRole('button', { name: 'Okay' })).toHaveAttribute('aria-pressed', 'false')
  await weather.getByRole('button', { name: 'Windy' }).click()
  await expect.poll(async () => (await readMeetups(page))[0]).toMatchObject({ weather: ['rainy'], mood: null })
})

test('saves what you type after a pause, and at once when the app goes to the background', async ({ page }) => {
  await page.clock.install()
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  await dayBox(page).fill('Ramen night')
  await page.waitForTimeout(1000)
  await page.reload()
  await expect(dayBox(page)).toHaveValue('Ramen night')

  // With the clock stopped, the pause never ends: only going to the background can save this.
  await page.clock.pauseAt(new Date((await page.evaluate(() => Date.now())) + 1000))
  await dayBox(page).fill('Ramen night, then karaoke')
  await hideApp(page)
  await expect.poll(async () => (await readMeetups(page))[0].note).toBe('Ramen night, then karaoke')
  await page.clock.resume()
  await page.reload()
  await expect(dayBox(page)).toHaveValue('Ramen night, then karaoke')
})

test('comes back with your words after the app lock', async ({ page }) => {
  await page.goto('/')
  await seedAppLock(page, '135790')
  await logMeal(page)
  await openMealDay(page)
  await dayBox(page).fill('@Blue willow 3:30\nJessie paid')
  await expect.poll(async () => (await readMeetups(page))[0].note).toBe('@Blue willow 3:30\nJessie paid')

  await reopenAfterAWhile(page)
  await expect(lockHeading(page)).toBeVisible()
  await enterPin(page, '135790')
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
  await expect(dayBox(page)).toHaveValue('@Blue willow 3:30\nJessie paid')
})

test('"@ Place" adds a place line where the caret is, and Close goes back to The day', async ({ page }) => {
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  const place = helpers(page).getByRole('textbox', { name: 'Place and time' })

  await helpers(page).getByRole('button', { name: 'Add a place' }).click()
  await expect(place).toBeFocused()
  await expect(place).toHaveAttribute('autocorrect', 'off')
  await place.fill('@Blue willow 3:30')
  await place.press('Enter')
  await expect(dayBox(page)).toBeFocused()
  await expect(dayBox(page)).toHaveValue('@Blue willow 3:30\n')
  await expect(announcement(page)).toHaveText('Added Blue willow, 3:30 PM.')
  await page.keyboard.type('Walked to mariya')
  await expect(dayBox(page)).toHaveValue('@Blue willow 3:30\nWalked to mariya')

  await helpers(page).getByRole('button', { name: 'Add a place' }).click()
  await place.fill('Somewhere')
  await helpers(page).getByRole('button', { name: 'Close' }).click()
  await expect(dayBox(page)).toBeFocused()
  await expect(place).toHaveCount(0)
  await expect(dayBox(page)).toHaveValue('@Blue willow 3:30\nWalked to mariya')

  await helpers(page).getByRole('button', { name: 'Add a place' }).click()
  await expect(place).toHaveValue('')
  await place.fill('hey tea')
  await helpers(page).getByRole('button', { name: 'Add the time, 9:52 PM' }).click()
  await expect(place).toHaveValue('hey tea 9:52 PM')
  await helpers(page).getByRole('button', { name: 'Add', exact: true }).click()
  await expect(dayBox(page)).toHaveValue('@Blue willow 3:30\nWalked to mariya\n@hey tea 9:52 PM\n')
  await expect(announcement(page)).toHaveText('Added hey tea, 9:52 PM.')
})

test('a place still in the Place field joins the day when you go back', async ({ page }) => {
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  await dayBox(page).fill('Rainy')
  await helpers(page).getByRole('button', { name: 'Add a place' }).click()
  await helpers(page).getByRole('textbox', { name: 'Place and time' }).fill('Blue willow 3:30')

  await page.getByRole('button', { name: 'Meal' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  expect((await readMeetups(page))[0].note).toBe('Rainy\n@Blue willow 3:30\n')
})

test('"Now" writes the time on today’s meetup, and "Paid" writes who paid', async ({ page }) => {
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)

  await dayBox(page).fill('Left at')
  await helpers(page).getByRole('button', { name: 'Add the time, 9:52 PM' }).click()
  await expect(dayBox(page)).toHaveValue('Left at 9:52 PM')
  await expect(announcement(page)).toHaveText('Added 9:52 PM.')

  await helpers(page).getByRole('button', { name: 'Paid' }).click()
  await expect(announcement(page)).toHaveText('Pick who paid.')
  const whoPaid = helpers(page).getByRole('group', { name: 'Who paid?' })
  const names = ['I paid', 'Mariya', 'Jessie', 'Brandon', 'We split it', 'Close']
  await expect(whoPaid.getByRole('button')).toHaveCount(names.length)
  for (const [index, name] of names.entries()) {
    await expect(whoPaid.getByRole('button').nth(index)).toHaveAccessibleName(name)
  }
  await expect(whoPaid.getByRole('button')).toHaveText(['Me', /Mariya$/, /Jessie$/, /Brandon$/, 'Split', ''])
  await whoPaid.getByRole('button', { name: 'Jessie' }).click()
  await expect(dayBox(page)).toHaveValue('Left at 9:52 PM\nJessie paid')
  await expect(announcement(page)).toHaveText('Added Jessie paid.')
  await expect(whoPaid).toHaveCount(0)
  await expect.poll(async () => (await readMeetups(page))[0].note).toBe('Left at 9:52 PM\nJessie paid')
})

test('a day that is not today has no "Now", and an upcoming one has no How it felt', async ({ page }) => {
  await page.goto('/')
  await logMeal(page, { date: '2099-01-01' })
  await openMealDay(page)
  await expect(helpers(page).getByRole('button', { name: 'Add a place' })).toBeVisible()
  await expect(helpers(page).getByRole('button', { name: /Add the time/ })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'How it felt' })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Mood' })).toHaveCount(0)
})

test('says when The day is full', async ({ page }) => {
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  await dayBox(page).fill('x'.repeat(9_999))
  await expect(page.getByRole('alert')).toHaveCount(0)
  await dayBox(page).press('End')
  await page.keyboard.type('yz')
  await expect(dayBox(page)).toHaveValue(`${'x'.repeat(9_999)}y`)
  await expect(page.getByRole('alert')).toHaveText('This box is full.')
})

test('opened directly, Back goes to its meetup; an unknown one goes to Friends', async ({ page }) => {
  await page.goto('/')
  await logMeal(page)
  const [{ id }] = await readMeetups(page)
  await page.goto('about:blank')
  await page.goto(`/#/meetups/${id}/day`)
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()

  await page.goto('about:blank')
  await page.goto('/#/meetups/nope/day')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})
```

Create `e2e/dayKeyboard.spec.ts`:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, logMeetup, openDay, openFriendPage } from './helpers.ts'
import { closeKeyboard, fakeVisualViewport, nextFrames, openKeyboard, tapFocus } from './keyboard.ts'

/** The room the app keeps between the caret's line and the edges of the day page's visible body. */
const MARGIN = 12

test.beforeEach(async ({ page }) => {
  await fakeVisualViewport(page)
  await page.goto('/')
})

/** Logs a coffee with Alex and opens its day page. */
async function openDayPage(page: Page) {
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()
  await openDay(page)
}

function dayBox(page: Page) {
  return page.getByRole('textbox', { name: 'The day' })
}

/** The visible part of the day page's body, its nav bar and its footer, in layout viewport pixels. */
async function layout(page: Page) {
  return page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('.day-page__body')
    const bar = document.querySelector('.day-page__bar')
    const footer = document.querySelector('.day-page__footer')
    if (!body || !bar || !footer) throw new Error('Not on the day page')
    const top = body.getBoundingClientRect().top + body.clientTop
    return {
      visibleTop: top,
      visibleBottom: top + body.clientHeight,
      barTop: bar.getBoundingClientRect().top,
      barBottom: bar.getBoundingClientRect().bottom,
      footerTop: footer.getBoundingClientRect().top,
      footerBottom: footer.getBoundingClientRect().bottom,
    }
  })
}

/** Where line `line` (1 for the first) of a box whose lines don't wrap is on screen. */
async function lineSpan(box: Locator, line: number) {
  return box.evaluate((element, line) => {
    const style = getComputedStyle(element)
    const height = parseFloat(style.lineHeight)
    const top = element.getBoundingClientRect().top + parseFloat(style.paddingTop) + (line - 1) * height
    return { top, bottom: top + height }
  }, line)
}

/** Where the last line of a box is on screen (the caret's line when the caret is at the end). */
async function lastLineSpan(box: Locator) {
  return box.evaluate((element) => {
    const style = getComputedStyle(element)
    const bottom = element.getBoundingClientRect().bottom - parseFloat(style.paddingBottom)
    return { top: bottom - parseFloat(style.lineHeight), bottom }
  })
}

/** A line is in the visible body and above the helper bar with `room` to spare. */
async function expectLineShown(page: Page, line: { top: number; bottom: number }, what: string, room = MARGIN) {
  const at = await layout(page)
  expect(line.top, `${what} is below the nav bar`).toBeGreaterThanOrEqual(at.visibleTop)
  expect(line.bottom, `${what} is above the helper bar with ${room}px to spare`).toBeLessThanOrEqual(at.footerTop - room)
}

test('the page sits on the keyboard, with "Hide keyboard" on the helper bar', async ({ page }) => {
  await openDayPage(page)
  const hide = page.getByRole('button', { name: 'Hide keyboard' })
  await expect(hide).toBeHidden()
  await tapFocus(dayBox(page))

  const { height } = await openKeyboard(page)

  const at = await layout(page)
  expect(at.footerBottom, 'The helper bar sits right on the keyboard').toBeCloseTo(height, 0)
  expect(at.barTop, 'The nav bar is at the top').toBe(0)
  await expect(hide).toBeVisible()
  await hide.click()
  await expect(dayBox(page)).not.toBeFocused()
  await closeKeyboard(page)
  await expect(hide).toBeHidden()
})

test('with iOS panning the visual viewport, the nav bar and the focused box both show', async ({ page }) => {
  await openDayPage(page)
  await tapFocus(dayBox(page))

  const { height, offsetTop } = await openKeyboard(page, { offsetTop: 120 })

  // What you see of the page runs from offsetTop to offsetTop + height in layout viewport terms.
  const at = await layout(page)
  expect(at.barTop, 'The nav bar is on screen').toBeGreaterThanOrEqual(offsetTop)
  expect(at.footerBottom, 'The helper bar is on screen, on the keyboard').toBeLessThanOrEqual(offsetTop + height + 1)
  const line = await lineSpan(dayBox(page), 1)
  expect(line.top, 'The caret’s line is on screen').toBeGreaterThanOrEqual(offsetTop)
  await expectLineShown(page, line, 'The caret’s line')
})

test('The day comes into view when the keyboard opens, before any typing', async ({ page }) => {
  await openDayPage(page)
  await tapFocus(dayBox(page))

  await openKeyboard(page)

  await expect(dayBox(page)).toBeFocused()
  await expectLineShown(page, await lineSpan(dayBox(page), 1), 'The first line of The day')
})

test('typing new lines at the end of a long day keeps the caret’s line above the helper bar', async ({ page }) => {
  await openDayPage(page)
  const box = dayBox(page)
  await box.fill(Array.from({ length: 60 }, (_, i) => `Line ${i + 1}`).join('\n'))
  await tapFocus(box)
  await box.press('End')
  await openKeyboard(page)

  for (let line = 61; line <= 65; line += 1) {
    await page.keyboard.press('Enter')
    await page.keyboard.type(`Line ${line}`)
    await nextFrames(page)
    await expectLineShown(page, await lastLineSpan(box), `Line ${line}`)
  }
})

test('moving the caret to an earlier line brings that line into view', async ({ page }) => {
  await openDayPage(page)
  const box = dayBox(page)
  await box.fill(Array.from({ length: 60 }, (_, i) => `Line ${i + 1}`).join('\n'))
  await tapFocus(box)
  await box.press('End')
  await openKeyboard(page)
  await nextFrames(page)
  const before = await lineSpan(box, 5)
  expect(before.bottom, 'Line 5 starts out of view').toBeLessThan((await layout(page)).visibleTop)

  await box.evaluate((element: HTMLTextAreaElement) => {
    const start = element.value.indexOf('Line 5\n')
    element.setSelectionRange(start, start)
  })
  await nextFrames(page)

  await expectLineShown(page, await lineSpan(box, 5), 'Line 5')
})

test('moving to How it felt with the keyboard up shows it above the helper bar, with only "Hide keyboard"', async ({
  page,
}) => {
  await openDayPage(page)
  await tapFocus(dayBox(page))
  await openKeyboard(page)
  const feelings = page.getByRole('textbox', { name: 'How it felt, in your words' })

  await feelings.focus()
  await nextFrames(page)

  const box = await feelings.boundingBox()
  if (!box) throw new Error('How it felt is not on screen')
  await expectLineShown(page, { top: box.y, bottom: box.y + box.height }, 'How it felt')
  const helpers = page.getByRole('group', { name: 'Writing helpers' })
  await expect(helpers.getByRole('button')).toHaveCount(1)
  await expect(helpers.getByRole('button', { name: 'Hide keyboard' })).toBeVisible()
})
```

- [ ] **Step 11: Run them to see them fail**

Run: `npx playwright test --project=iphone e2e/day.spec.ts e2e/dayKeyboard.spec.ts`
Expected: FAIL, `16 failed`: the route doesn't exist, so the app sends `/meetups/.../day` to Friends and `openDay` never sees "The day" (the unknown-meetup test fails at its first step for the same reason).

- [ ] **Step 12: Add the text box that grows with its text**

Create `src/components/GrowField.tsx`:

```tsx
import type { CSSProperties, Ref, TextareaHTMLAttributes } from 'react'
import './GrowField.css'

interface GrowFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> {
  ref?: Ref<HTMLTextAreaElement>
  value: string
  /** How many lines tall the box is at least. */
  minLines: number
}

/**
 * A text box that grows with its text and never scrolls inside itself. The textarea and a hidden copy of its text
 * share one grid cell (the replicated-value technique), so the box is always as tall as what's in it, with no
 * height measuring and no jump in the scroll.
 */
export function GrowField({ ref, value, minLines, className, ...props }: GrowFieldProps) {
  // A trailing space keeps a last empty line in the copy as tall as it is in the box.
  return (
    <div className="grow-field" data-value={`${value} `} style={{ '--min-lines': minLines } as CSSProperties}>
      <textarea ref={ref} className={className ? `grow-field__box ${className}` : 'grow-field__box'} value={value} {...props} />
    </div>
  )
}
```

Create `src/components/GrowField.css`:

```css
/* The box and a hidden copy of its text share one grid cell, so the box is as tall as its text. Both must lay out
   text the same way: same font, padding, line height and wrapping. */
.grow-field {
  display: grid;
}
.grow-field::after {
  content: attr(data-value);
  visibility: hidden;
}
.grow-field__box,
.grow-field::after {
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
  background: var(--surface);
  color: var(--ink);
}
.grow-field__box::placeholder {
  color: var(--ink-3);
}
```

- [ ] **Step 13: Add the mood tiles**

Create `src/components/MoodTiles.tsx`:

```tsx
import { MOODS } from '../lib/moods'
import type { Mood } from '../types'
import { IconCheck } from './icons'
import './MoodTiles.css'

interface MoodTilesProps {
  mood: Mood | null
  onChange: (mood: Mood | null) => void
}

/**
 * The four faces, low to high, as toggle buttons. Nothing is picked at first; tapping the picked face clears it.
 * A mood is a word, never a score (the No Score Rule): no colors and no scale.
 */
export function MoodTiles({ mood, onChange }: MoodTilesProps) {
  return (
    <div className="mood-tiles" role="group" aria-label="Mood">
      {MOODS.map(({ key, emoji, label }) => {
        const picked = mood === key
        return (
          <button
            key={key}
            type="button"
            className="mood-tile"
            aria-pressed={picked}
            onClick={() => onChange(picked ? null : key)}
          >
            <span className="mood-tile__face" aria-hidden="true">
              {emoji}
              {picked && (
                <span className="mood-tile__check">
                  <IconCheck size={14} strokeWidth={3} />
                </span>
              )}
            </span>
            <span className="mood-tile__word">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
```

Create `src/components/MoodTiles.css`:

```css
/* Four across at every standard text size; two by two once a quarter of the row is narrower than 3.25rem, so a
   word never breaks (the same flex-basis trick as the stat row). */
.mood-tiles {
  display: flex;
  flex-wrap: wrap;
}
.mood-tile {
  flex: 1 1 max(25%, min(50%, calc((13rem - 100%) * 999)));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  min-height: 77px;
  padding: var(--space-3) var(--space-1) var(--space-2);
  border-radius: var(--radius-field);
  color: var(--ink);
  transition: background-color var(--dur-fast);
}
.mood-tile:active {
  background: var(--surface-pressed);
}
.mood-tile__face {
  position: relative;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--surface-2);
  font-size: 26px;
  line-height: 1;
  outline: 3px solid transparent;
  outline-offset: 2px;
  transition: outline-color var(--dur-fast) var(--ease-out-quart);
}
.mood-tile[aria-pressed='true'] .mood-tile__face {
  outline-color: var(--accent);
}
/* The selected-friend check: a 22px Peach badge ringed in Warm Paper. */
.mood-tile__check {
  position: absolute;
  right: -4px;
  bottom: -4px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 2px solid var(--bg);
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
  animation: pop-in var(--dur) var(--ease-out-quart);
}
.mood-tile__word {
  font-size: var(--text-footnote);
  line-height: 1.25;
}
.mood-tile[aria-pressed='true'] .mood-tile__word {
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .mood-tile__check {
    animation: fade-in var(--dur) linear;
  }
}
```

- [ ] **Step 14: Add the helper bar**

Every helper button calls `preventDefault()` on `pointerdown` and `mousedown`, so the box you're typing in keeps its focus and the keyboard stays up. "Hide keyboard" shows only while `html.keyboard-open` is set (DayScreen.css).

Create `src/screens/DayHelperBar.tsx`:

```tsx
import { useId, type KeyboardEvent, type Ref, type SyntheticEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { IconChevronDown, IconClose } from '../components/icons'
import { isPlainEnter } from '../lib/keys'
import type { Friend } from '../types'

/** Which row the helper bar shows. */
export type HelperRow = 'helpers' | 'place' | 'paid'

/** One "Who paid?" chip: what it shows, its name for VoiceOver, and the line it writes. */
export interface Payer {
  key: string
  label: string
  name: string
  line: string
  friend?: Friend
}

interface DayHelperBarProps {
  row: HelperRow
  /** While the How it felt box has focus, only "Hide keyboard" shows: the helpers write into The day. */
  feelingsFocused: boolean
  /** The current time as you'd type it ("9:52 PM"), when the meetup is today; null otherwise. */
  now: string | null
  payers: Payer[]
  placeRef: Ref<HTMLInputElement>
  placeDraft: string
  onPlaceDraftChange: (text: string) => void
  onOpenPlace: () => void
  onAddPlace: () => void
  onClosePlace: () => void
  onNow: () => void
  onNowInPlace: () => void
  onOpenPaid: () => void
  onPaid: (line: string) => void
  onClosePaid: () => void
  onHideKeyboard: () => void
}

/** Keeps focus where it is (and the keyboard up) when a helper is tapped. */
function keepFocus(event: SyntheticEvent) {
  event.preventDefault()
}

const keepFocusProps = { onPointerDown: keepFocus, onMouseDown: keepFocus }

/**
 * The day page's helper bar, riding on the keyboard: "@ Place", "Now" (today only) and "Paid", or the Place field,
 * or the "Who paid?" chips, with "Hide keyboard" pinned at the end while the keyboard is up (see DayScreen.css).
 */
export function DayHelperBar(props: DayHelperBarProps) {
  const { row, feelingsFocused, now, payers, placeRef, placeDraft } = props
  const paidLabelId = useId()

  function onPlaceKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (isPlainEnter(event)) {
      event.preventDefault()
      props.onAddPlace()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      props.onClosePlace()
    }
  }

  return (
    <div className="day-helpers" role="group" aria-label="Writing helpers">
      <div className="day-helpers__row">
        {row === 'helpers' && !feelingsFocused && (
          <>
            <button type="button" className="chip" aria-label="Add a place" {...keepFocusProps} onClick={props.onOpenPlace}>
              @ Place
            </button>
            {now !== null && (
              <button type="button" className="chip" aria-label={`Add the time, ${now}`} {...keepFocusProps} onClick={props.onNow}>
                Now
              </button>
            )}
            <button type="button" className="chip" aria-expanded={false} {...keepFocusProps} onClick={props.onOpenPaid}>
              Paid
            </button>
          </>
        )}

        {row === 'place' && (
          <>
            <input
              ref={placeRef}
              className="field day-place"
              aria-label="Place and time"
              placeholder="Place, then a time if you like"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              value={placeDraft}
              onChange={(event) => props.onPlaceDraftChange(event.target.value)}
              onKeyDown={onPlaceKeyDown}
            />
            {now !== null && (
              <button type="button" className="chip" aria-label={`Add the time, ${now}`} {...keepFocusProps} onClick={props.onNowInPlace}>
                Now
              </button>
            )}
            {placeDraft.trim() !== '' && (
              <button type="button" className="text-button day-helpers__add" {...keepFocusProps} onClick={props.onAddPlace}>
                Add
              </button>
            )}
            <button type="button" className="icon-button" aria-label="Close" {...keepFocusProps} onClick={props.onClosePlace}>
              <IconClose size={20} />
            </button>
          </>
        )}

        {row === 'paid' && (
          <div className="day-helpers__paid" role="group" aria-labelledby={paidLabelId}>
            <span id={paidLabelId} className="day-helpers__label">
              Who paid?
            </span>
            {payers.map((payer) => (
              <button
                key={payer.key}
                type="button"
                className="chip"
                aria-label={payer.name === payer.label ? undefined : payer.name}
                {...keepFocusProps}
                onClick={() => props.onPaid(payer.line)}
              >
                {payer.friend && (
                  <Avatar name={payer.friend.name} photo={payer.friend.photo} seed={payer.friend.id} size={24} />
                )}
                {payer.label}
              </button>
            ))}
            <button type="button" className="icon-button" aria-label="Close" {...keepFocusProps} onClick={props.onClosePaid}>
              <IconClose size={20} />
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        className="icon-button day-helpers__hide"
        aria-label="Hide keyboard"
        {...keepFocusProps}
        onClick={props.onHideKeyboard}
      >
        <IconChevronDown size={24} strokeWidth={2.2} />
      </button>
    </div>
  )
}
```

- [ ] **Step 15: Add the day page**

`DayScreen` waits for the meetup, friends and types (going back when the meetup is gone, like the Meetup page), and starts the scroll lock and keyboard publishing at once. `DayPage` keeps its own copy of the day, writes helper text with `execCommand('insertText')` (falling back to `setRangeText` and an `input` event), and saves through `useAutosave`.

Create `src/screens/DayScreen.tsx`:

```tsx
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useConfirmDiscard } from '../components/ActionSheet'
import { Chip } from '../components/Chip'
import { GrowField } from '../components/GrowField'
import { IconChevronLeft } from '../components/icons'
import { MoodTiles } from '../components/MoodTiles'
import { useFriends, useMeetup, useMeetupTypes } from '../data/hooks'
import { updateDay } from '../db/meetups'
import { useAutosave } from '../hooks/useAutosave'
import { useKeyboardInset } from '../hooks/useKeyboardInset'
import { useRevealFocusedField } from '../hooks/useRevealFocusedField'
import { useScrollLock } from '../hooks/useScrollLock'
import { useToday } from '../hooks/useToday'
import { clockStyle, describeStopTime, typedClock } from '../lib/clock'
import { formatDate } from '../lib/dates'
import { changeBetween, insertAtCaret, insertPaidLine, insertPlaceLine, type DayEdit } from '../lib/dayEdit'
import { DAY_MAX_TYPED, FEELINGS_MAX, readDay } from '../lib/dayText'
import { feelingsApply } from '../lib/moods'
import { payerLabel } from '../lib/payers'
import { formatNameList } from '../lib/text'
import { cleanWeather, WEATHER } from '../lib/weather'
import type { Friend, Meetup, Mood, Weather } from '../types'
import { DayHelperBar, type HelperRow, type Payer } from './DayHelperBar'
import './DayScreen.css'

/** The day page's own copy of the meetup's day. */
interface DayFields {
  note: string
  weather: Weather[]
  mood: Mood | null
  feelings: string
}

const FIELDS = ['note', 'weather', 'mood', 'feelings'] as const

function fieldsOf(meetup: Meetup): DayFields {
  return { note: meetup.note, weather: meetup.weather, mood: meetup.mood, feelings: meetup.feelings }
}

function sameValue(a: DayFields[keyof DayFields], b: DayFields[keyof DayFields]): boolean {
  return Array.isArray(a) && Array.isArray(b) ? a.join() === b.join() : a === b
}

const SAVE_FAILED = "Couldn't save just now. Your words are still here, and the app will try again."

/** Minutes past midnight now, refreshed every 10 seconds (the "Now" chip's name follows the clock). */
function useMinutesNow(): number {
  const read = () => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  }
  const [minutes, setMinutes] = useState(read)
  useEffect(() => {
    const timer = window.setInterval(() => setMinutes(read()), 10_000)
    return () => window.clearInterval(timer)
  }, [])
  return minutes
}

/** The "Who paid?" chips: Me, each friend on the meetup in the meetup's order, and Split. */
function payersFor(people: Friend[]): Payer[] {
  return [
    { key: 'me', label: 'Me', name: 'I paid', line: 'I paid' },
    ...people.map((friend) => {
      const label = payerLabel(friend, people)
      return { key: friend.id, label, name: label, line: `${label} paid`, friend }
    }),
    { key: 'split', label: 'Split', name: 'We split it', line: 'We split it' },
  ]
}

/** `/meetups/:id/day`: write the whole day, comfortably, and have it saved as you go. */
export function DayScreen() {
  const { id } = useParams()
  const meetup = useMeetup(id)
  const friends = useFriends()
  const types = useMeetupTypes()
  const location = useLocation()
  const navigate = useNavigate()
  const leftRef = useRef(false)
  // From the moment the route opens (a closing Log sheet may still hold the keyboard for 260ms).
  useScrollLock(true)
  useKeyboardInset(true)

  // Deleted (Undo on the "Logged" toast, another tab) or never there: go back, like the Meetup page does.
  const leave = useCallback(() => {
    if (leftRef.current) return
    leftRef.current = true
    if (location.key === 'default') navigate('/', { replace: true })
    else navigate(-1)
  }, [location.key, navigate])

  useEffect(() => {
    if (meetup === null) leave()
  }, [meetup, leave])

  if (!meetup || !friends || !types) return null
  const typeName = types.find((type) => type.id === meetup.typeId)?.name ?? 'Meetup'
  const friendById = new Map(friends.map((friend) => [friend.id, friend] as const))
  const people = meetup.friendIds.map((friendId) => friendById.get(friendId)).filter((f): f is Friend => !!f)
  return <DayPage key={meetup.id} meetup={meetup} people={people} typeName={typeName} onGone={leave} />
}

interface DayPageProps {
  meetup: Meetup
  people: Friend[]
  typeName: string
  onGone: () => void
}

function DayPage({ meetup, people, typeName, onGone }: DayPageProps) {
  const today = useToday()
  const minutesNow = useMinutesNow()
  const location = useLocation()
  const navigate = useNavigate()
  const confirmDiscard = useConfirmDiscard()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const dayRef = useRef<HTMLTextAreaElement>(null)
  const placeRef = useRef<HTMLInputElement>(null)
  const weatherId = useId()
  const dayId = useId()
  const hintId = useId()
  const feltId = useId()

  // The page keeps its own copy, taken once when it opens (see the effect below for newer stored values).
  const [fields, setFields] = useState<DayFields>(() => fieldsOf(meetup))
  const fieldsRef = useRef(fields)
  const [focused, setFocused] = useState<'note' | 'feelings' | null>(null)
  const focusedRef = useRef(focused)
  // Whether The day has had focus since the page opened: until then, helpers write at the end of its text.
  const dayTouched = useRef(false)
  const [row, setRow] = useState<HelperRow>('helpers')
  const [placeDraft, setPlaceDraft] = useState('')
  const placeDraftRef = useRef(placeDraft)
  const [scrolled, setScrolled] = useState(false)
  const [announcement, setAnnouncement] = useState({ text: '', n: 0 })

  const { saver, status } = useAutosave<DayFields>((changes) => updateDay(meetup.id, changes), commitPlaceDraft)

  useRevealFocusedField(true, bodyRef)

  // Before the first paint, so VoiceOver starts at the top and a tap on a box can't lose its focus to the title.
  useLayoutEffect(() => {
    document.title = 'The day · Friend Tracker'
    titleRef.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    if (status.gone) onGone()
  }, [status.gone, onGone])

  // A newer stored value (another tab, a backup restore) only goes into a field that isn't focused and has
  // nothing waiting to save, so nothing changes under your thumb.
  useEffect(() => {
    const stored = fieldsOf(meetup)
    let next = fieldsRef.current
    for (const key of FIELDS) {
      if (focusedRef.current === key || saver.isUnsaved(key) || sameValue(stored[key], next[key])) continue
      next = { ...next, [key]: stored[key] }
    }
    if (next !== fieldsRef.current) {
      fieldsRef.current = next
      setFields(next)
    }
  }, [meetup, saver])

  function setField<K extends keyof DayFields>(key: K, value: DayFields[K], now: boolean) {
    fieldsRef.current = { ...fieldsRef.current, [key]: value }
    setFields(fieldsRef.current)
    const change: Partial<DayFields> = { [key]: value }
    if (now) saver.changeNow(change)
    else saver.change(change)
  }

  function setFocus(field: 'note' | 'feelings' | null) {
    focusedRef.current = field
    setFocused(field)
  }

  function announce(text: string) {
    setAnnouncement((current) => ({ text, n: current.n + 1 }))
  }

  function updatePlaceDraft(text: string) {
    placeDraftRef.current = text
    setPlaceDraft(text)
  }

  /** The caret in The day, or the end of its text if it hasn't had focus since the page opened. */
  function dayCaret(): { start: number; end: number } {
    const box = dayRef.current
    const length = fieldsRef.current.note.length
    if (!box || !dayTouched.current) return { start: length, end: length }
    return { start: box.selectionStart, end: box.selectionEnd }
  }

  /** Puts focus in The day, with the caret at the end if it hasn't had focus yet. */
  function focusDay() {
    const box = dayRef.current
    if (!box) return
    if (!dayTouched.current) box.setSelectionRange(box.value.length, box.value.length)
    box.focus({ preventScroll: true })
  }

  /**
   * Writes a helper's text into The day at its caret. It goes in with execCommand while The day has focus, so
   * shake to undo still works; if that's refused, setRangeText and an input event (losing only native undo).
   */
  function editDay(edit: (value: string, caret: number) => DayEdit): DayEdit {
    const box = dayRef.current!
    const value = box.value
    const { start, end } = dayCaret()
    const next = edit(value.slice(0, start) + value.slice(end), start)
    const change = changeBetween(value, next.value)
    focusDay()
    box.setSelectionRange(change.from, change.to)
    if (!document.execCommand('insertText', false, change.text)) {
      box.setRangeText(change.text, change.from, change.to, 'end')
      box.dispatchEvent(new Event('input', { bubbles: true }))
    }
    box.setSelectionRange(next.caret, next.caret)
    return next
  }

  /** "Added Blue willow, 3:30 PM.", read from the day as it now stands, so the time reads in day order. */
  function describeAddedPlace(next: DayEdit, line: string): string {
    const end = next.value.lastIndexOf(line, next.caret) + line.length
    const part = readDay(next.value.slice(0, end)).at(-1)
    const stop = part?.kind === 'timeline' ? part.stops.at(-1) : undefined
    if (!stop) return `Added ${line.slice(1)}.`
    const time = describeStopTime(stop, clockStyle())
    return time ? `Added ${stop.place}, ${time}.` : `Added ${stop.place}.`
  }

  function addPlace() {
    const text = placeDraftRef.current
    const line = insertPlaceLine('', 0, text).value.trimEnd()
    if (line === '') {
      closePlace()
      return
    }
    const next = editDay((value, caret) => insertPlaceLine(value, caret, text))
    updatePlaceDraft('')
    setRow('helpers')
    announce(describeAddedPlace(next, line))
  }

  function openPlace() {
    // The field has to be there to take focus inside this tap, so iOS raises (or keeps) the keyboard.
    flushSync(() => setRow('place'))
    placeRef.current?.focus()
  }

  function closePlace() {
    updatePlaceDraft('')
    setRow('helpers')
    focusDay()
  }

  /** Text left in the Place field joins The day as a place line (on Back, and when the app goes away). */
  function commitPlaceDraft() {
    const text = placeDraftRef.current
    if (text.trim() === '') return
    const { start, end } = dayCaret()
    const note = fieldsRef.current.note
    const next = insertPlaceLine(note.slice(0, start) + note.slice(end), start, text)
    updatePlaceDraft('')
    setRow('helpers')
    if (next.value !== note) setField('note', next.value, false)
  }

  const now = meetup.date === today ? typedClock(minutesNow, clockStyle()) : null

  function addNow() {
    if (now === null) return
    editDay((value, caret) => insertAtCaret(value, caret, now))
    announce(`Added ${now}.`)
  }

  function addNowInPlace() {
    if (now === null) return
    const draft = placeDraftRef.current
    updatePlaceDraft(`${draft}${draft === '' || /\s$/.test(draft) ? '' : ' '}${now}`)
  }

  function openPaid() {
    setRow('paid')
    announce('Pick who paid.')
  }

  function addPaid(line: string) {
    editDay((value, caret) => insertPaidLine(value, caret, line))
    setRow('helpers')
    announce(`Added ${line}.`)
  }

  function hideKeyboard() {
    const active = document.activeElement
    if (active instanceof HTMLElement) active.blur()
  }

  function toggleWeather(key: Weather) {
    const picked = fieldsRef.current.weather
    setField('weather', cleanWeather(picked.includes(key) ? picked.filter((k) => k !== key) : [...picked, key]), true)
  }

  async function goBack() {
    commitPlaceDraft()
    await saver.flush()
    if (saver.isUnsaved()) {
      if (!(await confirmDiscard(true))) return
      saver.discard()
    }
    if (location.key === 'default') navigate(`/meetups/${meetup.id}`, { replace: true })
    else navigate(-1)
  }

  const names = people.map((friend) => friend.name)
  const context = [formatDate(meetup.date, today), names.length > 0 ? `with ${formatNameList(names)}` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="day-page">
      <header className="day-page__bar" data-scrolled={scrolled}>
        <button type="button" className="text-button navbar__back" onClick={() => void goBack()}>
          <IconChevronLeft size={26} strokeWidth={2.4} />
          <span className="navbar__back-label">{typeName}</span>
        </button>
        <h1 ref={titleRef} className="day-page__title" tabIndex={-1}>
          The day
        </h1>
        {/* As wide as the back button, so the title stays centered. */}
        <span className="text-button navbar__back day-page__spacer" aria-hidden="true">
          <IconChevronLeft size={26} strokeWidth={2.4} />
          <span className="navbar__back-label">{typeName}</span>
        </span>
      </header>

      <div ref={bodyRef} className="day-page__body" onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}>
        <p className="day-page__context">{context}</p>

        <section className="day-section" aria-labelledby={weatherId}>
          <h2 id={weatherId} className="form-section__label">
            Weather
          </h2>
          <div className="chip-row" role="group" aria-labelledby={weatherId}>
            {WEATHER.map(({ key, emoji, label }) => (
              <Chip key={key} selected={fields.weather.includes(key)} onClick={() => toggleWeather(key)}>
                <span aria-hidden="true">{emoji}</span>
                {label}
              </Chip>
            ))}
          </div>
        </section>

        <section className="day-section" aria-labelledby={dayId}>
          <h2 id={dayId} className="form-section__label">
            The day
          </h2>
          <p id={hintId} className="day-section__hint">
            Start a line with @ for each place, with a time if you like. Lines under a place go with it.
          </p>
          <GrowField
            ref={dayRef}
            minLines={12}
            aria-labelledby={dayId}
            aria-describedby={hintId}
            value={fields.note}
            placeholder={'@Blue willow 3:30\nWho came, what you ate, what you talked about'}
            autoCapitalize="sentences"
            autoCorrect="on"
            spellCheck
            maxLength={DAY_MAX_TYPED}
            onChange={(event) => setField('note', event.target.value, false)}
            onFocus={() => {
              dayTouched.current = true
              setFocus('note')
            }}
            onBlur={() => {
              setFocus(null)
              void saver.flush()
            }}
          />
          {fields.note.length >= DAY_MAX_TYPED && (
            <p className="field-hint" role="alert">
              This box is full.
            </p>
          )}
        </section>

        {feelingsApply(meetup, today) && (
          <section className="day-section" aria-labelledby={feltId}>
            <h2 id={feltId} className="form-section__label">
              How it felt
            </h2>
            <MoodTiles mood={fields.mood} onChange={(mood) => setField('mood', mood, true)} />
            <GrowField
              minLines={4}
              aria-label="How it felt, in your words"
              value={fields.feelings}
              placeholder="A few words, just for you"
              autoCapitalize="sentences"
              maxLength={FEELINGS_MAX}
              onChange={(event) => setField('feelings', event.target.value, false)}
              onFocus={() => setFocus('feelings')}
              onBlur={() => {
                setFocus(null)
                void saver.flush()
              }}
            />
            {fields.feelings.length >= FEELINGS_MAX && (
              <p className="field-hint" role="alert">
                This box is full.
              </p>
            )}
          </section>
        )}

        <p className="day-page__footnote">Saves as you type, and stays on this iPhone.</p>
      </div>

      <div className="day-page__footer">
        {status.failed && (
          <p className="field-error" role="alert">
            {SAVE_FAILED}
          </p>
        )}
        <DayHelperBar
          row={row}
          feelingsFocused={focused === 'feelings'}
          now={now}
          payers={payersFor(people)}
          placeRef={placeRef}
          placeDraft={placeDraft}
          onPlaceDraftChange={updatePlaceDraft}
          onOpenPlace={openPlace}
          onAddPlace={addPlace}
          onClosePlace={closePlace}
          onNow={addNow}
          onNowInPlace={addNowInPlace}
          onOpenPaid={openPaid}
          onPaid={addPaid}
          onClosePaid={() => setRow('helpers')}
          onHideKeyboard={hideKeyboard}
        />
      </div>

      <p className="visually-hidden" aria-live="polite">
        <span key={announcement.n}>{announcement.text}</span>
      </p>
    </div>
  )
}
```

`base.css` comes after the components' CSS in the bundle, so the rules that must beat `.icon-button` or `.text-button` name the bar too.

Create `src/screens/DayScreen.css`:

```css
/* The day page: a fixed full-screen layer that always fills exactly the part of the screen above the keyboard
   (its bottom at --keyboard-inset, its height --viewport-height), so iOS panning the visual viewport can't push
   the nav bar or the helper bar off screen. Only its body scrolls. */
.day-page {
  position: fixed;
  left: 0;
  right: 0;
  bottom: var(--keyboard-inset);
  z-index: 40;
  display: flex;
  flex-direction: column;
  max-width: 600px;
  height: var(--viewport-height, 100dvh);
  margin: 0 auto;
  background: var(--bg);
  animation: page-push var(--dur-sheet) var(--ease-out-quart);
}

.day-page__bar {
  flex: none;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  min-height: calc(var(--navbar-height) + var(--safe-top));
  padding: var(--safe-top) var(--space-2) 0;
  border-bottom: 0.5px solid transparent;
  background: var(--bg);
  transition: border-color var(--dur) var(--ease-out-quart);
}
.day-page__bar[data-scrolled='true'] {
  border-bottom-color: var(--separator);
}
.day-page__bar .navbar__back {
  justify-self: start;
}
.day-page__title {
  margin: 0;
  font-size: var(--text-body);
  font-weight: 600;
  text-align: center;
}
.day-page__title:focus {
  outline: none;
}
.day-page__spacer {
  justify-self: end;
  visibility: hidden;
  pointer-events: none;
}

.day-page__body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-2) var(--space-4) var(--space-6);
}
/* The browser's own scrolling to a focused box leaves the same room as the app's (useRevealFocusedField reads it). */
.day-page__body :is(input, textarea) {
  scroll-margin-block: var(--space-3);
}
.day-page__context {
  margin: 0;
  color: var(--ink-2);
  font-size: var(--text-subhead);
  text-align: center;
  text-wrap: balance;
}
.day-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.day-section .form-section__label {
  margin: 0 var(--space-1);
}
.day-section__hint {
  margin: 0 var(--space-1);
  color: var(--ink-2);
  font-size: var(--text-footnote);
  line-height: 1.4;
}
.day-page__footnote {
  margin: 0;
  color: var(--ink-2);
  font-size: var(--text-footnote);
  text-align: center;
}

/* The footer rides on the keyboard: the save error line, then the helper bar. */
.day-page__footer {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-4) calc(var(--space-2) + var(--safe-bottom));
  border-top: 0.5px solid var(--separator);
  background: var(--bg);
}
/* The keyboard covers the home indicator, so the bar needs no room for it. */
.keyboard-open .day-page__footer {
  padding-bottom: var(--space-2);
}
.day-page__footer .field-error {
  margin: 0;
}

.day-helpers {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--tap);
}
/* One row that scrolls sideways at large text sizes; "Hide keyboard" stays pinned at its end. */
.day-helpers__row {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  /* Room inside the scroller for the focus ring and the chips' taller hit areas, which it would clip. */
  margin: calc(-1 * var(--space-1)) -3px;
  padding: var(--space-1) 3px;
  overflow-x: auto;
  scrollbar-width: none;
}
.day-helpers__row::-webkit-scrollbar {
  display: none;
}
.day-helpers__paid {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.day-helpers__label {
  flex: none;
  color: var(--ink-2);
  font-size: var(--text-footnote);
  font-weight: 600;
}
.day-helpers .icon-button {
  flex: none;
}
/* base.css comes later in the bundle, so these name the bar too, to win over .icon-button. */
.day-helpers .day-helpers__hide {
  display: none;
}
.keyboard-open .day-helpers .day-helpers__hide {
  display: inline-grid;
}
.day-helpers__add {
  flex: none;
  font-weight: 600;
}
.day-place.field {
  flex: 1;
  min-width: 6em;
  height: var(--tap);
}

@media (prefers-reduced-motion: reduce) {
  .day-page {
    animation-name: fade-in;
  }
}
```

- [ ] **Step 16: Add the route**

In `src/App.tsx`, replace:

```tsx
import { TabBar } from './components/TabBar'
import { ToastProvider } from './components/Toast'
import { ReminderSync } from './reminders/useReminderSync'
import { FriendDetailScreen } from './screens/FriendDetailScreen'
import { FriendsScreen } from './screens/FriendsScreen'
import { GroupsScreen } from './screens/GroupsScreen'
```

with:

```tsx
import { TabBar } from './components/TabBar'
import { ToastProvider } from './components/Toast'
import { ReminderSync } from './reminders/useReminderSync'
import { DayScreen } from './screens/DayScreen'
import { FriendDetailScreen } from './screens/FriendDetailScreen'
import { FriendsScreen } from './screens/FriendsScreen'
import { GroupsScreen } from './screens/GroupsScreen'
```

Replace:

```tsx
                <Route path="/" element={<FriendsScreen />} />
                <Route path="/friends/:id" element={<FriendDetailScreen />} />
                <Route path="/meetups/:id" element={<MeetupScreen />} />
                <Route path="/stats" element={<StatsScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="/settings/groups" element={<GroupsScreen />} />
```

with:

```tsx
                <Route path="/" element={<FriendsScreen />} />
                <Route path="/friends/:id" element={<FriendDetailScreen />} />
                <Route path="/meetups/:id" element={<MeetupScreen />} />
                <Route path="/meetups/:id/day" element={<DayScreen />} />
                <Route path="/stats" element={<StatsScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="/settings/groups" element={<GroupsScreen />} />
```

- [ ] **Step 17: Run the end-to-end tests to see them pass**

Run: `npx playwright test --project=iphone e2e/day.spec.ts e2e/dayKeyboard.spec.ts e2e/sheetKeyboard.spec.ts`
Expected: `33 passed`.

- [ ] **Step 18: Run everything**

Run: `npm test`
Expected: `Test Files  57 passed (57)` and `Tests  667 passed (667)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `140 passed`.

- [ ] **Step 19: Commit**

```bash
git add src/hooks/useAutosave.ts src/hooks/useAutosave.test.ts src/lib/payers.ts src/lib/payers.test.ts src/components/GrowField.tsx src/components/GrowField.css src/components/MoodTiles.tsx src/components/MoodTiles.css src/screens/DayHelperBar.tsx src/screens/DayScreen.tsx src/screens/DayScreen.css src/App.tsx e2e/keyboard.ts e2e/helpers.ts e2e/sheetKeyboard.spec.ts e2e/day.spec.ts e2e/dayKeyboard.spec.ts
git commit -F - <<'EOF'
feat: the day page, with weather chips, mood tiles, the helper bar and autosave

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: The Log sheet: Note out, "Save and write about the day" in

**Files:**
- Modify: `src/sheets/MeetupSheet.tsx`, `src/sheets/MeetupSheet.css`, `e2e/helpers.ts` (`logMeetup`'s note)
- Test: `e2e/day.spec.ts`, `e2e/dayKeyboard.spec.ts`, `e2e/sheetKeyboard.spec.ts` (the Log sheet Note tests go), `e2e/detail.spec.ts`, `e2e/meetups.spec.ts`, `e2e/memories.spec.ts`

- [ ] **Step 1: Look for the Log sheet's Save by its exact name**

"Save and write about the day" also contains "Save", so tests that find the Log sheet's Save button by name must match exactly.

Apply with:

```bash
sed -i "s/getByRole('button', { name: 'Save' })/getByRole('button', { name: 'Save', exact: true })/g" e2e/detail.spec.ts e2e/meetups.spec.ts e2e/memories.spec.ts
```

- [ ] **Step 2: Write the failing end-to-end tests**

`logMeetup`'s `note` now goes through the day page:

In `e2e/helpers.ts`, replace:

```ts
  if (options.date) await sheet.getByLabel('Pick date').fill(options.date)
  for (const activity of options.activities ?? []) await pickActivity(sheet, activity)
  if (options.photos) await addPhotos(sheet, options.photos)
  if (options.note) await sheet.getByLabel('Note').fill(options.note)
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
}

/** A file for the photo picker (`setInputFiles`). */
```

with:

```ts
  if (options.date) await sheet.getByLabel('Pick date').fill(options.date)
  for (const activity of options.activities ?? []) await pickActivity(sheet, activity)
  if (options.photos) await addPhotos(sheet, options.photos)
  if (!options.note) {
    await sheet.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(sheet).toBeHidden()
    return
  }
  // A note is the day: write it on the day page, then come back to where the sheet was opened.
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
  await expect(sheet).toBeHidden()
  await page.getByRole('textbox', { name: 'The day' }).fill(options.note)
  await page.locator('.day-page__bar').getByRole('button').click()
  await expect(page.getByRole('heading', { level: 1, name: options.type ?? 'Coffee' })).toBeVisible()
  await page.locator('header.navbar .navbar__back').click()
  await expect(page.getByRole('heading', { level: 1, name: options.type ?? 'Coffee' })).toHaveCount(0)
}

/** A file for the photo picker (`setInputFiles`). */
```

The quick log stays as fast as before; "Save and write about the day" opens the day over the new memory; Undo takes the day with it:

In `e2e/day.spec.ts`, replace:

```ts
  })
}

test('opens on its title, with the meetup on Back and who was there', async ({ page }) => {
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
```

with:

```ts
  })
}

test('the quick log is unchanged: no Note, and Save stays put while "Save and write about the day" waits for a friend', async ({
  page,
}) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await expect(sheet.getByLabel('Note')).toHaveCount(0)
  const write = sheet.getByRole('button', { name: 'Save and write about the day' })
  const save = sheet.locator('.sheet__footer .button--block')
  await expect(write).toBeDisabled()
  await expect(save).toHaveText('Pick a friend')
  // Measure once the sheet has finished rising.
  await sheet.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)))
  const before = await save.boundingBox()

  await sheet.getByLabel('Search all friends').fill('Alex')
  await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Alex', exact: true }).click()

  await expect(write).toBeEnabled()
  await expect(save).toHaveText('Save')
  expect(await save.boundingBox(), 'Save did not move').toEqual(before)
  await save.click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('Logged with Alex')
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
})

test('"Save and write about the day" logs the meetup and opens its day; Back lands on the new memory', async ({
  page,
}) => {
  await page.goto('/')
  await addFriend(page, 'Mariya')
  await openFriendPage(page, 'Mariya')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()

  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('Logged with Mariya')
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeFocused()
  await dayBox(page).fill('Tacos')
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  expect((await readMeetups(page))[0].note).toBe('Tacos')
  // Opened from Mariya's page, the memory says her name on its back button.
  await page.getByRole('button', { name: 'Mariya' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Mariya' })).toBeVisible()
})

test('Undo on the "Logged" toast takes the day with it, back to Friends', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByLabel('Search all friends').fill('Alex')
  await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Alex', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
  await dayBox(page).fill('A line I meant to keep')

  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  await expect.poll(async () => (await readMeetups(page)).length).toBe(0)
})

test('opens on its title, with the meetup on Back and who was there', async ({ page }) => {
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
```

The sheet race: the day page takes the keyboard while the Log sheet is still sliding away.

In `e2e/dayKeyboard.spec.ts`, replace:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, logMeetup, openDay, openFriendPage } from './helpers.ts'
import { closeKeyboard, fakeVisualViewport, nextFrames, openKeyboard, tapFocus } from './keyboard.ts'

/** The room the app keeps between the caret's line and the edges of the day page's visible body. */
const MARGIN = 12
```

with:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, logMeetup, openDay, openFriendPage } from './helpers.ts'
import { closeKeyboard, fakeVisualViewport, KEYBOARD, nextFrames, openKeyboard, rootProperty, tapFocus } from './keyboard.ts'

/** The room the app keeps between the caret's line and the edges of the day page's visible body. */
const MARGIN = 12
```

Replace:

```ts
  expect(line.bottom, `${what} is above the helper bar with ${room}px to spare`).toBeLessThanOrEqual(at.footerTop - room)
}

test('the page sits on the keyboard, with "Hide keyboard" on the helper bar', async ({ page }) => {
  await openDayPage(page)
  const hide = page.getByRole('button', { name: 'Hide keyboard' })
```

with:

```ts
  expect(line.bottom, `${what} is above the helper bar with ${room}px to spare`).toBeLessThanOrEqual(at.footerTop - room)
}

test('the Log sheet closing under the day page leaves the keyboard to the day page', async ({ page }) => {
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByLabel('Search all friends').fill('Alex')
  await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name: 'Alex', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
  // The sheet is still sliding away (260ms) when the keyboard comes up on the day page.
  await expect(page.locator('.sheet-layer--closing')).toHaveCount(1)
  await openKeyboard(page)

  await page.waitForTimeout(400)

  await expect(page.locator('.sheet-layer')).toHaveCount(0)
  expect(await rootProperty(page, '--keyboard-inset')).toBe(`${KEYBOARD}px`)
  expect(await rootProperty(page, '--viewport-height')).not.toBe('')
  await expect(page.locator('html')).toHaveClass(/\bkeyboard-open\b/)
})

test('the page sits on the keyboard, with "Hide keyboard" on the helper bar', async ({ page }) => {
  await openDayPage(page)
  const hide = page.getByRole('button', { name: 'Hide keyboard' })
```

The Log sheet's Note tests go (their cases live in `e2e/dayKeyboard.spec.ts` now); the two that used the Note for something else use the friend sheet's Notes and the friend search instead; and the new button steps aside while the keyboard is up.

In `e2e/sheetKeyboard.spec.ts`, replace:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, editMeetup, LARGE_TEXT, logMeetup, openFriendPage } from './helpers.ts'
import { closeKeyboard, fakeVisualViewport, KEYBOARD, nextFrames, openKeyboard, setVisualViewport, tapFocus } from './keyboard.ts'

/** Where a field inside a sheet is, against the part of the sheet's body you can see and its Save bar. */
```

with:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, LARGE_TEXT } from './helpers.ts'
import { closeKeyboard, fakeVisualViewport, KEYBOARD, nextFrames, openKeyboard, setVisualViewport, tapFocus } from './keyboard.ts'

/** Where a field inside a sheet is, against the part of the sheet's body you can see and its Save bar. */
```

Replace:

```ts
  await page.goto('/')
})

test('the meetup Note comes into view when the keyboard opens, before any typing', async ({ page }) => {
  const sheet = await openLogMeetup(page)
  const note = sheet.getByLabel('Note')
  await scrollToTap(note, 'Note')
  await tapFocus(note)

  await openKeyboard(page)

  await expectRevealed(note, 'Note')
})

test('the Note in Edit meetup comes into view when the keyboard opens, before any typing', async ({ page }) => {
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await openFriendPage(page, 'Alex')
  const sheet = await editMeetup(page, /Coffee/)
  const note = sheet.getByLabel('Note')
  await scrollToTap(note, 'Note')
  await tapFocus(note)

  await openKeyboard(page)

  await expectRevealed(note, 'Note')
})

test('the friend Notes field stays in view when the keyboard opens, before any typing', async ({ page }) => {
  const sheet = await openNewFriend(page)
  const notes = sheet.getByLabel('Notes')
```

with:

```ts
  await page.goto('/')
})

test('the friend Notes field stays in view when the keyboard opens, before any typing', async ({ page }) => {
  const sheet = await openNewFriend(page)
  const notes = sheet.getByLabel('Notes')
```

Replace:

```ts
  await expectRevealed(notes, 'Notes')
})

test('the Note comes into view when iOS also pans the visual viewport for the keyboard', async ({ page }) => {
  const sheet = await openLogMeetup(page)
  const note = sheet.getByLabel('Note')
  await scrollToTap(note, 'Note')
  await tapFocus(note)

  const { height, offsetTop } = await openKeyboard(page, { offsetTop: 150 })

  await expectRevealed(note, 'Note')
  // What you see of the page runs from offsetTop to offsetTop + height in layout viewport terms.
  const at = await placement(note)
  expect(at.top, 'The top of Note is on screen').toBeGreaterThanOrEqual(offsetTop)
  expect(at.bottom, 'The bottom of Note is on screen, above the keyboard').toBeLessThanOrEqual(offsetTop + height)
})

test('moving to the meetup Note while the keyboard is up shows all of it above the Save bar', async ({ page }) => {
  const sheet = await openLogMeetup(page)
  await tapFocus(sheet.getByLabel('Search all friends'))
  await openKeyboard(page)
  const note = sheet.getByLabel('Note')
  // So the browser has scrolling to do: if it ever starts with the Note in view, this test checks nothing.
  const before = await placement(note)
  expect(before.bottom, 'The Note starts out of the visible part of the sheet').toBeGreaterThan(before.visibleBottom)

  // As the keyboard's next-field arrow does: a plain focus, with the browser's own scrolling.
  await note.focus()
  await nextFrames(page)

  await expectRevealed(note, 'Note', { room: MARGIN })
})

test('moving to Notes while the keyboard is up brings it into view, before any typing', async ({ page }) => {
  const sheet = await openNewFriend(page)
  const name = sheet.getByLabel('Name', { exact: true })
```

with:

```ts
  await expectRevealed(notes, 'Notes')
})

test('moving to Notes while the keyboard is up brings it into view, before any typing', async ({ page }) => {
  const sheet = await openNewFriend(page)
  const name = sheet.getByLabel('Name', { exact: true })
```

Replace:

```ts
})

test('closing the keyboard leaves the sheet where it was scrolled', async ({ page }) => {
  const sheet = await openLogMeetup(page)
  const body = sheet.locator('.sheet__body')
  const note = sheet.getByLabel('Note')
  await scrollToTap(note, 'Note')
  await tapFocus(note)
  await openKeyboard(page)
  await expectRevealed(note, 'Note')

  // Back up to Who with the Note still focused, then the keyboard goes down: the sheet grows.
  await body.evaluate((element) => {
    element.scrollTop = 0
  })
```

with:

```ts
})

test('closing the keyboard leaves the sheet where it was scrolled', async ({ page }) => {
  const sheet = await openNewFriend(page)
  const body = sheet.locator('.sheet__body')
  const notes = sheet.getByLabel('Notes')
  await scrollToTap(notes, 'Notes')
  await tapFocus(notes)
  await openKeyboard(page)
  await expectRevealed(notes, 'Notes')

  // Back up to the photo with Notes still focused, then the keyboard goes down: the sheet grows.
  await body.evaluate((element) => {
    element.scrollTop = 0
  })
```

Replace:

```ts
  await closeKeyboard(page)
  await nextFrames(page)

  expect(await scrollTop(body), 'Nothing pulls the sheet back to the Note').toBe(0)
  await expect(note).toBeFocused()
})

test('focusing a chip with the keyboard up leaves the scrolled sheet alone', async ({ page }) => {
  const sheet = await openLogMeetup(page)
  const body = sheet.locator('.sheet__body')
  const note = sheet.getByLabel('Note')
  await scrollToTap(note, 'Note')
  await tapFocus(note)
  await openKeyboard(page)
  await body.evaluate((element) => {
    element.scrollTop = 0
```

with:

```ts
  await closeKeyboard(page)
  await nextFrames(page)

  expect(await scrollTop(body), 'Nothing pulls the sheet back to Notes').toBe(0)
  await expect(notes).toBeFocused()
})

test('focusing a chip with the keyboard up leaves the scrolled sheet alone', async ({ page }) => {
  const sheet = await openLogMeetup(page)
  const body = sheet.locator('.sheet__body')
  await tapFocus(sheet.getByLabel('Search all friends'))
  await openKeyboard(page)
  await body.evaluate((element) => {
    element.scrollTop = 0
```

Replace:

```ts
  expect(await scrollTop(body)).toBe(0)
})

test('the Save bar gives up its home indicator room while the keyboard is up', async ({ page }) => {
  // Play a phone with a home indicator: 34px of safe area at the bottom.
  await page.addStyleTag({ content: ':root { --safe-bottom: 34px; }' })
```

with:

```ts
  expect(await scrollTop(body)).toBe(0)
})

test('"Save and write about the day" steps aside while the keyboard is up, and Save stays put', async ({ page }) => {
  const sheet = await openLogMeetup(page)
  const write = sheet.getByRole('button', { name: 'Save and write about the day' })
  const save = sheet.locator('.sheet__footer .button--block')
  await expect(write).toBeVisible()
  await tapFocus(sheet.getByLabel('Search all friends'))
  const before = await save.boundingBox()

  await openKeyboard(page)

  await expect(write).toBeHidden()
  const after = await save.boundingBox()
  if (!before || !after) throw new Error('Save is not on screen')
  expect(after.y + after.height, 'Save sits on the keyboard').toBeCloseTo(before.y + before.height - KEYBOARD, 0)
  await closeKeyboard(page)
  await expect(write).toBeVisible()
})

test('the Save bar gives up its home indicator room while the keyboard is up', async ({ page }) => {
  // Play a phone with a home indicator: 34px of safe area at the bottom.
  await page.addStyleTag({ content: ':root { --safe-bottom: 34px; }' })
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx playwright test --project=iphone e2e/day.spec.ts e2e/dayKeyboard.spec.ts e2e/sheetKeyboard.spec.ts`
Expected: FAIL, `5 failed`: the sheet still has a Note, and there's no "Save and write about the day" button to find.

- [ ] **Step 4: Take the Note out of the sheet and add the button**

In `src/sheets/MeetupSheet.tsx`, replace:

```tsx
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useConfirmDiscard } from '../components/ActionSheet'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { IconCalendar, IconCheck, IconClose, IconSearch } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useFriends, useMeetupPhotoThumbs, useMeetups, useMeetupTypes } from '../data/hooks'
```

with:

```tsx
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useConfirmDiscard } from '../components/ActionSheet'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { IconCalendar, IconCheck, IconClose, IconSearch } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import type { NavState } from '../components/Page'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useFriends, useMeetupPhotoThumbs, useMeetups, useMeetupTypes } from '../data/hooks'
```

Replace:

```tsx
  deleteMeetup,
  NO_PHOTO_CHANGES,
  restoreMeetup,
  updateDay,
  updateMeetup,
  type PhotoChanges,
} from '../db/meetups'
```

with:

```tsx
  deleteMeetup,
  NO_PHOTO_CHANGES,
  restoreMeetup,
  updateMeetup,
  type PhotoChanges,
} from '../db/meetups'
```

Replace:

```tsx
  const today = useToday()
  const confirmDiscard = useConfirmDiscard()
  const toast = useToast()
  const whoId = useId()
  const whatId = useId()
  const whenId = useId()
  const noteId = useId()

  const [start] = useState(() => ({
    friendIds: editing?.friendIds ?? (initial?.presetFriendId ? [initial.presetFriendId] : []),
    typeId: editing?.typeId ?? null,
    date: editing?.date ?? todayISO(),
    note: editing?.note ?? '',
    activities: editing?.activities ?? [],
  }))
  const [friendIds, setFriendIds] = useState<string[]>(start.friendIds)
  const [typeId, setTypeId] = useState<string | null>(start.typeId)
  const [date, setDate] = useState(start.date)
  const [note, setNote] = useState(start.note)
  const [activities, setActivities] = useState<string[]>(start.activities)
  const [activityDraft, setActivityDraft] = useState<string | null>(null)
  const [query, setQuery] = useState('')
```

with:

```tsx
  const today = useToday()
  const confirmDiscard = useConfirmDiscard()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const whoId = useId()
  const whatId = useId()
  const whenId = useId()

  const [start] = useState(() => ({
    friendIds: editing?.friendIds ?? (initial?.presetFriendId ? [initial.presetFriendId] : []),
    typeId: editing?.typeId ?? null,
    date: editing?.date ?? todayISO(),
    activities: editing?.activities ?? [],
  }))
  const [friendIds, setFriendIds] = useState<string[]>(start.friendIds)
  const [typeId, setTypeId] = useState<string | null>(start.typeId)
  const [date, setDate] = useState(start.date)
  const [activities, setActivities] = useState<string[]>(start.activities)
  const [activityDraft, setActivityDraft] = useState<string | null>(null)
  const [query, setQuery] = useState('')
```

Replace:

```tsx
    !sameFriends ||
    effectiveTypeId !== startTypeId ||
    date !== start.date ||
    note !== start.note ||
    activities.join('\n') !== start.activities.join('\n') ||
    !!activityDraft?.trim() ||
    (photos !== null && photos.map((photo) => photo.id).join() !== startPhotoIds.join())
```

with:

```tsx
    !sameFriends ||
    effectiveTypeId !== startTypeId ||
    date !== start.date ||
    activities.join('\n') !== start.activities.join('\n') ||
    !!activityDraft?.trim() ||
    (photos !== null && photos.map((photo) => photo.id).join() !== startPhotoIds.join())
```

Replace:

```tsx
    if (await confirmDiscard(dirty)) onClose()
  }

  async function save() {
    if (savingRef.current || addingPhotos) return
    if (friendIds.length === 0 || !effectiveTypeId) return
    savingRef.current = true
```

with:

```tsx
    if (await confirmDiscard(dirty)) onClose()
  }

  /** Saves the sheet; with `writeDay`, a new meetup then opens its day page, over its Meetup page. */
  async function save(writeDay = false) {
    if (savingRef.current || addingPhotos) return
    if (friendIds.length === 0 || !effectiveTypeId) return
    savingRef.current = true
```

Replace:

```tsx
            order: photos.map((photo) => photo.id),
          }
        : NO_PHOTO_CHANGES
      if (editing) {
        await updateMeetup(editing.id, input, photoChanges)
        // The one-line Note is the start of the day, saved with the day's fields.
        if (note.trim() !== editing.note) await updateDay(editing.id, { note: note.trim() })
        toast({ message: 'Saved' })
      } else {
        const meetup = await addMeetup(input, photoChanges)
        if (note.trim()) await updateDay(meetup.id, { note: note.trim() })
        toast({
          message: `Logged with ${formatNameList(selected.map((f) => f.name))}`,
          actionLabel: 'Undo',
```

with:

```tsx
            order: photos.map((photo) => photo.id),
          }
        : NO_PHOTO_CHANGES
      let added: string | null = null
      if (editing) {
        await updateMeetup(editing.id, input, photoChanges)
        toast({ message: 'Saved' })
      } else {
        const meetup = await addMeetup(input, photoChanges)
        added = meetup.id
        toast({
          message: `Logged with ${formatNameList(selected.map((f) => f.name))}`,
          actionLabel: 'Undo',
```

Replace:

```tsx
      // Photos take real space, so ask Safari to keep the data when the phone runs low (best effort).
      if (photoChanges.add.length > 0) void askToKeepData()
      onClose()
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : "Couldn't save. Please try again.")
    } finally {
```

with:

```tsx
      // Photos take real space, so ask Safari to keep the data when the phone runs low (best effort).
      if (photoChanges.add.length > 0) void askToKeepData()
      onClose()
      if (writeDay && added) {
        // Back from the day lands on the new memory, whose back button says the friend's name when the sheet
        // was opened from their page.
        const presetFriend = initial?.presetFriendId ? friendById.get(initial.presetFriendId) : undefined
        const fromHere: NavState = { backLabel: presetFriend?.name, tab: (location.state as NavState | null)?.tab }
        navigate(`/meetups/${added}`, { state: fromHere })
        navigate(`/meetups/${added}/day`)
      }
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : "Couldn't save. Please try again.")
    } finally {
```

Replace:

```tsx
    }
  }

  async function remove() {
    if (!editing) return
    let deleted
```

with:

```tsx
    }
  }

  const saveDisabled = saving || addingPhotos || friendIds.length === 0 || effectiveTypeId === null

  async function remove() {
    if (!editing) return
    let deleted
```

Replace:

```tsx
              {error}
            </p>
          )}
          <button
            type="button"
            className="button button--primary button--block"
            onClick={save}
            disabled={saving || addingPhotos || friendIds.length === 0 || effectiveTypeId === null}
          >
            {friendIds.length === 0 ? 'Pick a friend' : 'Save'}
          </button>
```

with:

```tsx
              {error}
            </p>
          )}
          {/* Never hidden for a missing friend (only while the keyboard is up), so Save never moves. */}
          {!editing && (
            <button
              type="button"
              className="text-button meetup-sheet__write"
              onClick={() => void save(true)}
              disabled={saveDisabled}
            >
              Save and write about the day
            </button>
          )}
          <button
            type="button"
            className="button button--primary button--block"
            onClick={() => void save()}
            disabled={saveDisabled}
          >
            {friendIds.length === 0 ? 'Pick a friend' : 'Save'}
          </button>
```

Replace:

```tsx
        />
      )}

      <div className="form-section">
        <label htmlFor={noteId} className="form-section__label">
          Note
        </label>
        <input
          id={noteId}
          className="field"
          value={note}
          placeholder="Optional"
          enterKeyHint="done"
          onChange={(event) => {
            setNote(event.target.value)
            setError(null)
          }}
          onKeyDown={blurOnEnter}
        />
      </div>

      {editing && (
        <InsetGroup>
          <Row title="Delete meetup" destructive onClick={remove} />
```

with:

```tsx
        />
      )}

      {editing && (
        <InsetGroup>
          <Row title="Delete meetup" destructive onClick={remove} />
```

In `src/sheets/MeetupSheet.css`, replace:

```css
  cursor: pointer;
}

/* "+ New" activity: the field and its Add button on their own line under the chips. */
.activity-new {
  display: flex;
```

with:

```css
  cursor: pointer;
}

/* "Save and write about the day": a centered text button above Save, in Log meetup only. It's dimmed whenever
   Save is, and hidden only while the keyboard is up, so the friend search keeps its room and Save stays put. */
.meetup-sheet__write {
  align-self: center;
  font-weight: 600;
}
.meetup-sheet__write:disabled {
  opacity: 0.45;
  cursor: default;
}
.keyboard-open .meetup-sheet__write {
  display: none;
}

/* "+ New" activity: the field and its Add button on their own line under the chips. */
.activity-new {
  display: flex;
```

- [ ] **Step 5: Run them to see them pass**

Run: `npx playwright test --project=iphone e2e/day.spec.ts e2e/dayKeyboard.spec.ts e2e/sheetKeyboard.spec.ts e2e/detail.spec.ts e2e/meetupPage.spec.ts`
Expected: `51 passed` (`detail.spec.ts` and `meetupPage.spec.ts` log their "Tacos" through the day page now).

- [ ] **Step 6: Run everything**

Run: `npm test`
Expected: `Test Files  57 passed (57)` and `Tests  667 passed (667)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `141 passed`.

- [ ] **Step 7: Commit**

```bash
git add src/sheets/MeetupSheet.tsx src/sheets/MeetupSheet.css e2e/helpers.ts e2e/day.spec.ts e2e/dayKeyboard.spec.ts e2e/sheetKeyboard.spec.ts e2e/detail.spec.ts e2e/meetups.spec.ts e2e/memories.spec.ts
git commit -F - <<'EOF'
feat: Save and write about the day in the Log sheet, which no longer has a Note

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: The Meetup page reads the day back; the history snippet, the tab bar rule and the toast position

**Files:**
- Create: `src/components/DayView.tsx`, `src/components/DayView.css`
- Modify: `src/screens/MeetupScreen.tsx`, `src/screens/MeetupScreen.css`, `src/screens/FriendDetailScreen.tsx`, `src/components/TabBar.tsx`, `src/components/Toast.css`, `src/screens/DayScreen.tsx`, `e2e/helpers.ts` (`openDay` taps the day row)
- Test: `e2e/meetupPage.spec.ts`, `e2e/detail.spec.ts`, `e2e/day.spec.ts`

- [ ] **Step 1: Write the failing end-to-end tests**

`openDay` taps the Meetup page's day row now:

In `e2e/helpers.ts`, replace:

```ts
  return meetups.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
}

/** On a Meetup page: opens its day page. */
export async function openDay(page: Page) {
  await page.evaluate(() => {
    location.hash = `${location.hash}/day`
  })
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
}
```

with:

```ts
  return meetups.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
}

/** On a Meetup page: opens its day page from the day row ("Write about the day" or "Edit the day"). */
export async function openDay(page: Page) {
  await page.getByRole('link', { name: /^(Write about|Edit) the day/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
}
```

The Meetup page shows "The day" instead of "Note", reads a day back, and shows the weather and how it felt (never in history rows):

In `e2e/meetupPage.spec.ts`, replace:

```ts
import { expect, test } from '@playwright/test'
import { addFriend, logMeetup, openFriendPage, tinyPhoto } from './helpers.ts'

/** Today as the app writes it in the current year ("Sat, Oct 3"). */
function todayLabel(): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())
}

test('shows who, what you did, the note and the photos', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await addFriend(page, 'Sam')
```

with:

```ts
import { expect, test } from '@playwright/test'
import { addFriend, logMeetup, openDay, openFriendPage, tinyPhoto } from './helpers.ts'

/** Today as the app writes it in the current year ("Sat, Oct 3"). */
function todayLabel(): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())
}

test('shows who, what you did, the day and the photos', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await addFriend(page, 'Sam')
```

Replace:

```ts
    'Karaoke',
    'Pottery class',
  ])
  await expect(page.getByRole('region', { name: 'Note' })).toContainText('Tacos')
  const photos = page.getByRole('region', { name: 'Photos' }).getByRole('img')
  await expect(photos).toHaveCount(2)
  await expect(photos.nth(1)).toHaveAccessibleName('Photo 2 of 2')
```

with:

```ts
    'Karaoke',
    'Pottery class',
  ])
  await expect(page.getByRole('region', { name: 'The day' })).toContainText('Tacos')
  await expect(page.getByRole('link', { name: 'Edit the day' })).toBeVisible()
  const photos = page.getByRole('region', { name: 'Photos' }).getByRole('img')
  await expect(photos).toHaveCount(2)
  await expect(photos.nth(1)).toHaveAccessibleName('Photo 2 of 2')
```

Replace:

```ts
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  await expect(page.getByText('Upcoming', { exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'With' }).getByRole('link')).toContainText(['Alex'])
  for (const name of ['Activities', 'Note', 'Photos']) {
    await expect(page.getByRole('region', { name })).toHaveCount(0)
  }
})

test('redirects to Friends for an unknown meetup', async ({ page }) => {
```

with:

```ts
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  await expect(page.getByText('Upcoming', { exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'With' }).getByRole('link')).toContainText(['Alex'])
  for (const name of ['Activities', 'The day', 'How it felt', 'Photos']) {
    await expect(page.getByRole('region', { name, exact: true })).toHaveCount(0)
  }
  await expect(page.getByRole('link', { name: /^Write about the day/ })).toHaveAccessibleName(
    'Write about the day Places, what happened, how it felt',
  )
})

test('reads the day back: places in order with their times, paid tags, headings and prose', async ({ page }) => {
  await page.goto('/')
  for (const name of ['Jessie', 'Sam Lee', 'Sam Park']) await addFriend(page, name)
  await logMeetup(page, ['Jessie', 'Sam Lee', 'Sam Park'], {
    type: 'Meal',
    note: ['Rainy', 'Plan:', '@Cafe 10:30', 'Coffee', 'Jessie paid', '', '@Park', '@Bar 7-9pm', 'Sam paid', '', 'Home', '', '', 'Tired'].join(
      '\n',
    ),
  })
  await openFriendPage(page, 'Jessie')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  const day = page.getByRole('region', { name: 'The day' })

  const places = day.getByRole('list', { name: 'Places, 3 stops' })
  await expect(places.getByRole('heading', { level: 3 })).toHaveText(['Cafe', 'Park', 'Bar'])
  await expect(places.getByRole('listitem').nth(0)).toContainText('10:30')
  await expect(places.getByRole('listitem').nth(0).getByText('At 10:30', { exact: false })).toBeAttached()
  await expect(places.getByRole('listitem').nth(2).getByText(/^From 7:00.PM to 9:00.PM\.$/)).toBeAttached()
  await expect(day.getByRole('heading', { level: 3, name: 'Plan' })).toBeVisible()
  // "Jessie paid" names one friend, so it gets her face; "Sam paid" fits two, so it gets none.
  const jessiePaid = places.getByRole('listitem').nth(0).locator('.paid-tag')
  await expect(jessiePaid).toHaveText(/Jessie paid$/)
  await expect(jessiePaid.locator('.avatar')).toHaveCount(1)
  await expect(places.getByRole('listitem').nth(2).locator('.paid-tag .avatar')).toHaveCount(0)
  await expect(day.locator('.day-prose')).toHaveText([/^Rainy$/, /^Home\s*Tired$/])
  await expect(day.locator('.day-gap')).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'How it felt' })).toHaveCount(0)
})

test('shows the weather in the hero and how it felt, and never in the history', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { type: 'Meal' })
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await openDay(page)
  await page.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Windy' }).click()
  await page.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Rainy' }).click()
  await page.getByRole('group', { name: 'Mood' }).getByRole('button', { name: 'Good' }).click()
  await page.getByRole('textbox', { name: 'How it felt, in your words' }).fill('Easy and warm.\nWould go again.')
  await page.getByRole('button', { name: 'Meal' }).click()

  await expect(page.getByText(`${todayLabel()} · 🌧️ Rainy, 🌬️ Windy`, { exact: true })).toBeVisible()
  const felt = page.getByRole('region', { name: 'How it felt' })
  await expect(felt.getByText('Mood: Good')).toBeVisible()
  await expect(felt).toContainText('Easy and warm.\nWould go again.')
  await expect(page.getByRole('region', { name: 'The day' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Edit the day' })).toBeVisible()

  await page.getByRole('button', { name: 'Alex' }).click()
  const row = page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ })
  await expect(row).not.toContainText('Rainy')
  await expect(row).not.toContainText('Good')
})

test('redirects to Friends for an unknown meetup', async ({ page }) => {
```

History rows show the day's first places, or its first line cut at 80 characters:

In `e2e/detail.spec.ts`, replace:

```ts
  await expect(history.getByRole('link', { name: /Coffee/ }).locator('img')).toHaveCount(0)
})

test('logs from the friend page with them preselected', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
```

with:

```ts
  await expect(history.getByRole('link', { name: /Coffee/ }).locator('img')).toHaveCount(0)
})

test('history rows show the day’s first places, or its first line cut at 80 characters', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await addFriend(page, 'Sam')
  await logMeetup(page, ['Alex', 'Sam'], { type: 'Meal', note: '@Cafe 10:30\nCoffee\n@Park\n@Bar 7pm\n@cafe\n@Gym' })
  const long = 'We walked all the way along the river to the old bridge and back again before dinner'
  await logMeetup(page, ['Alex'], { type: 'Drinks', note: `${long}\nSecond line` })
  await page.getByRole('link', { name: /Alex/ }).click()

  const history = page.getByRole('region', { name: 'History' })
  await expect(history.getByRole('link', { name: /Meal/ })).toHaveAccessibleName(
    /with Sam · Cafe, Park, Bar and 1 more$/,
  )
  await expect(history.getByRole('link', { name: /Drinks/ })).toHaveAccessibleName(
    / · We walked all the way along the river to the old bridge and back again before…$/,
  )
})

test('logs from the friend page with them preselected', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
```

No tab bar on the day page, the toast 8px above the helper bar, the day row after a quick log, and an old note from a version 4 backup:

In `e2e/day.spec.ts`, replace:

```ts
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
})

test('"Save and write about the day" logs the meetup and opens its day; Back lands on the new memory', async ({
```

with:

```ts
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Write about the day/ })).toBeVisible()
})

test('"Save and write about the day" logs the meetup and opens its day; Back lands on the new memory', async ({
```

Replace:

```ts
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('Logged with Mariya')
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeFocused()
  await dayBox(page).fill('Tacos')
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
```

with:

```ts
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('status')).toContainText('Logged with Mariya')
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeFocused()
  // The toast sits 8px above the helper bar.
  const toast = await page.locator('.toast').boundingBox()
  const bar = await page.locator('.day-page__footer').boundingBox()
  if (!toast || !bar) throw new Error('The toast or the helper bar is not on screen')
  expect(Math.abs(toast.y + toast.height - (bar.y - 8)), 'Within a pixel').toBeLessThanOrEqual(1)
  await dayBox(page).fill('Tacos')
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
```

Replace:

```ts
  await openMealDay(page)

  await expect(page).toHaveTitle('The day · Friend Tracker')
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeFocused()
  await expect(page.getByText('Sat, Oct 3 · with Mariya, Jessie and Brandon', { exact: true })).toBeVisible()
  for (const name of ['Weather', 'The day', 'How it felt']) {
```

with:

```ts
  await openMealDay(page)

  await expect(page).toHaveTitle('The day · Friend Tracker')
  await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0)
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeFocused()
  await expect(page.getByText('Sat, Oct 3 · with Mariya, Jessie and Brandon', { exact: true })).toBeVisible()
  for (const name of ['Weather', 'The day', 'How it felt']) {
```

Replace:

```ts
  await expect(page.getByRole('alert')).toHaveText('This box is full.')
})

test('opened directly, Back goes to its meetup; an unknown one goes to Friends', async ({ page }) => {
  await page.goto('/')
  await logMeal(page)
```

with:

```ts
  await expect(page.getByRole('alert')).toHaveText('This box is full.')
})

test('an old note is already the day: shown under The day, previewed in history, and in the box', async ({ page }) => {
  await page.goto('/#/settings')
  const backup = {
    app: 'friend-tracker',
    version: 4,
    exportedAt: '2026-09-13T12:00:00.000Z',
    groups: [],
    meetupTypes: [{ id: 'type-meal', name: 'Meal', emoji: '🍽️', order: 0 }],
    friends: [
      {
        id: 'f-sam',
        name: 'Sam',
        groupId: null,
        photo: null,
        notes: '',
        likes: [],
        dislikes: [],
        birthday: null,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    meetups: [
      {
        id: 'm-old',
        date: '2026-09-12',
        typeId: 'type-meal',
        friendIds: ['f-sam'],
        note: 'Tacos\nThen karaoke',
        activities: ['Karaoke'],
        createdAt: '2026-09-12T12:00:00.000Z',
      },
    ],
    meetupPhotos: [],
  }
  await page.locator('input[type="file"]').setInputFiles({
    name: 'friend-tracker-backup-2026-09-13.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup)),
  })
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')

  await openFriendPage(page, 'Sam')
  const row = page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ })
  await expect(row).toHaveAccessibleName(/ · Karaoke · Tacos$/)
  await row.click()
  const day = page.getByRole('region', { name: 'The day' })
  await expect(day.locator('.day-line')).toHaveText(['Tacos', 'Then karaoke'])
  await openDay(page)
  await expect(dayBox(page)).toHaveValue('Tacos\nThen karaoke')
  expect((await readMeetups(page))[0]).toMatchObject({ note: 'Tacos\nThen karaoke', activities: ['Karaoke'], weather: [] })
})

test('opened directly, Back goes to its meetup; an unknown one goes to Friends', async ({ page }) => {
  await page.goto('/')
  await logMeal(page)
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx playwright test --project=iphone e2e/meetupPage.spec.ts e2e/detail.spec.ts e2e/day.spec.ts`
Expected: FAIL. Every test that opens a day page times out looking for the "Write about the day" or "Edit the day" link, and the others find "Note" instead of "The day" or the whole note in a history row.

- [ ] **Step 3: Add the day view**

Create `src/components/DayView.tsx`:

```tsx
import { clockStyle, formatDayTime, speakTime, type ClockStyle } from '../lib/clock'
import type { DayLine, DayPart, DayStop } from '../lib/dayText'
import { paidBy } from '../lib/payers'
import { plural } from '../lib/text'
import type { Friend } from '../types'
import { Avatar } from './Avatar'
import './DayView.css'

interface DayViewProps {
  /** The day as readDay reads it. */
  parts: DayPart[]
  /** The friends on the meetup, for the face beside "Jessie paid". */
  people: Friend[]
}

/**
 * The day read back on the Meetup page: places as a timeline, headings, and the rest as prose, all in the
 * owner's words. Reading only changes how the text looks, never the text.
 */
export function DayView({ parts, people }: DayViewProps) {
  const style = clockStyle()
  return (
    <div className="day-view">
      {parts.map((part, index) => {
        if (part.kind === 'heading') {
          return (
            <h3 key={index} className="day-heading">
              {part.text}
            </h3>
          )
        }
        if (part.kind === 'timeline') {
          return (
            <ol key={index} className="day-timeline" aria-label={`Places, ${plural(part.stops.length, 'stop')}`}>
              {part.stops.map((stop, stopIndex) => (
                <DayStopView key={stopIndex} stop={stop} people={people} style={style} />
              ))}
            </ol>
          )
        }
        return (
          <div key={index} className="day-prose">
            {part.lines.map((line, lineIndex) =>
              line.kind === 'gap' ? (
                <div key={lineIndex} className="day-gap" aria-hidden="true" />
              ) : (
                <DayLineView key={lineIndex} line={line} people={people} />
              ),
            )}
          </div>
        )
      })}
    </div>
  )
}

function DayStopView({ stop, people, style }: { stop: DayStop; people: Friend[]; style: ClockStyle }) {
  const spoken = speakTime(stop, style)
  return (
    <li className="day-stop">
      {/* The time column is for the eye; VoiceOver hears the sentence after the place. */}
      <div className="day-stop__time numeric" aria-hidden="true">
        {stop.start && <span>{formatDayTime(stop.start, style)}</span>}{' '}
        {stop.end && <span>to {formatDayTime(stop.end, style)}</span>}
      </div>
      <div className="day-stop__main">
        <h3 className="day-stop__place">{stop.place}</h3>
        {spoken && <p className="visually-hidden">{spoken}</p>}
        {stop.lines.map((line, index) => (
          <DayLineView key={index} line={line} people={people} />
        ))}
      </div>
    </li>
  )
}

function DayLineView({ line, people }: { line: DayLine; people: Friend[] }) {
  if (line.kind === 'text') return <p className="day-line">{line.text}</p>
  const friend = paidBy(line.who, people)
  return (
    <p className="day-line">
      <span className="paid-tag">
        <span aria-hidden="true">🧾</span>
        {friend && <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={20} />}
        {line.text}
      </span>
    </p>
  )
}
```

Create `src/components/DayView.css`:

```css
/* The day read back: one Paper White box, its parts divided by hairlines. A size container, so at large text
   sizes the times move above the places. */
.day-view {
  container-type: inline-size;
  padding: 0 var(--space-4);
  border-radius: var(--radius-group);
  background: var(--surface);
}
.day-view > * + * {
  border-top: 0.5px solid var(--separator);
}

/* A timeline: a 7em Subhead time column, then the place and its lines. No rails, dots or stripes. */
.day-timeline {
  margin: 0;
  padding: 0;
  list-style: none;
}
.day-stop {
  position: relative;
  display: grid;
  grid-template-columns: calc(7 * var(--text-subhead)) minmax(0, 1fr);
  column-gap: var(--space-3);
  min-height: 52px;
  padding: var(--space-3) 0;
}
/* A hairline above each stop after the first, starting at the place column. */
.day-stop + .day-stop::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  left: calc(7 * var(--text-subhead) + var(--space-3));
  border-top: 0.5px solid var(--separator);
}
.day-stop__time {
  padding-top: 0.15em;
  color: var(--ink-2);
  font-size: var(--text-subhead);
  line-height: 1.35;
  text-align: right;
}
.day-stop__time span {
  display: block;
}
.day-stop__place {
  margin: 0;
  font-size: var(--text-body);
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.day-line {
  max-width: 65ch;
  margin: var(--space-1) 0 0;
  overflow-wrap: anywhere;
}

/* Large text: once the box is narrower than 16em (about 21px text on an iPhone, so the largest standard sizes and
   every accessibility size) the time sits above the place, on one line, and the place takes the full width. */
@container (width < 16em) {
  .day-stop {
    grid-template-columns: minmax(0, 1fr);
  }
  .day-stop + .day-stop::before {
    left: 0;
  }
  .day-stop__time {
    padding-top: 0;
    font-size: var(--text-footnote);
    font-weight: 600;
    text-align: left;
  }
  .day-stop__time span {
    display: inline;
  }
}

.day-heading {
  margin: 0;
  padding: var(--space-3) 0 var(--space-2);
  color: var(--ink-2);
  font-size: var(--text-footnote);
  font-weight: 600;
}

/* Prose: one paragraph per line, with one small gap for any run of blank lines. */
.day-prose {
  padding: var(--space-3) 0;
}
.day-prose > .day-line:first-child {
  margin-top: 0;
}
.day-gap {
  height: 0.75em;
}

/* "Jessie paid": a read-only Linen tag, never a control. */
.paid-tag {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  max-width: 100%;
  min-height: 28px;
  padding: 0.15rem 0.6rem;
  border-radius: 1em;
  background: var(--surface-2);
  color: var(--ink);
  font-size: var(--text-subhead);
  font-weight: 500;
  overflow-wrap: anywhere;
}
```

- [ ] **Step 4: Show the day, how it felt and the day row on the Meetup page**

Replace the whole of `src/screens/MeetupScreen.tsx`:

```tsx
import { Fragment, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { DayView } from '../components/DayView'
import { InsetGroup, Row, Section } from '../components/InsetGroup'
import { Page, type NavState } from '../components/Page'
import { PhotoViewer } from '../components/PhotoViewer'
import { useFriends, useMeetup, useMeetupPhotoThumbs, useMeetupTypes } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import { formatDate } from '../lib/dates'
import { isDayEmpty, readDay } from '../lib/dayText'
import { feelingsApply, moodInfo } from '../lib/moods'
import { weatherInfo } from '../lib/weather'
import { useSheets } from '../sheets/sheetsContext'
import type { Friend } from '../types'
import './MeetupScreen.css'

/** The memory view of one meetup: what, when, who, what you did, the day, how it felt and the photos. */
export function MeetupScreen() {
  const { id } = useParams()
  const meetup = useMeetup(id)
  const photos = useMeetupPhotoThumbs(id)
  const friends = useFriends()
  const types = useMeetupTypes()
  const today = useToday()
  const location = useLocation()
  const navigate = useNavigate()
  const { openMeetupSheet } = useSheets()
  const withId = useId()
  const leftRef = useRef(false)
  // The photo open in the viewer, by position. Its thumbnail takes focus back when the viewer closes.
  const [viewing, setViewing] = useState<number | null>(null)
  const thumbnails = useRef<(HTMLButtonElement | null)[]>([])

  // Deleted from the sheet (or never there): go back, like the friend page does for a deleted friend.
  useEffect(() => {
    if (meetup !== null || leftRef.current) return
    leftRef.current = true
    if (location.key === 'default') navigate('/', { replace: true })
    else navigate(-1)
  }, [meetup, location.key, navigate])

  if (!meetup || !photos || !friends || !types) return null

  const type = types.find((t) => t.id === meetup.typeId)
  const title = type?.name ?? 'Meetup'
  const friendById = new Map(friends.map((f) => [f.id, f] as const))
  const people = meetup.friendIds.map((friendId) => friendById.get(friendId)).filter((f): f is Friend => !!f)
  // A friend opened from here says this meetup on its back button, and keeps the tab this page came from.
  const fromHere: NavState = { backLabel: title, tab: (location.state as NavState | null)?.tab }
  const describePhoto = (index: number) =>
    `Photo ${index + 1} of ${photos.length}, ${title}, ${formatDate(meetup.date, today)}`
  const dayParts = readDay(meetup.note)
  const mood = moodInfo(meetup.mood)
  const showFelt = feelingsApply(meetup, today) && (mood !== null || meetup.feelings.trim() !== '')
  const dayEmpty = isDayEmpty(meetup)

  function closeViewer() {
    if (viewing !== null) thumbnails.current[viewing]?.focus()
    setViewing(null)
  }

  return (
    <Page
      title={title}
      back={{ label: 'Back', fallback: '/' }}
      pushed
      actions={
        <button type="button" className="text-button" onClick={() => openMeetupSheet({ meetup })}>
          Edit
        </button>
      }
      hero={
        <div className="meetup-hero">
          <span className="meetup-hero__badge" aria-hidden="true">
            {type?.emoji ?? '✨'}
          </span>
          <h1 className="meetup-hero__title">{title}</h1>
          <p className="meetup-hero__date">
            {formatDate(meetup.date, today)}
            {meetup.weather.length > 0 && ' · '}
            {meetup.weather.map((key, index) => {
              const { emoji, label } = weatherInfo(key)
              return (
                <Fragment key={key}>
                  {index > 0 && ', '}
                  <span aria-hidden="true">{emoji} </span>
                  {label}
                </Fragment>
              )
            })}
            {meetup.date > today && <span className="upcoming-badge">Upcoming</span>}
          </p>
          {people.length > 0 && (
            <div className="meetup-hero__with">
              <span id={withId} className="meetup-hero__with-label">
                With
              </span>
              <ul className="meetup-hero__people" aria-labelledby={withId}>
                {people.map((friend) => (
                  <li key={friend.id}>
                    <Link to={`/friends/${friend.id}`} state={fromHere} className="person-chip">
                      <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={28} />
                      {friend.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      }
    >
      {meetup.activities.length > 0 && (
        <Section title="Activities">
          <ul className="meetup-tags">
            {meetup.activities.map((activity) => (
              <li key={activity} className="meetup-tag">
                {activity}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {dayParts.length > 0 && (
        <Section title="The day">
          <DayView parts={dayParts} people={people} />
        </Section>
      )}

      {showFelt && (
        <Section title="How it felt">
          <div className="felt-box">
            {mood && (
              <p className="felt-box__mood">
                <span className="felt-box__face" aria-hidden="true">
                  {mood.emoji}
                </span>
                <span>
                  <span className="visually-hidden">Mood: </span>
                  {mood.label}
                </span>
              </p>
            )}
            {meetup.feelings.trim() !== '' && <p className="felt-box__words">{meetup.feelings}</p>}
          </div>
        </Section>
      )}

      <InsetGroup>
        <Row
          to={`/meetups/${meetup.id}/day`}
          leading={
            <span className="emoji-badge" aria-hidden="true">
              📝
            </span>
          }
          title={dayEmpty ? 'Write about the day' : 'Edit the day'}
          subtitle={dayEmpty ? 'Places, what happened, how it felt' : undefined}
          accent={dayEmpty}
          chevron
        />
      </InsetGroup>

      {photos.length > 0 && (
        <Section title="Photos">
          <ul className="photo-grid">
            {photos.map((photo, index) => (
              <li key={photo.id} className="photo-tile">
                <button
                  ref={(element) => {
                    thumbnails.current[index] = element
                  }}
                  type="button"
                  className="photo-tile__open"
                  onClick={() => setViewing(index)}
                >
                  <img
                    className="photo-tile__image"
                    src={photo.thumb}
                    alt={`Photo ${index + 1} of ${photos.length}`}
                  />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {viewing !== null && (
        <PhotoViewer
          photos={photos}
          index={Math.min(viewing, photos.length - 1)}
          onIndexChange={setViewing}
          onClose={closeViewer}
          describe={describePhoto}
        />
      )}
    </Page>
  )
}
```

In `src/screens/MeetupScreen.css`, replace:

```css
  overflow-wrap: anywhere;
}

.meetup-note {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-group);
  background: var(--surface);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
```

with:

```css
  overflow-wrap: anywhere;
}

/* How it felt: the face and its word, then your words, in a Paper White box. No colors and no scale. */
.felt-box {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-group);
  background: var(--surface);
}
.felt-box__mood {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
  font-weight: 600;
}
.felt-box__face {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--surface-2);
  font-size: 26px;
  line-height: 1;
}
.felt-box__words {
  max-width: 65ch;
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
```

- [ ] **Step 5: Use the snippet in history rows**

In `src/screens/FriendDetailScreen.tsx`, replace:

```tsx
import { useToday } from '../hooks/useToday'
import { describeNextBirthday, formatBirthday } from '../lib/birthdays'
import { daysBetween, formatDate, formatMonthYear, yearOf } from '../lib/dates'
import { formatNameList, formatSince } from '../lib/text'
import { useSheets } from '../sheets/sheetsContext'
import { allTimeCountsByFriend, countsByFriendForYear, monthlyCounts } from '../stats/counts'
```

with:

```tsx
import { useToday } from '../hooks/useToday'
import { describeNextBirthday, formatBirthday } from '../lib/birthdays'
import { daysBetween, formatDate, formatMonthYear, yearOf } from '../lib/dates'
import { daySnippet } from '../lib/dayText'
import { formatNameList, formatSince } from '../lib/text'
import { useSheets } from '../sheets/sheetsContext'
import { allTimeCountsByFriend, countsByFriendForYear, monthlyCounts } from '../stats/counts'
```

Replace:

```tsx
                      formatDate(meetup.date, today),
                      others.length > 0 ? `with ${formatNameList(others)}` : null,
                      meetup.activities.length > 0 ? meetup.activities.join(', ') : null,
                      meetup.note || null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
```

with:

```tsx
                      formatDate(meetup.date, today),
                      others.length > 0 ? `with ${formatNameList(others)}` : null,
                      meetup.activities.length > 0 ? meetup.activities.join(', ') : null,
                      daySnippet(meetup.note),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
```

- [ ] **Step 6: Hide the tab bar on the day page, and lift the toast above its helper bar**

In `src/components/TabBar.tsx`, replace:

```tsx
  { to: '/settings', label: 'Settings', Icon: IconSettings, matches: (path: string) => path.startsWith('/settings') },
]

export function TabBar() {
  const location = useLocation()
  const { pathname } = location
  const originTab = (location.state as NavState | null)?.tab
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ to, label, Icon, matches }) => {
```

with:

```tsx
  { to: '/settings', label: 'Settings', Icon: IconSettings, matches: (path: string) => path.startsWith('/settings') },
]

/** The day page fills the screen, so it has no tab bar. */
const DAY_PAGE = /^\/meetups\/[^/]+\/day$/

export function TabBar() {
  const location = useLocation()
  const { pathname } = location
  const originTab = (location.state as NavState | null)?.tab
  if (DAY_PAGE.test(pathname)) return null
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ to, label, Icon, matches }) => {
```

In `src/components/Toast.css`, replace:

```css
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
```

with:

```css
  pointer-events: none;
}

/* On the day page the toast sits 8px above the helper bar, which rides on the keyboard (see DayScreen). */
.day-open .toast-region {
  bottom: calc(var(--keyboard-inset, 0px) + var(--day-bar-height, 0px) + var(--space-2));
}

.toast {
  display: flex;
  align-items: center;
```

In `src/screens/DayScreen.tsx`, replace:

```tsx
  const bodyRef = useRef<HTMLDivElement>(null)
  const dayRef = useRef<HTMLTextAreaElement>(null)
  const placeRef = useRef<HTMLInputElement>(null)
  const weatherId = useId()
  const dayId = useId()
  const hintId = useId()
```

with:

```tsx
  const bodyRef = useRef<HTMLDivElement>(null)
  const dayRef = useRef<HTMLTextAreaElement>(null)
  const placeRef = useRef<HTMLInputElement>(null)
  const footerRef = useRef<HTMLDivElement>(null)
  const weatherId = useId()
  const dayId = useId()
  const hintId = useId()
```

Replace:

```tsx
    if (status.gone) onGone()
  }, [status.gone, onGone])

  // A newer stored value (another tab, a backup restore) only goes into a field that isn't focused and has
  // nothing waiting to save, so nothing changes under your thumb.
  useEffect(() => {
```

with:

```tsx
    if (status.gone) onGone()
  }, [status.gone, onGone])

  // The toast sits 8px above the helper bar here (Toast.css): mark the page and publish the bar's height.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add('day-open')
    const observer = new ResizeObserver(([entry]) => {
      root.style.setProperty('--day-bar-height', `${Math.ceil(entry.borderBoxSize[0].blockSize)}px`)
    })
    if (footerRef.current) observer.observe(footerRef.current)
    return () => {
      observer.disconnect()
      root.classList.remove('day-open')
      root.style.removeProperty('--day-bar-height')
    }
  }, [])

  // A newer stored value (another tab, a backup restore) only goes into a field that isn't focused and has
  // nothing waiting to save, so nothing changes under your thumb.
  useEffect(() => {
```

Replace:

```tsx
        <p className="day-page__footnote">Saves as you type, and stays on this iPhone.</p>
      </div>

      <div className="day-page__footer">
        {status.failed && (
          <p className="field-error" role="alert">
            {SAVE_FAILED}
```

with:

```tsx
        <p className="day-page__footnote">Saves as you type, and stays on this iPhone.</p>
      </div>

      <div ref={footerRef} className="day-page__footer">
        {status.failed && (
          <p className="field-error" role="alert">
            {SAVE_FAILED}
```

- [ ] **Step 7: Run them to see them pass**

Run: `npx playwright test --project=iphone e2e/meetupPage.spec.ts e2e/detail.spec.ts e2e/day.spec.ts e2e/shell.spec.ts`
Expected: `36 passed`.

- [ ] **Step 8: Run everything**

Run: `npm test`
Expected: `Test Files  57 passed (57)` and `Tests  667 passed (667)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `145 passed`.

- [ ] **Step 9: Commit**

```bash
git add src/components/DayView.tsx src/components/DayView.css src/screens/MeetupScreen.tsx src/screens/MeetupScreen.css src/screens/FriendDetailScreen.tsx src/components/TabBar.tsx src/components/Toast.css src/screens/DayScreen.tsx e2e/helpers.ts e2e/meetupPage.spec.ts e2e/detail.spec.ts e2e/day.spec.ts
git commit -F - <<'EOF'
feat: the Meetup page reads the day back, and history rows show its first places

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: The owner's example end to end, screenshots, DESIGN.md and the planning notes

**Files:**
- Modify: `e2e/day.spec.ts`, `e2e/screenshots.spec.ts`, `DESIGN.md`, `docs/superpowers/specs/2026-10-05-meetup-debrief-design.md`

- [ ] **Step 1: Write the acceptance tests**

The owner's example, typed through the helpers on Sat, Oct 3, 2026 at 9:52 PM, must store exactly the spec's record (fixture A, apart from ids and `createdAt`) and read back as the spec draws it; the message pasted byte for byte must be stored as pasted; a backup must keep the day, its activities and its photos.

In `e2e/day.spec.ts`, replace:

```ts
import { expect, test, type Page } from '@playwright/test'
import {
  addFriend,
  enterPin,
  lockHeading,
  logMeetup,
  openDay,
  openFriendPage,
  readMeetups,
  reopenAfterAWhile,
  seedAppLock,
} from './helpers.ts'

// Most tests add three friends and log a meetup first, so they get more time than most.
```

with:

```ts
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { OWNER_DAY_TYPED, OWNER_FEELINGS, OWNER_MESSAGE } from '../src/test/dayFixtures.ts'
import {
  addFriend,
  editMeetup,
  enterPin,
  goToTab,
  lockHeading,
  logMeetup,
  openDay,
  openFriendPage,
  pickActivity,
  readMeetups,
  reopenAfterAWhile,
  seedAppLock,
  tinyPhoto,
} from './helpers.ts'

// Most tests add three friends and log a meetup first, so they get more time than most.
```

Replace:

```ts
  await page.goto('/#/meetups/nope/day')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})
```

with:

```ts
  await page.goto('/#/meetups/nope/day')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})

test('the owner’s example, written on the walk home, reads back as their day', async ({ page }) => {
  test.setTimeout(120_000)
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
  for (const name of FRIENDS) await addFriend(page, name)

  // 1. Friends tab, "+ Log meetup": Mariya, Jessie and Brandon under Recent, Meal, Today, Movie and Shopping.
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  const recent = sheet.getByRole('group', { name: 'Recent friends' })
  for (const name of FRIENDS) await recent.getByRole('button', { name }).click()
  await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
  await expect(sheet.getByRole('button', { name: 'Today' })).toHaveAttribute('aria-pressed', 'true')
  await pickActivity(sheet, 'Movie')
  await pickActivity(sheet, 'Shopping')

  // 2. "Save and write about the day": the toast, and the day page slides in.
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
  await expect(page.getByRole('status')).toContainText('Logged with Mariya, Jessie and Brandon')
  await expect(page.getByRole('button', { name: 'Meal' })).toBeVisible()
  await expect(page.getByText('Sat, Oct 3 · with Mariya, Jessie and Brandon', { exact: true })).toBeVisible()

  // 3. "Rainy day".
  await page.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Rainy' }).click()

  // 4. "Locations:" and the story, one place at a time.
  const place = async (text: string) => {
    await helpers(page).getByRole('button', { name: 'Add a place' }).click()
    await helpers(page).getByRole('textbox', { name: 'Place and time' }).fill(text)
    await helpers(page).getByRole('textbox', { name: 'Place and time' }).press('Enter')
    await expect(dayBox(page)).toBeFocused()
  }
  const type = (text: string) => page.keyboard.insertText(text)
  const paid = async (name: string) => {
    await helpers(page).getByRole('button', { name: 'Paid' }).click()
    await helpers(page).getByRole('group', { name: 'Who paid?' }).getByRole('button', { name }).click()
  }
  await place('nonstopstyle 10:30')
  await type('Took haircut with dyno')
  await place('strand bookstore 11:30')
  await place('Sammy L coffee 11:53')
  await type('Read book and vibe code until 2:50')
  await place('Blue willow 3:30')
  await type('Walked to mariya at blue willow. Then Jessie came, then Brandon (late) due to construction')
  await page.keyboard.press('Enter')
  await type('Ordered Kong pao chicken (salty) garlic string beans, szcheuan beef and jasmine dragon pearl tea.')
  await paid('Jessie')
  await expect(dayBox(page)).toHaveValue(/\nJessie paid$/)
  await place('hey tea Broadway')
  await type('Walked to hey tea (got the king jasmine honeydew)')
  await place('amc 34 5:30')
  await type('Walked to amc and watch prime time(didn’t like it)')
  await place('holister + @h&m 7:30 - ~8:10')
  await type('Stalled time for dinner at holister and H&M')
  await place('seoulSaloon 8:30')
  for (const line of [
    'Then walked to dinner @seoulsaloon',
    'Ate rose tteboki, fried chicken(chicken nuggets?), octopus kimbap',
    'Talked about relationship + movie',
    'Jessie Brandon age gap like 3 years',
  ]) {
    await type(line)
    await page.keyboard.press('Enter')
  }
  await type('Mariya like 3 years older 1/2 younger')
  await paid('Mariya')
  await page.keyboard.press('Enter')
  await type('Split ways went home')
  await expect(dayBox(page)).toHaveValue(OWNER_DAY_TYPED)

  // 5. "How I felt:": the face, then the words.
  await page.getByRole('group', { name: 'Mood' }).getByRole('button', { name: 'Okay' }).click()
  await page.getByRole('textbox', { name: 'How it felt, in your words' }).fill(OWNER_FEELINGS)

  // 6. "‹ Meal": everything was saved along the way, and the memory shows.
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()

  const [stored] = await readMeetups(page)
  expect(Object.keys(stored).sort()).toEqual([
    'activities',
    'createdAt',
    'date',
    'feelings',
    'friendIds',
    'id',
    'mood',
    'note',
    'typeId',
    'weather',
  ])
  expect(stored).toMatchObject({
    date: '2026-10-03',
    typeId: 'type-meal',
    note: OWNER_DAY_TYPED,
    activities: ['Movie', 'Shopping'],
    weather: ['rainy'],
    mood: 'okay',
    feelings: OWNER_FEELINGS,
  })
  expect(stored.friendIds).toHaveLength(3)

  await expect(page.getByText('Sat, Oct 3 · 🌧️ Rainy', { exact: true })).toBeVisible()
  const places = page.getByRole('list', { name: 'Places, 8 stops' })
  await expect(places.getByRole('heading', { level: 3 })).toHaveText([
    'nonstopstyle',
    'strand bookstore',
    'Sammy L coffee',
    'Blue willow',
    'hey tea Broadway',
    'amc 34',
    'holister + h&m',
    'seoulSaloon',
  ])
  await expect(places.locator('.day-stop__time')).toHaveText([
    '10:30 AM',
    '11:30 AM',
    '11:53 AM',
    '3:30 PM',
    '',
    '5:30 PM',
    '7:30 PM to ~8:10 PM',
    '8:30 PM',
  ])
  await expect(places.getByRole('listitem').nth(6).getByText(/^From 7:30.PM to about 8:10.PM\.$/)).toBeAttached()
  await expect(places.getByRole('listitem').nth(3).locator('.paid-tag')).toHaveText(/Jessie paid$/)
  await expect(places.getByRole('listitem').nth(7).locator('.paid-tag')).toHaveText(/Mariya paid$/)
  await expect(places.locator('.paid-tag')).toHaveCount(2)
  await expect(places.getByRole('listitem').nth(7).locator('.day-line').last()).toHaveText('Split ways went home')
  const felt = page.getByRole('region', { name: 'How it felt' })
  await expect(felt.getByText('Mood: Okay')).toBeVisible()
  await expect(felt).toContainText(OWNER_FEELINGS)
  await expect(page.getByRole('link', { name: 'Edit the day' })).toBeVisible()

  // In Mariya's history: the date, the others, the activities and the first places. No mood, no weather.
  await page.getByRole('button', { name: 'Back' }).click()
  await openFriendPage(page, 'Mariya')
  const row = page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ })
  await expect(row.locator('.row__subtitle')).toHaveText(
    'Sat, Oct 3 · with Jessie and Brandon · Movie, Shopping · nonstopstyle, strand bookstore, Sammy L coffee and 5 more',
  )
  await expect(row).not.toContainText('Okay')
  await expect(row).not.toContainText('Rainy')
})

test('the owner’s message, pasted, is kept exactly and reads back with its headings', async ({ page }) => {
  await page.clock.setFixedTime(SATURDAY_NIGHT)
  await page.goto('/')
  await logMeal(page)
  await openMealDay(page)
  await dayBox(page).fill(OWNER_MESSAGE)
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()

  expect((await readMeetups(page))[0].note).toBe(OWNER_MESSAGE)
  const day = page.getByRole('region', { name: 'The day' })
  await expect(day.getByRole('heading', { level: 3 })).toHaveText([
    'Locations',
    'nonstopstyle',
    'strand bookstore',
    'Sammy L coffee',
    'Blue willow',
    'hey tea Broadway',
    'amc 34',
    'holister + h&m',
    'seoulSaloon',
    'How I felt',
  ])
  const places = day.getByRole('list', { name: 'Places, 8 stops' })
  await expect(places.locator('.day-stop__time')).toHaveText([
    '10:30 AM',
    '11:30 AM',
    '11:53 AM',
    '3:30 PM',
    '',
    '5:30 PM',
    '7:30 PM to ~8:10 PM',
    '8:30 PM',
  ])
  const prose = day.locator('.day-prose')
  await expect(prose).toHaveCount(3)
  await expect(prose.nth(0)).toHaveText('Rainy day')
  await expect(prose.nth(1).locator('.day-line')).toHaveCount(15)
  await expect(prose.nth(1).locator('.paid-tag')).toHaveText([/Jessie paid$/, /Mariya paid$/])
  await expect(prose.nth(1).locator('.day-line').last()).toHaveText('Split ways went home')
  await expect(prose.nth(2)).toHaveText(OWNER_FEELINGS)
})

test('a backup keeps the day, its activities and its photos', async ({ page }) => {
  // Force the download path; the share sheet can't be driven in tests.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await page.goto('/')
  await addFriend(page, 'Mariya')
  await logMeetup(page, ['Mariya'], { type: 'Meal', activities: ['Movie'], photos: [tinyPhoto('one.png')] })
  await openFriendPage(page, 'Mariya')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await openDay(page)
  await page.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Rainy' }).click()
  await page.getByRole('group', { name: 'Mood' }).getByRole('button', { name: 'Okay' }).click()
  await dayBox(page).fill(OWNER_DAY_TYPED)
  await page.getByRole('textbox', { name: 'How it felt, in your words' }).fill(OWNER_FEELINGS)
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()

  await goToTab(page, 'Settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.version).toBe(5)
  expect(backup.meetups[0]).toMatchObject({
    note: OWNER_DAY_TYPED,
    activities: ['Movie'],
    weather: ['rainy'],
    mood: 'okay',
    feelings: OWNER_FEELINGS,
  })
  expect(backup.meetupPhotos).toHaveLength(1)

  await openFriendPage(page, 'Mariya')
  const sheet = await editMeetup(page, /Meal/)
  await sheet.getByRole('button', { name: 'Delete meetup' }).click()
  await goToTab(page, 'Settings')
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')

  await openFriendPage(page, 'Mariya')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await expect(page.getByRole('list', { name: 'Places, 8 stops' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Activities' }).getByRole('listitem')).toHaveText(['Movie'])
  await expect(page.getByRole('region', { name: 'Photos' }).getByRole('img')).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'How it felt' }).getByText('Mood: Okay')).toBeVisible()
})
```

- [ ] **Step 2: Run them**

Run: `npx playwright test --project=iphone e2e/day.spec.ts -g "owner|backup keeps"`
Expected: `3 passed`. (They check everything Tasks 1 to 6 built; a failure here is a bug in that work, not in the tests.)

- [ ] **Step 3: Capture the new screens**

The seed adds Mariya, Jessie and Brandon and the fake keyboard; `captureAll` logs the owner's day through "Save and write about the day" for `03`, `15`, `16`, `17`, `18` and `12`; one more test captures the accessibility size.

In `e2e/screenshots.spec.ts`, replace:

```ts
import { expect, test, type Page } from '@playwright/test'
import {
  addFriend,
  addToList,
```

with:

```ts
import { expect, test, type Page } from '@playwright/test'
import { OWNER_DAY_TYPED, OWNER_FEELINGS } from '../src/test/dayFixtures.ts'
import {
  addFriend,
  addToList,
```

Replace:

```ts
  stubFaceId,
  stubPush,
} from './helpers.ts'

const DIR = 'e2e/screenshots'
```

with:

```ts
  stubFaceId,
  stubPush,
} from './helpers.ts'
import { closeKeyboard, fakeVisualViewport, openKeyboard } from './keyboard.ts'

const DIR = 'e2e/screenshots'
```

Replace:

```ts
}

async function seed(page: Page) {
  await page.goto('/')
  await page.getByRole('complementary', { name: 'Install the app' }).getByRole('button', { name: 'Dismiss' }).click()
  // Birthdays soon shows Maya (today), Sam (in 3 days, with an age) and Theo (in 9 days).
```

with:

```ts
}

async function seed(page: Page) {
  // The day page's Place and Who paid rows are captured over the fake keyboard.
  await fakeVisualViewport(page)
  await page.goto('/')
  await page.getByRole('complementary', { name: 'Install the app' }).getByRole('button', { name: 'Dismiss' }).click()
  // Birthdays soon shows Maya (today), Sam (in 3 days, with an age) and Theo (in 9 days).
```

Replace:

```ts
  await addFriend(page, 'Jordan Lee', 'Work')
  await addFriend(page, 'Maya Patel', undefined, { month: today.month, day: today.day })
  await addFriend(page, 'Theo Brooks', 'Family', { month: inNine.month, day: inNine.day })
  // The meetup page, the viewer and the sheet show this one: two activities and three photos.
  const photos = [
    await drawnPhoto(page, 'ramen.png', 1200, 900, 25),
```

with:

```ts
  await addFriend(page, 'Jordan Lee', 'Work')
  await addFriend(page, 'Maya Patel', undefined, { month: today.month, day: today.day })
  await addFriend(page, 'Theo Brooks', 'Family', { month: inNine.month, day: inNine.day })
  // The owner's example day is written with these three.
  for (const name of ['Mariya', 'Jessie', 'Brandon']) await addFriend(page, name)
  // The meetup page, the viewer and the sheet show this one: two activities and three photos.
  const photos = [
    await drawnPhoto(page, 'ramen.png', 1200, 900, 25),
```

Replace:

```ts
  await expect(page.getByRole('status')).toBeEmpty({ timeout: 12_000 })
}

async function captureAll(page: Page, prefix: string) {
  await page.screenshot({ path: `${DIR}/${prefix}-02-friends.png` })

  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button').first().click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-03-log-sheet.png` })
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(sheet).toBeHidden()

  await page.getByRole('link', { name: /Alex Rivera/ }).click()
  await page.waitForTimeout(500)
```

with:

```ts
  await expect(page.getByRole('status')).toBeEmpty({ timeout: 12_000 })
}

/**
 * A full-page capture of the day page: it's a fixed layer that scrolls inside, so for the capture it becomes a
 * plain block as tall as its content.
 */
async function captureFullDay(page: Page, path: string) {
  const style = await page.addStyleTag({
    content: `.day-page { position: absolute; top: 0; bottom: auto; height: auto; }
      .day-page__body { overflow: visible; }
      .scroll-locked, .scroll-locked body { overflow: visible !important; }`,
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path, fullPage: true })
  await style.evaluate((element) => element.parentNode?.removeChild(element))
}

/** On the day page: writes the owner's example (as typed in the app), with the weather, the face and the words. */
async function writeOwnersDay(page: Page) {
  await page.getByRole('group', { name: 'Weather' }).getByRole('button', { name: 'Rainy' }).click()
  await page.getByRole('textbox', { name: 'The day' }).fill(OWNER_DAY_TYPED)
  await page.getByRole('group', { name: 'Mood' }).getByRole('button', { name: 'Okay' }).click()
  await page.getByRole('textbox', { name: 'How it felt, in your words' }).fill(OWNER_FEELINGS)
}

async function captureAll(page: Page, prefix: string) {
  await page.screenshot({ path: `${DIR}/${prefix}-02-friends.png` })

  // The Log sheet's footer, then the day page written through it.
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  for (const name of ['Mariya', 'Jessie', 'Brandon']) {
    await sheet.getByLabel('Search all friends').fill(name)
    await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name, exact: true }).click()
  }
  await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-03-log-sheet.png` })
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'The day' })).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-15-day-empty.png` })

  await writeOwnersDay(page)
  await expect(page.getByRole('status')).toBeEmpty({ timeout: 12_000 })
  await captureFullDay(page, `${DIR}/${prefix}-16-day-written.png`)

  const day = page.getByRole('textbox', { name: 'The day' })
  await day.focus()
  await day.press('End')
  await openKeyboard(page)
  const helpers = page.getByRole('group', { name: 'Writing helpers' })
  await helpers.getByRole('button', { name: 'Add a place' }).click()
  await helpers.getByRole('textbox', { name: 'Place and time' }).fill('Blue willow 3:30')
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-17-day-place.png` })
  await helpers.getByRole('button', { name: 'Close' }).click()
  await helpers.getByRole('button', { name: 'Paid' }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-18-day-paid.png` })
  await helpers.getByRole('group', { name: 'Who paid?' }).getByRole('button', { name: 'Close' }).click()
  await helpers.getByRole('button', { name: 'Hide keyboard' }).click()
  await closeKeyboard(page)

  // The Meetup page holding the owner's example.
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-12-meetup.png`, fullPage: true })
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()

  await page.getByRole('link', { name: /Alex Rivera/ }).click()
  await page.waitForTimeout(500)
```

Replace:

```ts

  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-12-meetup.png`, fullPage: true })

  await page.getByRole('region', { name: 'Photos' }).getByRole('button').first().click()
  await expect(page.getByRole('dialog', { name: 'Photo 1 of 3' })).toBeVisible()
  await page.waitForTimeout(500)
```

with:

```ts

  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await page.getByRole('region', { name: 'Photos' }).getByRole('button').first().click()
  await expect(page.getByRole('dialog', { name: 'Photo 1 of 3' })).toBeVisible()
  await page.waitForTimeout(500)
```

Replace:

```ts
  await captureAll(page, 'large-text')
})

test('large text reminders on', async ({ page }) => {
  await captureReminders(page, 'large-text', true)
})
```

with:

```ts
  await captureAll(page, 'large-text')
})

test('accessibility text size day page and memory', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  for (const name of ['Mariya', 'Jessie', 'Brandon']) await addFriend(page, name)
  await page.addStyleTag({ content: 'html { font: 33px/1.35 -apple-system, system-ui, sans-serif !important; }' })
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  for (const name of ['Mariya', 'Jessie', 'Brandon']) {
    await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name }).click()
  }
  await sheet.getByRole('button', { name: 'Meal', exact: true }).click()
  await sheet.getByRole('button', { name: 'Save and write about the day' }).click()
  await writeOwnersDay(page)
  await expect(page.getByRole('status')).toBeEmpty({ timeout: 12_000 })
  // The faces two by two.
  await captureFullDay(page, `${DIR}/ax-16-day-written.png`)
  // The timeline's times above the places.
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/ax-12-meetup.png`, fullPage: true })
})

test('large text reminders on', async ({ page }) => {
  await captureReminders(page, 'large-text', true)
})
```

- [ ] **Step 4: Run the screenshots and look at them**

Run: `npm run screenshots`
Expected: `15 passed`. In `e2e/screenshots`, open `light-03-log-sheet.png` (the footer's two buttons), `light-15-day-empty.png`, `light-16-day-written.png`, `light-17-day-place.png` (the Place row on the fake keyboard), `light-18-day-paid.png`, `light-12-meetup.png` (the timeline as the spec draws it), the `dark-` and `large-text-` versions, `ax-16-day-written.png` (faces two by two) and `ax-12-meetup.png` (times above places). Judge the emoji on a real iPhone.

- [ ] **Step 5: Update DESIGN.md**

In `DESIGN.md`, replace:

```markdown
Warm, paper-toned neutrals tinted toward peach, with a single soft peach accent in two strengths: a fill for things you press and a deeper terracotta for peach-colored text.

### Primary
- **Peach** (`--accent`, light `oklch(81% 0.095 50)`, dark `oklch(80% 0.1 50)`): the fill for primary buttons, the "+ Log meetup" pill, selected chips, the selected-friend ring and check, the camera badge on the friend photo, and the toast's check mark. Text on it is always **On-Peach** (`--on-accent`, `oklch(29% 0.06 40)` / `oklch(26% 0.05 40)`), 7.8:1 in light and 8.2:1 in dark. Pressed: **Peach Pressed** (`--accent-pressed`).
- **Terracotta Ink** (`--accent-ink`, light `oklch(53% 0.15 38)`, dark `oklch(81% 0.1 52)`): peach-family text and icons. Nav bar actions (Edit, Cancel, back), header icon buttons, the active tab, accent rows such as "Export backup", and the 2px focus ring. 5.1:1 on paper in light, 10.1:1 in dark.
- **Peach Wash** (`--accent-soft`, light `oklch(94.5% 0.03 55)`, dark `oklch(31% 0.04 50)`): a quiet tint for the install hint card, the "Upcoming" badge, and the back circle of the empty-state art.
```

with:

```markdown
Warm, paper-toned neutrals tinted toward peach, with a single soft peach accent in two strengths: a fill for things you press and a deeper terracotta for peach-colored text.

### Primary
- **Peach** (`--accent`, light `oklch(81% 0.095 50)`, dark `oklch(80% 0.1 50)`): the fill for primary buttons, the "+ Log meetup" pill, selected chips, the selected-friend ring and check, the picked mood's ring and check, the camera badge on the friend photo, and the toast's check mark. Text on it is always **On-Peach** (`--on-accent`, `oklch(29% 0.06 40)` / `oklch(26% 0.05 40)`), 7.8:1 in light and 8.2:1 in dark. Pressed: **Peach Pressed** (`--accent-pressed`).
- **Terracotta Ink** (`--accent-ink`, light `oklch(53% 0.15 38)`, dark `oklch(81% 0.1 52)`): peach-family text and icons. Nav bar actions (Edit, Cancel, back), header icon buttons, the active tab, accent rows such as "Export backup", and the 2px focus ring. 5.1:1 on paper in light, 10.1:1 in dark.
- **Peach Wash** (`--accent-soft`, light `oklch(94.5% 0.03 55)`, dark `oklch(31% 0.04 50)`): a quiet tint for the install hint card, the "Upcoming" badge, and the back circle of the empty-state art.
```

Replace:

```markdown

### Neutral
- **Warm Paper** (`--bg`, light `oklch(96.4% 0.009 60)`, dark `oklch(18.5% 0.008 55)`): the page and sheet background. The PWA `theme-color` matches it (#F8F2ED light, #16120F dark).
- **Paper White** (`--surface`, light `oklch(99.4% 0.004 60)`, dark `oklch(23.5% 0.009 55)`): inset groups, the tab bar, text fields inside sheets, the stat row, chart containers, the "Last seen" pill, action sheet groups.
- **Linen** (`--surface-2`, light `oklch(93.6% 0.011 60)`, dark `oklch(29% 0.011 55)`): unselected chips, search fields, secondary buttons, emoji badges, icon-button press. **Linen Pressed** (`--surface-pressed`) is the row and action-sheet press state.
- **Soft Rule** (`--separator`, light `oklch(89.5% 0.009 60)`, dark `oklch(32% 0.01 55)`): 0.5px hairlines between rows, the sheet grabber, the tab bar's top edge, and the compact nav bar's bottom edge.
- **Warm Ink** (`--ink`, light `oklch(25% 0.014 50)`, dark `oklch(95% 0.008 70)`): primary text, 14.4:1 on paper.
- **Warm Ink Secondary** (`--ink-2`, light `oklch(47% 0.014 50)`, dark `oklch(76% 0.012 60)`): subtitles, section labels, footers, trailing values, the stats comparison line, neutral reorder arrows. 6.2:1 on paper.
```

with:

```markdown

### Neutral
- **Warm Paper** (`--bg`, light `oklch(96.4% 0.009 60)`, dark `oklch(18.5% 0.008 55)`): the page and sheet background. The PWA `theme-color` matches it (#F8F2ED light, #16120F dark).
- **Paper White** (`--surface`, light `oklch(99.4% 0.004 60)`, dark `oklch(23.5% 0.009 55)`): inset groups, the tab bar, text fields inside sheets, the stat row, chart containers, the "Last seen" pill, action sheet groups, the day view and How it felt boxes on the Meetup page, and the day page's text boxes and Place field.
- **Linen** (`--surface-2`, light `oklch(93.6% 0.011 60)`, dark `oklch(29% 0.011 55)`): unselected chips, search fields, secondary buttons, emoji badges, icon-button press, mood faces, helper chips and paid tags. **Linen Pressed** (`--surface-pressed`) is the row and action-sheet press state.
- **Soft Rule** (`--separator`, light `oklch(89.5% 0.009 60)`, dark `oklch(32% 0.01 55)`): 0.5px hairlines between rows, the sheet grabber, the tab bar's top edge, and the compact nav bar's bottom edge.
- **Warm Ink** (`--ink`, light `oklch(25% 0.014 50)`, dark `oklch(95% 0.008 70)`): primary text, 14.4:1 on paper.
- **Warm Ink Secondary** (`--ink-2`, light `oklch(47% 0.014 50)`, dark `oklch(76% 0.012 60)`): subtitles, section labels, footers, trailing values, the stats comparison line, neutral reorder arrows. 6.2:1 on paper.
```

Replace:

```markdown
- **Viewer Ground** (`--viewer-bg`, `oklch(13% 0.006 55)` in both themes) with **Viewer Ink** (`--viewer-ink`, `oklch(96% 0.006 70)`, about 18:1) and **Viewer Pressed** (`--viewer-pressed`, white at 14%): the photo viewer only. It is the one near-black ground in the app (see the One Dark Room Rule).

### Destructive
- **Danger Red** (`--danger`, light `oklch(55% 0.19 27)`, dark `oklch(70% 0.17 25)`): destructive action-sheet buttons ("Delete friend", "Discard changes", "Replace all data"), destructive rows, and form field errors. Nothing else.

### Avatar tints
Six soft pastel pairs (`.tint-0` to `.tint-5`, hues 50, 85, 145, 215, 285, 350), chosen per friend by hashing the friend id so a tint survives renames. Light: background `oklch(91% 0.045 h)`, initials `oklch(42% 0.08 h)`. Dark: background `oklch(36% 0.05 h)`, initials `oklch(90% 0.05 h)`. Every pair is above 6.3:1. These are the only non-peach hues in the app, and they live only inside avatars.
```

with:

```markdown
- **Viewer Ground** (`--viewer-bg`, `oklch(13% 0.006 55)` in both themes) with **Viewer Ink** (`--viewer-ink`, `oklch(96% 0.006 70)`, about 18:1) and **Viewer Pressed** (`--viewer-pressed`, white at 14%): the photo viewer only. It is the one near-black ground in the app (see the One Dark Room Rule).

### Destructive
- **Danger Red** (`--danger`, light `oklch(55% 0.19 27)`, dark `oklch(70% 0.17 25)`): destructive action-sheet buttons ("Delete friend", "Discard changes", "Replace all data"), destructive rows, form field errors, and the day page's save error line. Nothing else.

### Avatar tints
Six soft pastel pairs (`.tint-0` to `.tint-5`, hues 50, 85, 145, 215, 285, 350), chosen per friend by hashing the friend id so a tint survives renames. Light: background `oklch(91% 0.045 h)`, initials `oklch(42% 0.08 h)`. Dark: background `oklch(36% 0.05 h)`, initials `oklch(90% 0.05 h)`. Every pair is above 6.3:1. These are the only non-peach hues in the app, and they live only inside avatars.
```

Replace:

```markdown
- **Caption** (0.7rem): tab bar labels (500, capped at 13px), the "this year" label under counts, the "Upcoming" badge (600), month initials (capped at 18px).

### Named Rules
**The Dynamic Type Rule.** The root font is `-apple-system-body`, so 1rem follows the iPhone text-size setting; every type size and spacing step is in rem. Layouts must survive the largest standard size (about 23px body): rows grow taller, subtitles wrap, the stat row stays three across up to about 28px and stacks beyond, the "+ Log meetup" pill stays on one line. The only fixed-pixel exceptions are avatars, the Meetup page's emoji badge (96px with a 48px emoji), the history thumbnail (40px) and the remove button's glyph on photos (24px), icons (except the Log pill's plus, which is 1.15em), tab labels (capped at 13px), month initials (capped at 18px), input text (never below 16px, so iOS doesn't zoom), and the lock screen's keypad and the Settings switches (listed under "Lock screen and PIN pad").

**The Rounded Numbers Rule.** Counts and years use the `.numeric` treatment: the rounded face with tabular numerals, so columns of numbers line up.
```

with:

```markdown
- **Caption** (0.7rem): tab bar labels (500, capped at 13px), the "this year" label under counts, the "Upcoming" badge (600), month initials (capped at 18px).

### Named Rules
**The Dynamic Type Rule.** The root font is `-apple-system-body`, so 1rem follows the iPhone text-size setting; every type size and spacing step is in rem. Layouts must survive the largest standard size (about 23px body): rows grow taller, subtitles wrap, the stat row stays three across up to about 28px and stacks beyond, the "+ Log meetup" pill stays on one line. The only fixed-pixel exceptions are avatars, the Meetup page's emoji badge (96px with a 48px emoji), the history thumbnail (40px) and the remove button's glyph on photos (24px), the mood face (a 44px circle with a 26px emoji), the 20px avatar in a paid tag, icons (except the Log pill's plus, which is 1.15em), tab labels (capped at 13px), month initials (capped at 18px), input text (never below 16px, so iOS doesn't zoom), and the lock screen's keypad and the Settings switches (listed under "Lock screen and PIN pad").

**The Rounded Numbers Rule.** Counts and years use the `.numeric` treatment: the rounded face with tabular numerals, so columns of numbers line up.
```

Replace:

```markdown
### Bottom sheets
Used for adding or editing a friend, logging a meetup, and editing groups and types. Warm Paper with 22px top corners and the Float shadow, rising over 340ms with ease-out-expo, draggable to dismiss from its header. Header: a 36×5px Soft Rule grabber, then a three-column bar with Cancel (text button), a centered Body 600 title, and an optional trailing action. Body: 16px side padding, sections 1.5rem apart. Footer: a hairline-topped bar holding the block primary button above the safe area. Cancelling with unsaved changes asks first through an action sheet.

### Meetup sheet: Activities and Photos
Two sections between **When** and **Note** in the Log and Edit meetup sheet. Both hold their changes until Save, so Cancel (after "Discard changes?") throws them away.
- **Activities:** a wrapping cluster of chips (the wrapping variant): activities used before, most used first, then the starters (Board games, Karaoke, Movie, Walk, Concert, Shopping, Cooking, Sports, Beach, Museum). Twelve show at first and a "More" chip shows the rest; an activity already on the meetup always shows. Selected chips are Peach, announced with `aria-pressed`, and a chip tapped off stays where it is until the sheet closes. The cluster ends with "+ New", which puts a Paper White field and a secondary **Add** button on their own line under the chips, like the friend sheet's New group; adding selects it. "A meetup can have up to 20 activities." is a Footnote Warm Ink Secondary hint, never red.
- **Photos:** a 3-across grid of square thumbnails (12px corners, 8px gaps), shared with the Meetup page. Each has a remove button ("Remove photo 2"): a 44px hit area in the corner around a 24px Warm Ink circle with a Warm Paper cross and a 1.5px Warm Paper ring that keeps it visible on any photo. The grid ends with the **Add photos** tile: Linen with a 1.5px dashed Warm Ink Tertiary outline (an empty slot, not a container), a 26px camera-plus icon, and a Footnote 600 Warm Ink Secondary label that reads "Adding 2 of 5…" while photos are resized. Hints under the grid, never red: "A meetup can have up to 20 photos." and "1 photo couldn't be added.".

### Action sheets and confirms
iOS-style stacks pinned to the bottom with 8px margins: a Paper White group (14px corners) with an optional centered Footnote 600 title and message, 56px buttons in Terracotta Ink at 1.1rem divided by hairlines, then a separate Cancel group in 600. Destructive buttons use Danger Red. The sort chooser is a `dialog`; destructive confirms are an `alertdialog`.

### Toast
The one happy moment. An inverted pill (Warm Ink background, Warm Paper text, Float shadow), 52px tall on one line, above the Log pill. Its 26px corners keep it a pill on one line and make it a soft box when a long message wraps; the end of a page then makes room for its real height. It layers above sheets but below action sheets, so an open action sheet's scrim covers it. A 24px Peach circle draws its check mark in over 420ms; an optional "Undo" pill sits at the end. It stays 5 seconds, 8 with an action, and pauses while touched or focused.

### Navigation
- **Nav bar:** sticky, 44px plus the safe area, solid Warm Paper. Back and actions in Terracotta Ink. When the large title scrolls away, a centered Body 600 title fades in and a 0.5px Soft Rule appears underneath.
- **Tab bar:** fixed, Paper White, 50px plus the safe area, hairline on top. Three tabs (Friends, Stats, Settings) with 26px line icons over Caption labels: Warm Ink Tertiary at rest, Terracotta Ink with a heavier stroke and 600 label when current. A friend's page and a Meetup page belong to Friends, unless they were opened from Stats, which then stays current.

### Avatars
Circles. Initials in the rounded face (600, 40% of the size) on a per-friend pastel tint, or a cropped photo. Sizes: 44px in rows, 52px in the recent-friends grid, 96px in the detail hero, 24 to 28px inside chips.
```

with:

```markdown
### Bottom sheets
Used for adding or editing a friend, logging a meetup, and editing groups and types. Warm Paper with 22px top corners and the Float shadow, rising over 340ms with ease-out-expo, draggable to dismiss from its header. Header: a 36×5px Soft Rule grabber, then a three-column bar with Cancel (text button), a centered Body 600 title, and an optional trailing action. Body: 16px side padding, sections 1.5rem apart. Footer: a hairline-topped bar holding the block primary button above the safe area. Cancelling with unsaved changes asks first through an action sheet.

### Meetup sheet: Activities, Photos and footer
Activities and Photos follow **When** and end the Log and Edit meetup sheet; there is no Note (the day is written on the day page). Both hold their changes until Save, so Cancel (after "Discard changes?") throws them away.
- **Activities:** a wrapping cluster of chips (the wrapping variant): activities used before, most used first, then the starters (Board games, Karaoke, Movie, Walk, Concert, Shopping, Cooking, Sports, Beach, Museum). Twelve show at first and a "More" chip shows the rest; an activity already on the meetup always shows. Selected chips are Peach, announced with `aria-pressed`, and a chip tapped off stays where it is until the sheet closes. The cluster ends with "+ New", which puts a Paper White field and a secondary **Add** button on their own line under the chips, like the friend sheet's New group; adding selects it. "A meetup can have up to 20 activities." is a Footnote Warm Ink Secondary hint, never red.
- **Photos:** a 3-across grid of square thumbnails (12px corners, 8px gaps), shared with the Meetup page. Each has a remove button ("Remove photo 2"): a 44px hit area in the corner around a 24px Warm Ink circle with a Warm Paper cross and a 1.5px Warm Paper ring that keeps it visible on any photo. The grid ends with the **Add photos** tile: Linen with a 1.5px dashed Warm Ink Tertiary outline (an empty slot, not a container), a 26px camera-plus icon, and a Footnote 600 Warm Ink Secondary label that reads "Adding 2 of 5…" while photos are resized. Hints under the grid, never red: "A meetup can have up to 20 photos." and "1 photo couldn't be added.".
- **Footer:** Log meetup's footer has a centered 44px Terracotta Ink text button, "Save and write about the day", above the Save block button. It's disabled whenever Save is, never hidden for a missing friend, and hidden only while the keyboard is up, so Save never moves.

### The day page
A pushed, full-screen layer at `/meetups/:id/day` that fills the screen above the keyboard (bottom at `--keyboard-inset`, height `--viewport-height`), with no tab bar. Nav bar: back (the meetup type), the title "The day". Body: the context line, Weather chips, The day box with its hint, How it felt (mood tiles and a box, only for today or earlier), and "Saves as you type, and stays on this iPhone.". Boxes are Paper White, grow with their text and never scroll inside themselves. It saves as you type; a failed save shows a Footnote Danger Red line above the helper bar.

### Helper bar
The day page's footer, riding on the keyboard: a row of chips ("@ Place", "Now" for today's meetups, "Paid") with a 44px "Hide keyboard" button pinned at the end while the keyboard is up. "@ Place" swaps the row for a one-line Place field (autocorrect off) with Add and Close; "Paid" swaps it for "Who paid?" chips (Me, each friend, Split). Helpers never take focus from the box you're typing in.

### Mood tiles
Four tiles, low to high: 😔 Heavy, 🙂 Okay, 😊 Good, 😄 Great. Each is a 44px Linen circle with a 26px emoji over a Footnote Warm Ink word, four across, or two by two once a quarter of the row is narrower than 3.25rem. Nothing is picked at first. The picked tile gets the selected-friend ring and check and a 600 word; tapping it again clears it. Press is Linen Pressed, with no scale.

### Weather chips
Eight chips in a scrolling row, ☀️ Sunny, ⛅ Cloudy, 🌧️ Rainy, ⛈️ Stormy, ❄️ Snowy, 🌬️ Windy, 🌡️ Hot, 🧣 Cold. Never a face emoji. Any number can be picked.

### Action sheets and confirms
iOS-style stacks pinned to the bottom with 8px margins: a Paper White group (14px corners) with an optional centered Footnote 600 title and message, 56px buttons in Terracotta Ink at 1.1rem divided by hairlines, then a separate Cancel group in 600. Destructive buttons use Danger Red. The sort chooser is a `dialog`; destructive confirms are an `alertdialog`.

### Toast
The one happy moment. An inverted pill (Warm Ink background, Warm Paper text, Float shadow), 52px tall on one line, above the Log pill. Its 26px corners keep it a pill on one line and make it a soft box when a long message wraps; the end of a page then makes room for its real height. It layers above sheets but below action sheets, so an open action sheet's scrim covers it. A 24px Peach circle draws its check mark in over 420ms; an optional "Undo" pill sits at the end. It stays 5 seconds, 8 with an action, and pauses while touched or focused. When it goes, the room it took stays until the next page, so the end of a page never jumps. On the day page it sits 8px above the helper bar.

### Navigation
- **Nav bar:** sticky, 44px plus the safe area, solid Warm Paper. Back and actions in Terracotta Ink. When the large title scrolls away, a centered Body 600 title fades in and a 0.5px Soft Rule appears underneath.
- **Tab bar:** fixed, Paper White, 50px plus the safe area, hairline on top. Three tabs (Friends, Stats, Settings) with 26px line icons over Caption labels: Warm Ink Tertiary at rest, Terracotta Ink with a heavier stroke and 600 label when current. A friend's page and a Meetup page belong to Friends, unless they were opened from Stats, which then stays current. The tab bar is hidden on the day page.

### Avatars
Circles. Initials in the rounded face (600, 40% of the size) on a per-friend pastel tint, or a cropped photo. Sizes: 44px in rows, 52px in the recent-friends grid, 96px in the detail hero, 24 to 28px inside chips.
```

Replace:

```markdown
Reads as one calm column, not a grid of cards: centered 96px avatar, Title name, group in Warm Ink Secondary, then a Paper White "Last seen" pill (Subhead, 1em corners so it becomes a soft box if large text wraps it between the date and the time since). Below: the notes, then **Birthday**, **Likes** and **Dislikes** (people before numbers), then the stat row, "Month by month", and the history grouped by month.
- **Birthday:** always shown. With a birthday, one inset row: a 🎂 emoji badge leading, the date as the title ("March 14, 1996", or "March 14" without a year), the countdown as the subtitle ("In 12 days · turns 31", "Tomorrow", "Today"), and a chevron. Tapping it opens the Edit friend sheet. Without one, a "+ Add birthday" chip opens the same sheet. Plain facts: no color, badge or reminder copy.
- **Likes and Dislikes:** each a section with a Footnote label over a wrapping cluster of item chips (the wrapping variant) on the page background, with no container. The cluster ends with a "+ Add" chip; tapping it puts a Paper White field and a secondary **Add** button in its place (one field open at a time). Notes under the field ("Already in Likes.", "This list is full.") are Footnote Warm Ink Secondary with `role="alert"`, never red. Tapping an item opens an action sheet titled with it: **Move to Dislikes** (or **Move to Likes**) and a destructive **Remove**, which an Undo toast reverses. An empty list shows only the "+ Add" chip.
- **History:** rows grouped by month, each with the type's emoji badge, the type (and "Upcoming"), and a subtitle of the date, "with" the others, the activities and the note. A meetup with photos ends its row with its first photo, a 40px thumbnail with 8px corners, before the chevron. Tapping a row opens the Meetup page.

### Meetup page
The memory view of one meetup, pushed like a friend's page. Nav bar: back ("Back", or the friend's name when opened from their history) and **Edit**, which opens the Edit meetup sheet.
- **Hero:** centered: the type's emoji in a 96px Linen circle (a 48px emoji), the type name in Title, the date in Warm Ink Secondary with the "Upcoming" badge for a future date, then a Footnote "With" label over the friends as person chips (a 28px avatar and the name in a Paper White pill) that open the friend.
- **Then, each hidden when empty:** **Activities** as read-only chips (the chip look without a press state), **Note** as Body text in a Paper White box with 14px corners, and **Photos** in the 3-across grid; a thumbnail opens the photo viewer.
- When the meetup is deleted from the sheet, the page goes back.

### Photo viewer
Full screen over everything, on the Viewer Ground with Viewer Ink controls: a Close button top left; the photo fit between the bars, letterboxed, with no zoom; and Previous, "2 of 5" (rounded, tabular) and Next along the bottom, all 44px. A sideways swipe or the arrow keys change photos: the next one slides 32px and fades in over 220ms (with Reduce Motion it only fades). Previous and Next dim to 35% at the ends. Escape closes it. It is a modal dialog named "Photo 2 of 5", the image's alt names the photo, the type and the date ("Photo 2 of 5, Coffee, Sat, Sep 12"), focus stays inside, and closing puts focus back on the photo's thumbnail.
```

with:

```markdown
Reads as one calm column, not a grid of cards: centered 96px avatar, Title name, group in Warm Ink Secondary, then a Paper White "Last seen" pill (Subhead, 1em corners so it becomes a soft box if large text wraps it between the date and the time since). Below: the notes, then **Birthday**, **Likes** and **Dislikes** (people before numbers), then the stat row, "Month by month", and the history grouped by month.
- **Birthday:** always shown. With a birthday, one inset row: a 🎂 emoji badge leading, the date as the title ("March 14, 1996", or "March 14" without a year), the countdown as the subtitle ("In 12 days · turns 31", "Tomorrow", "Today"), and a chevron. Tapping it opens the Edit friend sheet. Without one, a "+ Add birthday" chip opens the same sheet. Plain facts: no color, badge or reminder copy.
- **Likes and Dislikes:** each a section with a Footnote label over a wrapping cluster of item chips (the wrapping variant) on the page background, with no container. The cluster ends with a "+ Add" chip; tapping it puts a Paper White field and a secondary **Add** button in its place (one field open at a time). Notes under the field ("Already in Likes.", "This list is full.") are Footnote Warm Ink Secondary with `role="alert"`, never red. Tapping an item opens an action sheet titled with it: **Move to Dislikes** (or **Move to Likes**) and a destructive **Remove**, which an Undo toast reverses. An empty list shows only the "+ Add" chip.
- **History:** rows grouped by month, each with the type's emoji badge, the type (and "Upcoming"), and a subtitle of the date, "with" the others, the activities, and the day's first places ("and 5 more") or its first line, cut at 80 characters. Moods and weather never show here. A meetup with photos ends its row with its first photo, a 40px thumbnail with 8px corners, before the chevron. Tapping a row opens the Meetup page.

### Meetup page
The memory view of one meetup, pushed like a friend's page. Nav bar: back ("Back", or the friend's name when opened from their history) and **Edit**, which opens the Edit meetup sheet.
- **Hero:** centered: the type's emoji in a 96px Linen circle (a 48px emoji), the type name in Title, the date in Warm Ink Secondary, then the weather after a middle dot ("Sat, Oct 3 · 🌧️ Rainy", the emoji hidden from VoiceOver), with the "Upcoming" badge for a future date, then a Footnote "With" label over the friends as person chips (a 28px avatar and the name in a Paper White pill) that open the friend.
- **Then, each hidden when empty:** **Activities** as read-only chips (the chip look without a press state), **The day** (the day view, below), **How it felt** (the face in a 44px Linen circle and its word in Body 600, then the words, in a Paper White box with 14px corners; never for an upcoming meetup), the day row ("Write about the day" as an accent row with the subtitle "Places, what happened, how it felt", or "Edit the day", with a 📝 emoji badge; always there), and **Photos** in the 3-across grid; a thumbnail opens the photo viewer.
- When the meetup is deleted from the sheet, the page goes back.

### Day view
The day's text read back: Paper White, 14px corners. Places form an ordered list: a 7em Subhead time column (rounded tabular, Warm Ink Secondary, right-aligned; a range adds "to 8:10 PM", rough times show "~"), the place in Body 600, then each line as its own paragraph. Hairlines (0.5px, inset to the place column) separate stops; no rails or dots. Below 16em wide (about 21px text on an iPhone: the largest standard sizes and every accessibility size) the time sits above the place. Headings are Footnote 600 Warm Ink Secondary; other lines read as prose. Paid lines are read-only Linen tags: 🧾, a 20px avatar when the name matches one friend, and the words.

### Photo viewer
Full screen over everything, on the Viewer Ground with Viewer Ink controls: a Close button top left; the photo fit between the bars, letterboxed, with no zoom; and Previous, "2 of 5" (rounded, tabular) and Next along the bottom, all 44px. A sideways swipe or the arrow keys change photos: the next one slides 32px and fades in over 220ms (with Reduce Motion it only fades). Previous and Next dim to 35% at the ends. Escape closes it. It is a modal dialog named "Photo 2 of 5", the image's alt names the photo, the type and the date ("Photo 2 of 5, Coffee, Sat, Sep 12"), focus stays inside, and closing puts focus back on the photo's thumbnail.
```

Replace:

```markdown

## 6. Do's and Don'ts

### Do:
- **Do** keep the "+ Log meetup" pill in the bottom third of the screen, 16px above the tab bar, reachable by thumb.
- **Do** use iOS-native patterns: large titles, inset grouped lists, bottom sheets, action sheets, a bottom tab bar.
```

with:

```markdown

## 6. Do's and Don'ts

### Named Rules
**The No Score Rule.** A mood is a word about how a meetup felt to you. It is never stored or shown as a number, stars or a score; never averaged, counted, charted or ranked; never summed up per friend; never shown in lists; and no mood gets a color of its own.

**The No Ledger Rule.** Who paid is a plain fact on one place, in your words. It's never totaled, balanced, counted or compared across meetups or friends.

**The Your Words Rule.** The day is stored exactly as typed. The app may change how text looks when it's read back, never the text itself, and it never moves words between fields.

**The Frozen Grammar Rule.** The rules that read a day (grammar 1) never change. A new rule is a new grammar for days saved after it, so a memory reads the same after every update.

### Do:
- **Do** keep the "+ Log meetup" pill in the bottom third of the screen, 16px above the tab bar, reachable by thumb.
- **Do** use iOS-native patterns: large titles, inset grouped lists, bottom sheets, action sheets, a bottom tab bar.
```

Replace:

```markdown
- **Don't** use bouncy or elastic animations; ease out smoothly, and fade instead when Reduce Motion is on.
- **Don't** open a modal as the first answer; prefer sheets, inline editing, and undo.
- **Don't** use em dashes in UI copy; use commas, colons, periods, or parentheses.
```

with:

```markdown
- **Don't** use bouncy or elastic animations; ease out smoothly, and fade instead when Reduce Motion is on.
- **Don't** open a modal as the first answer; prefer sheets, inline editing, and undo.
- **Don't** use em dashes in UI copy; use commas, colons, periods, or parentheses.
- **Don't** show moods or weather in lists, rows, Stats or summaries.
- **Don't** draw timeline rails, dots or connecting lines; stops are separated by hairlines.
- **Don't** rewrite, sort or move what the owner wrote.
```

- [ ] **Step 6: Record the planning decisions in the spec**

In `docs/superpowers/specs/2026-10-05-meetup-debrief-design.md`, replace:

```markdown
- Prompts, badges, reminders or notifications to write about a day.
- AI of any kind.
- Dates per place or multi-day meetups (late-night times read as past midnight, without dates).
```

with:

```markdown
- Prompts, badges, reminders or notifications to write about a day.
- AI of any kind.
- Dates per place or multi-day meetups (late-night times read as past midnight, without dates).

## Decisions made while planning

Recorded in [the plan](../plans/2026-10-05-meetup-debrief.md):

- **Golden fixtures** live in `src/test/dayFixtures.ts`, shared by the unit tests and `e2e/day.spec.ts`: fixture A is the stored record's note (808 characters) and fixture B the owner's message exactly as sent (925 characters, 31 lines, from "Rainy day" to the last sentence). Both lengths are pinned by tests.
- **Times.** "~" may have spaces after it; "about", "around", "to", "am" and "pm" are read in any case. A range's end needs minutes or am/pm like any lone clock, so "@Show 11am-1" has no time. A 24-hour phone shows two-digit hours ("09:05"). "Now" types an ordinary space before AM or PM ("9:52 PM"); only what the app shows uses the no-break space.
- **Lines.** "paid" and "for" are read in any case, and one trailing "." or "!" is dropped before matching; a tag shows the line as written ("Mariya paid."). A line that is only "@" is skipped as if it weren't there, so it doesn't end a stop's lines. Headings count characters as code points, and ":" alone is text. Line breaks are split at `\r\n`, `\r` and `\n`, so a note from a backup with Windows line breaks reads the same.
- **The timeline's large-text layout** switches below 16em, not 22em. The box's content on a 390pt iPhone is 326px, which is under 22em at every iPhone text size (17px by default), so 22em would put every time above its place. 16em keeps the side-by-side timeline at the default and larger standard sizes and moves times above places from about 21px, the largest standard sizes and every accessibility size.
- **Who paid.** `src/lib/payers.ts` names the chips (`payerLabel`: the first name, or the full name when two friends on the meetup share a first name, ignoring case) and finds a tag's face (`paidBy`: exactly one friend whose first or full name matches, ignoring case).
- **Announcements** read a new place in the day as it stands ("Added holister + h&m, 7:30 PM to about 8:10 PM."), so its time reads in day order. Escape closes the Place row too.
- **The day page** starts the scroll lock and the keyboard publishing as soon as its route opens, before its data loads, so a Log sheet still closing always hands the keyboard over. Focus moves to its title before the first paint. It sits at z-index 40: above the tab bar and pages, below sheets, the toast and action sheets. Discarding after a failed save stops the saver, so nothing is written later.
- **The toast's room** stays after a tall toast goes and resets on the next page; a new page keeps room only for a toast that is showing.
- **Tests without jsdom.** Unit tests run in Node, so the keyboard and autosave logic live in plain functions (`startKeyboardInset`, `createAutosave`, `flushWhenHidden`) tested with fakes and fake timers; the hooks are thin wrappers.
- **Between tasks** the Log sheet's one-line Note saved through `updateDay` until the sheet lost it, so every task stayed green.
- **Screenshots.** The seed adds Mariya, Jessie and Brandon; `12-meetup` shows the owner's example, logged through "Save and write about the day", while the viewer and the Edit sheet still use the seed's Meal. The accessibility-size test captures the day page (`ax-16-day-written`, faces two by two) and its Meetup page (`ax-12-meetup`, times above places).
```

- [ ] **Step 7: Run everything**

Run: `npm test`
Expected: `Test Files  57 passed (57)` and `Tests  667 passed (667)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `148 passed`.

Run: `git status --short`
Expected: only the files listed for this task. (The PNGs are ignored by git.)

- [ ] **Step 8: Commit**

```bash
git add e2e/day.spec.ts e2e/screenshots.spec.ts DESIGN.md docs/superpowers/specs/2026-10-05-meetup-debrief-design.md
git commit -F - <<'EOF'
test: the owner's day end to end; screenshots, DESIGN.md and planning notes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

- [ ] **Step 9: On a real iPhone (what e2e can't prove)**

From the Home Screen app, check: the keyboard stays up through every helper tap; "@ Place" raises the keyboard from a cold tap; shake to undo works after a helper insert; dictation into The day; autocorrect stays off in the Place field; and the "Now" chip and the timeline follow the phone's 24-Hour Time setting.

---

## Spec coverage

| Spec requirement | Where |
| --- | --- |
| The day is the existing `note`, stored exactly as typed; existing notes never migrated | Tasks 1 (`updateDay` normalizes only line breaks), 6 (old notes read back), e2e "an old note is already the day" |
| `Weather`, `Mood`, `weather`, `mood`, `feelings` on `Meetup`; defaults on new meetups | Task 1 (`types.ts`, `addMeetup`) |
| `WEATHER`, `isWeather`, `cleanWeather`; `MOODS`, `isMood`, `moodInfo`, `INVALID_MOOD`, `feelingsApply`; nothing touching window, document or Intl | Task 1 (`weather.ts`, `moods.ts`) |
| `DAY_MAX_TYPED`, `FEELINGS_MAX`, `TOO_LONG_FEELINGS` | Task 1 (`dayText.ts`) |
| Grammar 1: place lines, times, ranges, rough times, paid and split lines, headings, grouping | Task 1 (`readDay`) |
| AM or PM in day order, first-time defaults, ranges with am/pm on the end, past midnight | Task 1 (`readDay`, "AM or PM" tests) |
| Golden fixtures A and B (the owner's message byte for byte), every table row, frozen | Task 1 (`dayFixtures.ts`, `dayText.test.ts`) |
| `formatClock` (no-break space, 24-hour), "~", `speakTime` | Task 1 (`clock.ts`) |
| `daySnippet`, `isDayEmpty` | Task 1; used in Task 6 |
| `insertPlaceLine`, `insertPaidLine`, `insertAtCaret`; the walkthrough replay gives fixture A | Task 1 (`dayEdit.ts`) |
| `caretLineSpan` mirror | Task 3 (`caret.ts`) |
| `MeetupInput` without `note`; `DayInput`, `updateDay` (one `rw` transaction, false when gone, never `put`); `updateMeetup` leaves the day alone | Task 1 (`meetups.ts`) |
| Reading hook fills and cleans weather, mood and feelings; no Dexie version bump | Task 1 (`db.ts`) |
| Backups version 5, strict day fields, the `>= 4` fix, versions 1 to 4 get an empty day, version 6 refused | Task 2 |
| Log sheet: Note removed; "Save and write about the day" above Save, disabled with Save, hidden with the keyboard; opens `/meetups/:id` then `/meetups/:id/day`; back label from the friend's page | Task 5 |
| Day page route, title, no tab bar, unknown or deleted meetup goes back | Tasks 4, 6 |
| Layer at `--keyboard-inset` and `--viewport-height`, nav bar, body, footer, push and Reduce Motion fade | Task 4 (`DayScreen.css`) |
| Context line, Weather chips, The day box (hint, placeholder, 10,000, "This box is full."), How it felt (tiles and box, today or earlier), footnote | Task 4 |
| Mood tiles: four across or two by two, ring and check, no scale, toggle off | Task 4 (`MoodTiles`) |
| Boxes grow with their text (replicated value) | Task 4 (`GrowField`) |
| Helper bar: "@ Place", "Now" (today), "Paid", "Hide keyboard"; Place row (autocorrect off, Return or Add, Close, Now); Who paid row (Me, friends, Split); where text goes; focus kept; `execCommand` with a fallback; announcements | Task 4 (`DayHelperBar`, `DayScreen`) |
| Saving: own copy, newer stored values only into idle fields, 600ms pause, blur, background, Back, unmount, one write at a time, gone stops quietly, failure line with retries, Discard only after a failure | Task 4 (`useAutosave`, `DayScreen`) |
| Reference-counted `useKeyboardInset`; caret-following reveal on `input` and `selectionchange` | Task 3 |
| Meetup page: hero weather, The day (timeline, headings, prose, paid tags with a face), How it felt, the day row, VoiceOver names | Task 6 (`DayView`, `MeetupScreen`) |
| History rows: `daySnippet`, never mood or weather | Task 6 |
| Toast 8px above the helper bar (`day-open`, `--day-bar-height`) | Task 6 |
| E2E: quick log, owner's example typed and pasted, autosave, app lock, Undo, old notes, backup round trip, helpers | Tasks 4 to 7 (`e2e/day.spec.ts`) |
| E2E: `dayKeyboard.spec.ts` (layer on the keyboard, panning, before typing, 60 lines, line 5, How it felt, the sheet race) with `e2e/keyboard.ts` | Tasks 4, 5 |
| Updated tests: `logMeetup`'s note, `meetupPage.spec.ts`, `detail.spec.ts`, the Log sheet Note tests removed | Tasks 5, 6 |
| Screenshots `03`, `12`, `15` to `18`, accessibility size | Task 7 |
| DESIGN.md: colors, Dynamic Type exceptions, Meetup sheet, the day page, helper bar, mood tiles, weather chips, Meetup page, day view, history, navigation, toast, named rules, don'ts | Task 7 |
| Follow-ups: the toast's room, one reveal margin, the large-text toast check | Task 0 |
