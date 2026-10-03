# Likes and Dislikes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each friend a Likes list and a Dislikes list of short items, added inline on the friend's page, kept in backups, and matched (likes only) by the Friends search.

**Architecture:** One pure rules module (`src/lib/preferences.ts`: cleaning, splitting, case-insensitive matching, the 60-character and 50-item limits) is shared by the data layer and the backup parser. `Friend` gains `likes` and `dislikes`; Dexie `version(2)` fills them in on existing friends, and four transactional data functions (`src/db/preferences.ts`) add, remove, restore (Undo) and move items. The friend page renders a `FriendPreferences` component that owns the single open add field; the Friends search uses a small pure matcher (`src/lib/friendSearch.ts`).

**Tech Stack:** Vite 8, React 19, TypeScript 6 (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`), react-router 7 (HashRouter), Dexie 4 with dexie-react-hooks, Vitest 5 with fake-indexeddb (TZ America/Los_Angeles), Playwright WebKit (iPhone 13, port 4174).

---

**Spec:** [docs/superpowers/specs/2026-10-03-likes-dislikes-design.md](../specs/2026-10-03-likes-dislikes-design.md), the source of truth. Design context: [DESIGN.md](../../../DESIGN.md) (sections 5 and 6), [PRODUCT.md](../../../PRODUCT.md).

## Ground rules for every task

- Run every command from the project root in Git Bash: `/c/Users/luald/OneDrive/Desktop/Friend tracker`. The branch `feature/likes-dislikes` is already checked out.
- TypeScript: type-only imports use `import type` or an inline `type` specifier; no enums, namespaces or constructor parameter properties; no unused locals or parameters. Test files under `src/` and everything in `e2e/` are type-checked by `npm run build` too.
- Import paths are extensionless inside `src/`. Inside `e2e/`, local files are imported with `.ts` (`./helpers.ts`).
- Copy (UI text, comments, docs) never uses em dashes. Use commas, colons, periods or parentheses.
- Never run `npm run dev`, `npm run preview`, `vite preview` or wrangler yourself. `npm run e2e` and `npm run screenshots` start and stop their own preview server.
- Commands:
  - Unit tests: `npm test` (one file: `npx vitest run <path>`)
  - Type check and production build: `npm run build` (quick type check only: `npx tsc -b`)
  - End-to-end tests: `npm run e2e` (one file: `npx playwright test --project=iphone <path>`)
  - Screenshots: `npm run screenshots`
- Baseline before Task 1: `npm test` shows `Test Files  29 passed (29)` and `Tests  242 passed (242)`; `npm run e2e` shows `67 passed`. Each task states the new totals.
- Commit after each task with the exact `git add` paths and message given. Every commit message ends with a blank line and then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Decisions made while planning

The spec leaves these open. Task 5 records them at the end of the spec.

1. **Repeats inside one entry.** "sushi, Sushi" adds one item (the first spelling). Only items already in the list before the entry count as `skipped`.
2. **After Enter or Add.** When the save works, the field is cleared, even when every item was already there (then "Already in Likes." shows). When the save is refused ("This list is full.", "Keep each one under 60 characters."), the text stays in the field so it can be fixed.
3. **Enter on an empty field** closes it, like the keyboard's Done key. The Add button with an empty field does nothing.
4. **Saving a field that has closed** (on blur, or when the other list's field opens): a refused save shows its message as a plain toast, since there is no field left to show it under. Items that were already there are skipped quietly.
5. **Taps inside the lists keep the open field focused.** While a field is open, `mousedown` on the chip clusters is cancelled, so tapping Add, the other list's "+ Add", or an item chip doesn't blur the field first. Without this, the blur would save and close the field and move everything under the finger before the tap lands (the Add button would vanish mid-tap). Add saves and keeps the field open; the other list's "+ Add" saves this field and switches; an item's action sheet takes focus, so the field blurs, saves and closes behind the sheet.
6. **Failure toasts.** A move or remove that fails with something other than a `ValidationError` shows "Couldn't save. Please try again." A failed Undo shows the existing "Couldn't undo. Please try again." (the meetup sheet's copy). A `ValidationError` from move, restore, or a closed-field save shows its own message. All of these use the plain tone, like every non-happy toast in the app.
7. **Backups.** List limits are checked after cleaning (empties and repeats dropped first). Backup items are not split on commas. An item in both lists of a hand-edited file stays in Likes and is dropped from Dislikes.
8. **Stale actions.** Removing an item that is already gone does nothing (no toast). Moving an item the other list already has just removes it from this list.
9. **`updateFriend`** now writes the four sheet fields by name. This is required, not just tidy: once `Friend` has array fields, Dexie's `UpdateSpec` type no longer accepts the `FriendInput` interface directly.

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/lib/preferences.ts` | Create | Item rules: `PreferenceKind`, limits, `otherKind`, `cleanItem`, `indexOfItem`, `cleanItems`, `splitItems` |
| `src/lib/preferences.test.ts` | Create | Unit tests for the rules |
| `src/types.ts` | Modify | `Friend.likes` and `Friend.dislikes` |
| `src/db/db.ts` | Modify | `version(2)` upgrade that adds empty lists |
| `src/db/db.test.ts` | Modify | v1 to v2 upgrade test on a real version-1 database |
| `src/db/friends.ts` | Modify | `addFriend` starts with empty lists; `updateFriend` writes only the sheet's fields |
| `src/db/friends.test.ts` | Modify | Tests for both |
| `src/db/preferences.ts` | Create | `addPreferences`, `removePreference`, `restorePreference`, `movePreference` |
| `src/db/preferences.test.ts` | Create | Unit tests for the data functions |
| `src/test/fixtures.ts` | Modify | `friend()` fixture gets empty lists |
| `src/backup/format.ts` | Modify | Task 1: v1 friends get empty lists. Task 2: export v2, parse v1 and v2 |
| `src/backup/format.test.ts` | Modify | v2 export, v1 and v2 parsing, refusals |
| `src/backup/storage.test.ts` | Modify | Round trip keeps the lists |
| `src/components/Chip.tsx` / `Chip.css` | Modify | `wrap` prop and `.chip--wrap` modifier |
| `src/styles/base.css` | Modify | `.field-hint`, the neutral Footnote note under a field |
| `src/screens/FriendPreferences.tsx` / `.css` | Create | The friend page's Likes and Dislikes sections, the inline add field, the item action sheet and the Undo toast |
| `src/screens/FriendDetailScreen.tsx` | Modify | Renders `FriendPreferences` after the notes |
| `src/sheets/FriendSheet.tsx` | Modify | Notes placeholder "Birthday, partner's name" |
| `DESIGN.md` | Modify | Chips: wrapping variant. Friend detail column: Likes and Dislikes |
| `e2e/helpers.ts` | Modify | `addToList(page, list, text)` |
| `e2e/preferences.spec.ts` | Create | E2E for adding, moving, removing with Undo, persistence, blur and Escape, backups, search |
| `src/lib/friendSearch.ts` | Create | `matchFriend` (name or likes) and `matchSubtitle` ("Likes Hiking") |
| `src/lib/friendSearch.test.ts` | Create | Unit tests for the matcher |
| `src/screens/FriendsScreen.tsx` | Modify | Uses the matcher and adds the subtitle part |
| `e2e/screenshots.spec.ts` | Modify | Seeds Alex Rivera's lists so the friend page screenshots show them |
| `e2e/screenshots/*.png` | Regenerate | Light, dark and large-text friend page with both lists |
| `docs/superpowers/specs/2026-10-03-likes-dislikes-design.md` | Modify | Appends the planning decisions |

---

### Task 1: Item rules, the `Friend` lists, the database upgrade and the data functions

**Files:**
- Create: `src/lib/preferences.ts`, `src/db/preferences.ts`
- Modify: `src/types.ts:3-11`, `src/db/db.ts:20-26`, `src/db/friends.ts:19-31`, `src/test/fixtures.ts:5-7`, `src/backup/format.ts:95-108`
- Test: `src/lib/preferences.test.ts` (create), `src/db/preferences.test.ts` (create), `src/db/db.test.ts:1-6`, `src/db/friends.test.ts:25-36`

- [ ] **Step 1: Write the failing tests for the item rules**

Create `src/lib/preferences.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { cleanItem, cleanItems, indexOfItem, MAX_ITEM_LENGTH, MAX_ITEMS, otherKind, splitItems } from './preferences'

describe('limits', () => {
  it('allows 60 characters per item and 50 items per list', () => {
    expect(MAX_ITEM_LENGTH).toBe(60)
    expect(MAX_ITEMS).toBe(50)
  })
})

describe('otherKind', () => {
  it('pairs likes with dislikes', () => {
    expect(otherKind('likes')).toBe('dislikes')
    expect(otherKind('dislikes')).toBe('likes')
  })
})

describe('cleanItem', () => {
  it('trims and turns runs of whitespace into one space', () => {
    expect(cleanItem('  Board   games ')).toBe('Board games')
    expect(cleanItem('Early\n\tmornings')).toBe('Early mornings')
    expect(cleanItem('   ')).toBe('')
  })
})

describe('indexOfItem', () => {
  it('finds an item ignoring case and extra spaces', () => {
    expect(indexOfItem(['Sushi', 'Board games'], 'board GAMES')).toBe(1)
    expect(indexOfItem(['Sushi'], ' sushi ')).toBe(0)
    expect(indexOfItem(['Sushi'], 'Ramen')).toBe(-1)
  })
})

describe('cleanItems', () => {
  it('drops empty items and repeats, keeping the first spelling', () => {
    expect(cleanItems(['Sushi', ' ', 'SUSHI', ' Hiking ', 'sushi'])).toEqual(['Sushi', 'Hiking'])
  })
})

describe('splitItems', () => {
  it('splits on commas and newlines', () => {
    expect(splitItems('sushi, hiking')).toEqual(['sushi', 'hiking'])
    expect(splitItems('Sushi\nBoard games\r\nHiking')).toEqual(['Sushi', 'Board games', 'Hiking'])
  })

  it('skips empty pieces and repeats within the text', () => {
    expect(splitItems(' , sushi,, Sushi ,')).toEqual(['sushi'])
    expect(splitItems('')).toEqual([])
  })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/lib/preferences.test.ts`
Expected: FAIL, `Test Files  1 failed (1)`, with `Error: Cannot find module './preferences' imported from .../src/lib/preferences.test.ts`.

- [ ] **Step 3: Write the rules module**

Create `src/lib/preferences.ts`:

```ts
// Rules for a friend's likes and dislikes, shared by the data layer and the backup parser.

export type PreferenceKind = 'likes' | 'dislikes'

/** The longest an item can be, after cleaning. */
export const MAX_ITEM_LENGTH = 60
/** The most items one list can hold. */
export const MAX_ITEMS = 50

export function otherKind(kind: PreferenceKind): PreferenceKind {
  return kind === 'likes' ? 'dislikes' : 'likes'
}

/** Trims an item and turns runs of whitespace (newlines too) into one space. */
export function cleanItem(item: string): string {
  return item.replace(/\s+/g, ' ').trim()
}

/** Items are compared ignoring case. */
function itemKey(item: string): string {
  return cleanItem(item).toLocaleLowerCase()
}

/** Where `item` is in `list` (ignoring case), or -1. */
export function indexOfItem(list: readonly string[], item: string): number {
  const key = itemKey(item)
  return list.findIndex((existing) => itemKey(existing) === key)
}

/** Cleans every item, then drops empty ones and repeats. The first spelling wins. */
export function cleanItems(items: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of items) {
    const item = cleanItem(raw)
    const key = itemKey(item)
    if (item === '' || seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

/** Splits typed text on commas and newlines: "sushi, hiking" is two items. */
export function splitItems(text: string): string[] {
  return cleanItems(text.split(/[,\r\n]/))
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `npx vitest run src/lib/preferences.test.ts`
Expected: PASS, `Tests  7 passed (7)`.

- [ ] **Step 5: Write the failing tests for new friends and the database upgrade**

In `src/db/friends.test.ts`, replace:

```ts
  it('rejects an empty name', async () => {
    await expect(addFriend(input({ name: '   ' }))).rejects.toThrow(ValidationError)
  })
})

