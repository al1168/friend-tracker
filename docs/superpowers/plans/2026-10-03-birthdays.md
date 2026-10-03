# Birthdays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remember each friend's birthday (a month and day, with an optional year), edit it in the friend sheet, show it on the friend's page and in a "Birthdays soon" group on the Friends tab, and keep it in backups.

**Architecture:** One pure module, `src/lib/birthdays.ts`, holds the validity rules, the reading of the sheet's three selects, and every date helper (next birthday, countdown, age, wording, the upcoming list). Each helper takes `today` (an `ISODate`) and never reads the clock. `Friend` gains `birthday: Birthday | null` with no Dexie version bump: the existing friends `reading` hook defaults it to null, `addFriend` and `updateFriend` validate and write it, and backups move to version 3. The friend sheet renders a new `BirthdayField` (three native selects); the friend page and the Friends tab render straight from the helpers.

**Tech Stack:** Vite 8, React 19, TypeScript 6 (strict, `verbatimModuleSyntax`, `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`), react-router 7 (HashRouter), Dexie 4 with dexie-react-hooks, Vitest 5 with fake-indexeddb (TZ America/Los_Angeles), Playwright WebKit (iPhone 13, port 4174).

---

**Spec:** [docs/superpowers/specs/2026-10-03-birthdays-design.md](../specs/2026-10-03-birthdays-design.md), the source of truth. Design context: [DESIGN.md](../../../DESIGN.md) (sections 5 and 6), [PRODUCT.md](../../../PRODUCT.md).

## Ground rules for every task

- Run every command from the project root in Git Bash: `/c/Users/luald/OneDrive/Desktop/Friend tracker`. The branch `feature/birthdays` is already checked out.
- TypeScript: type-only imports use `import type` or an inline `type` specifier; no enums, namespaces or constructor parameter properties; no unused locals or parameters. Test files under `src/` and everything in `e2e/` are type-checked by `npm run build` too.
- Import paths are extensionless inside `src/`. Inside `e2e/`, local files are imported with `.ts` (`./helpers.ts`).
- Copy (UI text, comments, docs) never uses em dashes. Use commas, colons, periods or parentheses.
- Never run `npm run dev`, `npm run preview`, `vite preview` or wrangler yourself. `npm run e2e` and `npm run screenshots` start and stop their own preview server.
- Commands:
  - Unit tests: `npm test` (one file: `npx vitest run <path>`)
  - Type check and production build: `npm run build` (quick type check only: `npx tsc -b`)
  - End-to-end tests: `npm run e2e` (one file: `npx playwright test --project=iphone <path>`)
  - Screenshots: `npm run screenshots`
- Baseline before Task 1: `npm test` shows `Test Files  32 passed (32)` and `Tests  285 passed (285)`; `npm run e2e` shows `75 passed`; `npm run screenshots` shows `11 passed`. Each task states the new totals.
- **Dates in tests.** Helpers never read the clock: they take `today`. Unit tests of the helpers use the fixed `TODAY` (`'2026-10-02'`) from `src/test/fixtures.ts`. The data layer and the backup parser use the real date (`todayISO()`), so their tests use dates that are valid or invalid on any real day (1996 is always past, 2999 always future). E2E tests can't fix the browser's date (the existing ones don't either: `screenshots.spec.ts` and `stats.spec.ts` compute from `new Date()`), so they build birthdays from the real date with `dayFromToday(n)` (Task 4) and assert relative wording ("In 5 days · turns 40"), which never goes stale. Node and the browser share the machine's time zone (the config sets no `timezoneId`).
- **Ages in e2e tests are multiples of 4** (28, 32, 40). Then when the birthday lands on Feb 29, the birth year is a leap year too and the date exists.
- **Friend links.** Once a friend can be in Birthdays soon, the Friends tab has two links with their name. Click a friend's link before giving them a birthday, or use `.last()` (the Friends list comes after Birthdays soon).
- **Screenshots are not committed.** `e2e/screenshots` is in `.gitignore`; look at the PNGs locally and never `git add` them.
- Commit after each task with the exact `git add` paths and message given. Every commit message ends with a blank line and then `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Decisions made while planning

The spec leaves these open. Task 5 records them at the end of the spec.

1. **Out-of-range values.** A month outside 1 to 12, a day the month never has, or a year before 1900 (only possible from code or an edited backup) counts as "That date doesn't exist.". A year after this one counts as "That date is in the future.".
2. **A year on its own** (month and day empty) is dropped on Save: the friend has no birthday, as the spec's "Month and day both empty: no birthday" says.
3. **"Remove birthday" shows when any of the three selects has a value,** not only for a saved birthday, so it also clears a half-picked row.
4. **Focus.** When Save finds a birthday problem, focus moves to the Birthday row (a `role="group"` with `tabIndex={-1}`, described by the error), not to a select, so iOS doesn't pop open a picker wheel. If the name is missing too, both errors show and the name field takes focus. "Remove birthday" disappears when pressed, so it moves focus to the row instead of letting it fall to the page. The row shows the focus ring only after keyboard use (`:focus-visible`).
5. **Accessible names** come from `aria-label` on each select ("Birthday month", "Birthday day", "Birthday year"), and the visible "Birthday" label names the row group. Visible labels over each select would crowd a row that must fit three fields; the empty options ("Month", "Day", "No year") already say which is which.
6. **The empty choice looks like a placeholder** (Warm Ink Tertiary), like the other fields' placeholders.
7. **Validation messages** stay under the row until a select changes. The selects get `aria-invalid` and `aria-describedby` like the name field. No `role="alert"`, again like the name field: focus moving to the described row announces it.
8. **Backups.** `parseBackup(raw, today = todayISO())` takes `today`, so a birthday more than 2 days after the day the file is read is refused (a backup holds birthdays some phone already accepted, so a day or two "early" from time zones or clock changes is not corruption; the data layer and the sheet stay strict), and tests can pass a fixed date. A version 3 friend without a `birthday` key is refused, like a version 2 friend without lists. Extra keys inside a birthday are dropped. A `birthday` in a version 1 or 2 file is ignored.
9. **Stored shape.** The data layer stores a copy with only `month`, `day` and `year`.
10. **"While searching"** means a query that isn't blank after trimming, the same test the search itself uses (spaces alone still list everyone).
11. **The footer** reads "And 1 more in the next two weeks." for one, which is already correct English, so it needs no `plural`.
12. **Birthdays soon rows** link to `/friends/:id` with no router state, like the Friends list rows, so the friend page's back button says "Friends".
13. **The "+ Add birthday" chip** has no `aria-label`: its text, "Add birthday", is its name (the plus icon is `aria-hidden`).

## File Structure

| File | Change | Responsibility |
| --- | --- | --- |
| `src/lib/birthdays.ts` | Create | Rules and wording: `MIN_BIRTH_YEAR`, the three sheet messages, `isLeapYear`, `maxDay`, `birthdayProblem`, `isValidBirthday`, `BirthdayFields`, `EMPTY_BIRTHDAY_FIELDS`, `birthdayFromFields`, `nextBirthday`, `daysUntilBirthday`, `ageOnNextBirthday`, `formatBirthday`, `describeNextBirthday`, `upcomingBirthdays` |
| `src/lib/birthdays.test.ts` | Create | Unit tests for every rule and helper |
| `src/types.ts` | Modify | `Birthday` interface and `Friend.birthday` |
| `src/db/db.ts` | Modify | The friends `reading` hook defaults `birthday` to null |
| `src/db/db.test.ts` | Modify | Upgrade expectations include `birthday: null`; the hook default |
| `src/db/friends.ts` | Modify | `FriendInput.birthday`; `clean` validates and copies it; `updateFriend` writes it |
| `src/db/friends.test.ts` | Modify | Add, update and refuse birthdays |
| `src/test/fixtures.ts` | Modify | `friend()` fixture gets `birthday: null` |
| `src/db/groups.test.ts`, `src/db/meetups.test.ts`, `src/db/preferences.test.ts` | Modify | Their `addFriend` inputs get `birthday: null` |
| `src/backup/format.ts` | Modify | Task 1: friends parse with `birthday: null`. Task 2: export v3, read v1 to v3, `today` parameter |
| `src/backup/format.test.ts` | Modify | v3 export, v1 and v2 give null, v3 refusals |
| `src/backup/storage.test.ts` | Modify | Task 1: `birthday: null` inputs. Task 2: the round trip keeps a birthday |
| `e2e/preferences.spec.ts` | Modify | Its backup test expects version 3 |
| `src/styles/base.css` | Modify | `select` inherits the font and keeps the 16px minimum |
| `src/components/icons.tsx` | Modify | `IconChevronDown` |
| `src/sheets/BirthdayField.tsx` / `.css` | Create | The sheet's Birthday section: the select row, its error, "Remove birthday" |
| `src/sheets/FriendSheet.tsx` | Modify | Birthday state, dirty tracking, validation on Save, the Notes placeholder |
| `src/screens/FriendDetailScreen.tsx` | Modify | The Birthday section (row or "+ Add birthday" chip) |
| `src/screens/FriendsScreen.tsx` | Modify | The Birthdays soon group |
| `DESIGN.md` | Modify | Task 3: Inputs and fields (select row). Task 4: Friend detail column, Birthdays soon |
| `e2e/helpers.ts` | Modify | Task 3: `BirthdayChoice`, `setBirthday`. Task 4: `dayFromToday`, `addFriend` takes a birthday |
| `e2e/birthdays.spec.ts` | Create | Task 3: the sheet. Task 4: friend page, Birthdays soon, backup |
| `e2e/screenshots.spec.ts` | Modify | Seeds birthdays so the friend page and Birthdays soon show |
| `docs/superpowers/specs/2026-10-03-birthdays-design.md` | Modify | Appends the planning decisions |

---

### Task 1: Birthday rules, the `Friend.birthday` field and the data layer

**Files:**
- Create: `src/lib/birthdays.ts`, `src/lib/birthdays.test.ts`
- Modify: `src/types.ts:12-14`, `src/db/db.ts:47-56`, `src/db/friends.ts:1-17` and `:25-32`, `src/test/fixtures.ts:5-7`, `src/backup/format.ts:127-129`, `src/sheets/FriendSheet.tsx:89`, `src/backup/storage.test.ts:28-29`, `:37`, `:70`, `src/db/groups.test.ts:43`, `src/db/meetups.test.ts:42`, `src/db/preferences.test.ts:11`
- Test: `src/lib/birthdays.test.ts`, `src/db/friends.test.ts:1-13`, `:29-33`, `:42-48`, `src/db/db.test.ts:4-5`, `:42-43`, `:61-64`

- [ ] **Step 1: Write the failing tests for the rules and helpers**

Create `src/lib/birthdays.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { friend, TODAY } from '../test/fixtures'
import type { Birthday } from '../types'
import {
  ageOnNextBirthday,
  birthdayFromFields,
  birthdayProblem,
  daysUntilBirthday,
  describeNextBirthday,
  EMPTY_BIRTHDAY_FIELDS,
  formatBirthday,
  isLeapYear,
  isValidBirthday,
  maxDay,
  nextBirthday,
  upcomingBirthdays,
} from './birthdays'

// TODAY is 2026-10-02.
function bday(month: number, day: number, year: number | null = null): Birthday {
  return { month, day, year }
}

describe('isLeapYear', () => {
  it('follows the calendar rules', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(2000)).toBe(true)
    expect(isLeapYear(2026)).toBe(false)
    expect(isLeapYear(1900)).toBe(false)
  })
})

describe('maxDay', () => {
  it('gives each month its length, 29 for February and 31 with no month', () => {
    expect(maxDay(1)).toBe(31)
    expect(maxDay(2)).toBe(29)
    expect(maxDay(4)).toBe(30)
    expect(maxDay(12)).toBe(31)
    expect(maxDay(null)).toBe(31)
  })
})

