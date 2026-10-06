# Meetup History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make any meetup easy to find again from the Friends tab: a "Recent meetups" group after Birthdays soon (the 3 latest meetups that happened, or 2 while Birthdays soon shows, each subtitle stopped at two lines, then "See all meetups") and a Meetups page at `/meetups` with a search, "Upcoming" and one group per month, "Show older meetups", and its place kept when you go back.

**Architecture:** The pure rules live in `src/stats/meetupHistory.ts` (recent meetups, names, the subtitle, search folding and matching, the page's groups and its first rows), next to `groupByMonth`, which now shares a `newestFirst` order with them. The friend page's history row becomes a shared, memoized `MeetupRow` whose `MeetupThumb` draws a 40px box from the first render, so a thumbnail never moves the page; rows learn whether they have a photo from one app-wide live set (`MeetupIdsWithPhotosProvider`, a key-only `uniqueKeys()` walk), and `firstPhotoThumb` keeps the 300 most recently used thumbnails in memory. `FriendsScreen` shows Recent meetups and keeps the search field still with a scroll correction before paint whenever a search or a chip hides or shows the groups above it. `MeetupsScreen` filters on a deferred query in memos and renders through a memoized `MeetupList`; `PlaceMemoryProvider`, inside `App`, keeps each history entry's search and row count, so Back finds them and the app lock forgets them. No schema, Dexie version or backup change.

**Tech Stack:** Vite 8, React 19, TypeScript 6 (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`), react-router 7 (HashRouter), Dexie 4 with dexie-react-hooks, Vitest 5 with fake-indexeddb (TZ America/Los_Angeles), Playwright WebKit (iPhone 13, port 4174, service workers blocked).

---

**Spec:** [docs/superpowers/specs/2026-10-05-meetup-history-design.md](../specs/2026-10-05-meetup-history-design.md), the source of truth (approved with A plus B: Recent meetups after Birthdays soon, two rows while Birthdays soon shows). Design context: [DESIGN.md](../../../DESIGN.md) (sections 4 to 6), [PRODUCT.md](../../../PRODUCT.md).

## Ground rules for every task

- Run every command from the project root in Git Bash: `/c/Users/luald/OneDrive/Desktop/Friend tracker`. The branch `feature/meetup-history` is already checked out.
- TypeScript: type-only imports use `import type` or an inline `type` specifier; no enums, namespaces or constructor parameter properties; no unused locals or parameters. Test files under `src/` and everything in `e2e/` are type-checked by `npm run build`. Keep lines within about 120 characters.
- Import paths are extensionless inside `src/`. Inside `e2e/`, local files are imported with `.ts` (`./helpers.ts`, `../src/test/dayFixtures.ts`). The e2e project is type-checked as `nodenext`, so it can't import `src/types.ts` (whose own imports are extensionless): row shapes for seeding are declared in `e2e/helpers.ts`.
- Copy (UI text, comments, docs) never uses em dashes. Use commas, colons, periods or parentheses.
- **Nothing here touches the stored data.** No new table, index, field, Dexie version or backup format. The meetups table never holds photos, so reading every meetup for a list stays light; photos are read by the `meetupId` and `[meetupId+order]` indexes, key-only wherever possible.
- **IndexedDB round trips are slow in WebKit.** Each request or cursor step costs a round trip (about 15ms in the Windows WebKit the e2e runs on), while one `getAll` or `getAllKeys` costs one. Seed long histories with `seedMeetups` (one transaction), never through the UI.
- Never run `npm run dev`, `npm run preview`, `vite preview` or wrangler yourself. `npm run e2e` and `npm run screenshots` build and start their own preview server.
- Commands:
  - Unit tests: `npm test` (one file: `npx vitest run <path>`)
  - Type check and production build: `npm run build` (quick type check only: `npx tsc -b`)
  - End-to-end tests: `npm run e2e` (one file: `npx playwright test --project=iphone <path>`)
  - Screenshots: `npm run screenshots`
- Baseline before Task 1: `npm test` shows `Test Files  57 passed (57)` and `Tests  676 passed (676)`; `npm run e2e` shows `158 passed`; `npm run screenshots` shows `15 passed`. Each task states the new totals, measured by applying this plan task by task to a clone of the branch.
- **A known machine flake:** under 4-worker load an unrelated e2e test can stall (a click that waits for a sheet's chip to be stable). Re-run that file alone (`npx playwright test --project=iphone <file>`) and note it.
- **Screenshots are not committed.** `e2e/screenshots` is in `.gitignore`; look at the PNGs locally and never `git add` them.
- Commit after each task with the exact `git add` paths and message given. Every commit message ends with a blank line and then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Decisions made while building

The spec records these at its end ("Decisions made while building"), in Task 5.

1. **Which meetups have photos is one live query for the whole app.** `useMeetupIdsWithPhotos()` reads a context that `MeetupIdsWithPhotosProvider` (inside `App`, next to `PlaceMemoryProvider`) fills from `meetupIdsWithPhotos()`. The `uniqueKeys()` walk takes one round trip per meetup with photos: 100 of them took about 1.5s in the e2e WebKit. Read per screen (as Task 2 first does), going back to a long Meetups page rendered its rows after `ScrollManager`'s 1s retry had given up, and the scroll was lost. Kept for the app (Task 4), the set is ready the moment a screen mounts. `ScrollManager` is unchanged.
2. **`newestFirst`** is exported from `src/stats/history.ts` and shared by `groupByMonth` and `recentMeetups`, so Recent meetups, the months and a friend's History never disagree.
3. **The thumbnail cache forgets** the ids `deleteMeetup` deletes and the `removeIds` of an `updateMeetup`, after the transaction; `replaceAllData` clears it after a restore. `deleteFriend` doesn't: photo ids are never reused, so an entry left behind only takes room until the 300 limit drops it.
4. **Focus after "Show older meetups":** a pending flag and the row count it had pick the row (or its group's heading) that gets a callback ref; an effect keyed on the row count focuses it once, with `preventScroll`. The index isn't cleared afterwards, because removing the heading's `tabIndex` while it has focus would drop focus; a new search clears it. `MeetupList` passes its row count to `onShowMore(shown)`, so the callback is stable and never reads a stale count. In WebKit a tap doesn't paint a focus ring on row 61, so focus moves on every press (checked in the e2e).
5. **The live region's words** come from the trimmed query the 700ms timer saw, shown only while it equals the deferred trimmed query; each keystroke clears it first, and a restored search never starts the timer.
6. **`MeetupList` gets the searched groups,** built in `useMemo`s keyed on the deferred query in `MeetupsScreen`, rather than the raw data. The index of folded text is built only while there's a search. A keystroke re-renders only the field until the deferred value catches up.
7. **E2E helpers:** `friendLink(page, name)` (anchored, escaped); `seedMeetups(page, { friends, groups, meetups, photos })` (one readwrite transaction, then a reload); the builders `friendRow`, `meetupRow` and `photoRow` with the shapes `SeedFriend`, `SeedMeetup` and `SeedPhoto`.
8. **E2E tests land with their tasks:** the Friends tab tests in Task 3 and the Meetups page tests in Task 4 (14 in all in `e2e/history.spec.ts`). "The search field stays put" puts all 12 friends in the group, so the group's chip leaves the page long enough to keep the field still (a short page clamps the scroll, as the spec's "Keeping the search field still" says). "See all opens the Meetups page" adds a second upcoming meetup so "soonest first" is checked. `detail.spec.ts` checks the History thumbnail's `.meetup-thumb` box (Task 2).

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/stats/meetupHistory.ts` / `.test.ts` | Create | `RECENT_MEETUPS`, `RECENT_MEETUPS_WITH_BIRTHDAYS`, `MEETUPS_PAGE_SIZE`, `recentMeetups`, `meetupNames`, `meetupSubtitle`, `searchKey`, `meetupSearchText`, `matchesSearch`, `historySections`, `firstRows` |
| `src/stats/history.ts` | Modify | `newestFirst`, shared with `groupByMonth` |
| `src/db/meetups.ts` / `.test.ts` | Modify | The 300-entry least recently used thumbnail cache in `firstPhotoThumb`, `forgetPhotoThumbs`, `meetupIdsWithPhotos`; delete and edit forget their photos |
| `src/backup/storage.ts` / `.test.ts` | Modify | `replaceAllData` clears the thumbnail cache |
| `src/components/InsetGroup.tsx` | Modify | `Row` takes a `ref` for its link |
| `src/components/MeetupRow.tsx` / `.css` | Create | The shared meetup row (memoized) and `MeetupThumb` with its 40px box; `.meetup-row__clamp` |
| `src/data/hooks.ts` | Modify | `useMeetupIdsWithPhotos` (Task 2 a live query; Task 4 reads the provider's context) |
| `src/data/meetupIdsWithPhotosContext.ts` | Create (Task 4) | The context |
| `src/data/MeetupIdsWithPhotosProvider.tsx` | Create (Task 4) | One live walk of the photos' `meetupId` index for the whole app |
| `src/screens/FriendDetailScreen.tsx` / `.css` | Modify | History rows are `MeetupRow`s; `.history-thumb` moves to `MeetupRow.css` |
| `src/screens/FriendsScreen.tsx` | Modify | Recent meetups (2 while Birthdays soon shows), "See all meetups", the search field kept still |
| `src/components/PlaceMemory.tsx` | Create | `PlaceMemoryProvider` and `usePlaceMemory` |
| `src/screens/MeetupsScreen.tsx` / `.css` | Create | The Meetups page and its memoized `MeetupList` |
| `src/App.tsx` | Modify | The `/meetups` route; the two providers |
| `e2e/helpers.ts` | Modify | `friendLink`, `seedMeetups`, `friendRow`, `meetupRow`, `photoRow`; `openFriendPage` uses `friendLink` |
| `e2e/history.spec.ts` | Create | 14 tests: Recent meetups and the Meetups page |
| `e2e/detail.spec.ts`, `e2e/meetups.spec.ts`, `e2e/settings.spec.ts` | Modify | Friend rows found with `friendLink`; the thumbnail's box |
| `e2e/screenshots.spec.ts` | Modify | `friendLink`; an upcoming Party; `02-friends-full`, `19-meetups`, `20-meetups-search` |
| `DESIGN.md` | Modify | Meetup row, Recent meetups, Meetups page, Show more, and the entries the spec lists |
| `docs/superpowers/specs/2026-10-05-meetup-history-design.md` | Modify | Appends the decisions made while building |

---

### Task 1: The pure rules, the thumbnail cache, and which meetups have photos

**Files:**
- Create: `src/stats/meetupHistory.ts`, `src/stats/meetupHistory.test.ts`
- Modify: `src/stats/history.ts`, `src/db/meetups.ts`, `src/backup/storage.ts`
- Test: `src/db/meetups.test.ts`, `src/backup/storage.test.ts`

- [ ] **Step 1: Write the failing tests for the rules**

Today is fixed at Mon, Oct 5, 2026; the shared `meetup()` fixture logs each meetup at noon UTC on its date. Create `src/stats/meetupHistory.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { OWNER_DAY_TYPED } from '../test/dayFixtures'
import { meetup } from '../test/fixtures'
import type { Meetup } from '../types'
import {
  firstRows,
  historySections,
  matchesSearch,
  MEETUPS_PAGE_SIZE,
  meetupNames,
  meetupSearchText,
  meetupSubtitle,
  RECENT_MEETUPS,
  RECENT_MEETUPS_WITH_BIRTHDAYS,
  recentMeetups,
  searchKey,
} from './meetupHistory'

// Mon, Oct 5, 2026.
const TODAY = '2026-10-05'

/** A meetup logged at a given time of its day (UTC), so same-day order is clear. */
function loggedAt(id: string, date: string, time: string, fields: Partial<Meetup> = {}): Meetup {
  return { ...meetup(id, date, ['alex']), createdAt: `${date}T${time}:00.000Z`, ...fields }
}

const ids = (meetups: Meetup[]) => meetups.map((m) => m.id)

describe('limits', () => {
  it('shows 3 recent meetups, 2 while Birthdays soon shows, and 60 rows a page', () => {
    expect(RECENT_MEETUPS).toBe(3)
    expect(RECENT_MEETUPS_WITH_BIRTHDAYS).toBe(2)
    expect(MEETUPS_PAGE_SIZE).toBe(60)
  })
})

describe('recentMeetups', () => {
  const meetups = [
    loggedAt('sep20', '2026-09-20', '12:00'),
    loggedAt('morning', TODAY, '10:00'),
    loggedAt('tomorrow', '2026-10-06', '12:00'),
    loggedAt('oct1', '2026-10-01', '12:00'),
    loggedAt('evening', TODAY, '18:00'),
  ]

  it('gives the latest meetups that happened, newest first, the one logged later first on the same date', () => {
    expect(ids(recentMeetups(meetups, TODAY))).toEqual(['evening', 'morning', 'oct1'])
  })

  it('never gives a future meetup', () => {
    expect(ids(recentMeetups(meetups, TODAY, 10))).toEqual(['evening', 'morning', 'oct1', 'sep20'])
  })

  it('gives what there is when there are fewer, and nothing when every meetup is upcoming', () => {
    expect(ids(recentMeetups([loggedAt('oct1', '2026-10-01', '12:00')], TODAY))).toEqual(['oct1'])
    expect(recentMeetups([loggedAt('tomorrow', '2026-10-06', '12:00')], TODAY)).toEqual([])
  })

  it('takes another limit', () => {
    expect(ids(recentMeetups(meetups, TODAY, RECENT_MEETUPS_WITH_BIRTHDAYS))).toEqual(['evening', 'morning'])
  })
})

describe('meetupNames', () => {
  const nameById = new Map([
    ['alex', 'Alex'],
    ['sam', 'Sam'],
    ['kim', 'Kim'],
  ])

  it('names the friends in the meetup’s order, skipping ids with no friend', () => {
    expect(meetupNames(meetup('m', TODAY, ['kim', 'gone', 'alex']), nameById)).toEqual(['Kim', 'Alex'])
  })

  it('leaves out the friend whose page the row is on', () => {
    expect(meetupNames(meetup('m', TODAY, ['alex', 'sam', 'kim']), nameById, 'sam')).toEqual(['Alex', 'Kim'])
  })
})

describe('meetupSubtitle', () => {
  it('reads the date, who, the activities and the day’s first places', () => {
    const owners = {
      ...meetup('m', '2026-10-03', ['m', 'j', 'b']),
      activities: ['Movie', 'Shopping'],
      note: OWNER_DAY_TYPED,
    }
    expect(meetupSubtitle(owners, ['Mariya', 'Jessie', 'Brandon'], TODAY)).toBe(
      'Sat, Oct 3 · with Mariya, Jessie and Brandon · Movie, Shopping · ' +
        'nonstopstyle, strand bookstore, Sammy L coffee and 5 more',
    )
  })

  it('leaves out the parts that are empty', () => {
    const tacos = { ...meetup('m', '2026-10-03', ['alex']), note: 'Tacos' }
    expect(meetupSubtitle(tacos, [], TODAY)).toBe('Sat, Oct 3 · Tacos')
  })

  it('gives the year of a date in another year', () => {
    expect(meetupSubtitle(meetup('m', '2025-09-12', ['sam']), ['Sam'], TODAY)).toBe('Fri, Sep 12, 2025 · with Sam')
  })

  it('shortens four names or more', () => {
    expect(meetupSubtitle(meetup('m', '2026-10-03', ['a']), ['Alex', 'Sam', 'Kim', 'Lee'], TODAY)).toBe(
      'Sat, Oct 3 · with Alex, Sam and 2 others',
    )
  })
})

describe('searchKey', () => {
  it('folds case, accents, curly quotes and runs of spaces', () => {
    expect(searchKey('Crème Brûlée')).toBe('creme brulee')
    expect(searchKey('didn’t')).toBe("didn't")
    expect(searchKey('“Hi”')).toBe('"hi"')
    expect(searchKey('  Blue\n\nwillow ')).toBe('blue willow')
  })
})

describe('matchesSearch', () => {
  const nameById = new Map([
    ['alex', 'Alex'],
    ['sam', 'Sam'],
    ['kim', 'Kim'],
    ['lee', 'Lee'],
    ['mariya', 'Mariya'],
    ['jessie', 'Jessie'],
    ['brandon', 'Brandon'],
  ])

  /** Whether `query` finds this meetup, read as the Meetups page reads it. */
  function finds(query: string, found: Meetup, typeName = 'Coffee', today = TODAY): boolean {
    return matchesSearch(meetupSearchText(found, meetupNames(found, nameById), typeName, today), query)
  }

  const meal = { ...meetup('meal', '2026-10-03', ['mariya', 'jessie', 'brandon'], 'type-meal') }

  it('finds a friend’s name in any case', () => {
    expect(finds('MARIYA', meal, 'Meal')).toBe(true)
  })

  it('finds a name the row shortens to "and 2 others"', () => {
    const four = meetup('four', '2026-10-03', ['alex', 'sam', 'kim', 'lee'])
    expect(finds('lee', four)).toBe(true)
  })

  it('finds the type’s name, and "Meetup" when the type is gone', () => {
    expect(finds('meal', meal, 'Meal')).toBe(true)
    expect(finds('meetup', meal, 'Meetup')).toBe(true)
    expect(finds('meetup', meal, 'Meal')).toBe(false)
  })

  it('finds an activity', () => {
    expect(finds('karaoke', { ...meal, activities: ['Board games', 'Karaoke'] }, 'Meal')).toBe(true)
  })

  it('finds a place with its "@", and a plain line of the day', () => {
    const day = { ...meal, note: '@Blue willow 3:30\nOrdered kung pao chicken' }
    expect(finds('blue willow', day, 'Meal')).toBe(true)
    expect(finds('kung pao', day, 'Meal')).toBe(true)
  })

  it('finds How it felt’s words only on a meetup that has happened', () => {
    const felt = { ...meetup('felt', TODAY, ['alex']), feelings: 'I still feel almost outsidery' }
    expect(finds('outsidery', felt)).toBe(true)
    expect(finds('outsidery', { ...felt, date: '2026-10-06' })).toBe(false)
  })

  it('ignores accents and the kind of apostrophe', () => {
    expect(finds('cafe', { ...meal, note: 'Café on the corner' }, 'Meal')).toBe(true)
    expect(finds("didn't", { ...meal, note: 'We didn’t stay long' }, 'Meal')).toBe(true)
    expect(finds('didn’t', { ...meal, note: "We didn't stay long" }, 'Meal')).toBe(true)
  })

  it('needs every word typed, each found anywhere in the meetup', () => {
    const coffee = meetup('coffee', '2026-10-03', ['jessie'], 'type-coffee')
    const tacos = { ...meetup('tacos', '2026-10-03', ['jessie'], 'type-meal'), note: 'Tacos' }
    const owners = { ...meal, note: OWNER_DAY_TYPED }
    expect(finds('jessie coffee', coffee, 'Coffee')).toBe(true)
    expect(finds('jessie coffee', tacos, 'Meal')).toBe(false)
    expect(finds('jessie coffee', owners, 'Meal')).toBe(true)
    expect(finds('sam tacos', { ...meetup('m', '2026-10-03', ['sam']), note: 'Tacos' }, 'Meal')).toBe(true)
  })

  it('never searches the weather, the mood or the date', () => {
    expect(finds('rainy', { ...meal, weather: ['rainy'] }, 'Meal')).toBe(false)
    expect(finds('okay', { ...meal, mood: 'okay' }, 'Meal')).toBe(false)
    expect(finds('oct', meal, 'Meal')).toBe(false)
  })

  it('matches everything with a blank query', () => {
    expect(finds('', meal, 'Meal')).toBe(true)
    expect(finds('   ', meal, 'Meal')).toBe(true)
  })
})

describe('historySections', () => {
  it('puts upcoming meetups first, soonest first, then each month, newest first', () => {
    const sections = historySections(
      [
        loggedAt('dec24', '2025-12-24', '12:00'),
        loggedAt('oct9', '2026-10-09', '12:00'),
        loggedAt('oct7-second', '2026-10-07', '18:00'),
        loggedAt('oct5', TODAY, '12:00'),
        loggedAt('oct7-first', '2026-10-07', '10:00'),
        loggedAt('sep30', '2026-09-30', '12:00'),
      ],
      TODAY,
    )
    expect(sections.map(({ key, title, meetups }) => [key, title, ids(meetups)])).toEqual([
      ['upcoming', 'Upcoming', ['oct7-first', 'oct7-second', 'oct9']],
      ['2026-10', 'October 2026', ['oct5']],
      ['2026-09', 'September 2026', ['sep30']],
      ['2025-12', 'December 2025', ['dec24']],
    ])
  })

  it('shows no empty groups', () => {
    expect(historySections([], TODAY)).toEqual([])
    expect(historySections([loggedAt('oct9', '2026-10-09', '12:00')], TODAY).map((s) => s.title)).toEqual(['Upcoming'])
  })
})

describe('firstRows', () => {
  // 70 meetups: 5 upcoming, 30 in October, 35 in September.
  const time = (i: number) => `${String(10 + (i % 10))}:${String(10 + i)}`
  const meetups = [
    ...Array.from({ length: 5 }, (_, i) => loggedAt(`up${i}`, `2026-10-${String(10 + i)}`, '12:00')),
    ...Array.from({ length: 30 }, (_, i) => loggedAt(`oct${i}`, '2026-10-02', time(i))),
    ...Array.from({ length: 35 }, (_, i) => loggedAt(`sep${i}`, '2026-09-15', time(i))),
  ]
  const sections = historySections(meetups, TODAY)
  const rowsOf = (result: ReturnType<typeof firstRows>) => result.sections.flatMap((section) => ids(section.meetups))

  it('gives the first rows in order across the groups, and how many are left', () => {
    const result = firstRows(sections, 60)
    expect(rowsOf(result)).toEqual(sections.flatMap((section) => ids(section.meetups)).slice(0, 60))
    expect(result.sections.map((section) => [section.title, section.meetups.length])).toEqual([
      ['Upcoming', 5],
      ['October 2026', 30],
      ['September 2026', 25],
    ])
    expect(result.more).toBe(10)
  })

  it('drops the groups after a cut at a group’s end', () => {
    const result = firstRows(sections, 35)
    expect(result.sections.map((section) => section.title)).toEqual(['Upcoming', 'October 2026'])
    expect(result.more).toBe(35)
  })

  it('gives everything when the count is past the total', () => {
    const result = firstRows(sections, 120)
    expect(rowsOf(result)).toHaveLength(70)
    expect(result.more).toBe(0)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/stats/meetupHistory.test.ts`
Expected: FAIL, the file can't resolve `./meetupHistory` (`Tests  no tests`).

- [ ] **Step 3: Share the order, and write the rules**

In `src/stats/history.ts`, pull the sort into `newestFirst`:

```diff
--- a/src/stats/history.ts
+++ b/src/stats/history.ts
@@ -6,9 +6,14 @@ export interface MonthGroup {
   meetups: Meetup[]
 }
 
+/** Newest date first, then most recently logged: the order of every list of meetups that happened. */
+export function newestFirst(a: Meetup, b: Meetup): number {
+  return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
+}
+
 /** Newest month first; within a month, newest date first, then most recently logged. */
 export function groupByMonth(meetups: Meetup[]): MonthGroup[] {
-  const sorted = [...meetups].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
+  const sorted = [...meetups].sort(newestFirst)
   const groups: MonthGroup[] = []
   for (const meetup of sorted) {
     const month = meetup.date.slice(0, 7)
```

Create `src/stats/meetupHistory.ts`:

```ts
import { formatDate, formatMonthYear, type ISODate } from '../lib/dates'
import { daySnippet } from '../lib/dayText'
import { feelingsApply } from '../lib/moods'
import { formatNameList } from '../lib/text'
import type { Meetup } from '../types'
import { groupByMonth, newestFirst } from './history'

// Pure: no window, document or Intl of its own, so it's tested in Node with fixed dates.

/** How many meetups Recent meetups shows on the Friends tab. */
export const RECENT_MEETUPS = 3
/** How many it shows while Birthdays soon is showing above it. */
export const RECENT_MEETUPS_WITH_BIRTHDAYS = 2
/** Rows the Meetups page shows at first, and how many each "Show older meetups" adds. */
export const MEETUPS_PAGE_SIZE = 60

/** The latest meetups dated today or earlier: newest date first, then the one logged later. */
export function recentMeetups(meetups: Meetup[], today: ISODate, limit = RECENT_MEETUPS): Meetup[] {
  return meetups
    .filter((meetup) => meetup.date <= today)
    .sort(newestFirst)
    .slice(0, limit)
}

/**
 * The names a row says after "with", in the meetup's order. Ids with no friend are skipped. `leaveOut` is the
 * friend whose page the row is on.
 */
export function meetupNames(meetup: Meetup, nameById: ReadonlyMap<string, string>, leaveOut?: string): string[] {
  return meetup.friendIds
    .filter((friendId) => friendId !== leaveOut)
    .map((friendId) => nameById.get(friendId))
    .filter((name): name is string => name !== undefined)
}

/**
 * A meetup row's subtitle: the date, "with …" (when there are names), the activities and the day's snippet, joined
 * by " · ".
 */
export function meetupSubtitle(meetup: Meetup, names: string[], today: ISODate): string {
  return [
    formatDate(meetup.date, today),
    names.length > 0 ? `with ${formatNameList(names)}` : null,
    meetup.activities.length > 0 ? meetup.activities.join(', ') : null,
    daySnippet(meetup.note),
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Text folded for search: lowercased, marks removed, curly quotes made straight, runs of spaces made one. */
export function searchKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Everything the Meetups search looks in, folded: the names, the type's name, activities, the day, and How it
 * felt's words when the meetup has happened (feelingsApply). The parts are joined by line breaks, which no query
 * word holds, so a word never matches across two parts.
 */
export function meetupSearchText(meetup: Meetup, names: string[], typeName: string, today: ISODate): string {
  const parts = [...names, typeName, ...meetup.activities, meetup.note]
  if (feelingsApply(meetup, today)) parts.push(meetup.feelings)
  return parts
    .map(searchKey)
    .filter((part) => part !== '')
    .join('\n')
}

/** True when every word of the query is found in `searchText`. A blank query matches everything. */
export function matchesSearch(searchText: string, query: string): boolean {
  return searchKey(query)
    .split(' ')
    .filter((word) => word !== '')
    .every((word) => searchText.includes(word))
}

export interface HistorySection {
  /** "upcoming", or the month as YYYY-MM */
  key: string
  /** "Upcoming", or the month as "October 2026" */
  title: string
  meetups: Meetup[]
}

/** The Meetups page's groups: Upcoming (soonest first), then each month, newest first. No empty groups. */
export function historySections(meetups: Meetup[], today: ISODate): HistorySection[] {
  const upcoming = meetups
    .filter((meetup) => meetup.date > today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const months = groupByMonth(meetups.filter((meetup) => meetup.date <= today)).map(({ month, meetups: inMonth }) => ({
    key: month,
    title: formatMonthYear(`${month}-01`),
    meetups: inMonth,
  }))
  return upcoming.length > 0 ? [{ key: 'upcoming', title: 'Upcoming', meetups: upcoming }, ...months] : months
}

/** The first `count` rows in order across the groups (groups left empty are dropped), and how many are left. */
export function firstRows(sections: HistorySection[], count: number): { sections: HistorySection[]; more: number } {
  const shown: HistorySection[] = []
  let left = count
  let total = 0
  for (const section of sections) {
    total += section.meetups.length
    if (left <= 0) continue
    const meetups = section.meetups.length <= left ? section.meetups : section.meetups.slice(0, left)
    left -= meetups.length
    shown.push(meetups === section.meetups ? section : { ...section, meetups })
  }
  return { sections: shown, more: Math.max(0, total - count) }
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/stats/meetupHistory.test.ts src/stats/history.test.ts`
Expected: `Test Files  2 passed (2)`, `Tests  29 passed (29)`.

- [ ] **Step 5: Write the failing tests for the cache and the photo ids**

In `src/db/meetups.test.ts`, import `forgetPhotoThumbs` and `meetupIdsWithPhotos`, empty the cache before each test (it lives for the whole file), and add the two groups at the end:

```diff
--- a/src/db/meetups.test.ts
+++ b/src/db/meetups.test.ts
@@ -7,6 +7,8 @@ import {
   addMeetup,
   deleteMeetup,
   firstPhotoThumb,
+  forgetPhotoThumbs,
+  meetupIdsWithPhotos,
   photoCount,
   photoThumbs,
   restoreMeetup,
@@ -20,7 +22,10 @@ import {
 
 const base: MeetupInput = { date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], activities: [] }
 
-beforeEach(resetDatabase)
+beforeEach(async () => {
+  await resetDatabase()
+  forgetPhotoThumbs()
+})
 
 describe('addMeetup', () => {
   it('saves a meetup with unique friends and nothing written about the day yet', async () => {
@@ -379,3 +384,107 @@ describe('deleteMeetup and restoreMeetup', () => {
     expect(await db.meetupPhotos.count()).toBe(0)
   })
 })
+
+describe('the thumbnail cache', () => {
+  /** Counts the photo records read whole (full image included). */
+  function countPhotoReads() {
+    return vi.spyOn(db.meetupPhotos, 'get')
+  }
+
+  it('reads a thumbnail once, then keeps it', async () => {
+    const meetup = await addMeetup(base, { add: [newPhoto('a')], removeIds: [], order: [] })
+    const reads = countPhotoReads()
+    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBa')
+    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBa')
+    expect(reads).toHaveBeenCalledTimes(1)
+    reads.mockRestore()
+  })
+
+  it('follows a new first photo after a reorder', async () => {
+    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: ['a', 'b'] })
+    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBa')
+    await updateMeetup(meetup.id, base, { add: [], removeIds: [], order: ['b', 'a'] })
+    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBb')
+  })
+
+  it('reads again after forgetPhotoThumbs', async () => {
+    const meetup = await addMeetup(base, { add: [newPhoto('a')], removeIds: [], order: [] })
+    await firstPhotoThumb(meetup.id)
+    const reads = countPhotoReads()
+    forgetPhotoThumbs()
+    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBa')
+    expect(reads).toHaveBeenCalledTimes(1)
+    reads.mockRestore()
+  })
+
+  it('still gives null for a meetup without photos', async () => {
+    const meetup = await addMeetup(base)
+    expect(await firstPhotoThumb(meetup.id)).toBeNull()
+    expect(await firstPhotoThumb(meetup.id)).toBeNull()
+  })
+
+  it('forgets the photos a delete or an edit removes', async () => {
+    const alex = await addFriend(friendInput('Alex'))
+    const meetup = await addMeetup(
+      { ...base, friendIds: [alex.id] },
+      { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: [] },
+    )
+    await firstPhotoThumb(meetup.id)
+    const deleted = await deleteMeetup(meetup.id)
+    await restoreMeetup(deleted!)
+    const reads = countPhotoReads()
+    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBa')
+    expect(reads).toHaveBeenCalledTimes(1)
+    await updateMeetup(meetup.id, { ...base, friendIds: [alex.id] }, { add: [], removeIds: ['a'], order: [] })
+    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBb')
+    expect(reads).toHaveBeenCalledTimes(2)
+    reads.mockRestore()
+  })
+
+  it('keeps the 300 most recently used thumbnails', async () => {
+    const meetupIds = Array.from({ length: 302 }, (_, i) => `m${i}`)
+    await db.meetupPhotos.bulkAdd(
+      meetupIds.map((meetupId, i) => ({
+        id: `p${i}`,
+        meetupId,
+        order: 0,
+        full: `data:image/jpeg;base64,FULL${i}`,
+        thumb: `data:image/jpeg;base64,THUMB${i}`,
+        width: 4,
+        height: 3,
+        createdAt: '2026-09-01T12:00:00.000Z',
+      })),
+    )
+    const [a, ...others] = meetupIds
+    const read = others.slice(0, 299)
+    const more = others.slice(299)
+    await firstPhotoThumb(a)
+    for (const id of read) await firstPhotoThumb(id)
+    await firstPhotoThumb(a)
+    for (const id of more) await firstPhotoThumb(id)
+
+    const reads = countPhotoReads()
+    expect(await firstPhotoThumb(a)).toBe('data:image/jpeg;base64,THUMB0')
+    expect(reads).not.toHaveBeenCalled()
+    // The first of the 299 was used least recently, so it was dropped and is read again.
+    expect(await firstPhotoThumb(read[0])).toBe('data:image/jpeg;base64,THUMB1')
+    expect(reads).toHaveBeenCalledTimes(1)
+    reads.mockRestore()
+  })
+})
+
+describe('meetupIdsWithPhotos', () => {
+  it('names each meetup with photos once, without reading a photo', async () => {
+    const three = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b'), newPhoto('c')], removeIds: [], order: [] })
+    const none = await addMeetup(base)
+    const reads = vi.spyOn(db.meetupPhotos, 'get')
+    expect(await meetupIdsWithPhotos()).toEqual([three.id])
+    expect(reads).not.toHaveBeenCalled()
+    reads.mockRestore()
+
+    await updateMeetup(none.id, base, { add: [newPhoto('d')], removeIds: [], order: [] })
+    expect((await meetupIdsWithPhotos()).sort()).toEqual([three.id, none.id].sort())
+    await updateMeetup(none.id, base, { add: [], removeIds: ['d'], order: [] })
+    expect(await meetupIdsWithPhotos()).toEqual([three.id])
+  })
+})
```

- [ ] **Step 6: Run them to see them fail**

Run: `npx vitest run src/db/meetups.test.ts`
Expected: FAIL, every test, because `forgetPhotoThumbs` is not a function.

- [ ] **Step 7: Write the cache and `meetupIdsWithPhotos`**

In `src/db/meetups.ts`, `updateMeetup` and `deleteMeetup` forget the photos they remove after their transaction, and `firstPhotoThumb` reads through the cache:

```diff
--- a/src/db/meetups.ts
+++ b/src/db/meetups.ts
@@ -152,6 +152,7 @@ export async function updateMeetup(id: string, input: MeetupInput, photos: Photo
     await db.meetups.update(id, { date, typeId, friendIds, activities })
     await applyPhotoChanges(id, photos, new Date().toISOString())
   })
+  forgetThumbs(photos.removeIds)
 }
 
 /**
@@ -170,7 +171,7 @@ export async function updateDay(id: string, input: DayInput): Promise<boolean> {
 
 /** Deletes a meetup and its photos, and returns them so `restoreMeetup` can put them back (Undo). */
 export async function deleteMeetup(id: string): Promise<DeletedMeetup | undefined> {
-  return db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
+  const deleted = await db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
     const meetup = await db.meetups.get(id)
     if (!meetup) return undefined
     const photos = await db.meetupPhotos.where('meetupId').equals(id).sortBy('order')
@@ -178,6 +179,8 @@ export async function deleteMeetup(id: string): Promise<DeletedMeetup | undefine
     await db.meetups.delete(id)
     return { meetup, photos }
   })
+  if (deleted) forgetThumbs(deleted.photos.map((photo) => photo.id))
+  return deleted
 }
 
 /**
@@ -196,9 +199,48 @@ export async function restoreMeetup({ meetup, photos }: DeletedMeetup): Promise<
   })
 }
 
+/** The most thumbnails kept in memory: past it, the least recently used goes first. */
+const THUMB_CACHE_SIZE = 300
+
+/**
+ * Thumbnails by photo id, least recently used first (a Map keeps insertion order). A photo's thumbnail never
+ * changes (an edit only changes `order`, and Undo puts back the same ids with the same thumbnails), so its id is
+ * enough. In memory only: nothing is stored.
+ */
+const thumbCache = new Map<string, string>()
+
+function cachedThumb(id: string): string | undefined {
+  const thumb = thumbCache.get(id)
+  if (thumb !== undefined) {
+    // Used again: move it to the newest end.
+    thumbCache.delete(id)
+    thumbCache.set(id, thumb)
+  }
+  return thumb
+}
+
+function cacheThumb(id: string, thumb: string) {
+  thumbCache.delete(id)
+  thumbCache.set(id, thumb)
+  if (thumbCache.size > THUMB_CACHE_SIZE) {
+    const oldest = thumbCache.keys().next()
+    if (!oldest.done) thumbCache.delete(oldest.value)
+  }
+}
+
+function forgetThumbs(ids: readonly string[]) {
+  for (const id of ids) thumbCache.delete(id)
+}
+
+/** Empties the thumbnail cache (a backup restore replaces every photo). */
+export function forgetPhotoThumbs() {
+  thumbCache.clear()
+}
+
 /**
- * The thumbnail of a meetup's first photo, or null when it has none. Reads just that one photo,
- * through the [meetupId+order] index, and keeps only its thumbnail.
+ * The thumbnail of a meetup's first photo, or null when it has none. Reads the first photo's id through the
+ * [meetupId+order] index without loading it, so a live query still follows photos added, removed or reordered,
+ * then takes the thumbnail from the cache, or reads that one photo once and keeps only its thumbnail.
  */
 export async function firstPhotoThumb(meetupId: string): Promise<string | null> {
   // Key-only, then get: Dexie's live-query cache keeps whole rows of record queries, full images included.
@@ -207,7 +249,19 @@ export async function firstPhotoThumb(meetupId: string): Promise<string | null>
     .between([meetupId, -Infinity], [meetupId, Infinity])
     .limit(1)
     .primaryKeys()
-  return id ? ((await db.meetupPhotos.get(id))?.thumb ?? null) : null
+  if (!id) return null
+  const cached = cachedThumb(id)
+  if (cached !== undefined) return cached
+  // IndexedDB can't read part of a record, so this reads the full image too, and drops it at once.
+  const thumb = (await db.meetupPhotos.get(id))?.thumb
+  if (thumb === undefined) return null
+  cacheThumb(id, thumb)
+  return thumb
+}
+
+/** The ids of the meetups that have photos, each once: a key-only walk of the meetupId index, reading no image. */
+export async function meetupIdsWithPhotos(): Promise<string[]> {
+  return (await db.meetupPhotos.orderBy('meetupId').uniqueKeys()) as string[]
 }
 
 /** A meetup's photos as ids and thumbnails, in order. Never returns a full image (see firstPhotoThumb). */
```

- [ ] **Step 8: Run them to see them pass**

Run: `npx vitest run src/db/meetups.test.ts`
Expected: `Tests  44 passed (44)`.

- [ ] **Step 9: A restore forgets the cache (failing test first)**

In `src/backup/storage.test.ts`:

```diff
--- a/src/backup/storage.test.ts
+++ b/src/backup/storage.test.ts
@@ -3,7 +3,7 @@ import { db, resetDatabase } from '../db/db'
 import { addFriend } from '../db/friends'
 import { getSetting, setSetting } from '../db/settings'
 import { addGroup } from '../db/groups'
-import { addMeetup } from '../db/meetups'
+import { addMeetup, firstPhotoThumb } from '../db/meetups'
 import { addPreferences } from '../db/preferences'
 import type { AppLock, LockFailures } from '../lock/types'
 import type { BirthdayReminders } from '../reminders/types'
@@ -129,6 +129,20 @@ describe('backup storage', () => {
     expect((await readAllPhotos()).map((photo) => photo.id).sort()).toEqual(['p1', 'p2'])
   })
 
+  it('forgets the thumbnails it kept, so a restored photo shows its own', async () => {
+    await db.meetupPhotos.add(meetupPhoto('p1', 'm1', 0))
+    expect(await firstPhotoThumb('m1')).toBe('data:image/jpeg;base64,THUMBp1')
+    const restored = { ...meetupPhoto('p1', 'm1', 0), thumb: 'data:image/jpeg;base64,RESTORED' }
+    await replaceAllData({
+      friends: [friend('f1', 'Alex')],
+      groups: [],
+      meetupTypes: [meetupType('t1', 'Coffee', 0)],
+      meetups: [meetup('m1', '2026-09-01', ['f1'], 't1')],
+      meetupPhotos: [restored],
+    })
+    expect(await firstPhotoThumb('m1')).toBe('data:image/jpeg;base64,RESTORED')
+  })
+
   it('keeps the day’s note, weather, mood and feelings through replace and read', async () => {
     const data: BackupData = {
       friends: [friend('f1', 'Alex')],
```

Run: `npx vitest run src/backup/storage.test.ts`
Expected: FAIL, `forgets the thumbnails it kept, so a restored photo shows its own` (it still gets `THUMBp1`).

Then in `src/backup/storage.ts`:

```diff
--- a/src/backup/storage.ts
+++ b/src/backup/storage.ts
@@ -1,4 +1,5 @@
 import { db } from '../db/db'
+import { forgetPhotoThumbs } from '../db/meetups'
 import type { MeetupPhoto } from '../types'
 import { parseBackup, type BackupData, type ParseResult } from './format'
 
@@ -37,6 +38,8 @@ export async function replaceAllData(data: BackupData): Promise<void> {
     await db.meetups.bulkAdd(data.meetups)
     await db.meetupPhotos.bulkAdd(data.meetupPhotos)
   })
+  // Every photo was replaced, so no thumbnail kept in memory can be trusted.
+  forgetPhotoThumbs()
 }
 
 export async function parseBackupFile(file: Blob): Promise<ParseResult> {
```

Run: `npx vitest run src/backup/storage.test.ts`
Expected: `Tests  8 passed (8)`.

- [ ] **Step 10: Run everything**

Run: `npx tsc -b`
Expected: no output.

Run: `npm test`
Expected: `Test Files  58 passed (58)` and `Tests  711 passed (711)`.

Run: `npm run build`
Expected: passes; Vite ends with `dist/sw.js`.

- [ ] **Step 11: Commit**

```bash
git add src/stats/meetupHistory.ts src/stats/meetupHistory.test.ts src/stats/history.ts src/db/meetups.ts src/db/meetups.test.ts src/backup/storage.ts src/backup/storage.test.ts
git commit -F - <<'EOF'
feat: meetup history logic, a thumbnail cache, and which meetups have photos

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: One `MeetupRow` for a friend's History

Nothing visible changes once a thumbnail has loaded; a History row with a photo now shows its Linen box for a moment before the thumbnail instead of growing a line when it arrives.

**Files:**
- Create: `src/components/MeetupRow.tsx`, `src/components/MeetupRow.css`
- Modify: `src/components/InsetGroup.tsx`, `src/data/hooks.ts`, `src/screens/FriendDetailScreen.tsx`, `src/screens/FriendDetailScreen.css`
- Test: `e2e/detail.spec.ts`

- [ ] **Step 1: Write the failing e2e check for the thumbnail's box**

In `e2e/detail.spec.ts`, "history rows show activities and the first photo":

```diff
--- a/e2e/detail.spec.ts
+++ b/e2e/detail.spec.ts
@@ -32,8 +32,11 @@ test('history rows show activities and the first photo', async ({ page }) => {
   const history = page.getByRole('region', { name: 'History' })
   const meal = history.getByRole('link', { name: /Meal.*with Sam · Karaoke, Walk · Tacos/ })
   await expect(meal).toBeVisible()
-  await expect(meal.locator('img.history-thumb')).toHaveAttribute('src', /^data:image\/jpeg/)
-  await expect(history.getByRole('link', { name: /Coffee/ }).locator('img')).toHaveCount(0)
+  // The photo sits in its 40px box, which a row without a photo doesn't have.
+  await expect(meal.locator('.meetup-thumb img.history-thumb')).toHaveAttribute('src', /^data:image\/jpeg/)
+  const coffee = history.getByRole('link', { name: /Coffee/ })
+  await expect(coffee.locator('img')).toHaveCount(0)
+  await expect(coffee.locator('.meetup-thumb')).toHaveCount(0)
 })
 
 test('history rows show the day’s first places, or its first line cut at 80 characters', async ({ page }) => {
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx playwright test --project=iphone e2e/detail.spec.ts -g "first photo"`
Expected: `1 failed`, waiting for `.meetup-thumb img.history-thumb`.

- [ ] **Step 3: Give `Row` a ref**

React 19 passes `ref` as a prop; `Row` sets it on its `Link`. In `src/components/InsetGroup.tsx`:

```diff
--- a/src/components/InsetGroup.tsx
+++ b/src/components/InsetGroup.tsx
@@ -66,6 +66,8 @@ interface RowProps {
   chevron?: boolean
   accent?: boolean
   destructive?: boolean
+  /** The link, for moving focus to it from code (a `to` row only). */
+  ref?: Ref<HTMLAnchorElement>
 }
 
 export function Row({
@@ -82,6 +84,7 @@ export function Row({
   chevron,
   accent,
   destructive,
+  ref,
 }: RowProps) {
   const className = [
     'row',
@@ -111,7 +114,7 @@ export function Row({
 
   if (to) {
     return (
-      <Link to={to} state={state} className={className}>
+      <Link ref={ref} to={to} state={state} className={className}>
         {content}
       </Link>
     )
```

- [ ] **Step 4: Add `useMeetupIdsWithPhotos`**

In `src/data/hooks.ts` (Task 4 moves its live query into a provider; this version reads it per screen):

```diff
--- a/src/data/hooks.ts
+++ b/src/data/hooks.ts
@@ -1,6 +1,6 @@
 import { useLiveQuery } from 'dexie-react-hooks'
 import { db } from '../db/db'
-import { firstPhotoThumb, photoById, photoCount, photoThumbs } from '../db/meetups'
+import { firstPhotoThumb, meetupIdsWithPhotos, photoById, photoCount, photoThumbs } from '../db/meetups'
 import { getSetting, type Settings } from '../db/settings'
 import { compareNames } from '../lib/text'
 import type { Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'
@@ -46,11 +46,19 @@ export function useMeetupPhotoThumbs(meetupId: string | undefined): Pick<MeetupP
   return useLiveQuery(async () => (meetupId ? photoThumbs(meetupId) : []), [meetupId])
 }
 
-/** The thumbnail of a meetup's first photo, or null when it has none: a history row's picture. */
+/** The thumbnail of a meetup's first photo, or null when it has none: a meetup row's picture. */
 export function useFirstPhotoThumb(meetupId: string): string | null | undefined {
   return useLiveQuery(() => firstPhotoThumb(meetupId), [meetupId])
 }
 
+/**
+ * Which meetups have photos, so a meetup row knows from its first render whether it ends with a thumbnail. A
+ * key-only walk of an index: no photo is read.
+ */
+export function useMeetupIdsWithPhotos(): ReadonlySet<string> | undefined {
+  return useLiveQuery(async () => new Set(await meetupIdsWithPhotos()))
+}
+
 /** How many meetup photos are stored. Counts without reading any image. */
 export function usePhotoCount(): number | undefined {
   return useLiveQuery(() => photoCount())
```

- [ ] **Step 5: Write the shared row**

Create `src/components/MeetupRow.tsx`:

```tsx
import { memo, type Ref } from 'react'
import { useFirstPhotoThumb } from '../data/hooks'
import type { ISODate } from '../lib/dates'
import { meetupSubtitle } from '../stats/meetupHistory'
import type { Meetup, MeetupType } from '../types'
import { Row } from './InsetGroup'
import type { NavState } from './Page'
import './MeetupRow.css'

interface MeetupRowProps {
  meetup: Meetup
  /** Undefined when the meetup's type was deleted: the row then reads "Meetup" with ✨. */
  type: MeetupType | undefined
  /** The names after "with", in the meetup's order (see meetupNames). */
  names: string[]
  today: ISODate
  /** Router state for the Meetup page: its back label, and the tab it keeps. */
  state: NavState
  /** Whether the meetup has a photo (from useMeetupIdsWithPhotos), so the thumbnail's box is there from the start. */
  hasPhoto: boolean
  /** Stops the subtitle at this many lines (Recent meetups passes 2). Omitted: the whole subtitle wraps. */
  subtitleLines?: number
  /** The "Upcoming" badge on a future date. False under the Meetups page's "Upcoming" title. Default true. */
  showUpcoming?: boolean
  /** Lets the Meetups page move focus to this row. */
  ref?: Ref<HTMLAnchorElement>
}

/**
 * A meetup row's picture: the meetup's first photo, in a 40px box drawn from the first render, so the row's width
 * is final on first paint and a thumbnail arriving never moves the page. Each row reads only that thumbnail.
 */
export function MeetupThumb({ meetupId }: { meetupId: string }) {
  const thumb = useFirstPhotoThumb(meetupId)
  return (
    <span className="meetup-thumb" aria-hidden="true">
      {thumb && <img className="history-thumb" src={thumb} alt="" />}
    </span>
  )
}

/**
 * One row for a meetup, the same everywhere (a friend's History, Recent meetups, the Meetups page): the type's
 * badge and name, the subtitle, the first photo and a chevron. Tapping it opens the Meetup page.
 */
export const MeetupRow = memo(function MeetupRow({
  meetup,
  type,
  names,
  today,
  state,
  hasPhoto,
  subtitleLines,
  showUpcoming = true,
  ref,
}: MeetupRowProps) {
  const upcoming = showUpcoming && meetup.date > today
  const subtitle = meetupSubtitle(meetup, names, today)
  return (
    <Row
      ref={ref}
      to={`/meetups/${meetup.id}`}
      state={state}
      leading={
        <span className="emoji-badge" aria-hidden="true">
          {type?.emoji ?? '✨'}
        </span>
      }
      title={
        <>
          {type?.name ?? 'Meetup'}
          {upcoming && ' '}
          {upcoming && <span className="upcoming-badge">Upcoming</span>}
        </>
      }
      subtitle={
        subtitleLines ? (
          // The whole subtitle stays in the DOM, so the link's name (what VoiceOver reads) is the full text.
          <span className="meetup-row__clamp" style={{ WebkitLineClamp: subtitleLines }}>
            {subtitle}
          </span>
        ) : (
          subtitle
        )
      }
      trailing={hasPhoto ? <MeetupThumb meetupId={meetup.id} /> : undefined}
      chevron
    />
  )
})
```

Create `src/components/MeetupRow.css` (the `.history-thumb` rule moves here from `FriendDetailScreen.css`):

```css
/* A meetup row's first photo: a 40px Linen box from the first render, filled when the thumbnail arrives. */
.meetup-thumb {
  display: block;
  width: 40px;
  height: 40px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--surface-2);
}
.history-thumb {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--surface-2);
  object-fit: cover;
}

/* Recent meetups stops a subtitle at two lines, like a Mail preview; WebKit ends the last line with "…". */
.meetup-row__clamp {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

- [ ] **Step 6: Use it on the friend page**

In `src/screens/FriendDetailScreen.tsx`, the screen waits for the photo ids with its other data, and each History row names the others:

```diff
--- a/src/screens/FriendDetailScreen.tsx
+++ b/src/screens/FriendDetailScreen.tsx
@@ -5,28 +5,23 @@ import { Chip } from '../components/Chip'
 import { IconPlus } from '../components/icons'
 import { InsetGroup, Row, Section } from '../components/InsetGroup'
 import { LogButton } from '../components/LogButton'
+import { MeetupRow } from '../components/MeetupRow'
 import { MonthBars } from '../components/MonthBars'
 import { Page, type NavState } from '../components/Page'
 import { StatRow } from '../components/StatRow'
-import { useFirstPhotoThumb, useFriend, useFriends, useGroups, useMeetups, useMeetupTypes } from '../data/hooks'
+import { useFriend, useFriends, useGroups, useMeetupIdsWithPhotos, useMeetups, useMeetupTypes } from '../data/hooks'
 import { useToday } from '../hooks/useToday'
 import { describeNextBirthday, formatBirthday } from '../lib/birthdays'
 import { daysBetween, formatDate, formatMonthYear, yearOf } from '../lib/dates'
-import { daySnippet } from '../lib/dayText'
-import { formatNameList, formatSince } from '../lib/text'
+import { formatSince } from '../lib/text'
 import { useSheets } from '../sheets/sheetsContext'
 import { allTimeCountsByFriend, countsByFriendForYear, monthlyCounts } from '../stats/counts'
 import { groupByMonth } from '../stats/history'
 import { lastSeenByFriend } from '../stats/lastSeen'
+import { meetupNames } from '../stats/meetupHistory'
 import { FriendPreferences } from './FriendPreferences'
 import './FriendDetailScreen.css'
 
-/** A history row's picture: the meetup's first photo, when it has any. Each row reads only that thumbnail. */
-function HistoryThumb({ meetupId }: { meetupId: string }) {
-  const thumb = useFirstPhotoThumb(meetupId)
-  return thumb ? <img className="history-thumb" src={thumb} alt="" /> : null
-}
-
 export function FriendDetailScreen() {
   const { id } = useParams()
   const friend = useFriend(id)
@@ -34,6 +29,7 @@ export function FriendDetailScreen() {
   const groups = useGroups()
   const meetups = useMeetups()
   const types = useMeetupTypes()
+  const withPhotos = useMeetupIdsWithPhotos()
   const today = useToday()
   const location = useLocation()
   const { openFriendSheet } = useSheets()
@@ -55,7 +51,7 @@ export function FriendDetailScreen() {
   }, [friend, meetups, today])
 
   if (friend === null) return <Navigate to="/" replace />
-  if (!friend || !friends || !groups || !types || !data) return null
+  if (!friend || !friends || !groups || !types || !withPhotos || !data) return null
 
   const groupName = groups.find((group) => group.id === friend.groupId)?.name
   const typeById = new Map(types.map((type) => [type.id, type] as const))
@@ -138,41 +134,18 @@ export function FriendDetailScreen() {
         ) : (
           data.history.map(({ month, meetups: monthMeetups }) => (
             <InsetGroup key={month} title={formatMonthYear(`${month}-01`)} level={3}>
-              {monthMeetups.map((meetup) => {
-                const type = typeById.get(meetup.typeId)
-                const others = meetup.friendIds
-                  .filter((friendId) => friendId !== friend.id)
-                  .map((friendId) => nameById.get(friendId))
-                  .filter((name): name is string => name !== undefined)
-                return (
-                  <Row
-                    key={meetup.id}
-                    to={`/meetups/${meetup.id}`}
-                    state={fromFriend}
-                    leading={
-                      <span className="emoji-badge" aria-hidden="true">
-                        {type?.emoji ?? '✨'}
-                      </span>
-                    }
-                    title={
-                      <>
-                        {type?.name ?? 'Meetup'}{meetup.date > today && ' '}
-                        {meetup.date > today && <span className="upcoming-badge">Upcoming</span>}
-                      </>
-                    }
-                    subtitle={[
-                      formatDate(meetup.date, today),
-                      others.length > 0 ? `with ${formatNameList(others)}` : null,
-                      meetup.activities.length > 0 ? meetup.activities.join(', ') : null,
-                      daySnippet(meetup.note),
-                    ]
-                      .filter(Boolean)
-                      .join(' · ')}
-                    trailing={<HistoryThumb meetupId={meetup.id} />}
-                    chevron
-                  />
-                )
-              })}
+              {monthMeetups.map((meetup) => (
+                // "with" leaves out the friend this page is about.
+                <MeetupRow
+                  key={meetup.id}
+                  meetup={meetup}
+                  type={typeById.get(meetup.typeId)}
+                  names={meetupNames(meetup, nameById, friend.id)}
+                  today={today}
+                  state={fromFriend}
+                  hasPhoto={withPhotos.has(meetup.id)}
+                />
+              ))}
             </InsetGroup>
           ))
         )}
```

In `src/screens/FriendDetailScreen.css`:

```diff
--- a/src/screens/FriendDetailScreen.css
+++ b/src/screens/FriendDetailScreen.css
@@ -38,12 +38,3 @@
   white-space: pre-wrap;
   overflow-wrap: anywhere;
 }
-
-/* The first photo of a meetup, at the end of its history row. */
-.history-thumb {
-  width: 40px;
-  height: 40px;
-  border-radius: 8px;
-  background: var(--surface-2);
-  object-fit: cover;
-}
```

- [ ] **Step 7: Run the friend page tests**

Run: `npx playwright test --project=iphone e2e/detail.spec.ts`
Expected: `11 passed`.

- [ ] **Step 8: Run everything**

Run: `npx tsc -b`, then `npm test`
Expected: `Test Files  58 passed (58)` and `Tests  711 passed (711)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `158 passed`.

- [ ] **Step 9: Commit**

```bash
git add src/components/InsetGroup.tsx src/components/MeetupRow.tsx src/components/MeetupRow.css src/data/hooks.ts src/screens/FriendDetailScreen.tsx src/screens/FriendDetailScreen.css e2e/detail.spec.ts
git commit -F - <<'EOF'
refactor: one MeetupRow for a friend's history, with a thumbnail box from the first render

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Recent meetups on the Friends tab

**Files:**
- Modify: `src/screens/FriendsScreen.tsx`
- Create: `e2e/history.spec.ts` (the Friends tab tests)
- Modify: `e2e/helpers.ts`, `e2e/detail.spec.ts`, `e2e/meetups.spec.ts`, `e2e/settings.spec.ts`, `e2e/screenshots.spec.ts`

- [ ] **Step 1: Add the e2e helpers**

`friendLink` finds a friend row by the start of its name (a meetup row's name starts with its type), and `seedMeetups` writes complete rows in one transaction. In `e2e/helpers.ts`:

```diff
--- a/e2e/helpers.ts
+++ b/e2e/helpers.ts
@@ -143,7 +143,7 @@ export async function addPhotos(sheet: Locator, files: PhotoFile[]) {
 /** Opens a friend's page from the Friends tab. */
 export async function openFriendPage(page: Page, name: string) {
   await goToTab(page, 'Friends')
-  await page.getByRole('link', { name: new RegExp(name) }).click()
+  await friendLink(page, name).click()
   await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
 }
 
@@ -489,3 +489,139 @@ export async function stubPush(page: Page, { answer = 'granted' }: { answer?: No
     { answer, subscription: FAKE_SUBSCRIPTION, storeKey: FAKE_SUBSCRIPTION_KEY },
   )
 }
+
+/** "a.b" as a pattern that matches only "a.b". */
+function escapeRegExp(text: string): string {
+  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
+}
+
+/**
+ * A friend's row on the Friends tab (or Birthdays soon) by the friend's name. A friend row's name starts with the
+ * friend's name (the avatar is hidden); a meetup row's starts with its type, so "with Alex" never matches.
+ */
+export function friendLink(page: Page, name: string): Locator {
+  return page.getByRole('link', { name: new RegExp(`^${escapeRegExp(name)}`) })
+}
+
+/** A friend as IndexedDB stores it, for seedMeetups. */
+export interface SeedFriend {
+  id: string
+  name: string
+  groupId: string | null
+  photo: string | null
+  notes: string
+  likes: string[]
+  dislikes: string[]
+  birthday: { month: number; day: number; year: number | null } | null
+  createdAt: string
+}
+
+/** A meetup as IndexedDB stores it, for seedMeetups. */
+export interface SeedMeetup {
+  id: string
+  date: string
+  typeId: string
+  friendIds: string[]
+  note: string
+  activities: string[]
+  weather: string[]
+  mood: string | null
+  feelings: string
+  createdAt: string
+}
+
+/** A meetup photo as IndexedDB stores it, for seedMeetups. */
+export interface SeedPhoto {
+  id: string
+  meetupId: string
+  order: number
+  full: string
+  thumb: string
+  width: number
+  height: number
+  createdAt: string
+}
+
+/** A complete friend row with nothing filled in but what's given. */
+export function friendRow(id: string, name: string, fields: Partial<SeedFriend> = {}): SeedFriend {
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
+    ...fields,
+  }
+}
+
+/** A complete meetup row: a Coffee (one of the default types) unless `typeId` says otherwise, logged at noon UTC. */
+export function meetupRow(
+  id: string,
+  date: string,
+  friendIds: string[],
+  fields: Partial<SeedMeetup> = {},
+): SeedMeetup {
+  return {
+    id,
+    date,
+    typeId: 'type-coffee',
+    friendIds,
+    note: '',
+    activities: [],
+    weather: [],
+    mood: null,
+    feelings: '',
+    createdAt: `${date}T12:00:00.000Z`,
+    ...fields,
+  }
+}
+
+/** A meetup's first photo: the 1×1 PNG as both the full image and the thumbnail. */
+export function photoRow(id: string, meetupId: string): SeedPhoto {
+  const image = `data:image/png;base64,${ONE_PIXEL_PNG}`
+  return { id, meetupId, order: 0, full: image, thumb: image, width: 1, height: 1, createdAt: '2026-09-01T12:00:00Z' }
+}
+
+/**
+ * Writes friends, groups, meetups and photos straight into IndexedDB in one transaction, skipping the app's
+ * checks (so every row must be complete), then reloads so the app reads them. Call it after the first
+ * `page.goto`, once the app has created its stores.
+ */
+export async function seedMeetups(
+  page: Page,
+  seed: {
+    friends?: SeedFriend[]
+    groups?: { id: string; name: string }[]
+    meetups?: SeedMeetup[]
+    photos?: SeedPhoto[]
+  },
+) {
+  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
+  await page.evaluate(
+    async ({ friends, groups, meetups, photos }) => {
+      await new Promise<void>((resolve, reject) => {
+        const request = indexedDB.open('friend-tracker')
+        request.onerror = () => reject(request.error)
+        request.onsuccess = () => {
+          const database = request.result
+          const transaction = database.transaction(['friends', 'groups', 'meetups', 'meetupPhotos'], 'readwrite')
+          for (const row of friends) transaction.objectStore('friends').put(row)
+          for (const row of groups) transaction.objectStore('groups').put(row)
+          for (const row of meetups) transaction.objectStore('meetups').put(row)
+          for (const row of photos) transaction.objectStore('meetupPhotos').put(row)
+          transaction.oncomplete = () => {
+            database.close()
+            resolve()
+          }
+          transaction.onerror = () => reject(transaction.error)
+        }
+      })
+    },
+    { friends: seed.friends ?? [], groups: seed.groups ?? [], meetups: seed.meetups ?? [], photos: seed.photos ?? [] },
+  )
+  await page.reload()
+}
```

- [ ] **Step 2: Write the failing Friends tab tests**

Create `e2e/history.spec.ts` (Task 4 adds the Meetups page tests to it):

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { friendLink, friendRow, logMeetup, meetupRow, photoRow, seedMeetups } from './helpers.ts'

/** Mon, Oct 5, 2026, 12:00 PM on the phone's clock. */
const MONDAY_NOON = new Date(2026, 9, 5, 12)

const ALEX = friendRow('alex', 'Alex')
const SAM = friendRow('sam', 'Sam')
const KIM = friendRow('kim', 'Kim')

// Four meetups that happened, newest first: Drinks, Meal, Coffee, Call. And one upcoming Party.
const DRINKS = meetupRow('drinks', '2026-10-04', ['kim'], { typeId: 'type-drinks' })
const MEAL = meetupRow('meal', '2026-10-03', ['alex', 'sam'], { typeId: 'type-meal', note: 'Tacos' })
const COFFEE = meetupRow('coffee', '2026-09-25', ['alex'])
const CALL = meetupRow('call', '2026-09-05', ['sam'], { typeId: 'type-call' })
const PARTY = meetupRow('party', '2026-10-08', ['kim'], { typeId: 'type-party' })
const PAST = [DRINKS, MEAL, COFFEE, CALL]

function recentGroup(page: Page): Locator {
  return page.getByRole('region', { name: 'Recent meetups' })
}

/** On Mon, Oct 5, at noon: opens the app and seeds it. */
async function openWith(page: Page, seed: Parameters<typeof seedMeetups>[1]) {
  await page.clock.setFixedTime(MONDAY_NOON)
  await page.goto('/')
  await seedMeetups(page, seed)
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
}

/** The top of an element on screen, in CSS pixels. */
async function topOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Not on screen')
  return box.y
}

/** The top of the first element matching `selector`, read on each of the next `frames` animation frames. */
function topsOverFrames(page: Page, selector: string, frames = 10): Promise<number[]> {
  return page.evaluate(
    ({ selector, frames }) =>
      new Promise<number[]>((resolve) => {
        const element = document.querySelector(selector)
        if (!element) throw new Error(`No ${selector}`)
        const tops: number[] = []
        const read = () => {
          tops.push(element.getBoundingClientRect().top)
          if (tops.length < frames) requestAnimationFrame(read)
          else resolve(tops)
        }
        requestAnimationFrame(read)
      }),
    { selector, frames },
  )
}

test('Recent meetups shows the three latest that happened, naming everyone', async ({ page }) => {
  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: [...PAST, PARTY] })
  const recent = recentGroup(page)
  await expect(recent.locator('.row__title')).toHaveText(['Drinks', 'Meal', 'Coffee', 'See all meetups'])
  await expect(recent.getByRole('link', { name: /^Meal/ })).toHaveAccessibleName(
    /^Meal\s*Sat, Oct 3 · with Alex and Sam · Tacos$/,
  )
  await expect(recent).not.toContainText('Party')
  await expect(recent).not.toContainText('Call')
})

test('Recent meetups shows two while Birthdays soon shows', async ({ page }) => {
  const lee = friendRow('lee', 'Lee', { birthday: { month: 10, day: 8, year: null } })
  await openWith(page, { friends: [ALEX, SAM, KIM, lee], meetups: PAST })
  await expect(page.getByRole('region', { name: 'Birthdays soon' })).toContainText('Lee')
  await expect(recentGroup(page).locator('.row__title')).toHaveText(['Drinks', 'Meal', 'See all meetups'])

  // Two weeks on, no birthday is near: the third row comes back.
  await page.clock.setFixedTime(new Date(2026, 9, 20, 12))
  await page.reload()
  await expect(recentGroup(page).locator('.row__title')).toHaveText(['Drinks', 'Meal', 'Coffee', 'See all meetups'])
  await expect(page.getByRole('region', { name: 'Birthdays soon' })).toHaveCount(0)
})

test('Recent meetups hides while searching or filtering, and until a meetup has happened', async ({ page }) => {
  const work = { id: 'work', name: 'Work' }
  await openWith(page, { friends: [ALEX, { ...KIM, groupId: 'work' }], groups: [work], meetups: [PARTY] })
  await expect(friendLink(page, 'Alex')).toBeVisible()
  await expect(recentGroup(page)).toHaveCount(0)

  await logMeetup(page, ['Kim'], { date: '2026-10-01' })
  await expect(recentGroup(page).locator('.row__title')).toHaveText(['Coffee', 'See all meetups'])

  const search = page.getByLabel('Search friends')
  await search.fill('k')
  await expect(recentGroup(page)).toHaveCount(0)
  await search.fill('')
  await expect(recentGroup(page)).toBeVisible()

  const chips = page.getByRole('group', { name: 'Filter by group' })
  await chips.getByRole('button', { name: 'Work', exact: true }).click()
  await expect(recentGroup(page)).toHaveCount(0)
  await chips.getByRole('button', { name: 'All', exact: true }).click()
  await expect(recentGroup(page)).toBeVisible()
})

test('the search field stays put while the groups above it hide and come back', async ({ page }) => {
  const names = ['Aaron', 'Abby', 'Adam', 'Alana', 'Bianca', 'Carla', 'Dana', 'Ezra', 'Farah', 'Gina', 'Hana', 'Jada']
  // All in one group, so the page stays long enough to keep the field still on a search and on the group's chip.
  const friends = [
    ...names.map((name) => friendRow(name.toLowerCase(), name, { groupId: 'work' })),
    // In 3 days, so Birthdays soon shows.
    friendRow('lee', 'Lee', { birthday: { month: 10, day: 8, year: null } }),
  ]
  // About 33 characters: one line without a thumbnail, two with one.
  const meetups = [
    meetupRow('ramen', '2026-10-04', ['aaron'], { note: 'Ramen' }),
    meetupRow('tacos', '2026-10-03', ['bianca'], { typeId: 'type-meal', note: 'Tacos' }),
  ]
  await openWith(page, {
    friends,
    groups: [{ id: 'work', name: 'Work' }],
    meetups,
    photos: [photoRow('ramen-photo', 'ramen')],
  })
  await expect(page.getByRole('region', { name: 'Birthdays soon' })).toBeVisible()
  await expect(recentGroup(page).locator('img.history-thumb')).toHaveCount(1)

  // The search field just under the nav bar.
  const field = page.locator('.friends-filters .search')
  await page.evaluate(() => {
    const navbar = document.querySelector('header.navbar')!.getBoundingClientRect().bottom
    const top = document.querySelector('.friends-filters .search')!.getBoundingClientRect().top
    window.scrollBy(0, top - navbar - 8)
  })
  const start = await topOf(field)

  const search = page.getByLabel('Search friends')
  await search.fill('a')
  await expect(recentGroup(page)).toHaveCount(0)
  expect(Math.abs((await topOf(field)) - start), 'The field stays put when the groups hide').toBeLessThanOrEqual(4)
  await expect(page.locator('.friends-filters + .inset-group').getByRole('link').first()).toBeInViewport()

  await search.fill('')
  await expect(recentGroup(page)).toBeVisible()
  expect(Math.abs((await topOf(field)) - start), 'The field stays put when they come back').toBeLessThanOrEqual(4)
  await expect(page.locator('.friends-filters + .inset-group').getByRole('link').first()).toBeInViewport()
  // While Recent meetups comes back and its thumbnail arrives.
  for (const top of await topsOverFrames(page, '.friends-filters .search')) {
    expect(Math.abs(top - start), 'The field stays put as the thumbnail arrives').toBeLessThanOrEqual(4)
  }
  await expect(recentGroup(page).locator('img.history-thumb')).toHaveCount(1)

  const chips = page.getByRole('group', { name: 'Filter by group' })
  const chipsTop = await topOf(chips)
  await chips.getByRole('button', { name: 'Work', exact: true }).click()
  await expect(recentGroup(page)).toHaveCount(0)
  expect(Math.abs((await topOf(chips)) - chipsTop), 'The chips stay put on a group').toBeLessThanOrEqual(4)
  await chips.getByRole('button', { name: 'All', exact: true }).click()
  await expect(recentGroup(page)).toBeVisible()
  expect(Math.abs((await topOf(chips)) - chipsTop), 'The chips stay put on All').toBeLessThanOrEqual(4)
})

test('a recent meetup opens its page with "Friends" on the back button', async ({ page }) => {
  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: PAST })
  await recentGroup(page).getByRole('link', { name: /^Meal/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  const back = page.locator('header.navbar .navbar__back')
  await expect(back).toHaveText('Friends')
  await back.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  await expect(recentGroup(page)).toBeVisible()
})

test('the friend page still leaves its friend out', async ({ page }) => {
  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: PAST })
  const meal = recentGroup(page).getByRole('link', { name: /^Meal/ })
  await expect(meal).toHaveAccessibleName(/· with Alex and Sam · Tacos$/)
  await friendLink(page, 'Alex').click()
  await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
  const history = page.getByRole('region', { name: 'History' })
  await expect(history.getByRole('link', { name: /^Meal/ })).toHaveAccessibleName(/· with Sam · Tacos$/)
})
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx playwright test --project=iphone e2e/history.spec.ts`
Expected: `6 failed` (there's no "Recent meetups" region yet).

- [ ] **Step 4: Show Recent meetups and keep the search field still**

In `src/screens/FriendsScreen.tsx`: `unfiltered` and `showBirthdaysSoon` move above the early return; `recent` asks for 2 rows while Birthdays soon shows and 3 otherwise; a ref on `.friends-filters` records the field's top in the search's `onChange` and the chips' `onClick` when the change will hide or show the groups, and a layout effect keyed on `unfiltered` scrolls by the difference before paint:

```diff
--- a/src/screens/FriendsScreen.tsx
+++ b/src/screens/FriendsScreen.tsx
@@ -1,4 +1,4 @@
-import { useMemo, useState } from 'react'
+import { useLayoutEffect, useMemo, useRef, useState } from 'react'
 import { useActionSheet } from '../components/ActionSheet'
 import { Avatar } from '../components/Avatar'
 import { Chip } from '../components/Chip'
@@ -7,8 +7,9 @@ import { IconPlus, IconSearch, IconSort } from '../components/icons'
 import { InsetGroup, Row } from '../components/InsetGroup'
 import { LogButton } from '../components/LogButton'
 import { InstallHint } from '../components/InstallHint'
-import { Page } from '../components/Page'
-import { useFriends, useGroups, useMeetups, useSetting } from '../data/hooks'
+import { MeetupRow } from '../components/MeetupRow'
+import { Page, type NavState } from '../components/Page'
+import { useFriends, useGroups, useMeetupIdsWithPhotos, useMeetups, useMeetupTypes, useSetting } from '../data/hooks'
 import { setSetting } from '../db/settings'
 import { useToday } from '../hooks/useToday'
 import { describeNextBirthday, upcomingBirthdays } from '../lib/birthdays'
@@ -20,6 +21,7 @@ import { formatSince } from '../lib/text'
 import { useSheets } from '../sheets/sheetsContext'
 import { countsByFriendForYear } from '../stats/counts'
 import { lastSeenByFriend } from '../stats/lastSeen'
+import { meetupNames, RECENT_MEETUPS, RECENT_MEETUPS_WITH_BIRTHDAYS, recentMeetups } from '../stats/meetupHistory'
 import { FRIEND_SORT_LABELS, sortFriends, type FriendSort } from '../stats/sortFriends'
 import './FriendsScreen.css'
 
@@ -27,6 +29,8 @@ const SORT_KEY = 'friend-tracker:sort'
 const SORTS = Object.keys(FRIEND_SORT_LABELS) as FriendSort[]
 /** The most rows Birthdays soon shows. Its footer counts the rest. */
 const MAX_BIRTHDAYS_SOON = 3
+/** A meetup opened from Recent meetups says "Friends" on its back button. */
+const FROM_FRIENDS: NavState = { backLabel: 'Friends' }
 
 function readStoredSort(): FriendSort {
   try {
@@ -50,6 +54,8 @@ export function FriendsScreen() {
   const friends = useFriends()
   const groups = useGroups()
   const meetups = useMeetups()
+  const types = useMeetupTypes()
+  const withPhotos = useMeetupIdsWithPhotos()
   const hintDismissed = useSetting('installHintDismissed')
   const today = useToday()
   const { openFriendSheet } = useSheets()
@@ -57,8 +63,13 @@ export function FriendsScreen() {
   const [query, setQuery] = useState('')
   const [groupFilter, setGroupFilter] = useState<string | null>(null)
   const [sort, setSort] = useState<FriendSort>(readStoredSort)
+  const filtersRef = useRef<HTMLDivElement>(null)
+  // Where the search field was before a search or a chip hid or showed the groups above it.
+  const filtersTopBefore = useRef<number | null>(null)
 
   const activeGroup = groups?.find((group) => group.id === groupFilter) ?? null
+  // Searching or filtering hides Birthdays soon and Recent meetups, so the list below stays a plain filtered list.
+  const unfiltered = query.trim() === '' && activeGroup === null
   const groupNames = useMemo(() => new Map((groups ?? []).map((group) => [group.id, group.name] as const)), [groups])
 
   const rows = useMemo(() => {
@@ -75,6 +86,32 @@ export function FriendsScreen() {
   }, [friends, meetups, today, sort, activeGroup, query])
 
   const birthdaysSoon = useMemo(() => upcomingBirthdays(friends ?? [], today), [friends, today])
+  const showBirthdaysSoon = birthdaysSoon.length > 0 && unfiltered
+  // Recent meetups gives up a row while Birthdays soon shows above it, so the search field stays nearer the top.
+  const recent = useMemo(
+    () => recentMeetups(meetups ?? [], today, showBirthdaysSoon ? RECENT_MEETUPS_WITH_BIRTHDAYS : RECENT_MEETUPS),
+    [meetups, today, showBirthdaysSoon],
+  )
+  const nameById = useMemo(() => new Map((friends ?? []).map((friend) => [friend.id, friend.name] as const)), [friends])
+  const typeById = useMemo(() => new Map((types ?? []).map((type) => [type.id, type] as const)), [types])
+
+  // Safari has no scroll anchoring, so when the groups above the search field hide or come back, the page
+  // scrolls by what went away or came back, before paint: the field stays where your eyes are. The browser clamps
+  // the scroll at the top and bottom of the page, so there the field can come to rest a little off, never off screen.
+  useLayoutEffect(() => {
+    const before = filtersTopBefore.current
+    filtersTopBefore.current = null
+    const filters = filtersRef.current
+    if (before === null || !filters) return
+    window.scrollBy(0, filters.getBoundingClientRect().top - before)
+  }, [unfiltered])
+
+  /** Before a search or chip change: notes where the field is when the change will hide or show the groups. */
+  function keepFiltersStill(nextUnfiltered: boolean) {
+    if (nextUnfiltered !== unfiltered && filtersRef.current) {
+      filtersTopBefore.current = filtersRef.current.getBoundingClientRect().top
+    }
+  }
 
   async function chooseSort() {
     const choice = await showActionSheet<FriendSort>({
@@ -87,10 +124,8 @@ export function FriendsScreen() {
     }
   }
 
-  if (!friends || !groups || !meetups || hintDismissed === undefined) return null
+  if (!friends || !groups || !meetups || !types || !withPhotos || hintDismissed === undefined) return null
 
-  // Hidden while searching or filtering, so the list below stays a plain filtered list.
-  const showBirthdaysSoon = birthdaysSoon.length > 0 && query.trim() === '' && activeGroup === null
   const moreBirthdays = birthdaysSoon.length - MAX_BIRTHDAYS_SOON
 
   return (
@@ -145,7 +180,25 @@ export function FriendsScreen() {
             </InsetGroup>
           )}
 
-          <div className="friends-filters">
+          {unfiltered && recent.length > 0 && (
+            <InsetGroup title="Recent meetups">
+              {recent.map((meetup) => (
+                <MeetupRow
+                  key={meetup.id}
+                  meetup={meetup}
+                  type={typeById.get(meetup.typeId)}
+                  names={meetupNames(meetup, nameById)}
+                  today={today}
+                  state={FROM_FRIENDS}
+                  hasPhoto={withPhotos.has(meetup.id)}
+                  subtitleLines={2}
+                />
+              ))}
+              <Row to="/meetups" title="See all meetups" accent chevron />
+            </InsetGroup>
+          )}
+
+          <div className="friends-filters" ref={filtersRef}>
             <label className="search">
               <IconSearch size={18} />
               <input
@@ -155,7 +208,11 @@ export function FriendsScreen() {
                 aria-label="Search friends"
                 enterKeyHint="search"
                 value={query}
-                onChange={(event) => setQuery(event.target.value)}
+                onChange={(event) => {
+                  const value = event.target.value
+                  keepFiltersStill(value.trim() === '' && activeGroup === null)
+                  setQuery(value)
+                }}
                 onKeyDown={(event) => {
                   if (isPlainEnter(event)) event.currentTarget.blur()
                 }}
@@ -163,14 +220,23 @@ export function FriendsScreen() {
             </label>
             {groups.length > 0 && (
               <div className="chip-row" role="group" aria-label="Filter by group">
-                <Chip selected={activeGroup === null} onClick={() => setGroupFilter(null)}>
+                <Chip
+                  selected={activeGroup === null}
+                  onClick={() => {
+                    keepFiltersStill(query.trim() === '')
+                    setGroupFilter(null)
+                  }}
+                >
                   All
                 </Chip>
                 {groups.map((group) => (
                   <Chip
                     key={group.id}
                     selected={activeGroup?.id === group.id}
-                    onClick={() => setGroupFilter(group.id)}
+                    onClick={() => {
+                      keepFiltersStill(false)
+                      setGroupFilter(group.id)
+                    }}
                   >
                     {group.name}
                   </Chip>
```

- [ ] **Step 5: Run them to see them pass**

Run: `npx playwright test --project=iphone e2e/history.spec.ts`
Expected: `6 passed`. (With the `scrollBy` line taken out, "the search field stays put" fails: the field moves about 345px.)

- [ ] **Step 6: Find friend rows by name in the tests that log a meetup**

Recent meetups names friends ("with Alex and Sam"), so loose name patterns on the Friends tab also find a meetup row. `openFriendPage` already uses `friendLink` (Step 1). In `e2e/detail.spec.ts`:

```diff
--- a/e2e/detail.spec.ts
+++ b/e2e/detail.spec.ts
@@ -1,12 +1,12 @@
 import { expect, test } from '@playwright/test'
-import { addFriend, LARGE_TEXT, logMeetup, tinyPhoto } from './helpers.ts'
+import { addFriend, friendLink, LARGE_TEXT, logMeetup, tinyPhoto } from './helpers.ts'
 
 test('shows a friend’s stats and history', async ({ page }) => {
   await page.goto('/')
   await addFriend(page, 'Alex')
   await addFriend(page, 'Sam')
   await logMeetup(page, ['Alex', 'Sam'], { type: 'Meal', note: 'Tacos' })
-  await page.getByRole('link', { name: /Alex/ }).click()
+  await friendLink(page, 'Alex').click()
 
   await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
   await expect(page.getByText(/^Last seen .* · Today$/)).toBeVisible()
@@ -27,7 +27,7 @@ test('history rows show activities and the first photo', async ({ page }) => {
     photos: [tinyPhoto('one.png'), tinyPhoto('two.png')],
   })
   await logMeetup(page, ['Alex'])
-  await page.getByRole('link', { name: /Alex/ }).click()
+  await friendLink(page, 'Alex').click()
 
   const history = page.getByRole('region', { name: 'History' })
   const meal = history.getByRole('link', { name: /Meal.*with Sam · Karaoke, Walk · Tacos/ })
@@ -46,7 +46,7 @@ test('history rows show the day’s first places, or its first line cut at 80 ch
   await logMeetup(page, ['Alex', 'Sam'], { type: 'Meal', note: '@Cafe 10:30\nCoffee\n@Park\n@Bar 7pm\n@cafe\n@Gym' })
   const long = 'We walked all the way along the river to the old bridge and back again before dinner'
   await logMeetup(page, ['Alex'], { type: 'Drinks', note: `${long}\nSecond line` })
-  await page.getByRole('link', { name: /Alex/ }).click()
+  await friendLink(page, 'Alex').click()
 
   const history = page.getByRole('region', { name: 'History' })
   await expect(history.getByRole('link', { name: /Meal/ })).toHaveAccessibleName(
@@ -60,7 +60,7 @@ test('history rows show the day’s first places, or its first line cut at 80 ch
 test('logs from the friend page with them preselected', async ({ page }) => {
   await page.goto('/')
   await addFriend(page, 'Alex')
-  await page.getByRole('link', { name: /Alex/ }).click()
+  await friendLink(page, 'Alex').click()
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
   await expect(sheet.getByRole('button', { name: 'Remove Alex' })).toBeVisible()
@@ -72,7 +72,7 @@ test('logs from the friend page with them preselected', async ({ page }) => {
 test('the meetup just logged scrolls clear of its toast and opens with one tap', async ({ page }) => {
   await page.goto('/')
   await addFriend(page, 'Alex')
-  await page.getByRole('link', { name: /Alex/ }).click()
+  await friendLink(page, 'Alex').click()
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
   await sheet.getByRole('button', { name: 'Save', exact: true }).click()
@@ -102,7 +102,7 @@ test('at large text, the meetup just logged scrolls clear of a toast that wraps,
   await page.addStyleTag({ content: LARGE_TEXT })
   const name = 'Bartholomew Fitzgerald-Montgomery'
   await addFriend(page, name)
-  await page.getByRole('link', { name: new RegExp(name) }).click()
+  await friendLink(page, name).click()
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
   await sheet.getByRole('button', { name: 'Save', exact: true }).click()
@@ -132,7 +132,7 @@ test('at large text, the room for a toast that wrapped stays after it goes, unti
   await page.addStyleTag({ content: LARGE_TEXT })
   const name = 'Bartholomew Fitzgerald-Montgomery'
   await addFriend(page, name)
-  await page.getByRole('link', { name: new RegExp(name) }).click()
+  await friendLink(page, name).click()
   await page.getByRole('button', { name: 'Log meetup' }).click()
   const sheet = page.getByRole('dialog', { name: 'Log meetup' })
   await sheet.getByRole('button', { name: 'Save', exact: true }).click()
@@ -164,7 +164,7 @@ test('edits a meetup from its page, then deletes it with undo', async ({ page })
   await page.goto('/')
   await addFriend(page, 'Alex')
   await logMeetup(page, ['Alex'])
-  await page.getByRole('link', { name: /Alex/ }).click()
+  await friendLink(page, 'Alex').click()
   const history = page.getByRole('region', { name: 'History' })
 
   await history.getByRole('link', { name: /Coffee/ }).click()
@@ -188,7 +188,7 @@ test('edits a meetup from its page, then deletes it with undo', async ({ page })
 test('edits and deletes a friend', async ({ page }) => {
   await page.goto('/')
   await addFriend(page, 'Alex')
-  await page.getByRole('link', { name: /Alex/ }).click()
+  await friendLink(page, 'Alex').click()
 
   await page.getByRole('button', { name: 'Edit', exact: true }).click()
   const sheet = page.getByRole('dialog', { name: 'Edit friend' })
@@ -207,7 +207,7 @@ test('shows a future meetup as upcoming without counting it', async ({ page }) =
   await page.goto('/')
   await addFriend(page, 'Alex')
   await logMeetup(page, ['Alex'], { date: '2099-01-01' })
-  await page.getByRole('link', { name: /Alex/ }).click()
+  await friendLink(page, 'Alex').click()
 
   await expect(page.getByText('Not seen yet')).toBeVisible()
   await expect(page.locator('.stat-row__item').first()).toHaveText(/This year\s*0$/)
```

In `e2e/meetups.spec.ts` ("sorts friends by most seen this year" scopes its titles to the friend rows):

```diff
--- a/e2e/meetups.spec.ts
+++ b/e2e/meetups.spec.ts
@@ -1,5 +1,5 @@
 import { expect, test } from '@playwright/test'
-import { addFriend, logMeetup } from './helpers.ts'
+import { addFriend, friendLink, logMeetup } from './helpers.ts'
 
 test('logs a meetup with two friends', async ({ page }) => {
   await page.goto('/')
@@ -8,9 +8,9 @@ test('logs a meetup with two friends', async ({ page }) => {
   await addFriend(page, 'Kim')
   await logMeetup(page, ['Alex', 'Sam'], { type: 'Meal' })
   await expect(page.getByRole('status')).toContainText('Logged with Alex and Sam')
-  await expect(page.getByRole('link', { name: /Alex/ })).toContainText('Today')
-  await expect(page.getByRole('link', { name: /Sam/ })).toContainText('Today')
-  await expect(page.getByRole('link', { name: /Kim/ })).toContainText('Not seen yet')
+  await expect(friendLink(page, 'Alex')).toContainText('Today')
+  await expect(friendLink(page, 'Sam')).toContainText('Today')
+  await expect(friendLink(page, 'Kim')).toContainText('Not seen yet')
 })
 
 test('undo removes the meetup', async ({ page }) => {
@@ -18,7 +18,7 @@ test('undo removes the meetup', async ({ page }) => {
   await addFriend(page, 'Alex')
   await logMeetup(page, ['Alex'])
   await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
-  await expect(page.getByRole('link', { name: /Alex/ })).toContainText('Not seen yet')
+  await expect(friendLink(page, 'Alex')).toContainText('Not seen yet')
 })
 
 test('Save waits for a friend to be picked', async ({ page }) => {
@@ -35,7 +35,7 @@ test('logs a meetup on another date', async ({ page }) => {
   await page.goto('/')
   await addFriend(page, 'Alex')
   await logMeetup(page, ['Alex'], { date: '2025-03-14' })
-  await expect(page.getByRole('link', { name: /Alex/ }).locator('.row__subtitle')).toContainText(/years? ago/)
+  await expect(friendLink(page, 'Alex').locator('.row__subtitle')).toContainText(/years? ago/)
 })
 
 test('asks before discarding a started meetup', async ({ page }) => {
@@ -54,7 +54,8 @@ test('sorts friends by most seen this year', async ({ page }) => {
   await addFriend(page, 'Amy')
   await addFriend(page, 'Zoe')
   await logMeetup(page, ['Zoe'])
-  const names = page.locator('.row__title')
+  // The friend rows only: Recent meetups above them now holds the Coffee and "See all meetups".
+  const names = page.getByRole('link', { name: /^(Amy|Zoe)/ }).locator('.row__title')
   await expect(names).toHaveText(['Amy', 'Zoe'])
   await page.getByRole('button', { name: /^Sort/ }).click()
   await page.getByRole('dialog', { name: 'Sort friends by' }).getByRole('button', { name: 'Most seen this year' }).click()
```

In `e2e/settings.spec.ts`:

```diff
--- a/e2e/settings.spec.ts
+++ b/e2e/settings.spec.ts
@@ -1,5 +1,5 @@
 import { expect, test } from '@playwright/test'
-import { addFriend, goToTab, logMeetup } from './helpers.ts'
+import { addFriend, friendLink, goToTab, logMeetup } from './helpers.ts'
 
 test('manages groups', async ({ page }) => {
   await page.goto('/#/settings/groups')
@@ -74,8 +74,8 @@ test('exports and imports a backup', async ({ page }) => {
   await expect(page.getByRole('status')).toContainText('Backup restored')
 
   await goToTab(page, 'Friends')
-  await expect(page.getByRole('link', { name: /Alex/ })).toBeVisible()
-  await expect(page.getByRole('link', { name: /Kim/ })).toHaveCount(0)
+  await expect(friendLink(page, 'Alex')).toBeVisible()
+  await expect(friendLink(page, 'Kim')).toHaveCount(0)
 })
 
 test('rejects a file that is not a backup', async ({ page }) => {
```

In `e2e/screenshots.spec.ts`:

```diff
--- a/e2e/screenshots.spec.ts
+++ b/e2e/screenshots.spec.ts
@@ -5,6 +5,7 @@ import {
   addToList,
   dayFromToday,
   drawnPhoto,
+  friendLink,
   goToTab,
   LARGE_TEXT,
   lockHeading,
@@ -63,7 +64,7 @@ async function seed(page: Page) {
   await logMeetup(page, ['Theo Brooks'], { type: 'Call', date: daysAgo(120) })
   await logMeetup(page, ['Alex Rivera', 'Kim Park', 'Jordan Lee'], { type: 'Party', date: daysAgo(300) })
   await logMeetup(page, ['Sam Chen'], { type: 'Trip', date: daysAgo(400) })
-  await page.getByRole('link', { name: /Alex Rivera/ }).click()
+  await friendLink(page, 'Alex Rivera').click()
   // Alex's birthday is further off, so the friend page shows it but Birthdays soon doesn't
   // (and Alex keeps a single link on the Friends tab).
   const inForty = dayFromToday(40)
@@ -151,7 +152,7 @@ async function captureAll(page: Page, prefix: string) {
   await page.getByRole('button', { name: 'Back' }).click()
   await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
 
-  await page.getByRole('link', { name: /Alex Rivera/ }).click()
+  await friendLink(page, 'Alex Rivera').click()
   await page.waitForTimeout(500)
   await page.screenshot({ path: `${DIR}/${prefix}-04-friend.png` })
   await page.screenshot({ path: `${DIR}/${prefix}-05-friend-full.png`, fullPage: true })
```

- [ ] **Step 7: Run everything**

Run: `npx tsc -b`, then `npm test`
Expected: `Test Files  58 passed (58)` and `Tests  711 passed (711)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `164 passed`. (In the measured run `dayKeyboard.spec.ts:188` stalled under load, the known flake; `npx playwright test --project=iphone e2e/dayKeyboard.spec.ts` alone gave `10 passed`.)

- [ ] **Step 8: Commit**

```bash
git add src/screens/FriendsScreen.tsx e2e/history.spec.ts e2e/helpers.ts e2e/detail.spec.ts e2e/meetups.spec.ts e2e/settings.spec.ts e2e/screenshots.spec.ts
git commit -F - <<'EOF'
feat: Recent meetups on the Friends tab, two rows while Birthdays soon shows, and a search field that stays put

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: The Meetups page

**Files:**
- Create: `src/screens/MeetupsScreen.tsx`, `src/screens/MeetupsScreen.css`, `src/components/PlaceMemory.tsx`, `src/data/meetupIdsWithPhotosContext.ts`, `src/data/MeetupIdsWithPhotosProvider.tsx`
- Modify: `src/App.tsx`, `src/data/hooks.ts`
- Test: `e2e/history.spec.ts`

- [ ] **Step 1: Write the failing Meetups page tests**

In `e2e/history.spec.ts`, add the imports, the helpers (`openMeetups`, `rowTitles`, `meetupRows`, `daysBefore`, `longHistory`, `visit`) and eight tests:

```diff
--- a/e2e/history.spec.ts
+++ b/e2e/history.spec.ts
@@ -1,5 +1,16 @@
 import { expect, test, type Locator, type Page } from '@playwright/test'
-import { friendLink, friendRow, logMeetup, meetupRow, photoRow, seedMeetups } from './helpers.ts'
+import { OWNER_DAY_TYPED } from '../src/test/dayFixtures.ts'
+import {
+  enterPin,
+  friendLink,
+  friendRow,
+  lockHeading,
+  logMeetup,
+  meetupRow,
+  photoRow,
+  seedAppLock,
+  seedMeetups,
+} from './helpers.ts'
 
 /** Mon, Oct 5, 2026, 12:00 PM on the phone's clock. */
 const MONDAY_NOON = new Date(2026, 9, 5, 12)
@@ -54,6 +65,49 @@ function topsOverFrames(page: Page, selector: string, frames = 10): Promise<numb
   )
 }
 
+/** On the Friends tab: opens the Meetups page from "See all meetups". */
+async function openMeetups(page: Page) {
+  await recentGroup(page).getByRole('link', { name: 'See all meetups' }).click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Meetups' })).toBeVisible()
+}
+
+/** Every row title on the Meetups page, in order. */
+function rowTitles(page: Page): Locator {
+  return page.locator('.inset-group .row__title')
+}
+
+/** The Meetups page's rows. */
+function meetupRows(page: Page): Locator {
+  return page.locator('.inset-group__body > a.row')
+}
+
+/** The ISO date `days` before `iso`. */
+function daysBefore(iso: string, days: number): string {
+  const [year, month, day] = iso.split('-').map(Number)
+  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10)
+}
+
+/**
+ * 130 Coffees with Sam, newest first as rows 1 to 130, each with the note "Visit N": rows 1 to 120 from Oct 5
+ * back to Sep 1 (so row 61 continues September), rows 121 to 130 in August. 100 of them have a photo. Their
+ * subtitles run about 33 characters: one line without a thumbnail, two with one.
+ */
+function longHistory(): Parameters<typeof seedMeetups>[1] {
+  const meetups = Array.from({ length: 130 }, (_, i) => {
+    const date = i < 120 ? daysBefore('2026-10-05', Math.floor((i * 35) / 120)) : daysBefore('2026-08-30', i - 120)
+    // Logged a minute apart, later rows earlier, so same-day rows keep their numbers in order.
+    const createdAt = new Date(Date.UTC(2026, 9, 6) - i * 60_000).toISOString()
+    return meetupRow(`m${i + 1}`, date, ['sam'], { note: `Visit ${i + 1}`, createdAt })
+  })
+  const photos = meetups.filter((_, i) => i % 13 < 10).map((meetup) => photoRow(`photo-${meetup.id}`, meetup.id))
+  return { friends: [SAM], meetups, photos }
+}
+
+/** Row N of the long history (1-based), by its note. */
+function visit(page: Page, n: number): Locator {
+  return page.getByRole('link', { name: new RegExp(`Visit ${n}$`) })
+}
+
 test('Recent meetups shows the three latest that happened, naming everyone', async ({ page }) => {
   await openWith(page, { friends: [ALEX, SAM, KIM], meetups: [...PAST, PARTY] })
   const recent = recentGroup(page)
@@ -177,3 +231,246 @@ test('the friend page still leaves its friend out', async ({ page }) => {
   const history = page.getByRole('region', { name: 'History' })
   await expect(history.getByRole('link', { name: /^Meal/ })).toHaveAccessibleName(/· with Sam · Tacos$/)
 })
+
+test('Recent meetups stops a subtitle at two lines; the Meetups page shows it all', async ({ page }) => {
+  const friends = [friendRow('mariya', 'Mariya'), friendRow('jessie', 'Jessie'), friendRow('brandon', 'Brandon')]
+  const owners = meetupRow('owners', '2026-10-03', ['mariya', 'jessie', 'brandon'], {
+    typeId: 'type-meal',
+    activities: ['Movie', 'Shopping'],
+    note: OWNER_DAY_TYPED,
+  })
+  await openWith(page, { friends, meetups: [owners] })
+  const row = recentGroup(page).getByRole('link', { name: /^Meal/ })
+  const clamp = row.locator('.meetup-row__clamp')
+  const lines = (element: Element) => ({
+    height: element.getBoundingClientRect().height,
+    line: parseFloat(getComputedStyle(element).lineHeight),
+  })
+  const clamped = await clamp.evaluate(lines)
+  expect(clamped.height, 'Two lines at most').toBeLessThanOrEqual(2 * clamped.line + 1)
+  // VoiceOver still reads the whole subtitle.
+  await expect(row).toHaveAccessibleName(
+    /· with Mariya, Jessie and Brandon · Movie, Shopping · nonstopstyle, strand bookstore, Sammy L coffee and 5 more/,
+  )
+
+  await openMeetups(page)
+  const full = await page
+    .getByRole('region', { name: 'October 2026' })
+    .getByRole('link', { name: /^Meal/ })
+    .locator('.row__subtitle')
+    .evaluate(lines)
+  expect(full.height, 'More than two lines').toBeGreaterThan(2 * full.line + 1)
+})
+
+test('See all opens the Meetups page: Upcoming, then each month', async ({ page }) => {
+  const trip = meetupRow('trip', '2025-12-24', ['sam'], { typeId: 'type-trip' })
+  const activity = meetupRow('activity', '2026-10-12', ['alex'], { typeId: 'type-activity' })
+  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: [...PAST, PARTY, trip, activity] })
+  await openMeetups(page)
+  await expect(page).toHaveTitle('Meetups · Friend Tracker')
+  await expect(page.locator('header.navbar .navbar__back')).toHaveText('Friends')
+  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Friends' })).toHaveAttribute(
+    'aria-current',
+    'page',
+  )
+  await expect(page.locator('.inset-group .group-title')).toHaveText([
+    'Upcoming',
+    'October 2026',
+    'September 2026',
+    'December 2025',
+  ])
+  const titlesIn = (name: string) => page.getByRole('region', { name }).locator('.row__title')
+  await expect(titlesIn('Upcoming')).toHaveText(['Party', 'Activity'])
+  await expect(titlesIn('October 2026')).toHaveText(['Drinks', 'Meal'])
+  await expect(titlesIn('September 2026')).toHaveText(['Coffee', 'Call'])
+  await expect(titlesIn('December 2025')).toHaveText(['Trip'])
+
+  // The group's title says it, so its rows don't; Kim's History still does.
+  const party = page.getByRole('region', { name: 'Upcoming' }).getByRole('link', { name: /^Party/ })
+  await expect(party).toHaveAccessibleName(/^Party\s*Thu, Oct 8 · with Kim$/)
+  await page.locator('header.navbar .navbar__back').click()
+  await friendLink(page, 'Kim').click()
+  const kimsParty = page.getByRole('region', { name: 'History' }).getByRole('link', { name: /^Party/ })
+  await expect(kimsParty).toHaveAccessibleName(/^Party\s*Upcoming/)
+})
+
+test('the Meetups search finds memories by their words', async ({ page }) => {
+  const karaoke = meetupRow('karaoke', '2026-09-20', ['kim'], {
+    typeId: 'type-activity',
+    activities: ['Karaoke'],
+    weather: ['rainy'],
+  })
+  const soup = meetupRow('soup', '2026-09-18', ['sam'], {
+    typeId: 'type-meal',
+    note: '@Blue willow 3:30\nThe soup didn’t last',
+  })
+  const felt = meetupRow('felt', '2026-09-15', ['kim'], { feelings: 'Felt almost outsidery, and that was fine' })
+  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: [...PAST, PARTY, karaoke, soup, felt] })
+  await openMeetups(page)
+  const search = page.getByRole('searchbox', { name: 'Search meetups' })
+  const titles = rowTitles(page)
+
+  const expected: [string, string[]][] = [
+    ['alex', ['Meal', 'Coffee']],
+    ['MEAL', ['Meal', 'Meal']],
+    ['karaoke', ['Activity']],
+    ['blue willow', ['Meal']],
+    ['soup', ['Meal']],
+    ['outsidery', ['Coffee']],
+    ["didn't", ['Meal']],
+    ['sam tacos', ['Meal']],
+  ]
+  for (const [query, rows] of expected) {
+    await search.fill(query)
+    await expect(titles, `"${query}"`).toHaveText(rows)
+  }
+
+  await search.fill('zebra')
+  await expect(page.locator('.list-message')).toHaveText('No meetups match “zebra”.')
+  await expect(titles).toHaveCount(0)
+  // Read out once typing pauses.
+  await expect(page.locator('.meetups-announcer')).toHaveText('No meetups match “zebra”.')
+
+  // Weather is never searched.
+  await search.fill('rainy')
+  await expect(page.locator('.list-message')).toHaveText('No meetups match “rainy”.')
+
+  await search.fill('')
+  await expect(page.locator('.inset-group .group-title')).toHaveText(['Upcoming', 'October 2026', 'September 2026'])
+  await expect(titles).toHaveCount(8)
+  await expect(page.locator('.meetups-announcer')).toHaveText('')
+})
+
+test('a meetup opened from Meetups goes back to the same search', async ({ page }) => {
+  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: PAST })
+  await openMeetups(page)
+  const search = page.getByRole('searchbox', { name: 'Search meetups' })
+  await search.fill('tacos')
+  await expect(rowTitles(page)).toHaveText(['Meal'])
+  await expect(page.locator('.meetups-announcer')).toHaveText('1 meetup matches.')
+
+  await page.getByRole('link', { name: /^Meal/ }).click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
+  await expect(page.locator('header.navbar .navbar__back')).toHaveText('Meetups')
+  await page.getByRole('button', { name: 'Edit', exact: true }).click()
+  const sheet = page.getByRole('dialog', { name: 'Edit meetup' })
+  await sheet.getByRole('button', { name: 'Drinks', exact: true }).click()
+  await sheet.getByRole('button', { name: 'Save', exact: true }).click()
+  await expect(sheet).toBeHidden()
+  await expect(page.getByRole('heading', { level: 1, name: 'Drinks' })).toBeVisible()
+
+  await page.locator('header.navbar .navbar__back').click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Meetups' })).toBeVisible()
+  await expect(search).toHaveValue('tacos')
+  await expect(rowTitles(page)).toHaveText(['Drinks'])
+  // A restored search isn't read out again.
+  await page.waitForTimeout(1000)
+  await expect(page.locator('.meetups-announcer')).toHaveText('')
+})
+
+test('deleting a meetup from Meetups goes back to the list, and Undo puts it back', async ({ page }) => {
+  await openWith(page, { friends: [ALEX, SAM, KIM], meetups: PAST })
+  await openMeetups(page)
+  const september = page.getByRole('region', { name: 'September 2026' })
+  await september.getByRole('link', { name: /^Coffee/ }).click()
+  await page.getByRole('button', { name: 'Edit', exact: true }).click()
+  await page.getByRole('dialog', { name: 'Edit meetup' }).getByRole('button', { name: 'Delete meetup' }).click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Meetups' })).toBeVisible()
+  await expect(september.locator('.row__title')).toHaveText(['Call'])
+  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
+  await expect(september.locator('.row__title')).toHaveText(['Coffee', 'Call'])
+})
+
+test('a long history shows 60 rows at a time and keeps its place', async ({ page }) => {
+  await openWith(page, longHistory())
+  await openMeetups(page)
+  const rows = meetupRows(page)
+  const more = page.getByRole('button', { name: 'Show older meetups' })
+  await expect(rows).toHaveCount(60)
+  await expect(more).toBeVisible()
+
+  // A tap: focus goes to the first row it added, which continues September, with no ring drawn.
+  await more.tap()
+  await expect(rows).toHaveCount(120)
+  await expect(visit(page, 61)).toBeFocused()
+  expect(await page.evaluate(() => document.querySelectorAll(':focus-visible').length), 'No focus ring').toBe(0)
+
+  // The keyboard: the first row added opens August, so its heading takes focus. Nothing is left to show.
+  await more.focus()
+  await more.press('Enter')
+  await expect(rows).toHaveCount(130)
+  await expect(page.getByRole('heading', { name: 'August 2026' })).toBeFocused()
+  await expect(more).toHaveCount(0)
+
+  await expect(visit(page, 1).locator('img.history-thumb')).toHaveAttribute('src', /^data:image\/png/)
+  await expect(visit(page, 11).locator('.meetup-thumb')).toHaveCount(0)
+
+  // Open row 100 and come back: every row still shows, and row 100 is where it was.
+  await visit(page, 100).click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
+  await page.locator('header.navbar .navbar__back').click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Meetups' })).toBeVisible()
+  await expect(rows).toHaveCount(130)
+  await expect(visit(page, 100)).toBeInViewport()
+  const tops = await page.evaluate(
+    () =>
+      new Promise<number[]>((resolve) => {
+        const row = [...document.querySelectorAll('.inset-group__body > a.row')][99]
+        const seen: number[] = []
+        const read = () => {
+          seen.push(row.getBoundingClientRect().top)
+          if (seen.length < 10) requestAnimationFrame(read)
+          else resolve(seen)
+        }
+        requestAnimationFrame(read)
+      }),
+  )
+  for (const top of tops) expect(Math.abs(top - tops[0]), 'Row 100 stays put').toBeLessThanOrEqual(1)
+})
+
+test('the app lock starts the Meetups page fresh', async ({ page }) => {
+  test.setTimeout(60_000)
+  await page.clock.setFixedTime(MONDAY_NOON)
+  await page.goto('/')
+  await seedAppLock(page, '135790')
+  await seedMeetups(page, longHistory())
+  await openMeetups(page)
+  const search = page.getByRole('searchbox', { name: 'Search meetups' })
+  const rows = meetupRows(page)
+  const more = page.getByRole('button', { name: 'Show older meetups' })
+  // Every meetup is a Coffee.
+  await search.fill('coffee')
+  await expect(rows).toHaveCount(60)
+  await more.click()
+  await expect(rows).toHaveCount(120)
+
+  // Hidden, 16 minutes, back: locked. Then the PIN.
+  await page.evaluate(() => {
+    const setVisibility = (state: DocumentVisibilityState) => {
+      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
+      document.dispatchEvent(new Event('visibilitychange'))
+    }
+    setVisibility('hidden')
+    localStorage.setItem('ft:lastActiveAt', String(Date.now() - 16 * 60_000))
+    setVisibility('visible')
+  })
+  await expect(lockHeading(page)).toBeVisible()
+  await enterPin(page, '135790')
+  await expect(page.getByRole('heading', { level: 1, name: 'Meetups' })).toBeVisible()
+  await expect(page).toHaveURL(/#\/meetups$/)
+  await expect(search).toHaveValue('')
+  await expect(rows).toHaveCount(60)
+  await expect(more).toBeVisible()
+})
+
+test('Meetups with no meetups yet', async ({ page }) => {
+  await openWith(page, { friends: [ALEX] })
+  await page.goto('/#/meetups')
+  await expect(page.getByText('No meetups yet.')).toBeVisible()
+  await expect(page.getByText('Your first meetup will show up here.')).toBeVisible()
+  await expect(page.getByRole('searchbox', { name: 'Search meetups' })).toHaveCount(0)
+  await expect(page.getByRole('button', { name: 'Log meetup' })).toBeVisible()
+
+  await logMeetup(page, ['Alex'])
+  await expect(page.getByRole('region', { name: 'October 2026' }).locator('.row__title')).toHaveText(['Coffee'])
+})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx playwright test --project=iphone e2e/history.spec.ts`
Expected: `8 failed` (there's no `/meetups` route, so "See all meetups" lands back on Friends) and `6 passed`.

- [ ] **Step 3: Keep each list's place**

Create `src/components/PlaceMemory.tsx`:

```tsx
import { createContext, useContext, useRef, type ReactNode } from 'react'

/** Where you were on a list: its search and how many rows it showed. */
export interface Place {
  query: string
  count: number
}

const PlaceMemoryContext = createContext<Map<string, Place> | null>(null)

/**
 * Keeps each history entry's place (by `location.key`) in memory, the way ScrollManager keeps scroll positions, so
 * going back to a list finds its search and rows. It lives inside App, which the app lock unmounts, so the lock
 * starts every list fresh. Nothing is stored on the phone.
 */
export function PlaceMemoryProvider({ children }: { children: ReactNode }) {
  const places = useRef(new Map<string, Place>())
  return <PlaceMemoryContext.Provider value={places.current}>{children}</PlaceMemoryContext.Provider>
}

export function usePlaceMemory(): Map<string, Place> {
  const places = useContext(PlaceMemoryContext)
  if (!places) throw new Error('usePlaceMemory must be used inside PlaceMemoryProvider')
  return places
}
```

- [ ] **Step 4: Keep which meetups have photos for the whole app**

Create `src/data/meetupIdsWithPhotosContext.ts`:

```ts
import { createContext } from 'react'

/** Which meetups have photos (see MeetupIdsWithPhotosProvider): undefined while loading, null outside the provider. */
export const MeetupIdsWithPhotosContext = createContext<ReadonlySet<string> | undefined | null>(null)
```

Create `src/data/MeetupIdsWithPhotosProvider.tsx`:

```tsx
import { useLiveQuery } from 'dexie-react-hooks'
import type { ReactNode } from 'react'
import { meetupIdsWithPhotos } from '../db/meetups'
import { MeetupIdsWithPhotosContext } from './meetupIdsWithPhotosContext'

/**
 * One live walk of the photos' meetupId index for the whole app, so a screen opened or gone back to knows at once
 * which of its rows have a photo. The walk takes a step per meetup with photos, so a long list going back would
 * otherwise wait for it every time, and could miss the scroll it returns to.
 */
export function MeetupIdsWithPhotosProvider({ children }: { children: ReactNode }) {
  const ids = useLiveQuery(async () => new Set(await meetupIdsWithPhotos()))
  return <MeetupIdsWithPhotosContext.Provider value={ids}>{children}</MeetupIdsWithPhotosContext.Provider>
}
```

In `src/data/hooks.ts`, the hook reads the context:

```diff
--- a/src/data/hooks.ts
+++ b/src/data/hooks.ts
@@ -1,9 +1,11 @@
 import { useLiveQuery } from 'dexie-react-hooks'
+import { useContext } from 'react'
 import { db } from '../db/db'
-import { firstPhotoThumb, meetupIdsWithPhotos, photoById, photoCount, photoThumbs } from '../db/meetups'
+import { firstPhotoThumb, photoById, photoCount, photoThumbs } from '../db/meetups'
 import { getSetting, type Settings } from '../db/settings'
 import { compareNames } from '../lib/text'
 import type { Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'
+import { MeetupIdsWithPhotosContext } from './meetupIdsWithPhotosContext'
 
 // Each hook returns `undefined` while its first query is loading, then re-renders on every change.
 
@@ -53,10 +55,12 @@ export function useFirstPhotoThumb(meetupId: string): string | null | undefined
 
 /**
  * Which meetups have photos, so a meetup row knows from its first render whether it ends with a thumbnail. A
- * key-only walk of an index: no photo is read.
+ * key-only walk of an index (no photo is read), kept live for the whole app by MeetupIdsWithPhotosProvider.
  */
 export function useMeetupIdsWithPhotos(): ReadonlySet<string> | undefined {
-  return useLiveQuery(async () => new Set(await meetupIdsWithPhotos()))
+  const ids = useContext(MeetupIdsWithPhotosContext)
+  if (ids === null) throw new Error('useMeetupIdsWithPhotos must be used inside MeetupIdsWithPhotosProvider')
+  return ids
 }
 
 /** How many meetup photos are stored. Counts without reading any image. */
```

- [ ] **Step 5: Write the page**

Create `src/screens/MeetupsScreen.tsx`:

```tsx
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { IconSearch } from '../components/icons'
import { InsetGroup } from '../components/InsetGroup'
import { LogButton } from '../components/LogButton'
import { MeetupRow } from '../components/MeetupRow'
import { Page, type NavState } from '../components/Page'
import { usePlaceMemory } from '../components/PlaceMemory'
import { useFriends, useMeetupIdsWithPhotos, useMeetups, useMeetupTypes } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import type { ISODate } from '../lib/dates'
import { isPlainEnter } from '../lib/keys'
import {
  firstRows,
  historySections,
  matchesSearch,
  MEETUPS_PAGE_SIZE,
  meetupNames,
  meetupSearchText,
  type HistorySection,
} from '../stats/meetupHistory'
import type { MeetupType } from '../types'
import './MeetupsScreen.css'

/** A meetup opened from here says "Meetups" on its back button. */
const FROM_MEETUPS: NavState = { backLabel: 'Meetups' }
/** How long typing pauses before VoiceOver hears how many meetups match. */
const ANNOUNCE_AFTER_MS = 700

function describeMatches(count: number, query: string): string {
  if (count === 0) return `No meetups match “${query}”.`
  return count === 1 ? '1 meetup matches.' : `${count} meetups match.`
}

interface MeetupListProps {
  /** The groups to show, already searched with `query`. */
  sections: HistorySection[]
  /** The deferred, trimmed search, for the no-match line. */
  query: string
  /** How many rows show, counted across the groups. */
  count: number
  typeById: ReadonlyMap<string, MeetupType>
  namesById: ReadonlyMap<string, string[]>
  withPhotos: ReadonlySet<string>
  today: ISODate
  /** The row "Show older meetups" moves focus to (its group's heading when it starts a group), or null. */
  focusIndex: number | null
  focusRef: (element: HTMLElement | null) => void
  onShowMore: (shown: number) => void
}

/**
 * The groups, the no-match line and "Show older meetups". Memoized, so a keystroke re-renders only the search
 * field until the deferred query catches up.
 */
const MeetupList = memo(function MeetupList({
  sections,
  query,
  count,
  typeById,
  namesById,
  withPhotos,
  today,
  focusIndex,
  focusRef,
  onShowMore,
}: MeetupListProps) {
  if (sections.length === 0) return <p className="list-message">No meetups match “{query}”.</p>
  const shown = firstRows(sections, count)
  let index = 0
  return (
    <>
      {shown.sections.map((section) => {
        const first = index
        index += section.meetups.length
        return (
          <InsetGroup key={section.key} title={section.title} titleRef={focusIndex === first ? focusRef : undefined}>
            {section.meetups.map((meetup, i) => (
              <MeetupRow
                key={meetup.id}
                meetup={meetup}
                type={typeById.get(meetup.typeId)}
                names={namesById.get(meetup.id) ?? []}
                today={today}
                state={FROM_MEETUPS}
                hasPhoto={withPhotos.has(meetup.id)}
                // The group's title already says it.
                showUpcoming={section.key !== 'upcoming'}
                ref={i > 0 && focusIndex === first + i ? focusRef : undefined}
              />
            ))}
          </InsetGroup>
        )
      })}
      {shown.more > 0 && (
        <div className="meetups-more">
          <button type="button" className="button button--secondary" onClick={() => onShowMore(count)}>
            Show older meetups
          </button>
        </div>
      )}
    </>
  )
})

/** Every meetup: Upcoming, then one group per month, searchable, 60 rows at a time. */
export function MeetupsScreen() {
  const meetups = useMeetups()
  const friends = useFriends()
  const types = useMeetupTypes()
  const withPhotos = useMeetupIdsWithPhotos()
  const today = useToday()
  const { key } = useLocation()
  const places = usePlaceMemory()
  // Coming back to this history entry finds its search and rows shown; a new visit starts blank at 60 rows.
  const [query, setQuery] = useState(() => places.get(key)?.query ?? '')
  const [count, setCount] = useState(() => places.get(key)?.count ?? MEETUPS_PAGE_SIZE)
  const [focusIndex, setFocusIndex] = useState<number | null>(null)
  // The trimmed query to announce once typing has paused; null until then, so a restored search isn't announced.
  const [announced, setAnnounced] = useState<string | null>(null)
  const announceTimer = useRef<number | undefined>(undefined)
  const pendingFocus = useRef(false)
  const focusTarget = useRef<HTMLElement | null>(null)

  // The results, the no-match line and the announcement all follow this one value.
  const searched = useDeferredValue(query.trim())

  const nameById = useMemo(() => new Map((friends ?? []).map((friend) => [friend.id, friend.name] as const)), [friends])
  const typeById = useMemo(() => new Map((types ?? []).map((type) => [type.id, type] as const)), [types])
  const namesById = useMemo(
    () => new Map((meetups ?? []).map((meetup) => [meetup.id, meetupNames(meetup, nameById)] as const)),
    [meetups, nameById],
  )
  // Folding every day is the slow part, so it happens only while there's a search, once per data change.
  const searching = searched !== ''
  const searchText = useMemo(() => {
    if (!searching || !meetups) return null
    return new Map(
      meetups.map((meetup) => {
        const typeName = typeById.get(meetup.typeId)?.name ?? 'Meetup'
        return [meetup.id, meetupSearchText(meetup, namesById.get(meetup.id) ?? [], typeName, today)] as const
      }),
    )
  }, [searching, meetups, namesById, typeById, today])
  const matches = useMemo(() => {
    if (!meetups || !searchText) return meetups
    return meetups.filter((meetup) => matchesSearch(searchText.get(meetup.id) ?? '', searched))
  }, [meetups, searchText, searched])
  const sections = useMemo(() => (matches ? historySections(matches, today) : []), [matches, today])

  useEffect(() => () => window.clearTimeout(announceTimer.current), [])

  // "Show older meetups" moves focus to what it added, without scrolling: it sits where the button was.
  useEffect(() => {
    if (!pendingFocus.current) return
    pendingFocus.current = false
    focusTarget.current?.focus({ preventScroll: true })
  }, [count])

  const setFocusTarget = useCallback((element: HTMLElement | null) => {
    focusTarget.current = element
  }, [])

  const showMore = useCallback(
    (shown: number) => {
      const next = shown + MEETUPS_PAGE_SIZE
      pendingFocus.current = true
      setFocusIndex(shown)
      setCount(next)
      places.set(key, { query: places.get(key)?.query ?? '', count: next })
    },
    [places, key],
  )

  function search(value: string) {
    setQuery(value)
    // A new search starts again at 60 rows. Only here, never in an effect, so a restored search keeps its rows.
    setCount(MEETUPS_PAGE_SIZE)
    setFocusIndex(null)
    places.set(key, { query: value, count: MEETUPS_PAGE_SIZE })
    setAnnounced(null)
    window.clearTimeout(announceTimer.current)
    announceTimer.current = window.setTimeout(() => setAnnounced(value.trim()), ANNOUNCE_AFTER_MS)
  }

  if (!meetups || !friends || !types || !withPhotos || !matches) return null

  const announcement =
    announced !== null && announced !== '' && announced === searched ? describeMatches(matches.length, searched) : ''

  return (
    <Page title="Meetups" back={{ label: 'Friends', fallback: '/' }} pushed>
      {meetups.length === 0 ? (
        <EmptyState title="No meetups yet." message="Your first meetup will show up here." />
      ) : (
        <>
          <label className="search">
            <IconSearch size={18} />
            <input
              type="search"
              className="search__input"
              placeholder="Search"
              aria-label="Search meetups"
              enterKeyHint="search"
              value={query}
              onChange={(event) => search(event.target.value)}
              onKeyDown={(event) => {
                if (isPlainEnter(event)) event.currentTarget.blur()
              }}
            />
          </label>
          {/* No role: the toast region is the page's one status. */}
          <p className="visually-hidden meetups-announcer" aria-live="polite">
            {announcement}
          </p>
          <MeetupList
            sections={sections}
            query={searched}
            count={count}
            typeById={typeById}
            namesById={namesById}
            withPhotos={withPhotos}
            today={today}
            focusIndex={focusIndex}
            focusRef={setFocusTarget}
            onShowMore={showMore}
          />
        </>
      )}
      {friends.length > 0 && <LogButton />}
    </Page>
  )
}
```

Create `src/screens/MeetupsScreen.css`:

```css
/* "Show older meetups": centered after the last group. At accessibility sizes it may wrap onto two centered lines. */
.meetups-more {
  display: flex;
  justify-content: center;
}
.meetups-more .button {
  max-width: 100%;
  padding-block: var(--space-2);
  text-align: center;
}
```

- [ ] **Step 6: Route it and mount the providers**

In `src/App.tsx`:

```diff
--- a/src/App.tsx
+++ b/src/App.tsx
@@ -1,14 +1,17 @@
 import { HashRouter, Navigate, Route, Routes } from 'react-router'
 import { ActionSheetProvider } from './components/ActionSheet'
+import { PlaceMemoryProvider } from './components/PlaceMemory'
 import { ScrollManager } from './components/ScrollManager'
 import { TabBar } from './components/TabBar'
 import { ToastProvider } from './components/Toast'
+import { MeetupIdsWithPhotosProvider } from './data/MeetupIdsWithPhotosProvider'
 import { ReminderSync } from './reminders/useReminderSync'
 import { DayScreen } from './screens/DayScreen'
 import { FriendDetailScreen } from './screens/FriendDetailScreen'
 import { FriendsScreen } from './screens/FriendsScreen'
 import { GroupsScreen } from './screens/GroupsScreen'
 import { MeetupScreen } from './screens/MeetupScreen'
+import { MeetupsScreen } from './screens/MeetupsScreen'
 import { MeetupTypesScreen } from './screens/MeetupTypesScreen'
 import { SettingsScreen } from './screens/SettingsScreen'
 import { SheetsProvider } from './sheets/SheetsProvider'
@@ -20,22 +23,28 @@ export default function App() {
       <ToastProvider>
         <ActionSheetProvider>
           <SheetsProvider>
-            <ScrollManager />
-            <ReminderSync />
-            <main className="app">
-              <Routes>
-                <Route path="/" element={<FriendsScreen />} />
-                <Route path="/friends/:id" element={<FriendDetailScreen />} />
-                <Route path="/meetups/:id" element={<MeetupScreen />} />
-                <Route path="/meetups/:id/day" element={<DayScreen />} />
-                <Route path="/stats" element={<StatsScreen />} />
-                <Route path="/settings" element={<SettingsScreen />} />
-                <Route path="/settings/groups" element={<GroupsScreen />} />
-                <Route path="/settings/types" element={<MeetupTypesScreen />} />
-                <Route path="*" element={<Navigate to="/" replace />} />
-              </Routes>
-            </main>
-            <TabBar />
+            {/* Inside App, so the app lock (which unmounts App) forgets every list's place. */}
+            <PlaceMemoryProvider>
+              <MeetupIdsWithPhotosProvider>
+                <ScrollManager />
+                <ReminderSync />
+                <main className="app">
+                  <Routes>
+                    <Route path="/" element={<FriendsScreen />} />
+                    <Route path="/friends/:id" element={<FriendDetailScreen />} />
+                    <Route path="/meetups" element={<MeetupsScreen />} />
+                    <Route path="/meetups/:id" element={<MeetupScreen />} />
+                    <Route path="/meetups/:id/day" element={<DayScreen />} />
+                    <Route path="/stats" element={<StatsScreen />} />
+                    <Route path="/settings" element={<SettingsScreen />} />
+                    <Route path="/settings/groups" element={<GroupsScreen />} />
+                    <Route path="/settings/types" element={<MeetupTypesScreen />} />
+                    <Route path="*" element={<Navigate to="/" replace />} />
+                  </Routes>
+                </main>
+                <TabBar />
+              </MeetupIdsWithPhotosProvider>
+            </PlaceMemoryProvider>
           </SheetsProvider>
         </ActionSheetProvider>
       </ToastProvider>
```

- [ ] **Step 7: Run them to see them pass**

Run: `npx playwright test --project=iphone e2e/history.spec.ts`
Expected: `14 passed`. (`--repeat-each=3` gave `42 passed`.)

- [ ] **Step 8: Run everything**

Run: `npx tsc -b`, then `npm test`
Expected: `Test Files  58 passed (58)` and `Tests  711 passed (711)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `172 passed`.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/data/hooks.ts src/components/PlaceMemory.tsx src/data/MeetupIdsWithPhotosProvider.tsx src/data/meetupIdsWithPhotosContext.ts src/screens/MeetupsScreen.tsx src/screens/MeetupsScreen.css e2e/history.spec.ts
git commit -F - <<'EOF'
feat: the Meetups page, with search, Upcoming and month groups, Show older meetups, and its place kept

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Screenshots, DESIGN.md, and the decisions in the spec

**Files:**
- Modify: `e2e/screenshots.spec.ts`, `DESIGN.md`, `docs/superpowers/specs/2026-10-05-meetup-history-design.md`

- [ ] **Step 1: Capture Recent meetups and the Meetups page**

In `e2e/screenshots.spec.ts`, the seed adds an upcoming Party with Maya Patel in 2 days, and `captureAll` adds `02-friends-full`, `19-meetups` (full page) and `20-meetups-search` ("ramen"):

```diff
--- a/e2e/screenshots.spec.ts
+++ b/e2e/screenshots.spec.ts
@@ -64,6 +64,9 @@ async function seed(page: Page) {
   await logMeetup(page, ['Theo Brooks'], { type: 'Call', date: daysAgo(120) })
   await logMeetup(page, ['Alex Rivera', 'Kim Park', 'Jordan Lee'], { type: 'Party', date: daysAgo(300) })
   await logMeetup(page, ['Sam Chen'], { type: 'Trip', date: daysAgo(400) })
+  // The Meetups page opens with "Upcoming". Stats and the friend pages captured don't change: future meetups
+  // aren't counted.
+  await logMeetup(page, ['Maya Patel'], { type: 'Party', date: daysAgo(-2) })
   await friendLink(page, 'Alex Rivera').click()
   // Alex's birthday is further off, so the friend page shows it but Birthdays soon doesn't
   // (and Alex keeps a single link on the Friends tab).
@@ -107,6 +110,8 @@ async function writeOwnersDay(page: Page) {
 
 async function captureAll(page: Page, prefix: string) {
   await page.screenshot({ path: `${DIR}/${prefix}-02-friends.png` })
+  // Where the search field and the friend list land below Birthdays soon and Recent meetups.
+  await page.screenshot({ path: `${DIR}/${prefix}-02-friends-full.png`, fullPage: true })
 
   // The Log sheet's footer, then the day page written through it.
   await page.getByRole('button', { name: 'Log meetup' }).click()
@@ -152,6 +157,18 @@ async function captureAll(page: Page, prefix: string) {
   await page.getByRole('button', { name: 'Back' }).click()
   await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
 
+  // The Meetups page, with the owner's example among the months, then searched.
+  await page.getByRole('link', { name: 'See all meetups' }).click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Meetups' })).toBeVisible()
+  await page.waitForTimeout(500)
+  await page.screenshot({ path: `${DIR}/${prefix}-19-meetups.png`, fullPage: true })
+  await page.getByRole('searchbox', { name: 'Search meetups' }).fill('ramen')
+  await expect(page.locator('.inset-group .row__title')).toHaveText(['Meal'])
+  await page.waitForTimeout(500)
+  await page.screenshot({ path: `${DIR}/${prefix}-20-meetups-search.png` })
+  await page.locator('header.navbar .navbar__back').click()
+  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
+
   await friendLink(page, 'Alex Rivera').click()
   await page.waitForTimeout(500)
   await page.screenshot({ path: `${DIR}/${prefix}-04-friend.png` })
```

- [ ] **Step 2: Take them and look**

Run: `npm run screenshots`
Expected: `15 passed`, with 9 new PNGs in `e2e/screenshots`: `light-`, `dark-` and `large-text-` versions of `02-friends-full`, `19-meetups` and `20-meetups-search`.

Look at them, `large-text-02-friends` and `light-02-friends-full` especially: Birthdays soon shows 3 rows, so Recent meetups shows 2, the Meal's subtitle stops at two lines with "…", and the search field sits below them; `19-meetups` opens with "Upcoming" (the Party without its badge), then the months; `04-friend` and `05-friend-full` look as before.

- [ ] **Step 3: Update DESIGN.md**

```diff
--- a/DESIGN.md
+++ b/DESIGN.md
@@ -260,7 +260,7 @@ Six soft pastel pairs (`.tint-0` to `.tint-5`, hues 50, 85, 145, 215, 285, 350),
 **Character:** Apple's rounded face gives titles, names, and numbers a soft, friendly voice; plain SF Pro keeps body text, labels, and controls feeling native. Two faces from one family, so the pairing never fights.
 
 ### Hierarchy
-- **Large Title** (rounded, 700, 2rem, line-height 1.15): the page title on Friends, Stats, Settings, Groups, and Meetup types. Wraps (never truncates) and shares the 16px left edge with the content below.
+- **Large Title** (rounded, 700, 2rem, line-height 1.15): the page title on Friends, Stats, Settings, Groups, Meetup types, and Meetups. Wraps (never truncates) and shares the 16px left edge with the content below.
 - **Title** (rounded, 700, 1.5rem, line-height 1.2): the friend's name in the detail hero, the meetup type on the Meetup page, and the Stats year. The Stats summary sentence ("4 meetups with 4 friends.") uses it at 600 with `text-wrap: balance`.
 - **Title 3** (rounded, 600, 1.18rem): empty-state headlines (balanced, max 22ch). The "+ Log meetup" pill uses rounded 600 at 1.06rem.
 - **Body** (SF Pro, 400, 1rem, line-height 1.35): row titles, fields, buttons (600), sheet titles (600). Prose blocks (notes, About your data) cap at 65ch.
@@ -269,7 +269,7 @@ Six soft pastel pairs (`.tint-0` to `.tint-5`, hues 50, 85, 145, 215, 285, 350),
 - **Caption** (0.7rem): tab bar labels (500, capped at 13px), the "this year" label under counts, the "Upcoming" badge (600), month initials (capped at 18px).
 
 ### Named Rules
-**The Dynamic Type Rule.** The root font is `-apple-system-body`, so 1rem follows the iPhone text-size setting; every type size and spacing step is in rem. Layouts must survive the largest standard size (about 23px body): rows grow taller, subtitles wrap, the stat row stays three across up to about 28px and stacks beyond, the "+ Log meetup" pill stays on one line. The only fixed-pixel exceptions are avatars, the Meetup page's emoji badge (96px with a 48px emoji), the history thumbnail (40px) and the remove button's glyph on photos (24px), the mood face (a 44px circle with a 26px emoji), the 20px avatar in a paid tag, icons (except the Log pill's plus, which is 1.15em), tab labels (capped at 13px), month initials (capped at 18px), input text (never below 16px, so iOS doesn't zoom), and the lock screen's keypad and the Settings switches (listed under "Lock screen and PIN pad").
+**The Dynamic Type Rule.** The root font is `-apple-system-body`, so 1rem follows the iPhone text-size setting; every type size and spacing step is in rem. Layouts must survive the largest standard size (about 23px body): rows grow taller, subtitles wrap, the stat row stays three across up to about 28px and stacks beyond, the "+ Log meetup" pill stays on one line. The only fixed-pixel exceptions are avatars, the Meetup page's emoji badge (96px with a 48px emoji), the meetup row's thumbnail (40px) and the remove button's glyph on photos (24px), the mood face (a 44px circle with a 26px emoji), the 20px avatar in a paid tag, icons (except the Log pill's plus, which is 1.15em), tab labels (capped at 13px), month initials (capped at 18px), input text (never below 16px, so iOS doesn't zoom), and the lock screen's keypad and the Settings switches (listed under "Lock screen and PIN pad").
 
 **The Rounded Numbers Rule.** Counts and years use the `.numeric` treatment: the rounded face with tabular numerals, so columns of numbers line up.
 
@@ -296,10 +296,11 @@ Flat by default, with depth from tonal layering, as in iOS Settings: Paper White
 - **Secondary:** Linen fill, Warm Ink text, same shape.
 - **Text button:** no fill, Terracotta Ink text, 44×44 minimum, fades to 50% opacity on press. Used for Cancel, Edit, and the back button. The back button always keeps its chevron; a long label truncates with an ellipsis instead.
 - **Icon button:** 44px circle, Terracotta Ink glyph, Linen circle on press. Neutral (Warm Ink Secondary) when repeated in a list, such as reorder arrows. Disabled: Warm Ink Tertiary at 45%.
+- **Show more:** a long list ends with a centered secondary button that adds the next rows ("Show older meetups"). Rows never load by themselves as you scroll.
 - **Focus:** a 2px Terracotta Ink outline with a 2px offset on every focusable element.
 
 ### "+ Log meetup" pill (signature)
-The thumb-reachable primary action on Friends and friend detail. Peach fill, On-Peach rounded 600 text at 1.06rem, a plus icon at 1.15em, 52px tall, Float shadow, fixed 16px above the tab bar. It's centered with auto margins and `width: max-content` (never `left: 50%` plus a translate, which halves its available width and wraps the label at large text). Pressed: Peach Pressed and a 0.96 scale.
+The thumb-reachable primary action on Friends, friend detail and Meetups. Peach fill, On-Peach rounded 600 text at 1.06rem, a plus icon at 1.15em, 52px tall, Float shadow, fixed 16px above the tab bar. It's centered with auto margins and `width: max-content` (never `left: 50%` plus a translate, which halves its available width and wraps the label at large text). Pressed: Peach Pressed and a 0.96 scale.
 
 ### Chips
 - **Style:** Linen pill, 36px tall with an invisible extension to a 44px hit area, `0 14px` padding, Subhead 500 text, no wrapping inside a chip (except the wrapping variant below).
@@ -316,7 +317,7 @@ The thumb-reachable primary action on Friends and friend detail. Peach fill, On-
 
 ### Inputs and fields
 - **Field:** Paper White on Warm Paper (inside sheets), 12px corners, 44px minimum height, `0.6rem 0.9rem` padding, no border. Labels are Footnote 600 Warm Ink Secondary above the field. Placeholders are Warm Ink Tertiary.
-- **Search:** Linen, 12px corners, 44px tall, an 18px magnifier in Warm Ink Tertiary. Focus draws the 2px Terracotta Ink outline around the whole field.
+- **Search:** Linen, 12px corners, 44px tall, an 18px magnifier in Warm Ink Tertiary. Focus draws the 2px Terracotta Ink outline around the whole field. Friends and Meetups each have one, above their list.
 - **Error:** Footnote Danger Red text under the field, announced with `role="alert"`.
 - **Hint (`.field-hint`):** a neutral note under a field for things that aren't errors, such as "Already in Likes.". Footnote Warm Ink Secondary, announced with `role="alert"`, never red.
 - **Select row (`.birthday-row`):** native selects, so iOS shows its wheel, with the Field look, `appearance: none` and a 16px Warm Ink Tertiary chevron. The empty choice ("Month", "Day", "No year") is Warm Ink Tertiary, like a placeholder. The friend sheet's Birthday puts Month, Day and Year in one row of equal-height fields, Month widest (flex bases 7.5em, 4.5em and 6em); at large text sizes the row wraps. Each select has its own accessible name ("Birthday month"); an error sits under the row and the selects point to it with `aria-describedby`. A "Remove birthday" text button under the row clears all three.
@@ -350,7 +351,7 @@ The one happy moment. An inverted pill (Warm Ink background, Warm Paper text, Fl
 
 ### Navigation
 - **Nav bar:** sticky, 44px plus the safe area, solid Warm Paper. Back and actions in Terracotta Ink. When the large title scrolls away, a centered Body 600 title fades in and a 0.5px Soft Rule appears underneath.
-- **Tab bar:** fixed, Paper White, 50px plus the safe area, hairline on top. Three tabs (Friends, Stats, Settings) with 26px line icons over Caption labels: Warm Ink Tertiary at rest, Terracotta Ink with a heavier stroke and 600 label when current. A friend's page and a Meetup page belong to Friends, unless they were opened from Stats, which then stays current. The tab bar is hidden on the day page.
+- **Tab bar:** fixed, Paper White, 50px plus the safe area, hairline on top. Three tabs (Friends, Stats, Settings) with 26px line icons over Caption labels: Warm Ink Tertiary at rest, Terracotta Ink with a heavier stroke and 600 label when current. A friend's page, a Meetup page and the Meetups page belong to Friends, unless they were opened from Stats, which then stays current. The tab bar is hidden on the day page.
 
 ### Avatars
 Circles. Initials in the rounded face (600, 40% of the size) on a per-friend pastel tint, or a cropped photo. Sizes: 44px in rows, 52px in the recent-friends grid, 96px in the detail hero, 24 to 28px inside chips.
@@ -359,10 +360,13 @@ Circles. Initials in the rounded face (600, 40% of the size) on a per-friend pas
 Reads as one calm column, not a grid of cards: centered 96px avatar, Title name, group in Warm Ink Secondary, then a Paper White "Last seen" pill (Subhead, 1em corners so it becomes a soft box if large text wraps it between the date and the time since). Below: the notes, then **Birthday**, **Likes** and **Dislikes** (people before numbers), then the stat row, "Month by month", and the history grouped by month.
 - **Birthday:** always shown. With a birthday, one inset row: a 🎂 emoji badge leading, the date as the title ("March 14, 1996", or "March 14" without a year), the countdown as the subtitle ("In 12 days · turns 31", "Tomorrow", "Today"), and a chevron. Tapping it opens the Edit friend sheet. Without one, a "+ Add birthday" chip opens the same sheet. Plain facts: no color, badge or reminder copy.
 - **Likes and Dislikes:** each a section with a Footnote label over a wrapping cluster of item chips (the wrapping variant) on the page background, with no container. The cluster ends with a "+ Add" chip; tapping it puts a Paper White field and a secondary **Add** button in its place (one field open at a time). Notes under the field ("Already in Likes.", "This list is full.") are Footnote Warm Ink Secondary with `role="alert"`, never red. Tapping an item opens an action sheet titled with it: **Move to Dislikes** (or **Move to Likes**) and a destructive **Remove**, which an Undo toast reverses. An empty list shows only the "+ Add" chip.
-- **History:** rows grouped by month, each with the type's emoji badge, the type (and "Upcoming"), and a subtitle of the date, "with" the others, the activities, and the day's first places ("and 5 more") or its first line, cut at 80 characters. Moods and weather never show here. A meetup with photos ends its row with its first photo, a 40px thumbnail with 8px corners, before the chevron. Tapping a row opens the Meetup page.
+- **History:** rows grouped by month, each a Meetup row naming the others. Tapping a row opens the Meetup page.
+
+### Meetup row
+One row for a meetup, the same everywhere (a friend's History, Recent meetups, the Meetups page): the type's emoji badge, the type as the title (with "Upcoming" for a future date, except under the Meetups page's "Upcoming" title, which already says it), a subtitle of the date, "with" the friends, the activities, and the day's first places ("and 5 more") or its first line cut at 80 characters, then the first photo as a 40px thumbnail with 8px corners, before the chevron (its Linen box shows from the start, so a row never shifts when the photo arrives). On a friend's page "with" leaves that friend out; everywhere else it names everyone. In Recent meetups the subtitle stops at two lines; elsewhere it wraps in full. Moods, weather and How it felt never show. Tapping it opens the Meetup page.
 
 ### Meetup page
-The memory view of one meetup, pushed like a friend's page. Nav bar: back ("Back", or the friend's name when opened from their history) and **Edit**, which opens the Edit meetup sheet.
+The memory view of one meetup, pushed like a friend's page. Nav bar: back ("Back", the friend's name from their history, "Friends" from Recent meetups, or "Meetups" from the Meetups page) and **Edit**, which opens the Edit meetup sheet.
 - **Hero:** centered: the type's emoji in a 96px Linen circle (a 48px emoji), the type name in Title, the date in Warm Ink Secondary, then the weather after a middle dot ("Sat, Oct 3 · 🌧️ Rainy", the emoji hidden from VoiceOver), with the "Upcoming" badge for a future date, then a Footnote "With" label over the friends as person chips (a 28px avatar and the name in a Paper White pill) that open the friend.
 - **Then, each hidden when empty:** **Activities** as read-only chips (the chip look without a press state), **The day** (the day view, below), **How it felt** (the face in a 44px Linen circle and its word in Body 600, then the words, in a Paper White box with 14px corners; never for an upcoming meetup), the day row ("Write about the day" as an accent row with the subtitle "Places, what happened, how it felt", or "Edit the day", with a 📝 emoji badge; always there), and **Photos** in the 3-across grid; a thumbnail opens the photo viewer.
 - When the meetup is deleted from the sheet, the page goes back.
@@ -374,7 +378,13 @@ The day's text read back: Paper White, 14px corners. Places form an ordered list
 Full screen over everything, on the Viewer Ground with Viewer Ink controls: a Close button top left; the photo fit between the bars, letterboxed, with no zoom; and Previous, "2 of 5" (rounded, tabular) and Next along the bottom, all 44px. A sideways swipe or the arrow keys change photos: the next one slides 32px and fades in over 220ms (with Reduce Motion it only fades). Previous and Next dim to 35% at the ends. Escape closes it. It is a modal dialog named "Photo 2 of 5", the image's alt names the photo, the type and the date ("Photo 2 of 5, Coffee, Sat, Sep 12"), focus stays inside, and closing puts focus back on the photo's thumbnail.
 
 ### Birthdays soon
-An inset group titled "Birthdays soon" at the top of the Friends tab, above the search field, listing friends whose birthday is today or in the next 14 days, soonest first. Each row is a link with the 44px avatar, the name and the countdown ("Today · turns 31", "Tomorrow", "In 5 days"), like the friend rows below it. At most 3 rows; the footer counts the rest ("And 3 more in the next two weeks."). The group is hidden when no birthday is that close, while searching, and while a group filter is on, so the list below stays a plain filtered list.
+An inset group titled "Birthdays soon" at the top of the Friends tab, above Recent meetups and the search field, listing friends whose birthday is today or in the next 14 days, soonest first. Each row is a link with the 44px avatar, the name and the countdown ("Today · turns 31", "Tomorrow", "In 5 days"), like the friend rows below it. At most 3 rows; the footer counts the rest ("And 3 more in the next two weeks."). The group is hidden when no birthday is that close, while searching, and while a group filter is on, so the list below stays a plain filtered list. Searching or picking a group hides it (and Recent meetups) without moving the search field: the page scrolls by what went away.
+
+### Recent meetups
+An inset group titled "Recent meetups" on the Friends tab, after Birthdays soon and before the search field: the 3 latest meetups dated today or earlier (the 2 latest while Birthdays soon shows), newest first, as Meetup rows naming everyone, each subtitle stopped at two lines, then "See all meetups", an accent row with a chevron and no badge, which opens the Meetups page. Hidden when no meetup has happened yet, while searching, and while a group filter is on; searching or picking a group hides it without moving the search field.
+
+### Meetups page
+Every meetup, pushed from Recent meetups: back "Friends", the large title "Meetups", a search field ("Search meetups"), then "Upcoming" (soonest first, its rows without the "Upcoming" badge) and one group per month, newest first ("October 2026"), as Meetup rows naming everyone. The search looks in friend names, the type, activities, the day and, for meetups that have happened, How it felt's words, ignoring case and accents, and every word typed must be found; never weather, moods or dates. It shows 60 rows, then "Show older meetups" adds 60. Going back to it keeps the search, the rows shown and the scroll; the app lock starts it fresh. Empty: "No meetups yet." with "Your first meetup will show up here."; no match: "No meetups match “zebra”." The "+ Log meetup" pill shows whenever there's a friend.
 
 ### Reminders group
 The "Reminders" inset group in Settings, right after Organize: a "Birthday reminders" switch row and, while it's on, a "Send a test notification" accent row. The footer says in plain words what the switch does, that it's on, or why it can't be used: "A notification at 11:55 PM the night before each birthday.", "On. You'll get a note at 11:55 PM the night before each birthday." (plus "Couldn't update reminders just now. The app will try again next time it opens." after a failed update), "Open Friend Tracker from your Home Screen to turn on reminders.", "Notifications are off for Friend Tracker. Turn them on in the iPhone's Settings app, under Notifications → Friends.", or "Reminders stopped. Turn them on again.". Toasts: "Birthday reminders are on" and "Test notification sent" with the check; "Birthday reminders are off", "Couldn't turn on reminders. Please try again.", "Birthday reminders aren't set up yet.", "Couldn't turn off reminders. Please try again." and "Couldn't send a test notification. Please try again." plain, and the denied footer's words as a plain toast when notifications are refused.
@@ -416,7 +426,7 @@ Shown instead of the app, never over it, when the app lock is on and the app has
 - **Do** make every tap target at least 44×44pt; extend small visuals (36px chips) with an invisible hit area.
 - **Do** keep every left edge on the 16px page margin: large title, search, chips, and inset groups.
 - **Do** phrase "time since" neutrally ("Last seen 3 months ago", "Not seen yet"), never as a warning.
-- **Do** let text wrap and rows grow at large text sizes. Truncate only where iOS does (the back label, a two-line name under an avatar).
+- **Do** let text wrap and rows grow at large text sizes. Truncate only where iOS does (the back label, a two-line name under an avatar, a Recent meetups row's subtitle, which stops at two lines like a Mail preview).
 - **Do** use undo toasts instead of confirmation dialogs where the action is easily reversible; confirm only destructive, hard-to-undo actions.
 - **Do** pair every chart color with a legend and the numbers themselves.
 - **Do** check both themes: every text pair passes WCAG AA (Warm Ink Tertiary on Linen is the floor at 4.6:1).
@@ -425,6 +435,7 @@ Shown instead of the app, never over it, when the app lock is on and the app has
 - **Don't** look like a business CRM: no pipelines, dense tables, or cold "last contacted" language. Friends are not leads.
 - **Don't** add guilt-trip streaks: no Duolingo-style pressure, red alerts, overdue badges, or "you're losing touch!" shaming.
 - **Don't** feel like a social media feed: nothing busy, noisy, attention-grabbing, or endlessly scrolling.
+- **Don't** load more rows as a list scrolls; a long list ends with a button that shows more.
 - **Don't** look like a generic template app: no purple gradients, identical card grids, gradient text, or glassmorphism.
 - **Don't** use colored side-stripe borders on rows or cards, or any border thicker than a 0.5px hairline. (Two small exceptions: the Add photos tile's 1.5px dashed outline, which marks an empty slot, and the 1.5px Warm Paper ring that keeps a photo's remove button visible.)
 - **Don't** put a shadow on anything that rests on the page; Float is for the sheet, the Log pill, and the toast only.
```

- [ ] **Step 4: Record the decisions in the spec**

```diff
--- a/docs/superpowers/specs/2026-10-05-meetup-history-design.md
+++ b/docs/superpowers/specs/2026-10-05-meetup-history-design.md
@@ -446,3 +446,14 @@ Nothing compares images: review them by eye, `large-text-02-friends` and `02-fri
 - **Approved** by the owner ("Auto approve", 2026-10-05) with A plus B: Recent meetups after Birthdays soon and before the search field, the 3 latest past meetups or 2 while Birthdays soon is showing (`RECENT_MEETUPS_WITH_BIRTHDAYS`), each subtitle stopped at two lines, then "See all meetups", and the search field kept still when the groups above it hide or show. Option C is out of scope. The open options ("If it still feels crowded") become "Where the friend list lands", which records the choice and its positions.
 - **E2E:** a fourteenth test in `e2e/history.spec.ts`, "Two recent rows while Birthdays soon shows", so E2E goes from 158 to 172.
 - **Corrections:** with 2 birthdays everything sits about 60px higher and with 1 about 120px higher (the pairing was reversed); the removed heights read about 455-520px with Birthdays soon (2 recent rows) and about 285-345px without it; and "Keeping the search field still" covers the bottom of the page, where a page too short to scroll the whole distance (clearing a search with only a few friends) leaves the field a little lower but on screen.
+
+## Decisions made while building
+
+- **Which meetups have photos is one live query for the whole app.** `useMeetupIdsWithPhotos()` reads a context that `MeetupIdsWithPhotosProvider` (`src/data/MeetupIdsWithPhotosProvider.tsx`, inside `App` next to `PlaceMemoryProvider`) fills from the `uniqueKeys()` walk. A walk takes one IndexedDB round trip per meetup with photos, and in WebKit each round trip is slow (about 15ms each in the WebKit the e2e runs on, where 100 meetups with photos took about 1.5s). Read per screen, going back to a long Meetups page rendered its rows after `ScrollManager`'s 1s retry had given up, and the scroll was lost. Kept for the app, the set is there the moment a screen mounts; it still follows every photo change, and the app lock drops it with the rest of `App`. `ScrollManager` is unchanged.
+- **`newestFirst`** (newest date first, then the one logged later) is exported from `src/stats/history.ts` and shared by `groupByMonth` and `recentMeetups`, so Recent meetups, the months and a friend's History order meetups the same way.
+- **The thumbnail cache forgets** the photo ids `deleteMeetup` deletes and the `removeIds` an `updateMeetup` gives, after the transaction, and `replaceAllData` clears it after a restore (with a unit test that a restored photo shows its own thumbnail). `deleteFriend`, which deletes the photos of meetups left with no one, doesn't: photo ids are never reused, so an entry left behind only takes room until the 300 limit drops it.
+- **Focus after "Show older meetups":** the button's handler sets a pending flag and the row count it had; that index picks the row (or its group's heading) that gets a callback ref, and an effect keyed on the row count focuses it with `preventScroll` once. The index isn't cleared afterwards, because taking the heading's `tabIndex` away while it has focus would drop focus; a new search clears it. `MeetupList` passes its row count to `onShowMore`, so the callback stays stable without reading a stale count.
+- **The live region's words** come from the trimmed query the 700ms timer saw, shown only while it equals the deferred trimmed query, so the announcement never disagrees with the list; each keystroke clears it first.
+- **`MeetupList` gets the searched groups,** built in `useMemo`s keyed on the deferred query in `MeetupsScreen`, rather than the raw data; a keystroke still re-renders only the field until the deferred value catches up.
+- **E2E helpers:** `seedMeetups` also takes `groups`, and `e2e/helpers.ts` gains the row builders `friendRow`, `meetupRow` and `photoRow` (with the shapes `SeedFriend`, `SeedMeetup` and `SeedPhoto` defined there, since the e2e project can't import `src/types.ts`'s extensionless imports).
+- **E2E details:** each test lands with its task (the Friends tab tests with Recent meetups, the Meetups page tests with the page). "The search field stays put" puts all 12 friends in the group, so the group's chip leaves the page long enough to keep the field still (a short page clamps the scroll, as "Keeping the search field still" says). "See all opens Meetups" adds a second upcoming meetup (an Activity on Oct 12) so "soonest first" is checked. `detail.spec.ts` also checks that the History thumbnail sits in its `.meetup-thumb` box and that a row without a photo has none.
```

- [ ] **Step 5: Run everything**

Run: `npx tsc -b`, then `npm test`
Expected: `Test Files  58 passed (58)` and `Tests  711 passed (711)`.

Run: `npm run build`, then `npm run e2e`
Expected: the build passes; `172 passed`.

- [ ] **Step 6: Commit**

```bash
git add e2e/screenshots.spec.ts DESIGN.md docs/superpowers/specs/2026-10-05-meetup-history-design.md
git commit -F - <<'EOF'
test: Meetups screenshots, DESIGN.md and the decisions made while building

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Spec coverage

| Spec requirement | Where |
| --- | --- |
| Recent meetups on the Friends tab after Birthdays soon, before the search field; titled "Recent meetups", no footer | Task 3 |
| The 3 latest meetups dated today or earlier, 2 while Birthdays soon shows; newest first, the one logged later first on a date | Tasks 1 (`recentMeetups`, `RECENT_MEETUPS_WITH_BIRTHDAYS`, `newestFirst`) and 3 |
| Rows name everyone, back label "Friends"; subtitles stop at two lines with the whole text kept for VoiceOver | Tasks 2 (`subtitleLines`, `.meetup-row__clamp`) and 3; e2e "stops a subtitle at two lines" |
| "See all meetups": accent row, chevron, no badge, always shown with the group | Task 3 |
| Hidden while searching or filtering, with no friends, and before a meetup has happened | Task 3; e2e "hides while searching or filtering" |
| The search field stays still when the groups hide or come back (a scroll correction before paint) | Task 3; e2e "the search field stays put" |
| Shared `MeetupRow`: badge, type and "Upcoming" (`showUpcoming`), subtitle, thumbnail, chevron; "with" leaves out the friend only on their page | Tasks 1 (`meetupNames`, `meetupSubtitle`) and 2; e2e "the friend page still leaves its friend out" |
| `Row` gains `ref` | Task 2 |
| `MeetupThumb`: a 40px box from the first render, only for rows with a photo (`hasPhoto`) | Task 2; e2e in `detail.spec.ts` and "a long history" |
| `meetupIdsWithPhotos()` (key-only `uniqueKeys()`), `useMeetupIdsWithPhotos()` | Tasks 1, 2 and 4 (one app-wide live query) |
| Thumbnail cache: by photo id, 300, least recently used; forgotten on delete, edit and restore | Task 1 |
| Meetups page at `/meetups`: back "Friends", large title, search ("Search meetups", Enter hides the keyboard), "Upcoming" then months, "+ Log meetup" | Task 4; e2e "See all opens the Meetups page" |
| Search: names, type ("Meetup" when gone), activities, the day, How it felt only when it has happened; every word; case, accents and apostrophes ignored; never weather, mood or dates | Task 1 (`searchKey`, `meetupSearchText`, `matchesSearch`) and Task 4; e2e "the Meetups search" |
| Deferred query, index built only while searching, memoized list and rows | Task 4 |
| Announcer: no role, polite, 700ms after typing pauses, every match counted, a restored search never announced | Task 4; e2e "the Meetups search" and "goes back to the same search" |
| 60 rows, "Show older meetups" adds 60; reset only in the search's `onChange` | Tasks 1 (`firstRows`, `MEETUPS_PAGE_SIZE`) and 4 |
| Focus after "Show older meetups": the first row added, or its month's heading; no ring on a tap | Task 4; e2e "a long history" |
| Empty: "No meetups yet." / "Your first meetup will show up here.", no search; no match: "No meetups match “zebra”." | Task 4; e2e "Meetups with no meetups yet" and "the Meetups search" |
| Keeping your place per history entry (`PlaceMemoryProvider` inside `App`); the scroll restored past row 60; the app lock starts it fresh | Task 4; e2e "a long history" and "the app lock starts the Meetups page fresh" |
| Opening, Edit, Delete and Undo from the Meetups page | Task 4; e2e "goes back to the same search" and "deleting a meetup from Meetups" |
| Tab bar and Meetup page unchanged; "Meetups" and "Friends" back labels | Tasks 3 and 4 |
| No data, Dexie or backup change | All tasks |
| `friendLink`, `seedMeetups`, and the broken e2e lookups fixed | Task 3 |
| Screenshots `02-friends-full`, `19-meetups`, `20-meetups-search` in light, dark and large text; an upcoming Party in the seed | Task 5 |
| DESIGN.md entries | Task 5 |
| Counts: 58 unit test files; E2E 158 to 172 (14 in `e2e/history.spec.ts`); screenshots stay 15 | Tasks 1, 3, 4 and 5 |
