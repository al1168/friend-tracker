# Friend Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first iPhone home-screen web app (PWA) that tracks friends, when you last saw each one, and how often you met this year vs last year.

**Architecture:** React + TypeScript single-page app built with Vite, storing everything on the device in IndexedDB (via Dexie). Pure statistics functions in `src/stats/` are fed plain arrays from live database queries. UI follows iOS patterns (tab bar, large titles, inset lists, bottom sheets) per `PRODUCT.md` and `DESIGN.md`. Deployed as static files to GitHub Pages; installed via Safari → Add to Home Screen.

**Tech Stack:** Vite 8, React 19, TypeScript 6, react-router 7 (hash routing), Dexie 4 + dexie-react-hooks, vite-plugin-pwa 1.x (Workbox service worker), @vite-pwa/assets-generator (icons), Vitest 5 + fake-indexeddb (unit tests), Playwright (WebKit, iPhone 13 emulation) for end-to-end tests.

**Spec:** [docs/superpowers/specs/2026-10-02-friend-tracker-design.md](../specs/2026-10-02-friend-tracker-design.md). Design context: [PRODUCT.md](../../../PRODUCT.md), [DESIGN.md](../../../DESIGN.md).

---

## Ground rules for every task

- Run all commands from the project root: `C:\Users\luald\OneDrive\Desktop\Friend tracker` (Git Bash paths: `/c/Users/luald/OneDrive/Desktop/Friend tracker`).
- TypeScript config uses `verbatimModuleSyntax` (type-only imports must use `import type` / inline `type`), `erasableSyntaxOnly` (no enums, namespaces, or constructor parameter properties), `noUnusedLocals`, and `noUnusedParameters`.
- Import paths are extensionless inside `src/` (e.g. `import { db } from './db'`). Inside `e2e/`, import helpers with the `.ts` extension (`./helpers.ts`).
- Copy (UI text) never uses em dashes. Use commas, colons, periods or parentheses.
- "Today" in the app is the phone's local date as `YYYY-MM-DD`.
- Commit after each task with the message given. End every commit message with the line `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Verification commands:
  - Unit tests: `npm test`
  - Type check + production build: `npm run build`
  - End-to-end tests (WebKit, iPhone-sized): `npm run e2e`

## Deviations from the spec (decided while planning)

1. **Photos are stored as JPEG data-URL strings**, not Blobs. Same size limit (longest side ≤ 400px). This keeps backups trivial and avoids Blob cloning problems in tests. Task 1 updates the spec.
2. **No row-reorder animation after logging.** The "happy moment" is the toast with an animated check. Task 1 updates the spec.
3. **The last remaining meetup type can't be deleted** (otherwise nothing could be logged). Task 1 updates the spec.

## File structure

```
index.html                     App HTML shell, iOS meta tags
package.json                   Scripts + dependencies
vite.config.ts                 Vite + React + PWA plugin
vitest.config.ts               Unit test config (Node + fake IndexedDB)
playwright.config.ts           E2E config (WebKit, iPhone 13)
pwa-assets.config.ts           Icon generation config
tsconfig.json / tsconfig.app.json / tsconfig.node.json
public/logo.svg                App icon source (generated PNG icons live beside it)
.github/workflows/deploy.yml   Build + publish to GitHub Pages
e2e/                           Playwright specs + helpers.ts
src/
  main.tsx                     Entry: styles, persistent storage, render
  App.tsx                      Providers, routes, tab bar
  types.ts                     Friend, Group, MeetupType, Meetup
  lib/
    dates.ts                   ISO date math + formatting
    text.ts                    Relative time, name lists, plurals, initials
    tint.ts                    Avatar tint picker
    ids.ts                     UUIDs (works on insecure LAN dev too)
    image.ts                   Resize photo to JPEG data URL
    platform.ts                Standalone (home screen) detection
  stats/                       Pure functions, no React/DB
    lastSeen.ts  counts.ts  breakdowns.ts  sortFriends.ts  recent.ts  history.ts
  db/
    db.ts                      Dexie schema, seed, reset helper
    defaults.ts                Default meetup types
    errors.ts                  ValidationError
    settings.ts                Key/value settings
    friends.ts meetups.ts groups.ts meetupTypes.ts   Repositories
  backup/
    format.ts                  Backup file shape, createBackup, parseBackup
    storage.ts                 readAllData, replaceAllData, parseBackupFile
    exportBackup.ts            Share sheet / download glue
  data/hooks.ts                Live-query hooks for screens
  hooks/                       useToday, useScrollLock, useKeyboardInset
  styles/tokens.css base.css   Design tokens (OKLCH, light+dark), shared primitives
  components/                  Page, TabBar, ScrollManager, InsetGroup/Row, Avatar, Chip,
                               EmptyState, Sheet, ActionSheet, Toast, LogButton, StatRow,
                               MonthBars, HBarList, InstallHint, icons
  sheets/                      sheetsContext, SheetsProvider, FriendSheet, MeetupSheet
  screens/                     FriendsScreen, FriendDetailScreen, StatsScreen,
                               SettingsScreen, GroupsScreen, MeetupTypesScreen
```

---

### Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `index.html`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/test/setup.ts`
- Modify: `docs/superpowers/specs/2026-10-02-friend-tracker-design.md`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "friend-tracker",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test --project=iphone",
    "icons": "pwa-assets-generator"
  },
  "dependencies": {
    "dexie": "^4.4.6",
    "dexie-react-hooks": "^4.4.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-router": "^7.18.4"
  },
  "devDependencies": {
    "@playwright/test": "^1.63.0",
    "@types/node": "^24.13.3",
    "@types/react": "^19.2.18",
    "@types/react-dom": "^19.2.7",
    "@vite-pwa/assets-generator": "^1.0.4",
    "@vitejs/plugin-react": "^6.1.1",
    "fake-indexeddb": "^6.2.5",
    "typescript": "~6.0.2",
    "vite": "^8.3.0",
    "vite-plugin-pwa": "^1.3.0",
    "vitest": "^5.0.3"
  }
}
```

- [ ] **Step 2: Create the TypeScript configs**

`tsconfig.json`:

```json
{
  "files": [],
  "references": [{ "path": "./tsconfig.app.json" }, { "path": "./tsconfig.node.json" }]
}
```

`tsconfig.app.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "module": "esnext",
    "types": ["vite/client"],
    "allowArbitraryExtensions": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "erasableSyntaxOnly": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
    "target": "es2023",
    "lib": ["ES2023", "DOM"],
    "types": ["node"],
    "skipLibCheck": true,
    "module": "nodenext",
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
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts", "pwa-assets.config.ts", "e2e"]
}
```

- [ ] **Step 3: Create `vite.config.ts` and `vitest.config.ts`**

`vite.config.ts` (the PWA plugin is added in Task 20):

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  plugins: [react()],
})
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
})
```

`src/test/setup.ts`:

```ts
import 'fake-indexeddb/auto'
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Friend Tracker</title>
    <meta name="description" content="Remember when you last saw your friends." />
    <meta name="color-scheme" content="light dark" />
    <meta name="theme-color" content="#F8F2ED" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#16120F" media="(prefers-color-scheme: dark)" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create a placeholder app**

`src/App.tsx`:

```tsx
export default function App() {
  return <h1>Friend Tracker</h1>
}
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 6: Create `.gitignore`**

```
node_modules
dist
dev-dist
*.local
.DS_Store
test-results
playwright-report
e2e/screenshots
```

- [ ] **Step 7: Install and verify**

Run: `npm install`
Expected: completes with `found 0 vulnerabilities` (warnings about funding are fine).

Run: `npm run build`
Expected: ends with `✓ built in …` and creates `dist/index.html`.

Run: `npx vitest run --passWithNoTests`
Expected: `No test files found, exiting with code 0`.

- [ ] **Step 8: Update the spec with the planning decisions**

In `docs/superpowers/specs/2026-10-02-friend-tracker-design.md`:

Replace:
```
| Friend | `id`, `name` (required, trimmed, non-empty), `groupId` (nullable), `photo` (nullable Blob, JPEG, longest side ≤ 400px), `notes` (string, may be empty), `createdAt` (ISO timestamp) |
```
with:
```
| Friend | `id`, `name` (required, trimmed, non-empty), `groupId` (nullable), `photo` (nullable string: a JPEG data URL, longest side ≤ 400px), `notes` (string, may be empty), `createdAt` (ISO timestamp) |
```

Replace:
```
- A **meetup type** in use by any meetup cannot be deleted (it can be renamed). The UI says how many meetups use it. Deleting an unused type asks for confirmation.
```
with:
```
- A **meetup type** in use by any meetup cannot be deleted (it can be renamed). The UI says how many meetups use it. The last remaining type can't be deleted either. Deleting an unused type asks for confirmation.
```

Replace:
```
After saving a new meetup, the sheet slides away and a toast says "Logged with Alex and Sam" with Undo (5 seconds; Undo removes it). Editing shows a plain "Saved" toast. Rows reorder with a short transition.
```
with:
```
After saving a new meetup, the sheet slides away and a toast says "Logged with Alex and Sam" with Undo (5 seconds; Undo removes it). The toast's check mark draws itself in as the small happy moment. Editing shows a plain "Saved" toast.
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TypeScript project

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Date helpers

**Files:**
- Create: `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/dates.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  addDays,
  daysBetween,
  formatDate,
  formatMonthYear,
  isISODate,
  monthIndexOf,
  toISODate,
  yearOf,
} from './dates'

