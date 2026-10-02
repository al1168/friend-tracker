# Friend Tracker — Design

Date: 2026-10-02
Status: Approved in brainstorming and design shaping, pending spec review

Related: [PRODUCT.md](../../../PRODUCT.md) (users, personality, principles) and [DESIGN.md](../../../DESIGN.md) (visual system seed).

## Goal

A mobile-first iPhone app for keeping track of friends: when I last saw each one, and how often I met them this year, last year, and all time.

## Constraints

- Development happens on a Windows PC. No usable Mac, no paid Apple Developer account.
- Single user. Data stays on the iPhone only; no server, no login.
- Mobile-first: designed for one-handed iPhone use. Wider screens just center the phone layout (max width about 600px).

## Approach

A Progressive Web App (PWA) built with React + TypeScript + Vite, hosted on GitHub Pages, and installed on the iPhone via Safari → Share → Add to Home Screen. It runs full-screen with its own icon and works offline.

Rejected alternatives:
- React Native via Expo Go: without a Mac or paid developer account it only runs inside Expo Go.
- Native SwiftUI: needs a modern Mac with Xcode; free provisioning expires every 7 days.

## Definitions

- **Meetup**: any logged interaction, of any type (calls included).
- **This year / last year**: calendar years (Jan 1 – Dec 31) in the phone's local time zone, based on the meetup's date.
- **Last seen**: the date of a friend's most recent meetup that is not in the future. A friend with no past meetups shows "Not seen yet".
- **Days since last seen** (`d`): whole calendar days between today (local) and the last-seen date. Displayed as:

  | `d` | Text |
  |---|---|
  | 0 | Today |
  | 1 | Yesterday |
  | 2–13 | `d` days ago |
  | 14–59 | `floor(d/7)` weeks ago |
  | 60–364 | `floor(d/30)` months ago |
  | ≥ 365 | `floor(d/365)` year(s) ago |

  Friend detail always shows the exact date alongside (e.g. "Sat, Sep 12 · 3 weeks ago"). Sorting uses `d`, not the text.
- A group meetup counts as one meetup for **each** friend tagged in it. In totals across all friends (e.g. "meetups this year") it counts **once**.
- **Future-dated meetups** (date after today) are excluded from every statistic and from "last seen" until their date arrives. They appear in a friend's history labeled "Upcoming".
- **Ties** in any sort or ranking are broken by friend name, A–Z (case-insensitive).
- Friends without a group are reported under **"No group"** in group breakdowns.

## Data model

Stored in IndexedDB via Dexie. Ids are random UUID strings.

| Record | Fields |
|---|---|
| Friend | `id`, `name` (required, trimmed, non-empty), `groupId` (nullable), `photo` (nullable Blob, JPEG, longest side ≤ 400px), `notes` (string, may be empty), `createdAt` (ISO timestamp) |
| Group | `id`, `name` (required, unique case-insensitively) |
| MeetupType | `id`, `name` (required, unique case-insensitively), `emoji`, `order` (number, for display order) |
| Meetup | `id`, `date` (`YYYY-MM-DD` local date string), `typeId`, `friendIds` (array, at least one), `note` (string, may be empty), `createdAt` (ISO timestamp) |

Indexes: `Meetup.date`, `Meetup.friendIds` (multi-entry), `Friend.groupId`.

Settings (key/value table): `lastBackupAt` (ISO timestamp, nullable), `installHintDismissed` (boolean).

Default meetup types seeded on first launch, in this order: ☕ Coffee, 🍽️ Meal, 🍻 Drinks, 📞 Call, 🎳 Activity, 🎉 Party, ✈️ Trip, ✨ Other.

No groups are seeded.

Statistics are never stored; they are derived from meetups on demand.

### Deletion rules

- Deleting a **meetup** happens immediately and shows an Undo toast for 5 seconds. Undo restores the meetup exactly.
- Deleting a **friend** asks for confirmation (bottom action sheet), then removes their id from every meetup's `friendIds`. A meetup left with no friends is deleted. Done in one transaction.
- Deleting a **group** asks for confirmation, then sets `groupId = null` on its friends.
- A **meetup type** in use by any meetup cannot be deleted (it can be renamed). The UI says how many meetups use it. Deleting an unused type asks for confirmation.

## Visual design

Full direction lives in PRODUCT.md and DESIGN.md. The essentials:

- **Personality:** calm, cute, minimal; feels like an Apple app with a little warmth. Anchors: Apple Contacts (list structure, avatars), Apple Fitness (rounded numerals, year-vs-year bars), Apple Reminders (quick-add sheet).
- **Color:** Restrained. Warm paper-toned neutrals tinted toward peach, plus one peach/coral accent used only on actionable elements and current-year data (≤ ~10% of a screen). Red only on destructive buttons. Colors defined in OKLCH; never pure black or white.
- **Theme:** follows the system light/dark setting; both are designed, not inverted.
- **Type:** SF Pro Rounded (`ui-rounded`) for titles and numbers, SF Pro (`-apple-system`) for body. Base size from `font: -apple-system-body` so the iPhone text-size setting applies; all other sizes in `rem`. Tabular numerals in stats.
- **Elevation:** flat tonal layering like iOS Settings; shadows only on floating things (sheet, Log button, toasts).
- **Motion:** about 200ms, ease-out-quart; sheets about 320ms ease-out-expo; no bounce. Reduce Motion → simple fades.
- **Avatars:** photo if present, otherwise initials on a soft pastel tint picked deterministically from the name.
- **Icons:** inline SVG line icons in an SF Symbols-like style. Meetup types use their emoji.
- **App icon:** peach rounded square with two soft overlapping circles. Home screen label "Friends"; full name "Friend Tracker".
- **Bans:** no CRM tables, no streaks or overdue badges or alarm colors, no feed-like busyness, no gradients/glassmorphism/identical card grids, no colored side-stripe borders, no "hero metric" stat cards.

## Screens

Bottom tab bar: **Friends · Stats · Settings**. iOS-style large titles that shrink on scroll; inset grouped lists. A peach **+ Log meetup** pill floats at bottom-center above the tab bar on Friends and Friend detail; it is the only large peach element.

### Friends (home)
- Header: large title "Friends", a sort menu button, and "Add friend" button.
- Search field, then horizontally scrolling group chips ("All" plus one per group; hidden when there are no groups).
- Row: avatar (44pt), name, secondary line "College · 3 weeks ago" (or "Not seen yet"), trailing count of meetups this year in rounded numerals.
- Sort options: longest since last seen (default; "Not seen yet" friends at the top), name A–Z, most seen this year.
- Empty state: "Add the people you want to keep up with." with an Add friend button.
- Install hint: when opened in a Safari tab (not from the Home Screen), a dismissible card explains Share → Add to Home Screen and why (data lives in the home-screen app). Shown until dismissed.

### Friend detail
- Header: large avatar, name (rounded), group, notes below.
- One line: "Last seen Sat, Sep 12 · 3 weeks ago" or "Not seen yet".
- Inline stat row (not cards): **This year · Last year · All time**. Stacks vertically at large text sizes.
- Month-by-month bars: 12 months, this year (peach) next to last year (warm gray), with a text legend.
- History, newest first, grouped by month: type emoji + name, date, note, and "with Alex, Sam" for other friends present. Tapping opens the meetup sheet in edit mode. Empty: "Your first meetup will show up here."
- Edit and Delete friend actions in the header menu.

### Add / edit friend (sheet)
- Name, group (picker with "None" and "New group…"), photo (iOS photo picker / camera via file input; resized before saving; removable), notes.

### Log / edit meetup (sheet)
Fields in order of importance:
1. **Who:** 8 one-tap avatar chips: friends ordered by most recent last-seen date, with any remaining slots filled alphabetically by never-seen friends. A search field covers everyone else. Selected friends show as chips at the top. Pre-selects the friend when opened from Friend detail.
2. **What:** a horizontal row of emoji type chips; one tap selects. Defaults to the first type.
3. **When:** Today / Yesterday chips plus "Pick date" (native iOS date picker). Defaults to Today. Future dates allowed; they don't count as last seen until they arrive.
4. **Note:** optional single text field.

A large Save button is pinned to the bottom of the sheet, above the keyboard and home indicator. It is disabled until at least one friend is selected. Edit mode adds Delete.

After saving a new meetup, the sheet slides away and a toast says "Logged with Alex and Sam" with Undo (5 seconds; Undo removes it). Editing shows a plain "Saved" toast. Rows reorder with a short transition.

### Stats
- Title with year switcher: ‹ 2026 › (defaults to the current year; compares with the year before).
- Lead sentence: "84 meetups with 23 friends. Last year: 61 with 19."
- Top friends for the selected year (up to 10, only friends with at least one meetup): avatar, name, this year's count, previous year's count beside it.
- By type: horizontal bars with emoji labels, selected year and previous year.
- By group: horizontal bars (a meetup with two friends from the same group counts once for that group).
- "Not seen yet in 2026" (for past years: "Not seen in 2025"): a soft list of friends with zero meetups in the selected year.
- Empty: "Log a few meetups and your year will show up here."

### Settings
iOS inset grouped list:
- **Groups:** add, rename, delete.
- **Meetup types:** add, rename, change emoji, reorder, delete if unused.
- **Backup:** "Last backup: 3 weeks ago" / "Never backed up", Export, Import.
- **About your data:** short note that everything stays on this iPhone, and the Add-to-Home-Screen storage quirk.