describe('birthdayProblem', () => {
  it('accepts a real month and day, with or without a year', () => {
    expect(birthdayProblem(bday(3, 14), TODAY)).toBeNull()
    expect(birthdayProblem(bday(3, 14, 1996), TODAY)).toBeNull()
    expect(birthdayProblem(bday(12, 31), TODAY)).toBeNull()
  })

  it('rejects a month or day out of range', () => {
    for (const birthday of [bday(0, 1), bday(13, 1), bday(1, 0), bday(1, 32), bday(4, 31), bday(2, 30), bday(1.5, 1), bday(1, 2.5), bday(Number.NaN, 1)]) {
      expect(birthdayProblem(birthday, TODAY)).toBe("That date doesn't exist.")
    }
  })

  it('allows Feb 29 without a year, or with a leap year', () => {
    expect(birthdayProblem(bday(2, 29), TODAY)).toBeNull()
    expect(birthdayProblem(bday(2, 29, 2024), TODAY)).toBeNull()
    expect(birthdayProblem(bday(2, 29, 2000), TODAY)).toBeNull()
    expect(birthdayProblem(bday(2, 29, 2023), TODAY)).toBe("That date doesn't exist.")
    expect(birthdayProblem(bday(2, 29, 1900), TODAY)).toBe("That date doesn't exist.")
  })

  it('accepts years from 1900 up to today', () => {
    expect(birthdayProblem(bday(1, 1, 1900), TODAY)).toBeNull()
    expect(birthdayProblem(bday(12, 31, 1899), TODAY)).toBe("That date doesn't exist.")
    expect(birthdayProblem(bday(1, 1, 1900.5), TODAY)).toBe("That date doesn't exist.")
    expect(birthdayProblem(bday(10, 2, 2026), TODAY)).toBeNull()
  })

  it('rejects a date after today', () => {
    expect(birthdayProblem(bday(10, 3, 2026), TODAY)).toBe('That date is in the future.')
    expect(birthdayProblem(bday(1, 1, 2027), TODAY)).toBe('That date is in the future.')
    expect(birthdayProblem(bday(1, 1, 10000), TODAY)).toBe('That date is in the future.')
  })
})

describe('isValidBirthday', () => {
  it('accepts a valid birthday, ignoring extra fields', () => {
    expect(isValidBirthday({ month: 3, day: 14, year: null }, TODAY)).toBe(true)
    expect(isValidBirthday({ month: 3, day: 14, year: 1996, sign: 'Pisces' }, TODAY)).toBe(true)
  })

  it('rejects anything else', () => {
    const bad = [
      null,
      undefined,
      'March 14',
      [3, 14],
      {},
      { month: 3, day: 14 },
      { month: '3', day: 14, year: null },
      { month: 3, day: 14, year: '1996' },
      { month: 2, day: 29, year: 2023 },
      { month: 10, day: 3, year: 2026 },
    ]
    for (const value of bad) expect(isValidBirthday(value, TODAY)).toBe(false)
  })
})

describe('birthdayFromFields', () => {
  it('gives no birthday when month and day are empty, even with a year', () => {
    expect(birthdayFromFields(EMPTY_BIRTHDAY_FIELDS, TODAY)).toEqual({ ok: true, birthday: null })
    expect(birthdayFromFields({ month: null, day: null, year: 1996 }, TODAY)).toEqual({ ok: true, birthday: null })
  })

  it('asks for both a month and a day', () => {
    const error = { ok: false, error: 'Pick a month and a day.' }
    expect(birthdayFromFields({ month: 3, day: null, year: null }, TODAY)).toEqual(error)
    expect(birthdayFromFields({ month: null, day: 14, year: 1996 }, TODAY)).toEqual(error)
  })

  it('gives the birthday, or says why it cannot be saved', () => {
    expect(birthdayFromFields({ month: 3, day: 14, year: 1996 }, TODAY)).toEqual({ ok: true, birthday: bday(3, 14, 1996) })
    expect(birthdayFromFields({ month: 2, day: 29, year: null }, TODAY)).toEqual({ ok: true, birthday: bday(2, 29) })
    expect(birthdayFromFields({ month: 2, day: 29, year: 2023 }, TODAY)).toEqual({ ok: false, error: "That date doesn't exist." })
    expect(birthdayFromFields({ month: 12, day: 25, year: 2026 }, TODAY)).toEqual({ ok: false, error: 'That date is in the future.' })
  })
})

describe('nextBirthday', () => {
  it('is today on the day, later this year, or next year once it has passed', () => {
    expect(nextBirthday(bday(10, 2), TODAY)).toBe('2026-10-02')
    expect(nextBirthday(bday(10, 3), TODAY)).toBe('2026-10-03')
    expect(nextBirthday(bday(10, 1), TODAY)).toBe('2027-10-01')
    expect(nextBirthday(bday(3, 14, 1996), TODAY)).toBe('2027-03-14')
  })

  it('rolls from Dec 31 into January', () => {
    expect(nextBirthday(bday(12, 31), '2026-12-31')).toBe('2026-12-31')
    expect(nextBirthday(bday(1, 1), '2026-12-31')).toBe('2027-01-01')
    expect(nextBirthday(bday(12, 31), '2027-01-01')).toBe('2027-12-31')
  })

  it('falls on Feb 29 in leap years and on Feb 28 in other years', () => {
    expect(nextBirthday(bday(2, 29), '2028-02-01')).toBe('2028-02-29')
    expect(nextBirthday(bday(2, 29, 2000), '2026-02-01')).toBe('2026-02-28')
    expect(nextBirthday(bday(2, 29), '2026-02-28')).toBe('2026-02-28')
    expect(nextBirthday(bday(2, 29), '2026-03-01')).toBe('2027-02-28')
    expect(nextBirthday(bday(2, 29), '2027-03-01')).toBe('2028-02-29')
  })
})

describe('daysUntilBirthday', () => {
  it('counts calendar days, with 0 for today', () => {
    expect(daysUntilBirthday(bday(10, 2), TODAY)).toBe(0)
    expect(daysUntilBirthday(bday(10, 14), TODAY)).toBe(12)
    expect(daysUntilBirthday(bday(1, 1), '2026-12-31')).toBe(1)
    expect(daysUntilBirthday(bday(10, 1), TODAY)).toBe(364)
    expect(daysUntilBirthday(bday(2, 29), '2026-02-20')).toBe(8)
  })
})

describe('ageOnNextBirthday', () => {
  it('is the age they turn next, or null without a year', () => {
    expect(ageOnNextBirthday(bday(10, 2, 1995), TODAY)).toBe(31)
    expect(ageOnNextBirthday(bday(10, 14, 1995), TODAY)).toBe(31)
    expect(ageOnNextBirthday(bday(10, 1, 1995), TODAY)).toBe(32)
    expect(ageOnNextBirthday(bday(2, 29, 2000), '2026-02-27')).toBe(26)
    expect(ageOnNextBirthday(bday(10, 2), TODAY)).toBeNull()
  })
})

describe('formatBirthday', () => {
  it('spells out the month, with the year when known', () => {
    expect(formatBirthday(bday(3, 14, 1996))).toBe('March 14, 1996')
    expect(formatBirthday(bday(3, 14))).toBe('March 14')
    expect(formatBirthday(bday(2, 29))).toBe('February 29')
  })
})

describe('describeNextBirthday', () => {
  it('says today, tomorrow or in how many days', () => {
    expect(describeNextBirthday(bday(10, 2), TODAY)).toBe('Today')
    expect(describeNextBirthday(bday(10, 3), TODAY)).toBe('Tomorrow')
    expect(describeNextBirthday(bday(10, 4), TODAY)).toBe('In 2 days')
    expect(describeNextBirthday(bday(10, 14), TODAY)).toBe('In 12 days')
  })

  it('adds the age when the year is known', () => {
    expect(describeNextBirthday(bday(10, 2, 1995), TODAY)).toBe('Today · turns 31')
    expect(describeNextBirthday(bday(10, 3, 1995), TODAY)).toBe('Tomorrow · turns 31')
    expect(describeNextBirthday(bday(10, 14, 1995), TODAY)).toBe('In 12 days · turns 31')
  })
})

describe('upcomingBirthdays', () => {
  function withBirthday(id: string, name: string, birthday: Birthday | null) {
    return { ...friend(id, name), birthday }
  }

  const friends = [
    withBirthday('zoe', 'Zoe', bday(10, 9)),
    withBirthday('alex', 'Alex', bday(10, 16)),
    withBirthday('sam', 'Sam', bday(10, 17)),
    withBirthday('kim', 'Kim', bday(10, 2, 1990)),
    withBirthday('amy', 'amy', bday(10, 9)),
    withBirthday('lee', 'Lee', null),
    withBirthday('max', 'Max', bday(10, 1)),
  ]

  it('lists today through the next 14 days, soonest first, then by name', () => {
    expect(upcomingBirthdays(friends, TODAY).map((u) => [u.friend.name, u.daysUntil])).toEqual([
      ['Kim', 0],
      ['amy', 7],
      ['Zoe', 7],
      ['Alex', 14],
    ])
  })

  it('takes another window and keeps each birthday', () => {
    expect(upcomingBirthdays(friends, TODAY, 7).map((u) => u.friend.name)).toEqual(['Kim', 'amy', 'Zoe'])
    expect(upcomingBirthdays(friends, TODAY, 0)).toEqual([{ friend: friends[3], birthday: bday(10, 2, 1990), daysUntil: 0 }])
  })

  it('looks across the new year and counts Feb 29 on Feb 28', () => {
    expect(upcomingBirthdays([withBirthday('a', 'Alex', bday(1, 3))], '2026-12-25').map((u) => u.daysUntil)).toEqual([9])
    expect(upcomingBirthdays([withBirthday('a', 'Alex', bday(2, 29))], '2026-02-20').map((u) => u.daysUntil)).toEqual([8])
  })
})
```

(`{ ...friend(id, name), birthday }` works before the fixture changes in Step 7: the spread just adds the field.)

- [ ] **Step 2: Run it and see it fail**

Run: `npx vitest run src/lib/birthdays.test.ts`
Expected: FAIL, `Test Files  1 failed (1)` and `Tests  no tests`, with `Error: Cannot find module './birthdays' imported from .../src/lib/birthdays.test.ts`.

- [ ] **Step 3: Add the `Birthday` type and write the module**

In `src/types.ts`, replace:

```ts
  dislikes: string[]
  createdAt: string
}
```

with:

```ts
  dislikes: string[]
  birthday: Birthday | null
  createdAt: string
}

/** A month and day, with the year when it's known. See src/lib/birthdays.ts for the rules. */
export interface Birthday {
  /** 1 to 12 */
  month: number
  /** 1 to 31, valid for the month (February allows 29) */
  day: number
  /** 1900 to the current year, or null when unknown */
  year: number | null
}
```

Create `src/lib/birthdays.ts`:

```ts
// Rules and wording for friends' birthdays, shared by the data layer, the backup parser and the screens.
// Every function that needs the date takes `today` (the phone's local date) and never reads the clock.

import type { Birthday, Friend } from '../types'
import { daysBetween, MONTH_NAMES, yearOf, type ISODate } from './dates'
import { compareNames } from './text'

/** The earliest birth year the app accepts. */
export const MIN_BIRTH_YEAR = 1900

/** What the Edit friend sheet says when it can't save a birthday. */
export const PICK_MONTH_AND_DAY = 'Pick a month and a day.'
export const NOT_A_DATE = "That date doesn't exist."
export const IN_THE_FUTURE = 'That date is in the future.'

/** Days in each month of a leap year: a birthday without a year can be Feb 29. */
const MONTH_LENGTHS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** The last day a birthday in `month` (1 to 12) can fall on: 29 for February, and 31 when no month is picked. */
export function maxDay(month: number | null): number {
  return month === null ? 31 : MONTH_LENGTHS[month - 1]
}

