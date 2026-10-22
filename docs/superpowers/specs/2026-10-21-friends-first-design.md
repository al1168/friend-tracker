# Friends first, room to write, photos up front and safer backups: design

Date: 2026-10-21. Status: approved (the owner approved the UX review's items with "Looks good"; auto approve).

A hands-on UX review of the shipped app (the screenshots under `uxreview/shots/`) found four problems worth fixing together. Each section below is one of the review's items, numbered as the review numbered them:

- **3.** No friend shows when the Friends tab opens.
- **4.** The day page leaves little room to write.
- **5.** Photos are hard to add and sit at the bottom of the Meetup page.
- **6.** The only copy of the data is easy to lose.

This batch builds on the sheet-details batch (`docs/superpowers/specs/2026-10-21-sheet-details-design.md`, being built on `feature/sheet-details`) and is built after it merges. "Building on the sheet-details batch" lists where the two touch.

## Goal

Make the app open on people, keep the keyboard's small window free for writing, put photos where a memory is read, and make it hard to lose data by accident. Logging stays under ten seconds and nothing here adds a step to it.

## Decisions

- **The Friends tab opens on friends.** Search and the group chips move to the top, just under the large title. This is the iOS Contacts pattern, and it was "option C" in the meetup history design, out of scope then and approved now.
  - Birthdays soon becomes one swipeable row of compact tiles: face, first name and countdown.
  - Recent meetups shows only the latest meetup. "See all" moves into the group's header.
  - On an iPhone 13 Home Screen at the default text size, on a day with 3 birthdays, the first friend row moves up from about 727pt to about 520pt, so 3 friend rows show on open.
  - Nothing above the search field ever hides any more, so the scroll correction that kept it still is deleted.
- **A toast never covers writing.**
  - The day page shows no toasts.
  - "Save and write about the day" now confirms with a quiet "Logged with …" note at the top of the page. Its Undo lasts until you first change something there.
- **Toasts belong to their page.** Opening another page (a push) clears any toast. Going back (a pop) keeps it, so the Undo for a delete still shows on the page you return to.
- **The day box starts at the top.** When the keyboard comes up for The day, the box's top goes just under the nav bar, as long as the caret's line still shows. This turns about 2 visible lines into about 13 on the phone.
- **The Place field gets the full row.** The Place row becomes two lines: the field across the whole bar, then Now, Add, Close and Hide keyboard below it.
- **Photos on the Meetup page.**
  - The Photos section always shows, between Activities and The day.
  - Its Add photos tile saves each photo the moment it's ready, with an "Added 3 photos" toast that can undo the whole batch.
  - Lists still never read full images. Adding reads only index keys, and the thumbnails come from the existing cache.
- **Backups.**
  - The Backup footer adds how many meetups were logged since the last backup.
  - A small Terracotta Ink dot on the Settings tab suggests a backup at most once every 30 days, and only when meetups have been logged since a backup 30 or more days old.
  - The import confirm compares the backup with the app: its date and counts, what's in the app now, and what would be lost.
  - Restoring takes a snapshot of the current data first, in IndexedDB, inside the restore's own transaction. "Undo" on the toast, or "Undo restore" in Settings for 7 days, puts it back.
- **One schema change.** Dexie version 4 adds one store, `restoreUndo`. The backup file format stays at version 5.

## 3. Friends first (`src/screens/FriendsScreen.tsx`)

### What the review saw

- On a day with 3 birthdays, the Friends tab opens on:
  - Birthdays soon (3 rows);
  - Recent meetups (2 rows and the "See all meetups" row);
  - the search field, under the Log pill.
- The first friend row starts about 680px down in the review's Safari-sized capture (`b-01-friends-top.png`, `b-02-friends-full.png`), about 727pt on the Home Screen, so no friend shows on open.
- At the large text size, Birthdays soon alone fills the screen (`e-large-01-friends.png`).
- The meetup history design predicted this ("on days Birthdays soon shows 3 rows, no friend row is on the first screen").

### Layout, top to bottom

1. **Nav bar:** Sort and Add friend, unchanged.
2. **Large title:** "Friends".
3. **Install hint**, in Safari only until dismissed, unchanged and still first.
4. **Search and chips** (the existing `.friends-filters` block, moved up from below Recent meetups):
   - the search field (placeholder "Search", named "Search friends"), then the group chips, unchanged in look and behavior;
   - always shown when there's a friend.
5. **Birthdays soon:** the strip below. Hidden when no birthday is within 14 days, while searching, and while a group filter is on, as today.
6. **Recent meetups:** the header with "See all", then one meetup row. Hidden when no meetup has happened yet, while searching, and while a group filter is on, as today.
7. **The friend list,** unchanged.
8. **The "+ Log meetup" pill,** unchanged.

```
                                         ⇅    +
Friends
[ 🔍 Search                                    ]
 (All) (Climbing) (College) (Family) (Work)

Birthdays soon
 [(BC) Brandon  ]  [(SC) Sam     ]  [(LF) Len
 [     In 2 days]  [     In 9 days]  [     In 1
Recent meetups                          See all
 (☕)  Coffee                                  ›
       Mon, Oct 19 · with Alex Rivera
 (AR)  Aisha Rahman                           0
       Not seen yet                   this year
 (MF)  Maximiliana Alexandra                  1
       ...
```

### Birthdays soon: one swipeable row

- **The group:** a `section` named by its h2 "Birthdays soon" (the `group-title` look), holding a `ul` of tiles. There is no inset group container and no footer: "And 3 more in the next two weeks." goes away, because every birthday in the next 14 days is in the strip, soonest first, then by name (`upcomingBirthdays`, unchanged).
- **A tile** is a link to the friend's page:
  - Paper White, 14px corners (`--radius-group`), no shadow;
  - padding `0.5rem 0.875rem 0.5rem 0.5rem`, a `0.625rem` gap;
  - the 44px avatar, then two lines.
  - **Name** (line 1): Subhead 600 Warm Ink, the friend's short name: their first name, or their full name when another friend has the same first name (ignoring case). It stays on one line; a single first name longer than 10rem ends in "…".
  - **Countdown** (line 2): Footnote Warm Ink Secondary, "Today", "Tomorrow" or "In 9 days".
  - The age isn't shown on the tile. It's in the tile's accessible name and on the friend's page.
- **Height:** a tile is 60px tall at the default size (the avatar plus 8px above and below), and grows with the text.
- **Press:** Linen Pressed over 160ms. **Focus:** the 2px Terracotta Ink ring, with room for it inside the scroller.
- **The strip:**
  - Layout: `display: flex; gap: var(--space-2); overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x proximity; scroll-padding-inline: var(--space-4); scrollbar-width: none`. Each tile is `flex: none; scroll-snap-align: start`.
  - Edges: it bleeds to the screen edges (`margin: 0 calc(-1 * var(--space-4)); padding: var(--space-1) var(--space-4)`) like `.chip-row`, so the first tile sits on the 16px margin.
  - Shared rules: the scroller rules are shared with the sheet-details batch's Who strip, as one `.snap-strip` class.
- **What shows:** with 3 birthdays, two tiles show whole and most of the third peeks in (avatar and the start of the name), which says there's more. With 1 or 2 birthdays, they all show and nothing scrolls.
- **Accessible name of a tile:** the full name, then the existing row wording: "Brandon Cao, In 2 days · turns 27", or "Lee, Today". It starts with the word the tile shows, so Voice Control's "Tap Brandon" works.
- **Data:** none new. `describeNextBirthday` is split so the countdown has its own function, `describeBirthdayCountdown(days)` ("Today", "Tomorrow", "In 9 days"), in `src/lib/birthdays.ts`. `describeNextBirthday` keeps its output and uses it.
- **Short names:** `payers.ts`'s private `firstName` and the rule in `payerLabel` move into `src/lib/text.ts` as `shortName(friend, among)`. `payerLabel(friend, people)` becomes `shortName(friend, people)`, with the same results. Birthdays soon passes all friends as `among`.

### Recent meetups: the latest one, "See all" in the header

- **One row:** `RECENT_MEETUPS` becomes 1 in `src/stats/meetupHistory.ts`, and `RECENT_MEETUPS_WITH_BIRTHDAYS` is removed. It's 1 on every day, so nothing changes at midnight when a birthday comes into range.
  - The row is the shared `MeetupRow`, naming everyone, with its subtitle stopped at two lines (`subtitleLines={2}`), as today.
  - `useMeetupIdsWithPhotosAmong` asks about that one meetup.
- **The header:** `InsetGroup` gains an optional `action` shown at the end of the title's line, in a flex row that wraps at large text sizes.
  - The action here is a link to `/meetups` that reads "See all": Footnote 600 Terracotta Ink, 16px in from the group's right edge.
  - It's named "See all meetups" (`aria-label`), which starts with the words it shows.
  - Its hit area is 44px tall and at least 44px wide. It extends up into the 24px gap above the group, never over the row below, so the header line stays as tall as any group title.
  - In the DOM it comes after the heading and before the row, the same as on screen.
- **The "See all meetups" row is removed.** The Meetups page, its back label "Friends" and everything after it are unchanged.

### The search field stays put, with nothing to correct

Search and the chips now sit above everything that hides when you search or pick a group, so typing or tapping a chip never moves them. The scroll correction is deleted from `FriendsScreen`: `filtersRef`, `filtersTopBefore`, `keepFiltersStill`, its `useLayoutEffect` and `MAX_BIRTHDAYS_SOON`. The e2e test "The search field stays put" stays as a guard and passes without it.

### Where the friend list lands

The positions use the same method as the meetup history design. They are measured from the top of the page, in Playwright's iPhone 13 profile (Safari's 664px viewport, the text size the e2e WebKit uses), then worked out for the Home Screen: +47pt status bar, with rem sizes about 6% larger at the phone's 17px default.