describe('toISODate', () => {
  it('formats a local date with zero padding', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('isISODate', () => {
  it('accepts real calendar dates', () => {
    expect(isISODate('2026-10-02')).toBe(true)
    expect(isISODate('2024-02-29')).toBe(true)
  })

  it('rejects impossible or malformed dates', () => {
    expect(isISODate('2026-02-29')).toBe(false)
    expect(isISODate('2026-13-01')).toBe(false)
    expect(isISODate('2026-1-5')).toBe(false)
    expect(isISODate('hello')).toBe(false)
  })
})

describe('daysBetween', () => {
  it('counts whole calendar days', () => {
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
    expect(daysBetween('2026-01-10', '2026-01-01')).toBe(-9)
  })

  it('is not affected by daylight saving changes', () => {
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })
})

describe('addDays', () => {
  it('moves across month, year and leap-day boundaries', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })
})

describe('yearOf and monthIndexOf', () => {
  it('read parts of an ISO date', () => {
    expect(yearOf('2026-09-12')).toBe(2026)
    expect(monthIndexOf('2026-09-12')).toBe(8)
    expect(monthIndexOf('2026-01-01')).toBe(0)
  })
})

describe('formatDate', () => {
  it('omits the year for dates in the current year', () => {
    expect(formatDate('2026-09-12', '2026-10-02')).toBe('Sat, Sep 12')
  })

  it('includes the year for other years', () => {
    expect(formatDate('2025-09-12', '2026-10-02')).toBe('Fri, Sep 12, 2025')
  })
})

describe('formatMonthYear', () => {
  it('formats a month heading', () => {
    expect(formatMonthYear('2026-09-12')).toBe('September 2026')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: FAIL, `Failed to resolve import "./dates"` (or "Cannot find module").

- [ ] **Step 3: Implement `src/lib/dates.ts`**

```ts
/** A calendar date in the phone's local time zone, formatted YYYY-MM-DD. */
export type ISODate = string

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

function parts(iso: ISODate): [number, number, number] {
  const [year, month, day] = iso.split('-').map(Number)
  return [year, month, day]
}

function toUTCms(iso: ISODate): number {
  const [year, month, day] = parts(iso)
  return Date.UTC(year, month - 1, day)
}

export function isISODate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const [year, month, day] = parts(value)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function toISODate(date: Date): ISODate {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayISO(): ISODate {
  return toISODate(new Date())
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUTCms(to) - toUTCms(from)) / DAY_MS)
}

export function addDays(iso: ISODate, days: number): ISODate {
  return new Date(toUTCms(iso) + days * DAY_MS).toISOString().slice(0, 10)
}

export function yearOf(iso: ISODate): number {
  return Number(iso.slice(0, 4))
}

/** 0 = January */
export function monthIndexOf(iso: ISODate): number {
  return Number(iso.slice(5, 7)) - 1
}

const dayFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
})
const dayFormatWithYear = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})
const monthYearFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** "Sat, Sep 12" in the current year, "Fri, Sep 12, 2025" otherwise. */
export function formatDate(iso: ISODate, today: ISODate): string {
  const date = new Date(toUTCms(iso))
  return yearOf(iso) === yearOf(today) ? dayFormat.format(date) : dayFormatWithYear.format(date)
}

/** "September 2026" */
export function formatMonthYear(iso: ISODate): string {
  return monthYearFormat.format(new Date(toUTCms(iso)))
}

export const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts src/lib/dates.test.ts
git commit -m "feat: add calendar date helpers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Text helpers and avatar tint

**Files:**
- Create: `src/lib/text.ts`, `src/lib/tint.ts`
- Test: `src/lib/text.test.ts`, `src/lib/tint.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/text.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  compareNames,
  describeLastBackup,
  firstGrapheme,
  formatNameList,
  formatSince,
  initials,
  plural,
  sameName,
} from './text'

describe('formatSince', () => {
  it.each([
    [0, 'Today'],
    [1, 'Yesterday'],
    [2, '2 days ago'],
    [13, '13 days ago'],
    [14, '2 weeks ago'],
    [59, '8 weeks ago'],
    [60, '2 months ago'],
    [364, '12 months ago'],
    [365, '1 year ago'],
    [800, '2 years ago'],
  ])('%i days → %s', (days, text) => {
    expect(formatSince(days)).toBe(text)
  })
})

describe('plural', () => {
  it('picks singular or plural', () => {
    expect(plural(1, 'meetup')).toBe('1 meetup')
    expect(plural(2, 'meetup')).toBe('2 meetups')
    expect(plural(0, 'friend')).toBe('0 friends')
  })
})

describe('formatNameList', () => {
  it('joins names naturally', () => {
    expect(formatNameList([])).toBe('')
    expect(formatNameList(['Alex'])).toBe('Alex')
    expect(formatNameList(['Alex', 'Sam'])).toBe('Alex and Sam')
    expect(formatNameList(['Alex', 'Sam', 'Kim'])).toBe('Alex, Sam and Kim')
    expect(formatNameList(['Alex', 'Sam', 'Kim', 'Lee', 'Max'])).toBe('Alex, Sam and 3 others')
  })
})

describe('compareNames', () => {
  it('sorts names ignoring case', () => {
    expect(['bob', 'Alice', 'carol'].sort(compareNames)).toEqual(['Alice', 'bob', 'carol'])
  })
})

describe('sameName', () => {
  it('ignores case and surrounding spaces', () => {
    expect(sameName(' Work ', 'work')).toBe(true)
    expect(sameName('Work', 'Works')).toBe(false)
  })
})

describe('initials', () => {
  it('uses the first and last word', () => {
    expect(initials('Alex Smith')).toBe('AS')
    expect(initials('Mary Jane Watson')).toBe('MW')
    expect(initials('alex')).toBe('A')
    expect(initials('   ')).toBe('?')
  })
})

describe('firstGrapheme', () => {
  it('keeps whole emoji, including skin tones', () => {
    expect(firstGrapheme('👍🏽 yes')).toBe('👍🏽')
    expect(firstGrapheme('  ab')).toBe('a')
    expect(firstGrapheme('')).toBe('')
  })
})

describe('describeLastBackup', () => {
  it('describes when the last backup happened', () => {
    expect(describeLastBackup(null, '2026-10-02')).toBe('Never backed up')
    expect(describeLastBackup(new Date(2026, 9, 2, 9, 30).toISOString(), '2026-10-02')).toBe('Last backup: today')
    expect(describeLastBackup(new Date(2026, 9, 1, 22, 0).toISOString(), '2026-10-02')).toBe('Last backup: yesterday')
    expect(describeLastBackup(new Date(2026, 8, 11, 12, 0).toISOString(), '2026-10-02')).toBe('Last backup: 3 weeks ago')
  })
})
```

`src/lib/tint.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { TINT_COUNT, tintIndex } from './tint'

describe('tintIndex', () => {
  it('is stable for the same seed', () => {
    expect(tintIndex('friend-123')).toBe(tintIndex('friend-123'))
  })

  it('stays in range and spreads across tints', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const values = seeds.map(tintIndex)
    expect(values.every((v) => v >= 0 && v < TINT_COUNT)).toBe(true)
    expect(new Set(values).size).toBeGreaterThan(2)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/text.test.ts src/lib/tint.test.ts`
Expected: FAIL, cannot resolve `./text` and `./tint`.

- [ ] **Step 3: Implement `src/lib/text.ts`**

```ts
import { daysBetween, toISODate, type ISODate } from './dates'

/** Neutral "time since" wording. Never phrased as a warning. */
export function formatSince(days: number): string {
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  const years = Math.floor(days / 365)
  return years === 1 ? '1 year ago' : `${years} years ago`
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`
}

/** "Alex", "Alex and Sam", "Alex, Sam and Kim", "Alex, Sam and 3 others" */
export function formatNameList(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  if (names.length === 3) return `${names[0]}, ${names[1]} and ${names[2]}`
  return `${names[0]}, ${names[1]} and ${names.length - 2} others`
}

const collator = new Intl.Collator('en', { sensitivity: 'base' })

export function compareNames(a: string, b: string): number {
  return collator.compare(a, b)
}

export function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()
}

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })

/** The first user-perceived character (keeps multi-part emoji together). */
export function firstGrapheme(value: string): string {
  for (const { segment } of segmenter.segment(value.trim())) return segment
  return ''
}

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = firstGrapheme(words[0])
  const last = words.length > 1 ? firstGrapheme(words[words.length - 1]) : ''
  return (first + last).toUpperCase()
}

export function describeLastBackup(lastBackupAt: string | null, today: ISODate): string {
  if (!lastBackupAt) return 'Never backed up'
  const since = formatSince(daysBetween(toISODate(new Date(lastBackupAt)), today))
  return `Last backup: ${since.charAt(0).toLowerCase()}${since.slice(1)}`
}
```

- [ ] **Step 4: Implement `src/lib/tint.ts`**

```ts
export const TINT_COUNT = 6

/** Picks one of the soft avatar tints, stable for a given seed (the friend id). */
export function tintIndex(seed: string): number {
  let hash = 0
  for (const char of seed) hash = (Math.imul(hash, 31) + (char.codePointAt(0) ?? 0)) >>> 0
  return hash % TINT_COUNT
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/lib`
Expected: PASS (all `dates`, `text`, `tint` tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/text.ts src/lib/text.test.ts src/lib/tint.ts src/lib/tint.test.ts
git commit -m "feat: add text formatting and avatar tint helpers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Data types, last seen, and counts

**Files:**
- Create: `src/types.ts`, `src/test/fixtures.ts`, `src/stats/lastSeen.ts`, `src/stats/counts.ts`
- Test: `src/stats/lastSeen.test.ts`, `src/stats/counts.test.ts`

- [ ] **Step 1: Create the shared types**

`src/types.ts`:

```ts
import type { ISODate } from './lib/dates'

export interface Friend {
  id: string
  name: string
  groupId: string | null
  /** JPEG data URL, longest side ≤ 400px */
  photo: string | null
  notes: string
  createdAt: string
}

export interface Group {
  id: string
  name: string
}

export interface MeetupType {
  id: string
  name: string
  emoji: string
  order: number
}

export interface Meetup {
  id: string
  date: ISODate
  typeId: string
  friendIds: string[]
  note: string
  createdAt: string
}
```

- [ ] **Step 2: Create test fixtures**

`src/test/fixtures.ts`:

```ts
import type { Friend, Group, Meetup, MeetupType } from '../types'

export const TODAY = '2026-10-02'

export function friend(id: string, name: string, groupId: string | null = null): Friend {
  return { id, name, groupId, photo: null, notes: '', createdAt: '2026-01-01T00:00:00.000Z' }
}

export function meetup(id: string, date: string, friendIds: string[], typeId = 'coffee'): Meetup {
  return { id, date, typeId, friendIds, note: '', createdAt: `${date}T12:00:00.000Z` }
}

export function meetupType(id: string, name: string, order: number, emoji = '☕'): MeetupType {
  return { id, name, emoji, order }
}

export function group(id: string, name: string): Group {
  return { id, name }
}
```

- [ ] **Step 3: Write the failing tests**

`src/stats/lastSeen.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { meetup, TODAY } from '../test/fixtures'
import { lastSeenByFriend } from './lastSeen'

describe('lastSeenByFriend', () => {
  it('returns the most recent past meetup date for each friend', () => {
    const result = lastSeenByFriend(
      [
        meetup('m1', '2026-03-01', ['alex']),
        meetup('m2', '2026-09-20', ['alex', 'sam']),
        meetup('m3', '2026-05-05', ['sam']),
      ],
      TODAY,
    )
    expect(result.get('alex')).toBe('2026-09-20')
    expect(result.get('sam')).toBe('2026-09-20')
  })

  it('counts a meetup dated today', () => {
    expect(lastSeenByFriend([meetup('m1', TODAY, ['alex'])], TODAY).get('alex')).toBe(TODAY)
  })

  it('ignores future meetups', () => {
    const result = lastSeenByFriend(
      [
        meetup('m1', '2026-08-01', ['alex']),
        meetup('m2', '2026-10-03', ['alex']),
        meetup('m3', '2026-12-25', ['sam']),
      ],
      TODAY,
    )
    expect(result.get('alex')).toBe('2026-08-01')
    expect(result.has('sam')).toBe(false)
  })

  it('is empty with no meetups', () => {
    expect(lastSeenByFriend([], TODAY).size).toBe(0)
  })
})
```

`src/stats/counts.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { meetup, TODAY } from '../test/fixtures'
import { allTimeCountsByFriend, countsByFriendForYear, monthlyCounts, totalsForYear } from './counts'

const meetups = [
  meetup('m1', '2025-12-31', ['alex']),
  meetup('m2', '2026-01-01', ['alex', 'sam']),
  meetup('m3', '2026-06-15', ['alex']),
  meetup('m4', '2026-11-01', ['alex']), // future: ignored everywhere
]

describe('countsByFriendForYear', () => {
  it('counts meetups per friend inside the calendar year', () => {
    const counts = countsByFriendForYear(meetups, 2026, TODAY)
    expect(counts.get('alex')).toBe(2)
    expect(counts.get('sam')).toBe(1)
  })

  it('puts Dec 31 in the earlier year', () => {
    const counts = countsByFriendForYear(meetups, 2025, TODAY)
    expect(counts.get('alex')).toBe(1)
    expect(counts.has('sam')).toBe(false)
  })
})

describe('allTimeCountsByFriend', () => {
  it('counts every past meetup', () => {
    const counts = allTimeCountsByFriend(meetups, TODAY)
    expect(counts.get('alex')).toBe(3)
    expect(counts.get('sam')).toBe(1)
  })
})

describe('monthlyCounts', () => {
  it('counts meetups per month for one friend, including leap day', () => {
    const counts = monthlyCounts(
      'alex',
      [
        meetup('m1', '2024-01-10', ['alex']),
        meetup('m2', '2024-02-29', ['alex', 'sam']),
        meetup('m3', '2024-02-03', ['alex']),
        meetup('m4', '2024-12-31', ['sam']),
        meetup('m5', '2023-02-01', ['alex']),
      ],
      2024,
      TODAY,
    )
    expect(counts).toEqual([1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('skips future meetups', () => {
    expect(monthlyCounts('alex', [meetup('m1', '2026-10-20', ['alex'])], 2026, TODAY)[9]).toBe(0)
  })
})

describe('totalsForYear', () => {
  it('counts a group meetup once and friends distinctly', () => {
    const totals = totalsForYear(
      [
        meetup('m1', '2026-02-01', ['alex', 'sam']),
        meetup('m2', '2026-03-01', ['alex']),
        meetup('m3', '2025-03-01', ['kim']),
      ],
      2026,
      TODAY,
    )
    expect(totals).toEqual({ meetups: 2, friends: 2 })
  })

  it('is zero for an empty year', () => {
    expect(totalsForYear([], 2026, TODAY)).toEqual({ meetups: 0, friends: 0 })
  })
})
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `npx vitest run src/stats`
Expected: FAIL, cannot resolve `./lastSeen` and `./counts`.

- [ ] **Step 5: Implement `src/stats/lastSeen.ts`**

```ts
import type { ISODate } from '../lib/dates'
import type { Meetup } from '../types'

/** friendId → date of their most recent meetup on or before today. */
export function lastSeenByFriend(meetups: Meetup[], today: ISODate): Map<string, ISODate> {
  const result = new Map<string, ISODate>()
  for (const meetup of meetups) {
    if (meetup.date > today) continue
    for (const friendId of meetup.friendIds) {
      const current = result.get(friendId)
      if (current === undefined || meetup.date > current) result.set(friendId, meetup.date)
    }
  }
  return result
}
```

- [ ] **Step 6: Implement `src/stats/counts.ts`**

```ts
import { monthIndexOf, yearOf, type ISODate } from '../lib/dates'
import type { Meetup } from '../types'

/** Meetups dated on or before today. Future meetups never count. */
export function pastMeetups(meetups: Meetup[], today: ISODate): Meetup[] {
  return meetups.filter((meetup) => meetup.date <= today)
}

export function meetupsInYear(meetups: Meetup[], year: number, today: ISODate): Meetup[] {
  return pastMeetups(meetups, today).filter((meetup) => yearOf(meetup.date) === year)
}

function countByFriend(meetups: Meetup[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const meetup of meetups) {
    for (const friendId of meetup.friendIds) counts.set(friendId, (counts.get(friendId) ?? 0) + 1)
  }
  return counts
}

/** friendId → number of meetups with them in `year`. */
export function countsByFriendForYear(meetups: Meetup[], year: number, today: ISODate): Map<string, number> {
  return countByFriend(meetupsInYear(meetups, year, today))
}

/** friendId → number of meetups with them, ever. */
export function allTimeCountsByFriend(meetups: Meetup[], today: ISODate): Map<string, number> {
  return countByFriend(pastMeetups(meetups, today))
}

/** Meetups with one friend per month of `year` (index 0 = January). */
export function monthlyCounts(friendId: string, meetups: Meetup[], year: number, today: ISODate): number[] {
  const counts = Array.from({ length: 12 }, () => 0)
  for (const meetup of meetupsInYear(meetups, year, today)) {
    if (meetup.friendIds.includes(friendId)) counts[monthIndexOf(meetup.date)] += 1
  }
  return counts
}

export interface YearTotals {
  meetups: number
  friends: number
}

/** Each meetup counts once, however many friends were there. */
export function totalsForYear(meetups: Meetup[], year: number, today: ISODate): YearTotals {
  const inYear = meetupsInYear(meetups, year, today)
  const friendIds = new Set(inYear.flatMap((meetup) => meetup.friendIds))
  return { meetups: inYear.length, friends: friendIds.size }
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/stats`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/types.ts src/test/fixtures.ts src/stats
git commit -m "feat: add data types and last-seen and yearly count stats

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Breakdowns, top friends, and not-seen list

**Files:**
- Create: `src/stats/breakdowns.ts`
- Test: `src/stats/breakdowns.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/stats/breakdowns.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { friend, group, meetup, meetupType, TODAY } from '../test/fixtures'
import { friendsNotSeenInYear, groupBreakdown, NO_GROUP_KEY, topFriends, typeBreakdown } from './breakdowns'

const types = [meetupType('coffee', 'Coffee', 0, '☕'), meetupType('meal', 'Meal', 1, '🍽'), meetupType('call', 'Call', 2, '📞')]
const groups = [group('college', 'College'), group('work', 'Work')]
const friends = [
  friend('alex', 'Alex', 'college'),
  friend('sam', 'Sam', 'college'),
  friend('kim', 'Kim', 'work'),
  friend('lee', 'Lee'),
]

describe('typeBreakdown', () => {
  it('counts each meetup once by type, with the previous year alongside', () => {
    const rows = typeBreakdown(
      [
        meetup('m1', '2026-01-05', ['alex', 'sam'], 'meal'),
        meetup('m2', '2026-02-05', ['alex'], 'meal'),
        meetup('m3', '2026-03-05', ['alex'], 'coffee'),
        meetup('m4', '2025-03-05', ['alex'], 'call'),
        meetup('m5', '2025-04-05', ['alex'], 'coffee'),
      ],
      types,
      2026,
      TODAY,
    )
    expect(rows).toEqual([
      { key: 'meal', label: 'Meal', emoji: '🍽', count: 2, previousCount: 0 },
      { key: 'coffee', label: 'Coffee', emoji: '☕', count: 1, previousCount: 1 },
      { key: 'call', label: 'Call', emoji: '📞', count: 0, previousCount: 1 },
    ])
  })

  it('leaves out types unused in both years', () => {
    expect(typeBreakdown([], types, 2026, TODAY)).toEqual([])
  })
})

describe('groupBreakdown', () => {
  it('counts a meetup once per group, even with two friends from that group', () => {
    const rows = groupBreakdown(
      [
        meetup('m1', '2026-01-05', ['alex', 'sam']),
        meetup('m2', '2026-02-05', ['alex', 'kim']),
        meetup('m3', '2026-03-05', ['lee']),
        meetup('m4', '2025-03-05', ['kim']),
      ],
      friends,
      groups,
      2026,
      TODAY,
    )
    expect(rows).toEqual([
      { key: 'college', label: 'College', emoji: null, count: 2, previousCount: 0 },
      { key: 'work', label: 'Work', emoji: null, count: 1, previousCount: 1 },
      { key: NO_GROUP_KEY, label: 'No group', emoji: null, count: 1, previousCount: 0 },
    ])
  })

  it('ignores friends that no longer exist', () => {
    expect(groupBreakdown([meetup('m1', '2026-01-05', ['ghost'])], friends, groups, 2026, TODAY)).toEqual([])
  })
})

describe('topFriends', () => {
  it('ranks friends by meetups this year, ties by name, with last year alongside', () => {
    const rows = topFriends(
      [
        meetup('m1', '2026-01-05', ['sam', 'alex']),
        meetup('m2', '2026-02-05', ['kim']),
        meetup('m3', '2026-03-05', ['kim']),
        meetup('m4', '2025-03-05', ['alex']),
      ],
      friends,
      2026,
      TODAY,
    )
    expect(rows.map((row) => [row.friend.id, row.count, row.previousCount])).toEqual([
      ['kim', 2, 0],
      ['alex', 1, 1],
      ['sam', 1, 0],
    ])
  })

  it('respects the limit and leaves out friends not seen this year', () => {
    const rows = topFriends(
      [meetup('m1', '2026-01-05', ['alex']), meetup('m2', '2026-01-06', ['sam'])],
      friends,
      2026,
      TODAY,
      1,
    )
    expect(rows.map((row) => row.friend.id)).toEqual(['alex'])
  })
})

describe('friendsNotSeenInYear', () => {
  it('lists friends with no past meetups in the year, by name', () => {
    const result = friendsNotSeenInYear(
      [meetup('m1', '2026-01-05', ['alex']), meetup('m2', '2026-12-01', ['kim'])],
      friends,
      2026,
      TODAY,
    )
    expect(result.map((f) => f.id)).toEqual(['kim', 'lee', 'sam'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/stats/breakdowns.test.ts`
Expected: FAIL, cannot resolve `./breakdowns`.

- [ ] **Step 3: Implement `src/stats/breakdowns.ts`**

```ts
import type { ISODate } from '../lib/dates'
import { compareNames } from '../lib/text'
import type { Friend, Group, Meetup, MeetupType } from '../types'
import { countsByFriendForYear, meetupsInYear } from './counts'

export const NO_GROUP_KEY = '__none__'

export interface BreakdownRow {
  key: string
  label: string
  emoji: string | null
  count: number
  previousCount: number
}

export interface FriendYearRow {
  friend: Friend
  count: number
  previousCount: number
}

function byCounts(a: { count: number; previousCount: number }, b: { count: number; previousCount: number }): number {
  return b.count - a.count || b.previousCount - a.previousCount
}

/** Meetups per type for `year` and the year before. Each meetup counts once. */
export function typeBreakdown(meetups: Meetup[], types: MeetupType[], year: number, today: ISODate): BreakdownRow[] {
  const countTypes = (y: number) => {
    const counts = new Map<string, number>()
    for (const meetup of meetupsInYear(meetups, y, today)) counts.set(meetup.typeId, (counts.get(meetup.typeId) ?? 0) + 1)
    return counts
  }
  const current = countTypes(year)
  const previous = countTypes(year - 1)
  return types
    .map((type) => ({
      key: type.id,
      label: type.name,
      emoji: type.emoji,
      count: current.get(type.id) ?? 0,
      previousCount: previous.get(type.id) ?? 0,
      order: type.order,
    }))
    .filter((row) => row.count > 0 || row.previousCount > 0)
    .sort((a, b) => byCounts(a, b) || a.order - b.order)
    .map(({ key, label, emoji, count, previousCount }) => ({ key, label, emoji, count, previousCount }))
}

/** Meetups per group. A meetup with two friends from one group counts once for that group. */
export function groupBreakdown(
  meetups: Meetup[],
  friends: Friend[],
  groups: Group[],
  year: number,
  today: ISODate,
): BreakdownRow[] {
  const groupOf = new Map(friends.map((f) => [f.id, f.groupId ?? NO_GROUP_KEY] as const))
  const countGroups = (y: number) => {
    const counts = new Map<string, number>()
    for (const meetup of meetupsInYear(meetups, y, today)) {
      const keys = new Set<string>()
      for (const friendId of meetup.friendIds) {
        const key = groupOf.get(friendId)
        if (key !== undefined) keys.add(key)
      }
      for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return counts
  }
  const current = countGroups(year)
  const previous = countGroups(year - 1)
  const labels = [...groups.map((g) => ({ key: g.id, label: g.name })), { key: NO_GROUP_KEY, label: 'No group' }]
  return labels
    .map(({ key, label }) => ({
      key,
      label,
      emoji: null,
      count: current.get(key) ?? 0,
      previousCount: previous.get(key) ?? 0,
    }))
    .filter((row) => row.count > 0 || row.previousCount > 0)
    .sort((a, b) => byCounts(a, b) || compareNames(a.label, b.label))
}

/** Friends seen most in `year` (at least once), ties broken by name. */
export function topFriends(
  meetups: Meetup[],
  friends: Friend[],
  year: number,
  today: ISODate,
  limit = 10,
): FriendYearRow[] {
  const current = countsByFriendForYear(meetups, year, today)
  const previous = countsByFriendForYear(meetups, year - 1, today)
  return friends
    .map((friend) => ({ friend, count: current.get(friend.id) ?? 0, previousCount: previous.get(friend.id) ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || compareNames(a.friend.name, b.friend.name))
    .slice(0, limit)
}

/** Friends with no meetups (up to today) in `year`, by name. */
export function friendsNotSeenInYear(meetups: Meetup[], friends: Friend[], year: number, today: ISODate): Friend[] {
  const counts = countsByFriendForYear(meetups, year, today)
  return friends.filter((friend) => !counts.has(friend.id)).sort((a, b) => compareNames(a.name, b.name))
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/stats/breakdowns.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/stats/breakdowns.ts src/stats/breakdowns.test.ts
git commit -m "feat: add type and group breakdowns, top friends, not-seen list

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Sorting, recent friends, and history grouping

**Files:**
- Create: `src/stats/sortFriends.ts`, `src/stats/recent.ts`, `src/stats/history.ts`
- Test: `src/stats/sortFriends.test.ts`, `src/stats/recent.test.ts`, `src/stats/history.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/stats/sortFriends.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { friend, meetup, TODAY } from '../test/fixtures'
import { sortFriends } from './sortFriends'

const friends = [friend('alex', 'Alex'), friend('bea', 'bea'), friend('cal', 'Cal'), friend('dee', 'Dee')]
const meetups = [
  meetup('m1', '2026-09-30', ['alex']),
  meetup('m2', '2026-05-01', ['cal']),
  meetup('m3', '2026-06-01', ['cal']),
  meetup('m4', '2025-01-01', ['dee']),
]

describe('sortFriends', () => {
  it('sorts by longest since last seen, never-seen first', () => {
    expect(sortFriends(friends, meetups, 'lastSeen', TODAY).map((f) => f.id)).toEqual(['bea', 'dee', 'cal', 'alex'])
  })

  it('breaks last-seen ties by name', () => {
    const tied = [friend('zed', 'Zed'), friend('amy', 'Amy')]
    const result = sortFriends(tied, [meetup('m1', '2026-01-01', ['zed', 'amy'])], 'lastSeen', TODAY)
    expect(result.map((f) => f.id)).toEqual(['amy', 'zed'])
  })

  it('sorts by name ignoring case', () => {
    expect(sortFriends(friends, meetups, 'name', TODAY).map((f) => f.name)).toEqual(['Alex', 'bea', 'Cal', 'Dee'])
  })

  it('sorts by most seen this year', () => {
    expect(sortFriends(friends, meetups, 'mostThisYear', TODAY).map((f) => f.id)).toEqual(['cal', 'alex', 'bea', 'dee'])
  })

  it('does not modify the input array', () => {
    const copy = [...friends]
    sortFriends(friends, meetups, 'name', TODAY)
    expect(friends).toEqual(copy)
  })
})
```

`src/stats/recent.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { friend, meetup, TODAY } from '../test/fixtures'
import { recentFriends } from './recent'

const friends = [friend('alex', 'Alex'), friend('bea', 'bea'), friend('cal', 'Cal'), friend('dee', 'Dee')]
const meetups = [
  meetup('m1', '2026-09-30', ['alex']),
  meetup('m2', '2026-06-01', ['cal']),
  meetup('m3', '2025-01-01', ['dee']),
]

describe('recentFriends', () => {
  it('lists recently seen friends first, then never-seen friends by name', () => {
    expect(recentFriends(friends, meetups, TODAY).map((f) => f.id)).toEqual(['alex', 'cal', 'dee', 'bea'])
  })

  it('caps the list', () => {
    expect(recentFriends(friends, meetups, TODAY, 2).map((f) => f.id)).toEqual(['alex', 'cal'])
  })

  it('treats friends with only future meetups as never seen', () => {
    const result = recentFriends([friend('b', 'Bob'), friend('a', 'Ann')], [meetup('m1', '2026-12-01', ['b'])], TODAY)
    expect(result.map((f) => f.id)).toEqual(['a', 'b'])
  })
})
```

`src/stats/history.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { meetup } from '../test/fixtures'
import { groupByMonth } from './history'

describe('groupByMonth', () => {
  it('groups meetups by month, newest first', () => {
    const groups = groupByMonth([
      meetup('m1', '2026-08-03', ['alex']),
      meetup('m2', '2026-09-20', ['alex']),
      meetup('m3', '2026-09-02', ['alex']),
    ])
    expect(groups.map((g) => [g.month, g.meetups.map((m) => m.id)])).toEqual([
      ['2026-09', ['m2', 'm3']],
      ['2026-08', ['m1']],
    ])
  })

  it('orders same-day meetups by when they were logged, newest first', () => {
    const a = { ...meetup('a', '2026-09-02', ['alex']), createdAt: '2026-09-02T10:00:00.000Z' }
    const b = { ...meetup('b', '2026-09-02', ['alex']), createdAt: '2026-09-02T18:00:00.000Z' }
    expect(groupByMonth([a, b])[0].meetups.map((m) => m.id)).toEqual(['b', 'a'])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/stats/sortFriends.test.ts src/stats/recent.test.ts src/stats/history.test.ts`
Expected: FAIL, cannot resolve the three modules.

- [ ] **Step 3: Implement `src/stats/sortFriends.ts`**

```ts
import { yearOf, type ISODate } from '../lib/dates'
import { compareNames } from '../lib/text'
import type { Friend, Meetup } from '../types'
import { countsByFriendForYear } from './counts'
import { lastSeenByFriend } from './lastSeen'

export type FriendSort = 'lastSeen' | 'name' | 'mostThisYear'

export const FRIEND_SORT_LABELS: Record<FriendSort, string> = {
  lastSeen: 'Longest since last seen',
  name: 'Name',
  mostThisYear: 'Most seen this year',
}

const byName = (a: Friend, b: Friend) => compareNames(a.name, b.name)

/** Returns a new sorted array. Ties are always broken by name. */
export function sortFriends(friends: Friend[], meetups: Meetup[], sort: FriendSort, today: ISODate): Friend[] {
  const list = [...friends]
  if (sort === 'name') return list.sort(byName)

  if (sort === 'mostThisYear') {
    const counts = countsByFriendForYear(meetups, yearOf(today), today)
    return list.sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || byName(a, b))
  }

  const lastSeen = lastSeenByFriend(meetups, today)
  return list.sort((a, b) => {
    const seenA = lastSeen.get(a.id)
    const seenB = lastSeen.get(b.id)
    if (seenA === undefined && seenB === undefined) return byName(a, b)
    if (seenA === undefined) return -1
    if (seenB === undefined) return 1
    if (seenA !== seenB) return seenA < seenB ? -1 : 1
    return byName(a, b)
  })
}
```

- [ ] **Step 4: Implement `src/stats/recent.ts`**

```ts
import type { ISODate } from '../lib/dates'
import { compareNames } from '../lib/text'
import type { Friend, Meetup } from '../types'
import { lastSeenByFriend } from './lastSeen'

/** Friends for one-tap picking: most recently seen first, then never-seen friends by name. */
export function recentFriends(friends: Friend[], meetups: Meetup[], today: ISODate, limit = 8): Friend[] {
  const lastSeen = lastSeenByFriend(meetups, today)
  const seen = friends
    .filter((friend) => lastSeen.has(friend.id))
    .sort((a, b) => {
      const seenA = lastSeen.get(a.id)!
      const seenB = lastSeen.get(b.id)!
      if (seenA !== seenB) return seenA > seenB ? -1 : 1
      return compareNames(a.name, b.name)
    })
  const neverSeen = friends.filter((friend) => !lastSeen.has(friend.id)).sort((a, b) => compareNames(a.name, b.name))
  return [...seen, ...neverSeen].slice(0, limit)
}
```

- [ ] **Step 5: Implement `src/stats/history.ts`**

```ts
import type { Meetup } from '../types'

export interface MonthGroup {
  /** YYYY-MM */
  month: string
  meetups: Meetup[]
}

/** Newest month first; within a month, newest date first, then most recently logged. */
export function groupByMonth(meetups: Meetup[]): MonthGroup[] {
  const sorted = [...meetups].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const groups: MonthGroup[] = []
  for (const meetup of sorted) {
    const month = meetup.date.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.month === month) last.meetups.push(meetup)
    else groups.push({ month, meetups: [meetup] })
  }
  return groups
}
```

- [ ] **Step 6: Run all unit tests**

Run: `npm test`
Expected: PASS (every file in `src/lib` and `src/stats`).

- [ ] **Step 7: Commit**

```bash
git add src/stats
git commit -m "feat: add friend sorting, recent friends, and month grouping

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Database schema, seed data, and settings

**Files:**
- Create: `src/db/defaults.ts`, `src/db/db.ts`, `src/db/settings.ts`, `src/lib/ids.ts`
- Test: `src/db/db.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/db/db.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { DEFAULT_MEETUP_TYPES } from './defaults'
import { getSetting, setSetting } from './settings'

beforeEach(resetDatabase)

describe('database', () => {
  it('seeds the default meetup types in order', async () => {
    const types = await db.meetupTypes.orderBy('order').toArray()
    expect(types).toEqual(DEFAULT_MEETUP_TYPES)
    expect(types.map((t) => t.name)).toEqual(['Coffee', 'Meal', 'Drinks', 'Call', 'Activity', 'Party', 'Trip', 'Other'])
  })

  it('starts empty otherwise', async () => {
    expect(await db.friends.count()).toBe(0)
    expect(await db.groups.count()).toBe(0)
    expect(await db.meetups.count()).toBe(0)
  })
})

describe('settings', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await getSetting('lastBackupAt')).toBeNull()
    expect(await getSetting('installHintDismissed')).toBe(false)
  })

  it('stores values', async () => {
    await setSetting('installHintDismissed', true)
    await setSetting('lastBackupAt', '2026-10-02T10:00:00.000Z')
    expect(await getSetting('installHintDismissed')).toBe(true)
    expect(await getSetting('lastBackupAt')).toBe('2026-10-02T10:00:00.000Z')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/db/db.test.ts`
Expected: FAIL, cannot resolve `./db`.

- [ ] **Step 3: Create `src/db/defaults.ts`**

```ts
import type { MeetupType } from '../types'

export const DEFAULT_MEETUP_TYPES: MeetupType[] = [
  { id: 'type-coffee', name: 'Coffee', emoji: '☕', order: 0 },
  { id: 'type-meal', name: 'Meal', emoji: '🍽️', order: 1 },
  { id: 'type-drinks', name: 'Drinks', emoji: '🍻', order: 2 },
  { id: 'type-call', name: 'Call', emoji: '📞', order: 3 },
  { id: 'type-activity', name: 'Activity', emoji: '🎳', order: 4 },
  { id: 'type-party', name: 'Party', emoji: '🎉', order: 5 },
  { id: 'type-trip', name: 'Trip', emoji: '✈️', order: 6 },
  { id: 'type-other', name: 'Other', emoji: '✨', order: 7 },
]
```

- [ ] **Step 4: Create `src/db/db.ts`**

```ts
import Dexie, { type EntityTable } from 'dexie'
import type { Friend, Group, Meetup, MeetupType } from '../types'
import { DEFAULT_MEETUP_TYPES } from './defaults'

export interface SettingRow {
  key: string
  value: unknown
}

export type FriendTrackerDB = Dexie & {
  friends: EntityTable<Friend, 'id'>
  groups: EntityTable<Group, 'id'>
  meetupTypes: EntityTable<MeetupType, 'id'>
  meetups: EntityTable<Meetup, 'id'>
  settings: EntityTable<SettingRow, 'key'>
}

export const db = new Dexie('friend-tracker') as FriendTrackerDB

db.version(1).stores({
  friends: 'id, groupId',
  groups: 'id',
  meetupTypes: 'id, order',
  meetups: 'id, date, typeId, *friendIds',
  settings: 'key',
})

// Runs once, when the database is first created on this device.
db.on('populate', (tx) => {
  tx.table('meetupTypes').bulkAdd(DEFAULT_MEETUP_TYPES)
})

/** Test helper: delete the database and recreate it (re-running the seed). */
export async function resetDatabase(): Promise<void> {
  await db.delete()
  await db.open()
}
```

- [ ] **Step 5: Create `src/db/settings.ts`**

```ts
import { db } from './db'

export interface Settings {
  lastBackupAt: string | null
  installHintDismissed: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  lastBackupAt: null,
  installHintDismissed: false,
}

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const row = await db.settings.get(key)
  return row === undefined ? DEFAULT_SETTINGS[key] : (row.value as Settings[K])
}

export async function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void> {
  await db.settings.put({ key, value })
}
```

- [ ] **Step 6: Create `src/lib/ids.ts`**

`crypto.randomUUID` only exists on HTTPS/localhost. The fallback keeps the app working when testing on the iPhone over the local network (`http://192.168…`).

```ts
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run src/db/db.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add src/db src/lib/ids.ts
git commit -m "feat: add IndexedDB schema with seeded meetup types and settings

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Meetups and friends repositories

**Files:**
- Create: `src/db/errors.ts`, `src/db/meetups.ts`, `src/db/friends.ts`
- Test: `src/db/meetups.test.ts`, `src/db/friends.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/db/meetups.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { ValidationError } from './errors'
import { addMeetup, deleteMeetup, restoreMeetup, updateMeetup, type MeetupInput } from './meetups'

const base: MeetupInput = { date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], note: '' }

beforeEach(resetDatabase)

describe('addMeetup', () => {
  it('saves a meetup with unique friends and a trimmed note', async () => {
    const meetup = await addMeetup({ ...base, friendIds: ['alex', 'sam', 'alex'], note: ' Tacos ' })
    expect(meetup.friendIds).toEqual(['alex', 'sam'])
    expect(meetup.note).toBe('Tacos')
    expect(await db.meetups.get(meetup.id)).toEqual(meetup)
  })

  it('requires at least one friend', async () => {
    await expect(addMeetup({ ...base, friendIds: [] })).rejects.toThrow(ValidationError)
  })

  it('rejects an invalid date', async () => {
    await expect(addMeetup({ ...base, date: '2026-02-30' })).rejects.toThrow('Please pick a valid date.')
  })
})

describe('updateMeetup', () => {
  it('changes the stored fields', async () => {
    const meetup = await addMeetup(base)
    await updateMeetup(meetup.id, { ...base, date: '2026-09-05', note: 'Pizza' })
    expect(await db.meetups.get(meetup.id)).toMatchObject({ date: '2026-09-05', note: 'Pizza' })
  })
})

describe('deleteMeetup and restoreMeetup', () => {
  it('deletes a meetup and restores it exactly', async () => {
    const meetup = await addMeetup(base)
    const deleted = await deleteMeetup(meetup.id)
    expect(await db.meetups.get(meetup.id)).toBeUndefined()
    await restoreMeetup(deleted!)
    expect(await db.meetups.get(meetup.id)).toEqual(meetup)
  })

  it('returns undefined for a missing meetup', async () => {
    expect(await deleteMeetup('nope')).toBeUndefined()
  })
})
```

`src/db/friends.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { ValidationError } from './errors'
import { addFriend, deleteFriend, updateFriend, type FriendInput } from './friends'
import { addMeetup } from './meetups'

const input = (overrides: Partial<FriendInput> = {}): FriendInput => ({
  name: 'Alex',
  groupId: null,
  photo: null,
  notes: '',
  ...overrides,
})

beforeEach(resetDatabase)

describe('addFriend', () => {
  it('saves a trimmed friend', async () => {
    const friend = await addFriend(input({ name: '  Alex Smith ', notes: ' Likes jazz ' }))
    expect(friend.name).toBe('Alex Smith')
    expect(friend.notes).toBe('Likes jazz')
    expect(await db.friends.get(friend.id)).toEqual(friend)
  })

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

describe('deleteFriend', () => {
  it('removes the friend from shared meetups and deletes their solo meetups', async () => {
    const alex = await addFriend(input({ name: 'Alex' }))
    const sam = await addFriend(input({ name: 'Sam' }))
    const solo = await addMeetup({ date: '2026-09-01', typeId: 'type-coffee', friendIds: [alex.id], note: '' })
    const shared = await addMeetup({ date: '2026-09-02', typeId: 'type-meal', friendIds: [alex.id, sam.id], note: '' })

    await deleteFriend(alex.id)

    expect(await db.friends.get(alex.id)).toBeUndefined()
    expect(await db.meetups.get(solo.id)).toBeUndefined()
    expect((await db.meetups.get(shared.id))?.friendIds).toEqual([sam.id])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/db/meetups.test.ts src/db/friends.test.ts`
Expected: FAIL, cannot resolve `./errors`, `./meetups`, `./friends`.

- [ ] **Step 3: Create `src/db/errors.ts`**

```ts
/** A problem the user can fix. `message` is shown in the UI as-is. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
```

- [ ] **Step 4: Create `src/db/meetups.ts`**

```ts
import { isISODate, type ISODate } from '../lib/dates'
import { newId } from '../lib/ids'
import type { Meetup } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

export interface MeetupInput {
  date: ISODate
  typeId: string
  friendIds: string[]
  note: string
}

function clean(input: MeetupInput): MeetupInput {
  if (!isISODate(input.date)) throw new ValidationError('Please pick a valid date.')
  if (!input.typeId) throw new ValidationError('Please pick a meetup type.')
  const friendIds = [...new Set(input.friendIds)]
  if (friendIds.length === 0) throw new ValidationError('Pick at least one friend.')
  return { date: input.date, typeId: input.typeId, friendIds, note: input.note.trim() }
}

export async function addMeetup(input: MeetupInput): Promise<Meetup> {
  const meetup: Meetup = { id: newId(), ...clean(input), createdAt: new Date().toISOString() }
  await db.meetups.add(meetup)
  return meetup
}

export async function updateMeetup(id: string, input: MeetupInput): Promise<void> {
  await db.meetups.update(id, clean(input))
}

/** Deletes a meetup and returns it, so it can be put back with `restoreMeetup` (Undo). */
export async function deleteMeetup(id: string): Promise<Meetup | undefined> {
  return db.transaction('rw', db.meetups, async () => {
    const meetup = await db.meetups.get(id)
    if (meetup) await db.meetups.delete(id)
    return meetup
  })
}

export async function restoreMeetup(meetup: Meetup): Promise<void> {
  await db.meetups.put(meetup)
}
```

- [ ] **Step 5: Create `src/db/friends.ts`**

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

export async function addFriend(input: FriendInput): Promise<Friend> {
  const friend: Friend = { id: newId(), ...clean(input), createdAt: new Date().toISOString() }
  await db.friends.add(friend)
  return friend
}

export async function updateFriend(id: string, input: FriendInput): Promise<void> {
  await db.friends.update(id, clean(input))
}

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

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/db`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/db
git commit -m "feat: add meetup and friend repositories with deletion rules

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Groups and meetup types repositories

**Files:**
- Create: `src/db/groups.ts`, `src/db/meetupTypes.ts`
- Test: `src/db/groups.test.ts`, `src/db/meetupTypes.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/db/groups.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { ValidationError } from './errors'
import { addFriend } from './friends'
import { addGroup, deleteGroup, renameGroup } from './groups'

beforeEach(resetDatabase)

describe('addGroup', () => {
  it('adds a trimmed group', async () => {
    const group = await addGroup('  College ')
    expect(group.name).toBe('College')
    expect(await db.groups.get(group.id)).toEqual(group)
  })

  it('rejects duplicate names regardless of case', async () => {
    await addGroup('College')
    await expect(addGroup('college')).rejects.toThrow('You already have a group with that name.')
  })

  it('rejects an empty name', async () => {
    await expect(addGroup('  ')).rejects.toThrow(ValidationError)
  })
})

describe('renameGroup', () => {
  it('allows changing the case of its own name', async () => {
    const group = await addGroup('college')
    await renameGroup(group.id, 'College')
    expect((await db.groups.get(group.id))?.name).toBe('College')
  })

  it('rejects taking another group’s name', async () => {
    await addGroup('Work')
    const group = await addGroup('College')
    await expect(renameGroup(group.id, 'work')).rejects.toThrow(ValidationError)
  })
})

describe('deleteGroup', () => {
  it('ungroups its friends', async () => {
    const group = await addGroup('Work')
    const kim = await addFriend({ name: 'Kim', groupId: group.id, photo: null, notes: '' })
    await deleteGroup(group.id)
    expect(await db.groups.get(group.id)).toBeUndefined()
    expect((await db.friends.get(kim.id))?.groupId).toBeNull()
  })
})
```

`src/db/meetupTypes.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { ValidationError } from './errors'
import { addMeetup } from './meetups'
import {
  addMeetupType,
  countMeetupsUsingType,
  deleteMeetupType,
  moveMeetupType,
  updateMeetupType,
} from './meetupTypes'

beforeEach(resetDatabase)

async function names(): Promise<string[]> {
  return (await db.meetupTypes.orderBy('order').toArray()).map((t) => t.name)
}

describe('addMeetupType', () => {
  it('adds a type at the end', async () => {
    const type = await addMeetupType({ name: ' Hike ', emoji: '🥾' })
    expect(type).toMatchObject({ name: 'Hike', emoji: '🥾', order: 8 })
    expect((await names()).at(-1)).toBe('Hike')
  })

  it('keeps only the first emoji', async () => {
    expect((await addMeetupType({ name: 'Games', emoji: '🎲🎯' })).emoji).toBe('🎲')
  })

  it('rejects a duplicate name or a missing emoji', async () => {
    await expect(addMeetupType({ name: 'coffee', emoji: '☕' })).rejects.toThrow(ValidationError)
    await expect(addMeetupType({ name: 'Hike', emoji: ' ' })).rejects.toThrow('Please pick an emoji.')
  })
})

describe('updateMeetupType', () => {
  it('changes name and emoji', async () => {
    await updateMeetupType('type-coffee', { name: 'Café', emoji: '🥐' })
    expect(await db.meetupTypes.get('type-coffee')).toMatchObject({ name: 'Café', emoji: '🥐' })
  })
})

describe('moveMeetupType', () => {
  it('swaps with the neighbor and ignores moves past the ends', async () => {
    await moveMeetupType('type-meal', -1)
    expect((await names()).slice(0, 2)).toEqual(['Meal', 'Coffee'])
    await moveMeetupType('type-meal', -1)
    expect((await names()).slice(0, 2)).toEqual(['Meal', 'Coffee'])
    await moveMeetupType('type-other', 1)
    expect((await names()).at(-1)).toBe('Other')
  })
})

describe('deleteMeetupType', () => {
  it('refuses to delete a type that is in use', async () => {
    await addMeetup({ date: '2026-09-01', typeId: 'type-coffee', friendIds: ['alex'], note: '' })
    expect(await countMeetupsUsingType('type-coffee')).toBe(1)
    await expect(deleteMeetupType('type-coffee')).rejects.toThrow('This type is used by 1 meetup')
    expect(await db.meetupTypes.get('type-coffee')).toBeDefined()
  })

  it('refuses to delete the last type', async () => {
    const ids = (await db.meetupTypes.toArray()).map((t) => t.id)
    for (const id of ids.slice(1)) await deleteMeetupType(id)
    await expect(deleteMeetupType(ids[0])).rejects.toThrow('You need at least one meetup type.')
  })

  it('deletes an unused type', async () => {
    await deleteMeetupType('type-trip')
    expect(await db.meetupTypes.get('type-trip')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/db/groups.test.ts src/db/meetupTypes.test.ts`
Expected: FAIL, cannot resolve `./groups` and `./meetupTypes`.

- [ ] **Step 3: Create `src/db/groups.ts`**

```ts
import { newId } from '../lib/ids'
import { sameName } from '../lib/text'
import type { Group } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

async function cleanName(name: string, exceptId?: string): Promise<string> {
  const trimmed = name.trim()
  if (!trimmed) throw new ValidationError('Please enter a group name.')
  const groups = await db.groups.toArray()
  if (groups.some((group) => group.id !== exceptId && sameName(group.name, trimmed))) {
    throw new ValidationError('You already have a group with that name.')
  }
  return trimmed
}

export async function addGroup(name: string): Promise<Group> {
  const group: Group = { id: newId(), name: await cleanName(name) }
  await db.groups.add(group)
  return group
}

export async function renameGroup(id: string, name: string): Promise<void> {
  await db.groups.update(id, { name: await cleanName(name, id) })
}

/** Deletes a group; its friends become ungrouped. */
export async function deleteGroup(id: string): Promise<void> {
  await db.transaction('rw', db.groups, db.friends, async () => {
    await db.friends.where('groupId').equals(id).modify({ groupId: null })
    await db.groups.delete(id)
  })
}
```

- [ ] **Step 4: Create `src/db/meetupTypes.ts`**

```ts
import { newId } from '../lib/ids'
import { firstGrapheme, plural, sameName } from '../lib/text'
import type { MeetupType } from '../types'
import { db } from './db'
import { ValidationError } from './errors'

export interface MeetupTypeInput {
  name: string
  emoji: string
}

async function clean(input: MeetupTypeInput, exceptId?: string): Promise<MeetupTypeInput> {
  const name = input.name.trim()
  if (!name) throw new ValidationError('Please enter a name.')
  const emoji = firstGrapheme(input.emoji)
  if (!emoji) throw new ValidationError('Please pick an emoji.')
  const types = await db.meetupTypes.toArray()
  if (types.some((type) => type.id !== exceptId && sameName(type.name, name))) {
    throw new ValidationError('You already have a type with that name.')
  }
  return { name, emoji }
}

export async function addMeetupType(input: MeetupTypeInput): Promise<MeetupType> {
  const cleaned = await clean(input)
  const last = await db.meetupTypes.orderBy('order').last()
  const type: MeetupType = { id: newId(), ...cleaned, order: (last?.order ?? -1) + 1 }
  await db.meetupTypes.add(type)
  return type
}

export async function updateMeetupType(id: string, input: MeetupTypeInput): Promise<void> {
  await db.meetupTypes.update(id, await clean(input, id))
}

/** Swaps a type with its neighbor above (-1) or below (1). */
export async function moveMeetupType(id: string, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.meetupTypes, async () => {
    const types = await db.meetupTypes.orderBy('order').toArray()
    const index = types.findIndex((type) => type.id === id)
    const target = index + direction
    if (index === -1 || target < 0 || target >= types.length) return
    const current = types[index]
    const neighbor = types[target]
    await db.meetupTypes.update(current.id, { order: neighbor.order })
    await db.meetupTypes.update(neighbor.id, { order: current.order })
  })
}

export async function countMeetupsUsingType(id: string): Promise<number> {
  return db.meetups.where('typeId').equals(id).count()
}

export async function deleteMeetupType(id: string): Promise<void> {
  await db.transaction('rw', db.meetupTypes, db.meetups, async () => {
    const used = await db.meetups.where('typeId').equals(id).count()
    if (used > 0) {
      throw new ValidationError(
        `This type is used by ${plural(used, 'meetup')}, so it can't be deleted. You can rename it instead.`,
      )
    }
    if ((await db.meetupTypes.count()) <= 1) throw new ValidationError('You need at least one meetup type.')
    await db.meetupTypes.delete(id)
  })
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS (all unit tests).

- [ ] **Step 6: Commit**

```bash
git add src/db
git commit -m "feat: add group and meetup type repositories

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Backup file format and validation

**Files:**
- Create: `src/backup/format.ts`
- Test: `src/backup/format.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/backup/format.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { friend, group, meetup, meetupType } from '../test/fixtures'
import { backupFileName, createBackup, parseBackup, type BackupData } from './format'

const sample: BackupData = {
  groups: [group('g1', 'College')],
  meetupTypes: [meetupType('t1', 'Coffee', 0, '☕')],
  friends: [friend('f1', 'Alex', 'g1'), { ...friend('f2', 'Sam'), photo: 'data:image/jpeg;base64,AAAA', notes: 'Likes jazz' }],
  meetups: [{ ...meetup('m1', '2026-09-01', ['f1', 'f2'], 't1'), note: 'Tacos' }],
}

function jsonCopy(value: unknown): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
}

function broken(change: (file: Record<string, unknown>) => void): unknown {
  const file = jsonCopy(createBackup(sample, new Date('2026-10-02T09:00:00Z')))
  change(file)
  return file
}

function list(file: Record<string, unknown>, key: string): Record<string, unknown>[] {
  return file[key] as Record<string, unknown>[]
}

function expectError(raw: unknown, message: string) {
  const result = parseBackup(raw)
  expect(result.ok).toBe(false)
  if (!result.ok) expect(result.error).toContain(message)
}

describe('createBackup and parseBackup', () => {
  it('accepts a backup it created', () => {
    const file = createBackup(sample, new Date('2026-10-02T09:00:00Z'))
    expect(file).toMatchObject({ app: 'friend-tracker', version: 1, exportedAt: '2026-10-02T09:00:00.000Z' })
    expect(parseBackup(jsonCopy(file))).toEqual({ ok: true, data: sample })
  })

  it('drops fields it does not know about', () => {
    const file = broken((f) => {
      f.extra = true
      list(f, 'friends')[0].color = 'red'
    })
    expect(parseBackup(file)).toEqual({ ok: true, data: sample })
  })
})

describe('parseBackup rejects bad files', () => {
  it('rejects things that are not backups', () => {
    expectError('hello', "This isn't a Friend Tracker backup file.")
    expectError(broken((f) => (f.app = 'other')), "This isn't a Friend Tracker backup file.")
  })

  it('rejects other versions', () => {
    expectError(broken((f) => (f.version = 2)), 'different version')
  })

  it('rejects missing lists', () => {
    expectError(broken((f) => delete f.meetups), 'missing its "meetups" list')
  })

  it('rejects a friend without a name', () => {
    expectError(broken((f) => (list(f, 'friends')[0].name = ' ')), 'Friend 1 has a missing or invalid "name"')
  })

  it('rejects an invalid photo', () => {
    expectError(broken((f) => (list(f, 'friends')[0].photo = 'https://example.com/a.jpg')), 'Friend 1 has an invalid photo')
  })

  it('rejects a bad date or an empty friend list', () => {
    expectError(broken((f) => (list(f, 'meetups')[0].date = '2026-02-30')), 'Meetup 1 has an invalid date')
    expectError(broken((f) => (list(f, 'meetups')[0].friendIds = [])), 'Meetup 1 has a missing or invalid "friendIds"')
  })

  it('rejects broken references', () => {
    expectError(broken((f) => (list(f, 'meetups')[0].friendIds = ['f1', 'ghost'])), "Meetup 1 includes a friend who isn't in the backup")
    expectError(broken((f) => (list(f, 'meetups')[0].typeId = 'nope')), "Meetup 1 has a type that isn't in the backup")
    expectError(broken((f) => (list(f, 'friends')[0].groupId = 'nope')), "Friend 1 belongs to a group that isn't in the backup")
  })

  it('rejects duplicate ids', () => {
    expectError(broken((f) => list(f, 'friends').push(list(f, 'friends')[0])), 'two friends with the same id')
  })

  it('rejects a backup with no meetup types', () => {
    expectError(
      broken((f) => {
        f.meetupTypes = []
        f.meetups = []
      }),
      'no meetup types',
    )
  })
})

describe('backupFileName', () => {
  it('includes the date', () => {
    expect(backupFileName('2026-10-02')).toBe('friend-tracker-backup-2026-10-02.json')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/backup/format.test.ts`
Expected: FAIL, cannot resolve `./format`.

- [ ] **Step 3: Implement `src/backup/format.ts`**

```ts
import { isISODate, type ISODate } from '../lib/dates'
import type { Friend, Group, Meetup, MeetupType } from '../types'

export interface BackupData {
  friends: Friend[]
  groups: Group[]
  meetupTypes: MeetupType[]
  meetups: Meetup[]
}

export interface BackupFile extends BackupData {
  app: 'friend-tracker'
  version: 1
  exportedAt: string
}

export type ParseResult = { ok: true; data: BackupData } | { ok: false; error: string }

export function createBackup(data: BackupData, exportedAt: Date): BackupFile {
  return { app: 'friend-tracker', version: 1, exportedAt: exportedAt.toISOString(), ...data }
}

export function backupFileName(today: ISODate): string {
  return `friend-tracker-backup-${today}.json`
}

/** Validates an untrusted, already-JSON-parsed value. Never throws for bad input. */
export function parseBackup(raw: unknown): ParseResult {
  try {
    return { ok: true, data: readBackup(raw) }
  } catch (error) {
    if (error instanceof BackupError) return { ok: false, error: error.message }
    throw error
  }
}

class BackupError extends Error {}

type Obj = Record<string, unknown>

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asObj(value: unknown, where: string): Obj {
  if (!isObj(value)) throw new BackupError(`${where} is not a valid record.`)
  return value
}

function list(record: Obj, key: string): unknown[] {
  const value = record[key]
  if (!Array.isArray(value)) throw new BackupError(`The backup is missing its "${key}" list.`)
  return value
}

function text(record: Obj, key: string, where: string, required = false): string {
  const value = record[key]
  if (typeof value !== 'string' || (required && value.trim() === '')) {
    throw new BackupError(`${where} has a missing or invalid "${key}".`)
  }
  return value
}

function nullableText(record: Obj, key: string, where: string): string | null {
  const value = record[key]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new BackupError(`${where} has a missing or invalid "${key}".`)
  return value
}

function assertUnique(ids: string[], what: string) {
  if (new Set(ids).size !== ids.length) throw new BackupError(`The backup has two ${what} with the same id.`)
}

function readBackup(raw: unknown): BackupData {
  if (!isObj(raw) || raw.app !== 'friend-tracker') throw new BackupError("This isn't a Friend Tracker backup file.")
  if (raw.version !== 1) throw new BackupError('This backup was made by a different version of Friend Tracker.')

  const groups: Group[] = list(raw, 'groups').map((value, i) => {
    const where = `Group ${i + 1}`
    const r = asObj(value, where)
    return { id: text(r, 'id', where, true), name: text(r, 'name', where, true) }
  })

  const meetupTypes: MeetupType[] = list(raw, 'meetupTypes').map((value, i) => {
    const where = `Meetup type ${i + 1}`
    const r = asObj(value, where)
    const order = r.order
    if (typeof order !== 'number' || !Number.isFinite(order)) {
      throw new BackupError(`${where} has a missing or invalid "order".`)
    }
    return { id: text(r, 'id', where, true), name: text(r, 'name', where, true), emoji: text(r, 'emoji', where, true), order }
  })

  const friends: Friend[] = list(raw, 'friends').map((value, i) => {
    const where = `Friend ${i + 1}`
    const r = asObj(value, where)
    const photo = nullableText(r, 'photo', where)
    if (photo !== null && !photo.startsWith('data:image/')) throw new BackupError(`${where} has an invalid photo.`)
    return {
      id: text(r, 'id', where, true),
      name: text(r, 'name', where, true),
      groupId: nullableText(r, 'groupId', where),
      photo,
      notes: text(r, 'notes', where),
      createdAt: text(r, 'createdAt', where),
    }
  })

  const meetups: Meetup[] = list(raw, 'meetups').map((value, i) => {
    const where = `Meetup ${i + 1}`
    const r = asObj(value, where)
    const date = text(r, 'date', where)
    if (!isISODate(date)) throw new BackupError(`${where} has an invalid date.`)
    const friendIds = r.friendIds
    if (!Array.isArray(friendIds) || friendIds.length === 0 || !friendIds.every((id) => typeof id === 'string')) {
      throw new BackupError(`${where} has a missing or invalid "friendIds".`)
    }
    return {
      id: text(r, 'id', where, true),
      date,
      typeId: text(r, 'typeId', where, true),
      friendIds: friendIds as string[],
      note: text(r, 'note', where),
      createdAt: text(r, 'createdAt', where),
    }
  })

  assertUnique(groups.map((g) => g.id), 'groups')
  assertUnique(meetupTypes.map((t) => t.id), 'meetup types')
  assertUnique(friends.map((f) => f.id), 'friends')
  assertUnique(meetups.map((m) => m.id), 'meetups')
  if (meetupTypes.length === 0) throw new BackupError('The backup has no meetup types.')

  const groupIds = new Set(groups.map((g) => g.id))
  const typeIds = new Set(meetupTypes.map((t) => t.id))
  const friendIdSet = new Set(friends.map((f) => f.id))

  friends.forEach((f, i) => {
    if (f.groupId !== null && !groupIds.has(f.groupId)) {
      throw new BackupError(`Friend ${i + 1} belongs to a group that isn't in the backup.`)
    }
  })
  meetups.forEach((m, i) => {
    if (!typeIds.has(m.typeId)) throw new BackupError(`Meetup ${i + 1} has a type that isn't in the backup.`)
    if (!m.friendIds.every((id) => friendIdSet.has(id))) {
      throw new BackupError(`Meetup ${i + 1} includes a friend who isn't in the backup.`)
    }
  })

  return { friends, groups, meetupTypes, meetups }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/backup/format.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/backup
git commit -m "feat: add backup file format with strict validation

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Backup storage (read all, replace all) and export glue

**Files:**
- Create: `src/backup/storage.ts`, `src/backup/exportBackup.ts`
- Test: `src/backup/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/backup/storage.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from '../db/db'
import { addFriend } from '../db/friends'
import { addGroup } from '../db/groups'
import { addMeetup } from '../db/meetups'
import { friend, meetupType } from '../test/fixtures'
import { createBackup, type BackupData } from './format'
import { parseBackupFile, readAllData, replaceAllData } from './storage'

beforeEach(resetDatabase)

function sortById(data: BackupData): BackupData {
  const byId = <T extends { id: string }>(items: T[]) => [...items].sort((a, b) => a.id.localeCompare(b.id))
  return {
    friends: byId(data.friends),
    groups: byId(data.groups),
    meetupTypes: byId(data.meetupTypes),
    meetups: byId(data.meetups),
  }
}

describe('backup storage', () => {
  it('round-trips everything through a backup file', async () => {
    const college = await addGroup('College')
    const alex = await addFriend({ name: 'Alex', groupId: college.id, photo: 'data:image/jpeg;base64,AAAA', notes: 'Hi' })
    const sam = await addFriend({ name: 'Sam', groupId: null, photo: null, notes: '' })
    await addMeetup({ date: '2026-09-01', typeId: 'type-meal', friendIds: [alex.id, sam.id], note: 'Tacos' })
    const before = await readAllData()
    const text = JSON.stringify(createBackup(before, new Date()))

    await resetDatabase()
    await addFriend({ name: 'Someone else', groupId: null, photo: null, notes: '' })
    const parsed = await parseBackupFile(new Blob([text], { type: 'application/json' }))
    if (!parsed.ok) throw new Error(parsed.error)
    await replaceAllData(parsed.data)

    expect(sortById(await readAllData())).toEqual(sortById(before))
  })

  it('reports a file that is not JSON', async () => {
    expect(await parseBackupFile(new Blob(['not json']))).toEqual({
      ok: false,
      error: "This file couldn't be read. Pick a .json backup file.",
    })
  })

  it('leaves existing data untouched if writing fails', async () => {
    const alex = await addFriend({ name: 'Alex', groupId: null, photo: null, notes: '' })
    const bad: BackupData = {
      friends: [friend('x', 'X'), friend('x', 'X again')],
      groups: [],
      meetupTypes: [meetupType('t', 'T', 0)],
      meetups: [],
    }
    await expect(replaceAllData(bad)).rejects.toThrow()
    expect((await db.friends.toArray()).map((f) => f.id)).toEqual([alex.id])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/backup/storage.test.ts`
Expected: FAIL, cannot resolve `./storage`.

- [ ] **Step 3: Implement `src/backup/storage.ts`**

```ts
import { db } from '../db/db'
import { parseBackup, type BackupData, type ParseResult } from './format'

export async function readAllData(): Promise<BackupData> {
  const [friends, groups, meetupTypes, meetups] = await Promise.all([
    db.friends.toArray(),
    db.groups.toArray(),
    db.meetupTypes.orderBy('order').toArray(),
    db.meetups.toArray(),
  ])
  return { friends, groups, meetupTypes, meetups }
}

/** Replaces everything in one transaction. If anything fails, nothing changes. */
export async function replaceAllData(data: BackupData): Promise<void> {
  await db.transaction('rw', [db.friends, db.groups, db.meetupTypes, db.meetups], async () => {
    await Promise.all([db.friends.clear(), db.groups.clear(), db.meetupTypes.clear(), db.meetups.clear()])
    await db.groups.bulkAdd(data.groups)
    await db.meetupTypes.bulkAdd(data.meetupTypes)
    await db.friends.bulkAdd(data.friends)
    await db.meetups.bulkAdd(data.meetups)
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

- [ ] **Step 4: Implement `src/backup/exportBackup.ts`**

Not unit-tested (it drives the browser share sheet). It takes data that the screen already has loaded, so `navigator.share` runs immediately inside the tap. iOS refuses to share if too much async work happens first.

```ts
import { setSetting } from '../db/settings'
import { todayISO } from '../lib/dates'
import { backupFileName, createBackup, type BackupData } from './format'

export type ExportOutcome = 'shared' | 'downloaded' | 'cancelled'

function download(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function markBackedUp() {
  await setSetting('lastBackupAt', new Date().toISOString())
}

/** Opens the iOS share sheet with the backup file (falls back to a download). */
export async function exportBackup(data: BackupData): Promise<ExportOutcome> {
  const backup = createBackup(data, new Date())
  const file = new File([JSON.stringify(backup)], backupFileName(todayISO()), { type: 'application/json' })

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      await markBackedUp()
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // Sharing not allowed for this file: fall back to a download.
    }
  }

  download(file)
  await markBackedUp()
  return 'downloaded'
}
```

- [ ] **Step 5: Run the tests and the type check**

Run: `npm test`
Expected: PASS.

Run: `npx tsc -b`
Expected: no output (no type errors).

- [ ] **Step 6: Commit**

```bash
git add src/backup
git commit -m "feat: add backup read/replace storage and export glue

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Design tokens, base styles, and icons

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/base.css`, `src/components/icons.tsx`
- Modify: `src/main.tsx`

Colors come from `DESIGN.md` ("The Pocket Address Book"): warm paper neutrals tinted toward peach, one peach accent, all in OKLCH. Contrast was checked while planning: body/secondary/tertiary text pass WCAG AA in both themes.

- [ ] **Step 1: Create `src/styles/tokens.css`**

```css
:root {
  color-scheme: light dark;

  --font-rounded: ui-rounded, 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif;
  --font-text: -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI', Roboto, sans-serif;

  /* Type scale. 1rem follows the iPhone text-size setting (see base.css). */
  --text-large-title: 2rem;
  --text-title: 1.5rem;
  --text-title-3: 1.18rem;
  --text-body: 1rem;
  --text-subhead: 0.88rem;
  --text-footnote: 0.77rem;
  --text-caption: 0.7rem;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;

  --radius-field: 12px;
  --radius-group: 14px;
  --radius-sheet: 22px;
  --radius-pill: 999px;

  --tap: 44px;
  --navbar-height: 44px;
  --tabbar-height: 50px;
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --keyboard-inset: 0px;

  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-fast: 160ms;
  --dur: 220ms;
  --dur-sheet: 340ms;

  /* Light: warm paper neutrals + one peach accent */
  --bg: oklch(96.4% 0.009 60);
  --surface: oklch(99.4% 0.004 60);
  --surface-2: oklch(93.6% 0.011 60);
  --surface-pressed: oklch(91% 0.012 60);
  --separator: oklch(89.5% 0.009 60);
  --ink: oklch(25% 0.014 50);
  --ink-2: oklch(47% 0.014 50);
  --ink-3: oklch(56% 0.012 50);
  --accent: oklch(81% 0.095 50);
  --accent-pressed: oklch(77% 0.105 48);
  --on-accent: oklch(29% 0.06 40);
  --accent-ink: oklch(53% 0.15 38);
  --accent-soft: oklch(94.5% 0.03 55);
  --bar-current: oklch(66% 0.13 42);
  --bar-previous: oklch(80% 0.012 60);
  --danger: oklch(55% 0.19 27);
  --scrim: oklch(22% 0.02 45 / 0.32);
  --shadow-float: 0 10px 30px oklch(35% 0.04 45 / 0.16), 0 2px 6px oklch(35% 0.04 45 / 0.1);
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: oklch(18.5% 0.008 55);
    --surface: oklch(23.5% 0.009 55);
    --surface-2: oklch(29% 0.011 55);
    --surface-pressed: oklch(33% 0.012 55);
    --separator: oklch(32% 0.01 55);
    --ink: oklch(95% 0.008 70);
    --ink-2: oklch(76% 0.012 60);
    --ink-3: oklch(64% 0.012 60);
    --accent: oklch(80% 0.1 50);
    --accent-pressed: oklch(75% 0.11 48);
    --on-accent: oklch(26% 0.05 40);
    --accent-ink: oklch(81% 0.1 52);
    --accent-soft: oklch(31% 0.04 50);
    --bar-current: oklch(78% 0.11 48);
    --bar-previous: oklch(42% 0.012 55);
    --danger: oklch(70% 0.17 25);
    --scrim: oklch(8% 0.01 45 / 0.55);
    --shadow-float: 0 10px 30px oklch(5% 0 0 / 0.5), 0 2px 6px oklch(5% 0 0 / 0.4);
  }
}

/* Avatar tints: soft pastels chosen per friend (see lib/tint.ts). */
.tint-0 { --tint-bg: oklch(91% 0.045 50); --tint-fg: oklch(42% 0.08 50); }
.tint-1 { --tint-bg: oklch(91% 0.045 85); --tint-fg: oklch(42% 0.08 85); }
.tint-2 { --tint-bg: oklch(91% 0.045 145); --tint-fg: oklch(42% 0.08 145); }
.tint-3 { --tint-bg: oklch(91% 0.045 215); --tint-fg: oklch(42% 0.08 215); }
.tint-4 { --tint-bg: oklch(91% 0.045 285); --tint-fg: oklch(42% 0.08 285); }
.tint-5 { --tint-bg: oklch(91% 0.045 350); --tint-fg: oklch(42% 0.08 350); }

@media (prefers-color-scheme: dark) {
  .tint-0 { --tint-bg: oklch(36% 0.05 50); --tint-fg: oklch(90% 0.05 50); }
  .tint-1 { --tint-bg: oklch(36% 0.05 85); --tint-fg: oklch(90% 0.05 85); }
  .tint-2 { --tint-bg: oklch(36% 0.05 145); --tint-fg: oklch(90% 0.05 145); }
  .tint-3 { --tint-bg: oklch(36% 0.05 215); --tint-fg: oklch(90% 0.05 215); }
  .tint-4 { --tint-bg: oklch(36% 0.05 285); --tint-fg: oklch(90% 0.05 285); }
  .tint-5 { --tint-bg: oklch(36% 0.05 350); --tint-fg: oklch(90% 0.05 350); }
}
```

- [ ] **Step 2: Create `src/styles/base.css`**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  font-size: 100%;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

/* On iPhone, 1rem follows the user's text-size setting (Dynamic Type). */
@supports (font: -apple-system-body) {
  html {
    font: -apple-system-body;
  }
}

body {
  margin: 0;
  min-height: 100dvh;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--font-text);
  font-size: var(--text-body);
  line-height: 1.35;
  -webkit-font-smoothing: antialiased;
  -webkit-tap-highlight-color: transparent;
}

.scroll-locked,
.scroll-locked body {
  overflow: hidden;
}

button,
input,
textarea {
  font: inherit;
  color: inherit;
}

button {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
}

/* 16px minimum stops iOS from zooming into focused fields. */
input,
textarea {
  font-size: max(16px, 1rem);
}

img {
  display: block;
  max-width: 100%;
}

:focus-visible {
  outline: 2px solid var(--accent-ink);
  outline-offset: 2px;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.numeric {
  font-family: var(--font-rounded);
  font-variant-numeric: tabular-nums;
}

/* The phone layout, centered on wider screens. Bottom padding clears the tab bar and Log button. */
.app {
  max-width: 600px;
  margin: 0 auto;
  padding-bottom: calc(var(--tabbar-height) + var(--safe-bottom) + 96px);
}

/* Buttons */
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--tap);
  padding: 0 var(--space-5);
  border-radius: var(--radius-pill);
  font-weight: 600;
  transition:
    transform var(--dur-fast) var(--ease-out-quart),
    background-color var(--dur-fast) var(--ease-out-quart),
    opacity var(--dur-fast) var(--ease-out-quart);
}
.button:active:not(:disabled) {
  transform: scale(0.97);
}
.button:disabled {
  opacity: 0.45;
  cursor: default;
}
.button--primary {
  background: var(--accent);
  color: var(--on-accent);
}
.button--primary:active:not(:disabled) {
  background: var(--accent-pressed);
}
.button--secondary {
  background: var(--surface-2);
  color: var(--ink);
}
.button--block {
  display: flex;
  width: 100%;
  min-height: 52px;
  font-size: 1.06rem;
}

.text-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--tap);
  min-height: var(--tap);
  padding: 0 var(--space-2);
  color: var(--accent-ink);
  transition: opacity var(--dur-fast);
}
.text-button:active {
  opacity: 0.5;
}

.icon-button {
  display: inline-grid;
  place-items: center;
  width: var(--tap);
  height: var(--tap);
  border-radius: 50%;
  color: var(--accent-ink);
  transition: background-color var(--dur-fast);
}
.icon-button:active:not(:disabled) {
  background: var(--surface-2);
}
.icon-button:disabled {
  color: var(--ink-3);
  opacity: 0.45;
  cursor: default;
}

/* Forms */
.form-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.form-section__label,
.field-label {
  margin: 0 var(--space-1);
  font-size: var(--text-footnote);
  font-weight: 600;
  color: var(--ink-2);
}
.field {
  display: block;
  width: 100%;
  min-height: var(--tap);
  padding: 0.6rem 0.9rem;
  border: 0;
  border-radius: var(--radius-field);
  background: var(--surface);
  color: var(--ink);
}
.field::placeholder {
  color: var(--ink-3);
}
textarea.field {
  min-height: 5.5rem;
  line-height: 1.4;
  resize: none;
}
.field-error {
  margin: 0 var(--space-1);
  font-size: var(--text-footnote);
  color: var(--danger);
}

.search {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--tap);
  padding: 0 var(--space-3);
  border-radius: var(--radius-field);
  background: var(--surface-2);
  color: var(--ink-3);
}
.search:focus-within {
  outline: 2px solid var(--accent-ink);
  outline-offset: 1px;
}
.search__input {
  flex: 1;
  min-width: 0;
  padding: var(--space-2) 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--ink);
}
.search__input::placeholder {
  color: var(--ink-3);
}

/* Chip layouts */
.chip-row {
  display: flex;
  gap: var(--space-2);
  margin: 0 calc(-1 * var(--space-4));
  padding: var(--space-1) var(--space-4);
  overflow-x: auto;
  scrollbar-width: none;
}
.chip-row::-webkit-scrollbar {
  display: none;
}
.chip-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.list-message {
  margin: var(--space-2) var(--space-4);
  color: var(--ink-2);
  text-align: center;
}

.emoji-badge {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--surface-2);
  font-size: 1.25rem;
  line-height: 1;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
}
@keyframes fade-out {
  to {
    opacity: 0;
  }
}
@keyframes rise-in {
  from {
    transform: translateY(100%);
  }
}
@keyframes pop-in {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .button:active:not(:disabled) {
    transform: none;
  }
}
```

- [ ] **Step 3: Create `src/components/icons.tsx`**

Line icons drawn in an SF Symbols-like style. They inherit `currentColor`.

```tsx
import type { ReactNode } from 'react'

interface IconProps {
  size?: number
  strokeWidth?: number
}

function Icon({ size = 24, strokeWidth = 2, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const IconPlus = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)

export const IconChevronLeft = (props: IconProps) => (
  <Icon {...props}>
    <path d="M15 18l-6-6 6-6" />
  </Icon>
)

export const IconChevronRight = (props: IconProps) => (
  <Icon {...props}>
    <path d="M9 18l6-6-6-6" />
  </Icon>
)

export const IconSearch = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </Icon>
)

export const IconSort = (props: IconProps) => (
  <Icon {...props}>
    <path d="M7 4v16M3.5 7.5 7 4l3.5 3.5M17 20V4M13.5 16.5 17 20l3.5-3.5" />
  </Icon>
)

export const IconCheck = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
)

export const IconClose = (props: IconProps) => (
  <Icon {...props}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)

export const IconCamera = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.5-2h5L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
    <circle cx="12" cy="13" r="3.25" />
  </Icon>
)

export const IconCalendar = (props: IconProps) => (
  <Icon {...props}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
)

export const IconArrowUp = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Icon>
)

export const IconArrowDown = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Icon>
)

export const IconShare = (props: IconProps) => (
  <Icon {...props}>
    <path d="M12 3v12M8 7l4-4 4 4M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
  </Icon>
)

export const IconFriends = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M16.6 14.6c2.5.2 4.3 1.9 4.9 4.9" />
  </Icon>
)

export const IconStats = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 20v-8M12 20V5M19 20v-5" />
  </Icon>
)

export const IconSettings = (props: IconProps) => (
  <Icon {...props}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </Icon>
)
```

- [ ] **Step 4: Load the styles in `src/main.tsx`**

Replace `src/main.tsx` with:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/base.css'

// Screens manage their own scroll position (see ScrollManager).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 5: Verify the build**

Run: `npm run build`
Expected: succeeds with no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/styles src/components/icons.tsx src/main.tsx
git commit -m "feat: add design tokens, base styles, and icon set

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: App shell (routing, pages, tab bar, lists) and Playwright

**Files:**
- Create: `src/hooks/useToday.ts`, `src/data/hooks.ts`, `src/components/Page.tsx`, `src/components/Page.css`, `src/components/TabBar.tsx`, `src/components/TabBar.css`, `src/components/ScrollManager.tsx`, `src/components/InsetGroup.tsx`, `src/components/InsetGroup.css`, `src/screens/FriendsScreen.tsx`, `src/screens/FriendDetailScreen.tsx`, `src/screens/StatsScreen.tsx`, `src/screens/SettingsScreen.tsx`, `src/screens/GroupsScreen.tsx`, `src/screens/MeetupTypesScreen.tsx`, `playwright.config.ts`, `e2e/shell.spec.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Configure Playwright and install WebKit**

`playwright.config.ts` (port 4174 so it never collides with a manually started `npm run preview` on 4173):

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:4174',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'iphone', use: { ...devices['iPhone 13'] }, testIgnore: /screenshots\.spec\.ts/ }],
  webServer: {
    command: 'npm run build && npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
```

Run: `npx playwright install webkit`
Expected: `WebKit … downloaded` (or already installed). If it fails with `Download failure`, run it again: the download server is occasionally flaky.

- [ ] **Step 2: Write the failing end-to-end test**

`e2e/shell.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('tab bar switches between screens', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Main' })
  await nav.getByRole('link', { name: 'Stats' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Stats' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Stats' })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('link', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()

  await nav.getByRole('link', { name: 'Friends' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})

test('unknown routes go to Friends', async ({ page }) => {
  await page.goto('/#/nowhere')
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
})
```

Run: `npm run e2e`
Expected: FAIL, the heading "Friends" is not found (the placeholder app renders "Friend Tracker").

- [ ] **Step 3: Create `src/hooks/useToday.ts`**

```ts
import { useEffect, useState } from 'react'
import { todayISO, type ISODate } from '../lib/dates'

/** Today's local date. Updates when the app returns to the foreground or the day rolls over. */
export function useToday(): ISODate {
  const [today, setToday] = useState(todayISO)
  useEffect(() => {
    const update = () => setToday(todayISO())
    document.addEventListener('visibilitychange', update)
    const timer = window.setInterval(update, 60_000)
    return () => {
      document.removeEventListener('visibilitychange', update)
      window.clearInterval(timer)
    }
  }, [])
  return today
}
```

- [ ] **Step 4: Create `src/data/hooks.ts`**

```ts
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { getSetting, type Settings } from '../db/settings'
import { compareNames } from '../lib/text'
import type { Friend, Group, Meetup, MeetupType } from '../types'

// Each hook returns `undefined` while its first query is loading, then re-renders on every change.

export function useFriends(): Friend[] | undefined {
  return useLiveQuery(() => db.friends.toArray())
}

/** `null` when no friend has this id. */
export function useFriend(id: string | undefined): Friend | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.friends.get(id)) ?? null) : null), [id])
}

export function useGroups(): Group[] | undefined {
  return useLiveQuery(async () => (await db.groups.toArray()).sort((a, b) => compareNames(a.name, b.name)))
}

export function useMeetupTypes(): MeetupType[] | undefined {
  return useLiveQuery(() => db.meetupTypes.orderBy('order').toArray())
}

export function useMeetups(): Meetup[] | undefined {
  return useLiveQuery(() => db.meetups.toArray())
}

export function useSetting<K extends keyof Settings>(key: K): Settings[K] | undefined {
  return useLiveQuery(() => getSetting(key), [key])
}
```

- [ ] **Step 5: Create the page frame: `src/components/Page.tsx` and `src/components/Page.css`**

A sticky nav bar sits above an iOS-style large title. When the large title (or the `hero` block) scrolls away, the small title fades into the nav bar.

```tsx
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { IconChevronLeft } from './icons'
import './Page.css'

interface PageProps {
  title: string
  /** Back button label and where to go if there's no history (e.g. opened from a link). */
  back?: { label: string; fallback: string }
  actions?: ReactNode
  /** Replaces the large title, e.g. a friend's avatar and name. Must contain its own h1. */
  hero?: ReactNode
  /** Slide in from the right, like a pushed iOS screen. */
  pushed?: boolean
  children: ReactNode
}

export function Page({ title, back, actions, hero, pushed = false, children }: PageProps) {
  const topRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const element = topRef.current
    if (!element) return
    const observer = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), {
      rootMargin: '-44px 0px 0px 0px',
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function goBack() {
    if (!back) return
    if (location.key === 'default') navigate(back.fallback, { replace: true })
    else navigate(-1)
  }

  return (
    <div className={pushed ? 'page page--pushed' : 'page'}>
      <header className="navbar" data-compact={compact}>
        <div className="navbar__side">
          {back && (
            <button type="button" className="text-button navbar__back" onClick={goBack}>
              <IconChevronLeft size={26} strokeWidth={2.4} />
              {back.label}
            </button>
          )}
        </div>
        <div className="navbar__title" aria-hidden="true">
          {title}
        </div>
        <div className="navbar__side navbar__side--end">{actions}</div>
      </header>
      <div ref={topRef}>
        {hero ? <div className="page__hero">{hero}</div> : <h1 className="page__title">{title}</h1>}
      </div>
      <div className="page__body">{children}</div>
    </div>
  )
}
```

```css
.navbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  min-height: calc(var(--navbar-height) + var(--safe-top));
  padding: var(--safe-top) var(--space-2) 0;
  background: var(--bg);
  border-bottom: 0.5px solid transparent;
  transition: border-color var(--dur) var(--ease-out-quart);
}
.navbar[data-compact='true'] {
  border-bottom-color: var(--separator);
}
.navbar__side {
  display: flex;
  align-items: center;
  min-width: 0;
}
.navbar__side--end {
  justify-content: flex-end;
}
.navbar__back {
  margin-left: -6px;
  padding-left: 0;
}
.navbar__title {
  max-width: 50vw;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0;
  transition: opacity var(--dur) var(--ease-out-quart);
}
.navbar[data-compact='true'] .navbar__title {
  opacity: 1;
}

.page__title {
  margin: 0;
  padding: 0 var(--space-5) var(--space-4);
  font-family: var(--font-rounded);
  font-size: var(--text-large-title);
  font-weight: 700;
  line-height: 1.15;
  overflow-wrap: anywhere;
}
.page__hero {
  padding: 0 var(--space-5) var(--space-5);
}
.page__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: 0 var(--space-4);
}

.page--pushed {
  animation: page-push var(--dur-sheet) var(--ease-out-quart);
}
@keyframes page-push {
  from {
    transform: translateX(28px);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .page--pushed {
    animation-name: fade-in;
  }
}
```

- [ ] **Step 6: Create the tab bar: `src/components/TabBar.tsx` and `src/components/TabBar.css`**

```tsx
import { Link, useLocation } from 'react-router'
import { IconFriends, IconSettings, IconStats } from './icons'
import './TabBar.css'

const TABS = [
  { to: '/', label: 'Friends', Icon: IconFriends, matches: (path: string) => path === '/' || path.startsWith('/friends') },
  { to: '/stats', label: 'Stats', Icon: IconStats, matches: (path: string) => path.startsWith('/stats') },
  { to: '/settings', label: 'Settings', Icon: IconSettings, matches: (path: string) => path.startsWith('/settings') },
]

export function TabBar() {
  const { pathname } = useLocation()
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map(({ to, label, Icon, matches }) => {
        const active = matches(pathname)
        return (
          <Link key={to} to={to} className="tabbar__item" aria-current={active ? 'page' : undefined}>
            <Icon size={26} strokeWidth={active ? 2.2 : 1.8} />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

```css
.tabbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  justify-content: center;
  padding-bottom: var(--safe-bottom);
  border-top: 0.5px solid var(--separator);
  background: var(--surface);
}
.tabbar__item {
  flex: 1;
  max-width: 200px;
  height: var(--tabbar-height);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  color: var(--ink-3);
  font-size: var(--text-caption);
  font-weight: 500;
  text-decoration: none;
  transition: color var(--dur-fast);
}
.tabbar__item[aria-current='page'] {
  color: var(--accent-ink);
}
```

- [ ] **Step 7: Create `src/components/ScrollManager.tsx`**

New screens start at the top. Going back restores where you were, retrying for a few frames because lists load their data a moment after the screen mounts.

```tsx
import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router'

function restoreScroll(y: number) {
  let tries = 0
  const attempt = () => {
    window.scrollTo(0, y)
    if (Math.abs(window.scrollY - y) > 1 && tries++ < 20) requestAnimationFrame(attempt)
  }
  attempt()
}

export function ScrollManager() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const positions = useRef(new Map<string, number>())
  const currentKey = useRef(location.key)

  useEffect(() => {
    const onScroll = () => positions.current.set(currentKey.current, window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useLayoutEffect(() => {
    currentKey.current = location.key
    const saved = positions.current.get(location.key)
    if (navigationType === 'POP' && saved !== undefined) restoreScroll(saved)
    else window.scrollTo(0, 0)
  }, [location.key, navigationType])

  return null
}
```

- [ ] **Step 8: Create grouped lists: `src/components/InsetGroup.tsx` and `src/components/InsetGroup.css`**

`InsetGroup` is the iOS "inset grouped" list container. `Section` is a titled block for content that isn't a list (charts, chips). `Row` is one list row that can be a link, a button, or static.

```tsx
import { useId, type ReactNode } from 'react'
import { Link } from 'react-router'
import { IconChevronRight } from './icons'
import './InsetGroup.css'

interface InsetGroupProps {
  title?: string
  /** Heading level for the title (3 when nested inside a Section). */
  level?: 2 | 3
  footer?: ReactNode
  children: ReactNode
}

export function InsetGroup({ title, level = 2, footer, children }: InsetGroupProps) {
  const titleId = useId()
  const Heading = level === 3 ? 'h3' : 'h2'
  return (
    <section className="inset-group" aria-labelledby={title ? titleId : undefined}>
      {title && (
        <Heading id={titleId} className="group-title">
          {title}
        </Heading>
      )}
      <div className="inset-group__body">{children}</div>
      {footer && <p className="inset-group__footer">{footer}</p>}
    </section>
  )
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId()
  return (
    <section className="section" aria-labelledby={titleId}>
      <h2 id={titleId} className="group-title">
        {title}
      </h2>
      {children}
    </section>
  )
}

interface RowProps {
  title: ReactNode
  subtitle?: ReactNode
  leading?: ReactNode
  trailing?: ReactNode
  to?: string
  onClick?: () => void
  chevron?: boolean
  accent?: boolean
  destructive?: boolean
}

export function Row({ title, subtitle, leading, trailing, to, onClick, chevron, accent, destructive }: RowProps) {
  const className = [
    'row',
    (to || onClick) && 'row--interactive',
    accent && 'row--accent',
    destructive && 'row--destructive',
  ]
    .filter(Boolean)
    .join(' ')

  const content = (
    <>
      {leading && <span className="row__leading">{leading}</span>}
      <span className="row__main">
        <span className="row__title">{title}</span>
        {subtitle && <span className="row__subtitle">{subtitle}</span>}
      </span>
      {trailing !== undefined && <span className="row__trailing">{trailing}</span>}
      {chevron && (
        <span className="row__chevron">
          <IconChevronRight size={18} strokeWidth={2.4} />
        </span>
      )}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    )
  }
  return <div className={className}>{content}</div>
}
```

```css
.group-title {
  margin: 0 var(--space-4) var(--space-2);
  font-size: var(--text-footnote);
  font-weight: 600;
  color: var(--ink-2);
}

.inset-group__body {
  overflow: hidden;
  border-radius: var(--radius-group);
  background: var(--surface);
}
.inset-group__footer {
  margin: var(--space-2) var(--space-4) 0;
  font-size: var(--text-footnote);
  line-height: 1.4;
  color: var(--ink-2);
}

.section {
  display: flex;
  flex-direction: column;
}
.section > .inset-group + .inset-group {
  margin-top: var(--space-4);
}

.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: 52px;
  padding: var(--space-2) var(--space-4);
  color: var(--ink);
  text-align: left;
  text-decoration: none;
}
.row + .row::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  left: var(--space-4);
  border-top: 0.5px solid var(--separator);
}
.row:has(.row__leading) + .row:has(.row__leading)::before {
  left: calc(var(--space-4) + 44px + var(--space-3));
}
.row--interactive {
  cursor: pointer;
  transition: background-color var(--dur-fast);
}
.row--interactive:active {
  background: var(--surface-pressed);
}
.row__leading {
  flex: none;
  display: grid;
  place-items: center;
  width: 44px;
}
.row__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.row__title {
  overflow-wrap: anywhere;
}
.row__subtitle {
  font-size: var(--text-subhead);
  color: var(--ink-2);
  overflow-wrap: anywhere;
}
.row__trailing {
  flex: none;
  color: var(--ink-2);
  text-align: right;
}
.row__chevron {
  flex: none;
  display: grid;
  place-items: center;
  margin-right: -4px;
  color: var(--ink-3);
}
.row--accent .row__title {
  color: var(--accent-ink);
}
.row--destructive .row__title {
  color: var(--danger);
}
```

- [ ] **Step 9: Create placeholder screens**

Each later task replaces one of these files completely.

`src/screens/FriendsScreen.tsx`:

```tsx
import { Page } from '../components/Page'

export function FriendsScreen() {
  return (
    <Page title="Friends">
      <p className="list-message">Friends will show up here.</p>
    </Page>
  )
}
```

`src/screens/FriendDetailScreen.tsx`:

```tsx
import { Page } from '../components/Page'

export function FriendDetailScreen() {
  return (
    <Page title="Friend" back={{ label: 'Friends', fallback: '/' }} pushed>
      <p className="list-message">Friend details will show up here.</p>
    </Page>
  )
}
```

`src/screens/StatsScreen.tsx`:

```tsx
import { Page } from '../components/Page'

export function StatsScreen() {
  return (
    <Page title="Stats">
      <p className="list-message">Stats will show up here.</p>
    </Page>
  )
}
```

`src/screens/SettingsScreen.tsx`:

```tsx
import { Page } from '../components/Page'

export function SettingsScreen() {
  return (
    <Page title="Settings">
      <p className="list-message">Settings will show up here.</p>
    </Page>
  )
}
```

`src/screens/GroupsScreen.tsx`:

```tsx
import { Page } from '../components/Page'

export function GroupsScreen() {
  return (
    <Page title="Groups" back={{ label: 'Settings', fallback: '/settings' }} pushed>
      <p className="list-message">Groups will show up here.</p>
    </Page>
  )
}
```

`src/screens/MeetupTypesScreen.tsx`:

```tsx
import { Page } from '../components/Page'

export function MeetupTypesScreen() {
  return (
    <Page title="Meetup types" back={{ label: 'Settings', fallback: '/settings' }} pushed>
      <p className="list-message">Meetup types will show up here.</p>
    </Page>
  )
}
```

- [ ] **Step 10: Wire up routes in `src/App.tsx`**

Replace `src/App.tsx` with:

```tsx
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { ScrollManager } from './components/ScrollManager'
import { TabBar } from './components/TabBar'
import { FriendDetailScreen } from './screens/FriendDetailScreen'
import { FriendsScreen } from './screens/FriendsScreen'
import { GroupsScreen } from './screens/GroupsScreen'
import { MeetupTypesScreen } from './screens/MeetupTypesScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { StatsScreen } from './screens/StatsScreen'

export default function App() {
  return (
    <HashRouter>
      <ScrollManager />
      <main className="app">
        <Routes>
          <Route path="/" element={<FriendsScreen />} />
          <Route path="/friends/:id" element={<FriendDetailScreen />} />
          <Route path="/stats" element={<StatsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/settings/groups" element={<GroupsScreen />} />
          <Route path="/settings/types" element={<MeetupTypesScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <TabBar />
    </HashRouter>
  )
}
```

- [ ] **Step 11: Run the end-to-end tests to verify they pass**

Run: `npm run e2e`
Expected: PASS (2 tests).

- [ ] **Step 12: Look at it**

Run `npm run dev`, open the printed `Local:` URL, and switch the browser's device toolbar to 390×844. You should see a large rounded "Friends" title on a warm off-white background and a three-tab bar at the bottom. Stop the server with Ctrl+C.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: add app shell with routing, tab bar, pages and lists

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Overlays and small components (sheet, action sheet, toast, avatar, chip, empty state)

**Files:**
- Create: `src/hooks/useScrollLock.ts`, `src/hooks/useKeyboardInset.ts`, `src/components/Sheet.tsx`, `src/components/Sheet.css`, `src/components/ActionSheet.tsx`, `src/components/ActionSheet.css`, `src/components/Toast.tsx`, `src/components/Toast.css`, `src/components/Avatar.tsx`, `src/components/Avatar.css`, `src/components/Chip.tsx`, `src/components/Chip.css`, `src/components/EmptyState.tsx`, `src/components/EmptyState.css`
- Modify: `src/App.tsx`

These are exercised by the end-to-end tests of Tasks 15 to 19.

- [ ] **Step 1: Create `src/hooks/useScrollLock.ts`**

```ts
import { useEffect } from 'react'

let locks = 0

/** Stops the page behind a sheet from scrolling. Counts nested sheets. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    locks += 1
    document.documentElement.classList.add('scroll-locked')
    return () => {
      locks -= 1
      if (locks === 0) document.documentElement.classList.remove('scroll-locked')
    }
  }, [active])
}
```

- [ ] **Step 2: Create `src/hooks/useKeyboardInset.ts`**

```ts
import { useEffect } from 'react'

/** Publishes the on-screen keyboard height as --keyboard-inset so sheets stay above it. */
export function useKeyboardInset(active: boolean) {
  useEffect(() => {
    const viewport = window.visualViewport
    if (!active || !viewport) return
    const root = document.documentElement
    const update = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
      root.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`)
    }
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
      root.style.setProperty('--keyboard-inset', '0px')
    }
  }, [active])
}
```

- [ ] **Step 3: Create the bottom sheet: `src/components/Sheet.tsx` and `src/components/Sheet.css`**

Slides up from the bottom. Dismiss with Cancel, a tap on the dimmed background, or by dragging the top bar down. `onRequestClose` may ask "Discard changes?" first; the sheet only closes once the parent sets `open` to false.

```tsx
import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useKeyboardInset } from '../hooks/useKeyboardInset'
import { useScrollLock } from '../hooks/useScrollLock'
import './Sheet.css'

const EXIT_MS = 260
const DISMISS_DISTANCE = 120
const DISMISS_VELOCITY = 0.6 // px per ms

interface SheetProps {
  open: boolean
  title: string
  onRequestClose: () => void | Promise<void>
  footer?: ReactNode
  children: ReactNode
}

export function Sheet({ open, title, onRequestClose, footer, children }: SheetProps) {
  const [mounted, setMounted] = useState(open)
  if (open && !mounted) setMounted(true)
  const closing = mounted && !open

  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef<{ y: number; time: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useScrollLock(mounted)
  useKeyboardInset(mounted)

  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS)
    return () => window.clearTimeout(timer)
  }, [closing])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panelRef.current?.focus({ preventScroll: true })
    return () => previous?.focus({ preventScroll: true })
  }, [open])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest('button')) return
    dragStart.current = { y: event.clientY, time: event.timeStamp }
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return
    setDragY(Math.max(0, event.clientY - dragStart.current.y))
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = dragStart.current
    if (!start) return
    dragStart.current = null
    setDragging(false)
    const distance = event.clientY - start.y
    const velocity = distance / Math.max(1, event.timeStamp - start.time)
    if (distance > DISMISS_DISTANCE || (distance > 20 && velocity > DISMISS_VELOCITY)) {
      void Promise.resolve(onRequestClose()).finally(() => setDragY(0))
    } else {
      setDragY(0)
    }
  }

  if (!mounted) return null

  const style: CSSProperties | undefined = closing
    ? { transform: 'translateY(100%)' }
    : dragY > 0
      ? { transform: `translateY(${dragY}px)` }
      : undefined

  return createPortal(
    <div className={closing ? 'sheet-layer sheet-layer--closing' : 'sheet-layer'}>
      <div className="sheet-scrim" onClick={() => void onRequestClose()} />
      <div
        ref={panelRef}
        className={dragging ? 'sheet sheet--dragging' : 'sheet'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={style}
      >
        <div
          className="sheet__header"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span className="sheet__grabber" aria-hidden="true" />
          <div className="sheet__bar">
            <button type="button" className="text-button sheet__cancel" onClick={() => void onRequestClose()}>
              Cancel
            </button>
            <h2 id={titleId} className="sheet__title">
              {title}
            </h2>
            <span aria-hidden="true" />
          </div>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
```

```css
.sheet-layer {
  position: fixed;
  inset: 0;
  z-index: 50;
}
.sheet-layer--closing {
  pointer-events: none;
}

.sheet-scrim {
  position: absolute;
  inset: 0;
  background: var(--scrim);
  animation: fade-in var(--dur-sheet) var(--ease-out-quart);
}
.sheet-layer--closing .sheet-scrim {
  animation: fade-out 240ms var(--ease-out-quart) forwards;
}

.sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: var(--keyboard-inset);
  max-width: 600px;
  max-height: calc(100dvh - var(--keyboard-inset) - var(--safe-top) - 10px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-sheet) var(--radius-sheet) 0 0;
  background: var(--bg);
  box-shadow: var(--shadow-float);
  outline: none;
  animation: rise-in var(--dur-sheet) var(--ease-out-expo);
  transition: transform var(--dur-sheet) var(--ease-out-expo);
}
.sheet--dragging {
  transition: none;
}
.sheet-layer--closing .sheet {
  transition-duration: 240ms;
  transition-timing-function: var(--ease-out-quart);
}

.sheet__header {
  flex: none;
  padding-top: var(--space-2);
  touch-action: none;
  cursor: grab;
}
.sheet__grabber {
  display: block;
  width: 36px;
  height: 5px;
  margin: 0 auto var(--space-1);
  border-radius: 3px;
  background: var(--separator);
}
.sheet__bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 0 var(--space-2);
}
.sheet__cancel {
  justify-self: start;
}
.sheet__title {
  margin: 0;
  font-size: var(--text-body);
  font-weight: 600;
  text-align: center;
}

.sheet__body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  padding: var(--space-3) var(--space-4) var(--space-6);
}
.sheet__footer {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4) calc(var(--space-3) + var(--safe-bottom));
  border-top: 0.5px solid var(--separator);
  background: var(--bg);
}

@media (prefers-reduced-motion: reduce) {
  .sheet {
    animation-name: fade-in;
    transition: opacity 200ms linear;
  }
  .sheet-layer--closing .sheet {
    opacity: 0;
    transform: none !important;
  }
}
```

- [ ] **Step 4: Create the action sheet: `src/components/ActionSheet.tsx` and `src/components/ActionSheet.css`**

iOS-style choices and confirmations that rise from the bottom (never centered modal dialogs). `useActionSheet()` returns a function that resolves to the chosen value, or `null` on Cancel. `useConfirm()` and `useConfirmDiscard()` build on it.

```tsx
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useScrollLock } from '../hooks/useScrollLock'
import { IconCheck } from './icons'
import './ActionSheet.css'

export interface ActionSheetAction<T> {
  label: string
  value: T
  destructive?: boolean
  selected?: boolean
}

export interface ActionSheetOptions<T> {
  title?: string
  message?: string
  actions: ActionSheetAction<T>[]
}

type ShowActionSheet = <T>(options: ActionSheetOptions<T>) => Promise<T | null>

interface Pending {
  id: number
  options: ActionSheetOptions<unknown>
  resolve: (value: unknown) => void
  closing: boolean
}

const EXIT_MS = 200
const ActionSheetContext = createContext<ShowActionSheet | null>(null)

export function ActionSheetProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const nextId = useRef(0)
  useScrollLock(pending !== null)

  const show = useCallback<ShowActionSheet>(
    (options) =>
      new Promise((resolve) => {
        nextId.current += 1
        setPending({
          id: nextId.current,
          options: options as ActionSheetOptions<unknown>,
          resolve: resolve as (value: unknown) => void,
          closing: false,
        })
      }),
    [],
  )

  function finish(value: unknown) {
    if (!pending || pending.closing) return
    const { id } = pending
    pending.resolve(value)
    setPending({ ...pending, closing: true })
    window.setTimeout(() => setPending((current) => (current?.id === id ? null : current)), EXIT_MS)
  }

  const options = pending?.options
  return (
    <ActionSheetContext.Provider value={show}>
      {children}
      {pending &&
        options &&
        createPortal(
          <div className={pending.closing ? 'action-layer action-layer--closing' : 'action-layer'}>
            <div className="action-scrim" onClick={() => finish(null)} />
            <div className="action-sheet" role="alertdialog" aria-modal="true" aria-label={options.title ?? 'Choose an option'}>
              <div className="action-sheet__group">
                {(options.title || options.message) && (
                  <div className="action-sheet__header">
                    {options.title && <p className="action-sheet__title">{options.title}</p>}
                    {options.message && <p className="action-sheet__message">{options.message}</p>}
                  </div>
                )}
                {options.actions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className={action.destructive ? 'action-sheet__button action-sheet__button--destructive' : 'action-sheet__button'}
                    onClick={() => finish(action.value)}
                  >
                    {action.label}
                    {action.selected && <IconCheck size={20} />}
                  </button>
                ))}
              </div>
              <button type="button" className="action-sheet__button action-sheet__cancel" onClick={() => finish(null)}>
                Cancel
              </button>
            </div>
          </div>,
          document.body,
        )}
    </ActionSheetContext.Provider>
  )
}

export function useActionSheet(): ShowActionSheet {
  const show = useContext(ActionSheetContext)
  if (!show) throw new Error('useActionSheet must be used inside ActionSheetProvider')
  return show
}

interface ConfirmOptions {
  title?: string
  message?: string
  confirmLabel: string
  destructive?: boolean
}

/** Resolves to true when the user taps the confirm button. */
export function useConfirm() {
  const show = useActionSheet()
  return useCallback(
    async ({ title, message, confirmLabel, destructive }: ConfirmOptions) =>
      (await show({ title, message, actions: [{ label: confirmLabel, value: true, destructive }] })) === true,
    [show],
  )
}

/** For sheets: resolves to true when it's fine to close (nothing changed, or the user chose to discard). */
export function useConfirmDiscard() {
  const confirm = useConfirm()
  return useCallback(
    async (dirty: boolean) =>
      !dirty || confirm({ title: 'Discard changes?', confirmLabel: 'Discard changes', destructive: true }),
    [confirm],
  )
}
```

```css
.action-layer {
  position: fixed;
  inset: 0;
  z-index: 60;
}
.action-layer--closing {
  pointer-events: none;
}
.action-scrim {
  position: absolute;
  inset: 0;
  background: var(--scrim);
  animation: fade-in var(--dur) var(--ease-out-quart);
}
.action-layer--closing .action-scrim {
  animation: fade-out 200ms var(--ease-out-quart) forwards;
}

.action-sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-width: 600px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: 0 var(--space-2) calc(var(--space-2) + var(--safe-bottom));
  animation: rise-in var(--dur-sheet) var(--ease-out-expo);
}
.action-layer--closing .action-sheet {
  animation: action-out 200ms var(--ease-out-quart) forwards;
}
@keyframes action-out {
  to {
    transform: translateY(100%);
  }
}

.action-sheet__group {
  overflow: hidden;
  border-radius: var(--radius-group);
  background: var(--surface);
}
.action-sheet__header {
  padding: var(--space-4) var(--space-5) var(--space-3);
  text-align: center;
}
.action-sheet__title {
  margin: 0;
  font-size: var(--text-footnote);
  font-weight: 600;
  color: var(--ink-2);
}
.action-sheet__message {
  margin: var(--space-1) 0 0;
  font-size: var(--text-footnote);
  color: var(--ink-2);
}
.action-sheet__button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 56px;
  padding: 0 var(--space-4);
  border-top: 0.5px solid var(--separator);
  background: var(--surface);
  color: var(--accent-ink);
  font-size: 1.1rem;
  transition: background-color var(--dur-fast);
}
.action-sheet__group > .action-sheet__button:first-child {
  border-top: 0;
}
.action-sheet__button:active {
  background: var(--surface-pressed);
}
.action-sheet__button--destructive {
  color: var(--danger);
}
.action-sheet__cancel {
  border-top: 0;
  border-radius: var(--radius-group);
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .action-sheet {
    animation-name: fade-in;
  }
  .action-layer--closing .action-sheet {
    animation-name: fade-out;
  }
}
```

- [ ] **Step 5: Create toasts: `src/components/Toast.tsx` and `src/components/Toast.css`**

One toast at a time, above the Log button, gone after 5 seconds. A `success` toast (the default) draws a check mark: the small happy moment after logging.

```tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './Toast.css'

export interface ToastOptions {
  message: string
  actionLabel?: string
  onAction?: () => void
  /** `success` shows an animated check mark. */
  tone?: 'success' | 'plain'
}

const TOAST_MS = 5000
const ToastContext = createContext<((options: ToastOptions) => void) | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null)
  const nextId = useRef(0)

  const show = useCallback((options: ToastOptions) => {
    nextId.current += 1
    setToast({ ...options, id: nextId.current })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {createPortal(
        <div className="toast-region" role="status" aria-live="polite">
          {toast && (
            <div key={toast.id} className="toast">
              {toast.tone !== 'plain' && (
                <span className="toast__check" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} />
                  </svg>
                </span>
              )}
              <span className="toast__message">{toast.message}</span>
              {toast.actionLabel && (
                <button
                  type="button"
                  className="toast__action"
                  onClick={() => {
                    toast.onAction?.()
                    setToast(null)
                  }}
                >
                  {toast.actionLabel}
                </button>
              )}
            </div>
          )}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used inside ToastProvider')
  return show
}
```

```css
.toast-region {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(var(--tabbar-height) + var(--safe-bottom) + 84px);
  z-index: 70;
  display: flex;
  justify-content: center;
  padding: 0 var(--space-4);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  max-width: 100%;
  min-height: 52px;
  padding: var(--space-1) var(--space-1) var(--space-1) var(--space-4);
  border-radius: var(--radius-pill);
  background: var(--ink);
  color: var(--bg);
  box-shadow: var(--shadow-float);
  pointer-events: auto;
  animation: toast-in var(--dur-sheet) var(--ease-out-expo);
}
@keyframes toast-in {
  from {
    transform: translateY(16px) scale(0.96);
    opacity: 0;
  }
}

.toast__check {
  flex: none;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
}
.toast__check svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.toast__check path {
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw-check 420ms var(--ease-out-quart) 120ms forwards;
}
@keyframes draw-check {
  to {
    stroke-dashoffset: 0;
  }
}

.toast__message {
  padding: var(--space-2) var(--space-2) var(--space-2) 0;
  font-weight: 500;
}
.toast__action {
  flex: none;
  min-height: var(--tap);
  padding: 0 var(--space-4);
  border-radius: var(--radius-pill);
  background: color-mix(in oklch, var(--bg) 18%, transparent);
  color: var(--bg);
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .toast {
    animation-name: fade-in;
  }
  .toast__check path {
    animation: none;
    stroke-dashoffset: 0;
  }
}
```

- [ ] **Step 6: Create `src/components/Avatar.tsx` and `src/components/Avatar.css`**

```tsx
import { initials } from '../lib/text'
import { tintIndex } from '../lib/tint'
import './Avatar.css'

interface AvatarProps {
  name: string
  photo: string | null
  /** Stable value (the friend id) so the tint survives renames. */
  seed: string
  size?: number
}

export function Avatar({ name, photo, seed, size = 44 }: AvatarProps) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.4) }
  if (photo) return <img className="avatar" src={photo} alt="" style={style} />
  return (
    <span className={`avatar avatar--initials tint-${tintIndex(seed)}`} style={style} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
```

```css
.avatar {
  flex: none;
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  background: var(--surface-2);
  object-fit: cover;
}
.avatar--initials {
  background: var(--tint-bg);
  color: var(--tint-fg);
  font-family: var(--font-rounded);
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  user-select: none;
}
```

- [ ] **Step 7: Create `src/components/Chip.tsx` and `src/components/Chip.css`**

```tsx
import type { ReactNode } from 'react'
import './Chip.css'

interface ChipProps {
  selected?: boolean
  onClick?: () => void
  ariaLabel?: string
  children: ReactNode
}

export function Chip({ selected = false, onClick, ariaLabel, children }: ChipProps) {
  return (
    <button type="button" className="chip" aria-pressed={selected} aria-label={ariaLabel} onClick={onClick}>
      {children}
    </button>
  )
}
```

```css
.chip {
  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  color: var(--ink);
  font-size: var(--text-subhead);
  font-weight: 500;
  white-space: nowrap;
  transition:
    background-color var(--dur-fast) var(--ease-out-quart),
    color var(--dur-fast) var(--ease-out-quart),
    transform var(--dur-fast) var(--ease-out-quart);
}
/* Grows the tap target to 44px without changing the look. */
.chip::after {
  content: '';
  position: absolute;
  inset: -4px 0;
}
.chip:active {
  transform: scale(0.96);
}
.chip[aria-pressed='true'],
.chip[data-selected='true'] {
  background: var(--accent);
  color: var(--on-accent);
}
.chip .avatar {
  margin-left: -8px;
}

@media (prefers-reduced-motion: reduce) {
  .chip:active {
    transform: none;
  }
}
```

- [ ] **Step 8: Create `src/components/EmptyState.tsx` and `src/components/EmptyState.css`**

The two soft circles echo the app icon.

```tsx
import type { ReactNode } from 'react'
import './EmptyState.css'

interface EmptyStateProps {
  title: string
  message?: string
  action?: ReactNode
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <svg className="empty-state__art" viewBox="0 0 120 80" aria-hidden="true">
        <circle cx="48" cy="40" r="28" className="empty-state__circle-a" />
        <circle cx="72" cy="40" r="28" className="empty-state__circle-b" />
      </svg>
      <p className="empty-state__title">{title}</p>
      {message && <p className="empty-state__message">{message}</p>}
      {action}
    </div>
  )
}
```

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-10) var(--space-6);
  text-align: center;
}
.empty-state__art {
  width: 120px;
  height: 80px;
  margin-bottom: var(--space-3);
}
.empty-state__circle-a {
  fill: var(--accent-soft);
}
.empty-state__circle-b {
  fill: var(--accent);
  opacity: 0.75;
}
.empty-state__title {
  max-width: 22ch;
  margin: 0;
  font-family: var(--font-rounded);
  font-size: var(--text-title-3);
  font-weight: 600;
  text-wrap: balance;
}
.empty-state__message {
  max-width: 32ch;
  margin: 0 0 var(--space-3);
  color: var(--ink-2);
}
```

- [ ] **Step 9: Add the providers to `src/App.tsx`**

Replace `src/App.tsx` with:

```tsx
import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { ActionSheetProvider } from './components/ActionSheet'
import { ScrollManager } from './components/ScrollManager'
import { TabBar } from './components/TabBar'
import { ToastProvider } from './components/Toast'
import { FriendDetailScreen } from './screens/FriendDetailScreen'
import { FriendsScreen } from './screens/FriendsScreen'
import { GroupsScreen } from './screens/GroupsScreen'
import { MeetupTypesScreen } from './screens/MeetupTypesScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { StatsScreen } from './screens/StatsScreen'

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <ActionSheetProvider>
          <ScrollManager />
          <main className="app">
            <Routes>
              <Route path="/" element={<FriendsScreen />} />
              <Route path="/friends/:id" element={<FriendDetailScreen />} />
              <Route path="/stats" element={<StatsScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
              <Route path="/settings/groups" element={<GroupsScreen />} />
              <Route path="/settings/types" element={<MeetupTypesScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <TabBar />
        </ActionSheetProvider>
      </ToastProvider>
    </HashRouter>
  )
}
```

- [ ] **Step 10: Verify**

Run: `npm run build`
Expected: succeeds with no type errors.

Run: `npm run e2e`
Expected: PASS (2 tests, unchanged).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add sheet, action sheet, toast, avatar, chip and empty state

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Friends list and the friend sheet

**Files:**
- Create: `src/lib/image.ts`, `src/lib/platform.ts`, `src/sheets/sheetsContext.ts`, `src/sheets/SheetsProvider.tsx`, `src/sheets/FriendSheet.tsx`, `src/sheets/FriendSheet.css`, `src/components/InstallHint.tsx`, `src/components/InstallHint.css`, `src/screens/FriendsScreen.css`, `e2e/helpers.ts`, `e2e/friends.spec.ts`
- Modify: `src/screens/FriendsScreen.tsx` (replace), `src/App.tsx`

- [ ] **Step 1: Write the end-to-end helpers**

`e2e/helpers.ts`:

```ts
import { expect, type Page } from '@playwright/test'

/** A valid 1×1 PNG. */
export const ONE_PIXEL_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export async function goToTab(page: Page, name: 'Friends' | 'Stats' | 'Settings') {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click()
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible()
}

export async function addFriend(page: Page, name: string, group?: string) {
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheet.getByLabel('Name', { exact: true }).fill(name)
  if (group) {
    const existing = sheet.getByRole('button', { name: group, exact: true })
    if ((await existing.count()) > 0) {
      await existing.click()
    } else {
      await sheet.getByRole('button', { name: 'New group' }).click()
      await sheet.getByLabel('New group name').fill(group)
      await sheet.getByRole('button', { name: 'Add', exact: true }).click()
      await expect(sheet.getByRole('button', { name: group, exact: true })).toHaveAttribute('aria-pressed', 'true')
    }
  }
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
}
```

- [ ] **Step 2: Write the failing end-to-end tests**

`e2e/friends.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { addFriend, ONE_PIXEL_PNG } from './helpers.ts'

test('shows a welcome state with no friends', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Add the people you want to keep up with.')).toBeVisible()
})

test('adds friends and lists them', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex Smith')
  await addFriend(page, 'Sam')
  await expect(page.getByRole('status')).toContainText('Added Sam')
  await expect(page.getByRole('link', { name: /Alex Smith/ })).toContainText('Not seen yet')
  await expect(page.getByRole('link', { name: /Sam/ })).toBeVisible()
})

test('requires a name', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet.getByText('Please enter a name.')).toBeVisible()
})

test('asks before discarding a half-filled friend', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheet.getByLabel('Name', { exact: true }).fill('Kim')
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('link', { name: /Kim/ })).toHaveCount(0)
})

test('filters by group and search', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex', 'College')
  await addFriend(page, 'Kim', 'Work')
  await addFriend(page, 'Sam', 'College')
  await expect(page.getByRole('link', { name: /Alex/ })).toContainText('College')

  const filters = page.getByRole('group', { name: 'Filter by group' })
  await filters.getByRole('button', { name: 'College' }).click()
  await expect(page.getByRole('link', { name: /Kim/ })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Sam/ })).toBeVisible()

  await filters.getByRole('button', { name: 'All' }).click()
  await page.getByLabel('Search friends').fill('ki')
  await expect(page.getByRole('link', { name: /Kim/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Alex/ })).toHaveCount(0)
})

test('adds a photo', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Add friend' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'New friend' })
  await sheet.locator('input[type="file"]').setInputFiles({
    name: 'dot.png',
    mimeType: 'image/png',
    buffer: Buffer.from(ONE_PIXEL_PNG, 'base64'),
  })
  await expect(sheet.locator('img.avatar')).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Remove photo' })).toBeVisible()
})

test('install hint can be dismissed and stays dismissed', async ({ page }) => {
  await page.goto('/')
  const hint = page.getByRole('complementary', { name: 'Install the app' })
  await expect(hint).toBeVisible()
  await hint.getByRole('button', { name: 'Dismiss' }).click()
  await expect(hint).toBeHidden()
  await page.reload()
  await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
  await expect(hint).toBeHidden()
})
```

Run: `npm run e2e`
Expected: FAIL (the new tests can't find "Add friend").

- [ ] **Step 3: Create `src/lib/image.ts`**

```ts
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load image'))
    image.src = url
  })
}

/** Shrinks a photo so its longest side is at most `maxSide`, as a JPEG data URL. */
export async function resizeImageToDataUrl(file: Blob, maxSide = 400, quality = 0.85): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const image = await loadImage(url)
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is not available')
    context.fillStyle = 'white' // JPEG has no transparency
    context.fillRect(0, 0, width, height)
    context.drawImage(image, 0, 0, width, height)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(url)
  }
}
```

- [ ] **Step 4: Create `src/lib/platform.ts`**

```ts
/** True when opened from the Home Screen icon rather than a Safari tab. */
export function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}
```

- [ ] **Step 5: Create the sheets context and provider**

`src/sheets/sheetsContext.ts`:

```ts
import { createContext, useContext } from 'react'
import type { Friend } from '../types'

export interface FriendSheetRequest {
  /** Present when editing; absent when adding. */
  friend?: Friend
}

export interface SheetsApi {
  openFriendSheet: (request?: FriendSheetRequest) => void
}

export const SheetsContext = createContext<SheetsApi | null>(null)

export function useSheets(): SheetsApi {
  const api = useContext(SheetsContext)
  if (!api) throw new Error('useSheets must be used inside SheetsProvider')
  return api
}
```

`src/sheets/SheetsProvider.tsx` (a new `key` on every open gives the sheet a fresh form):

```tsx
import { useMemo, useState, type ReactNode } from 'react'
import { FriendSheet } from './FriendSheet'
import { SheetsContext, type FriendSheetRequest, type SheetsApi } from './sheetsContext'

export function SheetsProvider({ children }: { children: ReactNode }) {
  const [friendRequest, setFriendRequest] = useState<FriendSheetRequest | null>(null)
  const [friendKey, setFriendKey] = useState(0)

  const api = useMemo<SheetsApi>(
    () => ({
      openFriendSheet: (request = {}) => {
        setFriendKey((key) => key + 1)
        setFriendRequest(request)
      },
    }),
    [],
  )

  return (
    <SheetsContext.Provider value={api}>
      {children}
      <FriendSheet key={friendKey} request={friendRequest} onClose={() => setFriendRequest(null)} />
    </SheetsContext.Provider>
  )
}
```

- [ ] **Step 6: Create the friend sheet: `src/sheets/FriendSheet.tsx` and `src/sheets/FriendSheet.css`**

```tsx
import { useId, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { useConfirm, useConfirmDiscard } from '../components/ActionSheet'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { IconCamera, IconPlus } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useGroups } from '../data/hooks'
import { ValidationError } from '../db/errors'
import { addFriend, deleteFriend, updateFriend } from '../db/friends'
import { addGroup } from '../db/groups'
import { resizeImageToDataUrl } from '../lib/image'
import type { FriendSheetRequest } from './sheetsContext'
import './FriendSheet.css'

interface FriendSheetProps {
  request: FriendSheetRequest | null
  onClose: () => void
}

export function FriendSheet({ request, onClose }: FriendSheetProps) {
  const [initial] = useState(request)
  const editing = initial?.friend
  const groups = useGroups() ?? []
  const confirm = useConfirm()
  const confirmDiscard = useConfirmDiscard()
  const toast = useToast()
  const navigate = useNavigate()
  const fileInput = useRef<HTMLInputElement>(null)
  const nameId = useId()
  const notesId = useId()
  const groupLabelId = useId()

  const [name, setName] = useState(editing?.name ?? '')
  const [groupId, setGroupId] = useState<string | null>(editing?.groupId ?? null)
  const [photo, setPhoto] = useState<string | null>(editing?.photo ?? null)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [newGroupName, setNewGroupName] = useState<string | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)
  const [groupError, setGroupError] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const dirty =
    name !== (editing?.name ?? '') ||
    groupId !== (editing?.groupId ?? null) ||
    photo !== (editing?.photo ?? null) ||
    notes !== (editing?.notes ?? '')

  async function requestClose() {
    if (await confirmDiscard(dirty)) onClose()
  }

  async function save() {
    if (!name.trim()) {
      setNameError('Please enter a name.')
      return
    }
    setSaving(true)
    try {
      const input = { name, groupId, photo, notes }
      if (editing) {
        await updateFriend(editing.id, input)
        toast({ message: 'Saved' })
      } else {
        const friend = await addFriend(input)
        toast({ message: `Added ${friend.name}` })
      }
      onClose()
    } catch (error) {
      if (error instanceof ValidationError) setNameError(error.message)
      else toast({ message: "Couldn't save. Please try again.", tone: 'plain' })
    } finally {
      setSaving(false)
    }
  }

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setPhoto(await resizeImageToDataUrl(file))
      setPhotoError(null)
    } catch {
      setPhotoError("That image couldn't be used. Try a different photo.")
    }
  }

  async function createGroup() {
    try {
      const group = await addGroup(newGroupName ?? '')
      setGroupId(group.id)
      setNewGroupName(null)
      setGroupError(null)
    } catch (error) {
      setGroupError(error instanceof ValidationError ? error.message : "Couldn't add the group.")
    }
  }

  async function remove() {
    if (!editing) return
    const confirmed = await confirm({
      title: `Delete ${editing.name}?`,
      message: 'Meetups with only them are deleted too. Meetups with other friends stay.',
      confirmLabel: 'Delete friend',
      destructive: true,
    })
    if (!confirmed) return
    await deleteFriend(editing.id)
    onClose()
    navigate('/', { replace: true })
    toast({ message: `Deleted ${editing.name}`, tone: 'plain' })
  }

  return (
    <Sheet
      open={request !== null}
      title={editing ? 'Edit friend' : 'New friend'}
      onRequestClose={requestClose}
      footer={
        <button type="button" className="button button--primary button--block" onClick={save} disabled={saving}>
          Save
        </button>
      }
    >
      <div className="friend-form__photo">
        <button
          type="button"
          className="friend-form__avatar"
          onClick={() => fileInput.current?.click()}
          aria-label={photo ? 'Change photo' : 'Add photo'}
        >
          <Avatar name={name || '?'} photo={photo} seed={editing?.id ?? 'new-friend'} size={96} />
          <span className="friend-form__camera">
            <IconCamera size={18} />
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="visually-hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={choosePhoto}
        />
        {photo && (
          <button type="button" className="text-button" onClick={() => setPhoto(null)}>
            Remove photo
          </button>
        )}
        {photoError && <p className="field-error">{photoError}</p>}
      </div>

      <div className="form-section">
        <label className="field-label" htmlFor={nameId}>
          Name
        </label>
        <input
          id={nameId}
          className="field"
          value={name}
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
          aria-invalid={nameError !== null}
          onChange={(event) => {
            setName(event.target.value)
            setNameError(null)
          }}
        />
        {nameError && <p className="field-error">{nameError}</p>}
      </div>

      <div className="form-section">
        <span className="field-label" id={groupLabelId}>
          Group
        </span>
        <div className="chip-wrap" role="group" aria-labelledby={groupLabelId}>
          <Chip selected={groupId === null} onClick={() => setGroupId(null)}>
            None
          </Chip>
          {groups.map((group) => (
            <Chip key={group.id} selected={groupId === group.id} onClick={() => setGroupId(group.id)}>
              {group.name}
            </Chip>
          ))}
          {newGroupName === null && (
            <Chip onClick={() => setNewGroupName('')}>
              <IconPlus size={16} strokeWidth={2.4} />
              New group
            </Chip>
          )}
        </div>
        {newGroupName !== null && (
          <div className="friend-form__new-group">
            <input
              className="field"
              value={newGroupName}
              placeholder="Group name"
              aria-label="New group name"
              autoFocus
              autoCapitalize="words"
              enterKeyHint="done"
              onChange={(event) => {
                setNewGroupName(event.target.value)
                setGroupError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void createGroup()
                }
              }}
            />
            <button type="button" className="button button--secondary" onClick={createGroup}>
              Add
            </button>
          </div>
        )}
        {groupError && <p className="field-error">{groupError}</p>}
      </div>

      <div className="form-section">
        <label className="field-label" htmlFor={notesId}>
          Notes
        </label>
        <textarea
          id={notesId}
          className="field"
          rows={3}
          value={notes}
          placeholder="Birthday, partner's name, favorite things"
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      {editing && (
        <InsetGroup>
          <Row title="Delete friend" destructive onClick={remove} />
        </InsetGroup>
      )}
    </Sheet>
  )
}
```

```css
.friend-form__photo {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}
.friend-form__avatar {
  position: relative;
  border-radius: 50%;
}
.friend-form__camera {
  position: absolute;
  right: -2px;
  bottom: -2px;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 3px solid var(--bg);
  border-radius: 50%;
  background: var(--accent);
  color: var(--on-accent);
}
.friend-form__new-group {
  display: flex;
  gap: var(--space-2);
}
.friend-form__new-group .field {
  flex: 1;
}
```

- [ ] **Step 7: Create the install hint: `src/components/InstallHint.tsx` and `src/components/InstallHint.css`**

```tsx
import { IconClose, IconShare } from './icons'
import './InstallHint.css'

export function InstallHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <aside className="install-hint" aria-label="Install the app">
      <div>
        <p className="install-hint__title">Add Friends to your Home Screen</p>
        <p className="install-hint__body">
          Tap <IconShare size={16} /> Share, then “Add to Home Screen”. Open the app from there, since that’s where
          your data is saved.
        </p>
      </div>
      <button type="button" className="icon-button install-hint__close" onClick={onDismiss} aria-label="Dismiss">
        <IconClose size={20} />
      </button>
    </aside>
  )
}
```

```css
.install-hint {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-4);
  border-radius: var(--radius-group);
  background: var(--accent-soft);
}
.install-hint__title {
  margin: 0 0 var(--space-1);
  font-weight: 600;
}
.install-hint__body {
  margin: 0;
  font-size: var(--text-subhead);
  line-height: 1.45;
  color: var(--ink-2);
}
.install-hint__body svg {
  display: inline;
  vertical-align: -3px;
}
.install-hint__close {
  flex: none;
  margin: -10px -10px 0 0;
  color: var(--ink-2);
}
```

- [ ] **Step 8: Build the Friends screen**

Replace `src/screens/FriendsScreen.tsx` with:

```tsx
import { useMemo, useState } from 'react'
import { useActionSheet } from '../components/ActionSheet'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { EmptyState } from '../components/EmptyState'
import { IconPlus, IconSearch, IconSort } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import { InstallHint } from '../components/InstallHint'
import { Page } from '../components/Page'
import { useFriends, useGroups, useMeetups, useSetting } from '../data/hooks'
import { setSetting } from '../db/settings'
import { useToday } from '../hooks/useToday'
import { daysBetween, yearOf } from '../lib/dates'
import { isStandalone } from '../lib/platform'
import { formatSince } from '../lib/text'
import { useSheets } from '../sheets/sheetsContext'
import { countsByFriendForYear } from '../stats/counts'
import { lastSeenByFriend } from '../stats/lastSeen'
import { FRIEND_SORT_LABELS, sortFriends, type FriendSort } from '../stats/sortFriends'
import './FriendsScreen.css'

const SORT_KEY = 'friend-tracker:sort'
const SORTS = Object.keys(FRIEND_SORT_LABELS) as FriendSort[]

function readStoredSort(): FriendSort {
  try {
    const value = localStorage.getItem(SORT_KEY)
    if (SORTS.includes(value as FriendSort)) return value as FriendSort
  } catch {
    // Storage can be unavailable; fall back to the default.
  }
  return 'lastSeen'
}

function storeSort(sort: FriendSort) {
  try {
    localStorage.setItem(SORT_KEY, sort)
  } catch {
    // Not important enough to report.
  }
}

export function FriendsScreen() {
  const friends = useFriends()
  const groups = useGroups()
  const meetups = useMeetups()
  const hintDismissed = useSetting('installHintDismissed')
  const today = useToday()
  const { openFriendSheet } = useSheets()
  const showActionSheet = useActionSheet()
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [sort, setSort] = useState<FriendSort>(readStoredSort)

  const activeGroup = groups?.find((group) => group.id === groupFilter) ?? null
  const groupNames = useMemo(() => new Map((groups ?? []).map((group) => [group.id, group.name] as const)), [groups])

  const rows = useMemo(() => {
    if (!friends || !meetups) return []
    const lastSeen = lastSeenByFriend(meetups, today)
    const counts = countsByFriendForYear(meetups, yearOf(today), today)
    const q = query.trim().toLocaleLowerCase()
    return sortFriends(friends, meetups, sort, today)
      .filter((friend) => activeGroup === null || friend.groupId === activeGroup.id)
      .filter((friend) => q === '' || friend.name.toLocaleLowerCase().includes(q))
      .map((friend) => ({ friend, lastSeen: lastSeen.get(friend.id) ?? null, count: counts.get(friend.id) ?? 0 }))
  }, [friends, meetups, today, sort, activeGroup, query])

  async function chooseSort() {
    const choice = await showActionSheet<FriendSort>({
      title: 'Sort friends by',
      actions: SORTS.map((value) => ({ label: FRIEND_SORT_LABELS[value], value, selected: value === sort })),
    })
    if (choice) {
      setSort(choice)
      storeSort(choice)
    }
  }

  if (!friends || !groups || !meetups || hintDismissed === undefined) return null

  return (
    <Page
      title="Friends"
      actions={
        <>
          <button
            type="button"
            className="icon-button"
            onClick={chooseSort}
            aria-label={`Sort: ${FRIEND_SORT_LABELS[sort]}`}
          >
            <IconSort />
          </button>
          <button type="button" className="icon-button" onClick={() => openFriendSheet()} aria-label="Add friend">
            <IconPlus />
          </button>
        </>
      }
    >
      {!hintDismissed && !isStandalone() && (
        <InstallHint onDismiss={() => void setSetting('installHintDismissed', true)} />
      )}

      {friends.length === 0 ? (
        <EmptyState
          title="Add the people you want to keep up with."
          message="Then log a meetup whenever you see them."
          action={
            <button type="button" className="button button--primary" onClick={() => openFriendSheet()}>
              Add friend
            </button>
          }
        />
      ) : (
        <>
          <div className="friends-filters">
            <label className="search">
              <IconSearch size={18} />
              <input
                type="search"
                className="search__input"
                placeholder="Search"
                aria-label="Search friends"
                enterKeyHint="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            {groups.length > 0 && (
              <div className="chip-row" role="group" aria-label="Filter by group">
                <Chip selected={activeGroup === null} onClick={() => setGroupFilter(null)}>
                  All
                </Chip>
                {groups.map((group) => (
                  <Chip
                    key={group.id}
                    selected={activeGroup?.id === group.id}
                    onClick={() => setGroupFilter(group.id)}
                  >
                    {group.name}
                  </Chip>
                ))}
              </div>
            )}
          </div>

          {rows.length > 0 ? (
            <InsetGroup>
              {rows.map(({ friend, lastSeen, count }) => (
                <Row
                  key={friend.id}
                  to={`/friends/${friend.id}`}
                  leading={<Avatar name={friend.name} photo={friend.photo} seed={friend.id} />}
                  title={friend.name}
                  subtitle={[
                    friend.groupId ? groupNames.get(friend.groupId) : undefined,
                    lastSeen ? formatSince(daysBetween(lastSeen, today)) : 'Not seen yet',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  trailing={
                    <span className="friend-count">
                      <span className="numeric friend-count__value">{count}</span>
                      <span className="friend-count__label">this year</span>
                    </span>
                  }
                />
              ))}
            </InsetGroup>
          ) : (
            <p className="list-message">
              {query.trim()
                ? `No friends match “${query.trim()}”.`
                : `No friends in ${activeGroup?.name ?? 'this group'} yet.`}
            </p>
          )}
        </>
      )}
    </Page>
  )
}
```

`src/screens/FriendsScreen.css`:

```css
.friends-filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-bottom: calc(-1 * var(--space-2));
}

