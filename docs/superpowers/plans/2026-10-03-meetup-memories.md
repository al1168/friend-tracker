# Meetup Memories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each meetup a small memory: pick activities and add up to 20 photos in the meetup sheet, look back at it on a new Meetup page with a full-screen photo viewer, see activities and a thumbnail in a friend's history, and keep it all in backups.

**Architecture:** `Meetup` gains `activities` (cleaned with the shared item rules, at most 20), filled in on old records by a meetups `reading` hook. Photos live in their own Dexie table, `meetupPhotos` (`version(3)`, indexed by `meetupId` and `[meetupId+order]`), never inside meetups, so everything that loads every meetup stays light. `addMeetup` and `updateMeetup` take a photo change set applied in the same transaction; delete, Undo and the friend cascade carry photos; backups move to version 4. Photos are resized on the phone by one decode drawn twice (1600px full, 320px thumbnail). The sheet holds activities and photos until Save; the new `/meetups/:id` page shows the memory and opens a `PhotoViewer` dialog; history rows link to the page and show the first photo's thumbnail through a one-record query.

**Tech Stack:** Vite 8, React 19, TypeScript 6 (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`), react-router 7 (HashRouter), Dexie 4 with dexie-react-hooks, Vitest 5 with fake-indexeddb (TZ America/Los_Angeles), Playwright WebKit (iPhone 13, port 4174, service workers blocked).

---

**Spec:** [docs/superpowers/specs/2026-10-03-meetup-memories-design.md](../specs/2026-10-03-meetup-memories-design.md), the source of truth. Design context: [DESIGN.md](../../../DESIGN.md) (sections 2, 3 and 5), [PRODUCT.md](../../../PRODUCT.md).

## Ground rules for every task

- Run every command from the project root in Git Bash: `/c/Users/luald/OneDrive/Desktop/Friend tracker`. The branch `feature/meetup-memories` is already checked out.
- TypeScript: type-only imports use `import type` or an inline `type` specifier; no enums, namespaces or constructor parameter properties; no unused locals or parameters (unused destructured names count too). Test files under `src/` and everything in `e2e/` are type-checked by `npm run build`.
- Import paths are extensionless inside `src/`. Inside `e2e/`, local files are imported with `.ts` (`./helpers.ts`).
- Copy (UI text, comments, docs) never uses em dashes. Use commas, colons, periods or parentheses.
- **The service worker opens the app database.** `src/sw/push.ts` imports `src/db/db.ts`, so a schema upgrade may run inside the service worker. Nothing in `db.ts` (or anything it imports) may touch `window` or `document`. `tsconfig.sw.json` type-checks `db.ts` with the WebWorker library only, so `npm run build` (`tsc -b`) catches a slip.
- **Photo data never goes in the meetups table.** Everything that loads every meetup (`useMeetups`, stats, history, last seen) must stay light. Photos are read by `meetupId` (indexed): the Meetup page reads one meetup's photos, a history row reads one record through `[meetupId+order]`, and only Settings reads them all (for the backup).
- Never run `npm run dev`, `npm run preview`, `vite preview` or wrangler yourself. `npm run e2e` and `npm run screenshots` build and start their own preview server.
- Commands:
  - Unit tests: `npm test` (one file: `npx vitest run <path>`)
  - Type check and production build: `npm run build` (quick type check only: `npx tsc -b`)
  - End-to-end tests: `npm run e2e` (one file: `npx playwright test --project=iphone <path>`)
  - Screenshots: `npm run screenshots`
- Baseline before Task 1: `npm test` shows `Test Files  43 passed (43)` and `Tests  461 passed (461)`; `npm run e2e` shows `94 passed`; `npm run screenshots` shows `14 passed`. Each task states the new totals, measured by applying this plan task by task to a clean checkout of the branch.
- **E2E and WebKit focus.** Playwright's WebKit, like Safari on the iPhone, doesn't move focus to a button when it's clicked. Keyboard handling that must work after a tap (the photo viewer's arrows and Escape) listens on `document`.
- **E2E photo files.** Tests hand files to the hidden `<input type="file">` with `setInputFiles`, as `e2e/friends.spec.ts` does for a friend's photo: the 1×1 PNG `ONE_PIXEL_PNG` from `e2e/helpers.ts` (`tinyPhoto()`), a non-image (`brokenPhoto()`), or a larger picture drawn in the page with a canvas (`drawnPhoto()`, Task 5). No fixture files are added.
- **Screenshots are not committed.** `e2e/screenshots` is in `.gitignore`; look at the PNGs locally and never `git add` them.
- Commit after each task with the exact `git add` paths and message given. Every commit message ends with a blank line and then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Decisions made while planning

The spec leaves these open. Task 8 records them at the end of the spec.

1. **One more index.** The photos table is `meetupPhotos: 'id, meetupId, [meetupId+order]'`. The compound index lets a history row read exactly one record (the first photo) instead of every photo of the meetup. IndexedDB always returns whole records, so that one read includes the full image; the hook keeps only the thumbnail and drops the rest at once. The v3 upgrade adds only this table (no upgrade function); meetups get `activities` from the reading hook.
2. **Activity messages.** "Keep each activity under 60 characters." and "A meetup can have up to 20 activities." (`src/lib/activities.ts`). The "+ New" field has `maxLength` 60, so the first only comes from code; picking a 21st activity shows the second as a hint under the chips.
3. **"+ New" adds one activity.** Unlike likes, the text isn't split on commas. Text that matches a chip (ignoring case) selects that chip's spelling. Enter or Add with an empty field, and Escape, close it. Text left in the open field is saved with Save (like the friend sheet's New group) and counts as a change for "Discard changes?". The chip's accessible name is "New activity" (visible "New").
4. **Suggestion spelling.** Spellings that differ only in case count as one activity, shown the way the latest meetup (by date, then `createdAt`) spells it.
5. **Which chips show.** The first 12 suggestions, then any of this meetup's activities not among them, then new ones. A chip tapped off stays where it is until the sheet closes, so nothing moves under the finger. "More" (accessible name "More activities") shows the rest and moves focus to the first chip it revealed.
6. **The photo change set.** `{ add, removeIds, order }`. The sheet picks each new photo's id (`newId()`), so `order` can list new and kept photos together; photos left out of `order` keep their relative order after the listed ones. `removeIds` that belong to another meetup are ignored. More than 20 photos after the changes, a duplicate id, or a new photo that isn't a JPEG or PNG data URL within the limits ("A photo couldn't be saved.") throws inside the transaction, so the meetup write rolls back too. A photo saved with a new meetup gets the meetup's `createdAt`; one added later gets the time it was saved.
7. **Resizing.** One decode (`createImageBitmap` with `imageOrientation: 'from-image'`, else an `<img>`), drawn once at 1600px; the 320px thumbnail is drawn from that canvas, not from the original (a better downscale and less work). Each canvas is shrunk to 0×0 as soon as it's encoded, because iOS caps the memory all canvases share. A result over the backup limits counts as "couldn't be added". The friend photo uses the same decode path.
8. **Adding photos in the sheet.** One file at a time; the tile reads "Adding 2 of 5…"; Save is disabled meanwhile, and closing the sheet stops the rest. With 20 photos already, tapping the tile shows "A meetup can have up to 20 photos." instead of opening the picker. When both happen, the two messages show together ("A meetup can have up to 20 photos. 1 photo couldn't be added."). A polite announcement says "Added 2 photos.". Removing a photo moves focus to the remove button that took its place, else the one before, else the tile.
9. **Storage.** After a save that adds photos, `askToKeepData()` calls `navigator.storage.persist()` unless `persisted()` already says yes, and ignores every failure. (`main.tsx` already asks once at launch; this asks again once photos make the data worth more.)
10. **Backups.** Version 4. Versions 1 to 3 import with `activities: []` and no photos (anything else in them is ignored). In version 4, any problem with a photo, including a `meetupId` that isn't in the file or a 21st photo for one meetup, gives `Photo N is invalid.` (N counts photos in the file). Sizes are the data URL's length in characters (4,194,304 for `full`, 524,288 for `thumb`); `order` must be a whole number from 0; `width` and `height` whole numbers from 1. Duplicate photo ids give "The backup has two photos with the same id.", and a version 4 file without the list gives 'The backup is missing its "meetupPhotos" list.'. Version 4 friends keep their birthdays (the parser's `version === 3` check becomes `version >= 3`).
11. **Export memory and the share gesture.** The backup is turned into text once (not twice). Settings loads every photo in the background (`useAllMeetupPhotos`) without waiting for it, so the share sheet still opens straight from the tap; if they haven't loaded yet, Export reads them first (the share may then fall back to a download).
12. **Backup footer.** "Last backup: today. Includes 12 photos." or "Never backed up. Includes 1 photo."; unchanged with no photos (`describeBackup`). It counts with `count()`, never reading images.
13. **The Meetup page.** Back says "Back", or the friend's name when opened from their history (`{ backLabel, tab }` state, keeping the tab the friend page came from); the fallback is `/`. `/meetups/...` belongs to the Friends tab. Friend chips link to the friend with the meetup's type as their back label. No "+ Log meetup" pill here. When the meetup disappears (deleted from the sheet), the page goes back one step, or to `/` when it was opened directly; an unknown id does the same.
14. **The viewer.** The dialog is named "Photo 2 of 5"; the visible "2 of 5" is a polite live region; the image's alt is "Photo 2 of 5, Coffee, Sat, Sep 12" (the type name and the page's date); grid thumbnails are "Photo 2 of 5". No wrap-around: Previous and Next are `aria-disabled` at the ends (not `disabled`, which would drop focus). Arrow keys, Escape and the Tab trap listen on `document`. Focus returns to the thumbnail of the photo showing when it closes. A swipe is 50px or more, mostly sideways. The ground is near-black in both themes; the iOS status bar keeps the app's theme color.
15. **History rows.** The subtitle is date · with … · activities (comma list) · note. The thumbnail is decorative (`alt=""`): the row's name stays its text.
16. **Shared styles.** `.person-chip` (Stats) and `.upcoming-badge` (friend page) move to `src/styles/base.css`, now that the Meetup page uses them too, next to the new shared `.photo-grid`.
17. **The sheet loads its own photos.** When editing, the sheet reads the meetup's photos as ids and thumbnails (`useMeetupPhotoThumbs`) once, so it works however it's opened.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/types.ts` | Modify | `Meetup.activities`; `MeetupPhoto` |
| `src/lib/activities.ts` / `.test.ts` | Create | Activity limits and messages, `STARTER_ACTIVITIES`, `activitiesProblem`, `activitySuggestions` |
| `src/lib/photos.ts` / `.test.ts` | Create | Photo limits and messages, `isPhotoDataUrl`, `isPixelSize`, `isValidPhotoData`, `describeSkippedPhotos` |
| `src/lib/image.ts` / `.test.ts` | Modify / Create | `fitWithin` (pure), one decode for `resizeImageToDataUrl` and `processPhoto` |
| `src/lib/persist.ts` / `.test.ts` | Create | `askToKeepData()` |
| `src/lib/text.ts` / `.test.ts` | Modify | `describeBackup` (footer with the photo count) |
| `src/db/db.ts` / `.test.ts` | Modify | `version(3)` with `meetupPhotos`; meetups `reading` hook; v2 to v3 upgrade test |
| `src/db/meetups.ts` / `.test.ts` | Modify | Activities in `MeetupInput`; `NewPhoto`, `PhotoChanges`, `NO_PHOTO_CHANGES`, `DeletedMeetup`; photo change set in the meetup transaction; delete and restore with photos; `photoCount`, `firstPhotoThumb` |
| `src/db/friends.ts` / `.test.ts` | Modify | `deleteFriend` deletes the photos of the meetups it deletes |
| `src/db/meetupTypes.test.ts` | Modify | `addMeetup` input gets `activities` |
| `src/test/fixtures.ts` | Modify | `meetup()` gets `activities: []`; `meetupPhoto()` |
| `src/backup/format.ts` / `.test.ts` | Modify | `BackupData.meetupPhotos`; version 4; activities and photo validation |
| `src/backup/storage.ts` / `.test.ts` | Modify | `readAllData`, `replaceAllData` and `readAllPhotos` with photos |
| `src/backup/exportBackup.ts` | Modify | Stringify the backup once |
| `src/lock/lockStore.test.ts` | Modify | A backup's keys include `meetupPhotos` |
| `src/data/hooks.ts` | Modify | `useAllMeetupPhotos`, `usePhotoCount`, `useMeetupPhotoThumbs`, `useMeetup`, `useMeetupPhotos`, `useFirstPhotoThumb` |
| `src/screens/SettingsScreen.tsx` | Modify | Export with photos; the footer's photo count |
| `src/components/icons.tsx` | Modify | `IconCameraPlus` |
| `src/sheets/MeetupActivities.tsx` | Create | The sheet's Activities section |
| `src/sheets/MeetupPhotos.tsx` | Create | The sheet's Photos section and resizing loop; `DraftPhoto` |
| `src/sheets/MeetupSheet.tsx` / `.css` | Modify | Activities and photos state, dirty tracking, the change set on Save, `askToKeepData` |
| `src/styles/base.css` | Modify | Shared `.photo-grid`, `.person-chip`, `.upcoming-badge` |
| `src/styles/tokens.css` | Modify | `--viewer-bg`, `--viewer-ink`, `--viewer-pressed` |
| `src/screens/MeetupScreen.tsx` / `.css` | Create | The Meetup page |
| `src/components/PhotoViewer.tsx` / `.css` | Create | The full-screen photo viewer dialog |
| `src/App.tsx` | Modify | Route `/meetups/:id` |
| `src/components/TabBar.tsx` | Modify | `/meetups` belongs to Friends |
| `src/screens/FriendDetailScreen.tsx` / `.css` | Modify | History rows link to the Meetup page; activities in the subtitle; first-photo thumbnail |
| `src/screens/StatsScreen.css` | Modify | `.person-chip` moves to base.css |
| `e2e/helpers.ts` | Modify | `logMeetup` takes activities and photos; photo files, `pickActivity`, `addPhotos`, `photoGrid`, `openFriendPage`, `editMeetup`, `readMeetupPhotos`, `imageSize` |
| `e2e/memories.spec.ts` | Create | Sheet: activities, photos, limits, edit, Cancel, delete and Undo, backup |
| `e2e/meetupPage.spec.ts` | Create | Meetup page and photo viewer |
| `e2e/detail.spec.ts` | Modify | History rows are links to the Meetup page; activities and thumbnail |
| `e2e/preferences.spec.ts`, `e2e/birthdays.spec.ts` | Modify | Backups are version 4 |
| `e2e/screenshots.spec.ts` | Modify | Meetup page, viewer and sheet captures |
| `DESIGN.md` | Modify | Viewer ground; Activities and Photos in the sheet; Meetup page; viewer; history thumbnail |
| `docs/superpowers/specs/2026-10-03-meetup-memories-design.md` | Modify | Appends the planning decisions |

---

### Task 1: Activities on meetups, suggestions, and the photos table (Dexie version 3)

**Files:**
- Create: `src/lib/activities.ts`, `src/lib/activities.test.ts`
- Modify: `src/types.ts` (the `Meetup` interface, a new `MeetupPhoto`), `src/db/db.ts` (version 3, meetups reading hook), `src/db/meetups.ts` (`MeetupInput.activities`, `clean`, `updateMeetup`), `src/test/fixtures.ts` (`meetup()`), `src/backup/format.ts` (meetups parse with `activities: []`), `src/sheets/MeetupSheet.tsx` (`save` passes the meetup's activities through)
- Test: `src/db/db.test.ts`, `src/db/meetups.test.ts`, and the `addMeetup` inputs in `src/db/friends.test.ts`, `src/db/meetupTypes.test.ts`, `src/backup/storage.test.ts`

- [ ] **Step 1: Write the failing tests for the activity rules**

Create `src/lib/activities.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { meetup } from '../test/fixtures'
import {
  ACTIVITY_TOO_LONG,
  activitiesProblem,
  activitySuggestions,
  MAX_ACTIVITIES,
  STARTER_ACTIVITIES,
  TOO_MANY_ACTIVITIES,
} from './activities'

/** A meetup with these activities on this date. */
function did(date: string, activities: string[], id = `m-${date}-${activities.join()}`) {
  return { ...meetup(id, date, ['alex']), activities }
}

describe('limits', () => {
  it('allows 20 activities per meetup', () => {
    expect(MAX_ACTIVITIES).toBe(20)
    expect(TOO_MANY_ACTIVITIES).toBe('A meetup can have up to 20 activities.')
    expect(ACTIVITY_TOO_LONG).toBe('Keep each activity under 60 characters.')
  })
})

describe('activitiesProblem', () => {
  it('accepts up to 20 activities of up to 60 characters', () => {
    expect(activitiesProblem([])).toBeNull()
    expect(activitiesProblem(['x'.repeat(60)])).toBeNull()
    expect(activitiesProblem(Array.from({ length: 20 }, (_, i) => `Activity ${i + 1}`))).toBeNull()
  })

  it('refuses a long activity or too many', () => {
    expect(activitiesProblem(['x'.repeat(61)])).toBe(ACTIVITY_TOO_LONG)
    expect(activitiesProblem(Array.from({ length: 21 }, (_, i) => `Activity ${i + 1}`))).toBe(TOO_MANY_ACTIVITIES)
  })
})

describe('activitySuggestions', () => {
  it('suggests the starters when nothing has been used', () => {
    expect(activitySuggestions([])).toEqual(STARTER_ACTIVITIES)
    expect(STARTER_ACTIVITIES).toEqual([
      'Board games',
      'Karaoke',
      'Movie',
      'Walk',
      'Concert',
      'Shopping',
      'Cooking',
      'Sports',
      'Beach',
      'Museum',
    ])
  })

  it('puts used activities first, most used first, then by name', () => {
    const suggestions = activitySuggestions([
      did('2026-09-01', ['Pottery', 'Walk']),
      did('2026-09-02', ['Walk', 'Arcade']),
      did('2026-09-03', ['Pottery', 'Walk']),
      did('2026-09-04', ['Bowling']),
    ])
    expect(suggestions.slice(0, 4)).toEqual(['Walk', 'Pottery', 'Arcade', 'Bowling'])
  })

  it('leaves out starters that have been used, ignoring case', () => {
    const suggestions = activitySuggestions([did('2026-09-01', ['karaoke', 'Pottery'])])
    expect(suggestions).toEqual([
      'karaoke',
      'Pottery',
      ...STARTER_ACTIVITIES.filter((starter) => starter !== 'Karaoke'),
    ])
  })

  it('counts spellings that differ in case as one, spelled like the latest meetup', () => {
    const suggestions = activitySuggestions([
      did('2026-09-01', ['board games']),
      did('2026-09-05', ['Board Games']),
      { ...did('2026-09-05', ['BOARD GAMES'], 'older-same-day'), createdAt: '2026-09-04T12:00:00.000Z' },
    ])
    expect(suggestions[0]).toBe('Board Games')
    expect(suggestions.filter((name) => name.toLocaleLowerCase() === 'board games')).toHaveLength(1)
  })

  it('cleans stored spellings and skips empty ones', () => {
    expect(activitySuggestions([did('2026-09-01', ['  Pottery   class ', ' '])]).slice(0, 2)).toEqual([
      'Pottery class',
      'Board games',
    ])
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/activities.test.ts`
Expected: FAIL, `Failed to resolve import "./activities"`.

- [ ] **Step 3: Add `activities` and `MeetupPhoto` to the types, and write the rules**

In `src/types.ts`, replace:

```ts
export interface Meetup {
  id: string
  date: ISODate
  typeId: string
  friendIds: string[]
  note: string
  createdAt: string
}
```

with:

```ts
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

/** One photo of a meetup. Stored in its own table, never inside the meetup. */
export interface MeetupPhoto {
  id: string
  meetupId: string
  /** 0-based position in the meetup */
  order: number
  /** JPEG data URL, longest side ≤ 1600px */
  full: string
  /** JPEG data URL, longest side ≤ 320px */
  thumb: string
  /** Size of `full` in pixels */
  width: number
  height: number
  createdAt: string
}
```

Create `src/lib/activities.ts`:

```ts
// Rules for a meetup's activities, shared by the data layer, the backup parser and the meetup sheet.
// Each activity is cleaned like a like (see src/lib/preferences.ts): trimmed, single-spaced, at most
// 60 characters, and unique ignoring case.

import type { Meetup } from '../types'
import { cleanItem, indexOfItem, MAX_ITEM_LENGTH } from './preferences'
import { compareNames } from './text'

/** The most activities one meetup can have. */
export const MAX_ACTIVITIES = 20

export const ACTIVITY_TOO_LONG = `Keep each activity under ${MAX_ITEM_LENGTH} characters.`
export const TOO_MANY_ACTIVITIES = `A meetup can have up to ${MAX_ACTIVITIES} activities.`

/** Suggested until they've been used, after every activity used before. */
export const STARTER_ACTIVITIES = [
  'Board games',
  'Karaoke',
  'Movie',
  'Walk',
  'Concert',
  'Shopping',
  'Cooking',
  'Sports',
  'Beach',
  'Museum',
]

/** What would stop this cleaned list from being saved, or null. */
export function activitiesProblem(activities: readonly string[]): string | null {
  if (activities.some((activity) => activity.length > MAX_ITEM_LENGTH)) return ACTIVITY_TOO_LONG
  if (activities.length > MAX_ACTIVITIES) return TOO_MANY_ACTIVITIES
  return null
}

/**
 * Every activity used before, most used first (then by name), then the starters not used yet.
 * Spellings that differ only in case count as one activity, shown as the latest meetup spells it.
 */
export function activitySuggestions(meetups: readonly Pick<Meetup, 'activities' | 'date' | 'createdAt'>[]): string[] {
  const newestFirst = [...meetups].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const used = new Map<string, { name: string; count: number }>()
  for (const meetup of newestFirst) {
    for (const activity of meetup.activities) {
      const name = cleanItem(activity)
      if (name === '') continue
      const key = name.toLocaleLowerCase()
      const entry = used.get(key)
      if (entry) entry.count += 1
      else used.set(key, { name, count: 1 })
    }
  }
  const names = [...used.values()]
    .sort((a, b) => b.count - a.count || compareNames(a.name, b.name))
    .map((entry) => entry.name)
  return [...names, ...STARTER_ACTIVITIES.filter((starter) => indexOfItem(names, starter) === -1)]
}
```

- [ ] **Step 4: Run the rule tests to see them pass**

Run: `npx vitest run src/lib/activities.test.ts`
Expected: PASS, `Tests  8 passed (8)`.

- [ ] **Step 5: Write the failing tests for the database and the data layer**

In `src/db/db.test.ts`, replace:

```ts
import type { Friend } from '../types'
```

with:

```ts
import type { Friend, Meetup } from '../types'
```

Replace:

```ts
    // Dexie stores the version times 10. Read it from the native database to prove the upgrade ran.
    expect(db.backendDB().version).toBe(20)
  })
})
```

with:

```ts
    // Dexie stores the version times 10. Read it from the native database to prove the upgrades ran.
    expect(db.backendDB().version).toBe(30)
  })
})

describe('upgrade from version 2', () => {
  it('adds the meetup photos table, gives meetups empty activities and changes nothing else', async () => {
    const v2Stores = {
      friends: 'id, groupId',
      groups: 'id',
      meetupTypes: 'id, order',
      meetups: 'id, date, typeId, *friendIds',
      settings: 'key',
    }
    const v2Friend = {
      id: 'f1',
      name: 'Alex',
      groupId: null,
      photo: null,
      notes: '',
      likes: ['Sushi'],
      dislikes: [],
      birthday: { month: 3, day: 14, year: null },
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const v2Meetup = {
      id: 'm1',
      date: '2026-09-01',
      typeId: 'type-coffee',
      friendIds: ['f1'],
      note: 'Tacos',
      createdAt: '2026-09-01T12:00:00.000Z',
    }
    // Build the database as version 2 of the app left it, under the app's own name.
    // (The next test's resetDatabase deletes it and reopens the app database fresh.)
    db.close()
    await Dexie.delete('friend-tracker')
    const v2 = new Dexie('friend-tracker')
    v2.version(2).stores(v2Stores)
    try {
      await v2.table('friends').add(v2Friend)
      await v2.table('meetups').add(v2Meetup)
      await v2.table('settings').put({ key: 'lastBackupAt', value: '2026-10-02T10:00:00.000Z' })
    } finally {
      v2.close()
    }

    await db.open()

    // Dexie stores the version times 10. Read it from the native database to prove the upgrade ran.
    const native = db.backendDB()
    expect(native.version).toBe(30)
    expect([...native.objectStoreNames].sort()).toEqual([
      'friends',
      'groups',
      'meetupPhotos',
      'meetupTypes',
      'meetups',
      'settings',
    ])
    const photoIndexes = native.transaction('meetupPhotos').objectStore('meetupPhotos').indexNames
    expect([...photoIndexes].sort()).toEqual(['[meetupId+order]', 'meetupId'])
    const meetupIndexes = native.transaction('meetups').objectStore('meetups').indexNames
    expect([...meetupIndexes].sort()).toEqual(['date', 'friendIds', 'typeId'])
    expect(await db.meetupPhotos.count()).toBe(0)
    // The stored meetup is untouched; the reading hook gives it activities.
    expect(await db.meetups.get('m1')).toEqual({ ...v2Meetup, activities: [] })
    expect(await db.friends.get('f1')).toEqual(v2Friend)
    expect(await getSetting('lastBackupAt')).toBe('2026-10-02T10:00:00.000Z')
  })
})

describe('meetups read from the database', () => {
  it('get empty activities when the stored record has none', async () => {
    await db.meetups.put({
      id: 'old',
      date: '2026-09-01',
      typeId: 'type-coffee',
      friendIds: ['alex'],
      note: '',
      createdAt: '2026-09-01T12:00:00.000Z',
    } as unknown as Meetup)
    expect(await db.meetups.get('old')).toMatchObject({ activities: [] })
    expect((await db.meetups.toArray())[0]).toMatchObject({ activities: [] })
    expect((await db.meetups.where('friendIds').equals('alex').toArray())[0]).toMatchObject({ activities: [] })
  })
})
```

Replace:

```ts
    expect(await db.meetups.count()).toBe(0)
  })
})
```

with:

```ts
    expect(await db.meetups.count()).toBe(0)
    expect(await db.meetupPhotos.count()).toBe(0)
  })
})
```

In `src/db/meetups.test.ts`, replace:

```ts
const base: MeetupInput = { date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], note: '' }
```

with:

```ts
const base: MeetupInput = { date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], note: '', activities: [] }
```

Replace:

```ts
  it('rejects an invalid date', async () => {
    await expect(addMeetup({ ...base, date: '2026-02-30' })).rejects.toThrow('Please pick a valid date.')
  })
})
```

with:

```ts
  it('rejects an invalid date', async () => {
    await expect(addMeetup({ ...base, date: '2026-02-30' })).rejects.toThrow('Please pick a valid date.')
  })

  it('cleans activities like likes, keeping the order picked', async () => {
    const meetup = await addMeetup({ ...base, activities: [' Board   games ', 'Karaoke', 'board games', ' ', 'karaoke'] })
    expect(meetup.activities).toEqual(['Board games', 'Karaoke'])
    expect((await db.meetups.get(meetup.id))?.activities).toEqual(['Board games', 'Karaoke'])
  })

  it('refuses an activity over 60 characters or more than 20 activities, and saves nothing', async () => {
    await expect(addMeetup({ ...base, activities: ['x'.repeat(61)] })).rejects.toThrow(
      'Keep each activity under 60 characters.',
    )
    const tooMany = Array.from({ length: 21 }, (_, i) => `Activity ${i + 1}`)
    await expect(addMeetup({ ...base, activities: tooMany })).rejects.toThrow('A meetup can have up to 20 activities.')
    expect(await db.meetups.count()).toBe(0)
  })
})
```

Replace:

```ts
    await updateMeetup(meetup.id, { ...base, date: '2026-09-05', note: 'Pizza' })
    expect(await db.meetups.get(meetup.id)).toMatchObject({ date: '2026-09-05', note: 'Pizza' })
  })
})
```

with:

```ts
    await updateMeetup(meetup.id, { ...base, date: '2026-09-05', note: 'Pizza' })
    expect(await db.meetups.get(meetup.id)).toMatchObject({ date: '2026-09-05', note: 'Pizza' })
  })

  it('replaces the activities with the cleaned list', async () => {
    const meetup = await addMeetup({ ...base, activities: ['Walk'] })
    await updateMeetup(meetup.id, { ...base, activities: ['Movie ', ' movie', 'Walk'] })
    expect((await db.meetups.get(meetup.id))?.activities).toEqual(['Movie', 'Walk'])
  })

  it('refuses too many activities and keeps the old ones', async () => {
    const meetup = await addMeetup({ ...base, activities: ['Walk'] })
    const tooMany = Array.from({ length: 21 }, (_, i) => `Activity ${i + 1}`)
    await expect(updateMeetup(meetup.id, { ...base, activities: tooMany })).rejects.toThrow(
      'A meetup can have up to 20 activities.',
    )
    expect((await db.meetups.get(meetup.id))?.activities).toEqual(['Walk'])
  })
})
```

- [ ] **Step 6: Run them to see them fail**

Run: `npx vitest run src/db`
Expected: FAIL. Both upgrade tests get `expected 20 to be 30`; "starts empty otherwise" fails reading `count` of the missing `db.meetupPhotos`; "meetups read from the database" and the activity tests in `meetups.test.ts` find `activities` undefined.

- [ ] **Step 7: Add version 3 and the reading hook**

In `src/db/db.ts`, replace:

```ts
import type { Friend, Group, Meetup, MeetupType } from '../types'
```

with:

```ts
import type { Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'
```

Replace:

```ts
  meetups: EntityTable<Meetup, 'id'>
  settings: EntityTable<SettingRow, 'key'>
}
```

with:

```ts
  meetups: EntityTable<Meetup, 'id'>
  meetupPhotos: EntityTable<MeetupPhoto, 'id'>
  settings: EntityTable<SettingRow, 'key'>
}
```

Replace:

```ts
// The upgrade above runs once, but older code that is still running (a second tab, or a
```

with:

```ts
// Version 3 adds the meetup photos table. Photos never live inside meetups, so everything that
// loads every meetup (stats, history, last seen) stays light. `[meetupId+order]` finds a meetup's
// first photo without reading the others. No other store changes, so there is no upgrade step:
// meetups get their activities from the reading hook below.
// (The service worker opens this database too, so nothing here may touch window or document.)
db.version(3).stores({
  friends: 'id, groupId',
  groups: 'id',
  meetupTypes: 'id, order',
  meetups: 'id, date, typeId, *friendIds',
  settings: 'key',
  meetupPhotos: 'id, meetupId, [meetupId+order]',
})

// The version 2 upgrade runs once, but older code that is still running (a second tab, or a
```

Replace:

```ts
    friend.birthday ??= null
  }
  return friend
})
```

with:

```ts
    friend.birthday ??= null
  }
  return friend
})

// Meetups saved before activities existed have none.
db.meetups.hook('reading', (meetup) => {
  if (meetup) meetup.activities ??= []
  return meetup
})
```

- [ ] **Step 8: Clean and save activities in the data layer**

In `src/db/meetups.ts`, replace:

```ts
import { isISODate, type ISODate } from '../lib/dates'
import { newId } from '../lib/ids'
```

with:

```ts
import { activitiesProblem } from '../lib/activities'
import { isISODate, type ISODate } from '../lib/dates'
import { newId } from '../lib/ids'
import { cleanItems } from '../lib/preferences'
```

Replace:

```ts
  friendIds: string[]
  note: string
}
```

with:

```ts
  friendIds: string[]
  note: string
  /** In the order picked. Cleaned like likes: empties and repeats are dropped. */
  activities: string[]
}
```

Replace:

```ts
  return { date: input.date, typeId: input.typeId, friendIds, note: input.note.trim() }
```

with:

```ts
  const activities = cleanItems(input.activities)
  const problem = activitiesProblem(activities)
  if (problem) throw new ValidationError(problem)
  return { date: input.date, typeId: input.typeId, friendIds, note: input.note.trim(), activities }
```

Replace:

```ts
  const { date, typeId, friendIds, note } = clean(input)
  await db.transaction('rw', db.meetups, async () => {
    if (!(await db.meetups.get(id))) throw new ValidationError('This meetup no longer exists.')
    await db.meetups.update(id, { date, typeId, friendIds, note })
  })
```

with:

```ts
  const { date, typeId, friendIds, note, activities } = clean(input)
  await db.transaction('rw', db.meetups, async () => {
    if (!(await db.meetups.get(id))) throw new ValidationError('This meetup no longer exists.')
    await db.meetups.update(id, { date, typeId, friendIds, note, activities })
  })
```

- [ ] **Step 9: Give every other `Meetup` and `MeetupInput` its activities**

The type now requires `activities`, so `tsc -b` would fail on everything that builds a meetup without it.

In `src/test/fixtures.ts`, replace:

```ts
  return { id, date, typeId, friendIds, note: '', createdAt: `${date}T12:00:00.000Z` }
```

with:

```ts
  return { id, date, typeId, friendIds, note: '', activities: [], createdAt: `${date}T12:00:00.000Z` }
```

In `src/backup/format.ts`, replace:

```ts
      note: text(r, 'note', where),
      createdAt: text(r, 'createdAt', where),
```

with:

```ts
      note: text(r, 'note', where),
      // Backups up to version 3 were made before activities existed.
      activities: [],
      createdAt: text(r, 'createdAt', where),
```

In `src/sheets/MeetupSheet.tsx` (the sheet gets its Activities section in Task 5; until then editing keeps a meetup's activities), replace:

```ts
      const input = { date, typeId: effectiveTypeId, friendIds, note }
```

with:

```ts
      const input = { date, typeId: effectiveTypeId, friendIds, note, activities: editing?.activities ?? [] }
```

In `src/db/friends.test.ts`, replace:

```ts
    const solo = await addMeetup({ date: '2026-09-01', typeId: 'type-coffee', friendIds: [alex.id], note: '' })
    const shared = await addMeetup({ date: '2026-09-02', typeId: 'type-meal', friendIds: [alex.id, sam.id], note: '' })
```

with:

```ts
    const solo = await addMeetup({
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

In `src/db/meetupTypes.test.ts`, replace:

```ts
    await addMeetup({ date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], note: '' })
```

with:

```ts
    await addMeetup({ date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], note: '', activities: [] })
```

In `src/backup/storage.test.ts`, replace:

```ts
    await addMeetup({ date: '2026-09-01', typeId: 'type-meal', friendIds: [alex.id, sam.id], note: 'Tacos' })
```

with:

```ts
    await addMeetup({
      date: '2026-09-01',
      typeId: 'type-meal',
      friendIds: [alex.id, sam.id],
      note: 'Tacos',
      activities: [],
    })
```

- [ ] **Step 10: Run everything**

Run: `npm test`
Expected: `Test Files  44 passed (44)` and `Tests  475 passed (475)`.

Run: `npm run build`
Expected: `tsc -b` passes (it also type-checks `db.ts` for the service worker through `tsconfig.sw.json`) and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `94 passed`.

- [ ] **Step 11: Commit**

```bash
git add src/types.ts src/lib/activities.ts src/lib/activities.test.ts src/db/db.ts src/db/db.test.ts src/db/meetups.ts src/db/meetups.test.ts src/db/friends.test.ts src/db/meetupTypes.test.ts src/test/fixtures.ts src/backup/format.ts src/backup/storage.test.ts src/sheets/MeetupSheet.tsx
git commit -F - <<'EOF'
feat: meetup activities, suggestions, and the meetup photos table (Dexie version 3)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Photo data functions

**Files:**
- Create: `src/lib/photos.ts`, `src/lib/photos.test.ts`
- Modify: `src/db/meetups.ts` (whole file: the change set, delete and restore with photos, `photoCount`), `src/db/friends.ts` (`deleteFriend`), `src/backup/format.ts` (`BackupData.meetupPhotos`), `src/backup/storage.ts` (`readAllData`, `replaceAllData`, `readAllPhotos`), `src/data/hooks.ts` (`useAllMeetupPhotos`), `src/screens/SettingsScreen.tsx` (Export passes the photos), `src/test/fixtures.ts` (`meetupPhoto()`)
- Test: `src/db/meetups.test.ts`, `src/db/friends.test.ts`, `src/backup/storage.test.ts`, `src/backup/format.test.ts`, `src/lock/lockStore.test.ts`

`src/sheets/MeetupSheet.tsx` needs no change: its Undo passes whatever `deleteMeetup` returned straight to `restoreMeetup`, and both now carry the photos.

- [ ] **Step 1: Write the failing tests for the photo rules**

Create `src/lib/photos.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  isPhotoDataUrl,
  isPixelSize,
  isValidPhotoData,
  MAX_FULL_LENGTH,
  MAX_PHOTOS,
  MAX_THUMB_LENGTH,
  TOO_MANY_PHOTOS,
} from './photos'

const JPEG = 'data:image/jpeg;base64,'

describe('limits', () => {
  it('allows 20 photos per meetup, 4 MB full images and 512 KB thumbnails', () => {
    expect(MAX_PHOTOS).toBe(20)
    expect(TOO_MANY_PHOTOS).toBe('A meetup can have up to 20 photos.')
    expect(MAX_FULL_LENGTH).toBe(4_194_304)
    expect(MAX_THUMB_LENGTH).toBe(524_288)
  })
})

describe('isPhotoDataUrl', () => {
  it('accepts JPEG and PNG data URLs within the limit', () => {
    expect(isPhotoDataUrl(`${JPEG}AAAA`, 100)).toBe(true)
    expect(isPhotoDataUrl('data:image/png;base64,AAAA', 100)).toBe(true)
    expect(isPhotoDataUrl(`${JPEG}${'A'.repeat(100 - JPEG.length)}`, 100)).toBe(true)
  })

  it('refuses other strings, empty data, other types and long ones', () => {
    expect(isPhotoDataUrl(JPEG, 100)).toBe(false)
    expect(isPhotoDataUrl('data:image/gif;base64,AAAA', 100)).toBe(false)
    expect(isPhotoDataUrl('https://example.com/a.jpg', 100)).toBe(false)
    expect(isPhotoDataUrl(`${JPEG}${'A'.repeat(101 - JPEG.length)}`, 100)).toBe(false)
    expect(isPhotoDataUrl(42, 100)).toBe(false)
    expect(isPhotoDataUrl(null, 100)).toBe(false)
  })
})

describe('isPixelSize', () => {
  it('accepts whole numbers from 1', () => {
    expect(isPixelSize(1)).toBe(true)
    expect(isPixelSize(1600)).toBe(true)
    expect(isPixelSize(0)).toBe(false)
    expect(isPixelSize(12.5)).toBe(false)
    expect(isPixelSize('320')).toBe(false)
    expect(isPixelSize(Number.NaN)).toBe(false)
  })
})

describe('isValidPhotoData', () => {
  const valid = { full: `${JPEG}AAAA`, thumb: `${JPEG}BBBB`, width: 4, height: 3 }

  it('accepts a photo within every limit', () => {
    expect(isValidPhotoData(valid)).toBe(true)
  })

  it('refuses a bad image, an oversized one or a bad size', () => {
    expect(isValidPhotoData({ ...valid, full: 'nope' })).toBe(false)
    expect(isValidPhotoData({ ...valid, thumb: `${JPEG}${'A'.repeat(MAX_THUMB_LENGTH)}` })).toBe(false)
    expect(isValidPhotoData({ ...valid, width: 0 })).toBe(false)
    expect(isValidPhotoData({ ...valid, height: undefined })).toBe(false)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/photos.test.ts`
Expected: FAIL, `Failed to resolve import "./photos"`.

- [ ] **Step 3: Write the photo rules**

Create `src/lib/photos.ts`:

```ts
// Rules for meetup photos, shared by the data layer, the backup parser and the meetup sheet.

/** The most photos one meetup can have. */
export const MAX_PHOTOS = 20
export const TOO_MANY_PHOTOS = `A meetup can have up to ${MAX_PHOTOS} photos.`

/** The longest a full photo's data URL can be, in characters (4 MB). */
export const MAX_FULL_LENGTH = 4 * 1024 * 1024
/** The longest a thumbnail's data URL can be, in characters (512 KB). */
export const MAX_THUMB_LENGTH = 512 * 1024

const DATA_URL_PREFIXES = ['data:image/jpeg;base64,', 'data:image/png;base64,']

/** A JPEG or PNG data URL with some data, at most `maxLength` characters long. */
export function isPhotoDataUrl(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.length <= maxLength &&
    DATA_URL_PREFIXES.some((prefix) => value.length > prefix.length && value.startsWith(prefix))
  )
}

/** A size in pixels: a whole number, at least 1. */
export function isPixelSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

/** The image part of a photo: both data URLs within their limits, and the full image's size. */
export function isValidPhotoData(photo: { full: unknown; thumb: unknown; width: unknown; height: unknown }): boolean {
  return (
    isPhotoDataUrl(photo.full, MAX_FULL_LENGTH) &&
    isPhotoDataUrl(photo.thumb, MAX_THUMB_LENGTH) &&
    isPixelSize(photo.width) &&
    isPixelSize(photo.height)
  )
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/photos.test.ts`
Expected: PASS, `Tests  6 passed (6)`.

- [ ] **Step 5: Write the failing tests for the change set, delete and restore, the cascade and backups' storage**

In `src/test/fixtures.ts`, replace:

```ts
import type { Friend, Group, Meetup, MeetupType } from '../types'
```

with:

```ts
import type { Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'
```

Replace:

```ts
export function meetupType(
```

with:

```ts
/** A stored photo with tiny stand-in images (not real JPEGs, but the right shape). */
export function meetupPhoto(id: string, meetupId: string, order: number): MeetupPhoto {
  return {
    id,
    meetupId,
    order,
    full: `data:image/jpeg;base64,FULL${id}`,
    thumb: `data:image/jpeg;base64,THUMB${id}`,
    width: 4,
    height: 3,
    createdAt: '2026-09-01T12:00:00.000Z',
  }
}

export function meetupType(
```

In `src/db/meetups.test.ts`, replace:

```ts
import { addMeetup, deleteMeetup, restoreMeetup, updateMeetup, type MeetupInput } from './meetups'
```

with:

```ts
import {
  addMeetup,
  deleteMeetup,
  photoCount,
  restoreMeetup,
  updateMeetup,
  type MeetupInput,
  type NewPhoto,
} from './meetups'
```

Replace:

```ts
const friendInput = (name: string) => ({ name, groupId: null, photo: null, notes: '', birthday: null })
```

with:

```ts
const friendInput = (name: string) => ({ name, groupId: null, photo: null, notes: '', birthday: null })

/** A resized photo as the sheet hands it over (tiny stand-in images). */
function newPhoto(id: string): NewPhoto {
  return { id, full: `data:image/jpeg;base64,FULL${id}`, thumb: `data:image/jpeg;base64,THUMB${id}`, width: 4, height: 3 }
}

/** A meetup's photo ids, in order. */
async function photoIds(meetupId: string): Promise<string[]> {
  return (await db.meetupPhotos.where('meetupId').equals(meetupId).sortBy('order')).map((photo) => photo.id)
}

describe('photos saved with a meetup', () => {
  it('adds new photos with the meetup, numbered in order', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: ['a', 'b'] })
    expect(await db.meetupPhotos.get('b')).toEqual({
      ...newPhoto('b'),
      meetupId: meetup.id,
      order: 1,
      createdAt: meetup.createdAt,
    })
    expect(await photoIds(meetup.id)).toEqual(['a', 'b'])
    // Photos are never stored inside the meetup.
    expect(await db.meetups.get(meetup.id)).toEqual(meetup)
  })

  it('adds, removes and reorders in one update', async () => {
    const meetup = await addMeetup(base, {
      add: [newPhoto('a'), newPhoto('b'), newPhoto('c')],
      removeIds: [],
      order: [],
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
    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: [] })
    const other = await addMeetup(base, { add: [newPhoto('x')], removeIds: [], order: [] })
    await updateMeetup(meetup.id, base, { add: [newPhoto('c')], removeIds: ['x'], order: ['b'] })
    expect(await photoIds(meetup.id)).toEqual(['b', 'a', 'c'])
    expect(await photoIds(other.id)).toEqual(['x'])
  })

  it('leaves the photos alone when nothing about them changes', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: [] })
    await updateMeetup(meetup.id, { ...base, note: 'Pizza' })
    expect(await photoIds(meetup.id)).toEqual(['a', 'b'])
  })

  it('rolls the meetup back when a photo write fails', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a')], removeIds: [], order: [] })
    // Adding a photo id that is already stored fails inside the transaction.
    const sameIdAgain = { add: [newPhoto('a')], removeIds: [], order: [] }
    await expect(updateMeetup(meetup.id, { ...base, note: 'Pizza' }, sameIdAgain)).rejects.toThrow()
    expect(await db.meetups.get(meetup.id)).toMatchObject({ note: '' })
    expect(await photoIds(meetup.id)).toEqual(['a'])

    await expect(addMeetup(base, sameIdAgain)).rejects.toThrow()
    expect(await db.meetups.count()).toBe(1)
  })

  it('refuses more than 20 photos and changes nothing', async () => {
    const twenty = Array.from({ length: 20 }, (_, i) => newPhoto(`p${i}`))
    const meetup = await addMeetup(base, { add: twenty, removeIds: [], order: [] })
    const oneMore = { add: [newPhoto('one-more')], removeIds: [], order: [] }
    await expect(updateMeetup(meetup.id, { ...base, note: 'Pizza' }, oneMore)).rejects.toThrow(
      'A meetup can have up to 20 photos.',
    )
    expect(await db.meetups.get(meetup.id)).toMatchObject({ note: '' })
    expect(await db.meetupPhotos.count()).toBe(20)

    // Removing one makes room for another in the same update.
    await updateMeetup(meetup.id, base, { ...oneMore, removeIds: ['p0'] })
    expect(await db.meetupPhotos.count()).toBe(20)
    expect(await db.meetupPhotos.get('one-more')).toMatchObject({ order: 19 })
  })

  it('refuses a photo that is not a JPEG or PNG data URL, and saves nothing', async () => {
    const bad = { ...newPhoto('a'), full: 'https://example.com/a.jpg' }
    await expect(addMeetup(base, { add: [bad], removeIds: [], order: [] })).rejects.toThrow("A photo couldn't be saved.")
    expect(await db.meetups.count()).toBe(0)
    expect(await db.meetupPhotos.count()).toBe(0)
  })

  it('counts every stored photo', async () => {
    expect(await photoCount()).toBe(0)
    await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: [] })
    await addMeetup(base, { add: [newPhoto('c')], removeIds: [], order: [] })
    expect(await photoCount()).toBe(3)
  })
})
```

Replace:

```ts
  it('returns undefined for a missing meetup', async () => {
    expect(await deleteMeetup('nope')).toBeUndefined()
  })
})
```

with:

```ts
  it('returns undefined for a missing meetup', async () => {
    expect(await deleteMeetup('nope')).toBeUndefined()
  })

  it('deletes the photos with the meetup, and Undo puts them back', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const meetup = await addMeetup(
      { ...base, friendIds: [alex.id] },
      { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: ['b', 'a'] },
    )
    const before = await db.meetupPhotos.where('meetupId').equals(meetup.id).sortBy('order')
    const deleted = await deleteMeetup(meetup.id)
    expect(deleted).toEqual({ meetup, photos: before })
    expect(await db.meetupPhotos.count()).toBe(0)

    expect(await restoreMeetup(deleted!)).toBe(true)
    expect(await db.meetups.get(meetup.id)).toEqual(meetup)
    expect(await db.meetupPhotos.where('meetupId').equals(meetup.id).sortBy('order')).toEqual(before)
  })

  it('puts no photos back when the meetup cannot be restored', async () => {
    const alex = await addFriend(friendInput('Alex'))
    const meetup = await addMeetup({ ...base, friendIds: [alex.id] }, { add: [newPhoto('a')], removeIds: [], order: [] })
    const deleted = await deleteMeetup(meetup.id)
    await deleteFriend(alex.id)
    expect(await restoreMeetup(deleted!)).toBe(false)
    expect(await db.meetupPhotos.count()).toBe(0)
  })
})
```

In `src/db/friends.test.ts`, replace:

```ts
import { addMeetup } from './meetups'
```

with:

```ts
import { addMeetup, type NewPhoto } from './meetups'
```

Replace:

```ts
    expect((await db.meetups.get(shared.id))?.friendIds).toEqual([sam.id])
  })
})
```

with:

```ts
    expect((await db.meetups.get(shared.id))?.friendIds).toEqual([sam.id])
  })

  it('deletes the photos of the meetups it deletes, and keeps the others', async () => {
    const alex = await addFriend(input({ name: 'Alex' }))
    const sam = await addFriend(input({ name: 'Sam' }))
    const photo = (id: string): NewPhoto => ({
      id,
      full: 'data:image/jpeg;base64,FULL',
      thumb: 'data:image/jpeg;base64,THUMB',
      width: 4,
      height: 3,
    })
    const meetup = { date: '2026-09-01', typeId: 'type-coffee', note: '', activities: [] }
    const solo = await addMeetup(
      { ...meetup, friendIds: [alex.id] },
      { add: [photo('a'), photo('b')], removeIds: [], order: [] },
    )
    const shared = await addMeetup(
      { ...meetup, friendIds: [alex.id, sam.id] },
      { add: [photo('c')], removeIds: [], order: [] },
    )

    await deleteFriend(alex.id)

    expect(await db.meetupPhotos.where('meetupId').equals(solo.id).count()).toBe(0)
    expect((await db.meetupPhotos.where('meetupId').equals(shared.id).toArray()).map((p) => p.id)).toEqual(['c'])
  })
})
```

In `src/backup/storage.test.ts`, replace:

```ts
import { friend, meetupType } from '../test/fixtures'
import { createBackup, type BackupData } from './format'
import { parseBackupFile, readAllData, replaceAllData } from './storage'
```

with:

```ts
import { friend, meetup, meetupPhoto, meetupType } from '../test/fixtures'
import { createBackup, type BackupData } from './format'
import { parseBackupFile, readAllData, readAllPhotos, replaceAllData } from './storage'
```

Replace:

```ts
    meetups: byId(data.meetups),
  }
}
```

with:

```ts
    meetups: byId(data.meetups),
    meetupPhotos: byId(data.meetupPhotos),
  }
}
```

Replace:

```ts
    await replaceAllData({ friends: [friend('f1', 'Alex')], groups: [], meetupTypes: [], meetups: [] })

    expect(await getSetting('appLock')).toEqual(appLock)
```

with:

```ts
    await replaceAllData({ friends: [friend('f1', 'Alex')], groups: [], meetupTypes: [], meetups: [], meetupPhotos: [] })

    expect(await getSetting('appLock')).toEqual(appLock)
```

Replace:

```ts
    await replaceAllData({ friends: [friend('f1', 'Alex')], groups: [], meetupTypes: [], meetups: [] })

    expect(await getSetting('birthdayReminders')).toEqual(birthdayReminders)
```

with:

```ts
    await replaceAllData({ friends: [friend('f1', 'Alex')], groups: [], meetupTypes: [], meetups: [], meetupPhotos: [] })

    expect(await getSetting('birthdayReminders')).toEqual(birthdayReminders)
```

Replace:

```ts
  it('leaves existing data untouched if writing fails', async () => {
    const alex = await addFriend({ name: 'Alex', groupId: null, photo: null, notes: '', birthday: null })
    const bad: BackupData = {
      friends: [friend('x', 'X'), friend('x', 'X again')],
      groups: [],
      meetupTypes: [meetupType('t', 'T', 0)],
      meetups: [],
    }
    await expect(replaceAllData(bad)).rejects.toThrow()
    expect((await db.friends.toArray()).map((f) => f.id)).toEqual([alex.id])
  })
```

with:

```ts
  it('replaces and reads meetup photos with everything else', async () => {
    await db.meetupPhotos.add(meetupPhoto('old', 'gone', 0))
    const data: BackupData = {
      friends: [friend('f1', 'Alex')],
      groups: [],
      meetupTypes: [meetupType('t1', 'Coffee', 0)],
      meetups: [meetup('m1', '2026-09-01', ['f1'], 't1')],
      meetupPhotos: [meetupPhoto('p1', 'm1', 0), meetupPhoto('p2', 'm1', 1)],
    }
    await replaceAllData(data)
    expect(sortById(await readAllData())).toEqual(sortById(data))
    expect((await readAllPhotos()).map((photo) => photo.id).sort()).toEqual(['p1', 'p2'])
  })

  it('leaves existing data untouched if writing fails', async () => {
    const alex = await addFriend({ name: 'Alex', groupId: null, photo: null, notes: '', birthday: null })
    await db.meetupPhotos.add(meetupPhoto('p1', 'm1', 0))
    const bad: BackupData = {
      friends: [friend('x', 'X'), friend('x', 'X again')],
      groups: [],
      meetupTypes: [meetupType('t', 'T', 0)],
      meetups: [],
      meetupPhotos: [],
    }
    await expect(replaceAllData(bad)).rejects.toThrow()
    expect((await db.friends.toArray()).map((f) => f.id)).toEqual([alex.id])
    expect((await db.meetupPhotos.toArray()).map((p) => p.id)).toEqual(['p1'])
  })
```

In `src/backup/format.test.ts`, replace:

```ts
  meetups: [{ ...meetup('m1', '2026-09-01', ['f1', 'f2'], 't1'), note: 'Tacos' }],
}
```

with:

```ts
  meetups: [{ ...meetup('m1', '2026-09-01', ['f1', 'f2'], 't1'), note: 'Tacos' }],
  meetupPhotos: [],
}
```

In `src/lock/lockStore.test.ts`, replace:

```ts
    expect(Object.keys(data).sort()).toEqual(['friends', 'groups', 'meetupTypes', 'meetups'])
```

with:

```ts
    expect(Object.keys(data).sort()).toEqual(['friends', 'groups', 'meetupPhotos', 'meetupTypes', 'meetups'])
```

- [ ] **Step 6: Run them to see them fail**

Run: `npm test`
Expected: FAIL. `meetups.test.ts` and `friends.test.ts` fail (`photoCount` is not a function, and photos aren't saved); `storage.test.ts` fails with `db.meetupPhotos` left out of `replaceAllData`; `format.test.ts` fails because the parsed data has no `meetupPhotos`; `lockStore.test.ts` fails on the missing key.

- [ ] **Step 7: Write the photo data functions**

Replace the whole of `src/db/meetups.ts`:

```ts
import { activitiesProblem } from '../lib/activities'
import { isISODate, type ISODate } from '../lib/dates'
import { newId } from '../lib/ids'
import { isValidPhotoData, MAX_PHOTOS, TOO_MANY_PHOTOS } from '../lib/photos'
import { cleanItems } from '../lib/preferences'
import type { Meetup, MeetupPhoto } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

export interface MeetupInput {
  date: ISODate
  typeId: string
  friendIds: string[]
  note: string
  /** In the order picked. Cleaned like likes: empties and repeats are dropped. */
  activities: string[]
}

/** A photo the meetup sheet has resized and is adding. Its id is chosen up front, so `order` can place it. */
export type NewPhoto = Pick<MeetupPhoto, 'id' | 'full' | 'thumb' | 'width' | 'height'>

/** Photo changes saved together with a meetup, in the same transaction. */
export interface PhotoChanges {
  add: NewPhoto[]
  /** Photos of this meetup to delete. Ids of other meetups' photos are ignored. */
  removeIds: string[]
  /** Photo ids in their new order. Photos left out keep their order after these. */
  order: string[]
}

export const NO_PHOTO_CHANGES: PhotoChanges = { add: [], removeIds: [], order: [] }

export const PHOTO_NOT_SAVED = "A photo couldn't be saved."

/** A deleted meetup and its photos, kept so Undo can put both back. */
export interface DeletedMeetup {
  meetup: Meetup
  photos: MeetupPhoto[]
}

function clean(input: MeetupInput): MeetupInput {
  if (!isISODate(input.date)) throw new ValidationError('Please pick a valid date.')
  if (!input.typeId) throw new ValidationError('Please pick a meetup type.')
  const friendIds = [...new Set(input.friendIds)]
  if (friendIds.length === 0) throw new ValidationError('Pick at least one friend.')
  const activities = cleanItems(input.activities)
  const problem = activitiesProblem(activities)
  if (problem) throw new ValidationError(problem)
  return { date: input.date, typeId: input.typeId, friendIds, note: input.note.trim(), activities }
}

function checkPhotos(changes: PhotoChanges) {
  if (!changes.add.every((photo) => photo.id && isValidPhotoData(photo))) throw new ValidationError(PHOTO_NOT_SAVED)
}

/**
 * Applies a photo change set to one meetup's photos. Runs inside the caller's transaction, so if
 * anything here fails, the meetup write rolls back with it.
 */
async function applyPhotoChanges(meetupId: string, changes: PhotoChanges, createdAt: string): Promise<void> {
  const { add, removeIds, order } = changes
  if (add.length === 0 && removeIds.length === 0 && order.length === 0) return
  const existing = await db.meetupPhotos.where('meetupId').equals(meetupId).sortBy('order')
  const removing = new Set(removeIds)
  const kept = existing.filter((photo) => !removing.has(photo.id))
  if (kept.length + add.length > MAX_PHOTOS) throw new ValidationError(TOO_MANY_PHOTOS)

  // Listed ids first, in the listed order; then the rest, kept photos before added ones.
  const position = new Map(order.map((id, index) => [id, index] as const))
  const finalOrder = [...kept, ...add]
    .map((photo, index) => ({ id: photo.id, rank: position.get(photo.id) ?? order.length + index }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ id }) => id)
  const orderOf = new Map(finalOrder.map((id, index) => [id, index] as const))

  const removed = existing.filter((photo) => removing.has(photo.id)).map((photo) => photo.id)
  if (removed.length > 0) await db.meetupPhotos.bulkDelete(removed)
  for (const photo of kept) {
    const newOrder = orderOf.get(photo.id)!
    if (photo.order !== newOrder) await db.meetupPhotos.update(photo.id, { order: newOrder })
  }
  await db.meetupPhotos.bulkAdd(
    add.map(({ id, full, thumb, width, height }) => ({
      id,
      meetupId,
      order: orderOf.get(id)!,
      full,
      thumb,
      width,
      height,
      createdAt,
    })),
  )
}

export async function addMeetup(input: MeetupInput, photos: PhotoChanges = NO_PHOTO_CHANGES): Promise<Meetup> {
  const meetup: Meetup = { id: newId(), ...clean(input), createdAt: new Date().toISOString() }
  checkPhotos(photos)
  await db.transaction('rw', db.meetups, db.meetupPhotos, async () => {
    await db.meetups.add(meetup)
    await applyPhotoChanges(meetup.id, photos, meetup.createdAt)
  })
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
    const meetup = await db.meetups.get(id)
    if (!meetup) return undefined
    const photos = await db.meetupPhotos.where('meetupId').equals(id).sortBy('order')
    await db.meetupPhotos.bulkDelete(photos.map((photo) => photo.id))
    await db.meetups.delete(id)
    return { meetup, photos }
  })
}

/**
 * Undo: puts a meetup and its photos back, dropping friends who were deleted since.
 * Does nothing if it would be empty or its type is gone.
 */
export async function restoreMeetup({ meetup, photos }: DeletedMeetup): Promise<boolean> {
  return db.transaction('rw', [db.meetups, db.meetupPhotos, db.friends, db.meetupTypes], async () => {
    const existing = await db.friends.bulkGet(meetup.friendIds)
    const friendIds = meetup.friendIds.filter((_, i) => existing[i] !== undefined)
    if (friendIds.length === 0) return false
    if (!(await db.meetupTypes.get(meetup.typeId))) return false
    await db.meetups.put({ ...meetup, friendIds })
    await db.meetupPhotos.bulkPut(photos)
    return true
  })
}

/** How many meetup photos are stored, across all meetups. */
export function photoCount(): Promise<number> {
  return db.meetupPhotos.count()
}
```

In `src/db/friends.ts`, replace:

```ts
/** Deletes a friend, removes them from meetups, and deletes meetups left with nobody. */
export async function deleteFriend(id: string): Promise<void> {
  await db.transaction('rw', db.friends, db.meetups, async () => {
    const affected = await db.meetups.where('friendIds').equals(id).toArray()
    for (const meetup of affected) {
      const remaining = meetup.friendIds.filter((friendId) => friendId !== id)
      if (remaining.length === 0) await db.meetups.delete(meetup.id)
      else await db.meetups.update(meetup.id, { friendIds: remaining })
    }
    await db.friends.delete(id)
  })
}
```

with:

```ts
/** Deletes a friend, removes them from meetups, and deletes meetups left with nobody (and their photos). */
export async function deleteFriend(id: string): Promise<void> {
  await db.transaction('rw', db.friends, db.meetups, db.meetupPhotos, async () => {
    const affected = await db.meetups.where('friendIds').equals(id).toArray()
    for (const meetup of affected) {
      const remaining = meetup.friendIds.filter((friendId) => friendId !== id)
      if (remaining.length === 0) {
        await db.meetups.delete(meetup.id)
        await db.meetupPhotos.where('meetupId').equals(meetup.id).delete()
      } else {
        await db.meetups.update(meetup.id, { friendIds: remaining })
      }
    }
    await db.friends.delete(id)
  })
}
```

- [ ] **Step 8: Carry photos in backups' data and storage**

In `src/backup/format.ts`, replace:

```ts
import type { Birthday, Friend, Group, Meetup, MeetupType } from '../types'

export interface BackupData {
  friends: Friend[]
  groups: Group[]
  meetupTypes: MeetupType[]
  meetups: Meetup[]
}
```

with:

```ts
import type { Birthday, Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'

export interface BackupData {
  friends: Friend[]
  groups: Group[]
  meetupTypes: MeetupType[]
  meetups: Meetup[]
  meetupPhotos: MeetupPhoto[]
}
```

Replace:

```ts
  return { friends, groups, meetupTypes, meetups }
}
```

with:

```ts
  // Backups up to version 3 were made before photos existed.
  return { friends, groups, meetupTypes, meetups, meetupPhotos: [] }
}
```

(Task 4 makes backups version 4 and reads the photos.)

Replace the whole of `src/backup/storage.ts`:

```ts
import { db } from '../db/db'
import type { MeetupPhoto } from '../types'
import { parseBackup, type BackupData, type ParseResult } from './format'

export async function readAllData(): Promise<BackupData> {
  return db.transaction('r', [db.friends, db.groups, db.meetupTypes, db.meetups, db.meetupPhotos], async () => {
    const [friends, groups, meetupTypes, meetups, meetupPhotos] = await Promise.all([
      db.friends.toArray(),
      db.groups.toArray(),
      db.meetupTypes.orderBy('order').toArray(),
      db.meetups.toArray(),
      db.meetupPhotos.toArray(),
    ])
    return { friends, groups, meetupTypes, meetups, meetupPhotos }
  })
}

/** Every meetup photo, full images included. Only a backup needs them all at once. */
export function readAllPhotos(): Promise<MeetupPhoto[]> {
  return db.meetupPhotos.toArray()
}

/** Replaces everything in one transaction. If anything fails, nothing changes. */
export async function replaceAllData(data: BackupData): Promise<void> {
  await db.transaction('rw', [db.friends, db.groups, db.meetupTypes, db.meetups, db.meetupPhotos], async () => {
    await Promise.all([
      db.friends.clear(),
      db.groups.clear(),
      db.meetupTypes.clear(),
      db.meetups.clear(),
      db.meetupPhotos.clear(),
    ])
    await db.groups.bulkAdd(data.groups)
    await db.meetupTypes.bulkAdd(data.meetupTypes)
    await db.friends.bulkAdd(data.friends)
    await db.meetups.bulkAdd(data.meetups)
    await db.meetupPhotos.bulkAdd(data.meetupPhotos)
  })
}

export async function parseBackupFile(file: Blob): Promise<ParseResult> {
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    return { ok: false, error: "This file couldn't be read. Pick a .json backup file." }
  }
  return parseBackup(raw)
}
```

- [ ] **Step 9: Export the photos from Settings**

Settings builds the backup from data that's already loaded, so the iOS share sheet opens straight from the tap. The photos load in the background the same way, without holding up the screen.

In `src/data/hooks.ts`, replace:

```ts
import type { Friend, Group, Meetup, MeetupType } from '../types'
```

with:

```ts
import type { Friend, Group, Meetup, MeetupPhoto, MeetupType } from '../types'
```

Replace:

```ts
export function useSetting<K extends keyof Settings>(key: K): Settings[K] | undefined {
```

with:

```ts
/**
 * Every meetup photo, full images included. Only Settings uses it: a backup has to be ready the
 * moment Export is tapped, so the iOS share sheet opens straight from the tap.
 */
export function useAllMeetupPhotos(): MeetupPhoto[] | undefined {
  return useLiveQuery(() => db.meetupPhotos.toArray())
}

export function useSetting<K extends keyof Settings>(key: K): Settings[K] | undefined {
```

In `src/screens/SettingsScreen.tsx`, replace:

```ts
import { parseBackupFile, replaceAllData } from '../backup/storage'
```

with:

```ts
import { parseBackupFile, readAllPhotos, replaceAllData } from '../backup/storage'
```

Replace:

```ts
import { useFriends, useGroups, useMeetups, useMeetupTypes, useSetting } from '../data/hooks'
```

with:

```ts
import { useAllMeetupPhotos, useFriends, useGroups, useMeetups, useMeetupTypes, useSetting } from '../data/hooks'
```

Replace:

```ts
  const meetups = useMeetups()
  const lastBackupAt = useSetting('lastBackupAt')
```

with:

```ts
  const meetups = useMeetups()
  // Loads in the background; Settings doesn't wait for it.
  const meetupPhotos = useAllMeetupPhotos()
  const lastBackupAt = useSetting('lastBackupAt')
```

Replace:

```ts
      const outcome = await exportBackup({ friends, groups, meetupTypes, meetups })
```

with:

```ts
      // If the photos haven't loaded yet, read them now (the share sheet may then fall back to a download).
      const photos = meetupPhotos ?? (await readAllPhotos())
      const outcome = await exportBackup({ friends, groups, meetupTypes, meetups, meetupPhotos: photos })
```

- [ ] **Step 10: Run everything**

Run: `npm test`
Expected: `Test Files  45 passed (45)` and `Tests  493 passed (493)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `94 passed`.

- [ ] **Step 11: Commit**

```bash
git add src/lib/photos.ts src/lib/photos.test.ts src/db/meetups.ts src/db/meetups.test.ts src/db/friends.ts src/db/friends.test.ts src/backup/format.ts src/backup/format.test.ts src/backup/storage.ts src/backup/storage.test.ts src/lock/lockStore.test.ts src/data/hooks.ts src/screens/SettingsScreen.tsx src/test/fixtures.ts
git commit -F - <<'EOF'
feat: meetup photos saved with the meetup in one transaction, kept by Undo, deleted with their meetup

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Image processing: one decode, a full image and a thumbnail

**Files:**
- Modify: `src/lib/image.ts` (whole file)
- Create: `src/lib/image.test.ts`

Node has no canvas, so only the size math (`fitWithin`) and the sizes are unit-tested. Decoding and drawing are covered end to end: the friend photo test in `e2e/friends.spec.ts` goes through the new decode path in this task, and Task 5 checks a 2000×1000 photo becomes 1600×800 with a 320×160 thumbnail.

How it behaves on the iPhone:
- **Decoding** uses `createImageBitmap(file, { imageOrientation: 'from-image' })`, so photos come out upright. Older Safari refuses the options object or some files, so any failure there falls back to an `<img>` (which also honors the EXIF orientation). A file that neither can read rejects, and the sheet counts it as "couldn't be added". The iOS picker with `accept="image/*"` hands over HEIC photos as JPEG; a raw HEIC from the Files app that this Safari can't decode lands in the same "couldn't be added" path.
- **Memory.** A 12 MP photo decodes to about 48 MB of pixels, so the sheet processes one file at a time (Task 5), the bitmap is closed and each canvas is shrunk to 0×0 as soon as it's encoded (iOS limits the memory all canvases share), and the thumbnail is drawn from the 1600px canvas rather than the original.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/image.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { AVATAR_SIZE, fitWithin, PHOTO_FULL_SIZE, PHOTO_THUMB_SIZE } from './image'

describe('sizes', () => {
  it('keeps avatars at 400px and meetup photos at 1600px with 320px thumbnails', () => {
    expect(AVATAR_SIZE).toEqual({ maxSide: 400, quality: 0.85 })
    expect(PHOTO_FULL_SIZE).toEqual({ maxSide: 1600, quality: 0.8 })
    expect(PHOTO_THUMB_SIZE).toEqual({ maxSide: 320, quality: 0.75 })
  })
})

describe('fitWithin', () => {
  it('shrinks the longest side to the limit, keeping the shape', () => {
    expect(fitWithin({ width: 4032, height: 3024 }, 1600)).toEqual({ width: 1600, height: 1200 })
    expect(fitWithin({ width: 3024, height: 4032 }, 1600)).toEqual({ width: 1200, height: 1600 })
    expect(fitWithin({ width: 5000, height: 5000 }, 1600)).toEqual({ width: 1600, height: 1600 })
  })

  it('makes the thumbnail from the full size', () => {
    expect(fitWithin({ width: 1600, height: 1200 }, 320)).toEqual({ width: 320, height: 240 })
    expect(fitWithin({ width: 1200, height: 1600 }, 320)).toEqual({ width: 240, height: 320 })
  })

  it('never enlarges a small image', () => {
    expect(fitWithin({ width: 800, height: 600 }, 1600)).toEqual({ width: 800, height: 600 })
    expect(fitWithin({ width: 1, height: 1 }, 320)).toEqual({ width: 1, height: 1 })
  })

  it('rounds to whole pixels and keeps at least 1', () => {
    expect(fitWithin({ width: 3000, height: 2001 }, 1600)).toEqual({ width: 1600, height: 1067 })
    expect(fitWithin({ width: 10000, height: 2 }, 320)).toEqual({ width: 320, height: 1 })
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/image.test.ts`
Expected: FAIL, `fitWithin` and the size constants are not exported (`TypeError: fitWithin is not a function`).

- [ ] **Step 3: Write the image module**

Replace the whole of `src/lib/image.ts`:

```ts
// Shrinks photos on the phone before they're saved. Only `fitWithin` is pure; the rest needs a
// browser (a canvas), so it's covered by the end-to-end tests.

export interface PixelSize {
  width: number
  height: number
}

/** How big to draw an image, and the JPEG quality to save it at. */
export interface JpegSize {
  maxSide: number
  quality: number
}

/** A friend's photo. */
export const AVATAR_SIZE: JpegSize = { maxSide: 400, quality: 0.85 }
/** A meetup photo, shown full screen. */
export const PHOTO_FULL_SIZE: JpegSize = { maxSide: 1600, quality: 0.8 }
/** A meetup photo's thumbnail, for grids and lists. */
export const PHOTO_THUMB_SIZE: JpegSize = { maxSide: 320, quality: 0.75 }

/** A meetup photo, ready to save: two JPEG data URLs and the full image's size. */
export interface ProcessedPhoto {
  full: string
  thumb: string
  width: number
  height: number
}

/** The size that fits within `maxSide` on its longest side, keeping the shape. Never enlarges; at least 1×1. */
export function fitWithin({ width, height }: PixelSize, maxSide: number): PixelSize {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

interface Decoded extends PixelSize {
  source: CanvasImageSource
  /** Frees the decoded pixels. */
  release: () => void
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load image'))
    image.src = url
  })
}

/** Decodes an image file, turned upright the way its EXIF orientation says. */
async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
    } catch {
      // Older Safari refuses the options, and some files only decode in an <img>: try that next.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    if (image.naturalWidth < 1 || image.naturalHeight < 1) throw new Error('Image has no size')
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    }
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

/** Draws `source` onto a new canvas of `size`, on white (JPEG has no transparency). */
function draw(source: CanvasImageSource, size: PixelSize): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is not available')
  context.fillStyle = 'white'
  context.fillRect(0, 0, size.width, size.height)
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, size.width, size.height)
  return canvas
}

/** iOS limits the memory all canvases share, so hand each one's back as soon as it's done. */
function release(canvas: HTMLCanvasElement) {
  canvas.width = 0
  canvas.height = 0
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): string {
  const url = canvas.toDataURL('image/jpeg', quality)
  if (!url.startsWith('data:image/jpeg')) throw new Error('Could not encode the image')
  return url
}

/** Shrinks a photo so its longest side is at most `maxSide`, as a JPEG data URL. */
export async function resizeImageToDataUrl(
  file: Blob,
  maxSide = AVATAR_SIZE.maxSide,
  quality = AVATAR_SIZE.quality,
): Promise<string> {
  const image = await decode(file)
  try {
    const canvas = draw(image.source, fitWithin(image, maxSide))
    try {
      return toJpeg(canvas, quality)
    } finally {
      release(canvas)
    }
  } finally {
    image.release()
  }
}

/**
 * Decodes a photo once and makes both sizes a meetup keeps: the full image (longest side 1600px)
 * and, drawn from it, the thumbnail (longest side 320px). Throws if the file can't be read.
 */
export async function processPhoto(file: Blob): Promise<ProcessedPhoto> {
  const image = await decode(file)
  try {
    const full = draw(image.source, fitWithin(image, PHOTO_FULL_SIZE.maxSide))
    try {
      const thumb = draw(full, fitWithin(full, PHOTO_THUMB_SIZE.maxSide))
      try {
        return {
          full: toJpeg(full, PHOTO_FULL_SIZE.quality),
          thumb: toJpeg(thumb, PHOTO_THUMB_SIZE.quality),
          width: full.width,
          height: full.height,
        }
      } finally {
        release(thumb)
      }
    } finally {
      release(full)
    }
  } finally {
    image.release()
  }
}
```

`FriendSheet` keeps calling `resizeImageToDataUrl(file)`; its defaults are now `AVATAR_SIZE` (400px, 0.85), the same as before.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/image.test.ts`
Expected: PASS, `Tests  5 passed (5)`.

- [ ] **Step 5: Run everything**

Run: `npm test`
Expected: `Test Files  46 passed (46)` and `Tests  498 passed (498)`.

Run: `npm run build`
Expected: `tsc -b` passes (TypeScript 6's DOM types accept `imageOrientation: 'from-image'`) and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `94 passed`, including "adds a photo" in `e2e/friends.spec.ts`, which now decodes through `createImageBitmap`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/image.ts src/lib/image.test.ts
git commit -F - <<'EOF'
feat: decode a photo once and draw a full image and a thumbnail from it

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Backups at version 4

**Files:**
- Modify: `src/backup/format.ts` (version 4, activities, photos, validation), `src/backup/exportBackup.ts` (stringify once), `src/lib/text.ts` (`describeBackup`), `src/data/hooks.ts` (`usePhotoCount`), `src/screens/SettingsScreen.tsx` (footer)
- Test: `src/backup/format.test.ts`, `src/backup/storage.test.ts`, `src/lib/text.test.ts`, `e2e/preferences.spec.ts`, `e2e/birthdays.spec.ts` (their backups are version 4)

- [ ] **Step 1: Write the failing backup tests**

In `src/backup/format.test.ts`, replace:

```ts
import { friend, group, meetup, meetupType } from '../test/fixtures'
```

with:

```ts
import { MAX_FULL_LENGTH, MAX_THUMB_LENGTH } from '../lib/photos'
import { friend, group, meetup, meetupPhoto, meetupType } from '../test/fixtures'
```

Replace:

```ts
  meetups: [{ ...meetup('m1', '2026-09-01', ['f1', 'f2'], 't1'), note: 'Tacos' }],
  meetupPhotos: [],
}
```

with:

```ts
  meetups: [
    { ...meetup('m1', '2026-09-01', ['f1', 'f2'], 't1'), note: 'Tacos', activities: ['Karaoke', 'Board games'] },
    meetup('m2', '2026-09-08', ['f1'], 't1'),
  ],
  meetupPhotos: [meetupPhoto('p1', 'm1', 0), meetupPhoto('p2', 'm1', 1)],
}
```

Replace:

```ts
    expect(file).toMatchObject({ app: 'friend-tracker', version: 3, exportedAt: '2026-10-02T09:00:00.000Z' })
```

with:

```ts
    expect(file).toMatchObject({ app: 'friend-tracker', version: 4, exportedAt: '2026-10-02T09:00:00.000Z' })
```

Replace:

```ts
      ;(list(f, 'friends')[1].birthday as Record<string, unknown>).sign = 'Pisces'
    })
```

with:

```ts
      ;(list(f, 'friends')[1].birthday as Record<string, unknown>).sign = 'Pisces'
      list(f, 'meetupPhotos')[0].caption = 'Hi'
    })
```

Replace:

```ts
      expect(result.data.friends[1].dislikes).toEqual(['Early mornings'])
    }
  })
})
```

with:

```ts
      expect(result.data.friends[1].dislikes).toEqual(['Early mornings'])
    }
  })

  it('cleans activities, quietly dropping empties and repeats', () => {
    const file = broken((f) => (list(f, 'meetups')[0].activities = [' Karaoke ', 'karaoke', '', 'Board \n games']))
    const result = parseBackup(file)
    expect(result.ok && result.data.meetups[0].activities).toEqual(['Karaoke', 'Board games'])
  })
})
```

Replace:

```ts
      expect(result.data.friends[1]).toMatchObject({ name: 'Sam', notes: 'Likes jazz' })
    }
  })
})
```

with:

```ts
      expect(result.data.friends[1]).toMatchObject({ name: 'Sam', notes: 'Likes jazz' })
      expect(result.data.meetups.map((m) => m.activities)).toEqual([[], []])
      expect(result.data.meetupPhotos).toEqual([])
    }
  })
})
```

Replace:

```ts
      expect(result.data.friends[1]).toMatchObject({ likes: ['Jazz', 'Board games'], dislikes: ['Early mornings'] })
    }
  })
})
```

with:

```ts
      expect(result.data.friends[1]).toMatchObject({ likes: ['Jazz', 'Board games'], dislikes: ['Early mornings'] })
      expect(result.data.meetups.map((m) => m.activities)).toEqual([[], []])
      expect(result.data.meetupPhotos).toEqual([])
    }
  })
})

describe('parseBackup reads version 3 backups', () => {
  it('keeps birthdays and gives every meetup no activities and no photos', () => {
    // Version 3 had no activities or photos, so any in a version 3 file are ignored.
    const file = broken((f) => (f.version = 3))
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.friends[1].birthday).toEqual({ month: 3, day: 14, year: 1996 })
      expect(result.data.meetups.map((m) => m.activities)).toEqual([[], []])
      expect(result.data.meetupPhotos).toEqual([])
    }
    const withoutLists = broken((f) => {
      f.version = 3
      delete f.meetupPhotos
      for (const meetup of list(f, 'meetups')) delete meetup.activities
    })
    expect(parseBackup(withoutLists).ok).toBe(true)
  })
})
```

Replace:

```ts
    expectError(broken((f) => (f.version = 4)), 'This backup was made by a different version of Friend Tracker.')
    expectError(broken((f) => (f.version = '3')), 'This backup was made by a different version of Friend Tracker.')
  })
```

with:

```ts
    expectError(broken((f) => (f.version = 5)), 'This backup was made by a different version of Friend Tracker.')
    expectError(broken((f) => (f.version = '4')), 'This backup was made by a different version of Friend Tracker.')
  })

  it('rejects a missing or invalid activities list', () => {
    const message = 'Meetup 1 has an invalid "activities" list.'
    expectError(broken((f) => delete list(f, 'meetups')[0].activities), message)
    expectError(broken((f) => (list(f, 'meetups')[0].activities = 'Karaoke')), message)
    expectError(broken((f) => (list(f, 'meetups')[0].activities = ['Karaoke', 7])), message)
    expectError(broken((f) => (list(f, 'meetups')[0].activities = ['x'.repeat(61)])), message)
    const tooMany = Array.from({ length: 21 }, (_, i) => `Activity ${i + 1}`)
    expectError(
      broken((f) => (list(f, 'meetups')[1].activities = tooMany)),
      'Meetup 2 has an invalid "activities" list.',
    )
  })

  it('rejects an invalid photo', () => {
    const jpeg = 'data:image/jpeg;base64,'
    const changes: ((photo: Record<string, unknown>) => void)[] = [
      (p) => delete p.id,
      (p) => (p.id = ' '),
      (p) => delete p.meetupId,
      (p) => (p.order = -1),
      (p) => (p.order = 1.5),
      (p) => (p.full = 'https://example.com/a.jpg'),
      (p) => (p.full = 'data:image/gif;base64,AAAA'),
      (p) => (p.full = `${jpeg}${'A'.repeat(MAX_FULL_LENGTH)}`),
      (p) => (p.thumb = `${jpeg}${'A'.repeat(MAX_THUMB_LENGTH)}`),
      (p) => (p.thumb = null),
      (p) => (p.width = 0),
      (p) => (p.height = '3'),
      (p) => delete p.createdAt,
    ]
    for (const change of changes) {
      expectError(broken((f) => change(list(f, 'meetupPhotos')[1])), 'Photo 2 is invalid.')
    }
    expectError(broken((f) => ((f.meetupPhotos as unknown[])[0] = 'photo.jpg')), 'Photo 1 is invalid.')
  })

  it('accepts a PNG photo', () => {
    const file = broken((f) => (list(f, 'meetupPhotos')[0].full = 'data:image/png;base64,AAAA'))
    expect(parseBackup(file).ok).toBe(true)
  })

  it('rejects a photo of a meetup that is not in the backup, or a 21st photo', () => {
    expectError(broken((f) => (list(f, 'meetupPhotos')[1].meetupId = 'ghost')), 'Photo 2 is invalid.')
    // Meetup 2 has no photos yet: its 21st is the file's 23rd photo.
    const twentyOne = Array.from({ length: 21 }, (_, i) => ({ ...meetupPhoto(`x${i}`, 'm2', i) }))
    expectError(broken((f) => list(f, 'meetupPhotos').push(...twentyOne)), 'Photo 23 is invalid.')
    const twenty = twentyOne.slice(0, 20)
    expect(parseBackup(broken((f) => list(f, 'meetupPhotos').push(...twenty))).ok).toBe(true)
  })

  it('rejects duplicate photo ids or a missing photo list', () => {
    expectError(
      broken((f) => list(f, 'meetupPhotos').push(list(f, 'meetupPhotos')[0])),
      'two photos with the same id',
    )
    expectError(broken((f) => delete f.meetupPhotos), 'missing its "meetupPhotos" list')
  })
```

In `src/backup/storage.test.ts`, replace:

```ts
    await addMeetup({
      date: '2026-09-01',
      typeId: 'type-meal',
      friendIds: [alex.id, sam.id],
      note: 'Tacos',
      activities: [],
    })
    const before = await readAllData()
```

with:

```ts
    const tacos = await addMeetup(
      {
        date: '2026-09-01',
        typeId: 'type-meal',
        friendIds: [alex.id, sam.id],
        note: 'Tacos',
        activities: ['Karaoke', 'Walk'],
      },
      {
        add: [
          { id: 'p1', full: 'data:image/jpeg;base64,FULL1', thumb: 'data:image/jpeg;base64,THUMB1', width: 4, height: 3 },
          { id: 'p2', full: 'data:image/jpeg;base64,FULL2', thumb: 'data:image/jpeg;base64,THUMB2', width: 3, height: 4 },
        ],
        removeIds: [],
        order: ['p2', 'p1'],
      },
    )
    const before = await readAllData()
    expect(before.meetupPhotos).toHaveLength(2)
```

Replace:

```ts
    expect((await db.friends.get(sam.id))?.birthday).toBeNull()
  })
```

with:

```ts
    expect((await db.friends.get(sam.id))?.birthday).toBeNull()
    expect((await db.meetups.get(tacos.id))?.activities).toEqual(['Karaoke', 'Walk'])
    const photos = await db.meetupPhotos.where('meetupId').equals(tacos.id).sortBy('order')
    expect(photos.map((photo) => photo.id)).toEqual(['p2', 'p1'])
  })
```

- [ ] **Step 2: Write the failing footer test**

In `src/lib/text.test.ts`, replace:

```ts
  compareNames,
  describeLastBackup,
```

with:

```ts
  compareNames,
  describeBackup,
  describeLastBackup,
```

Replace:

```ts
    expect(describeLastBackup(new Date(2026, 8, 11, 12, 0).toISOString(), '2026-10-02')).toBe('Last backup: 3 weeks ago')
  })
})
```

with:

```ts
    expect(describeLastBackup(new Date(2026, 8, 11, 12, 0).toISOString(), '2026-10-02')).toBe('Last backup: 3 weeks ago')
  })
})

describe('describeBackup', () => {
  it('adds the photo count when there are photos', () => {
    const today = new Date(2026, 9, 2, 9, 30).toISOString()
    expect(describeBackup(today, '2026-10-02', 0)).toBe('Last backup: today')
    expect(describeBackup(today, '2026-10-02', 12)).toBe('Last backup: today. Includes 12 photos.')
    expect(describeBackup(null, '2026-10-02', 1)).toBe('Never backed up. Includes 1 photo.')
  })
})
```

- [ ] **Step 3: Run them to see them fail**

Run: `npx vitest run src/backup src/lib/text.test.ts`
Expected: FAIL. The created file is still version 3, activities and photos are dropped on parsing, version 4 is refused, and `describeBackup` is not a function.

- [ ] **Step 4: Read and write version 4**

In `src/backup/format.ts`, replace:

```ts
import { isValidBirthday } from '../lib/birthdays'
import { addDays, isISODate, todayISO, type ISODate } from '../lib/dates'
```

with:

```ts
import { activitiesProblem } from '../lib/activities'
import { isValidBirthday } from '../lib/birthdays'
import { addDays, isISODate, todayISO, type ISODate } from '../lib/dates'
import { isPhotoDataUrl, isPixelSize, MAX_FULL_LENGTH, MAX_PHOTOS, MAX_THUMB_LENGTH } from '../lib/photos'
```

Replace:

```ts
  version: 3
  exportedAt: string
}
```

with:

```ts
  version: 4
  exportedAt: string
}
```

Replace:

```ts
  return { app: 'friend-tracker', version: 3, exportedAt: exportedAt.toISOString(), ...data }
```

with:

```ts
  return { app: 'friend-tracker', version: 4, exportedAt: exportedAt.toISOString(), ...data }
```

Replace:

```ts
function assertUnique(ids: string[], what: string) {
```

with:

```ts
/** A version 4 meetup's activities, cleaned like the app cleans them. Empties and repeats are dropped quietly. */
function activityList(record: Obj, where: string): string[] {
  const value = record.activities
  const invalid = () => new BackupError(`${where} has an invalid "activities" list.`)
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw invalid()
  const activities = cleanItems(value)
  if (activitiesProblem(activities) !== null) throw invalid()
  return activities
}

/** A version 4 photo (copied, so stray fields are dropped). Whatever is wrong with it, the message is the same. */
function photoOf(value: unknown, where: string): MeetupPhoto {
  const invalid = () => new BackupError(`${where} is invalid.`)
  if (!isObj(value)) throw invalid()
  const { id, meetupId, order, full, thumb, width, height, createdAt } = value
  if (typeof id !== 'string' || id.trim() === '' || typeof meetupId !== 'string' || typeof createdAt !== 'string') {
    throw invalid()
  }
  if (typeof order !== 'number' || !Number.isInteger(order) || order < 0) throw invalid()
  if (
    !isPhotoDataUrl(full, MAX_FULL_LENGTH) ||
    !isPhotoDataUrl(thumb, MAX_THUMB_LENGTH) ||
    !isPixelSize(width) ||
    !isPixelSize(height)
  ) {
    throw invalid()
  }
  return { id, meetupId, order, full, thumb, width, height, createdAt }
}

function assertUnique(ids: string[], what: string) {
```

Replace:

```ts
  if (version !== 1 && version !== 2 && version !== 3) {
```

with:

```ts
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4) {
```

Replace:

```ts
      birthday: version === 3 ? birthdayOf(r, where, today) : null,
```

with:

```ts
      birthday: version >= 3 ? birthdayOf(r, where, today) : null,
```

Replace:

```ts
      // Backups up to version 3 were made before activities existed.
      activities: [],
      createdAt: text(r, 'createdAt', where),
    }
  })
```

with:

```ts
      // Versions 1 to 3 were made before activities existed.
      activities: version === 4 ? activityList(r, where) : [],
      createdAt: text(r, 'createdAt', where),
    }
  })

  // Versions 1 to 3 were made before photos existed.
  const meetupPhotos: MeetupPhoto[] =
    version === 4 ? list(raw, 'meetupPhotos').map((value, i) => photoOf(value, `Photo ${i + 1}`)) : []
```

Replace:

```ts
  assertUnique(meetups.map((m) => m.id), 'meetups')
```

with:

```ts
  assertUnique(meetups.map((m) => m.id), 'meetups')
  assertUnique(meetupPhotos.map((p) => p.id), 'photos')
```

Replace:

```ts
  // Backups up to version 3 were made before photos existed.
  return { friends, groups, meetupTypes, meetups, meetupPhotos: [] }
}
```

with:

```ts
  // Every photo belongs to a meetup in the backup, and no meetup has more than 20.
  const meetupIds = new Set(meetups.map((m) => m.id))
  const photosPerMeetup = new Map<string, number>()
  meetupPhotos.forEach((p, i) => {
    const count = (photosPerMeetup.get(p.meetupId) ?? 0) + 1
    photosPerMeetup.set(p.meetupId, count)
    if (!meetupIds.has(p.meetupId) || count > MAX_PHOTOS) throw new BackupError(`Photo ${i + 1} is invalid.`)
  })

  return { friends, groups, meetupTypes, meetups, meetupPhotos }
}
```

In `src/backup/exportBackup.ts`, replace:

```ts
  const backup = createBackup(data, new Date())
  // Self-check before sharing: never hand out a file our own importer would reject. Synchronous, so share() keeps its user gesture.
  const check = parseBackup(JSON.parse(JSON.stringify(backup)))
  if (!check.ok) throw new Error(`Backup failed validation: ${check.error}`)
  const file = new File([JSON.stringify(backup)], backupFileName(todayISO()), { type: 'application/json' })
```

with:

```ts
  // Turned into text once: with photos a backup can be large, and every copy costs memory.
  const json = JSON.stringify(createBackup(data, new Date()))
  // Self-check before sharing: never hand out a file our own importer would reject. Synchronous, so share() keeps its user gesture.
  const check = parseBackup(JSON.parse(json))
  if (!check.ok) throw new Error(`Backup failed validation: ${check.error}`)
  const file = new File([json], backupFileName(todayISO()), { type: 'application/json' })
```

- [ ] **Step 5: Add the photo count to the Backup footer**

In `src/lib/text.ts`, replace:

```ts
  return `Last backup: ${since.charAt(0).toLowerCase()}${since.slice(1)}`
}
```

with:

```ts
  return `Last backup: ${since.charAt(0).toLowerCase()}${since.slice(1)}`
}

/** The Backup group's footer: the last backup, then how many photos a backup carries (they make it large). */
export function describeBackup(lastBackupAt: string | null, today: ISODate, photoCount: number): string {
  const last = describeLastBackup(lastBackupAt, today)
  return photoCount > 0 ? `${last}. Includes ${plural(photoCount, 'photo')}.` : last
}
```

In `src/data/hooks.ts`, replace:

```ts
import { getSetting, type Settings } from '../db/settings'
```

with:

```ts
import { photoCount } from '../db/meetups'
import { getSetting, type Settings } from '../db/settings'
```

Replace:

```ts
/**
 * Every meetup photo, full images included.
```

with:

```ts
/** How many meetup photos are stored. Counts without reading any image. */
export function usePhotoCount(): number | undefined {
  return useLiveQuery(() => photoCount())
}

/**
 * Every meetup photo, full images included.
```

In `src/screens/SettingsScreen.tsx`, replace:

```ts
import { useAllMeetupPhotos, useFriends, useGroups, useMeetups, useMeetupTypes, useSetting } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import { describeLastBackup, plural } from '../lib/text'
```

with:

```ts
import {
  useAllMeetupPhotos,
  useFriends,
  useGroups,
  useMeetups,
  useMeetupTypes,
  usePhotoCount,
  useSetting,
} from '../data/hooks'
import { useToday } from '../hooks/useToday'
import { describeBackup, plural } from '../lib/text'
```

Replace:

```ts
  const meetupPhotos = useAllMeetupPhotos()
```

with:

```ts
  const meetupPhotos = useAllMeetupPhotos()
  const photoCount = usePhotoCount()
```

Replace:

```ts
  if (appLock === undefined || passkeyAvailable === undefined || birthdayReminders === undefined) return null
```

with:

```ts
  if (appLock === undefined || passkeyAvailable === undefined || birthdayReminders === undefined) return null
  if (photoCount === undefined) return null
```

Replace:

```tsx
      <InsetGroup title="Backup" footer={describeLastBackup(lastBackupAt, today)}>
```

with:

```tsx
      <InsetGroup title="Backup" footer={describeBackup(lastBackupAt, today, photoCount)}>
```

- [ ] **Step 6: Expect version 4 in the end-to-end backup tests**

In `e2e/preferences.spec.ts`, replace:

```ts
  expect(backup.version).toBe(3)
```

with:

```ts
  expect(backup.version).toBe(4)
```

In `e2e/birthdays.spec.ts`, replace:

```ts
  expect(backup.version).toBe(3)
```

with:

```ts
  expect(backup.version).toBe(4)
```

(`e2e/settings.spec.ts` doesn't check the version, and "Last backup: today" still matches because `getByText` matches part of the footer.)

- [ ] **Step 7: Run everything**

Run: `npm test`
Expected: `Test Files  46 passed (46)` and `Tests  506 passed (506)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `94 passed`.

- [ ] **Step 8: Commit**

```bash
git add src/backup/format.ts src/backup/format.test.ts src/backup/storage.test.ts src/backup/exportBackup.ts src/lib/text.ts src/lib/text.test.ts src/data/hooks.ts src/screens/SettingsScreen.tsx e2e/preferences.spec.ts e2e/birthdays.spec.ts
git commit -F - <<'EOF'
feat: backups at version 4 with activities and photos, and the photo count in the Backup footer

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: The meetup sheet's Activities and Photos

**Files:**
- Create: `src/sheets/MeetupActivities.tsx`, `src/sheets/MeetupPhotos.tsx`, `src/lib/persist.ts`, `src/lib/persist.test.ts`, `e2e/memories.spec.ts`
- Modify: `src/sheets/MeetupSheet.tsx` (state, dirty tracking, the change set on Save), `src/sheets/MeetupSheet.css` (the "+ New" field, remove buttons, the Add photos tile), `src/styles/base.css` (the shared photo grid), `src/components/icons.tsx` (`IconCameraPlus`), `src/data/hooks.ts` (`useMeetupPhotoThumbs`), `src/lib/photos.ts` (`describeSkippedPhotos`), `e2e/helpers.ts`
- Test: `src/lib/photos.test.ts`, `src/lib/persist.test.ts`, `e2e/memories.spec.ts`

The two new sections sit after **When** and before **Note**. Both hold their changes in the sheet until Save, so Cancel (with "Discard changes?") throws them away. In this task the Edit meetup sheet still opens from a friend's history row; Task 6 moves that to the Meetup page and updates the `editMeetup` helper, so these tests keep working.

- [ ] **Step 1: Write the failing unit tests**

In `src/lib/photos.test.ts`, replace:

```ts
import {
  isPhotoDataUrl,
```

with:

```ts
import {
  describeSkippedPhotos,
  isPhotoDataUrl,
```

Replace:

```ts
describe('isValidPhotoData', () => {
```

with:

```ts
describe('describeSkippedPhotos', () => {
  it('says why photos were left out', () => {
    expect(describeSkippedPhotos(0, 0)).toBeNull()
    expect(describeSkippedPhotos(3, 0)).toBe('A meetup can have up to 20 photos.')
    expect(describeSkippedPhotos(0, 1)).toBe("1 photo couldn't be added.")
    expect(describeSkippedPhotos(2, 2)).toBe("A meetup can have up to 20 photos. 2 photos couldn't be added.")
  })
})

describe('isValidPhotoData', () => {
```

Create `src/lib/persist.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { askToKeepData } from './persist'

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubStorage(storage: Partial<StorageManager> | undefined) {
  vi.stubGlobal('navigator', { storage })
}

describe('askToKeepData', () => {
  it('asks to keep the data when it is not kept yet', async () => {
    const persist = vi.fn(async () => true)
    stubStorage({ persisted: async () => false, persist })
    await askToKeepData()
    expect(persist).toHaveBeenCalledOnce()
  })

  it('does not ask again once the data is kept', async () => {
    const persist = vi.fn(async () => true)
    stubStorage({ persisted: async () => true, persist })
    await askToKeepData()
    expect(persist).not.toHaveBeenCalled()
  })

  it('does nothing without the storage API, and never throws', async () => {
    stubStorage(undefined)
    await expect(askToKeepData()).resolves.toBeUndefined()
    stubStorage({
      persisted: async () => false,
      persist: async () => {
        throw new Error('Not allowed')
      },
    })
    await expect(askToKeepData()).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/lib/photos.test.ts src/lib/persist.test.ts`
Expected: FAIL, `describeSkippedPhotos is not a function` and `Failed to resolve import "./persist"`.

- [ ] **Step 3: Write the message helper and `askToKeepData`**

In `src/lib/photos.ts`, replace:

```ts
// Rules for meetup photos, shared by the data layer, the backup parser and the meetup sheet.
```

with:

```ts
// Rules for meetup photos, shared by the data layer, the backup parser and the meetup sheet.

import { plural } from './text'
```

Replace:

```ts
/** The image part of a photo:
```

with:

```ts
/**
 * Why some chosen photos weren't added, or null when they all were: `skipped` didn't fit under the
 * limit, `failed` couldn't be read.
 */
export function describeSkippedPhotos(skipped: number, failed: number): string | null {
  const problems: string[] = []
  if (skipped > 0) problems.push(TOO_MANY_PHOTOS)
  if (failed > 0) problems.push(`${plural(failed, 'photo')} couldn't be added.`)
  return problems.length > 0 ? problems.join(' ') : null
}

/** The image part of a photo:
```

Create `src/lib/persist.ts`:

```ts
/**
 * Asks the browser to keep this app's data when the phone runs low on space. Best effort: Safari
 * decides on its own and never asks the user, so a refusal or an error is ignored.
 */
export async function askToKeepData(): Promise<void> {
  try {
    const storage = navigator.storage
    if (typeof storage?.persist !== 'function') return
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return
    await storage.persist()
  } catch {
    // Nothing to do: the data is still saved, just not marked to keep.
  }
}
```

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run src/lib/photos.test.ts src/lib/persist.test.ts`
Expected: PASS, `Tests  10 passed (10)`.

- [ ] **Step 5: Write the end-to-end helpers**

In `e2e/helpers.ts`, replace:

```ts
  options: { type?: string; date?: string; note?: string } = {},
) {
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  for (const name of names) {
    await sheet.getByLabel('Search all friends').fill(name)
    await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name, exact: true }).click()
  }
  if (options.type) await sheet.getByRole('button', { name: options.type, exact: true }).click()
  if (options.date) await sheet.getByLabel('Pick date').fill(options.date)
  if (options.note) await sheet.getByLabel('Note').fill(options.note)
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
}
```

with:

```ts
  options: { type?: string; date?: string; note?: string; activities?: string[]; photos?: PhotoFile[] } = {},
) {
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  for (const name of names) {
    await sheet.getByLabel('Search all friends').fill(name)
    await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name, exact: true }).click()
  }
  if (options.type) await sheet.getByRole('button', { name: options.type, exact: true }).click()
  if (options.date) await sheet.getByLabel('Pick date').fill(options.date)
  for (const activity of options.activities ?? []) await pickActivity(sheet, activity)
  if (options.photos) await addPhotos(sheet, options.photos)
  if (options.note) await sheet.getByLabel('Note').fill(options.note)
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
}

/** A file for the photo picker (`setInputFiles`). */
export interface PhotoFile {
  name: string
  mimeType: string
  buffer: Buffer
}

/** A tiny photo for the picker: the 1×1 PNG. */
export function tinyPhoto(name = 'photo.png'): PhotoFile {
  return { name, mimeType: 'image/png', buffer: Buffer.from(ONE_PIXEL_PNG, 'base64') }
}

/** A file the picker hands over that isn't an image at all. */
export function brokenPhoto(name = 'broken.jpg'): PhotoFile {
  return { name, mimeType: 'image/jpeg', buffer: Buffer.from('not an image') }
}

/**
 * A photo of a given size, drawn in the page: a soft diagonal gradient in `hue`, as a PNG. For
 * checking the resize, and for screenshots that need something that looks like a picture.
 */
export async function drawnPhoto(
  page: Page,
  name: string,
  width: number,
  height: number,
  hue = 30,
): Promise<PhotoFile> {
  const base64 = await page.evaluate(
    ({ width, height, hue }) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('No canvas')
      const gradient = context.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, `hsl(${hue} 80% 82%)`)
      gradient.addColorStop(1, `hsl(${hue + 50} 55% 48%)`)
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)
      context.fillStyle = `hsl(${hue + 20} 90% 96% / 0.7)`
      context.beginPath()
      context.arc(width * 0.3, height * 0.35, Math.min(width, height) * 0.18, 0, Math.PI * 2)
      context.fill()
      return canvas.toDataURL('image/png').split(',')[1]
    },
    { width, height, hue },
  )
  return { name, mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') }
}

/** In an open meetup sheet: selects an activity's chip, or adds it with "+ New" when there's no chip for it. */
export async function pickActivity(sheet: Locator, name: string) {
  const activities = sheet.getByRole('group', { name: 'Activities' })
  const chip = activities.getByRole('button', { name, exact: true })
  if ((await chip.count()) > 0) {
    await chip.click()
  } else {
    await activities.getByRole('button', { name: 'New activity' }).click()
    await sheet.getByRole('textbox', { name: 'New activity' }).fill(name)
    await sheet.getByRole('button', { name: 'Add', exact: true }).click()
  }
  await expect(activities.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true')
}

/** In an open meetup sheet: the Photos grid. */
export function photoGrid(sheet: Locator): Locator {
  return sheet.getByRole('list', { name: 'Photos' })
}

/** In an open meetup sheet: picks photos and waits until they've all been added. */
export async function addPhotos(sheet: Locator, files: PhotoFile[]) {
  const thumbnails = photoGrid(sheet).getByRole('img')
  const before = await thumbnails.count()
  await sheet.locator('input[type="file"]').setInputFiles(files)
  await expect(thumbnails).toHaveCount(before + files.length)
}

/** Opens a friend's page from the Friends tab. */
export async function openFriendPage(page: Page, name: string) {
  await goToTab(page, 'Friends')
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

/** On a friend's page: opens a meetup from their history in the Edit meetup sheet. */
export async function editMeetup(page: Page, name: RegExp): Promise<Locator> {
  await page.getByRole('region', { name: 'History' }).getByRole('button', { name }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit meetup' })
  await expect(sheet).toBeVisible()
  return sheet
}

/** Every stored meetup photo, read straight from IndexedDB. */
export async function readMeetupPhotos(
  page: Page,
): Promise<{ id: string; order: number; full: string; thumb: string; width: number; height: number }[]> {
  return page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open('friend-tracker')
        request.onerror = () => reject(request.error)
        request.onsuccess = () => {
          const database = request.result
          const getAll = database.transaction('meetupPhotos').objectStore('meetupPhotos').getAll()
          getAll.onsuccess = () => {
            database.close()
            resolve(getAll.result)
          }
          getAll.onerror = () => reject(getAll.error)
        }
      }),
  )
}

/** The pixel size of an image data URL, decoded in the page. */
export async function imageSize(page: Page, src: string): Promise<{ width: number; height: number }> {
  return page.evaluate(async (src) => {
    const image = new Image()
    image.src = src
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight }
  }, src)
}
```

- [ ] **Step 6: Write the failing end-to-end tests**

Create `e2e/memories.spec.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import {
  addFriend,
  addPhotos,
  brokenPhoto,
  drawnPhoto,
  editMeetup,
  goToTab,
  imageSize,
  logMeetup,
  openFriendPage,
  photoGrid,
  pickActivity,
  readMeetupPhotos,
  tinyPhoto,
} from './helpers.ts'

test('logs a meetup with activities, one of them new, and two photos', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
  const activities = sheet.getByRole('group', { name: 'Activities' })
  // The starters, in order, then "+ New".
  await expect(activities.getByRole('button').first()).toHaveText('Board games')
  await pickActivity(sheet, 'Karaoke')
  await pickActivity(sheet, 'Pottery class')
  await expect(sheet.getByRole('textbox', { name: 'New activity' })).toBeHidden()
  await expect(activities.getByRole('button', { name: 'New activity' })).toBeFocused()
  await addPhotos(sheet, [tinyPhoto('one.png'), tinyPhoto('two.png')])
  await expect(photoGrid(sheet).getByRole('img', { name: 'Photo 2' })).toHaveAttribute('src', /^data:image\/jpeg/)
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()

  await openFriendPage(page, 'Alex')
  const edit = await editMeetup(page, /Coffee/)
  const picked = edit.getByRole('group', { name: 'Activities' }).locator('[aria-pressed="true"]')
  await expect(picked).toHaveText(['Karaoke', 'Pottery class'])
  await expect(photoGrid(edit).getByRole('img')).toHaveCount(2)
  const stored = await readMeetupPhotos(page)
  expect(stored.map((photo) => photo.order).sort()).toEqual([0, 1])
})

test('suggests activities used before first, and shows the rest with More', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { activities: ['Pottery class', 'Arcade', 'Karaoke'] })
  await logMeetup(page, ['Alex'], { activities: ['Arcade', 'Bowling'] })

  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  const activities = sheet.getByRole('group', { name: 'Activities' })
  // Used before (most used first, then by name), then the starters: 13 in all, 12 shown.
  await expect(activities.locator('.chip--wrap')).toHaveText([
    'Arcade',
    'Bowling',
    'Karaoke',
    'Pottery class',
    'Board games',
    'Movie',
    'Walk',
    'Concert',
    'Shopping',
    'Cooking',
    'Sports',
    'Beach',
  ])
  await activities.getByRole('button', { name: 'More activities' }).click()
  await expect(activities.locator('.chip--wrap')).toHaveCount(13)
  await expect(activities.getByRole('button', { name: 'Museum' })).toBeFocused()
  await expect(activities.getByRole('button', { name: 'More activities' })).toHaveCount(0)
})

test('shrinks a large photo to 1600 pixels with a 320 pixel thumbnail', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { photos: [await drawnPhoto(page, 'wide.png', 2000, 1000)] })

  const [photo] = await readMeetupPhotos(page)
  expect(photo).toMatchObject({ width: 1600, height: 800 })
  expect(photo.full).toMatch(/^data:image\/jpeg;base64,/)
  expect(photo.thumb).toMatch(/^data:image\/jpeg;base64,/)
  expect(await imageSize(page, photo.full)).toEqual({ width: 1600, height: 800 })
  expect(await imageSize(page, photo.thumb)).toEqual({ width: 320, height: 160 })
})

test('skips a photo that cannot be read, and photos past 20', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  const input = sheet.locator('input[type="file"]')
  const thumbnails = photoGrid(sheet).getByRole('img')

  await input.setInputFiles([brokenPhoto(), tinyPhoto()])
  await expect(thumbnails).toHaveCount(1)
  await expect(sheet.getByRole('alert')).toHaveText("1 photo couldn't be added.")

  await input.setInputFiles(Array.from({ length: 20 }, (_, i) => tinyPhoto(`photo-${i}.png`)))
  await expect(thumbnails).toHaveCount(20)
  await expect(sheet.getByRole('alert')).toHaveText('A meetup can have up to 20 photos.')

  // Full: the Add photos tile says so instead of opening the picker.
  await photoGrid(sheet).getByRole('button', { name: 'Add photos' }).click()
  await expect(sheet.getByRole('alert')).toHaveText('A meetup can have up to 20 photos.')
})

test('removes a photo in Edit, and Cancel discards changes', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { activities: ['Karaoke'], photos: [tinyPhoto('one.png'), tinyPhoto('two.png')] })

  await openFriendPage(page, 'Alex')
  let sheet = await editMeetup(page, /Coffee/)
  await photoGrid(sheet).getByRole('button', { name: 'Remove photo 1' }).click()
  await expect(photoGrid(sheet).getByRole('img')).toHaveCount(1)
  await expect(photoGrid(sheet).getByRole('button', { name: 'Remove photo 1' })).toBeFocused()
  await sheet.getByRole('group', { name: 'Activities' }).getByRole('button', { name: 'Karaoke' }).click()
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(sheet).toBeHidden()

  await openFriendPage(page, 'Alex')
  sheet = await editMeetup(page, /Coffee/)
  await expect(photoGrid(sheet).getByRole('img')).toHaveCount(2)
  await expect(sheet.getByRole('group', { name: 'Activities' }).getByRole('button', { name: 'Karaoke' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await photoGrid(sheet).getByRole('button', { name: 'Remove photo 2' }).click()
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()

  await openFriendPage(page, 'Alex')
  sheet = await editMeetup(page, /Coffee/)
  await expect(photoGrid(sheet).getByRole('img')).toHaveCount(1)
  expect(await readMeetupPhotos(page)).toHaveLength(1)
})

test('deleting a meetup and Undo bring its photos back', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { photos: [tinyPhoto('one.png'), tinyPhoto('two.png')] })

  await openFriendPage(page, 'Alex')
  const sheet = await editMeetup(page, /Coffee/)
  await sheet.getByRole('button', { name: 'Delete meetup' }).click()
  await expect(page.getByRole('status')).toContainText('Meetup deleted')
  expect(await readMeetupPhotos(page)).toHaveLength(0)
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()

  await openFriendPage(page, 'Alex')
  const restored = await editMeetup(page, /Coffee/)
  await expect(photoGrid(restored).getByRole('img')).toHaveCount(2)
})

test('keeps photos and activities through a backup', async ({ page }) => {
  // Force the download path; the share sheet can't be driven in tests.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { activities: ['Karaoke'], photos: [tinyPhoto('one.png'), tinyPhoto('two.png')] })

  await goToTab(page, 'Settings')
  await expect(page.getByText('Never backed up. Includes 2 photos.')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.version).toBe(4)
  expect(backup.meetups[0].activities).toEqual(['Karaoke'])
  expect(backup.meetupPhotos).toHaveLength(2)

  await openFriendPage(page, 'Alex')
  const sheet = await editMeetup(page, /Coffee/)
  await sheet.getByRole('button', { name: 'Delete meetup' }).click()
  await goToTab(page, 'Settings')
  await expect(page.getByText(/Includes \d+ photos?\./)).toHaveCount(0)
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')
  await expect(page.getByText('Includes 2 photos.')).toBeVisible()

  await openFriendPage(page, 'Alex')
  const restored = await editMeetup(page, /Coffee/)
  await expect(photoGrid(restored).getByRole('img')).toHaveCount(2)
  await expect(restored.getByRole('group', { name: 'Activities' }).getByRole('button', { name: 'Karaoke' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})
```

- [ ] **Step 7: Run them to see them fail**

Run: `npx playwright test --project=iphone e2e/memories.spec.ts`
Expected: FAIL, 7 failed: the sheet has no "Activities" group or "Photos" list yet.

- [ ] **Step 8: Add the camera-plus icon and the thumbnails hook**

In `src/components/icons.tsx`, replace:

```tsx
export const IconCalendar = (props: IconProps) => (
```

with:

```tsx
export const IconCameraPlus = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <path d="M12 10v6M9 13h6" />
  </Icon>
)

export const IconCalendar = (props: IconProps) => (
```

In `src/data/hooks.ts`, replace:

```ts
/** How many meetup photos are stored. Counts without reading any image. */
```

with:

```ts
/**
 * A meetup's photos as ids and thumbnails, in order: what the meetup sheet shows. The full images
 * are dropped as soon as they're read. Empty when there's no meetup yet.
 */
export function useMeetupPhotoThumbs(meetupId: string | undefined): Pick<MeetupPhoto, 'id' | 'thumb'>[] | undefined {
  return useLiveQuery(async () => {
    if (!meetupId) return []
    const photos = await db.meetupPhotos.where('meetupId').equals(meetupId).sortBy('order')
    return photos.map(({ id, thumb }) => ({ id, thumb }))
  }, [meetupId])
}

/** How many meetup photos are stored. Counts without reading any image. */
```

- [ ] **Step 9: Write the Activities section**

Create `src/sheets/MeetupActivities.tsx`:

```tsx
import { useEffect, useId, useRef, useState } from 'react'
import { Chip } from '../components/Chip'
import { IconPlus } from '../components/icons'
import { MAX_ACTIVITIES, TOO_MANY_ACTIVITIES } from '../lib/activities'
import { isPlainEnter } from '../lib/keys'
import { cleanItem, indexOfItem, MAX_ITEM_LENGTH } from '../lib/preferences'

/** How many suggestions show before "More". */
const ACTIVITIES_SHOWN = 12

interface MeetupActivitiesProps {
  /** Every suggestion, best first (see `activitySuggestions`). */
  suggestions: string[]
  /** The meetup's activities, in the order picked. */
  selected: string[]
  onChange: (activities: string[]) => void
  /** The text in the "+ New" field, or null while it's closed. */
  draft: string | null
  onDraftChange: (draft: string | null) => void
}

/** The meetup sheet's Activities section: suggestion chips, "More", and "+ New" with an inline field. */
export function MeetupActivities({ suggestions, selected, onChange, draft, onDraftChange }: MeetupActivitiesProps) {
  const labelId = useId()
  const messageId = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const [showAll, setShowAll] = useState(false)
  // The chips after the suggestions, in the order they appeared. Kept when tapped off, so a chip never
  // vanishes or moves under the finger.
  const [extras, setExtras] = useState<string[]>([])
  const [message, setMessage] = useState<{ text: string; n: number } | null>(null)
  // Where focus goes after the next render: a chip by position, or the "+ New" chip.
  const pendingFocus = useRef<number | 'new' | null>(null)
  const [focusTick, setFocusTick] = useState(0)

  const shown = showAll ? suggestions : suggestions.slice(0, ACTIVITIES_SHOWN)
  // An activity on this meetup always shows, even when it isn't among the suggestions shown.
  const chips = [...shown]
  for (const name of [...extras, ...selected]) if (indexOfItem(chips, name) === -1) chips.push(name)
  const hasMore = !showAll && suggestions.slice(ACTIVITIES_SHOWN).some((name) => indexOfItem(chips, name) === -1)

  useEffect(() => {
    const target = pendingFocus.current
    const list = listRef.current
    if (target === null || !list) return
    pendingFocus.current = null
    const buttons = list.querySelectorAll<HTMLButtonElement>('button')
    const button = target === 'new' ? buttons[buttons.length - 1] : buttons[target]
    button?.focus({ preventScroll: true })
  }, [focusTick])

  function focusAfterRender(target: number | 'new') {
    pendingFocus.current = target
    setFocusTick((tick) => tick + 1)
  }

  function showMessage(text: string | null) {
    setMessage((current) => (text === null ? null : { text, n: (current?.n ?? 0) + 1 }))
  }

  /** Freezes the chips after the suggestions where they are now, before the selection changes. */
  function keepExtras(added?: string) {
    const current = chips.slice(shown.length)
    setExtras(added && indexOfItem(chips, added) === -1 ? [...current, added] : current)
  }

  function toggle(name: string) {
    const index = indexOfItem(selected, name)
    if (index === -1 && selected.length >= MAX_ACTIVITIES) {
      showMessage(TOO_MANY_ACTIVITIES)
      return
    }
    keepExtras()
    onChange(index === -1 ? [...selected, name] : selected.filter((_, i) => i !== index))
    showMessage(null)
  }

  function showMore() {
    // The first chip that was hidden takes focus, since "More" goes away.
    focusAfterRender(ACTIVITIES_SHOWN)
    setShowAll(true)
  }

  function closeField() {
    onDraftChange(null)
    showMessage(null)
    focusAfterRender('new')
  }

  /** Add or Enter: selects the typed activity (spelled like a chip when one matches) and closes the field. */
  function add() {
    const name = cleanItem(draft ?? '')
    if (name === '') {
      closeField()
      return
    }
    const known = [...chips, ...suggestions]
    const spelling = known[indexOfItem(known, name)] ?? name
    if (indexOfItem(selected, spelling) === -1) {
      if (selected.length >= MAX_ACTIVITIES) {
        showMessage(TOO_MANY_ACTIVITIES)
        return
      }
      keepExtras(spelling)
      onChange([...selected, spelling])
    }
    closeField()
  }

  return (
    <section className="form-section" aria-labelledby={labelId}>
      <h3 id={labelId} className="form-section__label">
        Activities
      </h3>
      <div ref={listRef} className="chip-wrap" role="group" aria-labelledby={labelId}>
        {chips.map((name) => (
          <Chip
            key={name.toLocaleLowerCase()}
            wrap
            selected={indexOfItem(selected, name) !== -1}
            onClick={() => toggle(name)}
          >
            {name}
          </Chip>
        ))}
        {hasMore && (
          <Chip ariaLabel="More activities" onClick={showMore}>
            More
          </Chip>
        )}
        {draft === null && (
          <Chip ariaLabel="New activity" onClick={() => onDraftChange('')}>
            <IconPlus size={16} strokeWidth={2.4} />
            New
          </Chip>
        )}
      </div>
      {draft !== null && (
        <div className="activity-new">
          <input
            className="field"
            value={draft}
            placeholder="Activity"
            aria-label="New activity"
            aria-describedby={message ? messageId : undefined}
            autoFocus
            autoCapitalize="sentences"
            enterKeyHint="done"
            maxLength={MAX_ITEM_LENGTH}
            onChange={(event) => {
              onDraftChange(event.target.value)
              showMessage(null)
            }}
            onKeyDown={(event) => {
              if (isPlainEnter(event)) {
                event.preventDefault()
                add()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                closeField()
              }
            }}
          />
          <button type="button" className="button button--secondary" onClick={add}>
            Add
          </button>
        </div>
      )}
      {message && (
        <p key={message.n} id={messageId} className="field-hint" role="alert">
          {message.text}
        </p>
      )}
    </section>
  )
}
```

- [ ] **Step 10: Write the Photos section**

Create `src/sheets/MeetupPhotos.tsx`:

```tsx
import { useEffect, useId, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react'
import { IconCameraPlus, IconClose } from '../components/icons'
import type { NewPhoto } from '../db/meetups'
import { newId } from '../lib/ids'
import { processPhoto } from '../lib/image'
import { describeSkippedPhotos, isValidPhotoData, MAX_PHOTOS, TOO_MANY_PHOTOS } from '../lib/photos'
import { plural } from '../lib/text'

/** A photo in the meetup sheet: a saved one (its id and thumbnail), or a new one waiting for Save. */
export interface DraftPhoto {
  id: string
  thumb: string
  /** Only for a photo added in this sheet. */
  added?: NewPhoto
}

interface MeetupPhotosProps {
  photos: DraftPhoto[]
  setPhotos: Dispatch<SetStateAction<DraftPhoto[] | null>>
  /** True while photos are being resized (Save waits). */
  onBusyChange: (busy: boolean) => void
  /** False once the sheet closes, which stops resizing what's left. */
  open: boolean
}

/** The meetup sheet's Photos section: a grid of thumbnails with remove buttons, and the Add photos tile. */
export function MeetupPhotos({ photos, setPhotos, onBusyChange, open }: MeetupPhotosProps) {
  const labelId = useId()
  const messageId = useId()
  const fileInput = useRef<HTMLInputElement>(null)
  const gridRef = useRef<HTMLUListElement>(null)
  const busyRef = useRef(false)
  const openRef = useRef(open)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [message, setMessage] = useState<{ text: string; n: number } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  // After a remove, focus goes to the remove button that took its place (else the one before, else Add photos).
  const pendingFocus = useRef<number | null>(null)

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    const index = pendingFocus.current
    const grid = gridRef.current
    if (index === null || !grid) return
    pendingFocus.current = null
    const removes = grid.querySelectorAll<HTMLButtonElement>('.photo-tile__remove')
    const target = removes[index] ?? removes[index - 1] ?? grid.querySelector<HTMLButtonElement>('.photo-add')
    target?.focus({ preventScroll: true })
  }, [photos])

  function showMessage(text: string | null) {
    setMessage((current) => (text === null ? null : { text, n: (current?.n ?? 0) + 1 }))
  }

  function openPicker() {
    if (busyRef.current) return
    if (photos.length >= MAX_PHOTOS) {
      showMessage(TOO_MANY_PHOTOS)
      return
    }
    fileInput.current?.click()
  }

  /** Resizes the chosen files one at a time (to keep memory low), adding each as it's ready. */
  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0 || busyRef.current) return
    const chosen = files.slice(0, Math.max(0, MAX_PHOTOS - photos.length))
    const skipped = files.length - chosen.length
    let added = 0
    let failed = 0
    busyRef.current = true
    onBusyChange(true)
    showMessage(null)
    setAnnouncement('')
    try {
      for (const [index, file] of chosen.entries()) {
        if (!openRef.current) return
        setProgress({ current: index + 1, total: chosen.length })
        try {
          const processed = await processPhoto(file)
          if (!isValidPhotoData(processed)) throw new Error('The photo is too large')
          const id = newId()
          setPhotos((current) => current && [...current, { id, thumb: processed.thumb, added: { id, ...processed } }])
          added += 1
        } catch {
          failed += 1
        }
      }
    } finally {
      busyRef.current = false
      setProgress(null)
      onBusyChange(false)
    }
    showMessage(describeSkippedPhotos(skipped, failed))
    if (added > 0) setAnnouncement(`Added ${plural(added, 'photo')}.`)
  }

  function remove(id: string, index: number) {
    pendingFocus.current = index
    setPhotos((current) => current && current.filter((photo) => photo.id !== id))
    showMessage(null)
    setAnnouncement('')
  }

  return (
    <section className="form-section" aria-labelledby={labelId}>
      <h3 id={labelId} className="form-section__label">
        Photos
      </h3>
      <ul ref={gridRef} className="photo-grid" aria-labelledby={labelId}>
        {photos.map((photo, index) => (
          <li key={photo.id} className="photo-tile">
            <img className="photo-tile__image" src={photo.thumb} alt={`Photo ${index + 1}`} />
            <button
              type="button"
              className="photo-tile__remove"
              aria-label={`Remove photo ${index + 1}`}
              onClick={() => remove(photo.id, index)}
            >
              <span className="photo-tile__remove-glyph">
                <IconClose size={12} strokeWidth={3} />
              </span>
            </button>
          </li>
        ))}
        <li className="photo-tile">
          <button
            type="button"
            className="photo-add"
            aria-disabled={progress !== null}
            aria-describedby={message ? messageId : undefined}
            onClick={openPicker}
          >
            <IconCameraPlus size={26} />
            <span>{progress ? `Adding ${progress.current} of ${progress.total}…` : 'Add photos'}</span>
          </button>
        </li>
      </ul>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={choose}
      />
      {message && (
        <p key={message.n} id={messageId} className="field-hint" role="alert">
          {message.text}
        </p>
      )}
      <span className="visually-hidden" aria-live="polite">
        {announcement}
      </span>
    </section>
  )
}
```

- [ ] **Step 11: Wire both into the meetup sheet**

In `src/sheets/MeetupSheet.tsx`, replace:

```tsx
import { useFriends, useMeetups, useMeetupTypes } from '../data/hooks'
import { ValidationError } from '../db/errors'
import { addMeetup, deleteMeetup, restoreMeetup, updateMeetup } from '../db/meetups'
import { useToday } from '../hooks/useToday'
import { addDays, formatDate, isISODate, todayISO } from '../lib/dates'
import { isPlainEnter } from '../lib/keys'
import { compareNames, formatNameList } from '../lib/text'
import { recentFriends } from '../stats/recent'
import type { Friend } from '../types'
import type { MeetupSheetRequest } from './sheetsContext'
```

with:

```tsx
import { useFriends, useMeetupPhotoThumbs, useMeetups, useMeetupTypes } from '../data/hooks'
import { ValidationError } from '../db/errors'
import {
  addMeetup,
  deleteMeetup,
  NO_PHOTO_CHANGES,
  restoreMeetup,
  updateMeetup,
  type PhotoChanges,
} from '../db/meetups'
import { useToday } from '../hooks/useToday'
import { activitySuggestions } from '../lib/activities'
import { addDays, formatDate, isISODate, todayISO } from '../lib/dates'
import { isPlainEnter } from '../lib/keys'
import { askToKeepData } from '../lib/persist'
import { compareNames, formatNameList } from '../lib/text'
import { recentFriends } from '../stats/recent'
import type { Friend } from '../types'
import { MeetupActivities } from './MeetupActivities'
import { MeetupPhotos, type DraftPhoto } from './MeetupPhotos'
import type { MeetupSheetRequest } from './sheetsContext'
```

Replace:

```tsx
    note: editing?.note ?? '',
  }))
  const [friendIds, setFriendIds] = useState<string[]>(start.friendIds)
  const [typeId, setTypeId] = useState<string | null>(start.typeId)
  const [date, setDate] = useState(start.date)
  const [note, setNote] = useState(start.note)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)
```

with:

```tsx
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
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // Photos change only in the sheet until Save. A saved meetup's photos load once, as ids and thumbnails.
  const storedPhotos = useMeetupPhotoThumbs(editing?.id)
  const [photos, setPhotos] = useState<DraftPhoto[] | null>(null)
  const [startPhotoIds, setStartPhotoIds] = useState<string[]>([])
  const [addingPhotos, setAddingPhotos] = useState(false)
  if (photos === null && storedPhotos) {
    setPhotos(storedPhotos)
    setStartPhotoIds(storedPhotos.map((photo) => photo.id))
  }
  const suggestions = useMemo(() => activitySuggestions(meetups ?? []), [meetups])
```

Replace:

```tsx
    date !== start.date ||
    note !== start.note
```

with:

```tsx
    date !== start.date ||
    note !== start.note ||
    activities.join('\n') !== start.activities.join('\n') ||
    !!activityDraft?.trim() ||
    (photos !== null && photos.map((photo) => photo.id).join() !== startPhotoIds.join())
```

Replace:

```tsx
    if (savingRef.current) return
    if (friendIds.length === 0 || !effectiveTypeId) return
    savingRef.current = true
    setSaving(true)
    try {
      const input = { date, typeId: effectiveTypeId, friendIds, note, activities: editing?.activities ?? [] }
      if (editing) {
        await updateMeetup(editing.id, input)
        toast({ message: 'Saved' })
      } else {
        const meetup = await addMeetup(input)
```

with:

```tsx
    if (savingRef.current || addingPhotos) return
    if (friendIds.length === 0 || !effectiveTypeId) return
    savingRef.current = true
    setSaving(true)
    try {
      // An activity typed into "+ New" but not added yet is saved too.
      const typed = activityDraft?.trim() ? [...activities, activityDraft] : activities
      const input = { date, typeId: effectiveTypeId, friendIds, note, activities: typed }
      const photoChanges: PhotoChanges = photos
        ? {
            add: photos.flatMap((photo) => (photo.added ? [photo.added] : [])),
            removeIds: startPhotoIds.filter((id) => !photos.some((photo) => photo.id === id)),
            order: photos.map((photo) => photo.id),
          }
        : NO_PHOTO_CHANGES
      if (editing) {
        await updateMeetup(editing.id, input, photoChanges)
        toast({ message: 'Saved' })
      } else {
        const meetup = await addMeetup(input, photoChanges)
```

Replace:

```tsx
      onClose()
    } catch (caught) {
```

with:

```tsx
      // Photos take real space, so ask Safari to keep the data when the phone runs low (best effort).
      if (photoChanges.add.length > 0) void askToKeepData()
      onClose()
    } catch (caught) {
```

Replace:

```tsx
            disabled={saving || friendIds.length === 0 || effectiveTypeId === null}
```

with:

```tsx
            disabled={saving || addingPhotos || friendIds.length === 0 || effectiveTypeId === null}
```

Replace:

```tsx
      <div className="form-section">
        <label htmlFor={noteId} className="form-section__label">
```

with:

```tsx
      <MeetupActivities
        suggestions={suggestions}
        selected={activities}
        onChange={(next) => {
          setActivities(next)
          setError(null)
        }}
        draft={activityDraft}
        onDraftChange={setActivityDraft}
      />

      {photos && (
        <MeetupPhotos
          photos={photos}
          setPhotos={setPhotos}
          onBusyChange={setAddingPhotos}
          open={request !== null}
        />
      )}

      <div className="form-section">
        <label htmlFor={noteId} className="form-section__label">
```

- [ ] **Step 12: Style the sections**

The 3-across grid is shared with the Meetup page (Task 6), so it goes in the shared stylesheet.

In `src/styles/base.css`, replace:

```css
.list-message {
```

with:

```css
/* Photo grids (the meetup sheet and the Meetup page): square tiles, three across. */
.photo-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.photo-tile {
  position: relative;
  aspect-ratio: 1;
}
.photo-tile__image {
  width: 100%;
  height: 100%;
  border-radius: var(--radius-field);
  background: var(--surface-2);
  object-fit: cover;
}

.list-message {
```

In `src/sheets/MeetupSheet.css`, replace:

```css
@media (prefers-reduced-motion: reduce) {
  .recent-friend__check {
    animation: fade-in var(--dur) linear;
  }
}
```

with:

```css
/* "+ New" activity: the field and its Add button on their own line under the chips. */
.activity-new {
  display: flex;
  gap: var(--space-2);
}
.activity-new .field {
  flex: 1;
  min-width: 0;
}

/* Photos (the grid itself is in base.css). Remove: a 44px hit area in the tile's corner around a small
   Warm Ink circle with a cross, ringed in Warm Paper so it stands off any photo. */
.photo-tile__remove {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  place-items: center;
  width: var(--tap);
  height: var(--tap);
}
.photo-tile__remove-glyph {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border: 1.5px solid var(--bg);
  border-radius: 50%;
  background: var(--ink);
  color: var(--bg);
  transition: transform var(--dur-fast) var(--ease-out-quart);
}
.photo-tile__remove:active .photo-tile__remove-glyph {
  transform: scale(0.9);
}
/* The dashed outline marks an empty slot to fill, not a container. */
.photo-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  width: 100%;
  height: 100%;
  padding: var(--space-2);
  border: 1.5px dashed var(--ink-3);
  border-radius: var(--radius-field);
  background: var(--surface-2);
  color: var(--ink-2);
  font-size: var(--text-footnote);
  font-weight: 600;
  line-height: 1.25;
  text-align: center;
  overflow-wrap: anywhere;
  transition: background-color var(--dur-fast);
}
.photo-add:active {
  background: var(--surface-pressed);
}
.photo-add[aria-disabled='true'] {
  cursor: progress;
}

@media (prefers-reduced-motion: reduce) {
  .recent-friend__check {
    animation: fade-in var(--dur) linear;
  }
  .photo-tile__remove:active .photo-tile__remove-glyph {
    transform: none;
  }
}
```

- [ ] **Step 13: Run the new end-to-end tests to see them pass**

Run: `npx playwright test --project=iphone e2e/memories.spec.ts`
Expected: `7 passed`.

- [ ] **Step 14: Run everything**

Run: `npm test`
Expected: `Test Files  47 passed (47)` and `Tests  510 passed (510)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `101 passed`.

- [ ] **Step 15: Commit**

```bash
git add src/sheets/MeetupActivities.tsx src/sheets/MeetupPhotos.tsx src/sheets/MeetupSheet.tsx src/sheets/MeetupSheet.css src/styles/base.css src/components/icons.tsx src/data/hooks.ts src/lib/photos.ts src/lib/photos.test.ts src/lib/persist.ts src/lib/persist.test.ts e2e/helpers.ts e2e/memories.spec.ts
git commit -F - <<'EOF'
feat: Activities and Photos in the meetup sheet, saved with the meetup

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 6: The Meetup page, opened from a friend's history

**Files:**
- Create: `src/screens/MeetupScreen.tsx`, `src/screens/MeetupScreen.css`, `e2e/meetupPage.spec.ts`
- Modify: `src/App.tsx` (route), `src/components/TabBar.tsx` (`/meetups` is under Friends), `src/data/hooks.ts` (`useMeetup`, `useMeetupPhotos`), `src/screens/FriendDetailScreen.tsx` (history rows link to the page), `src/styles/base.css`, `src/screens/StatsScreen.css`, `src/screens/FriendDetailScreen.css` (`.person-chip` and `.upcoming-badge` move to base.css), `e2e/helpers.ts` (`editMeetup` goes through the page), `e2e/detail.spec.ts` (history rows are links)
- Test: `e2e/meetupPage.spec.ts`, `e2e/detail.spec.ts`, `e2e/memories.spec.ts` (unchanged, through `editMeetup`)

The page uses the friend page's patterns: `Page` with `pushed` (slides in), a `back` with a fallback, the back label from router state (`NavState.backLabel`), and `ScrollManager` (which already restores scroll on Back by `location.key`, so it needs no change). Thumbnails are plain images in this task; Task 7 makes them open the viewer.

- [ ] **Step 1: Write the failing end-to-end tests**

Create `e2e/meetupPage.spec.ts`:

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
  await logMeetup(page, ['Alex', 'Sam'], {
    type: 'Meal',
    activities: ['Karaoke', 'Pottery class'],
    note: 'Tacos',
    photos: [tinyPhoto('one.png'), tinyPhoto('two.png')],
  })
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await expect(page.getByText(todayLabel(), { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Alex' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Friends' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  // (The text includes each avatar's initials, so check that it contains the names.)
  await expect(page.getByRole('list', { name: 'With' }).getByRole('link')).toContainText(['Alex', 'Sam'])
  await expect(page.getByRole('region', { name: 'Activities' }).getByRole('listitem')).toHaveText([
    'Karaoke',
    'Pottery class',
  ])
  await expect(page.getByRole('region', { name: 'Note' })).toContainText('Tacos')
  const photos = page.getByRole('region', { name: 'Photos' }).getByRole('img')
  await expect(photos).toHaveCount(2)
  await expect(photos.nth(1)).toHaveAccessibleName('Photo 2 of 2')

  // A friend opens from here, and comes back to the meetup.
  await page.getByRole('list', { name: 'With' }).getByRole('link', { name: 'Sam' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Sam' })).toBeVisible()
  await page.getByRole('button', { name: 'Meal' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await page.getByRole('button', { name: 'Alex' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
})

test('hides what a meetup does not have, and marks one that is upcoming', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { date: '2099-01-01' })
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  await expect(page.getByText('Upcoming', { exact: true })).toBeVisible()
  await expect(page.getByRole('list', { name: 'With' }).getByRole('link')).toContainText(['Alex'])
  for (const name of ['Activities', 'Note', 'Photos']) {
    await expect(page.getByRole('region', { name })).toHaveCount(0)
  }
})

test('redirects to Friends for an unknown meetup', async ({ page }) => {
  await page.goto('/#/meetups/nope')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})
```

History rows become links to the page, so the tests that tapped a row for the sheet change too.

In `e2e/detail.spec.ts`, replace:

```ts
  await expect(history.getByRole('button', { name: /Meal.*with Sam.*Tacos/ })).toBeVisible()
```

with:

```ts
  await expect(history.getByRole('link', { name: /Meal.*with Sam.*Tacos/ })).toBeVisible()
```

Replace:

```ts
  await expect(page.getByRole('region', { name: 'History' }).getByRole('button', { name: /Coffee/ })).toBeVisible()
```

with:

```ts
  await expect(page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ })).toBeVisible()
```

Replace:

```ts
test('edits a meetup, then deletes it with undo', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await page.getByRole('link', { name: /Alex/ }).click()
  const history = page.getByRole('region', { name: 'History' })

  await history.getByRole('button', { name: /Coffee/ }).click()
  const editSheet = page.getByRole('dialog', { name: 'Edit meetup' })
  await editSheet.getByRole('button', { name: 'Drinks', exact: true }).click()
  await editSheet.getByRole('button', { name: 'Save' }).click()
  await expect(editSheet).toBeHidden()
  await expect(history.getByRole('button', { name: /Drinks/ })).toBeVisible()

  await history.getByRole('button', { name: /Drinks/ }).click()
  await page.getByRole('dialog', { name: 'Edit meetup' }).getByRole('button', { name: 'Delete meetup' }).click()
  await expect(page.getByText('Your first meetup will show up here.')).toBeVisible()
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(history.getByRole('button', { name: /Drinks/ })).toBeVisible()
})
```

with:

```ts
test('edits a meetup from its page, then deletes it with undo', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await page.getByRole('link', { name: /Alex/ }).click()
  const history = page.getByRole('region', { name: 'History' })

  await history.getByRole('link', { name: /Coffee/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Coffee' })).toBeVisible()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const editSheet = page.getByRole('dialog', { name: 'Edit meetup' })
  await editSheet.getByRole('button', { name: 'Drinks', exact: true }).click()
  await editSheet.getByRole('button', { name: 'Save' }).click()
  await expect(editSheet).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Drinks' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('dialog', { name: 'Edit meetup' }).getByRole('button', { name: 'Delete meetup' }).click()
  // The meetup is gone, so its page goes back to the friend.
  await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
  await expect(page.getByText('Your first meetup will show up here.')).toBeVisible()
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(history.getByRole('link', { name: /Drinks/ })).toBeVisible()
})
```

In `e2e/helpers.ts`, replace:

```ts
/** On a friend's page: opens a meetup from their history in the Edit meetup sheet. */
export async function editMeetup(page: Page, name: RegExp): Promise<Locator> {
  await page.getByRole('region', { name: 'History' }).getByRole('button', { name }).click()
```

with:

```ts
/** On a friend's page: opens a meetup from their history, then its Edit meetup sheet. */
export async function editMeetup(page: Page, name: RegExp): Promise<Locator> {
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name }).click()
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
```

(`e2e/memories.spec.ts` reopens the friend page with `openFriendPage` before every `editMeetup`, so it keeps working now that Save leaves you on the Meetup page.)

- [ ] **Step 2: Run them to see them fail**

Run: `npx playwright test --project=iphone e2e/meetupPage.spec.ts e2e/detail.spec.ts e2e/memories.spec.ts`
Expected: FAIL. History rows are still buttons, so every test that opens a meetup from a friend's history times out. ("redirects to Friends for an unknown meetup" already passes: the catch-all route sends `/meetups/nope` to Friends.)

- [ ] **Step 3: Add the hooks**

In `src/data/hooks.ts`, replace:

```ts
export function useMeetups(): Meetup[] | undefined {
  return useLiveQuery(() => db.meetups.toArray())
}
```

with:

```ts
export function useMeetups(): Meetup[] | undefined {
  return useLiveQuery(() => db.meetups.toArray())
}

/** `null` when no meetup has this id. */
export function useMeetup(id: string | undefined): Meetup | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.meetups.get(id)) ?? null) : null), [id])
}

/** A meetup's photos in order, full images included: the Meetup page and its viewer. */
export function useMeetupPhotos(meetupId: string | undefined): MeetupPhoto[] | undefined {
  return useLiveQuery(
    async () => (meetupId ? db.meetupPhotos.where('meetupId').equals(meetupId).sortBy('order') : []),
    [meetupId],
  )
}
```

- [ ] **Step 4: Move the shared styles to base.css**

The Meetup page uses the person chip (from Stats) and the Upcoming badge (from the friend page), so both move to the shared stylesheet unchanged.

Delete from the end of `src/screens/StatsScreen.css` (with the blank line before it):

```css
.person-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--tap);
  padding: 0 var(--space-4) 0 var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--ink);
  font-size: var(--text-subhead);
  text-decoration: none;
  transition: background-color var(--dur-fast);
}
.person-chip:active {
  background: var(--surface-pressed);
}
```

Delete from the end of `src/screens/FriendDetailScreen.css` (with the blank line before it):

```css
.upcoming-badge {
  display: inline-block;
  margin-left: var(--space-1);
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent-ink);
  font-size: var(--text-caption);
  font-weight: 600;
  vertical-align: 2px;
}
```

In `src/styles/base.css`, replace:

```css
/* Photo grids (the meetup sheet and the Meetup page): square tiles, three across. */
```

with:

```css
/* A friend as a link: avatar and name in a Paper White pill (Stats, the Meetup page). */
.person-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--tap);
  padding: 0 var(--space-4) 0 var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--ink);
  font-size: var(--text-subhead);
  text-decoration: none;
  transition: background-color var(--dur-fast);
}
.person-chip:active {
  background: var(--surface-pressed);
}