| | Before (3 birthdays) | After (3 birthdays) | After (no birthday soon) |
|---|---|---|---|
| Search field top | 562px | 97px | 97px |
| Birthdays soon | 122-302px | 213-306px | hidden |
| Recent meetups | 335-538px | 330-432px | 213-315px |
| First friend row (e2e) | 678px | about 456px | about 339px |
| First friend row (Home Screen) | about 727pt | about 520pt | about 400pt |

- **On the Home Screen** the tab bar starts at 760pt and the Log pill covers 692-744pt (about 200pt wide, centered).
- **With 3 birthdays**, friend rows (about 62pt each) sit at about 520-582, 582-645 and 645-707pt:
  - the first two show whole;
  - the third's name shows clear, and its last line runs about 6pt under the pill's top edge;
  - the fourth row's avatar shows beside the pill.
- **When the latest meetup's subtitle fits on one line,** everything sits 20pt higher, and 3 rows show whole.
- **With no birthday soon,** about 5 rows show.
- **In Safari** (not the target; the tab bar starts at 614px and the pill covers 546-598px) one friend row shows whole on a 3-birthday day.
- **At the large text size,** the search field sits at about 120px. Birthdays soon is one row of taller tiles, instead of three rows that filled the screen.

### VoiceOver order

Title, search field, chips, Birthdays soon (heading, then each tile), Recent meetups (heading, "See all meetups", the row), then the friend list. Search is now the first control after the title, as in Contacts.

## 4. Room to write on The day page (`src/screens/DayScreen.tsx`, `src/components/Toast.tsx`, `src/screens/DayHelperBar.tsx`)

### What the review saw

- After "Save and write about the day", the toast "Logged with Mariya and Jessie" and its Undo sit 8px above the helper bar (`.day-open .toast-region`) for 8 seconds, right over The day box while the keyboard is up (`b-21-day-keyboard.png`, `b-24-day-after-paid.png`).
- With the Who paid row open, almost no text shows (`b-23-day-paid-row.png`, `e-large-06-day-paid-keyboard.png`).
- A toast followed onto another meetup's page and still offered Undo for the first one (`e-large-08-rainy-meetup.png`: "Logged with Alex Rivera" over a Meal with Mariya, Jessie and Brandon).
- The Place field is squeezed beside Now, Add, Close and Hide keyboard, so "nonstopstyle 10:30" shows as "nonstopstyle 1" (`b-22-day-place-row.png`).

### Toasts belong to their page