.friend-count {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.15;
}
.friend-count__value {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--ink);
}
.friend-count__label {
  font-size: var(--text-caption);
  color: var(--ink-2);
}
```

- [ ] **Step 9: Add the sheets provider to `src/App.tsx`**

In `src/App.tsx`, add the import:

```tsx
import { SheetsProvider } from './sheets/SheetsProvider'
```

and wrap the content of `<ActionSheetProvider>` so that part reads:

```tsx
        <ActionSheetProvider>
          <SheetsProvider>
            <ScrollManager />
            <main className="app">
              <Routes>
                <Route path="/" element={<FriendsScreen />} />
                <Route path="/friends/:id" element={<FriendDetailScreen />} />
                <Route path="/stats" element={<StatsScreen />} />
                <Route path="/settings" element={<SettingsScreen />} />
                <Route path="/settings/groups" element={<GroupsScreen />} />
                <Route path="/settings/types" element={<MeetupTypesScreen />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <TabBar />
          </SheetsProvider>
        </ActionSheetProvider>
```

- [ ] **Step 10: Run the end-to-end tests to verify they pass**

Run: `npm run e2e`
Expected: PASS (9 tests).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add friends list with search, group filter, sort, and friend sheet

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Logging meetups

**Files:**
- Create: `src/sheets/MeetupSheet.tsx`, `src/sheets/MeetupSheet.css`, `src/components/LogButton.tsx`, `src/components/LogButton.css`, `e2e/meetups.spec.ts`
- Modify: `src/sheets/sheetsContext.ts` (replace), `src/sheets/SheetsProvider.tsx` (replace), `src/screens/FriendsScreen.tsx`, `e2e/helpers.ts`

- [ ] **Step 1: Add the `logMeetup` helper to `e2e/helpers.ts`**

Append:

```ts
export async function logMeetup(
  page: Page,
  names: string[],
  options: { type?: string; date?: string; note?: string } = {},
) {
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  for (const name of names) {
    await sheet.getByLabel('Search all friends').fill(name)
    await sheet.getByRole('group', { name: 'Search results' }).getByRole('button', { name, exact: true }).click()
  }
  if (options.type) await sheet.getByRole('button', { name: options.type, exact: true }).click()
  if (options.date) await sheet.getByLabel('Pick a date').fill(options.date)
  if (options.note) await sheet.getByLabel('Note').fill(options.note)
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
}
```

- [ ] **Step 2: Write the failing end-to-end tests**

`e2e/meetups.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { addFriend, logMeetup } from './helpers.ts'

test('logs a meetup with two friends', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await addFriend(page, 'Sam')
  await addFriend(page, 'Kim')
  await logMeetup(page, ['Alex', 'Sam'], { type: 'Meal' })
  await expect(page.getByRole('status')).toContainText('Logged with Alex and Sam')
  await expect(page.getByRole('link', { name: /Alex/ })).toContainText('Today')
  await expect(page.getByRole('link', { name: /Sam/ })).toContainText('Today')
  await expect(page.getByRole('link', { name: /Kim/ })).toContainText('Not seen yet')
})