function isoDate(year: number, month: number, day: number): ISODate {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Why a birthday isn't valid, in the sheet's words, or null when it is. The month and day must make a
 * real date (Feb 29 included). A year must be 1900 or later, the date must exist in it (Feb 29 needs a
 * leap year), and it can't be after today. (Out-of-range values only come from code or edited backups,
 * and count as a date that doesn't exist.)
 */
export function birthdayProblem(birthday: Birthday, today: ISODate): string | null {
  const { month, day, year } = birthday
  if (!Number.isInteger(month) || month < 1 || month > 12) return NOT_A_DATE
  if (!Number.isInteger(day) || day < 1 || day > maxDay(month)) return NOT_A_DATE
  if (year === null) return null
  if (!Number.isInteger(year) || year < MIN_BIRTH_YEAR) return NOT_A_DATE
  if (month === 2 && day === 29 && !isLeapYear(year)) return NOT_A_DATE
  if (year > yearOf(today) || isoDate(year, month, day) > today) return IN_THE_FUTURE
  return null
}

/** Whether `value` is a valid birthday: `{ month, day, year }` with numbers (year may be null) that pass the rules. */
export function isValidBirthday(value: unknown, today: ISODate): value is Birthday {
  if (typeof value !== 'object' || value === null) return false
  const { month, day, year } = value as Record<string, unknown>
  if (typeof month !== 'number' || typeof day !== 'number') return false
  if (year !== null && typeof year !== 'number') return false
  return birthdayProblem({ month, day, year }, today) === null
}

/** The Edit friend sheet's three selects. Null where nothing is picked ("Month", "Day", "No year"). */
export interface BirthdayFields {
  month: number | null
  day: number | null
  year: number | null
}

/** All three selects empty. */
export const EMPTY_BIRTHDAY_FIELDS: BirthdayFields = { month: null, day: null, year: null }

export type BirthdayFieldsResult = { ok: true; birthday: Birthday | null } | { ok: false; error: string }

/** Reads the sheet's selects on Save. With month and day both empty there's no birthday (a year alone is dropped). */
export function birthdayFromFields(fields: BirthdayFields, today: ISODate): BirthdayFieldsResult {
  const { month, day, year } = fields
  if (month === null && day === null) return { ok: true, birthday: null }
  if (month === null || day === null) return { ok: false, error: PICK_MONTH_AND_DAY }
  const birthday: Birthday = { month, day, year }
  const problem = birthdayProblem(birthday, today)
  return problem === null ? { ok: true, birthday } : { ok: false, error: problem }
}

/** The date the birthday falls on in `year`. Feb 29 falls on Feb 28 in years without one. */
function birthdayIn(birthday: Birthday, year: number): ISODate {
  const leapDayMoves = birthday.month === 2 && birthday.day === 29 && !isLeapYear(year)
  return isoDate(year, birthday.month, leapDayMoves ? 28 : birthday.day)
}

/** The next date the birthday falls on, today included. */
export function nextBirthday(birthday: Birthday, today: ISODate): ISODate {
  const thisYear = birthdayIn(birthday, yearOf(today))
  return thisYear >= today ? thisYear : birthdayIn(birthday, yearOf(today) + 1)
}

/** Days until the next birthday. 0 means today. */
export function daysUntilBirthday(birthday: Birthday, today: ISODate): number {
  return daysBetween(today, nextBirthday(birthday, today))
}

/** The age they turn on their next birthday, or null when the year isn't known. */
export function ageOnNextBirthday(birthday: Birthday, today: ISODate): number | null {
  return birthday.year === null ? null : yearOf(nextBirthday(birthday, today)) - birthday.year
}

/** "March 14, 1996", or "March 14" without a year. */
export function formatBirthday(birthday: Birthday): string {
  const date = `${MONTH_NAMES[birthday.month - 1]} ${birthday.day}`
  return birthday.year === null ? date : `${date}, ${birthday.year}`
}

/** "Today", "Tomorrow" or "In 12 days", plus the age when the year is known: "In 12 days · turns 31". */
export function describeNextBirthday(birthday: Birthday, today: ISODate): string {
  const days = daysUntilBirthday(birthday, today)
  const when = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`
  const age = ageOnNextBirthday(birthday, today)
  return age === null ? when : `${when} · turns ${age}`
}

export interface UpcomingBirthday {
  friend: Friend
  birthday: Birthday
  /** Days until it. 0 means today. */
  daysUntil: number
}

/** Friends whose next birthday is within `days` days (today included), soonest first, then by name. */
export function upcomingBirthdays(friends: readonly Friend[], today: ISODate, days = 14): UpcomingBirthday[] {
  const upcoming: UpcomingBirthday[] = []
  for (const friend of friends) {
    const { birthday } = friend
    if (!birthday) continue
    const daysUntil = daysUntilBirthday(birthday, today)
    if (daysUntil <= days) upcoming.push({ friend, birthday, daysUntil })
  }
  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil || compareNames(a.friend.name, b.friend.name))
}
```

Notes for reviewers:
- ISO date strings compare correctly as text (`'2026-10-03' > '2026-10-02'`) because every part is zero-padded. A year of 10000 would break that, which is why `birthdayProblem` checks `year > yearOf(today)` first.
- `MONTH_LENGTHS[month - 1]` is only read for months 1 to 12 or null: `birthdayProblem` checks the month before calling `maxDay`, and the sheet only offers 1 to 12.

- [ ] **Step 4: Run it and see it pass**

Run: `npx vitest run src/lib/birthdays.test.ts`
Expected: PASS, `Tests  23 passed (23)`.

- [ ] **Step 5: Write the failing tests for the data layer**

In `src/db/friends.test.ts`, replace:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
```

with:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import type { Birthday } from '../types'
import { db, resetDatabase } from './db'
```

Replace:

```ts
  notes: '',
  ...overrides,
})
```

with:

```ts
  notes: '',
  birthday: null,
  ...overrides,
})

/** Birthdays the data layer refuses: no Feb 30, no Feb 29 in 2023, nothing before 1900 or after today. */
const INVALID_BIRTHDAYS: Birthday[] = [
  { month: 2, day: 30, year: null },
  { month: 2, day: 29, year: 2023 },
  { month: 12, day: 31, year: 1899 },
  { month: 1, day: 1, year: 2999 },
]
```

Replace:

```ts
  it('starts with empty likes and dislikes', async () => {
    const friend = await addFriend(input())
    expect(friend).toMatchObject({ likes: [], dislikes: [] })
  })
})
```

with:

```ts
  it('starts with empty likes and dislikes', async () => {
    const friend = await addFriend(input())
    expect(friend).toMatchObject({ likes: [], dislikes: [] })
  })

  it('saves a birthday, or none', async () => {
    const alex = await addFriend(input({ birthday: { month: 3, day: 14, year: 1996 } }))
    const sam = await addFriend(input({ name: 'Sam', birthday: { month: 2, day: 29, year: null } }))
    const kim = await addFriend(input({ name: 'Kim' }))
    expect((await db.friends.get(alex.id))?.birthday).toEqual({ month: 3, day: 14, year: 1996 })
    expect((await db.friends.get(sam.id))?.birthday).toEqual({ month: 2, day: 29, year: null })
    expect((await db.friends.get(kim.id))?.birthday).toBeNull()
  })

  it('stores only the birthday fields', async () => {
    const birthday = { month: 3, day: 14, year: null, sign: 'Pisces' }
    const friend = await addFriend(input({ birthday }))
    expect((await db.friends.get(friend.id))?.birthday).toEqual({ month: 3, day: 14, year: null })
  })

  it('rejects an invalid birthday and saves nothing', async () => {
    for (const birthday of INVALID_BIRTHDAYS) {
      const attempt = addFriend(input({ birthday }))
      await expect(attempt).rejects.toThrow(ValidationError)
      await expect(attempt).rejects.toThrow('Pick a valid birthday.')
    }
    expect(await db.friends.count()).toBe(0)
  })
})
```

Replace:

```ts
    await updateFriend(friend.id, input({ name: 'Alexandra' }))
    expect(await db.friends.get(friend.id)).toMatchObject({ likes: ['Sushi'], dislikes: ['Cilantro'] })
  })
})
```

with:

```ts
    await updateFriend(friend.id, input({ name: 'Alexandra' }))
    expect(await db.friends.get(friend.id)).toMatchObject({ likes: ['Sushi'], dislikes: ['Cilantro'] })
  })

  it('sets, changes and clears the birthday', async () => {
    const friend = await addFriend(input())
    const stored = async () => (await db.friends.get(friend.id))?.birthday
    await updateFriend(friend.id, input({ birthday: { month: 3, day: 14, year: 1996 } }))
    expect(await stored()).toEqual({ month: 3, day: 14, year: 1996 })
    await updateFriend(friend.id, input({ birthday: { month: 2, day: 29, year: null } }))
    expect(await stored()).toEqual({ month: 2, day: 29, year: null })
    await updateFriend(friend.id, input({ birthday: null }))
    expect(await stored()).toBeNull()
  })

  it('rejects an invalid birthday and keeps the old one', async () => {
    const friend = await addFriend(input({ birthday: { month: 3, day: 14, year: 1996 } }))
    for (const birthday of INVALID_BIRTHDAYS) {
      await expect(updateFriend(friend.id, input({ name: 'Alexandra', birthday }))).rejects.toThrow('Pick a valid birthday.')
    }
    expect(await db.friends.get(friend.id)).toMatchObject({ name: 'Alex', birthday: { month: 3, day: 14, year: 1996 } })
  })
})
```

In `src/db/db.test.ts`, replace:

```ts
import { DEFAULT_MEETUP_TYPES } from './defaults'
import { addPreferences } from './preferences'
```

with:

```ts
import { DEFAULT_MEETUP_TYPES } from './defaults'
import { updateFriend } from './friends'
import { addPreferences } from './preferences'
```

Replace:

```ts
    expect(await db.friends.get('f1')).toEqual({ ...v1Friend, likes: [], dislikes: [] })
    expect(await db.friends.get('f2')).toEqual({ ...nullListsFriend, likes: [], dislikes: [] })
```

with:

```ts
    // (The reading hook adds `birthday: null`, which the upgrade doesn't store.)
    expect(await db.friends.get('f1')).toEqual({ ...v1Friend, likes: [], dislikes: [], birthday: null })
    expect(await db.friends.get('f2')).toEqual({ ...nullListsFriend, likes: [], dislikes: [], birthday: null })
```

Replace:

```ts
    expect(await addPreferences('old', 'likes', 'Sushi')).toEqual({ added: ['Sushi'], skipped: [] })
    expect(await db.friends.get('old')).toMatchObject({ likes: ['Sushi'], dislikes: [] })
  })
})
```

with:

```ts
    expect(await addPreferences('old', 'likes', 'Sushi')).toEqual({ added: ['Sushi'], skipped: [] })
    expect(await db.friends.get('old')).toMatchObject({ likes: ['Sushi'], dislikes: [] })
  })

  it('get no birthday when the stored record has none, and can be given one', async () => {
    await db.friends.put({
      id: 'old',
      name: 'Old',
      groupId: null,
      photo: null,
      notes: '',
      likes: [],
      dislikes: [],
      createdAt: '2026-01-01T00:00:00.000Z',
    } as unknown as Friend)
    expect(await db.friends.get('old')).toMatchObject({ birthday: null })
    expect((await db.friends.toArray())[0]).toMatchObject({ birthday: null })
    await updateFriend('old', { name: 'Old', groupId: null, photo: null, notes: '', birthday: { month: 3, day: 14, year: null } })
    expect((await db.friends.get('old'))?.birthday).toEqual({ month: 3, day: 14, year: null })
  })
})
```

- [ ] **Step 6: Run them and see them fail**

Run: `npx vitest run src/db/friends.test.ts src/db/db.test.ts`
Expected: FAIL, `Tests  7 failed | 12 passed (19)`. The failures are `gives existing friends empty likes and dislikes and changes nothing else` and `get no birthday when the stored record has none, and can be given one` (the reading hook doesn't add `birthday` yet), `saves a birthday, or none`, `stores only the birthday fields` and `sets, changes and clears the birthday` (`expected undefined to deeply equal { month: 3, day: 14, ... }`), and the two `rejects an invalid birthday ...` tests (`promise resolved ... instead of rejecting`).

- [ ] **Step 7: Default the field on read, validate it on write, and give every friend one**

In `src/db/db.ts`, replace:

```ts
// The upgrade above runs once, but older code that is still running (a second tab, or a
// rollback) can write friends without lists later. Fill them in on every read.
// (Dexie also calls this with undefined when `get` finds nothing, so guard for that.)
db.friends.hook('reading', (friend) => {
  if (friend) {
    friend.likes ??= []
    friend.dislikes ??= []
  }
  return friend
})
```

with:

```ts
// The upgrade above runs once, but older code that is still running (a second tab, or a
// rollback) can write friends without lists later. Fill them in on every read.
// Birthdays came without a version bump (no index changed), so friends saved before them
// get "no birthday" here too.
// (Dexie also calls this with undefined when `get` finds nothing, so guard for that.)
db.friends.hook('reading', (friend) => {
  if (friend) {
    friend.likes ??= []
    friend.dislikes ??= []
    friend.birthday ??= null
  }
  return friend
})
```

In `src/db/friends.ts`, replace:

```ts
import { newId } from '../lib/ids'
import type { Friend } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

export interface FriendInput {
  name: string
  groupId: string | null
  photo: string | null
  notes: string
}

function clean(input: FriendInput): FriendInput {
  const name = input.name.trim()
  if (!name) throw new ValidationError('Please enter a name.')
  return { name, groupId: input.groupId, photo: input.photo, notes: input.notes.trim() }
}
```

with:

```ts
import { isValidBirthday } from '../lib/birthdays'
import { todayISO } from '../lib/dates'
import { newId } from '../lib/ids'
import type { Birthday, Friend } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

export interface FriendInput {
  name: string
  groupId: string | null
  photo: string | null
  notes: string
  birthday: Birthday | null
}

function clean(input: FriendInput): FriendInput {
  const name = input.name.trim()
  if (!name) throw new ValidationError('Please enter a name.')
  const { birthday } = input
  if (birthday !== null && !isValidBirthday(birthday, todayISO())) throw new ValidationError('Pick a valid birthday.')
  return {
    name,
    groupId: input.groupId,
    photo: input.photo,
    notes: input.notes.trim(),
    // Only the three fields are stored.
    birthday: birthday && { month: birthday.month, day: birthday.day, year: birthday.year },
  }
}
```

Replace:

```ts
  const { name, groupId, photo, notes } = clean(input)
  await db.transaction('rw', db.friends, async () => {
    if (!(await db.friends.get(id))) throw new ValidationError('This friend no longer exists.')
    await db.friends.update(id, { name, groupId, photo, notes })
  })
```

with:

```ts
  const { name, groupId, photo, notes, birthday } = clean(input)
  await db.transaction('rw', db.friends, async () => {
    if (!(await db.friends.get(id))) throw new ValidationError('This friend no longer exists.')
    await db.friends.update(id, { name, groupId, photo, notes, birthday })
  })
```

(`addFriend` needs no change: it spreads `clean(input)`, which now carries `birthday`.)

In `src/test/fixtures.ts`, replace:

```ts
  return { id, name, groupId, photo: null, notes: '', likes: [], dislikes: [], createdAt: '2026-01-01T00:00:00.000Z' }
```

with:

```ts
  return {
    id,
    name,
    groupId,
    photo: null,
    notes: '',
    likes: [],
    dislikes: [],
    birthday: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  }
```

In `src/backup/format.ts` (Task 2 reads birthdays from version 3 files), replace:

```ts
      ...(version === 1 ? { likes: [], dislikes: [] } : preferenceLists(r, where)),
      createdAt: text(r, 'createdAt', where),
```

with:

```ts
      ...(version === 1 ? { likes: [], dislikes: [] } : preferenceLists(r, where)),
      // Backups don't carry birthdays yet.
      birthday: null,
      createdAt: text(r, 'createdAt', where),
```

In `src/sheets/FriendSheet.tsx` (Task 3 adds the Birthday field), replace:

```ts
      const input = { name, groupId: finalGroupId, photo, notes }
```

with:

```ts
      // The sheet doesn't edit birthdays yet, so an edited friend keeps theirs.
      const input = { name, groupId: finalGroupId, photo, notes, birthday: editing?.birthday ?? null }
```

The other places that build a `FriendInput` are tests.

In `src/backup/storage.test.ts`, replace:

```ts
    const alex = await addFriend({ name: 'Alex', groupId: college.id, photo: 'data:image/jpeg;base64,AAAA', notes: 'Hi' })
    const sam = await addFriend({ name: 'Sam', groupId: null, photo: null, notes: '' })
```

with:

```ts
    const alex = await addFriend({
      name: 'Alex',
      groupId: college.id,
      photo: 'data:image/jpeg;base64,AAAA',
      notes: 'Hi',
      birthday: null,
    })
    const sam = await addFriend({ name: 'Sam', groupId: null, photo: null, notes: '', birthday: null })
```

Replace:

```ts
    await addFriend({ name: 'Someone else', groupId: null, photo: null, notes: '' })
```

with:

```ts
    await addFriend({ name: 'Someone else', groupId: null, photo: null, notes: '', birthday: null })
```

Replace:

```ts
    const alex = await addFriend({ name: 'Alex', groupId: null, photo: null, notes: '' })
    const bad: BackupData = {
```

with:

```ts
    const alex = await addFriend({ name: 'Alex', groupId: null, photo: null, notes: '', birthday: null })
    const bad: BackupData = {
```

In `src/db/groups.test.ts`, replace:

```ts
    const kim = await addFriend({ name: 'Kim', groupId: group.id, photo: null, notes: '' })
```

with:

```ts
    const kim = await addFriend({ name: 'Kim', groupId: group.id, photo: null, notes: '', birthday: null })
```

In `src/db/meetups.test.ts`, replace:

```ts
const friendInput = (name: string) => ({ name, groupId: null, photo: null, notes: '' })
```

with:

```ts
const friendInput = (name: string) => ({ name, groupId: null, photo: null, notes: '', birthday: null })
```

In `src/db/preferences.test.ts`, replace:

```ts
  friendId = (await addFriend({ name: 'Alex', groupId: null, photo: null, notes: '' })).id
```

with:

```ts
  friendId = (await addFriend({ name: 'Alex', groupId: null, photo: null, notes: '', birthday: null })).id
```

That is every place that builds a `Friend` or a `FriendInput` (`grep -rn "notes: ''" src` and `grep -rn "dislikes" src e2e` list nothing else): the other `Friend`s come from the database, `addFriend`, the `friend()` fixture (directly or spread, as in `format.test.ts` and `friendSearch.test.ts`) or the backup parser. `e2e/` builds friends only through the UI.

- [ ] **Step 8: Run the tests and the type check and see them pass**

Run: `npx vitest run src/db/friends.test.ts src/db/db.test.ts`
Expected: PASS, `Tests  19 passed (19)`.

Run: `npx tsc -b`
Expected: no output, exit code 0. (Dexie's `update` accepts `birthday` by name; the `FriendInput` interface alone would not fit its `UpdateSpec`, which is why `updateFriend` names each field.)

- [ ] **Step 9: Run everything**

Run: `npm test`
Expected: `Test Files  33 passed (33)` and `Tests  314 passed (314)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...` with no errors.

- [ ] **Step 10: Commit**

```bash
git add src/lib/birthdays.ts src/lib/birthdays.test.ts src/types.ts src/db/db.ts src/db/db.test.ts src/db/friends.ts src/db/friends.test.ts src/test/fixtures.ts src/backup/format.ts src/sheets/FriendSheet.tsx src/backup/storage.test.ts src/db/groups.test.ts src/db/meetups.test.ts src/db/preferences.test.ts
git commit -F - <<'EOF'
feat: birthday rules and helpers, and the friend's birthday in the data layer

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 2: Backups at version 3

**Files:**
- Modify: `src/backup/format.ts:1-3` (imports), `:12-22` (`BackupFile`, `createBackup`), `:28-36` (`parseBackup`), `:72` (comment), `:89` (new helper), `:93-98` (version check), the friend's `birthday` line from Task 1; `e2e/preferences.spec.ts:110`
- Test: `src/backup/format.test.ts:11-17`, `:44`, `:48-54`, `:79-98`, `:106-109`; `src/backup/storage.test.ts` (the Task 1 `alex` and the final expectation)

- [ ] **Step 1: Write the failing tests**

In `src/backup/format.test.ts`, replace:

```ts
      likes: ['Jazz', 'Board games'],
      dislikes: ['Early mornings'],
    },
  ],
```

with:

```ts
      likes: ['Jazz', 'Board games'],
      dislikes: ['Early mornings'],
      birthday: { month: 3, day: 14, year: 1996 },
    },
  ],