- **Opening another page clears the toast.** `ToastProvider` reads `useNavigationType()`, which `ScrollManager` already uses.
  - When the location key changes with a `PUSH`, the toast goes at once, and `--toast-space` is set to 0 for the new page (the toast is still in the DOM during that layout effect, so it isn't measured).
  - A `POP` keeps it. Every `REPLACE` in the app is a stand-in for Back (the fallbacks in `Page`, `DayScreen` and `MeetupScreen`, and Delete friend's `navigate('/', { replace: true })`) or a same-page change (the Stats year), so `REPLACE` keeps it too.
- **What this keeps working:**
  - Deleting a meetup from its Edit sheet: the Meetup page goes back (a pop), and "Meetup deleted" with Undo stays on the page you land on.
  - Deleting a friend: a replace, so "Deleted Alex" stays.
  - Logging from a friend's page, then Back: the "Logged" toast stays on Friends, where the meetup now shows.
- **What this fixes:** after logging, tapping any link (a meetup row, a friend, a tab) clears the "Logged" toast, so an Undo never shows over a page it doesn't belong to.
- **The rule applies to every toast,** plain ones too. A toast is about the page it was shown on.

### The day page never shows a toast

- **"Save and write about the day"** (`MeetupSheet.save` with `writeDay`) no longer calls `toast()`. It pushes the day page with router state `{ logged: true }` (`NavState` gains `logged?: boolean`). The quick Save keeps its toast exactly as today.
- **`ToastProvider` drops toasts on the day page.**
  - While the path is a day page, a toast asked for is dropped. The day page says what it needs in its own lines: the Logged note, the save error line and "This box is full.".
  - The day-page regular expression moves from `TabBar` to `src/lib/routes.ts` as `isDayPage(pathname)`, used by both.
- **Removed:**
  - the `.day-open .toast-region` rule in `Toast.css`;
  - the `day-open` class and `--day-bar-height` that `DayScreen` publishes for it, which have no other user.

### The Logged note

- **When it shows:** when the day page opens with `logged` in its state, the body starts with a note above the context line.
- **Look:** a Paper White box with 14px corners, at least 44px tall, `var(--space-1) var(--space-1) var(--space-1) var(--space-4)` padding, holding three things:
  - the toast's 24px Peach check circle, drawing its check in over 420ms (`aria-hidden`; with Reduce Motion it's simply drawn);
  - "Logged with Mariya and Jessie" in Subhead 600 Warm Ink, built as the toast was: "Logged with " and `formatNameList` of the friends on the meetup, in the meetup's order;
  - an "Undo" text button at the end (Terracotta Ink 600, 44px).
- **Undo lasts until you first change something on the page:** typing in either box, a weather chip, a mood, or any helper.
  - After that, the button is gone but its space stays (the box keeps its 44px height), so nothing below moves.
  - The note stays for the visit.
  - After a change, the way to remove the meetup is Edit, then "Delete meetup", which has its own Undo.
- **Undo** deletes the meetup (`deleteMeetup`). With nothing written, nothing is lost. The page then goes back as it does today when the meetup is gone, and the Meetup page goes back too, landing where the sheet was opened.
  - If the delete fails, the note's words become "Couldn't undo. Please try again." (`role="alert"`) and Undo stays.
- **VoiceOver:** the title "The day" still takes focus on open. The page's existing polite announcer then says "Logged with Mariya and Jessie." once.
- **When it doesn't show:** without `logged` (opened from "Write about the day" or "Edit the day", or straight from a link), the page is exactly as today.
- **After the app lock,** the URL and its state come back, so the note shows again. That's still true, and its Undo follows the same rule.

### The day box starts at the top when the keyboard comes up

- **Today:** tapping The day box raises the keyboard, and `useRevealFocusedField` only makes sure the caret's line shows. On a short day the box stays where it was, under the context line, Weather, the label and the two-line hint, so about 4 lines show on the phone (2 with the toast).
- **New, `data-reveal="start"` on The day box:**
  - When the body shrinks because the keyboard came up while this box has focus, the reveal scrolls the body so the box's top sits 12px (its `scroll-margin`) under the nav bar.
  - It does this only when the caret's line still shows after the scroll. Otherwise (a long day tapped near its end), it shows the caret's line as today.
  - Typing and caret moves then follow the caret as today.
  - It happens once per keyboard opening. A helper handing focus back (Add, Close, a payer chip, Now) happens with the keyboard already up, so the body doesn't shrink and the box doesn't jump.
- **The offset:** a new pure `alignTopOffset(port, target, margin)` in `src/lib/viewport.ts` (the offset that puts `target.top` at `port.top + margin`). The caret check uses the existing `caretLineSpan` and `revealOffset`.
- **What shows on the phone** (keyboard about 336pt with the suggestion bar, nav bar 91pt, helper bar about 61pt): about 356pt of body, about 13 lines of The day. In the e2e fake keyboard (340px in a 664px viewport) about 8 lines show. With the Who paid row open, about 10 lines show on the phone and about 5 in the e2e.
- **The sheet-details batch** adds `data-reveal="top"` for its friend search, which re-aligns on every change of the search. `"start"` is a second value in the same hook, so the two never mix.

### The Place field gets the full row

- **The Place row has two lines,** and grows upward like Who paid:
  - **Line 1:** the Place field across the full width of the bar (16px sides), 44px tall, unchanged otherwise: "Place, then a time if you like", named "Place and time", autocorrect off, `enterKeyHint="next"`.
  - **Line 2:** "Now" (today only) at the start, then, at the end: "Add" (dimmed until there's text, as today), the pinned Close and, while the keyboard is up, "Hide keyboard".
  - The DOM order matches: field, Now, Add, Close, Hide keyboard.
- **The field is about 358pt wide on the phone** instead of about 140pt, so "nonstopstyle 10:30" and most place names fit with room to spare.
- **Behavior is unchanged:** Return or Add adds the place line, Close empties and closes, text left in the field is added on Back or when the app goes away, and focus never leaves where you're typing.
- **CSS:** `.day-helpers[data-row='place']` stacks a full-width field above a row holding the scrolling part and the pinned buttons. `.day-place.field` loses `flex: 1; min-width: 6em` and becomes `width: 100%`.

### Data impact

None. `logged` lives only in the history entry's router state.

## 5. Photos on the Meetup page (`src/screens/MeetupScreen.tsx`)

### What the review saw

- A meetup without photos has no Photos section and no way to add one there. You have to tap Edit, scroll to the bottom of the sheet, then use the picker.
- A meetup with photos shows them at the very end, under the whole day's timeline, How it felt and the day row (`b-28-meetup-after-day-full.png`, `b-36-rainy-meetup-full.png`).

### Order, top to bottom

The hero (unchanged), Activities, **Photos**, The day, How it felt, then the day row ("Write about the day" or "Edit the day"). Each section other than Photos is still hidden when empty.

- With an empty day, the order is the hero, Activities, Photos, then "Write about the day".
- On the Home Screen, for a meetup with 3 friends and 2 activities and no photos, the day row's top still shows above the tab bar (about 700pt).

### The Photos section

- **Always shown,** for past and upcoming meetups alike. It's the `Section` "Photos" with the shared `.photo-grid`: 3 across, square, 12px corners, 8px gaps.
- **Thumbnails** open the photo viewer, as today. There are no remove buttons here: removing and reordering stay in the Edit sheet.
- **The last tile is always Add photos,** the same tile as the sheet's: Linen, a 1.5px dashed Warm Ink Tertiary outline, the 26px camera-plus icon and "Add photos". With no photos it's the only tile.
- **Picking:** tapping it opens the picker (`accept="image/*"`, `multiple`). At 20 photos it shows "A meetup can have up to 20 photos." instead.
- **Saving:** each chosen photo is resized with `processPhoto` (1600px and 320px JPEGs, `isValidPhotoData`), one at a time, and saved at once with `addMeetupPhoto`. Its full image is then dropped from memory, so at most one photo's full image is held at a time. The sheet holds them all until Save.
- **While adding:**
  - the tile reads "Adding 2 of 5…" and is `aria-disabled`;
  - "Edit" in the nav bar is disabled (45% opacity), so the sheet never opens with a photo list about to change;
  - each photo appears in the grid as soon as it's saved (live query), before the tile.
- **When the batch ends:**
  - the toast "Added 1 photo" or "Added 3 photos" (with the check), with "Undo" (8 seconds, like every action toast);
  - Undo removes exactly the photos added in that batch (`removeMeetupPhotos`) and shows nothing more on success, or "Couldn't undo. Please try again." if it fails.
- **Hints** under the grid (Footnote Warm Ink Secondary, `role="alert"`, never red), as in the sheet:
  - "A meetup can have up to 20 photos." when more were chosen than there's room for (the first ones that fit are added);
  - "1 photo couldn't be added." for a file that can't be read;
  - "A photo couldn't be saved." when a write fails, which stops the batch. Photos saved before it stay, and the toast offers Undo for them.
- **Leaving the page mid-batch** stops it after the photo being saved. Those already saved stay, and no toast shows (removing them is in the Edit sheet).
- **After adding photos,** `askToKeepData()` asks Safari to keep the data, as the sheet does.
- **Reuse:** the picker, the one-at-a-time loop, the progress label and the hints move out of `src/sheets/MeetupPhotos.tsx` into a shared `usePhotoAdder({ room, onPhoto, active })` and a `PhotoAddTile` component.
  - The sheet's `onPhoto` adds to its draft, as today.
  - The page's `onPhoto` calls `addMeetupPhoto`.
  - The `.photo-add` styles move from `MeetupSheet.css` to `base.css`.

### Data functions (`src/db/meetups.ts`)

No schema change; these use the existing `[meetupId+order]` index.

```ts
/**
 * Adds one photo after a meetup's others, in one transaction. Reads only the [meetupId+order] index keys of the
 * meetup's photos (how many, and the last order), never an image. Resolves false when the meetup is gone; refuses
 * a 21st photo with TOO_MANY_PHOTOS.
 */
export async function addMeetupPhoto(meetupId: string, photo: NewPhoto): Promise<boolean>

/** Undo for photos added on the Meetup page: deletes these photos of this meetup (others ignored) and forgets their thumbnails. */
export async function removeMeetupPhotos(meetupId: string, ids: readonly string[]): Promise<void>
```

- **`photoThumbs(meetupId)` stops reading whole photos on every change.** Today it reads every photo's whole record (`bulkGet`), full image included, keeps the thumbnail and drops the rest. The Meetup page's live query would now re-run that after each photo added. Instead:
  - it reads the ids in order, key-only, from `[meetupId+order]` (`between([meetupId, -Infinity], [meetupId, Infinity]).primaryKeys()`);
  - then it takes each thumbnail from the existing thumbnail cache, reading a photo's record only on a miss, as `firstPhotoThumb` does.
  - Adding the fifth photo then reads one record, not five.
  - A photo's thumbnail never changes, so caching by id stays safe.
- **No full image is ever kept for a list.** The viewer still reads only the photo it shows (`usePhoto`).
- **Order gaps** left by an Undo are fine. The order is only ever compared, and the backup parser accepts any whole number 0 or more.
- **Backups** need no change: photos are saved as they always were.

## 6. Protect the only copy of the data (`src/screens/SettingsScreen.tsx`, `src/backup/*`, `src/components/TabBar.tsx`)

### What the review saw

- **The Backup footer** says "Never backed up. Includes 9 photos." and nothing ever brings the owner to it (`b-64-settings-full.png`).
- **The import confirm** says "It has 15 friends and 39 meetups. Everything in the app now will be replaced." (`d-04-import-confirm.png`). It doesn't say when the backup was made (`exportedAt`, which `parseBackup` ignores), and doesn't compare it with what's in the app.
- **Restoring an old file** silently replaces newer meetups, with no undo.

### The Backup footer says what's new

- **`describeBackup` takes the number of meetups logged since the last backup** (`createdAt` after `lastBackupAt`): `describeBackup(lastBackupAt, today, photoCount, meetupsSince)`.
  - With some since: "Last backup: 6 weeks ago. 12 meetups since then. Includes 9 photos.", or "Last backup: 2 months ago. 1 meetup since then."
  - With none since, or never backed up: unchanged ("Last backup: today. Includes 9 photos.", "Never backed up. Includes 9 photos.").
- **Facts only:** no color, no "you should", never red.

### A quiet dot on the Settings tab

- **When a backup is due:** at least one meetup was logged since the last backup, and the last backup was 30 or more days ago. With no backup yet, the first meetup must have been logged 30 or more days ago.
- **When the dot shows:** while a backup is due, unless Settings was opened in the last 30 days while it was due.
  - Opening Settings while it's due records `backupNudgeSeenAt` (a new setting) and the dot goes away.
  - It comes back 30 days later only if a backup is still due.
  - Exporting a backup ends it, because nothing is new since then.
- **Look:** an 8px Terracotta Ink circle at the top right of the Settings icon (`aria-hidden`). It's never red, never a number, and never moves (no pulse).
  - Terracotta Ink on the Paper White tab bar is about 5.1:1, well past the 3:1 a graphic needs.
- **VoiceOver:** the tab link gains visually hidden words, read as "Settings, backup suggested". They start with the tab's own word.
- **Cost:** `TabBar` returns nothing on the day page before calling any hook, so the query below never runs there. The work moves into an inner `TabBarItems`.
  - **The query:** `useBackupDot()`, one live query.
  - **When it reads nothing:** while the dot was seen in the last 30 days, or while the last backup is less than 30 days old.
  - **Otherwise:** it looks for the first meetup that makes a backup due and stops there: `db.meetups.filter(...).first()`. `createdAt` has no index, but meetups hold no photos.
  - **Pure rules:** `src/backup/nudge.ts`:

```ts
/** Days between a backup and the first suggestion to make another, and between suggestions. */
export const BACKUP_NUDGE_DAYS = 30
/** Meetups logged after the last backup (all of them when there has been none). */
export function meetupsSinceBackup(meetups: readonly Pick<Meetup, 'createdAt'>[], lastBackupAt: string | null): number
/** A backup is due: something logged since, and 30 or more days since the last backup (or since the first meetup, with none). */
export function backupDue(meetups: readonly Pick<Meetup, 'createdAt'>[], lastBackupAt: string | null, now: Date): boolean
/** The Settings tab's dot: due, and not seen in the last 30 days. */
export function showBackupDot(due: boolean, seenAt: string | null, now: Date): boolean
```

### The import confirm compares the backup with the app

- **`parseBackup` returns `exportedAt`:** `{ ok: true, data, exportedAt: string | null }`.
  - `exportedAt` is the file's value when it's a string that `Date.parse` reads, and null otherwise.
  - It never refuses a file. Older and edited files still import.
- **The confirm:**
  - The title "Replace all data with this backup?" and the destructive button "Replace all data" are unchanged.
  - The message becomes up to four lines (the action sheet's message gains `white-space: pre-line`; no existing message has a line break):

```
Backup from Wed, Sep 2: 15 friends, 30 meetups, 6 photos.
In the app now: 15 friends, 39 meetups, 9 photos.
9 meetups in the app now aren't in this backup.
Everything in the app now will be replaced. You can undo this in Settings for 7 days.
```

- **Line 1:** "Backup from" and `formatDate` of `exportedAt`'s local date ("Wed, Sep 2", or "Tue, Sep 2, 2025" in another year). Without a readable `exportedAt` it says "This backup: 15 friends, 30 meetups, 6 photos."
- **Line 2:** what's in the app now. With no friends and no meetups it says "No friends or meetups in the app yet."
- **Photos:** each count list ends with photos ("6 photos", "1 photo", "0 photos") when either the backup or the app has any, and leaves them out otherwise.
- **Line 3:** friends and meetups in the app now whose ids aren't in the backup, only when there are some:
  - "9 meetups in the app now aren't in this backup."
  - "1 friend and 9 meetups in the app now aren't in this backup."
  - "2 friends in the app now aren't in this backup."
- **Line 4:** only when the app has a friend or a meetup (otherwise nothing is replaced and there's nothing to undo).
- **Building it:** a pure `describeImport` in `src/backup/importSummary.ts` builds the lines from the parsed data, `exportedAt`, the app's current ids and counts, and today. Settings already has `friends`, `meetups` and `usePhotoCount`.

### Undo for a restore

- **What's kept:**
  - Restoring first copies everything the restore will replace (friends, groups, meetup types, meetups and meetup photos) into a new `restoreUndo` store, in the same transaction that replaces them.
  - Either both happen or neither. A restore that fails still changes nothing ("Couldn't restore the backup. Nothing was changed.").
- **Memory:** the snapshot never lives in memory.
  - Friends, groups, types and meetups are small and copied whole. Friends' photos are 400px avatars, and meetups hold no images.
  - Meetup photos are copied 20 at a time by primary key: `where(':id').above(lastId).limit(20)`, then `bulkAdd`.
  - So a restore holds what it holds today (the backup being restored) plus at most 20 photos, however many photos the app has. Undo copies back 20 at a time too.
- **How long it lasts:** 7 days after the restore.
  - It's deleted when it's older than that: on every app start (a small `RestoreUndoCleanup` in `App`, like `ReminderSync`), when a new restore replaces it, and when it's used.
  - It lasts through the app lock and the app being closed. While it's kept, the data takes up to twice its space on the phone.
  - Settings stops offering it past the 7 days even before the cleanup runs.
- **When there's nothing to keep:** restoring into an app with no friends and no meetups (a new phone) takes no snapshot, clears any older one, and offers no Undo.
- **After a restore:**
  - With a snapshot: the toast "Backup restored" (with the check) and "Undo".
  - Without one: "Backup restored", as today.
  - Undo puts everything back as it was just before the restore (`undoRestore`), then shows "Restore undone".
  - If Undo fails: "Couldn't undo. Please try again." The snapshot is kept, so Settings can still use it.
  - Opening another page clears the toast (section 4). Settings still offers the undo.
- **In Settings,** while a snapshot is kept, the Backup group has a third row after "Import backup":
  - title "Undo restore" (accent, like the other two);
  - subtitle "Puts back the data from before Wed, Oct 21. Kept until Wed, Oct 28." (the restore's date and that date plus 7 days, `formatDate`).
- **Tapping it** opens a destructive confirm (`alertdialog`):
  - title "Undo the restore?";
  - message:

    ```
    Before Wed, Oct 21: 15 friends, 39 meetups, 9 photos.
    In the app now: 15 friends, 30 meetups, 6 photos.
    Everything in the app now will be replaced.
    ```

  - the button "Undo restore".
  - Confirming does what the toast's Undo does, with the same toasts.
- **Settings data** isn't part of the snapshot, as it isn't part of a backup: `lastBackupAt`, the app lock, reminders and the new keys. A restore doesn't change `lastBackupAt`, and neither does its undo.

### Data

- **Dexie version 4** adds one store and changes nothing else, so there is no upgrade step:

```ts
// Version 4 adds restoreUndo: what the app held just before a backup was restored, kept 7 days so the restore can
// be undone. Rows are { table, id, row }, keyed by [table+id]. Never read by backups or lists.
db.version(4).stores({
  friends: 'id, groupId',
  groups: 'id',
  meetupTypes: 'id, order',
  meetups: 'id, date, typeId, *friendIds',
  settings: 'key',
  meetupPhotos: 'id, meetupId, [meetupId+order]',
  restoreUndo: '[table+id]',
})
```

- **Settings** (`src/db/settings.ts`) gains `backupNudgeSeenAt: string | null` and `restoreUndo: { takenAt: string; friends: number; meetups: number; photos: number } | null`, both null by default.
- **`src/backup/storage.ts`:**
  - `replaceAllData` stays as the inner step;
  - new `restoreBackup(data, now): Promise<{ undoable: boolean }>` decides inside its transaction whether there's anything to keep;
  - new `undoRestore(): Promise<boolean>` resolves false when there's no snapshot;
  - new `forgetOldRestore(now): Promise<void>`;
  - restore and undo both call `forgetPhotoThumbs()` afterwards.
- **`readAllData`, `exportBackup` and `replaceAllData`** name their five tables, so the snapshot never goes into a backup and a restore never touches it except through `restoreBackup`.
- **The backup file is unchanged:** still version 5.

## Accessibility

- **Friends tab:**
  - VoiceOver order: title, search, chips, Birthdays soon, Recent meetups, list. The search is reached first, and the rotor's Form Controls still jumps to it.
  - Birthdays soon is a region with a list of links, each named in full ("Brandon Cao, In 2 days · turns 27"). VoiceOver swiping moves through the tiles and scrolls the strip to each one, and so does keyboard focus.
  - "See all" is a link named "See all meetups".
  - Tiles are 60px tall. "See all" has a 44 by 44px hit area.
- **The day page:**
  - The Logged note's words are announced once through the page's announcer. Its "Undo" is a real button named "Undo". When it goes after the first change, VoiceOver and keyboard focus were in the box you typed in, not on it.
  - Aligning the box moves no focus.
  - The Place row keeps "Place and time", "Now, 9:52 PM", "Add", "Close" and "Hide keyboard", in the order they show.
- **Meetup page:**
  - "Add photos" is a button. It's `aria-disabled` with "Adding 2 of 5…" while it works, and never gets the `disabled` attribute, so focus stays on it.
  - The toast announces "Added 3 photos". Hints are `role="alert"`.
  - Thumbnails keep their alt text ("Photo 1 of 3").
- **Settings:**
  - The tab reads "Settings, backup suggested" while the dot shows.
  - The confirm's lines are read in order.
  - "Undo restore" reads its subtitle as its description. Its confirm is an `alertdialog`.
- **Targets:** every new control is at least 44 by 44px.
- **Dynamic Type:**
  - Tiles grow, and the strip stays one row that scrolls.
  - The Recent meetups header wraps "See all" under the title at accessibility sizes.
  - The Logged note wraps its words, and Undo stays 44px.
  - The Place field keeps its full row.
  - The confirm's lines wrap.
- **Reduce Motion:** the Logged note's check is drawn without animating. Nothing else new moves on its own.
- **Color:** only existing pairs (Warm Ink and Warm Ink Secondary on Paper White, Terracotta Ink on Warm Paper and Paper White). The dot is Terracotta Ink, never red, and is never the only signal (the tab's name says it, and the Backup footer says why).

## DESIGN.md

Add or change:

- **Colors, Terracotta Ink:** add "the Settings tab's backup dot".
- **Colors, Paper White:** add "Birthdays soon tiles and the day page's Logged note".
- **Inset groups and rows:** add "A group title can end with one text link ("See all"), Footnote 600 Terracotta Ink, with a 44px hit area that reaches into the space above the group, never over its first row."
- **Inputs and fields, Search:** "On Friends it sits just under the large title, with the group chips under it; Meetups has one above its list."
- **Birthdays soon** (rewrite): "A row of tiles on the Friends tab, after the search field and chips: every friend whose birthday is today or in the next 14 days, soonest first, in one strip that scrolls sideways and bleeds to the screen edges. A tile is a Paper White link with 14px corners: the 44px avatar, then the short name (the first name, or the full name when another friend shares it) in Subhead 600 over the countdown ("Today", "Tomorrow", "In 5 days") in Footnote Warm Ink Secondary. It's named in full for VoiceOver ("Brandon Cao, In 2 days · turns 27"). Hidden when no birthday is that close, while searching, and while a group filter is on."
- **Recent meetups** (rewrite): "An inset group titled "Recent meetups" on the Friends tab, after Birthdays soon: the latest meetup dated today or earlier as a Meetup row naming everyone, its subtitle stopped at two lines, with "See all" at the end of the title's line, which opens the Meetups page. Hidden when no meetup has happened yet, while searching, and while a group filter is on."
- **Toast:**
  - Replace "On the day page it sits 8px above the helper bar." with "It belongs to the page it was shown on: opening another page clears it, and going back keeps it. The day page never shows one, and no toast covers a field being typed in."
  - Add "A batch of photos added on the Meetup page ends with "Added 3 photos" and Undo."
- **The day page:**
  - Add "Opened by "Save and write about the day", the body starts with the Logged note: a Paper White box with the toast's check, "Logged with Mariya and Jessie" and an Undo that lasts until the first change on the page."
  - Add "When the keyboard comes up for The day, the box's top goes 12px under the nav bar, unless that would hide the caret's line."
- **Helper bar:** ""@ Place" swaps the row for the Place field across the whole bar (autocorrect off), with Now, Add, Close and Hide keyboard on a line under it."
- **Meetup page:**
  - The order becomes "Activities, Photos, The day, How it felt, then the day row".
  - Photos becomes "always shown: the 3-across grid ending with the Add photos tile, which saves each photo as soon as it's ready; a thumbnail opens the photo viewer; removing and reordering are in the Edit sheet".
- **Navigation, Tab bar:** add "While a backup is suggested (meetups logged since a backup 30 or more days old, at most once every 30 days), an 8px Terracotta Ink dot sits at the top right of the Settings icon. Never red, never a number, no motion."
- **Action sheets and confirms:** add "A message may run to several short lines."
- **Do's and Don'ts:**
  - Add to "Truncate only where iOS does": "a Birthdays soon tile's very long first name".
  - Add "**Don't** show a toast over a field being typed in."
  - Add to the No Alarm Rule: "A suggestion to back up is a small Terracotta Ink dot and plain facts in Settings, never red and never a count of days."

## Testing

**Unit tests:**

- **`src/lib/birthdays.test.ts`:** `describeBirthdayCountdown` gives "Today", "Tomorrow" and "In 5 days", and `describeNextBirthday`'s existing cases are unchanged.
- **`src/lib/text.test.ts`:**
  - `shortName`: "Brandon Cao" alone gives "Brandon"; with "brandon lee" among the friends it gives "Brandon Cao"; "Mariya" gives "Mariya"; extra spaces are ignored.
  - `describeBackup` with `meetupsSince`: "Last backup: 6 weeks ago. 12 meetups since then. Includes 9 photos.", "Last backup: 2 months ago. 1 meetup since then.", and the existing cases unchanged with 0.
- **`src/lib/payers.test.ts`:** unchanged results through `shortName`.
- **New `src/backup/nudge.test.ts`:**
  - `meetupsSinceBackup` counts only meetups logged after the backup, and all of them with none.
  - `backupDue`: false at 29 days and true at 30 with a meetup since; false at 60 days with nothing new; never backed up, true when the first meetup is 30 days old and false at 29; false with no meetups.
  - `showBackupDot`: true when due and never seen; false when seen 10 days ago; true when seen 30 days ago; false when not due.
- **`src/backup/format.test.ts`:** `exportedAt` comes back for a valid file, and is null (with the file still accepted) when it's missing, not a string, or not a date.
- **New `src/backup/importSummary.test.ts`,** exact lines for:
  - a dated backup with photos on both sides;
  - one without `exportedAt`;
  - one from last year ("Tue, Sep 2, 2025");
  - an empty app ("No friends or meetups in the app yet.", and no last line);
  - neither side with photos (no photo counts);
  - meetups only missing, friends and meetups missing, friends only missing, singulars.
- **`src/backup/storage.test.ts`** (fake-indexeddb):
  - `restoreBackup` with data in the app keeps a snapshot equal to `readAllData()` from before (types and photos included), sets `restoreUndo` with its counts, and replaces the data.
  - Into an empty app it keeps none, clears an older one, and resolves `{ undoable: false }`.
  - `undoRestore` puts back exactly what was there, clears the store and the setting, and resolves false a second time.
  - `forgetOldRestore` keeps a snapshot at 6 days 23 hours and deletes it at 7 days.
  - A restore that fails (two meetups with one id) changes nothing, snapshot included.
  - Photos are copied at most 20 per `bulkAdd` (a spy).
  - A restored photo and an undone one show their own thumbnails (the cache is cleared).
  - `readAllData` never includes the snapshot.
- **`src/db/meetups.test.ts`:**
  - `addMeetupPhoto` puts the photo after the last one and never calls `db.meetupPhotos.get` or `bulkGet` (spies). It refuses a 21st with "A meetup can have up to 20 photos." and resolves false for a deleted meetup.
  - `removeMeetupPhotos` deletes only the listed photos of that meetup and forgets their thumbnails.
  - `photoThumbs` gives ids and thumbnails in order, reads no record on a second call (spies), follows a reorder, and reads only the new record after a photo is added.
- **`src/lib/viewport.test.ts`:** `alignTopOffset` for a target below, above and already at the margin.
- **`src/stats/meetupHistory.test.ts`:** `RECENT_MEETUPS` is 1, and the constant that's gone is gone from the test.

**E2E** (WebKit, iPhone 13). New tests, by file:

- **`e2e/friends.spec.ts`, "friends come first":**
  - Setup: 3 birthdays in the next two weeks, a latest meetup whose subtitle runs to two lines, 4 groups and 8 friends.
  - The search field's top is at most 110px.
  - The regions and controls come in the order search, "Filter by group", "Birthdays soon", "Recent meetups", then the friend rows.
  - The first friend row's top is at most 480px, and the third friend row's `.row__title` ends at or above 645px (the Home Screen's pill top in these coordinates: 713px less 16 and 52).
- **`e2e/birthdays.spec.ts`:**
  - "lists the birthdays in the next two weeks" now checks each tile's text ("Lee", "Today") and accessible name ("Alex, In 5 days · turns 40").
  - "shows at most three birthdays soon" becomes "shows every birthday soon in one strip": 6 tiles in order, no "And 3 more" text, the sixth reachable by scrolling the strip sideways and opening its friend.
  - New: two friends named Sam show their full names on their tiles.
- **`e2e/history.spec.ts`:**
  - "Recent meetups shows the three latest" becomes "shows the latest": one row, Drinks.
  - "Recent meetups shows two while Birthdays soon shows" becomes "shows one row with or without Birthdays soon".
  - Link order assertions read "See all meetups" first (it's in the header).
  - "See all opens Meetups" clicks the header link.
  - "The search field stays put" stays as it is.
- **`e2e/day.spec.ts`:**
  - **No toast on the day page:** "Save and write about the day" leaves no `.toast` and shows the note "Logged with Mariya" with "Undo"; the heading "The day" is focused. This replaces the toast-position test at lines 106-112.
  - **Undo in the note:**
    - before any change, Undo lands on Friends with no meetups;
    - after typing a letter, the note has no Undo and The day box's top didn't move (within 1px).
    - This replaces "Undo on the "Logged" toast takes the day with it".
  - **A toast stays on its page:**
    - log from Friends (the toast shows), then tap the meetup in Recent meetups: no toast on the Meetup page;
    - delete a meetup from its Edit sheet: after the page goes back, "Meetup deleted" still shows, and Undo puts the row back.
  - Line 665 checks the note instead of the toast.
- **`e2e/dayKeyboard.spec.ts`** (the fake keyboard):
  - With a short day, focusing The day puts its top 12px under the nav bar (within 2px).
  - With a 60-line day and the caret at the end, the caret's line shows.
  - Adding a place from the Place row hands focus back without moving the box's top (within 1px).
  - The Place field is as wide as the bar less 32px (within 2px), and "Now", "Add", "Close" and "Hide keyboard" sit on the line below it.
- **`e2e/meetupPage.spec.ts`:**
  - "hides what a meetup does not have" now expects the Photos region with only the Add photos button.
  - New: adding 2 photos (`setInputFiles`) saves them without opening Edit (`readPhotos` shows 2), shows "Added 2 photos", and Undo removes both.
  - New: the regions come in the order Activities, Photos, The day, How it felt.
  - New: with 19 photos seeded, choosing 3 adds 1 and shows "A meetup can have up to 20 photos.".
  - The viewer test's `getByRole('button')` in Photos now includes Add photos; it keeps using `.first()` and counts only images.
- **`e2e/settings.spec.ts`:**
  - **The import confirm's exact lines,** with the clock at Sep 2 for the export and Oct 21 for the import, after logging 2 more meetups.
  - **The toast's Undo** puts back friends, meetups and a photo and says "Restore undone".
  - **"Undo restore"** in Settings, with its subtitle, confirm and result; the row then goes.
  - **The clock 7 days on, then a reload:** no row, and no `restoreUndo` rows in IndexedDB.
  - **A restore into a fresh app:** no Undo and no row.
  - **The dot:**
    - a backup, then a meetup logged and the clock 31 days on: the Settings tab is named "Settings, backup suggested";
    - opening Settings clears it, and the footer reads "Last backup: 4 weeks ago. 1 meetup since then.";
    - after a reload, no dot; 30 days later, the dot again.
  - "exports and imports a backup" keeps working: the toast now has Undo, and going to Friends clears it.
- **Tests that break and must change:** the lines above, plus any test that asserts a toast after following a link (found while building; the rule clears it).

**Screenshots** (`e2e/screenshots.spec.ts`, light, dark and large text, inside `captureAll`). Renumber if the sheet-details batch has used these numbers.

- `02-friends` and `02-friends-full` now show search at the top, the Birthdays soon strip and one recent meetup.
- New `21-day-logged`: the day page right after "Save and write about the day", keyboard up, the box aligned under the nav bar.
- New `22-day-place-row`: the Place row with "nonstopstyle 10:30".
- New `23-meetup-photos`: a meetup with no photos, Photos above "Write about the day".
- New `24-import-confirm`.
- New `25-settings-undo-restore`.
- New `26-tab-dot`.

Review them by eye on the phone too: Playwright has no status bar, no safe areas and no 17px text, so the Home Screen positions above are worked out and must be checked on an iPhone 13.

## Building on the sheet-details batch

This batch is built after `feature/sheet-details` merges, and touches some of the same code:

- **`useRevealFocusedField`:** that batch adds `data-reveal="top"` for "Search all friends" (align on focus and on each change). This batch adds `data-reveal="start"` for The day box (align once when the keyboard comes up, only if the caret's line still shows). Both live in the same hook.
- **The day box:** that batch wraps it in a highlighting field (`DayField`, or `GrowField` with `highlight`). `data-reveal="start"` goes on that textarea, and the Logged note sits above the context line, outside it.
- **`MeetupSheet.save`:** that batch moves "Save and write about the day" from the footer to the end of the body and Save to the header. This batch changes only what its save does: no toast, and `{ logged: true }` on the day page's push.
- **The friend strip:** that batch's swipeable Who strip and this batch's Birthdays soon strip share one scroller class (`.snap-strip`). The tiles differ: the Who strip has two rows of avatar-over-name tiles, and Birthdays soon has one row of avatar-beside-text tiles.
- **E2E:** this batch's tests use the header Save that batch introduces.
- **Screenshots:** take the next free numbers.

Within this batch, build in this order: toasts and the day page (4), the Friends tab (3), Meetup page photos (5), then backups (6, the only schema change).

## Risks and trade-offs

- **The Dexie version 4 upgrade** runs once on the first open after the update.
  - The service worker opens the same database to read friends for birthday notifications (`src/sw/push.ts`). A worker still running the old code meets a database newer than it declares. Check that Dexie 4.4 opens it rather than throwing `VersionError`.
  - Either way, that read has a timeout and falls back to "🎂 A birthday is coming up".
  - A second tab still on the old code is closed by Dexie's `versionchange` and needs a reload.
- **A snapshot doubles the data's space for up to 7 days.** With many photos, a restore and its undo are longer transactions, though no heavier on memory than a restore is today.
- **The Undo on the day page is shorter-lived than the toast's.** It goes at the first change. After writing, removing the meetup takes Edit, then "Delete meetup" (with its own Undo).
- **Clearing toasts on every push** is a behavior change for plain toasts too, and may break e2e tests that check a toast after following a link.
- **Birthdays soon shows two and a half tiles on a 3-birthday day.** The third needs a glance at the peek or a swipe. This is the price of moving the friend list up about 200pt.
- **Search at the top** means scrolling back up to search from deep in the list, as in Contacts (tapping the status bar scrolls to the top).
- **The Place row's second line** takes about 52pt more while it's open, but then you're typing in the Place field, not the box.
- **The dot's "seen" rule** hides it for 30 days after one look at Settings, even if no backup was made. The footer keeps the facts.
- **Positions** are measured in Playwright and worked out for the phone (17px text, safe areas). The third friend row's last line may touch the Log pill on the Home Screen at the default size.

## Out of scope

- Changing the Meetups page, the friend page, Stats, or the Log and Edit sheets beyond the save path and the shared photo pieces.
- Removing or reordering photos on the Meetup page, or deleting a photo from the viewer.
- Automatic or cloud backups, reminders to back up by notification, and any red or numbered badge.
- Keeping more than one restore snapshot, or keeping one longer than 7 days.
- Merging a backup into the app instead of replacing (import stays all or nothing).
- Toasts anywhere new other than "Added 3 photos", "Restore undone" and the restore's Undo.
- Hiding the large title or the search field on scroll.
- Moving the group chips into a menu.
- A Birthdays page.
- Showing the age on Birthdays soon tiles.