test('undo removes the meetup', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
  await expect(page.getByRole('link', { name: /Alex/ })).toContainText('Not seen yet')
})

test('Save waits for a friend to be picked', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await expect(sheet.getByRole('button', { name: 'Pick a friend' })).toBeDisabled()
  await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
  await expect(sheet.getByRole('button', { name: 'Save' })).toBeEnabled()
})

test('logs a meetup on another date', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { date: '2025-03-14' })
  await expect(page.getByRole('link', { name: /Alex/ })).toContainText('year')
})

test('asks before discarding a started meetup', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await sheet.getByRole('group', { name: 'Recent friends' }).getByRole('button', { name: 'Alex' }).click()
  await sheet.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Discard changes' }).click()
  await expect(sheet).toBeHidden()
})

test('sorts friends by most seen this year', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Amy')
  await addFriend(page, 'Zoe')
  await logMeetup(page, ['Zoe'])
  const names = page.locator('.row__title')
  await expect(names).toHaveText(['Amy', 'Zoe'])
  await page.getByRole('button', { name: /^Sort/ }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Most seen this year' }).click()
  await expect(names).toHaveText(['Zoe', 'Amy'])
})
```

Run: `npm run e2e`
Expected: FAIL (no "Log meetup" button yet).

- [ ] **Step 3: Add the meetup request to `src/sheets/sheetsContext.ts`**

Replace the file with:

```ts
import { createContext, useContext } from 'react'
import type { Friend, Meetup } from '../types'