```

Replace:

```ts
    expect(file).toMatchObject({ app: 'friend-tracker', version: 2, exportedAt: '2026-10-02T09:00:00.000Z' })
```

with:

```ts
    expect(file).toMatchObject({ app: 'friend-tracker', version: 3, exportedAt: '2026-10-02T09:00:00.000Z' })
```

Replace:

```ts
    const file = broken((f) => {
      f.extra = true
      list(f, 'friends')[0].color = 'red'
    })
```

with:

```ts
    const file = broken((f) => {
      f.extra = true
      list(f, 'friends')[0].color = 'red'
      ;(list(f, 'friends')[1].birthday as Record<string, unknown>).sign = 'Pisces'
    })
```

Replace:

```ts
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

with:

```ts
describe('parseBackup reads version 1 backups', () => {
  it('gives every friend empty likes and dislikes and no birthday', () => {
    const file = broken((f) => {
      f.version = 1
      for (const friend of list(f, 'friends')) {
        delete friend.likes
        delete friend.dislikes
        delete friend.birthday
      }
    })
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.friends.map((f) => [f.likes, f.dislikes, f.birthday])).toEqual([
        [[], [], null],
        [[], [], null],
      ])
      expect(result.data.friends[1]).toMatchObject({ name: 'Sam', notes: 'Likes jazz' })
    }
  })
})

describe('parseBackup reads version 2 backups', () => {
  it('keeps likes and dislikes and gives every friend no birthday', () => {
    // Version 2 had no birthdays, so one in a version 2 file is ignored.
    const file = broken((f) => (f.version = 2))
    const result = parseBackup(file)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.friends.map((f) => f.birthday)).toEqual([null, null])
      expect(result.data.friends[1]).toMatchObject({ likes: ['Jazz', 'Board games'], dislikes: ['Early mornings'] })
    }
  })
})
```

Replace:

```ts
  it('rejects other versions', () => {
    expectError(broken((f) => (f.version = 3)), 'This backup was made by a different version of Friend Tracker.')
    expectError(broken((f) => (f.version = '2')), 'This backup was made by a different version of Friend Tracker.')
  })
```

with:

```ts
  it('rejects other versions', () => {
    expectError(broken((f) => (f.version = 4)), 'This backup was made by a different version of Friend Tracker.')
    expectError(broken((f) => (f.version = '3')), 'This backup was made by a different version of Friend Tracker.')
  })

  it('rejects a missing or invalid birthday', () => {
    const invalid = [
      'March 14',
      { month: 2, day: 30, year: null },
      { month: 2, day: 29, year: 2023 },
      { month: 3, day: 14 },
      { month: 3, day: 14, year: 1899 },
      { month: '3', day: 14, year: null },
    ]
    for (const birthday of invalid) {
      expectError(broken((f) => (list(f, 'friends')[1].birthday = birthday)), 'Friend 2 has an invalid birthday.')
    }
    expectError(broken((f) => delete list(f, 'friends')[0].birthday), 'Friend 1 has an invalid birthday.')
  })

  it('rejects a birthday after the day it is read', () => {
    const file = broken((f) => (list(f, 'friends')[1].birthday = { month: 10, day: 3, year: 2026 }))
    expect(parseBackup(file, '2026-10-02')).toEqual({ ok: false, error: 'Friend 2 has an invalid birthday.' })
    expect(parseBackup(file, '2026-10-03').ok).toBe(true)
  })
```

In `src/backup/storage.test.ts` (the lines Task 1 wrote), replace:

```ts
      notes: 'Hi',
      birthday: null,
    })
```

with:

```ts
      notes: 'Hi',
      birthday: { month: 3, day: 14, year: 1996 },
    })
```

Replace:

```ts
    expect(await db.friends.get(alex.id)).toMatchObject({ likes: ['Sushi', 'Board games'], dislikes: ['Early mornings'] })
```

with:

```ts
    expect(await db.friends.get(alex.id)).toMatchObject({
      likes: ['Sushi', 'Board games'],
      dislikes: ['Early mornings'],
      birthday: { month: 3, day: 14, year: 1996 },
    })
    expect((await db.friends.get(sam.id))?.birthday).toBeNull()
```

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run src/backup`
Expected: FAIL, `Tests  5 failed | 19 passed (24)`. The failures are `accepts a backup it created`, `drops fields it does not know about`, `rejects a missing or invalid birthday`, `rejects a birthday after the day it is read` and `round-trips everything through a backup file`: the parser still gives every friend `birthday: null` and the export is still version 2.

- [ ] **Step 3: Export version 3 and read versions 1 to 3**

In `src/backup/format.ts`, replace:

```ts
import { isISODate, type ISODate } from '../lib/dates'
import { cleanItems, indexOfItem, MAX_ITEM_LENGTH, MAX_ITEMS, type PreferenceKind } from '../lib/preferences'
import type { Friend, Group, Meetup, MeetupType } from '../types'
```

with:

```ts
import { isValidBirthday } from '../lib/birthdays'
import { isISODate, todayISO, type ISODate } from '../lib/dates'
import { cleanItems, indexOfItem, MAX_ITEM_LENGTH, MAX_ITEMS, type PreferenceKind } from '../lib/preferences'
import type { Birthday, Friend, Group, Meetup, MeetupType } from '../types'
```

Replace:

```ts
  app: 'friend-tracker'
  version: 2
  exportedAt: string
```

with:

```ts
  app: 'friend-tracker'
  version: 3
  exportedAt: string
```

Replace:

```ts
  return { app: 'friend-tracker', version: 2, exportedAt: exportedAt.toISOString(), ...data }
```

with:

```ts
  return { app: 'friend-tracker', version: 3, exportedAt: exportedAt.toISOString(), ...data }