### Shared interaction rules
- Tapping a friend pushes Friend detail (slides in from the right) with a back chevron top-left.
- Sheets slide up from the bottom; drag down or Cancel to dismiss. With unsaved changes, a bottom action sheet asks "Discard changes?".
- Every tappable element has a pressed state; nothing relies on hover. Tap targets ≥ 44×44pt.
- Confirmations use iOS-style bottom action sheets, never centered modal dialogs.

## Backup

**Export** produces one JSON file named `friend-tracker-backup-YYYY-MM-DD.json`:

```json
{
  "app": "friend-tracker",
  "version": 1,
  "exportedAt": "<ISO timestamp>",
  "friends": [{ "...": "...", "photo": "data:image/jpeg;base64,..." }],
  "groups": [],
  "meetupTypes": [],
  "meetups": []
}
```

Photos are encoded as base64 data URLs. Export uses the Web Share API with a file (opens the iOS share sheet so it can be saved to Files / iCloud Drive). If file sharing is unsupported (e.g. desktop browser), it falls back to a download. A successful export sets `lastBackupAt`.

**Import** picks a file, then validates it fully before changing anything:
- `app` must be `"friend-tracker"` and `version` must be `1`.
- Every record must have the required fields with the right types.
- Every `groupId`, `typeId`, and `friendIds` entry must reference a record in the file.

If validation fails, show the reason and leave existing data untouched. If it passes, confirm with a bottom action sheet ("Replace all data with this backup?"), then clear and write everything in one transaction.

## Storage durability

- On first launch the app calls `navigator.storage.persist()`.
- iOS keeps a home-screen web app's storage separate from Safari's. The app must be added to the Home Screen first and used only from there; data entered in a Safari tab does not carry over. The install hint (Friends screen) and Settings explain this.

## Architecture

```
src/
  stats/        Pure functions: lastSeen, daysSince, formatSince, countForFriendInYear,
                monthlyCounts, totalsForYear, breakdownByType, breakdownByGroup,
                topFriends, friendsNotSeenInYear, recentFriends.
                Input: plain arrays + "today". No React, no database.
  db/           Dexie schema, seeding, and repository functions (CRUD + deletion rules + undo restore).
  backup/       serialize, validate, deserialize; export/import glue.
  styles/       Design tokens (CSS custom properties, OKLCH, light + dark) and base styles.
  components/   Reusable UI: TabBar, LargeTitle, InsetList/Row, Avatar, Chip, Sheet,
                ActionSheet, Toast (with Undo), StatRow, MonthBars, HBar, LogButton, icons.
  screens/      FriendsList, FriendDetail, FriendSheet, MeetupSheet, Stats, Settings.
  App.tsx       Tab bar + routes (hash-based routing so GitHub Pages works without server config).
```

- `stats/` takes "today" as a parameter so tests are deterministic.
- Screens read from `db/` with Dexie live queries, so the UI updates immediately after any change.
- PWA: `vite-plugin-pwa` generates the web manifest (name "Friend Tracker", short name "Friends", standalone display, theme colors for light and dark) and a service worker that precaches the app for offline use. Icons at the sizes iOS needs, including `apple-touch-icon`.
- iPhone layout: `viewport-fit=cover` with safe-area padding; `apple-mobile-web-app-capable` and status-bar meta tags.

## Error handling

- Form validation inline under the field: friend name required; group/type names required and unique; meetup needs at least one friend.
- Database write failures show a toast and leave the sheet open so nothing typed is lost.
- Photo processing failure (unsupported image) shows an inline error and keeps the previous photo.
- Import errors as described in Backup.

## Testing

- **Unit tests (Vitest)** for `stats/`: year boundaries (Dec 31 / Jan 1), leap day, group meetups counted once per friend and once in totals, friends with no meetups, future-dated meetups excluded from last seen, group breakdown de-duplication, every boundary of the "last seen" wording table (0, 1, 2, 13, 14, 59, 60, 364, 365 days), recent-friends ordering.
- **Unit tests** for `backup/`: export → import round trip yields identical data (including photos); each validation rule rejects a bad file without touching the database (using `fake-indexeddb`).
- **Unit tests** for `db/`: deletion rules and meetup undo restore.
- **Manual check** in a browser at iPhone sizes (375×667 and 430×932), in light and dark mode, and with large text. Then on the real iPhone after deployment.
- **Design QA:** run impeccable `audit` (accessibility, contrast, touch targets) and `polish` passes before calling it done.

## Deployment

- Git repository pushed to GitHub (public; only code, never data).
- GitHub Actions workflow builds and publishes to GitHub Pages on every push to `main`.
- The user creates a free GitHub account at deploy time.
- Install: open the Pages URL in Safari → Share → Add to Home Screen.

## Out of scope

Push notifications and reminders, per-friend frequency goals, cloud sync or multi-device use, contacts import, birthdays as a structured field (notes can hold them), home-screen widgets, swipe gestures on rows, haptics (not available to web apps on iOS).