export interface FriendSheetRequest {
  /** Present when editing; absent when adding. */
  friend?: Friend
}

export interface MeetupSheetRequest {
  /** Present when editing; absent when logging a new meetup. */
  meetup?: Meetup
  /** Friend to pre-select when logging from their page. */
  presetFriendId?: string
}

export interface SheetsApi {
  openFriendSheet: (request?: FriendSheetRequest) => void
  openMeetupSheet: (request?: MeetupSheetRequest) => void
}

export const SheetsContext = createContext<SheetsApi | null>(null)

export function useSheets(): SheetsApi {
  const api = useContext(SheetsContext)
  if (!api) throw new Error('useSheets must be used inside SheetsProvider')
  return api
}
```

- [ ] **Step 4: Create the meetup sheet: `src/sheets/MeetupSheet.tsx` and `src/sheets/MeetupSheet.css`**

Fields in order of importance: Who, What, When, Note. Recent friends are one tap; search covers everyone else.

```tsx
import { useId, useMemo, useState } from 'react'
import { useConfirmDiscard } from '../components/ActionSheet'
import { Avatar } from '../components/Avatar'
import { Chip } from '../components/Chip'
import { IconCalendar, IconCheck, IconClose, IconSearch } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useFriends, useMeetups, useMeetupTypes } from '../data/hooks'
import { ValidationError } from '../db/errors'
import { addMeetup, deleteMeetup, restoreMeetup, updateMeetup } from '../db/meetups'
import { useToday } from '../hooks/useToday'
import { addDays, formatDate, isISODate, todayISO } from '../lib/dates'
import { compareNames, formatNameList } from '../lib/text'
import { recentFriends } from '../stats/recent'
import type { Friend } from '../types'
import type { MeetupSheetRequest } from './sheetsContext'
import './MeetupSheet.css'