describe('updateFriend', () => {
  it('changes the stored fields', async () => {
    const friend = await addFriend(input())
    await updateFriend(friend.id, input({ name: 'Alexandra', notes: 'Moved to Austin' }))
    expect(await db.friends.get(friend.id)).toMatchObject({ name: 'Alexandra', notes: 'Moved to Austin' })
  })
})
```

with:

```ts
  it('rejects an empty name', async () => {
    await expect(addFriend(input({ name: '   ' }))).rejects.toThrow(ValidationError)
  })

  it('starts with empty likes and dislikes', async () => {
    const friend = await addFriend(input())
    expect(friend).toMatchObject({ likes: [], dislikes: [] })
  })
})

describe('updateFriend', () => {
  it('changes the stored fields', async () => {
    const friend = await addFriend(input())
    await updateFriend(friend.id, input({ name: 'Alexandra', notes: 'Moved to Austin' }))
    expect(await db.friends.get(friend.id)).toMatchObject({ name: 'Alexandra', notes: 'Moved to Austin' })
  })

  it('leaves likes and dislikes alone', async () => {
    const friend = await addFriend(input())
    await db.friends.update(friend.id, { likes: ['Sushi'], dislikes: ['Cilantro'] })
    await updateFriend(friend.id, input({ name: 'Alexandra' }))
    expect(await db.friends.get(friend.id)).toMatchObject({ likes: ['Sushi'], dislikes: ['Cilantro'] })
  })
})
```

In `src/db/db.test.ts`, replace the top of the file:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { DEFAULT_MEETUP_TYPES } from './defaults'
import { getSetting, setSetting } from './settings'

beforeEach(resetDatabase)
```

with:

```ts
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { DEFAULT_MEETUP_TYPES } from './defaults'
import { getSetting, setSetting } from './settings'

beforeEach(resetDatabase)

describe('upgrade from version 1', () => {
  it('gives existing friends empty likes and dislikes and changes nothing else', async () => {
    const v1Friend = {
      id: 'f1',
      name: 'Alex',
      groupId: 'g1',
      photo: null,
      notes: 'Moved to Austin',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    // Build the database as version 1 of the app left it, under the app's own name.
    // (The next test's resetDatabase deletes it and reopens the app database fresh.)
    db.close()
    await Dexie.delete('friend-tracker')
    const v1 = new Dexie('friend-tracker')
    v1.version(1).stores({
      friends: 'id, groupId',
      groups: 'id',
      meetupTypes: 'id, order',
      meetups: 'id, date, typeId, *friendIds',
      settings: 'key',
    })
    try {
      await v1.table('friends').add(v1Friend)
    } finally {
      v1.close()
    }

    await db.open()

    expect(await db.friends.get('f1')).toEqual({ ...v1Friend, likes: [], dislikes: [] })
    expect(db.verno).toBe(2)
  })
})
```

Why this doesn't leak: Vitest runs each test file in its own worker, so only `db.test.ts` shares this fake-indexeddb. `db.close()` turns off Dexie's auto-open, and the test reopens the app database itself with `db.open()`. The `try`/`finally` closes the version-1 connection even if `add` fails, and the next test's `resetDatabase` (`db.delete()` then `db.open()`) works whether the app database was left open or closed, then re-runs the seed.

- [ ] **Step 6: Run them and see them fail**

Run: `npx vitest run src/db/friends.test.ts src/db/db.test.ts`
Expected: FAIL, `Tests  2 failed | 10 passed (12)`. The failures are `starts with empty likes and dislikes` and `gives existing friends empty likes and dislikes and changes nothing else` (`expected { id: 'f1', name: 'Alex', …(4) } to deeply equal { id: 'f1', name: 'Alex', …(6) }`).

- [ ] **Step 7: Add the lists to `Friend`, the database and every place that builds a friend**

In `src/types.ts`, replace:

```ts
  notes: string
  createdAt: string
}

export interface Group {
```

with:

```ts
  notes: string
  /** Short items in the order added, oldest first. See src/lib/preferences.ts for the rules. */
  likes: string[]
  dislikes: string[]
  createdAt: string
}

export interface Group {
```

In `src/db/db.ts`, replace:

```ts
db.version(1).stores({
  friends: 'id, groupId',
  groups: 'id',
  meetupTypes: 'id, order',
  meetups: 'id, date, typeId, *friendIds',
  settings: 'key',
})
```

with:

```ts
db.version(1).stores({
  friends: 'id, groupId',
  groups: 'id',
  meetupTypes: 'id, order',
  meetups: 'id, date, typeId, *friendIds',
  settings: 'key',
})

// Version 2 gives every friend likes and dislikes lists. Same stores, no new indexes.
db.version(2)
  .stores({
    friends: 'id, groupId',
    groups: 'id',
    meetupTypes: 'id, order',
    meetups: 'id, date, typeId, *friendIds',
    settings: 'key',
  })
  .upgrade((tx) =>
    tx
      .table('friends')
      .toCollection()
      .modify((friend: Partial<Friend>) => {
        friend.likes ??= []
        friend.dislikes ??= []
      }),
  )
```

(`Friend` is already imported at the top of `db.ts` with `import type { Friend, Group, Meetup, MeetupType } from '../types'`.)

In `src/db/friends.ts`, replace:

```ts
export async function addFriend(input: FriendInput): Promise<Friend> {
  const friend: Friend = { id: newId(), ...clean(input), createdAt: new Date().toISOString() }
  await db.friends.add(friend)
  return friend
}

export async function updateFriend(id: string, input: FriendInput): Promise<void> {
  const cleaned = clean(input)
  await db.transaction('rw', db.friends, async () => {
    if (!(await db.friends.get(id))) throw new ValidationError('This friend no longer exists.')
    await db.friends.update(id, cleaned)
  })
}
```

with:

```ts
export async function addFriend(input: FriendInput): Promise<Friend> {
  const friend: Friend = { id: newId(), ...clean(input), likes: [], dislikes: [], createdAt: new Date().toISOString() }
  await db.friends.add(friend)
  return friend
}

/** Updates the fields the friend sheet edits. Likes and dislikes are left alone. */
export async function updateFriend(id: string, input: FriendInput): Promise<void> {
  const { name, groupId, photo, notes } = clean(input)
  await db.transaction('rw', db.friends, async () => {
    if (!(await db.friends.get(id))) throw new ValidationError('This friend no longer exists.')
    await db.friends.update(id, { name, groupId, photo, notes })
  })
}
```

(Naming the four fields is required: with array fields on `Friend`, Dexie's `UpdateSpec<Friend>` has index signatures that the `FriendInput` interface doesn't satisfy, so `update(id, cleaned)` stops type-checking.)

In `src/test/fixtures.ts`, replace:

```ts
  return { id, name, groupId, photo: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z' }
```

with:

```ts
  return { id, name, groupId, photo: null, notes: '', likes: [], dislikes: [], createdAt: '2026-01-01T00:00:00.000Z' }
```

In `src/backup/format.ts` (the parser still reads version 1 only; Task 2 adds version 2), replace:

```ts
      notes: text(r, 'notes', where),
      createdAt: text(r, 'createdAt', where),
    }
  })

  const meetups: Meetup[] = list(raw, 'meetups').map((value, i) => {
```

with:

```ts
      notes: text(r, 'notes', where),
      // Version 1 backups were made before likes and dislikes existed.
      likes: [],
      dislikes: [],
      createdAt: text(r, 'createdAt', where),
    }
  })

  const meetups: Meetup[] = list(raw, 'meetups').map((value, i) => {
```