/* A future meetup (the friend page's history, the Meetup page). */
.upcoming-badge {
  display: inline-block;
  margin-left: var(--space-1);
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent-ink);
  font-size: var(--text-caption);
  font-weight: 600;
  vertical-align: 2px;
}

/* Photo grids (the meetup sheet and the Meetup page): square tiles, three across. */
```

- [ ] **Step 5: Write the Meetup page**

Create `src/screens/MeetupScreen.tsx`:

```tsx
import { useEffect, useId, useRef } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { Section } from '../components/InsetGroup'
import { Page, type NavState } from '../components/Page'
import { useFriends, useMeetup, useMeetupPhotos, useMeetupTypes } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import { formatDate } from '../lib/dates'
import { useSheets } from '../sheets/sheetsContext'
import type { Friend } from '../types'
import './MeetupScreen.css'

/** The memory view of one meetup: what, when, who, what you did, the note and the photos. */
export function MeetupScreen() {
  const { id } = useParams()
  const meetup = useMeetup(id)
  const photos = useMeetupPhotos(id)
  const friends = useFriends()
  const types = useMeetupTypes()
  const today = useToday()
  const location = useLocation()
  const navigate = useNavigate()
  const { openMeetupSheet } = useSheets()
  const withId = useId()
  const leftRef = useRef(false)

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

      {meetup.note && (
        <Section title="Note">
          <p className="meetup-note">{meetup.note}</p>
        </Section>
      )}

      {photos.length > 0 && (
        <Section title="Photos">
          <ul className="photo-grid">
            {photos.map((photo, index) => (
              <li key={photo.id} className="photo-tile">
                <img
                  className="photo-tile__image"
                  src={photo.thumb}
                  alt={`Photo ${index + 1} of ${photos.length}`}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </Page>
  )
}
```

Create `src/screens/MeetupScreen.css`:

```css
.meetup-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  text-align: center;
}
/* The type's emoji, as big as the friend page's avatar. */
.meetup-hero__badge {
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: var(--surface-2);
  font-size: 48px;
  line-height: 1;
}
.meetup-hero__title {
  margin: var(--space-3) 0 0;
  font-family: var(--font-rounded);
  font-size: var(--text-title);
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.meetup-hero__date {
  margin: 0;
  color: var(--ink-2);
}
.meetup-hero__with {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
.meetup-hero__with-label {
  font-size: var(--text-footnote);
  font-weight: 600;
  color: var(--ink-2);
}
.meetup-hero__people {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.meetup-hero__people .person-chip {
  max-width: 100%;
  overflow-wrap: anywhere;
}

/* Read-only activity chips: the chip look without a press state. */
.meetup-tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.meetup-tag {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 36px;
  padding: 6px 14px;
  border-radius: 1.2em;
  background: var(--surface-2);
  color: var(--ink);
  font-size: var(--text-subhead);
  font-weight: 500;
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

- [ ] **Step 6: Add the route, and keep the page under the Friends tab**

In `src/App.tsx`, replace:

```tsx
import { MeetupTypesScreen } from './screens/MeetupTypesScreen'
```

with:

```tsx
import { MeetupScreen } from './screens/MeetupScreen'
import { MeetupTypesScreen } from './screens/MeetupTypesScreen'
```

Replace:

```tsx
                <Route path="/friends/:id" element={<FriendDetailScreen />} />
```

with:

```tsx
                <Route path="/friends/:id" element={<FriendDetailScreen />} />
                <Route path="/meetups/:id" element={<MeetupScreen />} />
```

In `src/components/TabBar.tsx`, replace:

```tsx
  { to: '/', label: 'Friends', Icon: IconFriends, matches: (path: string) => path === '/' || path.startsWith('/friends') },
```

with:

```tsx
  {
    to: '/',
    label: 'Friends',
    Icon: IconFriends,
    matches: (path: string) => path === '/' || path.startsWith('/friends') || path.startsWith('/meetups'),
  },
```

- [ ] **Step 7: Open the page from a friend's history**

In `src/screens/FriendDetailScreen.tsx`, replace:

```tsx
import { Navigate, useParams } from 'react-router'
```

with:

```tsx
import { Navigate, useLocation, useParams } from 'react-router'
```

Replace:

```tsx
import { Page } from '../components/Page'
```

with:

```tsx
import { Page, type NavState } from '../components/Page'
```

Replace:

```tsx
  const today = useToday()
  const { openFriendSheet, openMeetupSheet } = useSheets()
```

with:

```tsx
  const today = useToday()
  const location = useLocation()
  const { openFriendSheet } = useSheets()
```

Replace:

```tsx
  const nameById = new Map(friends.map((f) => [f.id, f.name] as const))
```

with:

```tsx
  const nameById = new Map(friends.map((f) => [f.id, f.name] as const))
  // A meetup opened from here says the friend's name on its back button, and keeps the tab this page came from.
  const fromFriend: NavState = { backLabel: friend.name, tab: (location.state as NavState | null)?.tab }
```

Replace:

```tsx
                    onClick={() => openMeetupSheet({ meetup })}
```

with:

```tsx
                    to={`/meetups/${meetup.id}`}
                    state={fromFriend}
```

- [ ] **Step 8: Run the end-to-end tests to see them pass**

Run: `npx playwright test --project=iphone e2e/meetupPage.spec.ts e2e/detail.spec.ts e2e/memories.spec.ts`
Expected: `16 passed`.

- [ ] **Step 9: Run everything**

Run: `npm test`
Expected: `Test Files  47 passed (47)` and `Tests  510 passed (510)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `104 passed`.

- [ ] **Step 10: Commit**

```bash
git add src/screens/MeetupScreen.tsx src/screens/MeetupScreen.css src/App.tsx src/components/TabBar.tsx src/data/hooks.ts src/screens/FriendDetailScreen.tsx src/screens/FriendDetailScreen.css src/screens/StatsScreen.css src/styles/base.css e2e/meetupPage.spec.ts e2e/detail.spec.ts e2e/helpers.ts
git commit -F - <<'EOF'
feat: the Meetup page, opened from a friend's history, with Edit and back to the friend when deleted

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 7: The photo viewer

**Files:**
- Create: `src/components/PhotoViewer.tsx`, `src/components/PhotoViewer.css`
- Modify: `src/styles/tokens.css` (the viewer's colors), `src/screens/MeetupScreen.tsx` (thumbnails open the viewer; focus comes back), `src/screens/MeetupScreen.css`
- Test: `e2e/meetupPage.spec.ts`

The viewer is a `role="dialog"` with `aria-modal`, named for the photo it shows ("Photo 2 of 5"), drawn on the one near-black ground in the app (in light mode too). Close, Previous and Next are 44px. Escape closes it, the arrow keys and a sideways swipe change photos, Tab stays inside, and focus goes back to the photo's thumbnail. With Reduce Motion, the next photo fades in instead of sliding. There is no zoom (out of scope), so the photo area turns off the browser's touch gestures.

- [ ] **Step 1: Write the failing end-to-end tests**

Append to the end of `e2e/meetupPage.spec.ts`:

```ts

test('the photo viewer goes through the photos and gives focus back to the thumbnail', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { photos: [tinyPhoto('one.png'), tinyPhoto('two.png'), tinyPhoto('three.png')] })
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()
  const thumbnails = page.getByRole('region', { name: 'Photos' }).getByRole('button')

  await thumbnails.first().click()
  const viewer = page.getByRole('dialog', { name: 'Photo 1 of 3' })
  await expect(viewer).toBeVisible()
  await expect(viewer.getByRole('button', { name: 'Close' })).toBeFocused()
  await expect(viewer.getByRole('img')).toHaveAccessibleName(`Photo 1 of 3, Coffee, ${todayLabel()}`)
  await expect(viewer.getByRole('img')).toHaveAttribute('src', /^data:image\/jpeg/)
  await expect(viewer.getByText('1 of 3', { exact: true })).toBeVisible()
  await expect(viewer.getByRole('button', { name: 'Previous photo' })).toHaveAttribute('aria-disabled', 'true')

  await viewer.getByRole('button', { name: 'Next photo' }).click()
  const second = page.getByRole('dialog', { name: 'Photo 2 of 3' }).getByRole('img')
  await expect(second).toBeVisible()
  // The next photo slides in from the right.
  expect(await second.evaluate((element) => getComputedStyle(element).animationName)).toBe('viewer-from-next')
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('dialog', { name: 'Photo 3 of 3' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next photo' })).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('dialog', { name: 'Photo 2 of 3' })).toBeVisible()

  // Focus stays inside: Shift+Tab from Close goes round to Next.
  await page.getByRole('button', { name: 'Close' }).focus()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Next photo' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Close' })).toBeFocused()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(thumbnails.nth(1)).toBeFocused()

  await thumbnails.nth(2).click()
  await page.getByRole('dialog', { name: 'Photo 3 of 3' }).getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(thumbnails.nth(2)).toBeFocused()
})

test('the photo viewer changes photos with a swipe, and only fades with Reduce Motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { photos: [tinyPhoto('one.png'), tinyPhoto('two.png')] })
  await openFriendPage(page, 'Alex')
  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Coffee/ }).click()
  await page.getByRole('region', { name: 'Photos' }).getByRole('button').first().click()
  await expect(page.getByRole('dialog', { name: 'Photo 1 of 2' })).toBeVisible()

  // A swipe to the left shows the next photo, to the right the previous one.
  await page.mouse.move(300, 400)
  await page.mouse.down()
  await page.mouse.move(120, 410, { steps: 5 })
  await page.mouse.up()
  const image = page.getByRole('dialog', { name: 'Photo 2 of 2' }).getByRole('img')
  await expect(image).toBeVisible()
  expect(await image.evaluate((element) => getComputedStyle(element).animationName)).toBe('fade-in')

  await page.mouse.move(100, 400)
  await page.mouse.down()
  await page.mouse.move(300, 395, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByRole('dialog', { name: 'Photo 1 of 2' })).toBeVisible()
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx playwright test --project=iphone e2e/meetupPage.spec.ts`
Expected: FAIL, 2 failed: the Photos section has no buttons yet, so the viewer can't open.

- [ ] **Step 3: Add the viewer's colors**

In `src/styles/tokens.css`, replace:

```css
  --shadow-float: 0 10px 30px oklch(35% 0.04 45 / 0.16), 0 2px 6px oklch(35% 0.04 45 / 0.1);
}
```

with:

```css
  --shadow-float: 0 10px 30px oklch(35% 0.04 45 / 0.16), 0 2px 6px oklch(35% 0.04 45 / 0.1);

  /* The photo viewer, the one near-black ground, the same in both themes so photos look true. */
  --viewer-bg: oklch(13% 0.006 55);
  --viewer-ink: oklch(96% 0.006 70);
  --viewer-pressed: oklch(100% 0 0 / 0.14);
}
```

These live only in the light `:root` block, so dark mode keeps them as they are.

- [ ] **Step 4: Write the viewer**

Create `src/components/PhotoViewer.tsx`:

```tsx
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useScrollLock } from '../hooks/useScrollLock'
import type { MeetupPhoto } from '../types'
import { IconChevronLeft, IconChevronRight, IconClose } from './icons'
import './PhotoViewer.css'

/** How far a finger must travel sideways to change photos, in px. */
const SWIPE_DISTANCE = 50

interface PhotoViewerProps {
  photos: MeetupPhoto[]
  index: number
  onIndexChange: (index: number) => void
  /** Called on Close or Escape. The caller puts focus back on the photo's thumbnail. */
  onClose: () => void
  /** Alt text for a photo, e.g. "Photo 2 of 5, Coffee, Sat, Sep 12". */
  describe: (index: number) => string
}

/** A full-screen photo on a dark ground, with previous and next, swipe and arrow keys. No zoom. */
export function PhotoViewer({ photos, index, onIndexChange, onClose, describe }: PhotoViewerProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const [direction, setDirection] = useState<'next' | 'previous' | null>(null)
  useScrollLock(true)

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true })
  }, [])

  const photo = photos[index]
  const count = photos.length

  function go(step: 1 | -1) {
    const next = index + step
    if (next < 0 || next >= count) return
    setDirection(step === 1 ? 'next' : 'previous')
    onIndexChange(next)
  }

  // Keys are heard on the whole document: Safari doesn't focus a button when it's tapped or clicked,
  // so after Next, focus may be on the page behind the viewer.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        go(1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        go(-1)
      } else if (event.key === 'Tab') {
        trapFocus(event)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  })

  /** Keeps Tab and Shift+Tab inside the viewer, going round from the last button to the first. */
  function trapFocus(event: KeyboardEvent) {
    const dialog = dialogRef.current
    const buttons = Array.from(dialog?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    const first = buttons[0]
    const last = buttons[buttons.length - 1]
    if (!dialog || !first || !last) return
    const outside = !dialog.contains(document.activeElement)
    if (event.shiftKey && (outside || document.activeElement === first)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (outside || document.activeElement === last)) {
      event.preventDefault()
      first.focus()
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary) return
    swipeStart.current = { x: event.clientX, y: event.clientY }
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dx) >= SWIPE_DISTANCE && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1)
  }

  if (!photo) return null

  return createPortal(
    <div ref={dialogRef} className="viewer" role="dialog" aria-modal="true" aria-label={`Photo ${index + 1} of ${count}`}>
      <div className="viewer__bar">
        <button ref={closeRef} type="button" className="viewer__button" aria-label="Close" onClick={onClose}>
          <IconClose size={24} strokeWidth={2.4} />
        </button>
      </div>
      <div
        className="viewer__stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeStart.current = null
        }}
      >
        <img
          key={photo.id}
          className={direction ? `viewer__image viewer__image--${direction}` : 'viewer__image'}
          src={photo.full}
          width={photo.width}
          height={photo.height}
          alt={describe(index)}
          draggable={false}
        />
      </div>
      <div className="viewer__controls">
        {/* aria-disabled, not disabled: a button that disables itself would drop focus. */}
        <button
          type="button"
          className="viewer__button"
          aria-label="Previous photo"
          aria-disabled={index === 0}
          onClick={() => go(-1)}
        >
          <IconChevronLeft size={28} strokeWidth={2.4} />
        </button>
        <p className="viewer__count numeric" aria-live="polite">
          {index + 1} of {count}
        </p>
        <button
          type="button"
          className="viewer__button"
          aria-label="Next photo"
          aria-disabled={index === count - 1}
          onClick={() => go(1)}
        >
          <IconChevronRight size={28} strokeWidth={2.4} />
        </button>
      </div>
    </div>,
    document.body,
  )
}
```

Create `src/components/PhotoViewer.css`:

```css
/* The one near-black ground in the app (see --viewer-bg in tokens.css), in both themes. */
.viewer {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: flex;
  flex-direction: column;
  background: var(--viewer-bg);
  color: var(--viewer-ink);
  animation: fade-in var(--dur) var(--ease-out-quart);
}
.viewer :focus-visible {
  outline-color: var(--viewer-ink);
}
.viewer__bar {
  display: flex;
  align-items: center;
  padding: calc(var(--safe-top) + var(--space-1)) var(--space-2) var(--space-1);
}
/* The photo fills the space between the bars, letterboxed. No zoom, so the browser's gestures are off here. */
.viewer__stage {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  touch-action: none;
}
.viewer__image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  animation: fade-in var(--dur) var(--ease-out-quart);
}
.viewer__image--next {
  animation-name: viewer-from-next;
}
.viewer__image--previous {
  animation-name: viewer-from-previous;
}
@keyframes viewer-from-next {
  from {
    transform: translateX(32px);
    opacity: 0;
  }
}
@keyframes viewer-from-previous {
  from {
    transform: translateX(-32px);
    opacity: 0;
  }
}
.viewer__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-4) calc(var(--safe-bottom) + var(--space-3));
}
.viewer__button {
  display: grid;
  place-items: center;
  width: var(--tap);
  height: var(--tap);
  border-radius: 50%;
  color: var(--viewer-ink);
  transition:
    background-color var(--dur-fast),
    opacity var(--dur-fast);
}
.viewer__button:active:not([aria-disabled='true']) {
  background: var(--viewer-pressed);
}
.viewer__button[aria-disabled='true'] {
  opacity: 0.35;
  cursor: default;
}
.viewer__count {
  margin: 0;
  font-size: var(--text-subhead);
  font-weight: 600;
}

/* Reduce Motion: no slide, just the fade. */
@media (prefers-reduced-motion: reduce) {
  .viewer__image--next,
  .viewer__image--previous {
    animation-name: fade-in;
  }
}
```

- [ ] **Step 5: Open it from the Meetup page's thumbnails**

In `src/screens/MeetupScreen.tsx`, replace:

```tsx
import { useEffect, useId, useRef } from 'react'
```

with:

```tsx
import { useEffect, useId, useRef, useState } from 'react'
```

Replace:

```tsx
import { Page, type NavState } from '../components/Page'
```

with:

```tsx
import { Page, type NavState } from '../components/Page'
import { PhotoViewer } from '../components/PhotoViewer'
```

Replace:

```tsx
  const withId = useId()
  const leftRef = useRef(false)
```

with:

```tsx
  const withId = useId()
  const leftRef = useRef(false)
  // The photo open in the viewer, by position. Its thumbnail takes focus back when the viewer closes.
  const [viewing, setViewing] = useState<number | null>(null)
  const thumbnails = useRef<(HTMLButtonElement | null)[]>([])
```

Replace:

```tsx
  const fromHere: NavState = { backLabel: title, tab: (location.state as NavState | null)?.tab }
```

with:

```tsx
  const fromHere: NavState = { backLabel: title, tab: (location.state as NavState | null)?.tab }
  const describePhoto = (index: number) =>
    `Photo ${index + 1} of ${photos.length}, ${title}, ${formatDate(meetup.date, today)}`

  function closeViewer() {
    if (viewing !== null) thumbnails.current[viewing]?.focus()
    setViewing(null)
  }
```

Replace:

```tsx
              <li key={photo.id} className="photo-tile">
                <img
                  className="photo-tile__image"
                  src={photo.thumb}
                  alt={`Photo ${index + 1} of ${photos.length}`}
                />
              </li>
            ))}
          </ul>
        </Section>
      )}
```

with:

```tsx
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
```

Append to the end of `src/screens/MeetupScreen.css`:

```css

/* A thumbnail opens the photo viewer. */
.photo-tile__open {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: var(--radius-field);
  transition: opacity var(--dur-fast);
}
.photo-tile__open:active {
  opacity: 0.7;
}
```

- [ ] **Step 6: Run the tests to see them pass**

Run: `npx playwright test --project=iphone e2e/meetupPage.spec.ts`
Expected: `5 passed`.

- [ ] **Step 7: Run everything**

Run: `npm test`
Expected: `Test Files  47 passed (47)` and `Tests  510 passed (510)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `106 passed`.

- [ ] **Step 8: Commit**

```bash
git add src/components/PhotoViewer.tsx src/components/PhotoViewer.css src/styles/tokens.css src/screens/MeetupScreen.tsx src/screens/MeetupScreen.css e2e/meetupPage.spec.ts
git commit -F - <<'EOF'
feat: full-screen photo viewer with swipe, arrow keys and focus back on the thumbnail

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 8: History rows with activities and a thumbnail, DESIGN.md, screenshots and the spec's planning notes

**Files:**
- Modify: `src/db/meetups.ts` (`firstPhotoThumb`), `src/data/hooks.ts` (`useFirstPhotoThumb`), `src/screens/FriendDetailScreen.tsx` (subtitle, `HistoryThumb`), `src/screens/FriendDetailScreen.css`, `e2e/screenshots.spec.ts`, `DESIGN.md`, `docs/superpowers/specs/2026-10-03-meetup-memories-design.md` (append)
- Test: `src/db/meetups.test.ts`, `e2e/detail.spec.ts`
- Regenerate (not committed): `e2e/screenshots/*.png`

Each history row asks only for its own meetup's first photo, through the `[meetupId+order]` index, so a friend page with many meetups never reads their other photos, and `useMeetups` (which loads every meetup) never touches photos at all.

- [ ] **Step 1: Write the failing tests**

In `src/db/meetups.test.ts`, replace:

```ts
  deleteMeetup,
  photoCount,
```

with:

```ts
  deleteMeetup,
  firstPhotoThumb,
  photoCount,
```

Replace:

```ts
  it('counts every stored photo', async () => {
```

with:

```ts
  it('finds the first photo’s thumbnail, or none', async () => {
    const meetup = await addMeetup(base, { add: [newPhoto('a'), newPhoto('b')], removeIds: [], order: ['b', 'a'] })
    const other = await addMeetup(base)
    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBb')
    await updateMeetup(meetup.id, base, { add: [], removeIds: ['b'], order: ['a'] })
    expect(await firstPhotoThumb(meetup.id)).toBe('data:image/jpeg;base64,THUMBa')
    expect(await firstPhotoThumb(other.id)).toBeNull()
  })

  it('counts every stored photo', async () => {
```

In `e2e/detail.spec.ts`, replace:

```ts
import { addFriend, logMeetup } from './helpers.ts'
```

with:

```ts
import { addFriend, logMeetup, tinyPhoto } from './helpers.ts'
```

Replace:

```ts
test('logs from the friend page with them preselected', async ({ page }) => {
```

with:

```ts
test('history rows show activities and the first photo', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await addFriend(page, 'Sam')
  await logMeetup(page, ['Alex', 'Sam'], {
    type: 'Meal',
    activities: ['Karaoke', 'Walk'],
    note: 'Tacos',
    photos: [tinyPhoto('one.png'), tinyPhoto('two.png')],
  })
  await logMeetup(page, ['Alex'])
  await page.getByRole('link', { name: /Alex/ }).click()

  const history = page.getByRole('region', { name: 'History' })
  const meal = history.getByRole('link', { name: /Meal.*with Sam · Karaoke, Walk · Tacos/ })
  await expect(meal).toBeVisible()
  await expect(meal.locator('img.history-thumb')).toHaveAttribute('src', /^data:image\/jpeg/)
  await expect(history.getByRole('link', { name: /Coffee/ }).locator('img')).toHaveCount(0)
})

test('logs from the friend page with them preselected', async ({ page }) => {
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/db/meetups.test.ts`
Expected: FAIL, `firstPhotoThumb is not a function`.

Run: `npx playwright test --project=iphone e2e/detail.spec.ts`
Expected: FAIL, 1 failed: the Meal row's name has no activities and it has no thumbnail.

- [ ] **Step 3: Read a meetup's first thumbnail**

In `src/db/meetups.ts`, replace:

```ts
/** How many meetup photos are stored, across all meetups. */
```

with:

```ts
/**
 * The thumbnail of a meetup's first photo, or null when it has none. Reads just that one photo,
 * through the [meetupId+order] index, and keeps only its thumbnail.
 */
export async function firstPhotoThumb(meetupId: string): Promise<string | null> {
  const first = await db.meetupPhotos
    .where('[meetupId+order]')
    .between([meetupId, -Infinity], [meetupId, Infinity])
    .first()
  return first?.thumb ?? null
}

/** How many meetup photos are stored, across all meetups. */
```

In `src/data/hooks.ts`, replace:

```ts
import { photoCount } from '../db/meetups'
```

with:

```ts
import { firstPhotoThumb, photoCount } from '../db/meetups'
```

Replace:

```ts
/** How many meetup photos are stored. Counts without reading any image. */
```

with:

```ts
/** The thumbnail of a meetup's first photo, or null when it has none: a history row's picture. */
export function useFirstPhotoThumb(meetupId: string): string | null | undefined {
  return useLiveQuery(() => firstPhotoThumb(meetupId), [meetupId])
}

/** How many meetup photos are stored. Counts without reading any image. */
```

- [ ] **Step 4: Show activities and the thumbnail in history rows**

In `src/screens/FriendDetailScreen.tsx`, replace:

```tsx
import { useFriend, useFriends, useGroups, useMeetups, useMeetupTypes } from '../data/hooks'
```

with:

```tsx
import { useFirstPhotoThumb, useFriend, useFriends, useGroups, useMeetups, useMeetupTypes } from '../data/hooks'
```

Replace:

```tsx
export function FriendDetailScreen() {
```

with:

```tsx
/** A history row's picture: the meetup's first photo, when it has any. Each row reads only that thumbnail. */
function HistoryThumb({ meetupId }: { meetupId: string }) {
  const thumb = useFirstPhotoThumb(meetupId)
  return thumb ? <img className="history-thumb" src={thumb} alt="" /> : null
}

export function FriendDetailScreen() {
```

Replace:

```tsx
                      others.length > 0 ? `with ${formatNameList(others)}` : null,
                      meetup.note || null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    chevron
```

with:

```tsx
                      others.length > 0 ? `with ${formatNameList(others)}` : null,
                      meetup.activities.length > 0 ? meetup.activities.join(', ') : null,
                      meetup.note || null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    trailing={<HistoryThumb meetupId={meetup.id} />}
                    chevron
```

Append to the end of `src/screens/FriendDetailScreen.css`:

```css

/* The first photo of a meetup, at the end of its history row. */
.history-thumb {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--surface-2);
  object-fit: cover;
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run src/db/meetups.test.ts`
Expected: PASS.

Run: `npx playwright test --project=iphone e2e/detail.spec.ts`
Expected: `7 passed`.

- [ ] **Step 6: Capture the new screens**

In `e2e/screenshots.spec.ts`, replace:

```ts
  dayFromToday,
  goToTab,
```

with:

```ts
  dayFromToday,
  drawnPhoto,
  goToTab,
```

Replace:

```ts
  await logMeetup(page, ['Alex Rivera', 'Sam Chen'], { type: 'Meal', note: 'Ramen night', date: daysAgo(3) })
```

with:

```ts
  // The meetup page, the viewer and the sheet show this one: two activities and three photos.
  const photos = [
    await drawnPhoto(page, 'ramen.png', 1200, 900, 25),
    await drawnPhoto(page, 'karaoke.png', 900, 1200, 300),
    await drawnPhoto(page, 'street.png', 1200, 800, 200),
  ]
  await logMeetup(page, ['Alex Rivera', 'Sam Chen'], {
    type: 'Meal',
    note: 'Ramen night',
    date: daysAgo(3),
    activities: ['Karaoke', 'Board games'],
    photos,
  })
```

Replace:

```ts
  await page.screenshot({ path: `${DIR}/${prefix}-05-friend-full.png`, fullPage: true })
```

with:

```ts
  await page.screenshot({ path: `${DIR}/${prefix}-05-friend-full.png`, fullPage: true })

  await page.getByRole('region', { name: 'History' }).getByRole('link', { name: /Meal/ }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Meal' })).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-12-meetup.png`, fullPage: true })

  await page.getByRole('region', { name: 'Photos' }).getByRole('button').first().click()
  await expect(page.getByRole('dialog', { name: 'Photo 1 of 3' })).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-13-viewer.png` })
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const editSheet = page.getByRole('dialog', { name: 'Edit meetup' })
  await editSheet.getByRole('region', { name: 'Photos' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${DIR}/${prefix}-14-meetup-sheet.png` })
  await editSheet.getByRole('button', { name: 'Cancel' }).click()
  await expect(editSheet).toBeHidden()
```

(`captureAll` runs for light, dark and large text, so each gets the three new captures without new tests. The sheet closes without "Discard changes?" because nothing changed.)

- [ ] **Step 7: Regenerate the screenshots and look at them**

Run: `npm run screenshots`
Expected: `14 passed`.

Open these with the Read tool and check them:
- `e2e/screenshots/light-05-friend-full.png`, `dark-05-friend-full.png`, `large-text-05-friend-full.png`: the Meal row's subtitle reads "… · with Sam Chen · Karaoke, Board games · Ramen night" and ends with a 40px rounded-square thumbnail before the chevron; rows without photos have none.
- `*-12-meetup.png` (light, dark, large text): back says "Alex Rivera" (shortened with an ellipsis at large text), Edit on the right; the 🍽️ badge, "Meal", the date, "With" over Alex Rivera and Sam Chen chips, then Activities (read-only chips), Note (a Paper White box) and Photos (three square thumbnails).
- `*-13-viewer.png`: the near-black ground in all three, Close top left, the photo letterboxed between the bars, Previous dimmed, "1 of 3" and Next along the bottom.
- `*-14-meetup-sheet.png`: Karaoke and Board games selected (Peach), the other chips Linen, "+ New" last; three thumbnails with dark remove buttons and the dashed Add photos tile; at large text the tile's label wraps inside the tile.

If something is off, fix the CSS from Tasks 5 to 7, run `npm run e2e` again, and re-run `npm run screenshots`.

- [ ] **Step 8: Document the new pieces in DESIGN.md**

In `DESIGN.md`, replace:

```markdown
  scrim-dark: "oklch(8% 0.01 45 / 0.55)"
```

with:

```markdown
  scrim-dark: "oklch(8% 0.01 45 / 0.55)"
  # The photo viewer only, the same in both themes (src/styles/tokens.css)
  viewer-ground: "oklch(13% 0.006 55)"        # --viewer-bg
  viewer-ink: "oklch(96% 0.006 70)"           # --viewer-ink
```

Replace:

```markdown
  install-hint:
    backgroundColor: "{colors.peach-wash}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.group}"
    padding: "1rem"
---
```

with:

```markdown
  install-hint:
    backgroundColor: "{colors.peach-wash}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.group}"
    padding: "1rem"
  photo-add-tile:
    backgroundColor: "{colors.linen}"
    textColor: "{colors.warm-ink-secondary}"
    typography: "{typography.footnote}"
    rounded: "{rounded.field}"
  photo-viewer:
    backgroundColor: "{colors.viewer-ground}"
    textColor: "{colors.viewer-ink}"
---
```

Replace:

```markdown
- **Scrim** (`--scrim`, light `oklch(22% 0.02 45 / 0.32)`, dark `oklch(8% 0.01 45 / 0.55)`): dims the page behind sheets and action sheets.
```

with:

```markdown
- **Scrim** (`--scrim`, light `oklch(22% 0.02 45 / 0.32)`, dark `oklch(8% 0.01 45 / 0.55)`): dims the page behind sheets and action sheets.
- **Viewer Ground** (`--viewer-bg`, `oklch(13% 0.006 55)` in both themes) with **Viewer Ink** (`--viewer-ink`, `oklch(96% 0.006 70)`, about 18:1) and **Viewer Pressed** (`--viewer-pressed`, white at 14%): the photo viewer only. It is the one near-black ground in the app (see the One Dark Room Rule).
```

Replace:

```markdown
**The No Alarm Rule.** No red, orange, or warning colors for "haven't seen in a while". Time since is plain Warm Ink Secondary text. Danger Red is reserved for destructive actions only.
```

with:

```markdown
**The No Alarm Rule.** No red, orange, or warning colors for "haven't seen in a while". Time since is plain Warm Ink Secondary text. Danger Red is reserved for destructive actions only.

**The One Dark Room Rule.** Only the photo viewer sits on the near-black Viewer Ground, in both themes, so photos look true and nothing competes with them. Everything else, dark mode included, stays on warm paper.
```

Replace:

```markdown
- **Title** (rounded, 700, 1.5rem, line-height 1.2): the friend's name in the detail hero and the Stats year. The Stats summary sentence ("4 meetups with 4 friends.") uses it at 600 with `text-wrap: balance`.
```

with:

```markdown
- **Title** (rounded, 700, 1.5rem, line-height 1.2): the friend's name in the detail hero, the meetup type on the Meetup page, and the Stats year. The Stats summary sentence ("4 meetups with 4 friends.") uses it at 600 with `text-wrap: balance`.
```

Replace:

```markdown
The only fixed-pixel exceptions are avatars, icons (except the Log pill's plus, which is 1.15em),
```

with:

```markdown
The only fixed-pixel exceptions are avatars, the Meetup page's emoji badge (96px with a 48px emoji), the history thumbnail (40px) and the remove button's glyph on photos (24px), icons (except the Log pill's plus, which is 1.15em),
```

Replace:

```markdown
- **Wrapping (`.chip--wrap`):** for user-entered items, such as a friend's likes and dislikes.
```

with:

```markdown
- **Wrapping (`.chip--wrap`):** for user-entered items, such as a friend's likes and dislikes and a meetup's activities.
```

Replace:

```markdown
- **Layouts:** a horizontally scrolling row that bleeds to the screen edges for filters and meetup types; a wrapping cluster for group pickers, dates, and a friend's likes and dislikes.
```

with:

```markdown
- **Layouts:** a horizontally scrolling row that bleeds to the screen edges for filters and meetup types; a wrapping cluster for group pickers, dates, a friend's likes and dislikes, and a meetup's activities.
```

Replace:

```markdown
### Action sheets and confirms
```

with:

```markdown
### Meetup sheet: Activities and Photos
Two sections between **When** and **Note** in the Log and Edit meetup sheet. Both hold their changes until Save, so Cancel (after "Discard changes?") throws them away.
- **Activities:** a wrapping cluster of chips (the wrapping variant): activities used before, most used first, then the starters (Board games, Karaoke, Movie, Walk, Concert, Shopping, Cooking, Sports, Beach, Museum). Twelve show at first and a "More" chip shows the rest; an activity already on the meetup always shows. Selected chips are Peach, announced with `aria-pressed`, and a chip tapped off stays where it is until the sheet closes. The cluster ends with "+ New", which puts a Paper White field and a secondary **Add** button on their own line under the chips, like the friend sheet's New group; adding selects it. "A meetup can have up to 20 activities." is a Footnote Warm Ink Secondary hint, never red.
- **Photos:** a 3-across grid of square thumbnails (12px corners, 8px gaps), shared with the Meetup page. Each has a remove button ("Remove photo 2"): a 44px hit area in the corner around a 24px Warm Ink circle with a Warm Paper cross and a 1.5px Warm Paper ring that keeps it visible on any photo. The grid ends with the **Add photos** tile: Linen with a 1.5px dashed Warm Ink Tertiary outline (an empty slot, not a container), a 26px camera-plus icon, and a Footnote 600 Warm Ink Secondary label that reads "Adding 2 of 5…" while photos are resized. Hints under the grid, never red: "A meetup can have up to 20 photos." and "1 photo couldn't be added.".

### Action sheets and confirms
```

Replace:

```markdown
- **Tab bar:** fixed, Paper White, 50px plus the safe area, hairline on top. Three tabs (Friends, Stats, Settings) with 26px line icons over Caption labels: Warm Ink Tertiary at rest, Terracotta Ink with a heavier stroke and 600 label when current.
```

with:

```markdown
- **Tab bar:** fixed, Paper White, 50px plus the safe area, hairline on top. Three tabs (Friends, Stats, Settings) with 26px line icons over Caption labels: Warm Ink Tertiary at rest, Terracotta Ink with a heavier stroke and 600 label when current. A friend's page and a Meetup page belong to Friends, unless they were opened from Stats, which then stays current.
```

Replace:

```markdown
An empty list shows only the "+ Add" chip.

### Birthdays soon
```

with:

```markdown
An empty list shows only the "+ Add" chip.
- **History:** rows grouped by month, each with the type's emoji badge, the type (and "Upcoming"), and a subtitle of the date, "with" the others, the activities and the note. A meetup with photos ends its row with its first photo, a 40px thumbnail with 8px corners, before the chevron. Tapping a row opens the Meetup page.

### Meetup page
The memory view of one meetup, pushed like a friend's page. Nav bar: back ("Back", or the friend's name when opened from their history) and **Edit**, which opens the Edit meetup sheet.
- **Hero:** centered: the type's emoji in a 96px Linen circle (a 48px emoji), the type name in Title, the date in Warm Ink Secondary with the "Upcoming" badge for a future date, then a Footnote "With" label over the friends as person chips (a 28px avatar and the name in a Paper White pill) that open the friend.
- **Then, each hidden when empty:** **Activities** as read-only chips (the chip look without a press state), **Note** as Body text in a Paper White box with 14px corners, and **Photos** in the 3-across grid; a thumbnail opens the photo viewer.
- When the meetup is deleted from the sheet, the page goes back.

### Photo viewer
Full screen over everything, on the Viewer Ground with Viewer Ink controls: a Close button top left; the photo fit between the bars, letterboxed, with no zoom; and Previous, "2 of 5" (rounded, tabular) and Next along the bottom, all 44px. A sideways swipe or the arrow keys change photos: the next one slides 32px and fades in over 220ms (with Reduce Motion it only fades). Previous and Next dim to 35% at the ends. Escape closes it. It is a modal dialog named "Photo 2 of 5", the image's alt names the photo, the type and the date ("Photo 2 of 5, Coffee, Sat, Sep 12"), focus stays inside, and closing puts focus back on the photo's thumbnail.

### Birthdays soon
```

Replace:

```markdown
- **Don't** use colored side-stripe borders on rows or cards, or any border thicker than a 0.5px hairline.
```

with:

```markdown
- **Don't** use colored side-stripe borders on rows or cards, or any border thicker than a 0.5px hairline. (Two small exceptions: the Add photos tile's 1.5px dashed outline, which marks an empty slot, and the 1.5px Warm Paper ring that keeps a photo's remove button visible.)
```

- [ ] **Step 9: Record the planning decisions in the spec**

Append to the end of `docs/superpowers/specs/2026-10-03-meetup-memories-design.md`:

```markdown

## Decisions made while planning

Recorded in [the plan](../plans/2026-10-03-meetup-memories.md):

- **Index.** The photos table is `meetupPhotos: 'id, meetupId, [meetupId+order]'`. The compound index lets a history row read just the first photo's record (IndexedDB returns whole records, so the full image is read once and dropped; only the thumbnail is kept). The v3 upgrade adds only this table; meetups get `activities` from the reading hook.
- **Activity messages.** "Keep each activity under 60 characters." and "A meetup can have up to 20 activities.". The "+ New" field stops at 60 characters; a 21st pick shows the second message under the chips.
- **"+ New"** adds one activity (commas are kept). Text matching a chip selects that chip's spelling. Enter or Add on an empty field, and Escape, close it. Text left in the open field is saved with Save and counts as a change.
- **Suggestions** merge spellings that differ only in case, shown as the latest meetup spells them.
- **Chips shown:** the first 12 suggestions, then this meetup's other activities, then new ones. A chip tapped off stays in place until the sheet closes. "More" moves focus to the first chip it revealed.
- **Change set.** The sheet chooses new photos' ids, so `order` lists new and kept photos together; photos left out keep their order after the listed ones; another meetup's ids in `removeIds` are ignored. Over 20, a duplicate id or an invalid image throws inside the transaction, so the meetup write rolls back too ("A photo couldn't be saved." for an invalid image).
- **Resizing.** One decode, the full image drawn first and the thumbnail drawn from it; canvases are released right after encoding. Results over the backup limits count as "couldn't be added". Friend photos use the same decode.
- **Adding.** One file at a time with "Adding 2 of 5…"; Save waits; closing the sheet stops the rest; with 20 photos already, the tile shows the limit message instead of opening the picker; both messages can show together; "Added 2 photos." is announced; after a remove, focus goes to the next remove button.
- **Storage.** After a save that adds photos, `navigator.storage.persist()` is asked unless the data is already kept; failures are ignored.
- **Backups.** Any problem with a version 4 photo, including an unknown `meetupId` or a 21st photo for a meetup, gives `Photo N is invalid.`. Sizes are data URL lengths in characters. Duplicate photo ids and a missing `meetupPhotos` list have their own messages. Version 4 friends keep birthdays.
- **Export.** The backup is stringified once. Settings loads photos in the background so the share sheet still opens from the tap; Export reads them first if they haven't loaded.
- **Footer.** "Last backup: today. Includes 12 photos." or "Never backed up. Includes 1 photo.", unchanged with no photos.
- **Meetup page.** It belongs to the Friends tab (or keeps Stats when the friend page came from there). Friend chips open the friend with the meetup type as their back label. There is no "+ Log meetup" pill. An unknown or deleted meetup goes back one step (or to Friends when opened directly).
- **Viewer.** The dialog is named "Photo 2 of 5", the counter is a polite live region, the image alt is "Photo 2 of 5, Coffee, Sat, Sep 12" (type and date), and grid thumbnails are "Photo 2 of 5". No wrap-around; Previous and Next are `aria-disabled` at the ends. Keys are heard on the whole document, since Safari doesn't focus tapped buttons. Focus returns to the thumbnail of the photo showing at close. The iOS status bar keeps the app's theme color.
- **History rows.** Activities come between "with …" and the note; the thumbnail is decorative.
- **Shared styles.** `.person-chip`, `.upcoming-badge` and the photo grid live in `base.css`.
```

- [ ] **Step 10: Run every check**

Run: `npm test`
Expected: `Test Files  47 passed (47)` and `Tests  511 passed (511)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `107 passed`.

Run: `git status --short`
Expected: only the files listed for this task. (The PNGs are ignored by git.)

- [ ] **Step 11: Commit**

```bash
git add src/db/meetups.ts src/db/meetups.test.ts src/data/hooks.ts src/screens/FriendDetailScreen.tsx src/screens/FriendDetailScreen.css e2e/detail.spec.ts e2e/screenshots.spec.ts DESIGN.md docs/superpowers/specs/2026-10-03-meetup-memories-design.md
git commit -F - <<'EOF'
feat: history rows show activities and the first photo; screenshots, DESIGN.md and planning notes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Spec coverage

| Spec requirement | Where |
| --- | --- |
| Activities are selectable tags, separate from the meetup type; several per meetup | Tasks 1 and 5 |
| `Meetup.activities`: order picked, cleaned like likes (trimmed, single-spaced, ≤ 60 characters, unique ignoring case), at most 20 | Task 1 (`types.ts`, `activitiesProblem`, `clean` in `meetups.ts`) |
| `MeetupPhoto { id, meetupId, order, full, thumb, width, height, createdAt }` | Task 1 (`types.ts`) |
| `meetupPhotos` table in Dexie `version(3)`, never inside meetups; the upgrade only adds the table | Task 1 (`db.ts`; plus the `[meetupId+order]` index, decision 1) |
| Reading hook: meetups get `activities ??= []` | Task 1 |
| `addMeetup` and `updateMeetup` take cleaned activities and a change set `{ add, removeIds, order }` in one transaction | Tasks 1 and 2 |
| `deleteMeetup` returns the meetup and its photos; `restoreMeetup` puts both back | Task 2 |
| `deleteFriend` deletes the photos of meetups it deletes | Task 2 |
| `readAllData` and `replaceAllData` include photos | Task 2 |
| `activitySuggestions(meetups)`: used before by count then name, then unused starters (Board games, Karaoke, Movie, Walk, Concert, Shopping, Cooking, Sports, Beach, Museum) | Task 1 |
| Photos resized on the phone: full 1600px at 0.8, thumbnail 320px at 0.75 | Task 3 (`processPhoto`) |
| Backups version 4: meetups' `activities`, top-level `meetupPhotos` | Task 4 |
| v1 to v3 import with `activities: []` and no photos | Task 4 |
| Photo validation (JPEG or PNG data URLs, `full` ≤ 4 MB, `thumb` ≤ 512 KB, `meetupId` exists, ≤ 20 per meetup); `Photo N is invalid.`; `Meetup N has an invalid "activities" list.` | Task 4 |
| Backup footer "Includes 12 photos." | Task 4 (`describeBackup`) |
| Sheet: Activities after When, before Note; 12 at a time; selected look with `aria-pressed`; a meetup's own activity always shows; "More"; "+ New" with an inline field and Add that selects it | Task 5 (`MeetupActivities`) |
| Sheet: Photos grid 3 across; dashed Linen Add tile with a camera-plus icon; 44px "Remove photo 2" buttons | Task 5 (`MeetupPhotos`, `IconCameraPlus`) |
| `<input type="file" accept="image/*" multiple>` | Task 5 |
| One at a time with "Adding 2 of 5…"; past 20 "A meetup can have up to 20 photos."; unreadable "1 photo couldn't be added." | Tasks 3 and 5 |
| Held until Save, Cancel discards; dirty tracking includes activities and photos | Task 5 |
| `navigator.storage.persist()` best effort when photos are first saved | Task 5 (`askToKeepData`) |
| Meetup page `/meetups/:id`: back ("Back" or the friend's name) and Edit | Task 6 |
| Hero: emoji badge, type title, `formatDate` date, "Upcoming", "With" avatar chips that open the friend | Task 6 |
| Activities (read-only chips), Note, Photos grid, each hidden when empty | Task 6 |
| Deleted meetup: go back | Task 6 |
| Viewer: full-screen dark dialog, photo fit to screen, 44px Close, "2 of 5", previous and next, swipe, arrow keys, Escape | Task 7 |
| Viewer: focus trapped and returned to the thumbnail; no zoom; Reduce Motion fades instead of sliding | Task 7 |
| History rows open the Meetup page | Task 6 |
| History subtitle: date, "with …", activities, note | Task 8 |
| History thumbnail: 40px rounded square of the first photo, a per-row live query reading only that photo | Task 8 (`firstPhotoThumb`, `useFirstPhotoThumb`) |
| DESIGN.md: Activities chips, Photos grid and Add tile, Meetup page, viewer (the dark ground exception), history thumbnail | Task 8 |
| Unit tests: `activitySuggestions`; activity cleaning on add and update | Task 1 |
| Unit tests: change set add, remove, reorder and rollback; delete and restore with photos; the cascade | Task 2 |
| Unit test: Dexie v3 upgrade from a real v2 database (activities, the photos table, nothing else changes) | Task 1 |
| Unit tests: backups v4 round trip with photos; v1 to v3 import; invalid photo or activities refused; the footer text | Task 4 |
| E2E: log with two activities (one new) and two photos | Task 5 |
| E2E: the Meetup page shows them | Task 6 |
| E2E: the viewer opens, goes next, closes with focus back on the thumbnail | Task 7 |
| E2E: remove a photo in Edit; Cancel discards photo changes; delete plus Undo restores the photos; backup round trip keeps photos and activities | Task 5 (through the Meetup page from Task 6 on) |
| E2E: the history row shows activities and a thumbnail | Task 8 |
| Screenshots: the sheet with activities and photos, the Meetup page and the viewer, in light, dark and large text | Task 8 |