interface MeetupSheetProps {
  request: MeetupSheetRequest | null
  onClose: () => void
}

export function MeetupSheet({ request, onClose }: MeetupSheetProps) {
  const [initial] = useState(request)
  const editing = initial?.meetup
  const friends = useFriends()
  const meetups = useMeetups()
  const types = useMeetupTypes()
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
  }))
  const [friendIds, setFriendIds] = useState<string[]>(start.friendIds)
  const [typeId, setTypeId] = useState<string | null>(start.typeId)
  const [date, setDate] = useState(start.date)
  const [note, setNote] = useState(start.note)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const effectiveTypeId = typeId ?? types?.[0]?.id ?? null
  const yesterday = addDays(today, -1)
  const isOtherDate = date !== today && date !== yesterday

  const friendById = useMemo(() => new Map((friends ?? []).map((f) => [f.id, f] as const)), [friends])
  const selected = friendIds.map((id) => friendById.get(id)).filter((f): f is Friend => f !== undefined)
  const recent = useMemo(
    () => (friends && meetups ? recentFriends(friends, meetups, today) : []),
    [friends, meetups, today],
  )
  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase()
    if (!q || !friends) return []
    return friends
      .filter((f) => f.name.toLocaleLowerCase().includes(q))
      .sort((a, b) => compareNames(a.name, b.name))
      .slice(0, 20)
  }, [friends, query])

  const dirty =
    friendIds.join() !== start.friendIds.join() ||
    typeId !== start.typeId ||
    date !== start.date ||
    note !== start.note

  function toggleFriend(id: string) {
    setFriendIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
    setError(null)
  }

  async function requestClose() {
    if (await confirmDiscard(dirty)) onClose()
  }

  async function save() {
    if (friendIds.length === 0 || !effectiveTypeId) return
    setSaving(true)
    try {
      const input = { date, typeId: effectiveTypeId, friendIds, note }
      if (editing) {
        await updateMeetup(editing.id, input)
        toast({ message: 'Saved' })
      } else {
        const meetup = await addMeetup(input)
        toast({
          message: `Logged with ${formatNameList(selected.map((f) => f.name))}`,
          actionLabel: 'Undo',
          onAction: () => void deleteMeetup(meetup.id),
        })
      }
      onClose()
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : "Couldn't save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!editing) return
    const deleted = await deleteMeetup(editing.id)
    onClose()
    if (deleted) {
      toast({
        message: 'Meetup deleted',
        tone: 'plain',
        actionLabel: 'Undo',
        onAction: () => void restoreMeetup(deleted),
      })
    }
  }

  return (
    <Sheet
      open={request !== null}
      title={editing ? 'Edit meetup' : 'Log meetup'}
      onRequestClose={requestClose}
      footer={
        <>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <button
            type="button"
            className="button button--primary button--block"
            onClick={save}
            disabled={saving || friendIds.length === 0 || effectiveTypeId === null}
          >
            {friendIds.length === 0 ? 'Pick a friend' : 'Save'}
          </button>
        </>
      }
    >
      <section className="form-section" aria-labelledby={whoId}>
        <h3 id={whoId} className="form-section__label">
          Who
        </h3>
        {selected.length > 0 && (
          <div className="chip-wrap" role="group" aria-label="Selected friends">
            {selected.map((friend) => (
              <Chip
                key={friend.id}
                selected
                onClick={() => toggleFriend(friend.id)}
                ariaLabel={`Remove ${friend.name}`}
              >
                <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={24} />
                {friend.name}
                <IconClose size={14} strokeWidth={2.6} />
              </Chip>
            ))}
          </div>
        )}
        {recent.length > 0 && (
          <div className="recent-friends" role="group" aria-label="Recent friends">
            {recent.map((friend) => {
              const on = friendIds.includes(friend.id)
              return (
                <button
                  key={friend.id}
                  type="button"
                  className="recent-friend"
                  aria-pressed={on}
                  onClick={() => toggleFriend(friend.id)}
                >
                  <span className="recent-friend__avatar">
                    <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={52} />
                    {on && (
                      <span className="recent-friend__check">
                        <IconCheck size={14} strokeWidth={3} />
                      </span>
                    )}
                  </span>
                  <span className="recent-friend__name">{friend.name}</span>
                </button>
              )
            })}
          </div>
        )}
        <label className="search">
          <IconSearch size={18} />
          <input
            type="search"
            className="search__input"
            placeholder="Search all friends"
            aria-label="Search all friends"
            enterKeyHint="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {query.trim() !== '' &&
          (results.length > 0 ? (
            <div role="group" aria-label="Search results">
              <InsetGroup>
                {results.map((friend) => (
                  <Row
                    key={friend.id}
                    onClick={() => {
                      toggleFriend(friend.id)
                      setQuery('')
                    }}
                    leading={<Avatar name={friend.name} photo={friend.photo} seed={friend.id} />}
                    title={friend.name}
                    trailing={friendIds.includes(friend.id) ? <IconCheck size={20} /> : undefined}
                  />
                ))}
              </InsetGroup>
            </div>
          ) : (
            <p className="list-message">No friends match “{query.trim()}”.</p>
          ))}
      </section>

      <section className="form-section" aria-labelledby={whatId}>
        <h3 id={whatId} className="form-section__label">
          What
        </h3>
        <div className="chip-row" role="group" aria-labelledby={whatId}>
          {(types ?? []).map((type) => (
            <Chip key={type.id} selected={type.id === effectiveTypeId} onClick={() => setTypeId(type.id)}>
              <span aria-hidden="true">{type.emoji}</span>
              {type.name}
            </Chip>
          ))}
        </div>
      </section>

      <section className="form-section" aria-labelledby={whenId}>
        <h3 id={whenId} className="form-section__label">
          When
        </h3>
        <div className="chip-wrap" role="group" aria-labelledby={whenId}>
          <Chip selected={date === today} onClick={() => setDate(today)}>
            Today
          </Chip>
          <Chip selected={date === yesterday} onClick={() => setDate(yesterday)}>
            Yesterday
          </Chip>
          <label className="chip date-chip" data-selected={isOtherDate}>
            <IconCalendar size={16} />
            {isOtherDate ? formatDate(date, today) : 'Pick date'}
            <input
              type="date"
              className="date-chip__input"
              aria-label="Pick a date"
              value={date}
              onClick={(event) => {
                try {
                  event.currentTarget.showPicker()
                } catch {
                  // Older browsers open the picker on their own.
                }
              }}
              onChange={(event) => {
                if (isISODate(event.target.value)) setDate(event.target.value)
              }}
            />
          </label>
        </div>
      </section>

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
          onChange={(event) => setNote(event.target.value)}
        />
      </div>

      {editing && (
        <InsetGroup>
          <Row title="Delete meetup" destructive onClick={remove} />
        </InsetGroup>
      )}
    </Sheet>
  )
}
```

```css
.recent-friends {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3) var(--space-2);
}
.recent-friend {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  padding: var(--space-2) 0 var(--space-1);
  border-radius: var(--radius-field);
  transition: background-color var(--dur-fast);
}
.recent-friend:active {
  background: var(--surface-2);
}
.recent-friend__avatar {
  position: relative;
  border-radius: 50%;
  outline: 3px solid transparent;
  outline-offset: 2px;
  transition: outline-color var(--dur-fast) var(--ease-out-quart);
}
.recent-friend[aria-pressed='true'] .recent-friend__avatar {
  outline-color: var(--accent);
}
.recent-friend__check {
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
.recent-friend__name {
  max-width: 100%;
  overflow: hidden;
  font-size: var(--text-footnote);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-chip {
  overflow: hidden;
  cursor: pointer;
}
/* Invisible but tappable, so iOS opens its native date wheel. */
.date-chip__input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: 0;
  opacity: 0;
  -webkit-appearance: none;
  appearance: none;
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .recent-friend__check {
    animation: fade-in var(--dur) linear;
  }
}
```

- [ ] **Step 5: Register the meetup sheet in `src/sheets/SheetsProvider.tsx`**

Replace the file with:

```tsx
import { useMemo, useState, type ReactNode } from 'react'
import { FriendSheet } from './FriendSheet'
import { MeetupSheet } from './MeetupSheet'
import { SheetsContext, type FriendSheetRequest, type MeetupSheetRequest, type SheetsApi } from './sheetsContext'

export function SheetsProvider({ children }: { children: ReactNode }) {
  const [friendRequest, setFriendRequest] = useState<FriendSheetRequest | null>(null)
  const [friendKey, setFriendKey] = useState(0)
  const [meetupRequest, setMeetupRequest] = useState<MeetupSheetRequest | null>(null)
  const [meetupKey, setMeetupKey] = useState(0)

  const api = useMemo<SheetsApi>(
    () => ({
      openFriendSheet: (request = {}) => {
        setFriendKey((key) => key + 1)
        setFriendRequest(request)
      },
      openMeetupSheet: (request = {}) => {
        setMeetupKey((key) => key + 1)
        setMeetupRequest(request)
      },
    }),
    [],
  )

  return (
    <SheetsContext.Provider value={api}>
      {children}
      <FriendSheet key={`friend-${friendKey}`} request={friendRequest} onClose={() => setFriendRequest(null)} />
      <MeetupSheet key={`meetup-${meetupKey}`} request={meetupRequest} onClose={() => setMeetupRequest(null)} />
    </SheetsContext.Provider>
  )
}
```

- [ ] **Step 6: Create the floating Log button: `src/components/LogButton.tsx` and `src/components/LogButton.css`**

Rendered into `document.body`, so the page's slide-in animation never moves it.

```tsx
import { createPortal } from 'react-dom'
import { useSheets } from '../sheets/sheetsContext'
import { IconPlus } from './icons'
import './LogButton.css'

/** The "+ Log meetup" pill, always within thumb reach. */
export function LogButton({ presetFriendId }: { presetFriendId?: string }) {
  const { openMeetupSheet } = useSheets()
  return createPortal(
    <button type="button" className="log-button" onClick={() => openMeetupSheet({ presetFriendId })}>
      <IconPlus size={20} strokeWidth={2.6} />
      Log meetup
    </button>,
    document.body,
  )
}
```

```css
.log-button {
  position: fixed;
  left: 50%;
  bottom: calc(var(--tabbar-height) + var(--safe-bottom) + var(--space-4));
  z-index: 15;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 52px;
  padding: 0 var(--space-6) 0 var(--space-5);
  border-radius: var(--radius-pill);
  background: var(--accent);
  color: var(--on-accent);
  font-family: var(--font-rounded);
  font-size: 1.06rem;
  font-weight: 600;
  box-shadow: var(--shadow-float);
  transform: translateX(-50%);
  transition:
    transform var(--dur-fast) var(--ease-out-quart),
    background-color var(--dur-fast) var(--ease-out-quart);
}
.log-button:active {
  background: var(--accent-pressed);
  transform: translateX(-50%) scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .log-button:active {
    transform: translateX(-50%);
  }
}
```

- [ ] **Step 7: Show the Log button on the Friends screen**

In `src/screens/FriendsScreen.tsx`, add the import:

```tsx
import { LogButton } from '../components/LogButton'
```

and add this line just before the closing `</Page>`:

```tsx
      {friends.length > 0 && <LogButton />}
```

- [ ] **Step 8: Run the end-to-end tests to verify they pass**

Run: `npm run e2e`
Expected: PASS (15 tests).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: log meetups with recent friends, types, dates, notes and undo

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: Friend detail screen

**Files:**
- Create: `src/components/StatRow.tsx`, `src/components/StatRow.css`, `src/components/MonthBars.tsx`, `src/components/MonthBars.css`, `src/screens/FriendDetailScreen.css`, `e2e/detail.spec.ts`
- Modify: `src/screens/FriendDetailScreen.tsx` (replace)

- [ ] **Step 1: Write the failing end-to-end tests**

`e2e/detail.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { addFriend, logMeetup } from './helpers.ts'

test('shows a friend’s stats and history', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await addFriend(page, 'Sam')
  await logMeetup(page, ['Alex', 'Sam'], { type: 'Meal', note: 'Tacos' })
  await page.getByRole('link', { name: /Alex/ }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Alex' })).toBeVisible()
  await expect(page.getByText(/^Last seen .* · Today$/)).toBeVisible()
  const thisYear = page.locator('.stat-row__item').first()
  await expect(thisYear).toContainText('This year')
  await expect(thisYear).toContainText('1')
  const history = page.getByRole('region', { name: 'History' })
  await expect(history.getByRole('button', { name: /Meal.*with Sam.*Tacos/ })).toBeVisible()
})

test('logs from the friend page with them preselected', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('link', { name: /Alex/ }).click()
  await page.getByRole('button', { name: 'Log meetup' }).click()
  const sheet = page.getByRole('dialog', { name: 'Log meetup' })
  await expect(sheet.getByRole('button', { name: 'Remove Alex' })).toBeVisible()
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('region', { name: 'History' }).getByRole('button', { name: /Coffee/ })).toBeVisible()
})

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