Every other `Friend` in the code comes from the database, from `addFriend`, from the `friend()` fixture (directly or spread, as in `format.test.ts`), or from the backup parser, so nothing else needs the new fields. (`grep -rn "notes: ''" src e2e` lists only `FriendInput` objects besides the fixture; `FriendInput` doesn't change.)

- [ ] **Step 8: Run the tests and the type check and see them pass**

Run: `npx vitest run src/db/friends.test.ts src/db/db.test.ts`
Expected: PASS, `Tests  12 passed (12)`.

Run: `npx tsc -b`
Expected: no output, exit code 0.

- [ ] **Step 9: Write the failing tests for the data functions**

Create `src/db/preferences.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { ValidationError } from './errors'
import { addFriend } from './friends'
import { addPreferences, movePreference, removePreference, restorePreference } from './preferences'

let friendId: string

beforeEach(async () => {
  await resetDatabase()
  friendId = (await addFriend({ name: 'Alex', groupId: null, photo: null, notes: '' })).id
})

async function lists() {
  const friend = await db.friends.get(friendId)
  return { likes: friend?.likes, dislikes: friend?.dislikes }
}

/** "Item 1, Item 2, ..." up to `count`. */
function manyItems(count: number): string {
  return Array.from({ length: count }, (_, i) => `Item ${i + 1}`).join(', ')
}

describe('addPreferences', () => {
  it('adds cleaned items in order, oldest first', async () => {
    expect(await addPreferences(friendId, 'likes', '  Board   games ')).toEqual({ added: ['Board games'], skipped: [] })
    expect(await addPreferences(friendId, 'likes', 'sushi, hiking\nJazz')).toEqual({
      added: ['sushi', 'hiking', 'Jazz'],
      skipped: [],
    })
    expect(await lists()).toEqual({ likes: ['Board games', 'sushi', 'hiking', 'Jazz'], dislikes: [] })
  })

  it('skips items already in the list, ignoring case, and keeps the first spelling', async () => {
    await addPreferences(friendId, 'likes', 'Sushi')
    expect(await addPreferences(friendId, 'likes', 'SUSHI, ramen')).toEqual({ added: ['ramen'], skipped: ['SUSHI'] })
    expect((await lists()).likes).toEqual(['Sushi', 'ramen'])
  })

  it('moves an item from the other list, keeping the new spelling', async () => {
    await addPreferences(friendId, 'dislikes', 'cilantro, Early mornings')
    expect(await addPreferences(friendId, 'likes', 'Cilantro')).toEqual({ added: ['Cilantro'], skipped: [] })
    expect(await lists()).toEqual({ likes: ['Cilantro'], dislikes: ['Early mornings'] })
  })

  it('adds nothing for empty text', async () => {
    expect(await addPreferences(friendId, 'likes', ' , \n ')).toEqual({ added: [], skipped: [] })
    expect((await lists()).likes).toEqual([])
  })

  it('refuses to pass 50 items and changes nothing', async () => {
    await addPreferences(friendId, 'likes', manyItems(49))
    await addPreferences(friendId, 'dislikes', 'Cilantro')
    await expect(addPreferences(friendId, 'likes', 'Ramen, Cilantro')).rejects.toThrow('This list is full.')
    expect((await lists()).likes).toHaveLength(49)
    expect((await lists()).dislikes).toEqual(['Cilantro'])
    await addPreferences(friendId, 'likes', 'Ramen')
    expect((await lists()).likes).toHaveLength(50)
  })

  it('still reports duplicates when the list is full', async () => {
    await addPreferences(friendId, 'likes', manyItems(50))
    expect(await addPreferences(friendId, 'likes', 'item 1')).toEqual({ added: [], skipped: ['item 1'] })
  })

  it('refuses an item over 60 characters and changes nothing', async () => {
    const attempt = addPreferences(friendId, 'likes', `Sushi, ${'x'.repeat(61)}`)
    await expect(attempt).rejects.toThrow(ValidationError)
    await expect(attempt).rejects.toThrow('Keep each one under 60 characters.')
    expect((await lists()).likes).toEqual([])
    await addPreferences(friendId, 'likes', 'y'.repeat(60))
    expect((await lists()).likes).toEqual(['y'.repeat(60)])
  })

  it('rejects a missing friend', async () => {
    const attempt = addPreferences('nope', 'likes', 'Sushi')
    await expect(attempt).rejects.toThrow(ValidationError)
    await expect(attempt).rejects.toThrow('This friend no longer exists.')
  })
})

describe('removePreference', () => {
  it('removes an item ignoring case and returns where it was', async () => {
    await addPreferences(friendId, 'likes', 'Sushi, Hiking, Jazz')
    expect(await removePreference(friendId, 'likes', 'hiking')).toBe(1)
    expect((await lists()).likes).toEqual(['Sushi', 'Jazz'])
  })

  it('returns -1 when the item is not there', async () => {
    await addPreferences(friendId, 'likes', 'Sushi')
    expect(await removePreference(friendId, 'likes', 'Ramen')).toBe(-1)
    expect((await lists()).likes).toEqual(['Sushi'])
  })

  it('rejects a missing friend', async () => {
    await expect(removePreference('nope', 'likes', 'Sushi')).rejects.toThrow('This friend no longer exists.')
  })
})

describe('restorePreference', () => {
  it('puts the item back where it was', async () => {
    await addPreferences(friendId, 'likes', 'Sushi, Hiking, Jazz')
    const index = await removePreference(friendId, 'likes', 'Hiking')
    await restorePreference(friendId, 'likes', 'Hiking', index)
    expect((await lists()).likes).toEqual(['Sushi', 'Hiking', 'Jazz'])
  })

  it('clamps the index to the list', async () => {
    await addPreferences(friendId, 'likes', 'Sushi')
    await restorePreference(friendId, 'likes', 'Jazz', 7)
    await restorePreference(friendId, 'likes', 'Ramen', -3)
    expect((await lists()).likes).toEqual(['Ramen', 'Sushi', 'Jazz'])
  })

  it('does nothing when the item is already back in the list', async () => {
    await addPreferences(friendId, 'likes', 'Sushi, Jazz')
    await restorePreference(friendId, 'likes', 'sushi', 1)
    expect((await lists()).likes).toEqual(['Sushi', 'Jazz'])
  })

  it('moves the item back from the other list', async () => {
    await addPreferences(friendId, 'likes', 'Sushi, Jazz')
    const index = await removePreference(friendId, 'likes', 'Sushi')
    await addPreferences(friendId, 'dislikes', 'sushi')
    await restorePreference(friendId, 'likes', 'Sushi', index)
    expect(await lists()).toEqual({ likes: ['Sushi', 'Jazz'], dislikes: [] })
  })

  it('refuses when the list is full', async () => {
    await addPreferences(friendId, 'likes', manyItems(50))
    await expect(restorePreference(friendId, 'likes', 'Sushi', 0)).rejects.toThrow('This list is full.')
  })

  it('rejects a missing friend', async () => {
    await expect(restorePreference('nope', 'likes', 'Sushi', 0)).rejects.toThrow('This friend no longer exists.')
  })
})

describe('movePreference', () => {
  it('moves an item to the end of the other list', async () => {
    await addPreferences(friendId, 'likes', 'Sushi, Hiking')
    await addPreferences(friendId, 'dislikes', 'Cilantro')
    await movePreference(friendId, 'likes', 'sushi')
    expect(await lists()).toEqual({ likes: ['Hiking'], dislikes: ['Cilantro', 'Sushi'] })
    await movePreference(friendId, 'dislikes', 'Cilantro')
    expect(await lists()).toEqual({ likes: ['Hiking', 'Cilantro'], dislikes: ['Sushi'] })
  })

  it('refuses when the other list is full and changes nothing', async () => {
    await addPreferences(friendId, 'dislikes', manyItems(50))
    await addPreferences(friendId, 'likes', 'Sushi')
    await expect(movePreference(friendId, 'likes', 'Sushi')).rejects.toThrow('This list is full.')
    expect((await lists()).likes).toEqual(['Sushi'])
    expect((await lists()).dislikes).toHaveLength(50)
  })

  it('rejects a missing friend', async () => {
    await expect(movePreference('nope', 'likes', 'Sushi')).rejects.toThrow('This friend no longer exists.')
  })
})
```

- [ ] **Step 10: Run it and see it fail**

Run: `npx vitest run src/db/preferences.test.ts`
Expected: FAIL, `Test Files  1 failed (1)`, with `Error: Cannot find module './preferences' imported from .../src/db/preferences.test.ts`.

- [ ] **Step 11: Write the data functions**

Create `src/db/preferences.ts`:

```ts
import { cleanItem, indexOfItem, MAX_ITEM_LENGTH, MAX_ITEMS, otherKind, splitItems, type PreferenceKind } from '../lib/preferences'
import type { Friend } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

type Lists = Pick<Friend, PreferenceKind>

export interface AddResult {
  added: string[]
  /** Typed items that were already in the list. */
  skipped: string[]
}

const LIST_FULL = 'This list is full.'

/**
 * Runs `change` on copies of a friend's lists, then saves them, all in one transaction.
 * If `change` throws, nothing is saved.
 */
async function changeLists<T>(friendId: string, change: (lists: Lists) => T): Promise<T> {
  return db.transaction('rw', db.friends, async () => {
    const friend = await db.friends.get(friendId)
    if (!friend) throw new ValidationError('This friend no longer exists.')
    const lists: Lists = { likes: [...friend.likes], dislikes: [...friend.dislikes] }
    const result = change(lists)
    await db.friends.update(friendId, lists)
    return result
  })
}

/** Adds typed text ("sushi, hiking") to a list. Items in the other list move here, keeping the new spelling. */
export async function addPreferences(friendId: string, kind: PreferenceKind, text: string): Promise<AddResult> {
  const items = splitItems(text)
  if (items.some((item) => item.length > MAX_ITEM_LENGTH)) {
    throw new ValidationError('Keep each one under 60 characters.')
  }
  return changeLists(friendId, (lists) => {
    const list = lists[kind]
    const other = lists[otherKind(kind)]
    const result: AddResult = { added: [], skipped: [] }
    for (const item of items) {
      if (indexOfItem(list, item) !== -1) {
        result.skipped.push(item)
        continue
      }
      const elsewhere = indexOfItem(other, item)
      if (elsewhere !== -1) other.splice(elsewhere, 1)
      list.push(item)
      result.added.push(item)
    }
    if (list.length > MAX_ITEMS) throw new ValidationError(LIST_FULL)
    return result
  })
}

/** Removes an item (matched ignoring case). Returns where it was, for Undo, or -1 if it wasn't there. */
export async function removePreference(friendId: string, kind: PreferenceKind, item: string): Promise<number> {
  return changeLists(friendId, (lists) => {
    const index = indexOfItem(lists[kind], item)
    if (index !== -1) lists[kind].splice(index, 1)
    return index
  })
}

/**
 * Undo for `removePreference`: puts the item back at `index` (clamped to the list), unless it's
 * already in this list. If it has been added to the other list since, it moves back.
 */
export async function restorePreference(
  friendId: string,
  kind: PreferenceKind,
  item: string,
  index: number,
): Promise<void> {
  const cleaned = cleanItem(item)
  await changeLists(friendId, (lists) => {
    const list = lists[kind]
    if (indexOfItem(list, cleaned) !== -1) return
    if (list.length >= MAX_ITEMS) throw new ValidationError(LIST_FULL)
    const other = lists[otherKind(kind)]
    const elsewhere = indexOfItem(other, cleaned)
    if (elsewhere !== -1) other.splice(elsewhere, 1)
    list.splice(Math.min(Math.max(index, 0), list.length), 0, cleaned)
  })
}

/** Moves an item from one list to the end of the other. */
export async function movePreference(friendId: string, from: PreferenceKind, item: string): Promise<void> {
  await changeLists(friendId, (lists) => {
    const source = lists[from]
    const target = lists[otherKind(from)]
    const index = indexOfItem(source, item)
    if (index === -1) return
    const [moved] = source.splice(index, 1)
    if (indexOfItem(target, moved) !== -1) return
    if (target.length >= MAX_ITEMS) throw new ValidationError(LIST_FULL)
    target.push(moved)
  })
}
```

- [ ] **Step 12: Run it and see it pass**

Run: `npx vitest run src/db/preferences.test.ts`
Expected: PASS, `Tests  20 passed (20)`.

- [ ] **Step 13: Run everything**

Run: `npm test`
Expected: `Test Files  31 passed (31)` and `Tests  272 passed (272)`.

Run: `npx tsc -b`
Expected: no output, exit code 0.

- [ ] **Step 14: Commit**

```bash
git add src/lib/preferences.ts src/lib/preferences.test.ts src/types.ts src/db/db.ts src/db/db.test.ts src/db/friends.ts src/db/friends.test.ts src/db/preferences.ts src/db/preferences.test.ts src/test/fixtures.ts src/backup/format.ts
git commit -F - <<'EOF'
feat: likes and dislikes data, item rules and database upgrade

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Backups at version 2

**Files:**
- Modify: `src/backup/format.ts:1-21` (imports, `BackupFile`, `createBackup`), `src/backup/format.ts:71-77` (new helpers and the version check), `src/backup/format.ts:105-108` (the friend's lists)
- Test: `src/backup/format.test.ts:5-10`, `:32-37`, `:48-55`, `:63-65`; `src/backup/storage.test.ts:1-10`, `:25-40`

- [ ] **Step 1: Write the failing tests**

In `src/backup/format.test.ts`, replace:

```ts
  friends: [friend('f1', 'Alex', 'g1'), { ...friend('f2', 'Sam'), photo: 'data:image/jpeg;base64,AAAA', notes: 'Likes jazz' }],
```

with:

```ts
  friends: [
    friend('f1', 'Alex', 'g1'),
    {
      ...friend('f2', 'Sam'),
      photo: 'data:image/jpeg;base64,AAAA',
      notes: 'Likes jazz',
      likes: ['Jazz', 'Board games'],
      dislikes: ['Early mornings'],
    },
  ],
```

Replace:

```ts
    expect(file).toMatchObject({ app: 'friend-tracker', version: 1, exportedAt: '2026-10-02T09:00:00.000Z' })
```

with:

```ts
    expect(file).toMatchObject({ app: 'friend-tracker', version: 2, exportedAt: '2026-10-02T09:00:00.000Z' })
```

Replace:

```ts
describe('parseBackup cleanup', () => {
  it('dedupes repeated friend ids within a meetup', () => {
    const file = broken((f) => (list(f, 'meetups')[0].friendIds = ['f1', 'f1', 'f2']))
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.meetups[0].friendIds).toEqual(['f1', 'f2'])
  })
})
```

with:

```ts
describe('parseBackup cleanup', () => {
  it('dedupes repeated friend ids within a meetup', () => {
    const file = broken((f) => (list(f, 'meetups')[0].friendIds = ['f1', 'f1', 'f2']))
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.meetups[0].friendIds).toEqual(['f1', 'f2'])
  })

  it('cleans likes and dislikes, quietly dropping empties and repeats', () => {
    const file = broken((f) => {
      list(f, 'friends')[1].likes = [' Jazz ', 'jazz', '', 'Board \n games']
      list(f, 'friends')[1].dislikes = ['JAZZ', 'Early mornings', 'early mornings']
    })
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.friends[1].likes).toEqual(['Jazz', 'Board games'])
      expect(result.data.friends[1].dislikes).toEqual(['Early mornings'])
    }
  })
})