```

Replace:

```ts
/** Validates an untrusted, already-JSON-parsed value. Never throws for bad input. */
export function parseBackup(raw: unknown): ParseResult {
  try {
    return { ok: true, data: readBackup(raw) }
```

with:

```ts
/**
 * Validates an untrusted, already-JSON-parsed value. Never throws for bad input.
 * `today` is the phone's date, for refusing a birthday in the future.
 */
export function parseBackup(raw: unknown, today: ISODate = todayISO()): ParseResult {
  try {
    return { ok: true, data: readBackup(raw, today) }
```

Replace:

```ts
/** A version 2 friend's list, cleaned like the app cleans typed items. Empties and repeats are dropped quietly. */
```

with:

```ts
/** A friend's list (version 2 on), cleaned like the app cleans typed items. Empties and repeats are dropped quietly. */
```

Replace:

```ts
function assertUnique(ids: string[], what: string) {
```

with:

```ts
/** A version 3 friend's birthday: null, or a valid one (copied, so stray fields are dropped). */
function birthdayOf(record: Obj, where: string, today: ISODate): Birthday | null {
  const value = record.birthday
  if (value === null) return null
  if (!isValidBirthday(value, today)) throw new BackupError(`${where} has an invalid birthday.`)
  return { month: value.month, day: value.day, year: value.year }
}

function assertUnique(ids: string[], what: string) {
```

Replace:

```ts
function readBackup(raw: unknown): BackupData {
  if (!isObj(raw) || raw.app !== 'friend-tracker') throw new BackupError("This isn't a Friend Tracker backup file.")
  const { version } = raw
  if (version !== 1 && version !== 2) {
```

with:

```ts
function readBackup(raw: unknown, today: ISODate): BackupData {
  if (!isObj(raw) || raw.app !== 'friend-tracker') throw new BackupError("This isn't a Friend Tracker backup file.")
  const { version } = raw
  if (version !== 1 && version !== 2 && version !== 3) {
```

Replace (the lines Task 1 added):

```ts
      // Backups don't carry birthdays yet.
      birthday: null,
```

with:

```ts
      // Versions 1 and 2 were made before birthdays existed.
      birthday: version === 3 ? birthdayOf(r, where, today) : null,
```

No other file changes: `exportBackup.ts` calls `createBackup` (now version 3) and self-checks the file with `parseBackup`, which accepts it, and `storage.ts` moves whole friend records, so birthdays travel with them. Lock settings still never enter a backup (the existing `keeps the lock settings` test covers it).

- [ ] **Step 4: Run the tests and the type check and see them pass**

Run: `npx vitest run src/backup`
Expected: PASS, `Tests  24 passed (24)`.

Run: `npm test`
Expected: `Test Files  33 passed (33)` and `Tests  317 passed (317)`.

Run: `npx tsc -b`
Expected: no output, exit code 0.

- [ ] **Step 5: Update the likes backup e2e test, which checks the version**

In `e2e/preferences.spec.ts`, replace:

```ts
  expect(backup.version).toBe(2)
```

with:

```ts
  expect(backup.version).toBe(3)
```

Run: `npx playwright test --project=iphone e2e/preferences.spec.ts e2e/settings.spec.ts`
Expected: `13 passed` (8 in `preferences.spec.ts`, 5 in `settings.spec.ts`; both have a backup test).

- [ ] **Step 6: Commit**

```bash
git add src/backup/format.ts src/backup/format.test.ts src/backup/storage.test.ts e2e/preferences.spec.ts
git commit -F - <<'EOF'
feat: backups carry birthdays (version 3, still reads versions 1 and 2)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 3: The Birthday field in the friend sheet

**Files:**
- Create: `src/sheets/BirthdayField.tsx`, `src/sheets/BirthdayField.css`, `e2e/birthdays.spec.ts`
- Modify: `src/styles/base.css:37-56`, `src/components/icons.tsx:39`, `src/sheets/FriendSheet.tsx` (imports, state, `dirty`, `save`, the form), `DESIGN.md:306`, `e2e/helpers.ts:49`
- Test: `e2e/birthdays.spec.ts`

- [ ] **Step 1: Add the e2e helper and write the failing e2e tests**

In `e2e/helpers.ts`, replace:

```ts
/** On a friend's page: adds `text` to their Likes or Dislikes with Enter, then closes the field. */
```

with:

```ts
/** A birthday to pick in the friend sheet. Leave out `year` for "No year". */
export interface BirthdayChoice {
  month: number
  day: number
  year?: number
}

/** In an open friend sheet: picks the birthday's month, day and year. */
export async function setBirthday(sheet: Locator, { month, day, year }: BirthdayChoice) {
  await sheet.getByRole('combobox', { name: 'Birthday month' }).selectOption(String(month))
  await sheet.getByRole('combobox', { name: 'Birthday day' }).selectOption(String(day))
  await sheet
    .getByRole('combobox', { name: 'Birthday year' })
    .selectOption(year === undefined ? { label: 'No year' } : String(year))
}

/** On a friend's page: adds `text` to their Likes or Dislikes with Enter, then closes the field. */
```

(A `<select>` without `multiple` has the `combobox` role. A string passed to `selectOption` matches an option's value: the month select's values are 1 to 12, so `'3'` picks March.)

Create `e2e/birthdays.spec.ts`:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, setBirthday } from './helpers.ts'

function birthdaySelects(sheet: Locator) {
  return {
    month: sheet.getByRole('combobox', { name: 'Birthday month' }),
    day: sheet.getByRole('combobox', { name: 'Birthday day' }),
    year: sheet.getByRole('combobox', { name: 'Birthday year' }),
  }
}

/** On a friend's page: opens the Edit friend sheet from the nav bar. */
async function editFriend(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await expect(sheet).toBeVisible()
  return sheet
}

async function save(sheet: Locator) {
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
}

test('saves a birthday with a year, then without one, then removes it', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('link', { name: /Alex/ }).click()

  let sheet = await editFriend(page)
  await expect(sheet.getByLabel('Notes')).toHaveAttribute('placeholder', "Partner's name, how you met")
  await expect(sheet.getByRole('button', { name: 'Remove birthday' })).toHaveCount(0)
  await setBirthday(sheet, { month: 3, day: 14, year: 1996 })
  await save(sheet)

  sheet = await editFriend(page)
  let selects = birthdaySelects(sheet)
  await expect(selects.month).toHaveValue('3')
  await expect(selects.day).toHaveValue('14')
  await expect(selects.year).toHaveValue('1996')
  await selects.year.selectOption({ label: 'No year' })
  await save(sheet)

  sheet = await editFriend(page)
  selects = birthdaySelects(sheet)
  await expect(selects.month).toHaveValue('3')
  await expect(selects.day).toHaveValue('14')
  await expect(selects.year).toHaveValue('')
  await sheet.getByRole('button', { name: 'Remove birthday' }).click()
  for (const select of [selects.month, selects.day, selects.year]) await expect(select).toHaveValue('')
  await expect(sheet.getByRole('button', { name: 'Remove birthday' })).toHaveCount(0)
  await expect(sheet.getByRole('group', { name: 'Birthday', exact: true })).toBeFocused()
  await save(sheet)

  sheet = await editFriend(page)
  selects = birthdaySelects(sheet)
  for (const select of [selects.month, selects.day, selects.year]) await expect(select).toHaveValue('')
})

test('checks the birthday on Save, and sets one when adding a friend', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheet.getByLabel('Name', { exact: true }).fill('Sam')
  const { month, day, year } = birthdaySelects(sheet)

  await month.selectOption('3')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet.getByText('Pick a month and a day.')).toBeVisible()
  await expect(day).toHaveAttribute('aria-invalid', 'true')
  await expect(day).toHaveAccessibleDescription('Pick a month and a day.')
  await expect(sheet.getByRole('group', { name: 'Birthday', exact: true })).toBeFocused()

  await month.selectOption('2')
  await expect(sheet.getByText('Pick a month and a day.')).toBeHidden()
  await expect(day).toHaveAttribute('aria-invalid', 'false')
  await day.selectOption('29')
  await year.selectOption('2023')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet.getByText("That date doesn't exist.")).toBeVisible()
  await expect(year).toHaveAccessibleDescription("That date doesn't exist.")

  await year.selectOption({ label: 'No year' })
  await save(sheet)
  await expect(page.getByRole('status')).toContainText('Added Sam')

  // .last(): the Friends list's row. (In late February, Birthdays soon above it lists Sam too.)
  await page.getByRole('link', { name: /Sam/ }).last().click()
  const edit = birthdaySelects(await editFriend(page))
  await expect(edit.month).toHaveValue('2')
  await expect(edit.day).toHaveValue('29')
  await expect(edit.year).toHaveValue('')
})

test('keeps the day list in step with the month', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const { month, day } = birthdaySelects(page.getByRole('dialog', { name: 'New friend' }))

  // "Day", then 1 to 31 while no month is picked.
  await expect(day.locator('option')).toHaveCount(32)
  await month.selectOption('1')
  await day.selectOption('31')
  await month.selectOption('2')
  await expect(day).toHaveValue('')
  await expect(day.locator('option')).toHaveCount(30)

  await day.selectOption('29')
  await month.selectOption('4')
  await expect(day).toHaveValue('29')
  await expect(day.locator('option')).toHaveCount(31)
})

test('asks before discarding a changed birthday', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('link', { name: /Alex/ }).click()

  const sheet = await editFriend(page)
  await birthdaySelects(sheet).month.selectOption('5')
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(sheet).toBeHidden()

  await expect(birthdaySelects(await editFriend(page)).month).toHaveValue('')
})
```

(Feb 29 with a non-leap year is fixed at 2023, always in the past, so this test never goes stale. "That date is in the future." is covered by the unit tests: in an e2e test, "tomorrow this year" doesn't exist on Dec 31.)

- [ ] **Step 2: Run them and see them fail**

Run: `npx playwright test --project=iphone e2e/birthdays.spec.ts`
Expected: FAIL, `4 failed`, because the sheet has no Birthday field yet. `saves a birthday ...` fails on the Notes placeholder (`Expected: "Partner's name, how you met"`, `Received: "Birthday, partner's name"`); `keeps the day list in step with the month` fails with `Expected: 32` and `Received: 0` options; the other two time out (`Test timeout of 30000ms exceeded`) waiting for `getByRole('combobox', { name: 'Birthday month' })`.

- [ ] **Step 3: Let selects use the app font, and add a down chevron**

In `src/styles/base.css`, replace:

```css
button,
input,
textarea {
  font: inherit;
  color: inherit;
}
```

with:

```css
button,
input,
select,
textarea {
  font: inherit;
  color: inherit;
}
```

Replace:

```css
/* 16px minimum stops iOS from zooming into focused fields. */
input,
textarea {
  font-size: max(16px, 1rem);
}
```

with:

```css
/* 16px minimum stops iOS from zooming into focused fields. */
input,
select,
textarea {
  font-size: max(16px, 1rem);
}
```

In `src/components/icons.tsx`, replace:

```tsx
export const IconChevronRight = (props: IconProps) => (
```

with:

```tsx
export const IconChevronDown = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
)

export const IconChevronRight = (props: IconProps) => (
```

- [ ] **Step 4: Write the Birthday field**

Create `src/sheets/BirthdayField.css`:

```css
/* Month, Day and Year share one row, Month widest. The bases fit "September", "Day" and "No year"
   at the default text size; at large text sizes the row wraps. */
.birthday-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  border-radius: var(--radius-field);
}
.birthday-select {
  position: relative;
  flex: 1 1 6em;
  min-width: 0;
}
.birthday-select--month {
  flex-basis: 7.5em;
}
.birthday-select--day {
  flex-basis: 4.5em;
}
.birthday-select .field {
  -webkit-appearance: none;
  appearance: none;
  padding-inline: 0.75rem 1.75rem;
}
/* The empty choice ("Month", "Day", "No year") reads like a placeholder. */
.birthday-select .field[data-empty='true'] {
  color: var(--ink-3);
}
.birthday-select svg {
  position: absolute;
  top: 50%;
  right: 0.6rem;
  translate: 0 -50%;
  color: var(--ink-3);
  pointer-events: none;
}
/* Lines its text up with the "Birthday" label above the row. */
.birthday-remove {
  align-self: flex-start;
  margin-inline-start: calc(-1 * var(--space-1));
}
```

(The bases add up to 18em plus two 8px gaps: 304px at 16px text, 322px at 17px, so the row fits one line on a 375px-wide iPhone, whose content column is 343px. At the largest standard text size, Month and Day share the first line and Year takes the second. The row's `border-radius` shapes its focus ring.)

Create `src/sheets/BirthdayField.tsx`:

```tsx
import { useId, type ReactNode, type RefObject } from 'react'
import { IconChevronDown } from '../components/icons'
import { EMPTY_BIRTHDAY_FIELDS, maxDay, MIN_BIRTH_YEAR, type BirthdayFields } from '../lib/birthdays'
import { MONTH_NAMES, yearOf, type ISODate } from '../lib/dates'
import './BirthdayField.css'

interface BirthdayFieldProps {
  value: BirthdayFields
  /** The message under the row, or null. */
  error: string | null
  today: ISODate
  /** The row, which takes focus when Save finds a problem or Remove birthday empties it. */
  rowRef: RefObject<HTMLDivElement | null>
  onChange: (value: BirthdayFields) => void
}

/** The friend sheet's Birthday section: Month, Day and Year selects in a row, the error under them, and Remove birthday. */
export function BirthdayField({ value, error, today, rowRef, onChange }: BirthdayFieldProps) {
  const labelId = useId()
  const errorId = useId()
  const shownErrorId = error ? errorId : undefined
  const days = Array.from({ length: maxDay(value.month) }, (_, i) => i + 1)
  const thisYear = yearOf(today)
  const years = Array.from({ length: thisYear - MIN_BIRTH_YEAR + 1 }, (_, i) => thisYear - i)
  const isSet = value.month !== null || value.day !== null || value.year !== null

  function changeMonth(month: number | null) {
    // A day the new month doesn't have (Jan 31, then February) goes back to empty.
    const day = value.day !== null && value.day > maxDay(month) ? null : value.day
    onChange({ ...value, month, day })
  }

  function remove() {
    onChange(EMPTY_BIRTHDAY_FIELDS)
    // The button goes away with the birthday, so focus moves to the row instead of falling to the page.
    rowRef.current?.focus()
  }

  return (
    <div className="form-section">
      <span className="field-label" id={labelId}>
        Birthday
      </span>
      <div
        ref={rowRef}
        className="birthday-row"
        role="group"
        aria-labelledby={labelId}
        aria-describedby={shownErrorId}
        tabIndex={-1}
      >
        <BirthdaySelect
          part="month"
          label="Birthday month"
          value={value.month}
          errorId={shownErrorId}
          onChange={changeMonth}
        >
          <option value="">Month</option>
          {MONTH_NAMES.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </BirthdaySelect>
        <BirthdaySelect
          part="day"
          label="Birthday day"
          value={value.day}
          errorId={shownErrorId}
          onChange={(day) => onChange({ ...value, day })}
        >
          <option value="">Day</option>
          {days.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </BirthdaySelect>
        <BirthdaySelect
          part="year"
          label="Birthday year"
          value={value.year}
          errorId={shownErrorId}
          onChange={(year) => onChange({ ...value, year })}
        >
          <option value="">No year</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </BirthdaySelect>
      </div>
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
      {isSet && (
        <button type="button" className="text-button birthday-remove" onClick={remove}>
          Remove birthday
        </button>
      )}
    </div>
  )
}

interface BirthdaySelectProps {
  part: 'month' | 'day' | 'year'
  label: string
  value: number | null
  /** The error's id while there is one. */
  errorId: string | undefined
  onChange: (value: number | null) => void
  children: ReactNode
}

/** A native select (iOS shows its wheel) with the field look and a chevron. The empty option reads like a placeholder. */
function BirthdaySelect({ part, label, value, errorId, onChange, children }: BirthdaySelectProps) {
  return (
    <span className={`birthday-select birthday-select--${part}`}>
      <select
        className="field"
        aria-label={label}
        aria-invalid={errorId !== undefined}
        aria-describedby={errorId}
        data-empty={value === null}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      >
        {children}
      </select>
      <IconChevronDown size={16} strokeWidth={2.4} />
    </span>
  )
}
```

How it behaves (for reviewers):
- **Day list:** "Day", then 1 to `maxDay(month)`: 31 with no month, 29 for February whatever the year (a non-leap year is caught on Save, as the spec says).
- **Month change:** a day the new month doesn't have is cleared (Jan 31, then February). A day it has is kept.
- **Year list:** "No year", then this year down to 1900, from the `today` the sheet passes in.
- **"Remove birthday"** shows while any select has a value and empties all three.

- [ ] **Step 5: Wire it into the friend sheet**

In `src/sheets/FriendSheet.tsx`, replace:

```tsx
import { addGroup } from '../db/groups'
import { isPlainEnter } from '../lib/keys'
import { resizeImageToDataUrl } from '../lib/image'
import type { FriendSheetRequest } from './sheetsContext'
```

with:

```tsx
import { addGroup } from '../db/groups'
import { useToday } from '../hooks/useToday'
import { birthdayFromFields, EMPTY_BIRTHDAY_FIELDS, type BirthdayFields } from '../lib/birthdays'
import { isPlainEnter } from '../lib/keys'
import { resizeImageToDataUrl } from '../lib/image'
import { BirthdayField } from './BirthdayField'
import type { FriendSheetRequest } from './sheetsContext'
```

Replace:

```tsx
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
```

with:

```tsx
  const navigate = useNavigate()
  const today = useToday()
  const fileInput = useRef<HTMLInputElement>(null)
```

Replace:

```tsx
  const nameInput = useRef<HTMLInputElement>(null)
  const savingRef = useRef(false)
```

with:

```tsx
  const nameInput = useRef<HTMLInputElement>(null)
  const birthdayRow = useRef<HTMLDivElement>(null)
  const savingRef = useRef(false)
```

Replace:

```tsx
  const [notes, setNotes] = useState(editing?.notes ?? '')
```

with:

```tsx
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const initialBirthday: BirthdayFields = editing?.birthday ?? EMPTY_BIRTHDAY_FIELDS
  const [birthday, setBirthday] = useState(initialBirthday)
  const [birthdayError, setBirthdayError] = useState<string | null>(null)
```

Replace:

```tsx
    notes !== (editing?.notes ?? '') ||
    !!newGroupName?.trim()
```

with:

```tsx
    notes !== (editing?.notes ?? '') ||
    birthday.month !== initialBirthday.month ||
    birthday.day !== initialBirthday.day ||
    birthday.year !== initialBirthday.year ||
    !!newGroupName?.trim()
```

Replace:

```tsx
    if (savingRef.current || processingPhoto) return
    if (!name.trim()) {
      flushSync(() => setNameError('Please enter a name.'))
      nameInput.current?.focus()
      return
    }
```

with:

```tsx
    if (savingRef.current || processingPhoto) return
    const checked = birthdayFromFields(birthday, today)
    if (!name.trim() || !checked.ok) {
      flushSync(() => {
        if (!name.trim()) setNameError('Please enter a name.')
        if (!checked.ok) setBirthdayError(checked.error)
      })
      // Focus goes to the first problem. The birthday row itself takes it, not a select, so iOS doesn't open a wheel.
      if (!name.trim()) nameInput.current?.focus()
      else birthdayRow.current?.focus()
      return
    }
```

Replace (the lines Task 1 wrote):

```tsx
      // The sheet doesn't edit birthdays yet, so an edited friend keeps theirs.
      const input = { name, groupId: finalGroupId, photo, notes, birthday: editing?.birthday ?? null }
```

with:

```tsx
      const input = { name, groupId: finalGroupId, photo, notes, birthday: checked.birthday }
```

(After the early return TypeScript knows `checked.ok` is true, so `checked.birthday` type-checks. The check runs before a typed new group is created, so a birthday problem never leaves a stray group behind.)

Replace:

```tsx
      <div className="form-section">
        <label className="field-label" htmlFor={notesId}>
          Notes
        </label>
        <textarea
          id={notesId}
          className="field"
          rows={3}
          value={notes}
          placeholder="Birthday, partner's name"
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
```

with:

```tsx
      <BirthdayField
        value={birthday}
        error={birthdayError}
        today={today}
        rowRef={birthdayRow}
        onChange={(value) => {
          setBirthday(value)
          setBirthdayError(null)
        }}
      />

      <div className="form-section">
        <label className="field-label" htmlFor={notesId}>
          Notes
        </label>
        <textarea
          id={notesId}
          className="field"
          rows={3}
          value={notes}
          placeholder="Partner's name, how you met"
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
```

The section order is now photo, Name, Group, **Birthday**, Notes, as the spec asks. The sheet opens with its state copied from `request.friend` (the `useState(request)` at the top), and `SheetsProvider` remounts it on every open, so the selects always start from the saved birthday.

- [ ] **Step 6: Run the e2e tests and see them pass**

Run: `npx playwright test --project=iphone e2e/birthdays.spec.ts`
Expected: PASS, `4 passed`.

- [ ] **Step 7: Update DESIGN.md**

In `DESIGN.md`, under `### Inputs and fields`, replace:

```markdown
- **Hint (`.field-hint`):** a neutral note under a field for things that aren't errors, such as "Already in Likes.". Footnote Warm Ink Secondary, announced with `role="alert"`, never red.
```

with:

```markdown
- **Hint (`.field-hint`):** a neutral note under a field for things that aren't errors, such as "Already in Likes.". Footnote Warm Ink Secondary, announced with `role="alert"`, never red.
- **Select row (`.birthday-row`):** native selects, so iOS shows its wheel, with the Field look, `appearance: none` and a 16px Warm Ink Tertiary chevron. The empty choice ("Month", "Day", "No year") is Warm Ink Tertiary, like a placeholder. The friend sheet's Birthday puts Month, Day and Year in one row of equal-height fields, Month widest (flex bases 7.5em, 4.5em and 6em); at large text sizes the row wraps. Each select has its own accessible name ("Birthday month"); an error sits under the row and the selects point to it with `aria-describedby`. A "Remove birthday" text button under the row clears all three.
```

- [ ] **Step 8: Run everything**

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...` with no errors.

Run: `npm test`
Expected: `Test Files  33 passed (33)` and `Tests  317 passed (317)`.

Run: `npm run e2e`
Expected: `79 passed`.

- [ ] **Step 9: Commit**

```bash
git add src/styles/base.css src/components/icons.tsx src/sheets/BirthdayField.tsx src/sheets/BirthdayField.css src/sheets/FriendSheet.tsx DESIGN.md e2e/helpers.ts e2e/birthdays.spec.ts
git commit -F - <<'EOF'
feat: birthday selects in the friend sheet, with validation and Remove birthday

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 4: The friend page's Birthday section and Birthdays soon

**Files:**
- Modify: `src/screens/FriendDetailScreen.tsx:3-4`, `:10-11`, `:81-83`, `src/screens/FriendsScreen.tsx:13-14`, `:25-26`, `:72`, `:85`, `:120-122`, `DESIGN.md` (`### Friend detail column`, and a new subsection before `### Stat row`), `e2e/helpers.ts` (`addFriend`, new `dayFromToday`), `e2e/birthdays.spec.ts` (imports, append four tests)
- Test: `e2e/birthdays.spec.ts`

- [ ] **Step 1: Add the e2e helpers and write the failing e2e tests**

In `e2e/helpers.ts`, replace:

```ts
export async function addFriend(page: Page, name: string, group?: string) {
```

with:

```ts
export async function addFriend(page: Page, name: string, group?: string, birthday?: BirthdayChoice) {
```

Replace:

```ts
      await expect(sheet.getByRole('button', { name: group, exact: true })).toHaveAttribute('aria-pressed', 'true')
    }
  }
  await sheet.getByRole('button', { name: 'Save' }).click()
```

with:

```ts
      await expect(sheet.getByRole('button', { name: group, exact: true })).toHaveAttribute('aria-pressed', 'true')
    }
  }
  if (birthday) await setBirthday(sheet, birthday)
  await sheet.getByRole('button', { name: 'Save' }).click()
```

Replace:

```ts
/** On a friend's page: adds `text` to their Likes or Dislikes with Enter, then closes the field. */
```

with:

```ts
/**
 * The local date `days` from today (negative for the past). Tests build birthdays from it, so the
 * same countdown ("In 5 days") shows whatever day they run.
 */
export function dayFromToday(days: number): { year: number; month: number; day: number } {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
}

/** On a friend's page: adds `text` to their Likes or Dislikes with Enter, then closes the field. */
```

In `e2e/birthdays.spec.ts`, replace:

```ts
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, setBirthday } from './helpers.ts'
```

with:

```ts
import { readFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { addFriend, dayFromToday, goToTab, setBirthday } from './helpers.ts'

/** "March" for 3. */
function monthName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleString('en-US', { month: 'long' })
}
```

Append to the end of `e2e/birthdays.spec.ts`:

```ts

test('shows the birthday on the friend page with a countdown, and edits it from there', async ({ page }) => {
  const soon = dayFromToday(5)
  // 40 is a multiple of 4, so the birth year is a leap year whenever `soon` is Feb 29.
  const born = soon.year - 40
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('link', { name: /Alex/ }).click()
  const section = page.getByRole('region', { name: 'Birthday', exact: true })

  await section.getByRole('button', { name: 'Add birthday' }).click()
  let sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await setBirthday(sheet, { month: soon.month, day: soon.day, year: born })
  await save(sheet)
  const row = section.getByRole('button')
  await expect(row).toContainText(`${monthName(soon.month)} ${soon.day}, ${born}`)
  await expect(row).toContainText('In 5 days · turns 40')

  await row.click()
  sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await sheet.getByRole('combobox', { name: 'Birthday year' }).selectOption({ label: 'No year' })
  await save(sheet)
  await expect(row).toContainText(`${monthName(soon.month)} ${soon.day}`)
  await expect(row).toContainText('In 5 days')
  await expect(row).not.toContainText(String(born))
  await expect(row).not.toContainText('turns')

  await row.click()
  sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await sheet.getByRole('button', { name: 'Remove birthday' }).click()
  await save(sheet)
  await expect(section.getByRole('button', { name: 'Add birthday' })).toBeVisible()
})

test('lists the birthdays in the next two weeks on the Friends tab', async ({ page }) => {
  const today = dayFromToday(0)
  const inFive = dayFromToday(5)
  const inFifteen = dayFromToday(15)
  await page.goto('/')
  await addFriend(page, 'Alex', undefined, { ...inFive, year: inFive.year - 40 })
  await addFriend(page, 'Lee', undefined, { month: today.month, day: today.day })
  await addFriend(page, 'Kim', undefined, { month: inFifteen.month, day: inFifteen.day })
  await addFriend(page, 'Sam', 'Work')

  const soon = page.getByRole('region', { name: 'Birthdays soon' })
  const rows = soon.getByRole('link')
  await expect(rows).toHaveCount(2)
  await expect(rows.nth(0)).toContainText('Lee')
  await expect(rows.nth(0)).toContainText('Today')
  await expect(rows.nth(1)).toContainText('Alex')
  await expect(rows.nth(1)).toContainText('In 5 days · turns 40')

  const search = page.getByLabel('Search friends')
  await search.fill('a')
  await expect(soon).toBeHidden()
  await search.fill('')
  await expect(soon).toBeVisible()

  const filters = page.getByRole('group', { name: 'Filter by group' })
  await filters.getByRole('button', { name: 'Work' }).click()
  await expect(soon).toBeHidden()
  await filters.getByRole('button', { name: 'All' }).click()
  await expect(soon).toBeVisible()

  await rows.nth(1).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
  await page.getByRole('button', { name: 'Friends', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})

test('shows at most five birthdays soon, then how many more', async ({ page }) => {
  await page.goto('/')
  for (const [days, name] of ['Ana', 'Ben', 'Cal', 'Dee', 'Eve', 'Fay'].entries()) {
    const { month, day } = dayFromToday(days)
    await addFriend(page, name, undefined, { month, day })
  }

  const soon = page.getByRole('region', { name: 'Birthdays soon' })
  await expect(soon.getByRole('link')).toHaveCount(5)
  await expect(soon.getByRole('link').last()).toContainText('Eve')
  await expect(soon).toContainText('And 1 more in the next two weeks.')
})

test('keeps birthdays through a backup', async ({ page }) => {
  // Force the download path; the share sheet can't be driven in tests.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await page.goto('/')
  await addFriend(page, 'Alex', undefined, { month: 3, day: 14, year: 1996 })

  await goToTab(page, 'Settings')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const backupPath = await (await downloadPromise).path()
  const backup = JSON.parse(await readFile(backupPath, 'utf8'))
  expect(backup.version).toBe(3)
  expect(backup.friends[0]).toMatchObject({ name: 'Alex', birthday: { month: 3, day: 14, year: 1996 } })

  await goToTab(page, 'Friends')
  // .last(): the Friends list's row, not the Birthdays soon one (Alex is in both in early March).
  await page.getByRole('link', { name: /Alex/ }).last().click()
  const section = page.getByRole('region', { name: 'Birthday', exact: true })
  await section.getByRole('button').click()
  const sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await sheet.getByRole('button', { name: 'Remove birthday' }).click()
  await save(sheet)
  await expect(section.getByRole('button', { name: 'Add birthday' })).toBeVisible()

  await goToTab(page, 'Settings')
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')

  await goToTab(page, 'Friends')
  await page.getByRole('link', { name: /Alex/ }).last().click()
  await expect(section).toContainText('March 14, 1996')
})
```

Why these never go stale: every date near today comes from `dayFromToday`, and every age is a multiple of 4. Kim, 15 days out, is just outside the 14-day window on any day (a birthday without a year next falls exactly 15 days later, even across New Year or on Feb 29). The backup test's March 14, 1996 is a fixed past date that it only reads back.

- [ ] **Step 2: Run them and see them fail**

Run: `npx playwright test --project=iphone e2e/birthdays.spec.ts`
Expected: FAIL, `4 failed` and `4 passed` (Task 3's tests pass). The new tests time out waiting for `getByRole('region', { name: 'Birthday', exact: true })` or find no `getByRole('region', { name: 'Birthdays soon' })`, because neither section exists yet.

- [ ] **Step 3: Add the Birthday section to the friend page**

In `src/screens/FriendDetailScreen.tsx`, replace:

```tsx
import { Avatar } from '../components/Avatar'
import { InsetGroup, Row, Section } from '../components/InsetGroup'
```

with:

```tsx
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { IconPlus } from '../components/icons'
import { InsetGroup, Row, Section } from '../components/InsetGroup'
```

Replace:

```tsx
import { useToday } from '../hooks/useToday'
import { daysBetween, formatDate, formatMonthYear, yearOf } from '../lib/dates'
```

with:

```tsx
import { useToday } from '../hooks/useToday'
import { describeNextBirthday, formatBirthday } from '../lib/birthdays'
import { daysBetween, formatDate, formatMonthYear, yearOf } from '../lib/dates'
```

Replace:

```tsx
      {friend.notes && <p className="friend-notes">{friend.notes}</p>}

      <FriendPreferences key={friend.id} friend={friend} />
```

with:

```tsx
      {friend.notes && <p className="friend-notes">{friend.notes}</p>}

      <Section title="Birthday">
        {friend.birthday ? (
          <InsetGroup>
            <Row
              onClick={() => openFriendSheet({ friend })}
              leading={
                <span className="emoji-badge" aria-hidden="true">
                  🎂
                </span>
              }
              title={formatBirthday(friend.birthday)}
              subtitle={describeNextBirthday(friend.birthday, today)}
              chevron
            />
          </InsetGroup>
        ) : (
          <div className="chip-wrap">
            <Chip onClick={() => openFriendSheet({ friend })}>
              <IconPlus size={16} strokeWidth={2.4} />
              Add birthday
            </Chip>
          </div>
        )}
      </Section>

      <FriendPreferences key={friend.id} friend={friend} />
```

(The row is a button with a chevron, like the history rows. The chip sits in a `.chip-wrap` so it keeps its own width instead of stretching across the column. `today` is the page's existing `useToday()`, so the countdown updates at midnight.)

- [ ] **Step 4: Add Birthdays soon to the Friends tab**

In `src/screens/FriendsScreen.tsx`, replace:

```tsx
import { useToday } from '../hooks/useToday'
import { daysBetween, yearOf } from '../lib/dates'
```

with:

```tsx
import { useToday } from '../hooks/useToday'
import { describeNextBirthday, upcomingBirthdays } from '../lib/birthdays'
import { daysBetween, yearOf } from '../lib/dates'
```

Replace:

```tsx
const SORT_KEY = 'friend-tracker:sort'
const SORTS = Object.keys(FRIEND_SORT_LABELS) as FriendSort[]
```

with:

```tsx
const SORT_KEY = 'friend-tracker:sort'
const SORTS = Object.keys(FRIEND_SORT_LABELS) as FriendSort[]
/** The most rows Birthdays soon shows. Its footer counts the rest. */
const MAX_BIRTHDAYS_SOON = 5
```

Replace:

```tsx
  }, [friends, meetups, today, sort, activeGroup, query])
```

with:

```tsx
  }, [friends, meetups, today, sort, activeGroup, query])

  const birthdaysSoon = useMemo(() => upcomingBirthdays(friends ?? [], today), [friends, today])
```

Replace:

```tsx
  if (!friends || !groups || !meetups || hintDismissed === undefined) return null
```

with:

```tsx
  if (!friends || !groups || !meetups || hintDismissed === undefined) return null

  // Hidden while searching or filtering, so the list below stays a plain filtered list.
  const showBirthdaysSoon = birthdaysSoon.length > 0 && query.trim() === '' && activeGroup === null
  const moreBirthdays = birthdaysSoon.length - MAX_BIRTHDAYS_SOON
```

Replace:

```tsx
      ) : (
        <>
          <div className="friends-filters">
```

with:

```tsx
      ) : (
        <>
          {showBirthdaysSoon && (
            <InsetGroup
              title="Birthdays soon"
              footer={moreBirthdays > 0 ? `And ${moreBirthdays} more in the next two weeks.` : undefined}
            >
              {birthdaysSoon.slice(0, MAX_BIRTHDAYS_SOON).map(({ friend, birthday }) => (
                <Row
                  key={friend.id}
                  to={`/friends/${friend.id}`}
                  leading={<Avatar name={friend.name} photo={friend.photo} seed={friend.id} />}
                  title={friend.name}
                  subtitle={describeNextBirthday(birthday, today)}
                />
              ))}
            </InsetGroup>
          )}

          <div className="friends-filters">
```

How it fits the screen (for reviewers):
- The group is inside the `friends.length === 0 ? <EmptyState> : ...` branch, so it never shows with no friends.
- `InsetGroup` with a `title` renders a `section` labelled by its `h2`, so it is the region "Birthdays soon"; its `footer` prop renders the Footnote line under the group.
- Rows use `to` with no `state`, like the Friends list rows, so the friend page's back button says "Friends".
- The `useMemo` sits above the early `return null`, like `rows`, so the hooks run in the same order on every render.

- [ ] **Step 5: Run the e2e tests and see them pass**

Run: `npx playwright test --project=iphone e2e/birthdays.spec.ts`
Expected: PASS, `8 passed`.

- [ ] **Step 6: Update DESIGN.md**

In `DESIGN.md`, under `### Friend detail column`, replace:

```markdown
Reads as one calm column, not a grid of cards: centered 96px avatar, Title name, group in Warm Ink Secondary, then a Paper White "Last seen" pill (Subhead, 1em corners so it becomes a soft box if large text wraps it between the date and the time since). Below: the notes, then **Likes** and **Dislikes** (people before numbers), then the stat row, "Month by month", and the history grouped by month.
```

with:

```markdown
Reads as one calm column, not a grid of cards: centered 96px avatar, Title name, group in Warm Ink Secondary, then a Paper White "Last seen" pill (Subhead, 1em corners so it becomes a soft box if large text wraps it between the date and the time since). Below: the notes, then **Birthday**, **Likes** and **Dislikes** (people before numbers), then the stat row, "Month by month", and the history grouped by month.
- **Birthday:** always shown. With a birthday, one inset row: a 🎂 emoji badge leading, the date as the title ("March 14, 1996", or "March 14" without a year), the countdown as the subtitle ("In 12 days · turns 31", "Tomorrow", "Today"), and a chevron. Tapping it opens the Edit friend sheet. Without one, a "+ Add birthday" chip opens the same sheet. Plain facts: no color, badge or reminder copy.
```

Replace:

```markdown
### Stat row
One Paper White group
```

with:

```markdown
### Birthdays soon
An inset group titled "Birthdays soon" at the top of the Friends tab, above the search field, listing friends whose birthday is today or in the next 14 days, soonest first. Each row is a link with the 44px avatar, the name and the countdown ("Today · turns 31", "Tomorrow", "In 5 days"), like the friend rows below it. At most 5 rows; the footer counts the rest ("And 3 more in the next two weeks."). The group is hidden when no birthday is that close, while searching, and while a group filter is on, so the list below stays a plain filtered list.

### Stat row
One Paper White group
```

- [ ] **Step 7: Run everything**

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...` with no errors.

Run: `npm test`
Expected: `Test Files  33 passed (33)` and `Tests  317 passed (317)`.

Run: `npm run e2e`
Expected: `83 passed`.

- [ ] **Step 8: Commit**

```bash
git add src/screens/FriendDetailScreen.tsx src/screens/FriendsScreen.tsx DESIGN.md e2e/helpers.ts e2e/birthdays.spec.ts
git commit -F - <<'EOF'
feat: birthday on the friend page and Birthdays soon on the Friends tab

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

### Task 5: Screenshots, the spec's planning notes, and a full check

**Files:**
- Modify: `e2e/screenshots.spec.ts:2` (imports), `:19-24` (seed friends), `:31` (Alex Rivera's birthday), `docs/superpowers/specs/2026-10-03-birthdays-design.md` (append after line 117)
- Regenerate (not committed): `e2e/screenshots/*.png`

- [ ] **Step 1: Seed birthdays for the screenshots**

In `e2e/screenshots.spec.ts`, replace:

```ts
import { addFriend, addToList, goToTab, lockHeading, logMeetup, reopenAfterAWhile, seedAppLock, stubFaceId } from './helpers.ts'
```

with:

```ts
import {
  addFriend,
  addToList,
  dayFromToday,
  goToTab,
  lockHeading,
  logMeetup,
  reopenAfterAWhile,
  seedAppLock,
  setBirthday,
  stubFaceId,
} from './helpers.ts'
```

Replace:

```ts
  await addFriend(page, 'Alex Rivera', 'College')
  await addFriend(page, 'Sam Chen', 'College')
  await addFriend(page, 'Kim Park', 'Work')
  await addFriend(page, 'Jordan Lee', 'Work')
  await addFriend(page, 'Maya Patel')
  await addFriend(page, 'Theo Brooks', 'Family')
```

with:

```ts
  // Birthdays soon shows Maya (today), Sam (in 3 days, with an age) and Theo (in 9 days).
  // Ages are multiples of 4, so a birthday that lands on Feb 29 still has a leap birth year.
  const today = dayFromToday(0)
  const inThree = dayFromToday(3)
  const inNine = dayFromToday(9)
  await addFriend(page, 'Alex Rivera', 'College')
  await addFriend(page, 'Sam Chen', 'College', { ...inThree, year: inThree.year - 28 })
  await addFriend(page, 'Kim Park', 'Work')
  await addFriend(page, 'Jordan Lee', 'Work')
  await addFriend(page, 'Maya Patel', undefined, { month: today.month, day: today.day })
  await addFriend(page, 'Theo Brooks', 'Family', { month: inNine.month, day: inNine.day })
```

Replace:

```ts
  await page.getByRole('link', { name: /Alex Rivera/ }).click()
  await addToList(page, 'Likes', 'Ramen, Board games, Hiking')
```

with:

```ts
  await page.getByRole('link', { name: /Alex Rivera/ }).click()
  // Alex's birthday is further off, so the friend page shows it but Birthdays soon doesn't
  // (and Alex keeps a single link on the Friends tab).
  const inForty = dayFromToday(40)
  await page.getByRole('region', { name: 'Birthday', exact: true }).getByRole('button', { name: 'Add birthday' }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await setBirthday(sheet, { ...inForty, year: inForty.year - 32 })
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  await addToList(page, 'Likes', 'Ramen, Board games, Hiking')
```

(`captureAll` already shoots the Friends tab as `*-02-friends.png` and Alex Rivera's page as `*-04-friend.png` and `*-05-friend-full.png`, in light, dark and large text, so no new captures are needed. It opens Alex with `getByRole('link', { name: /Alex Rivera/ })`, which stays a single link because Alex's birthday is 40 days out. The seed already waits for the last toast to clear.)

- [ ] **Step 2: Regenerate the screenshots and look at them**

Run: `npm run screenshots`
Expected: `11 passed`.

Open `e2e/screenshots/light-02-friends.png`, `dark-02-friends.png`, `large-text-02-friends.png`, the three `*-04-friend.png` files and the three `*-05-friend-full.png` files with the Read tool and check:
- **Friends tab:** "Birthdays soon" sits under the large title and above the search field, with Maya Patel "Today", Sam Chen "In 3 days · turns 28" and Theo Brooks "In 9 days", each with an avatar, on Paper White; no footer.
- **Friend page:** under the "Last seen" pill, a "Birthday" label over one row with the 🎂 badge, the date with the year as the title, "In 40 days · turns 32" under it and a chevron; then Likes and Dislikes.
- **Dark and large text:** text stays readable on the dark surfaces; at large text the rows grow and wrap instead of overflowing, and nothing runs past the 16px page margin.

If something is off, fix the CSS or markup from Tasks 3 and 4, run `npm run e2e` again, and re-run `npm run screenshots`.

- [ ] **Step 3: Record the planning decisions in the spec**

Append to the end of `docs/superpowers/specs/2026-10-03-birthdays-design.md`:

```markdown

## Decisions made while planning

Recorded in [the plan](../plans/2026-10-03-birthdays.md):

- **Out-of-range values.** A month outside 1 to 12, a day the month never has, or a year before 1900 (only possible from code or an edited backup) counts as "That date doesn't exist.". A year after this one counts as "That date is in the future.".
- **A year on its own** (month and day empty) is dropped on Save, so the friend has no birthday.
- **"Remove birthday"** shows when any of the three selects has a value, so it also clears a half-picked row.
- **Focus.** When Save finds a birthday problem, focus moves to the Birthday row (described by the error), not to a select, so iOS doesn't open a picker wheel. With a missing name too, both errors show and the name field takes focus. "Remove birthday" moves focus to the row as it disappears.
- **Accessible names.** Each select has an `aria-label` ("Birthday month", "Birthday day", "Birthday year") and the visible "Birthday" label names the row. Visible labels per select would crowd the row; the empty options say which is which.
- **Placeholder look.** The empty choice ("Month", "Day", "No year") is Warm Ink Tertiary, like other placeholders.
- **Errors** stay under the row until a select changes, wired with `aria-invalid` and `aria-describedby` like the name field.
- **Backups.** The parser takes today's date, so a birthday more than 2 days after the day the file is read is refused (the data layer and the sheet stay strict about future dates). A version 3 friend without a `birthday` key is refused, extra keys inside a birthday are dropped, and a `birthday` in a version 1 or 2 file is ignored.
- **Stored shape.** Only `month`, `day` and `year` are stored.
- **"While searching"** means a query that isn't blank after trimming, the same test the search uses.
- **Footer.** "And 1 more in the next two weeks." needs no plural form.
- **Birthdays soon rows** open the friend like the Friends list rows, so the back button says "Friends".
```

- [ ] **Step 4: Run every check**

Run: `npm test`
Expected: `Test Files  33 passed (33)` and `Tests  317 passed (317)`.

Run: `npm run build`
Expected: `tsc -b` passes and Vite prints `✓ built in ...`.

Run: `npm run e2e`
Expected: `83 passed`.

Run: `git status --short`
Expected: only `M e2e/screenshots.spec.ts` and `M docs/superpowers/specs/2026-10-03-birthdays-design.md`. (The PNGs are ignored by git.)

- [ ] **Step 5: Commit**

```bash
git add e2e/screenshots.spec.ts docs/superpowers/specs/2026-10-03-birthdays-design.md
git commit -F - <<'EOF'
test: screenshots with birthdays; record planning decisions

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
EOF
```

---

## Spec coverage

| Spec requirement | Where |
| --- | --- |
| `Friend.birthday: Birthday \| null`, `Birthday { month, day, year }` | Task 1 (`types.ts`) |
| Validity in `src/lib/birthdays.ts`: month 1 to 12, day valid for the month (Feb 29 allowed), year null or 1900 to this year, Feb 29 needs a leap year, not in the future | Task 1 (`birthdayProblem`, `isValidBirthday`) |
| No Dexie version bump; the `reading` hook sets `birthday ??= null` | Task 1 (`db.ts`) |
| `FriendInput.birthday`; `addFriend` and `updateFriend` write it; `ValidationError('Pick a valid birthday.')` | Task 1 (`friends.ts`) |
| `nextBirthday` (today included, Feb 29 to Feb 28), `daysUntilBirthday`, `ageOnNextBirthday`, `formatBirthday`, `describeNextBirthday`, `upcomingBirthdays(friends, today, days = 14)` | Task 1 |
| Backups: export v3 with `birthday`; import v1, v2 (null) and v3 (valid or `Friend N has an invalid birthday.`); other versions keep the message | Task 2 |
| Sheet: Birthday section after Group, before Notes; three native selects; the option lists; accessible names; `.field` look, same height, Month wider, wraps at large text | Task 3 (`BirthdayField`) |
| Month change resets a day the month doesn't have | Task 3 (`changeMonth`) |
| Save: both empty is null; one empty "Pick a month and a day."; "That date doesn't exist."; "That date is in the future."; `.field-error` | Task 3 (`birthdayFromFields` in `save`) |
| "Remove birthday" text button clears all three | Task 3 |
| Dirty tracking and the discard confirm include the birthday | Task 3 |
| Notes placeholder "Partner's name, how you met" | Task 3 |
| Friend page order (hero, notes, Birthday, Likes, Dislikes, stats, Month by month, History); 🎂 row with `formatBirthday` and `describeNextBirthday` opening the sheet; "+ Add birthday" chip | Task 4 |
| Birthdays soon above the search: avatar, name, countdown; opens the friend; hidden when empty, searching, filtering or with no friends; at most 5 with the footer | Task 4 |
| DESIGN.md: Friend detail column, Inputs and fields, Birthdays soon | Tasks 3 and 4 |
| Unit tests: validity, `nextBirthday`, the other helpers, data layer, reading hook, backups | Tasks 1 and 2 |
| E2E: add and edit with and without a year, the countdown, remove; validation; Birthdays soon (within 14 days, hidden while searching, opens the friend); backup round trip | Tasks 3 and 4 |
| Screenshots: friend page with a birthday and the Friends tab with Birthdays soon, light, dark and large text | Task 5 |