test('edits and deletes a friend', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await page.getByRole('link', { name: /Alex/ }).click()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Edit friend' })
  await sheet.getByLabel('Name', { exact: true }).fill('Alexandra')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('heading', { level: 1, name: 'Alexandra' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.getByRole('dialog', { name: 'Edit friend' }).getByRole('button', { name: 'Delete friend' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete friend' }).click()
  await expect(page.getByText('Add the people you want to keep up with.')).toBeVisible()
})
```

Run: `npm run e2e`
Expected: FAIL (the detail screen is still a placeholder).

- [ ] **Step 2: Create `src/components/StatRow.tsx` and `src/components/StatRow.css`**

Three plain numbers in one strip (deliberately not a grid of cards). At large text sizes the items wrap onto new lines.

```tsx
import './StatRow.css'

export function StatRow({ items }: { items: { label: string; value: number }[] }) {
  return (
    <dl className="stat-row">
      {items.map((item) => (
        <div key={item.label} className="stat-row__item">
          <dt className="stat-row__label">{item.label}</dt>
          <dd className="stat-row__value numeric">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
```

```css
.stat-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3) 0;
  margin: 0;
  padding: var(--space-4) var(--space-2);
  border-radius: var(--radius-group);
  background: var(--surface);
}
.stat-row__item {
  flex: 1 1 6.5rem;
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  gap: 2px;
}
.stat-row__label {
  font-size: var(--text-footnote);
  color: var(--ink-2);
}
.stat-row__value {
  margin: 0;
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1.1;
}
```

- [ ] **Step 3: Create `src/components/MonthBars.tsx` and `src/components/MonthBars.css`**

Paired bars per month: last year in warm gray, this year in peach. The legend uses text labels, and the chart has a full text description for VoiceOver.

```tsx
import { MONTH_INITIALS, MONTH_NAMES } from '../lib/dates'
import './MonthBars.css'

interface MonthBarsProps {
  current: number[]
  previous: number[]
  year: number
}

export function MonthBars({ current, previous, year }: MonthBarsProps) {
  const max = Math.max(1, ...current, ...previous)
  const description = MONTH_NAMES.map(
    (month, i) => `${month}: ${current[i]} in ${year}, ${previous[i]} in ${year - 1}`,
  ).join('. ')
  return (
    <figure className="month-bars">
      <figcaption className="month-bars__legend">
        <span className="month-bars__key month-bars__key--previous">{year - 1}</span>
        <span className="month-bars__key month-bars__key--current">{year}</span>
      </figcaption>
      <div className="month-bars__chart" role="img" aria-label={`Meetups per month. ${description}.`}>
        {current.map((count, i) => (
          <div key={MONTH_NAMES[i]} className="month-bars__month">
            <div className="month-bars__pair">
              <span
                className="month-bars__bar month-bars__bar--previous"
                style={{ height: `${(previous[i] / max) * 100}%` }}
              />
              <span className="month-bars__bar month-bars__bar--current" style={{ height: `${(count / max) * 100}%` }} />
            </div>
            <span className="month-bars__label" aria-hidden="true">
              {MONTH_INITIALS[i]}
            </span>
          </div>
        ))}
      </div>
    </figure>
  )
}
```

```css
.month-bars {
  margin: 0;
  padding: var(--space-4);
  border-radius: var(--radius-group);
  background: var(--surface);
}
.month-bars__legend {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-4);
  margin-bottom: var(--space-3);
  font-size: var(--text-footnote);
  color: var(--ink-2);
}
.month-bars__key {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.month-bars__key::before {
  content: '';
  width: 10px;
  height: 10px;
  border-radius: 3px;
}
.month-bars__key--previous::before {
  background: var(--bar-previous);
}
.month-bars__key--current::before {
  background: var(--bar-current);
}
.month-bars__chart {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 4px;
  height: 128px;
}
.month-bars__month {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.month-bars__pair {
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
  width: 100%;
}
.month-bars__bar {
  width: min(8px, 40%);
  min-height: 2px;
  border-radius: 3px 3px 1px 1px;
}
.month-bars__bar--previous {
  background: var(--bar-previous);
}
.month-bars__bar--current {
  background: var(--bar-current);
}
.month-bars__label {
  font-size: var(--text-caption);
  color: var(--ink-3);
}
```

- [ ] **Step 4: Build the Friend detail screen**

Replace `src/screens/FriendDetailScreen.tsx` with:

```tsx
import { useMemo } from 'react'
import { Navigate, useParams } from 'react-router'
import { Avatar } from '../components/Avatar'
import { InsetGroup, Row, Section } from '../components/InsetGroup'
import { LogButton } from '../components/LogButton'
import { MonthBars } from '../components/MonthBars'
import { Page } from '../components/Page'
import { StatRow } from '../components/StatRow'
import { useFriend, useFriends, useGroups, useMeetups, useMeetupTypes } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import { daysBetween, formatDate, formatMonthYear, yearOf } from '../lib/dates'
import { formatNameList, formatSince } from '../lib/text'
import { useSheets } from '../sheets/sheetsContext'
import { allTimeCountsByFriend, countsByFriendForYear, monthlyCounts } from '../stats/counts'
import { groupByMonth } from '../stats/history'
import { lastSeenByFriend } from '../stats/lastSeen'
import './FriendDetailScreen.css'

export function FriendDetailScreen() {
  const { id } = useParams()
  const friend = useFriend(id)
  const friends = useFriends()
  const groups = useGroups()
  const meetups = useMeetups()
  const types = useMeetupTypes()
  const today = useToday()
  const { openFriendSheet, openMeetupSheet } = useSheets()

  const data = useMemo(() => {
    if (!friend || !meetups) return null
    const year = yearOf(today)
    const theirs = meetups.filter((meetup) => meetup.friendIds.includes(friend.id))
    return {
      year,
      lastSeen: lastSeenByFriend(theirs, today).get(friend.id) ?? null,
      thisYear: countsByFriendForYear(theirs, year, today).get(friend.id) ?? 0,
      lastYear: countsByFriendForYear(theirs, year - 1, today).get(friend.id) ?? 0,
      allTime: allTimeCountsByFriend(theirs, today).get(friend.id) ?? 0,
      current: monthlyCounts(friend.id, theirs, year, today),
      previous: monthlyCounts(friend.id, theirs, year - 1, today),
      history: groupByMonth(theirs),
    }
  }, [friend, meetups, today])

  if (friend === null) return <Navigate to="/" replace />
  if (!friend || !friends || !groups || !types || !data) return null

  const groupName = groups.find((group) => group.id === friend.groupId)?.name
  const typeById = new Map(types.map((type) => [type.id, type] as const))
  const nameById = new Map(friends.map((f) => [f.id, f.name] as const))

  return (
    <Page
      title={friend.name}
      back={{ label: 'Friends', fallback: '/' }}
      pushed
      actions={
        <button type="button" className="text-button" onClick={() => openFriendSheet({ friend })}>
          Edit
        </button>
      }
      hero={
        <div className="friend-hero">
          <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={96} />
          <h1 className="friend-hero__name">{friend.name}</h1>
          {groupName && <p className="friend-hero__group">{groupName}</p>}
          <p className="friend-hero__seen">
            {data.lastSeen
              ? `Last seen ${formatDate(data.lastSeen, today)} · ${formatSince(daysBetween(data.lastSeen, today))}`
              : 'Not seen yet'}
          </p>
        </div>
      }
    >
      {friend.notes && <p className="friend-notes">{friend.notes}</p>}

      <StatRow
        items={[
          { label: 'This year', value: data.thisYear },
          { label: 'Last year', value: data.lastYear },
          { label: 'All time', value: data.allTime },
        ]}
      />

      <Section title="Month by month">
        <MonthBars current={data.current} previous={data.previous} year={data.year} />
      </Section>

      <Section title="History">
        {data.history.length === 0 ? (
          <p className="list-message">Your first meetup will show up here.</p>
        ) : (
          data.history.map(({ month, meetups: monthMeetups }) => (
            <InsetGroup key={month} title={formatMonthYear(`${month}-01`)} level={3}>
              {monthMeetups.map((meetup) => {
                const type = typeById.get(meetup.typeId)
                const others = meetup.friendIds
                  .filter((friendId) => friendId !== friend.id)
                  .map((friendId) => nameById.get(friendId))
                  .filter((name): name is string => name !== undefined)
                return (
                  <Row
                    key={meetup.id}
                    onClick={() => openMeetupSheet({ meetup })}
                    leading={
                      <span className="emoji-badge" aria-hidden="true">
                        {type?.emoji ?? '✨'}
                      </span>
                    }
                    title={
                      <>
                        {type?.name ?? 'Meetup'}
                        {meetup.date > today && <span className="upcoming-badge">Upcoming</span>}
                      </>
                    }
                    subtitle={[
                      formatDate(meetup.date, today),
                      others.length > 0 ? `with ${formatNameList(others)}` : null,
                      meetup.note || null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                    chevron
                  />
                )
              })}
            </InsetGroup>
          ))
        )}
      </Section>

      <LogButton presetFriendId={friend.id} />
    </Page>
  )
}
```

`src/screens/FriendDetailScreen.css`:

```css
.friend-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  text-align: center;
}
.friend-hero__name {
  margin: var(--space-3) 0 0;
  font-family: var(--font-rounded);
  font-size: var(--text-title);
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.friend-hero__group {
  margin: 0;
  color: var(--ink-2);
}
.friend-hero__seen {
  margin: var(--space-3) 0 0;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--surface);
  font-size: var(--text-subhead);
  color: var(--ink-2);
}

.friend-notes {
  max-width: 65ch;
  margin: 0 var(--space-1);
  color: var(--ink-2);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.upcoming-badge {
  display: inline-block;
  margin-left: var(--space-2);
  padding: 1px 8px;
  border-radius: var(--radius-pill);
  background: var(--accent-soft);
  color: var(--accent-ink);
  font-size: var(--text-caption);
  font-weight: 600;
  vertical-align: 2px;
}
```

- [ ] **Step 5: Run the end-to-end tests to verify they pass**

Run: `npm run e2e`
Expected: PASS (19 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add friend detail screen with stats, monthly bars and history

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: Stats screen

**Files:**
- Create: `src/components/HBarList.tsx`, `src/components/HBarList.css`, `src/screens/StatsScreen.css`, `e2e/stats.spec.ts`
- Modify: `src/screens/StatsScreen.tsx` (replace)

- [ ] **Step 1: Write the failing end-to-end tests**

`e2e/stats.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { addFriend, goToTab, logMeetup } from './helpers.ts'

test('shows a friendly empty state', async ({ page }) => {
  await page.goto('/#/stats')
  await expect(page.getByText('Log a few meetups and your year will show up here.')).toBeVisible()
})

test('summarizes the year', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex', 'College')
  await addFriend(page, 'Sam', 'College')
  await addFriend(page, 'Kim')
  await logMeetup(page, ['Alex', 'Sam'], { type: 'Meal' })
  await logMeetup(page, ['Alex'], { type: 'Coffee' })
  await goToTab(page, 'Stats')

  await expect(page.getByText('2 meetups with 2 friends.', { exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Top friends' }).getByRole('link').first()).toContainText('Alex')
  await expect(page.getByRole('region', { name: 'By type' })).toContainText('Meal')
  await expect(page.getByRole('region', { name: 'By group' })).toContainText('College')
  await expect(page.getByRole('region', { name: /Not seen yet in/ })).toContainText('Kim')
})

test('switches to last year', async ({ page }) => {
  const lastYear = new Date().getFullYear() - 1
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'], { date: `${lastYear}-06-01` })
  await goToTab(page, 'Stats')
  await expect(page.getByText('0 meetups with 0 friends.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: `Show ${lastYear}` }).click()
  await expect(page.getByText('1 meetup with 1 friend.', { exact: true })).toBeVisible()
})
```

Run: `npm run e2e`
Expected: FAIL (the stats screen is still a placeholder).

- [ ] **Step 2: Create `src/components/HBarList.tsx` and `src/components/HBarList.css`**

```tsx
import './HBarList.css'

export interface HBarItem {
  key: string
  label: string
  count: number
  previousCount: number
}

/** Horizontal bars: the selected year (peach) over the previous year (gray), with numbers. */
export function HBarList({ items, previousYear }: { items: HBarItem[]; previousYear: number }) {
  const max = Math.max(1, ...items.flatMap((item) => [item.count, item.previousCount]))
  return (
    <ul className="hbars">
      {items.map((item) => (
        <li key={item.key} className="hbars__item">
          <div className="hbars__head">
            <span className="hbars__label">{item.label}</span>
            <span className="hbars__values">
              <span className="numeric hbars__count">{item.count}</span>
              <span>
                {' '}
                · {previousYear}: {item.previousCount}
              </span>
            </span>
          </div>
          <div className="hbars__track" aria-hidden="true">
            <span className="hbars__bar hbars__bar--current" style={{ width: `${(item.count / max) * 100}%` }} />
            <span
              className="hbars__bar hbars__bar--previous"
              style={{ width: `${(item.previousCount / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
```

```css
.hbars {
  margin: 0;
  padding: var(--space-1) var(--space-4);
  border-radius: var(--radius-group);
  background: var(--surface);
  list-style: none;
}
.hbars__item {
  padding: var(--space-3) 0;
}
.hbars__item + .hbars__item {
  border-top: 0.5px solid var(--separator);
}
.hbars__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}
.hbars__label {
  min-width: 0;
  overflow-wrap: anywhere;
}
.hbars__values {
  flex: none;
  font-size: var(--text-subhead);
  color: var(--ink-2);
}
.hbars__count {
  font-size: var(--text-body);
  font-weight: 600;
  color: var(--ink);
}
.hbars__track {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.hbars__bar {
  display: block;
  min-width: 3px;
  height: 6px;
  border-radius: 3px;
}
.hbars__bar--current {
  background: var(--bar-current);
}
.hbars__bar--previous {
  background: var(--bar-previous);
}
```

- [ ] **Step 3: Build the Stats screen**

Replace `src/screens/StatsScreen.tsx` with:

```tsx
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Avatar } from '../components/Avatar'
import { EmptyState } from '../components/EmptyState'
import { HBarList } from '../components/HBarList'
import { IconChevronLeft, IconChevronRight } from '../components/icons'
import { InsetGroup, Row, Section } from '../components/InsetGroup'
import { Page } from '../components/Page'
import { useFriends, useGroups, useMeetups, useMeetupTypes } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import { yearOf } from '../lib/dates'
import { plural } from '../lib/text'
import { friendsNotSeenInYear, groupBreakdown, topFriends, typeBreakdown } from '../stats/breakdowns'
import { totalsForYear } from '../stats/counts'
import './StatsScreen.css'

export function StatsScreen() {
  const friends = useFriends()
  const groups = useGroups()
  const meetups = useMeetups()
  const types = useMeetupTypes()
  const today = useToday()
  const currentYear = yearOf(today)
  const [year, setYear] = useState(currentYear)

  const firstYear = useMemo(
    () => Math.min(currentYear, ...(meetups ?? []).map((meetup) => yearOf(meetup.date))),
    [meetups, currentYear],
  )

  const stats = useMemo(() => {
    if (!friends || !groups || !meetups || !types) return null
    return {
      totals: totalsForYear(meetups, year, today),
      previous: totalsForYear(meetups, year - 1, today),
      top: topFriends(meetups, friends, year, today),
      byType: typeBreakdown(meetups, types, year, today),
      byGroup: groupBreakdown(meetups, friends, groups, year, today),
      notSeen: friendsNotSeenInYear(meetups, friends, year, today),
    }
  }, [friends, groups, meetups, types, year, today])

  if (!stats || !groups) return null
  const empty = stats.totals.meetups === 0 && stats.previous.meetups === 0

  return (
    <Page title="Stats">
      <div className="year-switcher">
        <button
          type="button"
          className="icon-button"
          onClick={() => setYear(year - 1)}
          disabled={year <= firstYear}
          aria-label={`Show ${year - 1}`}
        >
          <IconChevronLeft />
        </button>
        <span className="year-switcher__year numeric" aria-live="polite">
          {year}
        </span>
        <button
          type="button"
          className="icon-button"
          onClick={() => setYear(year + 1)}
          disabled={year >= currentYear}
          aria-label={`Show ${year + 1}`}
        >
          <IconChevronRight />
        </button>
      </div>

      {empty ? (
        <EmptyState title="Log a few meetups and your year will show up here." />
      ) : (
        <>
          <div className="stats-lead">
            <p className="stats-lead__main">
              {plural(stats.totals.meetups, 'meetup')} with {plural(stats.totals.friends, 'friend')}.
            </p>
            <p className="stats-lead__previous">
              {year - 1}: {plural(stats.previous.meetups, 'meetup')} with {plural(stats.previous.friends, 'friend')}.
            </p>
          </div>

          {stats.top.length > 0 && (
            <InsetGroup title="Top friends">
              {stats.top.map(({ friend, count, previousCount }) => (
                <Row
                  key={friend.id}
                  to={`/friends/${friend.id}`}
                  leading={<Avatar name={friend.name} photo={friend.photo} seed={friend.id} />}
                  title={friend.name}
                  trailing={
                    <span className="top-count">
                      <span className="numeric top-count__value">{count}</span>
                      <span className="top-count__previous">
                        {year - 1}: {previousCount}
                      </span>
                    </span>
                  }
                />
              ))}
            </InsetGroup>
          )}

          {stats.byType.length > 0 && (
            <Section title="By type">
              <HBarList
                previousYear={year - 1}
                items={stats.byType.map((row) => ({ ...row, label: `${row.emoji ?? ''} ${row.label}`.trim() }))}
              />
            </Section>
          )}

          {groups.length > 0 && stats.byGroup.length > 0 && (
            <Section title="By group">
              <HBarList previousYear={year - 1} items={stats.byGroup} />
            </Section>
          )}

          {stats.notSeen.length > 0 && (
            <Section title={year === currentYear ? `Not seen yet in ${year}` : `Not seen in ${year}`}>
              <div className="chip-wrap">
                {stats.notSeen.map((friend) => (
                  <Link key={friend.id} to={`/friends/${friend.id}`} className="person-chip">
                    <Avatar name={friend.name} photo={friend.photo} seed={friend.id} size={28} />
                    {friend.name}
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </>
      )}
    </Page>
  )
}
```

`src/screens/StatsScreen.css`:

```css
.year-switcher {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  margin-top: calc(-1 * var(--space-4));
}
.year-switcher__year {
  min-width: 4ch;
  font-size: var(--text-title);
  font-weight: 700;
  text-align: center;
}

.stats-lead {
  padding: 0 var(--space-1);
}
.stats-lead__main {
  margin: 0;
  font-family: var(--font-rounded);
  font-size: var(--text-title);
  font-weight: 600;
  line-height: 1.25;
  text-wrap: balance;
}
.stats-lead__previous {
  margin: var(--space-1) 0 0;
  color: var(--ink-2);
}

.top-count {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  line-height: 1.15;
}
.top-count__value {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--ink);
}
.top-count__previous {
  font-size: var(--text-footnote);
  color: var(--ink-2);
}

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

- [ ] **Step 4: Run the end-to-end tests to verify they pass**

Run: `npm run e2e`
Expected: PASS (22 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add stats screen with yearly comparison and breakdowns

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: Settings, groups, meetup types, and backup

**Files:**
- Create: `src/screens/SettingsScreen.css`, `src/screens/MeetupTypesScreen.css`, `e2e/settings.spec.ts`
- Modify: `src/screens/SettingsScreen.tsx` (replace), `src/screens/GroupsScreen.tsx` (replace), `src/screens/MeetupTypesScreen.tsx` (replace)

- [ ] **Step 1: Write the failing end-to-end tests**

`e2e/settings.spec.ts`:

```ts
import { expect, test } from '@playwright/test'
import { addFriend, goToTab, logMeetup } from './helpers.ts'

test('manages groups', async ({ page }) => {
  await page.goto('/#/settings/groups')
  await page.getByRole('button', { name: 'Add group' }).first().click()
  const newSheet = page.getByRole('dialog', { name: 'New group' })
  await newSheet.getByLabel('Name').fill('College')
  await newSheet.getByRole('button', { name: 'Save' }).click()
  await expect(newSheet).toBeHidden()

  await page.getByRole('button', { name: /College/ }).click()
  const editSheet = page.getByRole('dialog', { name: 'Edit group' })
  await editSheet.getByLabel('Name').fill('University')
  await editSheet.getByRole('button', { name: 'Save' }).click()
  await expect(editSheet).toBeHidden()

  await page.getByRole('button', { name: /University/ }).click()
  await page.getByRole('dialog', { name: 'Edit group' }).getByRole('button', { name: 'Delete group' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete group' }).click()
  await expect(page.getByText('No groups yet.')).toBeVisible()
})

test('adds and reorders meetup types', async ({ page }) => {
  await page.goto('/#/settings/types')
  await page.getByRole('button', { name: 'Add type' }).click()
  const sheet = page.getByRole('dialog', { name: 'New meetup type' })
  await sheet.getByLabel('Emoji').fill('🥾')
  await sheet.getByLabel('Name').fill('Hike')
  await sheet.getByRole('button', { name: 'Save' }).click()
  await expect(sheet).toBeHidden()

  const titles = page.locator('.type-row .row__title')
  await expect(titles.last()).toHaveText('Hike')
  await page.getByRole('button', { name: 'Move Hike up' }).click()
  await expect(titles.nth(7)).toHaveText('Hike')
  await expect(titles.last()).toHaveText('Other')
})

test('explains why a used type cannot be deleted', async ({ page }) => {
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await page.goto('/#/settings/types')
  await page.getByRole('button', { name: /^Coffee/ }).click()
  await expect(page.getByRole('dialog', { name: 'Edit meetup type' })).toContainText(
    "Used by 1 meetup, so it can't be deleted.",
  )
})

test('exports and imports a backup', async ({ page }) => {
  // Force the download path; the share sheet can't be driven in tests.
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
  })
  await page.goto('/')
  await addFriend(page, 'Alex')
  await logMeetup(page, ['Alex'])
  await goToTab(page, 'Settings')
  await expect(page.getByText('Never backed up')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export backup' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^friend-tracker-backup-\d{4}-\d{2}-\d{2}\.json$/)
  const backupPath = await download.path()
  await expect(page.getByText('Last backup: today')).toBeVisible()

  await goToTab(page, 'Friends')
  await addFriend(page, 'Kim')
  await goToTab(page, 'Settings')
  await page.locator('input[type="file"]').setInputFiles(backupPath)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Replace all data' }).click()
  await expect(page.getByRole('status')).toContainText('Backup restored')

  await goToTab(page, 'Friends')
  await expect(page.getByRole('link', { name: /Alex/ })).toBeVisible()
  await expect(page.getByRole('link', { name: /Kim/ })).toHaveCount(0)
})

test('rejects a file that is not a backup', async ({ page }) => {
  await page.goto('/#/settings')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'notes.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"hello":1}'),
  })
  await expect(page.getByRole('alert')).toContainText("This isn't a Friend Tracker backup file.")
})
```

Run: `npm run e2e`
Expected: FAIL (settings screens are placeholders).

- [ ] **Step 2: Build the Settings screen**

Replace `src/screens/SettingsScreen.tsx` with:

```tsx
import { useRef, useState, type ChangeEvent } from 'react'
import { exportBackup } from '../backup/exportBackup'
import { parseBackupFile, replaceAllData } from '../backup/storage'
import { useConfirm } from '../components/ActionSheet'
import { InsetGroup, Row } from '../components/InsetGroup'
import { Page } from '../components/Page'
import { useToast } from '../components/Toast'
import { useFriends, useGroups, useMeetups, useMeetupTypes, useSetting } from '../data/hooks'
import { useToday } from '../hooks/useToday'
import { describeLastBackup, plural } from '../lib/text'
import './SettingsScreen.css'

export function SettingsScreen() {
  const friends = useFriends()
  const groups = useGroups()
  const meetupTypes = useMeetupTypes()
  const meetups = useMeetups()
  const lastBackupAt = useSetting('lastBackupAt')
  const today = useToday()
  const toast = useToast()
  const confirm = useConfirm()
  const fileInput = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)

  if (!friends || !groups || !meetupTypes || !meetups || lastBackupAt === undefined) return null

  // Uses data that's already loaded, so the iOS share sheet opens straight from the tap.
  const exportData = async () => {
    try {
      const outcome = await exportBackup({ friends, groups, meetupTypes, meetups })
      if (outcome !== 'cancelled') toast({ message: 'Backup saved' })
    } catch {
      toast({ message: "Couldn't create the backup.", tone: 'plain' })
    }
  }

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const result = await parseBackupFile(file)
    if (!result.ok) {
      setImportError(result.error)
      return
    }
    setImportError(null)
    const { data } = result
    const confirmed = await confirm({
      title: 'Replace all data with this backup?',
      message: `It has ${plural(data.friends.length, 'friend')} and ${plural(data.meetups.length, 'meetup')}. Everything in the app now will be replaced.`,
      confirmLabel: 'Replace all data',
      destructive: true,
    })
    if (!confirmed) return
    try {
      await replaceAllData(data)
      toast({ message: 'Backup restored' })
    } catch {
      toast({ message: "Couldn't restore the backup. Nothing was changed.", tone: 'plain' })
    }
  }

  return (
    <Page title="Settings">
      <InsetGroup title="Organize">
        <Row to="/settings/groups" title="Groups" trailing={groups.length} chevron />
        <Row to="/settings/types" title="Meetup types" trailing={meetupTypes.length} chevron />
      </InsetGroup>

      <InsetGroup title="Backup" footer={describeLastBackup(lastBackupAt, today)}>
        <Row title="Export backup" accent onClick={exportData} />
        <Row title="Import backup" accent onClick={() => fileInput.current?.click()} />
      </InsetGroup>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={importData}
      />
      {importError && (
        <p className="field-error settings-error" role="alert">
          {importError}
        </p>
      )}

      <InsetGroup title="About your data">
        <p className="about-text">
          Everything you add stays on this iPhone. Nothing is sent anywhere. Open the app from its Home Screen icon:
          anything added in a Safari tab is kept separately. Export a backup now and then so you can restore it on a
          new phone.
        </p>
      </InsetGroup>
    </Page>
  )
}
```

`src/screens/SettingsScreen.css`:

```css
.about-text {
  max-width: 65ch;
  margin: 0;
  padding: var(--space-4);
  font-size: var(--text-subhead);
  line-height: 1.45;
  color: var(--ink-2);
}
.settings-error {
  margin-top: calc(-1 * var(--space-4));
}
```

- [ ] **Step 3: Build the Groups screen**

Replace `src/screens/GroupsScreen.tsx` with:

```tsx
import { useId, useState } from 'react'
import { useConfirm, useConfirmDiscard } from '../components/ActionSheet'
import { EmptyState } from '../components/EmptyState'
import { IconPlus } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import { Page } from '../components/Page'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useFriends, useGroups } from '../data/hooks'
import { ValidationError } from '../db/errors'
import { addGroup, deleteGroup, renameGroup } from '../db/groups'
import { plural } from '../lib/text'
import type { Group } from '../types'

interface GroupRequest {
  group?: Group
}

export function GroupsScreen() {
  const groups = useGroups()
  const friends = useFriends()
  const [request, setRequest] = useState<GroupRequest | null>(null)
  const [sheetKey, setSheetKey] = useState(0)

  if (!groups || !friends) return null

  const counts = new Map<string, number>()
  for (const friend of friends) {
    if (friend.groupId) counts.set(friend.groupId, (counts.get(friend.groupId) ?? 0) + 1)
  }

  const open = (group?: Group) => {
    setSheetKey((key) => key + 1)
    setRequest({ group })
  }

  return (
    <Page
      title="Groups"
      back={{ label: 'Settings', fallback: '/settings' }}
      pushed
      actions={
        <button type="button" className="icon-button" onClick={() => open()} aria-label="Add group">
          <IconPlus />
        </button>
      }
    >
      {groups.length === 0 ? (
        <EmptyState
          title="No groups yet."
          message="Groups like College or Work let you filter friends and compare stats."
          action={
            <button type="button" className="button button--primary" onClick={() => open()}>
              Add group
            </button>
          }
        />
      ) : (
        <InsetGroup footer="Tap a group to rename or delete it.">
          {groups.map((group) => (
            <Row
              key={group.id}
              title={group.name}
              trailing={plural(counts.get(group.id) ?? 0, 'friend')}
              onClick={() => open(group)}
              chevron
            />
          ))}
        </InsetGroup>
      )}
      <GroupSheet key={sheetKey} request={request} onClose={() => setRequest(null)} />
    </Page>
  )
}

function GroupSheet({ request, onClose }: { request: GroupRequest | null; onClose: () => void }) {
  const [initial] = useState(request)
  const group = initial?.group
  const confirm = useConfirm()
  const confirmDiscard = useConfirmDiscard()
  const toast = useToast()
  const nameId = useId()
  const [name, setName] = useState(group?.name ?? '')
  const [error, setError] = useState<string | null>(null)

  async function requestClose() {
    if (await confirmDiscard(name !== (group?.name ?? ''))) onClose()
  }

  async function save() {
    try {
      if (group) await renameGroup(group.id, name)
      else await addGroup(name)
      onClose()
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : "Couldn't save. Please try again.")
    }
  }

  async function remove() {
    if (!group) return
    const confirmed = await confirm({
      title: `Delete ${group.name}?`,
      message: 'Friends in this group will just be ungrouped.',
      confirmLabel: 'Delete group',
      destructive: true,
    })
    if (!confirmed) return
    await deleteGroup(group.id)
    onClose()
    toast({ message: `Deleted ${group.name}`, tone: 'plain' })
  }

  return (
    <Sheet
      open={request !== null}
      title={group ? 'Edit group' : 'New group'}
      onRequestClose={requestClose}
      footer={
        <button type="button" className="button button--primary button--block" onClick={save}>
          Save
        </button>
      }
    >
      <div className="form-section">
        <label className="field-label" htmlFor={nameId}>
          Name
        </label>
        <input
          id={nameId}
          className="field"
          value={name}
          autoCapitalize="words"
          autoComplete="off"
          enterKeyHint="done"
          onChange={(event) => {
            setName(event.target.value)
            setError(null)
          }}
        />
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {group && (
        <InsetGroup>
          <Row title="Delete group" destructive onClick={remove} />
        </InsetGroup>
      )}
    </Sheet>
  )
}
```

- [ ] **Step 4: Build the Meetup types screen**

Replace `src/screens/MeetupTypesScreen.tsx` with:

```tsx
import { useId, useState } from 'react'
import { useConfirm, useConfirmDiscard } from '../components/ActionSheet'
import { IconArrowDown, IconArrowUp, IconPlus } from '../components/icons'
import { InsetGroup, Row } from '../components/InsetGroup'
import { Page } from '../components/Page'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { useMeetups, useMeetupTypes } from '../data/hooks'
import { ValidationError } from '../db/errors'
import { addMeetupType, deleteMeetupType, moveMeetupType, updateMeetupType } from '../db/meetupTypes'
import { plural } from '../lib/text'
import type { MeetupType } from '../types'
import './MeetupTypesScreen.css'

interface TypeRequest {
  type?: MeetupType
}

export function MeetupTypesScreen() {
  const types = useMeetupTypes()
  const meetups = useMeetups()
  const [request, setRequest] = useState<TypeRequest | null>(null)
  const [sheetKey, setSheetKey] = useState(0)

  if (!types || !meetups) return null

  const usage = new Map<string, number>()
  for (const meetup of meetups) usage.set(meetup.typeId, (usage.get(meetup.typeId) ?? 0) + 1)

  const open = (type?: MeetupType) => {
    setSheetKey((key) => key + 1)
    setRequest({ type })
  }
  const editingType = request?.type

  return (
    <Page
      title="Meetup types"
      back={{ label: 'Settings', fallback: '/settings' }}
      pushed
      actions={
        <button type="button" className="icon-button" onClick={() => open()} aria-label="Add type">
          <IconPlus />
        </button>
      }
    >
      <InsetGroup footer="Use the arrows to change the order types appear in when you log a meetup.">
        {types.map((type, index) => (
          <div key={type.id} className="type-row">
            <Row
              onClick={() => open(type)}
              leading={
                <span className="emoji-badge" aria-hidden="true">
                  {type.emoji}
                </span>
              }
              title={type.name}
              subtitle={plural(usage.get(type.id) ?? 0, 'meetup')}
            />
            <div className="type-row__order">
              <button
                type="button"
                className="icon-button"
                aria-label={`Move ${type.name} up`}
                disabled={index === 0}
                onClick={() => void moveMeetupType(type.id, -1)}
              >
                <IconArrowUp size={20} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Move ${type.name} down`}
                disabled={index === types.length - 1}
                onClick={() => void moveMeetupType(type.id, 1)}
              >
                <IconArrowDown size={20} />
              </button>
            </div>
          </div>
        ))}
      </InsetGroup>
      <TypeSheet
        key={sheetKey}
        request={request}
        usage={editingType ? (usage.get(editingType.id) ?? 0) : 0}
        isLast={types.length <= 1}
        onClose={() => setRequest(null)}
      />
    </Page>
  )
}

interface TypeSheetProps {
  request: TypeRequest | null
  usage: number
  isLast: boolean
  onClose: () => void
}

function TypeSheet({ request, usage, isLast, onClose }: TypeSheetProps) {
  const [initial] = useState(request)
  const type = initial?.type
  const confirm = useConfirm()
  const confirmDiscard = useConfirmDiscard()
  const toast = useToast()
  const nameId = useId()
  const emojiId = useId()
  const [name, setName] = useState(type?.name ?? '')
  const [emoji, setEmoji] = useState(type?.emoji ?? '')
  const [error, setError] = useState<string | null>(null)

  const dirty = name !== (type?.name ?? '') || emoji !== (type?.emoji ?? '')
  const deleteBlocker =
    usage > 0
      ? `Used by ${plural(usage, 'meetup')}, so it can't be deleted. You can rename it instead.`
      : isLast
        ? 'You need at least one meetup type.'
        : null

  async function requestClose() {
    if (await confirmDiscard(dirty)) onClose()
  }

  async function save() {
    try {
      const input = { name, emoji }
      if (type) await updateMeetupType(type.id, input)
      else await addMeetupType(input)
      onClose()
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : "Couldn't save. Please try again.")
    }
  }

  async function remove() {
    if (!type) return
    const confirmed = await confirm({ title: `Delete ${type.name}?`, confirmLabel: 'Delete type', destructive: true })
    if (!confirmed) return
    try {
      await deleteMeetupType(type.id)
      onClose()
      toast({ message: `Deleted ${type.name}`, tone: 'plain' })
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : "Couldn't delete. Please try again.")
    }
  }

  return (
    <Sheet
      open={request !== null}
      title={type ? 'Edit meetup type' : 'New meetup type'}
      onRequestClose={requestClose}
      footer={
        <button type="button" className="button button--primary button--block" onClick={save}>
          Save
        </button>
      }
    >
      <div className="type-form">
        <div className="form-section">
          <label className="field-label" htmlFor={emojiId}>
            Emoji
          </label>
          <input
            id={emojiId}
            className="field type-form__emoji"
            value={emoji}
            placeholder="🙂"
            autoComplete="off"
            onChange={(event) => {
              setEmoji(event.target.value)
              setError(null)
            }}
          />
        </div>
        <div className="form-section">
          <label className="field-label" htmlFor={nameId}>
            Name
          </label>
          <input
            id={nameId}
            className="field"
            value={name}
            autoCapitalize="words"
            autoComplete="off"
            enterKeyHint="done"
            onChange={(event) => {
              setName(event.target.value)
              setError(null)
            }}
          />
        </div>
      </div>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {type &&
        (deleteBlocker ? (
          <p className="sheet-note">{deleteBlocker}</p>
        ) : (
          <InsetGroup>
            <Row title="Delete type" destructive onClick={remove} />
          </InsetGroup>
        ))}
    </Sheet>
  )
}
```

`src/screens/MeetupTypesScreen.css`:

```css
.type-row {
  position: relative;
  display: flex;
  align-items: center;
}
.type-row > .row {
  flex: 1;
  min-width: 0;
}
.type-row__order {
  flex: none;
  display: flex;
  padding-right: var(--space-2);
}
.type-row + .type-row::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  left: calc(var(--space-4) + 44px + var(--space-3));
  border-top: 0.5px solid var(--separator);
}

.type-form {
  display: grid;
  grid-template-columns: 5.5rem 1fr;
  gap: var(--space-3);
}
.type-form__emoji {
  font-size: 1.5rem;
  text-align: center;
}

.sheet-note {
  margin: 0 var(--space-1);
  font-size: var(--text-subhead);
  line-height: 1.45;
  color: var(--ink-2);
}
```

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS.

Run: `npm run e2e`
Expected: PASS (27 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add settings, group and meetup type management, backup import/export

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 20: Make it installable (icons, manifest, offline)

**Files:**
- Create: `public/logo.svg`, `pwa-assets.config.ts`, `e2e/pwa.spec.ts`, generated `public/*.png` and `public/favicon.ico`
- Modify: `vite.config.ts`, `index.html`, `src/main.tsx`

- [ ] **Step 1: Write the failing end-to-end test**

`e2e/pwa.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('ships a web app manifest and an iPhone icon', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const manifest = await (await request.get(href!)).json()
  expect(manifest).toMatchObject({ name: 'Friend Tracker', short_name: 'Friends', display: 'standalone' })
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', /apple-touch-icon-180x180\.png$/)
  expect((await request.get('apple-touch-icon-180x180.png')).ok()).toBe(true)
})
```

Run: `npm run e2e`
Expected: FAIL (`link[rel="manifest"]` not found).

- [ ] **Step 2: Create the icon source `public/logo.svg`**

A peach square with two soft overlapping circles (iOS rounds the corners itself). The circles sit inside the maskable safe zone.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#F4B496"/>
  <circle cx="212" cy="262" r="100" fill="#FFF7F1"/>
  <circle cx="300" cy="250" r="100" fill="#E8805F" fill-opacity="0.85"/>
</svg>
```

- [ ] **Step 3: Create `pwa-assets.config.ts` and generate the icons**

```ts
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, padding: 0, resizeOptions: { background: '#F4B496' } },
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background: '#F4B496' } },
  },
  images: ['public/logo.svg'],
})
```

Run: `npm run icons`
Expected: ends with `✔ PWA assets generated`, and `public/` now contains `apple-touch-icon-180x180.png`, `favicon.ico`, `maskable-icon-512x512.png`, `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`.

Open `public/apple-touch-icon-180x180.png` to check it: a full peach square with a cream circle and a coral circle overlapping in the middle.

- [ ] **Step 4: Add the PWA plugin to `vite.config.ts`**

Replace `vite.config.ts` with:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // New versions install quietly and are used the next time the app opens.
      registerType: 'autoUpdate',
      injectRegister: 'script',
      includeAssets: ['favicon.ico', 'logo.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Friend Tracker',
        short_name: 'Friends',
        description: 'Remember when you last saw your friends.',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F8F2ED',
        theme_color: '#F8F2ED',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
```

- [ ] **Step 5: Add icon links and iOS meta tags to `index.html`**

Replace `index.html` with (Vite rewrites the `/…` paths to match `base: './'`):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Friend Tracker</title>
    <meta name="description" content="Remember when you last saw your friends." />
    <meta name="color-scheme" content="light dark" />
    <meta name="theme-color" content="#F8F2ED" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#16120F" media="(prefers-color-scheme: dark)" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="Friends" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <link rel="icon" href="/favicon.ico" sizes="48x48" />
    <link rel="icon" href="/logo.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon-180x180.png" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Ask for persistent storage in `src/main.tsx`**

In `src/main.tsx`, add after the `scrollRestoration` line:

```tsx
// Ask the browser not to clear our data when the phone is low on space.
void navigator.storage?.persist?.()
```

- [ ] **Step 7: Verify the build and tests**

Run: `npm run build`
Expected: output includes `PWA v1.3.0`, `mode generateSW`, and `files generated dist/sw.js`.

Run: `npm run e2e`
Expected: PASS (28 tests).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: make the app installable with icons, manifest and offline support

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 21: Visual QA with screenshots and the impeccable design skill

**Files:**
- Create: `e2e/screenshots.spec.ts`
- Modify: `playwright.config.ts`, `package.json`, `DESIGN.md`, plus whatever files the review below shows need fixing

- [ ] **Step 1: Add a screenshots project to `playwright.config.ts`**

Replace the `projects` line with:

```ts
  projects: [
    { name: 'iphone', use: { ...devices['iPhone 13'] }, testIgnore: /screenshots\.spec\.ts/ },
    { name: 'screenshots', use: { ...devices['iPhone 13'] }, testMatch: /screenshots\.spec\.ts/ },
  ],
```

In `package.json` `scripts`, add:

```json
    "screenshots": "playwright test --project=screenshots",
```

- [ ] **Step 2: Create `e2e/screenshots.spec.ts`**

Captures every screen in light mode, dark mode, and with large text, using realistic sample data.

```ts
import { expect, test, type Page } from '@playwright/test'
import { addFriend, goToTab, logMeetup } from './helpers.ts'

const DIR = 'e2e/screenshots'

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

async function seed(page: Page) {
  await page.goto('/')
  await page.getByRole('complementary', { name: 'Install the app' }).getByRole('button', { name: 'Dismiss' }).click()
  await addFriend(page, 'Alex Rivera', 'College')
  await addFriend(page, 'Sam Chen', 'College')
  await addFriend(page, 'Kim Park', 'Work')
  await addFriend(page, 'Jordan Lee', 'Work')
  await addFriend(page, 'Maya Patel')
  await addFriend(page, 'Theo Brooks', 'Family')
  await logMeetup(page, ['Alex Rivera', 'Sam Chen'], { type: 'Meal', note: 'Ramen night', date: daysAgo(3) })
  await logMeetup(page, ['Kim Park'], { type: 'Coffee', date: daysAgo(20) })
  await logMeetup(page, ['Alex Rivera'], { type: 'Drinks', date: daysAgo(45) })
  await logMeetup(page, ['Theo Brooks'], { type: 'Call', date: daysAgo(120) })
  await logMeetup(page, ['Alex Rivera', 'Kim Park', 'Jordan Lee'], { type: 'Party', date: daysAgo(300) })
  await logMeetup(page, ['Sam Chen'], { type: 'Trip', date: daysAgo(400) })
  await expect(page.getByRole('status')).toBeEmpty({ timeout: 8000 })
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
  await page.screenshot({ path: `${DIR}/${prefix}-04-friend.png` })
  await page.screenshot({ path: `${DIR}/${prefix}-05-friend-full.png`, fullPage: true })

  await goToTab(page, 'Stats')
  await page.screenshot({ path: `${DIR}/${prefix}-06-stats.png`, fullPage: true })

  await goToTab(page, 'Settings')
  await page.screenshot({ path: `${DIR}/${prefix}-07-settings.png` })
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme })

    test('empty state', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByRole('heading', { level: 1, name: 'Friends' })).toBeVisible()
      await page.screenshot({ path: `${DIR}/${scheme}-01-empty.png` })
    })

    test('all screens', async ({ page }) => {
      test.setTimeout(120_000)
      await seed(page)
      await captureAll(page, scheme)
    })
  })
}

test('large text', async ({ page }) => {
  test.setTimeout(120_000)
  await seed(page)
  // Roughly the iPhone's largest standard text size.
  await page.addStyleTag({ content: 'html { font: 23px/1.35 -apple-system, system-ui, sans-serif !important; }' })
  await captureAll(page, 'large-text')
})
```

- [ ] **Step 3: Capture the screenshots**

Run: `npm run screenshots`
Expected: PASS (5 tests). `e2e/screenshots/` contains 20 PNG files.

- [ ] **Step 4: Review every screenshot against the design**

Open each PNG in `e2e/screenshots/` (the Read tool shows images). Check each one against `PRODUCT.md`, `DESIGN.md`, and this list:

- Text is readable in both themes; secondary text is clearly lighter but not faint.
- Peach covers no more than about 10% of any screen (The One Peach Rule). No red anywhere except destructive buttons (The No Alarm Rule).
- Nothing is cut off, overlapping, or hidden behind the tab bar, the Log button, or a toast. Long names wrap instead of overflowing.
- At large text, the stat row wraps cleanly and the rows grow taller instead of truncating.
- Spacing has a rhythm (tighter inside groups, more air between sections); left edges line up.
- The friend detail hero, stat row and month bars read as one calm column, not as a grid of cards.
- Dark mode looks designed (warm, near-black surfaces), not inverted.
- Nothing looks like a CRM table, a streak/guilt UI, a social feed, or a generic template.

Then invoke the `impeccable:impeccable` skill with `audit` (accessibility, contrast, touch targets, responsiveness) and then `polish` on the app. Apply the fixes they recommend that fit `PRODUCT.md` and `DESIGN.md`.

- [ ] **Step 5: Re-verify after fixes**

Run: `npm test`
Expected: PASS.

Run: `npm run e2e`
Expected: PASS (28 tests).

Run: `npm run screenshots`
Expected: PASS. Re-open the screenshots you changed and confirm the issues are gone.

- [ ] **Step 6: Replace the seed `DESIGN.md` with the real design system**

Invoke the `impeccable:impeccable` skill with `document`. It scans `src/styles/tokens.css` and the components and rewrites `DESIGN.md` (and `.impeccable/design.json`) with the actual tokens.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: visual QA pass, screenshot tooling, and documented design system

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 22: Publish to GitHub Pages and install on the iPhone

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`

Steps 4 to 6 need the user. Stop and ask for help there; never type passwords or tokens on the user's behalf.

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Create `README.md`**

```markdown
# Friend Tracker

A private iPhone app for remembering when you last saw your friends and how often you met this year vs last year. Everything stays on your phone.

## Use it on your iPhone

1. Open the app's GitHub Pages link in **Safari**.
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open it from the new **Friends** icon. Always use the icon: data entered in a Safari tab is stored separately.
4. Back up now and then: **Settings → Export backup** → Save to Files (iCloud Drive).

## Develop

    npm install
    npm run dev           # then open the printed URL (use the Network URL on your phone, same Wi-Fi)
    npm test              # unit tests
    npm run e2e           # end-to-end tests in WebKit at iPhone size
    npm run screenshots   # light/dark/large-text screenshots into e2e/screenshots/

Every push to `main` builds and publishes to GitHub Pages.
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "ci: deploy to GitHub Pages on every push to main

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 4: Get the user signed in to GitHub**

Run: `gh --version`
- If it prints a version, continue.
- If the command is not found, ask the user for permission, then run `winget install --id GitHub.cli -e` and open a new terminal.

Ask the user to:
1. Create a free account at https://github.com/signup if they don't have one.
2. Type `! gh auth login` in the Claude Code prompt and choose: GitHub.com → HTTPS → Yes (authenticate Git) → Login with a web browser. Then follow the browser steps.

Run: `gh auth status`
Expected: `Logged in to github.com account <name>`.

- [ ] **Step 5: Create the repository and turn on Pages**

```bash
gh repo create friend-tracker --public --source . --remote origin
gh api -X POST "repos/{owner}/{repo}/pages" -f build_type=workflow
git push -u origin main
```

Expected: the repo is created, the Pages call returns JSON containing `"build_type": "workflow"`, and the push succeeds.

- [ ] **Step 6: Watch the deploy and get the link**

Run: `gh run watch --exit-status`
Expected: both `build` and `deploy` jobs succeed. If `npm ci` fails because of a platform-specific package, change `npm ci` to `npm install` in the workflow, commit, push, and watch again.

Run: `gh api "repos/{owner}/{repo}/pages" --jq .html_url`
Expected: a URL like `https://<username>.github.io/friend-tracker/`.

Run: `curl -sI <that URL> | head -1`
Expected: `HTTP/2 200`.

- [ ] **Step 7: Hand over to the user**

Give the user the link and the four install steps from the README. Ask them to:
1. Add it to the Home Screen and open it from the icon (the install hint should not appear there).
2. Add a friend and log a meetup.
3. Turn on dark mode, and try a larger text size (Settings → Display & Brightness → Text Size), and check that it still looks right.
4. Do one **Export backup** to Files to confirm the share sheet works.

Ask them to report anything that looks off, so it can be fixed in a follow-up.