describe('parseBackup reads version 1 backups', () => {
  it('gives every friend empty likes and dislikes', () => {
    const file = broken((f) => {
      f.version = 1
      for (const friend of list(f, 'friends')) {
        delete friend.likes
        delete friend.dislikes
      }
    })
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.friends.map((f) => [f.likes, f.dislikes])).toEqual([
        [[], []],
        [[], []],
      ])
      expect(result.data.friends[1]).toMatchObject({ name: 'Sam', notes: 'Likes jazz' })
    }
  })
})
```

Replace:

```ts
  it('rejects other versions', () => {
    expectError(broken((f) => (f.version = 2)), 'different version')
  })
```

with:

```ts
  it('rejects other versions', () => {
    expectError(broken((f) => (f.version = 3)), 'This backup was made by a different version of Friend Tracker.')
    expectError(broken((f) => (f.version = '2')), 'This backup was made by a different version of Friend Tracker.')
  })

  it('rejects a missing or malformed list', () => {
    expectError(broken((f) => delete list(f, 'friends')[0].likes), 'Friend 1 has an invalid "likes" list.')
    expectError(broken((f) => (list(f, 'friends')[1].dislikes = 'Mornings')), 'Friend 2 has an invalid "dislikes" list.')
    expectError(broken((f) => (list(f, 'friends')[1].likes = ['Jazz', 7])), 'Friend 2 has an invalid "likes" list.')
  })

  it('rejects an item over 60 characters or a list over 50 items', () => {
    expectError(broken((f) => (list(f, 'friends')[1].likes = ['x'.repeat(61)])), 'Friend 2 has an invalid "likes" list.')
    const tooMany = Array.from({ length: 51 }, (_, i) => `Item ${i + 1}`)
    expectError(broken((f) => (list(f, 'friends')[0].dislikes = tooMany)), 'Friend 1 has an invalid "dislikes" list.')
  })
```

In `src/backup/storage.test.ts`, replace:

```ts
import { addMeetup } from '../db/meetups'
```

with:

```ts
import { addMeetup } from '../db/meetups'
import { addPreferences } from '../db/preferences'
```

Replace:

```ts
    const sam = await addFriend({ name: 'Sam', groupId: null, photo: null, notes: '' })
    await addMeetup({ date: '2026-09-01', typeId: 'type-meal', friendIds: [alex.id, sam.id], note: 'Tacos' })
```

with:

```ts
    const sam = await addFriend({ name: 'Sam', groupId: null, photo: null, notes: '' })
    await addPreferences(alex.id, 'likes', 'Sushi, Board games')
    await addPreferences(alex.id, 'dislikes', 'Early mornings')
    await addMeetup({ date: '2026-09-01', typeId: 'type-meal', friendIds: [alex.id, sam.id], note: 'Tacos' })
```

Replace:

```ts
    expect(sortById(await readAllData())).toEqual(sortById(before))
  })
```

with:

```ts
    expect(sortById(await readAllData())).toEqual(sortById(before))
    expect(await db.friends.get(alex.id)).toMatchObject({ likes: ['Sushi', 'Board games'], dislikes: ['Early mornings'] })
  })
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/backup`
Expected: FAIL, `Tests  6 failed | 15 passed (21)`. The failures are `accepts a backup it created`, `drops fields it does not know about`, `cleans likes and dislikes, quietly dropping empties and repeats`, `rejects a missing or malformed list`, `rejects an item over 60 characters or a list over 50 items` and `round-trips everything through a backup file`.

- [ ] **Step 3: Export version 2 and read versions 1 and 2**

In `src/backup/format.ts`, replace:

```ts
import { isISODate, type ISODate } from '../lib/dates'
import type { Friend, Group, Meetup, MeetupType } from '../types'
```

with:

```ts
import { isISODate, type ISODate } from '../lib/dates'
import { cleanItems, indexOfItem, MAX_ITEM_LENGTH, MAX_ITEMS, type PreferenceKind } from '../lib/preferences'
import type { Friend, Group, Meetup, MeetupType } from '../types'
```

Replace:

```ts
  app: 'friend-tracker'
  version: 1
  exportedAt: string
```

with:

```ts
  app: 'friend-tracker'
  version: 2
  exportedAt: string
```

Replace:

```ts
  return { app: 'friend-tracker', version: 1, exportedAt: exportedAt.toISOString(), ...data }
```

with:

```ts
  return { app: 'friend-tracker', version: 2, exportedAt: exportedAt.toISOString(), ...data }
```

Replace:

```ts
function assertUnique(ids: string[], what: string) {
```

with:

```ts
/** A version 2 friend's list, cleaned like the app cleans typed items. Empties and repeats are dropped quietly. */
function preferenceList(record: Obj, key: PreferenceKind, where: string): string[] {
  const value = record[key]
  const invalid = () => new BackupError(`${where} has an invalid "${key}" list.`)
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw invalid()
  const items = cleanItems(value)
  if (items.length > MAX_ITEMS || items.some((item) => item.length > MAX_ITEM_LENGTH)) throw invalid()
  return items
}

/** An item is never in both lists; one in both (only possible in an edited file) stays in Likes. */
function preferenceLists(record: Obj, where: string): Pick<Friend, PreferenceKind> {
  const likes = preferenceList(record, 'likes', where)
  const dislikes = preferenceList(record, 'dislikes', where).filter((item) => indexOfItem(likes, item) === -1)
  return { likes, dislikes }
}

function assertUnique(ids: string[], what: string) {
```

Replace:

```ts
  if (raw.version !== 1) throw new BackupError('This backup was made by a different version of Friend Tracker.')
```

with:

```ts
  const { version } = raw
  if (version !== 1 && version !== 2) {
    throw new BackupError('This backup was made by a different version of Friend Tracker.')
  }
```

Replace (the lines Task 1 added):

```ts
      // Version 1 backups were made before likes and dislikes existed.
      likes: [],
      dislikes: [],
```

with:

```ts
      // Version 1 backups were made before likes and dislikes existed.
      ...(version === 1 ? { likes: [], dislikes: [] } : preferenceLists(r, where)),
```

`exportBackup.ts` needs no change: it calls `createBackup` (now version 2) and self-checks the file with `parseBackup`, which accepts it. `storage.ts` needs no change: `readAllData` and `replaceAllData` move whole friend records, lists included, and still never touch `settings`, so the lock settings stay out of backups and survive an import (the existing `keeps the lock settings` test covers it).

- [ ] **Step 4: Run the tests and the type check and see them pass**

Run: `npx vitest run src/backup`
Expected: PASS, `Tests  21 passed (21)`.

Run: `npm test`
Expected: `Test Files  31 passed (31)` and `Tests  276 passed (276)`.

Run: `npx tsc -b`
Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/backup/format.ts src/backup/format.test.ts src/backup/storage.test.ts
git commit -F - <<'EOF'
feat: backups carry likes and dislikes (version 2, still reads version 1)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: Likes and Dislikes on the friend page

**Files:**
- Create: `src/screens/FriendPreferences.tsx`, `src/screens/FriendPreferences.css`, `e2e/preferences.spec.ts`
- Modify: `src/components/Chip.tsx:4-19`, `src/components/Chip.css:34-36`, `src/styles/base.css:195-199`, `src/screens/FriendDetailScreen.tsx:16-17` and `:80-82`, `src/sheets/FriendSheet.tsx:301`, `DESIGN.md:290-293` and `:322-323`, `e2e/helpers.ts:47-49`
- Test: `e2e/preferences.spec.ts`

- [ ] **Step 1: Add the e2e helper and write the failing e2e tests**

In `e2e/helpers.ts`, replace:

```ts
/** The lock screen's heading. */
```

with:

```ts
/** On a friend's page: adds `text` to their Likes or Dislikes with Enter, then closes the field. */
export async function addToList(page: Page, list: 'Likes' | 'Dislikes', text: string) {
  const kind = list === 'Likes' ? 'like' : 'dislike'
  const section = page.getByRole('region', { name: list, exact: true })
  await section.getByRole('button', { name: `Add a ${kind}`, exact: true }).click()
  const field = section.getByRole('textbox', { name: `New ${kind}`, exact: true })
  await field.fill(text)
  await field.press('Enter')
  await expect(field).toHaveValue('')
  await field.press('Escape')
  await expect(field).toBeHidden()
}

/** The lock screen's heading. */
```

(`exact: true` matters: without it, `{ name: 'Likes' }` also matches the "Dislikes" region, because Playwright's default name match is a case-insensitive substring.)

Create `e2e/preferences.spec.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { addFriend, addToList, goToTab } from './helpers.ts'

function section(page: Page, list: 'Likes' | 'Dislikes') {
  return page.getByRole('region', { name: list, exact: true })
}

async function openFriend(page: Page, name: string) {
  await page.getByRole('link', { name: new RegExp(name) }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

test('adds likes, several at once, and says when one is already there', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await openFriend(page, 'Alex')
  const likes = section(page, 'Likes')

  await likes.getByRole('button', { name: 'Add a like', exact: true }).click()
  const field = likes.getByRole('textbox', { name: 'New like', exact: true })
  await expect(field).toBeFocused()
  await field.fill('Sushi')
  await field.press('Enter')
  await expect(likes.getByRole('button', { name: 'Sushi', exact: true })).toBeVisible()
  await expect(field).toHaveValue('')
  await expect(field).toBeFocused()

  await field.fill('board games, Hiking')
  await likes.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(likes.locator('.chip--wrap')).toHaveText(['Sushi', 'board games', 'Hiking'])
  await expect(field).toBeFocused()

  await field.fill('sushi')
  await field.press('Enter')
  await expect(likes.getByRole('alert')).toHaveText('Already in Likes.')
  await expect(likes.locator('.chip--wrap')).toHaveText(['Sushi', 'board games', 'Hiking'])
})

test('moves a dislike to Likes, removes with Undo, and keeps the lists after a reload', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await openFriend(page, 'Alex')
  const likes = section(page, 'Likes')
  const dislikes = section(page, 'Dislikes')
  await addToList(page, 'Likes', 'Sushi, Hiking')
  await addToList(page, 'Dislikes', 'Cilantro, Early mornings')

  await dislikes.getByRole('button', { name: 'Cilantro', exact: true }).click()
  await page.getByRole('alertdialog', { name: 'Cilantro' }).getByRole('button', { name: 'Move to Likes' }).click()
  await expect(likes.locator('.chip--wrap')).toHaveText(['Sushi', 'Hiking', 'Cilantro'])
  await expect(dislikes.locator('.chip--wrap')).toHaveText(['Early mornings'])

  await likes.getByRole('button', { name: 'Hiking', exact: true }).click()
  await page.getByRole('alertdialog', { name: 'Hiking' }).getByRole('button', { name: 'Remove' }).click()
  await expect(likes.locator('.chip--wrap')).toHaveText(['Sushi', 'Cilantro'])
  const toast = page.getByRole('status')
  await expect(toast).toContainText('Removed “Hiking”')
  await toast.getByRole('button', { name: 'Undo' }).click()
  await expect(likes.locator('.chip--wrap')).toHaveText(['Sushi', 'Hiking', 'Cilantro'])

  await page.reload()
  await expect(likes.locator('.chip--wrap')).toHaveText(['Sushi', 'Hiking', 'Cilantro'])
  await expect(dislikes.locator('.chip--wrap')).toHaveText(['Early mornings'])
})

test('saves when the field loses focus or the other list opens, and Escape discards', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await openFriend(page, 'Alex')
  const likes = section(page, 'Likes')
  const dislikes = section(page, 'Dislikes')

  await likes.getByRole('button', { name: 'Add a like', exact: true }).click()
  await likes.getByRole('textbox', { name: 'New like', exact: true }).fill('Jazz')
  await dislikes.getByRole('button', { name: 'Add a dislike', exact: true }).click()
  await expect(likes.getByRole('button', { name: 'Jazz', exact: true })).toBeVisible()
  await expect(likes.getByRole('textbox')).toHaveCount(0)
  const field = dislikes.getByRole('textbox', { name: 'New dislike', exact: true })
  await expect(field).toBeFocused()

  await field.fill('Crowds')
  await field.press('Escape')
  await expect(field).toBeHidden()
  await expect(dislikes.locator('.chip--wrap')).toHaveCount(0)

  await dislikes.getByRole('button', { name: 'Add a dislike', exact: true }).click()
  await field.fill('Loud bars')
  await page.getByRole('heading', { level: 1, name: 'Alex' }).click()
  await expect(field).toBeHidden()
  await expect(dislikes.locator('.chip--wrap')).toHaveText(['Loud bars'])
})

test('keeps likes and dislikes through a backup', async ({ page }) => {
  // Force the download path; the share sheet can't be driven in tests.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await page.goto('/')
  await addFriend(page, 'Alex')
  await openFriend(page, 'Alex')
  await addToList(page, 'Likes', 'Sushi')
  await addToList(page, 'Dislikes', 'Cilantro')

  await goToTab(page, 'Settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.version).toBe(2)
  expect(backup.friends[0]).toMatchObject({ name: 'Alex', likes: ['Sushi'], dislikes: ['Cilantro'] })

  await goToTab(page, 'Friends')
  await openFriend(page, 'Alex')
  await addToList(page, 'Likes', 'Ramen')
  await goToTab(page, 'Settings')
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')

  await goToTab(page, 'Friends')
  await openFriend(page, 'Alex')
  await expect(section(page, 'Likes').locator('.chip--wrap')).toHaveText(['Sushi'])
  await expect(section(page, 'Dislikes').locator('.chip--wrap')).toHaveText(['Cilantro'])
})
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx playwright test --project=iphone e2e/preferences.spec.ts`
Expected: FAIL, `4 failed`. Each one times out (`Test timeout of 30000ms exceeded`) waiting for `getByRole('region', { name: 'Likes', exact: true }).getByRole('button', { name: 'Add a like', exact: true })` (directly or inside `addToList`), because the friend page has no Likes section yet.

- [ ] **Step 3: Add the wrapping chip and the neutral field note**

Replace the whole of `src/components/Chip.tsx` with:

```tsx
import type { ReactNode } from 'react'
import './Chip.css'

interface ChipProps {
  selected?: boolean
  /** Looks selected without being announced as a pressed toggle. */
  active?: boolean
  /** Lets long, user-entered text wrap inside the chip. */
  wrap?: boolean
  onClick?: () => void
  ariaLabel?: string
  children: ReactNode
}

export function Chip({ selected, active, wrap, onClick, ariaLabel, children }: ChipProps) {
  return (
    <button
      type="button"
      className={wrap ? 'chip chip--wrap' : 'chip'}
      aria-pressed={selected}
      aria-label={ariaLabel}
      data-selected={active || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
```

In `src/components/Chip.css`, replace:

```css
.chip .avatar {
  margin-left: -8px;
}
```

with:

```css
.chip .avatar {
  margin-left: -8px;
}
/* User-entered items: long text wraps inside the chip. A pill on one line, a soft rounded box when it wraps. */
.chip--wrap {
  flex: 0 1 auto;
  max-width: 100%;
  padding: 6px 14px;
  border-radius: 1.2em;
  white-space: normal;
  overflow-wrap: anywhere;
  text-align: start;
}
```

(The 36px `min-height` and the 44px hit-area `::after` come from `.chip` and still apply. `1.2em` of the Subhead chip text is about 18px, half of 36px, so a one-line chip is still a pill at any text size.)

In `src/styles/base.css`, replace:

```css
.field-error {
  margin: 0 var(--space-1);
  font-size: var(--text-footnote);
  color: var(--danger);
}
```

with:

```css
.field-error {
  margin: 0 var(--space-1);
  font-size: var(--text-footnote);
  color: var(--danger);
}
/* A neutral note under a field (not an error, so never red). */
.field-hint {
  margin: 0 var(--space-1);
  font-size: var(--text-footnote);
  color: var(--ink-2);
}
```

- [ ] **Step 4: Write the Likes and Dislikes sections**

Create `src/screens/FriendPreferences.css`:

```css
/* Takes the "+ Add" chip's place at the end of the list, on a line of its own. */
.preference-add {
  flex: 1 1 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.preference-add__row {
  display: flex;
  gap: var(--space-2);
}
.preference-add__row .field {
  flex: 1;
  min-width: 0;
}
```

Create `src/screens/FriendPreferences.tsx`:

```tsx
import { useId, useRef, useState, type MouseEvent } from 'react'
import { useActionSheet } from '../components/ActionSheet'
import { Chip } from '../components/Chip'
import { IconPlus } from '../components/icons'
import { Section } from '../components/InsetGroup'
import { useToast } from '../components/Toast'
import { ValidationError } from '../db/errors'
import { addPreferences, movePreference, removePreference, restorePreference } from '../db/preferences'
import { isPlainEnter } from '../lib/keys'
import { MAX_ITEM_LENGTH, otherKind, type PreferenceKind } from '../lib/preferences'
import type { Friend } from '../types'
import './FriendPreferences.css'

const KINDS: PreferenceKind[] = ['likes', 'dislikes']

const COPY: Record<PreferenceKind, { title: string; addLabel: string; fieldLabel: string; placeholder: string }> = {
  likes: { title: 'Likes', addLabel: 'Add a like', fieldLabel: 'New like', placeholder: 'Sushi, hiking…' },
  dislikes: {
    title: 'Dislikes',
    addLabel: 'Add a dislike',
    fieldLabel: 'New dislike',
    placeholder: 'Cilantro, early mornings…',
  },
}

const SAVE_FAILED = "Couldn't save. Please try again."
const UNDO_FAILED = "Couldn't undo. Please try again."

/** The open add field. Only one is open at a time on the page. */
interface Draft {
  kind: PreferenceKind
  text: string
  /** The note under the field. A new `n` re-announces the same text. */
  message: { text: string; n: number } | null
}

/** The friend page's Likes and Dislikes sections. */
export function FriendPreferences({ friend }: { friend: Friend }) {
  const showActionSheet = useActionSheet()
  const toast = useToast()
  const messageId = useId()
  const [draft, setDraft] = useState<Draft | null>(null)
  const submittingRef = useRef(false)

  function toastProblem(error: unknown, fallback: string) {
    toast({ message: error instanceof ValidationError ? error.message : fallback, tone: 'plain' })
  }

  function open(kind: PreferenceKind) {
    // Opening one list's field closes the other's, saving what was typed there. (The old field
    // is removed while it has focus, and React doesn't run onBlur for it, so it's saved once.)
    if (draft && draft.text.trim()) void saveClosed(draft.kind, draft.text)
    setDraft({ kind, text: '', message: null })
  }

  function close(kind: PreferenceKind) {
    setDraft((current) => (current?.kind === kind ? null : current))
  }

  function showMessage(kind: PreferenceKind, text: string | null) {
    setDraft((current) =>
      current?.kind === kind
        ? { ...current, message: text === null ? null : { text, n: (current.message?.n ?? 0) + 1 } }
        : current,
    )
  }

  /** Enter or Add: saves the text, then clears the field and keeps it open for the next one. */
  async function submit(kind: PreferenceKind, text: string) {
    if (submittingRef.current || !text.trim()) return
    submittingRef.current = true
    try {
      const { added, skipped } = await addPreferences(friend.id, kind, text)
      // Clears the field, unless something new was typed while saving.
      setDraft((current) => (current?.kind === kind && current.text === text ? { ...current, text: '' } : current))
      showMessage(kind, added.length === 0 && skipped.length > 0 ? `Already in ${COPY[kind].title}.` : null)
    } catch (error) {
      if (error instanceof ValidationError) showMessage(kind, error.message)
      else toast({ message: SAVE_FAILED, tone: 'plain' })
    } finally {
      submittingRef.current = false
    }
  }

  /** Saves what was left in a field that has closed, so a problem shows as a toast. */
  async function saveClosed(kind: PreferenceKind, text: string) {
    try {
      await addPreferences(friend.id, kind, text)
    } catch (error) {
      toastProblem(error, SAVE_FAILED)
    }
  }

  async function move(kind: PreferenceKind, item: string) {
    try {
      await movePreference(friend.id, kind, item)
    } catch (error) {
      toastProblem(error, SAVE_FAILED)
    }
  }

  async function remove(kind: PreferenceKind, item: string) {
    const friendId = friend.id
    let index: number
    try {
      index = await removePreference(friendId, kind, item)
    } catch (error) {
      toastProblem(error, SAVE_FAILED)
      return
    }
    if (index === -1) return
    toast({
      message: `Removed “${item}”`,
      tone: 'plain',
      actionLabel: 'Undo',
      onAction: () => {
        restorePreference(friendId, kind, item, index).catch((error: unknown) => toastProblem(error, UNDO_FAILED))
      },
    })
  }

  /**
   * While a field is open, tapping a chip or button in the lists doesn't take focus from it. Otherwise
   * the field would blur, save and close first, moving everything under the finger before the tap
   * lands (on Add, the button would vanish). Instead each action decides: Add saves and keeps the
   * field open, the other list's "+ Add" saves this field and switches, and an item's action sheet
   * takes focus, so the field blurs, saves and closes behind it.
   */
  function keepFieldFocus(event: MouseEvent) {
    if (draft && !(event.target instanceof HTMLInputElement)) event.preventDefault()
  }

  async function chooseAction(kind: PreferenceKind, item: string) {
    const choice = await showActionSheet<'move' | 'remove'>({
      title: item,
      actions: [
        { label: `Move to ${COPY[otherKind(kind)].title}`, value: 'move' },
        { label: 'Remove', value: 'remove', destructive: true },
      ],
    })
    if (choice === 'move') await move(kind, item)
    else if (choice === 'remove') await remove(kind, item)
  }

  return (
    <>
      {KINDS.map((kind) => {
        const copy = COPY[kind]
        const adding = draft?.kind === kind ? draft : null
        return (
          <Section key={kind} title={copy.title}>
            <div className="chip-wrap" onMouseDown={keepFieldFocus}>
              {friend[kind].map((item) => (
                <Chip key={item} wrap onClick={() => void chooseAction(kind, item)}>
                  {item}
                </Chip>
              ))}
              {adding ? (
                <div className="preference-add">
                  <div className="preference-add__row">
                    <input
                      className="field"
                      value={adding.text}
                      placeholder={copy.placeholder}
                      aria-label={copy.fieldLabel}
                      aria-describedby={adding.message ? messageId : undefined}
                      autoFocus
                      autoCapitalize="sentences"
                      enterKeyHint="done"
                      maxLength={MAX_ITEM_LENGTH}
                      onChange={(event) => setDraft({ kind, text: event.target.value, message: null })}
                      onKeyDown={(event) => {
                        if (isPlainEnter(event)) {
                          event.preventDefault()
                          // Enter ("done") on an empty field just closes it.
                          if (adding.text.trim()) void submit(kind, adding.text)
                          else event.currentTarget.blur()
                        } else if (event.key === 'Escape') {
                          event.preventDefault()
                          // Closes without saving: React doesn't run onBlur for a field it removes.
                          close(kind)
                        }
                      }}
                      onBlur={() => {
                        close(kind)
                        if (adding.text.trim()) void saveClosed(kind, adding.text)
                      }}
                    />
                    <button
                      type="button"
                      className="button button--secondary"
                      onClick={() => void submit(kind, adding.text)}
                    >
                      Add
                    </button>
                  </div>
                  {adding.message && (
                    <p key={adding.message.n} id={messageId} className="field-hint" role="alert">
                      {adding.message.text}
                    </p>
                  )}
                </div>
              ) : (
                <Chip ariaLabel={copy.addLabel} onClick={() => open(kind)}>
                  <IconPlus size={16} strokeWidth={2.4} />
                  Add
                </Chip>
              )}
            </div>
          </Section>
        )
      })}
    </>
  )
}
```

How the add field behaves (for reviewers):
- **Blur** (tapping anywhere outside the two chip clusters, Tab, the action sheet taking focus): `onBlur` closes the field (only if it's still this list's field) and saves what was typed. An empty field just closes.
- **Enter or Add:** `submit` saves, clears the field if nothing new was typed meanwhile, and keeps focus (Add can't steal focus, see `keepFieldFocus`). `submittingRef` drops a second press while a save is running. If a blur races a running submit, the blur's save finds the items already there and skips them, so nothing is added twice.
- **Escape:** closes without saving. The input is removed while focused; React disables its event system during the commit that removes it, so `onBlur` doesn't run.
- **The other list's "+ Add":** `open` saves the current field's text and switches (Decision 5).
- **Messages:** "Already in Likes." only when every typed item was already there; `ValidationError` messages ("This list is full.", "Keep each one under 60 characters.", "This friend no longer exists.") show under the field and keep the text; other failures show the plain toast "Couldn't save. Please try again."
- **Item chip:** an action sheet titled with the item, "Move to Dislikes" (or "Move to Likes") and a destructive "Remove" (so it is an `alertdialog`), then Cancel. Move has no toast. Remove shows `Removed “Sushi”` (plain tone, like "Meetup deleted") with Undo, which calls `restorePreference` with the removed index.

- [ ] **Step 5: Put the sections on the friend page**

In `src/screens/FriendDetailScreen.tsx`, replace:

```tsx
import { lastSeenByFriend } from '../stats/lastSeen'
import './FriendDetailScreen.css'
```

with:

```tsx
import { lastSeenByFriend } from '../stats/lastSeen'
import { FriendPreferences } from './FriendPreferences'
import './FriendDetailScreen.css'
```

Replace:

```tsx
      {friend.notes && <p className="friend-notes">{friend.notes}</p>}

      <StatRow
```

with:

```tsx
      {friend.notes && <p className="friend-notes">{friend.notes}</p>}

      <FriendPreferences key={friend.id} friend={friend} />

      <StatRow
```

(`key` resets the open field if the page ever switches to another friend without unmounting. The two `Section`s become direct children of `.page__body`, so they get the usual 1.5rem section spacing, in the spec's order: hero, notes, Likes, Dislikes, stat row, Month by month, History.)

- [ ] **Step 6: Run the e2e tests and see them pass**

Run: `npx playwright test --project=iphone e2e/preferences.spec.ts`
Expected: PASS, `4 passed`.

- [ ] **Step 7: Change the Notes placeholder**

In `src/sheets/FriendSheet.tsx`, replace:

```tsx
          placeholder="Birthday, partner's name, favorite things"
```

with:

```tsx
          placeholder="Birthday, partner's name"
```

- [ ] **Step 8: Update DESIGN.md**

In `DESIGN.md`, under `### Chips`, replace:

```markdown
- **Style:** Linen pill, 36px tall with an invisible extension to a 44px hit area, `0 14px` padding, Subhead 500 text, no wrapping inside a chip.
- **Selected:** Peach fill with On-Peach text, announced with `aria-pressed`. Selected-friend tokens in the log sheet use the same look with a 24px avatar and a close glyph.
- **Layouts:** a horizontally scrolling row that bleeds to the screen edges for filters and meetup types; a wrapping cluster for group pickers and dates.
```

with:

```markdown
- **Style:** Linen pill, 36px tall with an invisible extension to a 44px hit area, `0 14px` padding, Subhead 500 text, no wrapping inside a chip (except the wrapping variant below).
- **Selected:** Peach fill with On-Peach text, announced with `aria-pressed`. Selected-friend tokens in the log sheet use the same look with a 24px avatar and a close glyph.
- **Wrapping (`.chip--wrap`):** for user-entered items, such as a friend's likes and dislikes. Long text wraps inside the chip instead of overflowing. It keeps the 36px minimum height with `6px 14px` padding, is capped at the full width, and has `1.2em` corners: a pill on one line, a soft rounded box when the text wraps.
- **Layouts:** a horizontally scrolling row that bleeds to the screen edges for filters and meetup types; a wrapping cluster for group pickers, dates, and a friend's likes and dislikes.
```

Under `### Friend detail column`, replace:

```markdown
Reads as one calm column, not a grid of cards: centered 96px avatar, Title name, group in Warm Ink Secondary, then a Paper White "Last seen" pill (Subhead, 1em corners so it becomes a soft box if large text wraps it between the date and the time since). Below: the stat row, "Month by month", and the history grouped by month.
```

with:

```markdown
Reads as one calm column, not a grid of cards: centered 96px avatar, Title name, group in Warm Ink Secondary, then a Paper White "Last seen" pill (Subhead, 1em corners so it becomes a soft box if large text wraps it between the date and the time since). Below: the notes, then **Likes** and **Dislikes** (people before numbers), then the stat row, "Month by month", and the history grouped by month.
- **Likes and Dislikes:** each a section with a Footnote label over a wrapping cluster of item chips (the wrapping variant) on the page background, with no container. The cluster ends with a "+ Add" chip; tapping it puts a Paper White field and a secondary **Add** button in its place (one field open at a time). Notes under the field ("Already in Likes.", "This list is full.") are Footnote Warm Ink Secondary with `role="alert"`, never red. Tapping an item opens an action sheet titled with it: **Move to Dislikes** (or **Move to Likes**) and a destructive **Remove**, which an Undo toast reverses. An empty list shows only the "+ Add" chip.
```

- [ ] **Step 9: Run everything**

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...` with no errors.

Run: `npm test`
Expected: `Test Files  31 passed (31)` and `Tests  276 passed (276)`.

Run: `npm run e2e`
Expected: `71 passed`.

- [ ] **Step 10: Commit**

```bash
git add src/components/Chip.tsx src/components/Chip.css src/styles/base.css src/screens/FriendPreferences.tsx src/screens/FriendPreferences.css src/screens/FriendDetailScreen.tsx src/sheets/FriendSheet.tsx DESIGN.md e2e/helpers.ts e2e/preferences.spec.ts
git commit -F - <<'EOF'
feat: likes and dislikes on the friend page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: Friends search matches likes

**Files:**
- Create: `src/lib/friendSearch.ts`
- Modify: `src/screens/FriendsScreen.tsx:14-17` (imports), `:60-69` (rows), `:155-166` (subtitle), `e2e/preferences.spec.ts` (append one test)
- Test: `src/lib/friendSearch.test.ts` (create), `e2e/preferences.spec.ts`

- [ ] **Step 1: Write the failing unit tests**

Create `src/lib/friendSearch.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { friend } from '../test/fixtures'
import { matchFriend, matchSubtitle } from './friendSearch'

const kim = { ...friend('k', 'Kim Park'), likes: ['Board games', 'Hiking', 'Hiking boots'], dislikes: ['Running'] }

describe('matchFriend', () => {
  it('matches everyone when the query is empty', () => {
    expect(matchFriend(kim, '  ')).toEqual({ like: null })
  })

  it('matches the name ignoring case, without naming a like', () => {
    expect(matchFriend(kim, ' kim ')).toEqual({ like: null })
    expect(matchFriend({ ...kim, name: 'Hiking Hal' }, 'hik')).toEqual({ like: null })
  })

  it('matches a like ignoring case and returns the first matching one as stored', () => {
    expect(matchFriend(kim, 'HIK')).toEqual({ like: 'Hiking' })
    expect(matchFriend(kim, 'games')).toEqual({ like: 'Board games' })
  })

  it('never matches dislikes', () => {
    expect(matchFriend(kim, 'running')).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(matchFriend(kim, 'sushi')).toBeNull()
  })
})

describe('matchSubtitle', () => {
  it('names the like only when the friend was found through one', () => {
    expect(matchSubtitle({ like: 'Hiking' })).toBe('Likes Hiking')
    expect(matchSubtitle({ like: null })).toBeNull()
  })
})
```

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/lib/friendSearch.test.ts`
Expected: FAIL, `Test Files  1 failed (1)`, with `Error: Cannot find module './friendSearch' imported from .../src/lib/friendSearch.test.ts`.

- [ ] **Step 3: Write the matcher**

Create `src/lib/friendSearch.ts`:

```ts
import type { Friend } from '../types'

export interface FriendMatch {
  /** The first like that matched, as stored, when the name didn't. */
  like: string | null
}

/**
 * Matches the Friends search: the query (ignoring case) in the friend's name or in any of their
 * likes. Dislikes never match. An empty query matches everyone. Null when the friend doesn't match.
 */
export function matchFriend(friend: Pick<Friend, 'name' | 'likes'>, query: string): FriendMatch | null {
  const q = query.trim().toLocaleLowerCase()
  if (q === '' || friend.name.toLocaleLowerCase().includes(q)) return { like: null }
  const like = friend.likes.find((item) => item.toLocaleLowerCase().includes(q))
  return like === undefined ? null : { like }
}

/** The row subtitle part for a friend found through a like ("Likes Hiking"). */
export function matchSubtitle(match: FriendMatch): string | null {
  return match.like === null ? null : `Likes ${match.like}`
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `npx vitest run src/lib/friendSearch.test.ts`
Expected: PASS, `Tests  6 passed (6)`.

- [ ] **Step 5: Write the failing e2e test**

Append to the end of `e2e/preferences.spec.ts`:

```ts

test('finds a friend by what they like, never by what they dislike', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Kim', 'Work')
  await addFriend(page, 'Sam')
  await openFriend(page, 'Kim')
  await addToList(page, 'Likes', 'Board games, Hiking')
  await goToTab(page, 'Friends')
  await openFriend(page, 'Sam')
  await addToList(page, 'Dislikes', 'Hiking')
  await goToTab(page, 'Friends')

  const search = page.getByLabel('Search friends')
  await search.fill('HIK')
  await expect(page.getByRole('link', { name: /Kim/ })).toContainText('Work · Not seen yet · Likes Hiking')
  await expect(page.getByRole('link', { name: /Sam/ })).toHaveCount(0)

  await search.fill('kim')
  await expect(page.getByRole('link', { name: /Kim/ })).not.toContainText('Likes')

  await search.fill('ramen')
  await expect(page.getByText('No friends match “ramen”.')).toBeVisible()
})
```

- [ ] **Step 6: Run it and see it fail**

Run: `npx playwright test --project=iphone e2e/preferences.spec.ts -g "finds a friend"`
Expected: FAIL, `1 failed`: `expect(locator).toContainText(expected)` for `getByRole('link', { name: /Kim/ })` with `Expected substring: "Work · Not seen yet · Likes Hiking"` and `element(s) not found`, because the search still matches names only.

- [ ] **Step 7: Use the matcher in the Friends screen**

In `src/screens/FriendsScreen.tsx`, replace:

```tsx
import { daysBetween, yearOf } from '../lib/dates'
```

with:

```tsx
import { daysBetween, yearOf } from '../lib/dates'
import { matchFriend, matchSubtitle } from '../lib/friendSearch'
```

Replace:

```tsx
    const counts = countsByFriendForYear(meetups, yearOf(today), today)
    const q = query.trim().toLocaleLowerCase()
    return sortFriends(friends, meetups, sort, today)
      .filter((friend) => activeGroup === null || friend.groupId === activeGroup.id)
      .filter((friend) => q === '' || friend.name.toLocaleLowerCase().includes(q))
      .map((friend) => ({ friend, lastSeen: lastSeen.get(friend.id) ?? null, count: counts.get(friend.id) ?? 0 }))
  }, [friends, meetups, today, sort, activeGroup, query])
```

with:

```tsx
    const counts = countsByFriendForYear(meetups, yearOf(today), today)
    return sortFriends(friends, meetups, sort, today)
      .filter((friend) => activeGroup === null || friend.groupId === activeGroup.id)
      .flatMap((friend) => {
        const match = matchFriend(friend, query)
        if (!match) return []
        return [{ friend, match, lastSeen: lastSeen.get(friend.id) ?? null, count: counts.get(friend.id) ?? 0 }]
      })
  }, [friends, meetups, today, sort, activeGroup, query])
```

Replace:

```tsx
              {rows.map(({ friend, lastSeen, count }) => (
```

with:

```tsx
              {rows.map(({ friend, match, lastSeen, count }) => (
```

Replace:

```tsx
                    lastSeen ? formatSince(daysBetween(lastSeen, today)) : 'Not seen yet',
                  ]
```

with:

```tsx
                    lastSeen ? formatSince(daysBetween(lastSeen, today)) : 'Not seen yet',
                    matchSubtitle(match),
                  ]
```

The no-results message (`No friends match “…”.`) is untouched.

- [ ] **Step 8: Run the tests and see them pass**

Run: `npx playwright test --project=iphone e2e/preferences.spec.ts`
Expected: PASS, `5 passed`.

Run: `npm test`
Expected: `Test Files  32 passed (32)` and `Tests  282 passed (282)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `72 passed`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/friendSearch.ts src/lib/friendSearch.test.ts src/screens/FriendsScreen.tsx e2e/preferences.spec.ts
git commit -F - <<'EOF'
feat: Friends search matches likes and names the matching like

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Screenshots, the spec's planning notes, and a full check

**Files:**
- Modify: `e2e/screenshots.spec.ts:2` (import) and `:30-32` (seed), `docs/superpowers/specs/2026-10-03-likes-dislikes-design.md` (append after line 114)
- Regenerate: `e2e/screenshots/*.png`

- [ ] **Step 1: Seed Alex Rivera's lists for the screenshots**

In `e2e/screenshots.spec.ts`, replace:

```ts
import { addFriend, goToTab, lockHeading, logMeetup, reopenAfterAWhile, seedAppLock, stubFaceId } from './helpers.ts'
```

with:

```ts
import { addFriend, addToList, goToTab, lockHeading, logMeetup, reopenAfterAWhile, seedAppLock, stubFaceId } from './helpers.ts'
```

Replace:

```ts
  await logMeetup(page, ['Sam Chen'], { type: 'Trip', date: daysAgo(400) })
  // The last toast has an Undo action, so it stays up for 8 seconds.
```

with:

```ts
  await logMeetup(page, ['Sam Chen'], { type: 'Trip', date: daysAgo(400) })
  await page.getByRole('link', { name: /Alex Rivera/ }).click()
  await addToList(page, 'Likes', 'Ramen, Board games, Hiking')
  // Long enough to show an item wrapping inside its chip.
  await addToList(page, 'Likes', 'Live jazz in tiny basement bars on rainy weeknights')
  await addToList(page, 'Dislikes', 'Cilantro, Early mornings')
  await goToTab(page, 'Friends')
  // The last toast has an Undo action, so it stays up for 8 seconds.
```

(The long item is 51 characters and goes in its own entry: the field's `maxLength` of 60 counts the whole typed text. `captureAll` already shoots Alex Rivera's page as `*-04-friend.png` and `*-05-friend-full.png` in light, dark and large text, so no new captures are needed.)

- [ ] **Step 2: Regenerate the screenshots and look at them**

Run: `npm run screenshots`
Expected: `11 passed`.

Open `e2e/screenshots/light-04-friend.png`, `dark-04-friend.png`, `large-text-04-friend.png` and the three `*-05-friend-full.png` files with the Read tool and check:
- under the hero: a "LIKES" label with Ramen, Board games, Hiking, the long jazz item and a "+ Add" chip; then "DISLIKES" with Cilantro, Early mornings and "+ Add"; then the stat row;
- the long item wraps inside one rounded chip and nothing runs past the 16px page margin;
- chips are Linen in both themes and readable in dark mode; at large text the chips grow and wrap instead of overflowing.

If something is off, fix the CSS from Task 3 (`.chip--wrap` or `FriendPreferences.css`), run `npm run e2e` again, and re-run `npm run screenshots`.

- [ ] **Step 3: Record the planning decisions in the spec**

Append to the end of `docs/superpowers/specs/2026-10-03-likes-dislikes-design.md`:

```markdown

## Decisions made while planning

Recorded in [the plan](../plans/2026-10-03-likes-dislikes.md):

- **Repeats in one entry.** "sushi, Sushi" adds one item (the first spelling). Only items already in the list count as skipped.
- **After Enter or Add.** A save that works clears the field, even when every item was already there (then "Already in Likes." shows). A refused save ("This list is full.", "Keep each one under 60 characters.") keeps the text so it can be fixed. Enter on an empty field closes it, like the keyboard's Done.
- **A field that closes with text in it** (blur, or opening the other list's field) saves it. If that save is refused, the message shows as a plain toast, since the field is gone.
- **Taps inside the lists keep the field focused.** While a field is open, tapping Add, the other list's "+ Add" or an item doesn't blur the field first, so nothing moves under the finger before the tap lands. The other list's "+ Add" saves and switches; an item's action sheet takes focus, so the field saves and closes behind it.
- **Failure toasts.** A move or remove that fails for a reason other than these rules shows "Couldn't save. Please try again."; a failed Undo shows "Couldn't undo. Please try again." All are plain toasts.
- **Backups.** List limits are checked after cleaning. Items aren't split on commas. An item in both lists of an edited file stays in Likes.
- **Stale actions.** Removing an item that's already gone does nothing. Moving an item the other list already has just removes it from this one.
```

- [ ] **Step 4: Run every check**

Run: `npm test`
Expected: `Test Files  32 passed (32)` and `Tests  282 passed (282)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `72 passed`.

Run: `git status --short`
Expected: only `e2e/screenshots.spec.ts`, the spec, and changed files under `e2e/screenshots/` (at least the six friend page images). Nothing under `src/`.

- [ ] **Step 5: Commit**

```bash
git add e2e/screenshots.spec.ts e2e/screenshots docs/superpowers/specs/2026-10-03-likes-dislikes-design.md
git commit -F - <<'EOF'
test: friend page screenshots with likes and dislikes; record planning decisions

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Spec coverage

| Spec requirement | Where |
| --- | --- |
| `Friend.likes` / `dislikes`, oldest first | Task 1 (`types.ts`, `addPreferences` appends) |
| Item rules in `src/lib/preferences.ts`: clean, 60 characters, case-insensitive dedupe (first spelling wins), 50 items, comma/newline split, never in both lists | Task 1 (`preferences.ts`, `addPreferences`, `movePreference`, `restorePreference`); Task 2 (backups) |
| `addPreferences` returns `{ added, skipped }`, moves from the other list, full and too-long errors change nothing | Task 1 |
| `removePreference` index or -1; `restorePreference` clamps and moves back; `movePreference` appends; limits on move and restore | Task 1 |
| Missing friend: `ValidationError('This friend no longer exists.')` in every function | Task 1 (`changeLists`) |
| `db.version(2)` with the same stores and an upgrade; `version(1)` kept; `addFriend` empty lists; `updateFriend` never touches lists | Task 1 |
| Backups: export v2, import v1 (empty lists) and v2 (cleaned, refused when invalid), other versions keep the message, lock settings untouched | Task 2 |
| Friend page order, Section titles, wrapping Linen chips, `.chip--wrap` | Task 3 |
| Action sheet (Move to the other list, destructive Remove, Cancel); Remove toast with Undo restoring in place; Move without toast | Task 3 |
| "+ Add" chip and inline field: names, placeholders, `enterKeyHint`, `autoCapitalize`, `maxLength`; Enter/Add, blur, Escape; one field at a time | Task 3 |
| Messages in Warm Ink Secondary with `role="alert"`; save failure toast; empty list shows only "+ Add" | Task 3 |
| Search matches names and likes (not dislikes); `Likes <item>` subtitle; no-results message unchanged | Task 4 |
| Notes placeholder | Task 3 |
| DESIGN.md: Friend detail column and Chips | Task 3 |
| Unit tests (rules, data functions, upgrade, backups, search) | Tasks 1, 2, 4 |
| E2E (add, comma, duplicate; dislike, move, remove with Undo; reload; search; export and import) | Tasks 3, 4 |
| Screenshots: friend page with both lists in light, dark and large text | Task 5 |
