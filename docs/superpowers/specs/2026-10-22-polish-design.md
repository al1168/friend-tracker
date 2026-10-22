# A fair year, easier history, the largest text sizes and memories first: design

Date: 2026-10-22. Status: approved (the owner approved the UX review's next items with "go"; auto approve).

The hands-on UX review of the shipped app (the screenshots under `uxreview/shots/`) found more to fix after the friends first batch. Each numbered section below is one of the review's items, numbered as the review numbered them, and a last section gathers the small fixes:

- **7.** Stats compares this year so far with all of last year, and years before the app was used show as zeros.
- **8.** History is hard to scan: every row's title is the meetup type, and a search for "rainy" finds nothing.
- **9.** The largest text sizes break words in the middle and cut short labels that would fit.
- **10.** A friend's page puts numbers before memories.
- **Quick polish:** eight small things the review noticed.

## Goal

Make the numbers fair, make history read as people, keep every word whole at the largest text sizes, and put a friend's memories before their numbers. Logging stays under ten seconds and nothing here adds a step to it. No schema change: Dexie stays at version 4 and the backup file at version 5.

## Decisions

- **A fair comparison.** This year so far is compared with last year up to the same date ("By Oct 22 last year: 11 meetups."), on Stats and on a friend's page. All of last year is still shown, named as the whole year.
- **No year before the first meetup.** A year before the first meetup is never offered and never compared with: no "2024: 0", no gray zero bars, and no year arrows when there's only one year.
- **History names people.** A meetup row's title is who was there ("Mariya, Jessie and Brandon"), and its subtitle starts with the type and the date. On a friend's page the title names the others, or is the type when it was just the two of you.
- **Search finds the weather.** The Meetups search also matches the weather's words ("rainy"). Weather still never shows in a list, and moods are still never searched.
- **Whole words at every size.** Rows wrap between words, a meetup row's photo moves under its text at accessibility sizes, the back label isn't cut short while the large title shows, and the Who tiles widen so a first name fits.
- **Memories first.** A friend's History comes right after Birthday, Likes and Dislikes, shows the 5 latest meetups and then "Show all 12 meetups". A friend with no meetups gets one calm line instead of zeros and a flat chart.
- **Quick polish:** a long name in Who keeps its ×; "Logged with Mariya, Jessie and Brandon"; a raised dark toast in dark mode; "Not seen in 2025" leaves out friends added later; the Log pill steps aside while you type on a page; no group name repeated while filtering by it; no "0 this year" for a friend never seen; no Sort button with no friends.

## 7. A fair "this year vs last year" (`src/stats/counts.ts`, `src/screens/StatsScreen.tsx`)

### What the review saw

- On Oct 22, Stats compares this year so far with all of last year: "25 meetups with 14 friends." over "2025: 13 meetups with 14 friends." (`b-61-stats-full.png`).
- In the first year the app was used, everything is compared with a year that has no data: "2024: 0 meetups with 0 friends.", "2024: 0" under every top friend, and a gray zero dot under every bar (`b-62-stats-2025-full.png`, `a-light-13-stats-one-meetup.png`).
- On a friend's page, "Last year" is all of last year too.

### The first year

- **`firstYear(meetups, today)`** (new, `src/stats/counts.ts`): the year of the earliest meetup, or this year when there's none earlier. Stats already worked this out inline; it moves here.
- **A year is compared with the year before only when that year isn't before the first year** (`year > firstYear`).
- **The year switcher** shows its arrows only when there's more than one year (`firstYear < this year`). With one year it shows the year alone, at the same height (44px), so nothing jumps when a second year arrives. With more, it's unchanged: the back arrow is dimmed at the first year, the forward arrow at this year, and `?year=` before the first year still shows this year.

### The Stats lead

The selected year is this year, and last year has meetups or not:

```
25 meetups with 14 friends.
By Oct 22 last year: 11 meetups.
All of 2025: 13 meetups with 14 friends.
```

- **Line 1** is unchanged: "25 meetups with 14 friends.", or "No meetups in 2026 yet.".
- **Line 2, "By Oct 22 last year: 11 meetups."**: only for this year, and only when it's compared with the year before. The count is last year's meetups from Jan 1 up to and including the same date (`totalsByDateLastYear`). "1 meetup." in the singular; "0 meetups." is said too (on Jan 1, or when last year started later).
- **Line 3, "All of 2025: 13 meetups with 14 friends."**: last year as a whole, named as the whole year. Only when compared.
- **A past year** keeps its one comparison line, unchanged: "2024: 9 meetups with 7 friends.". Both years are whole there, so there's no same-date line.
- **The first year** shows line 1 alone.
- Lines 2 and 3 use the existing `.stats-lead__previous` look (Warm Ink Secondary, 4px apart).

### The same date

- **`sameDateLastYear(today)`**: the same month and day a year earlier. Feb 29 becomes Feb 28 (the year before a leap year never has a Feb 29).
- **`totalsByDateLastYear(meetups, today)`**: `{ meetups, friends, through }`, counting last year's meetups dated Jan 1 to `through` (inclusive), each meetup once and friends distinctly, like `totalsForYear`.
- **`countsByFriendByDateLastYear(meetups, today)`**: friendId → meetups with them last year up to `through`, each meetup once per friend.
- **The date** reads "Oct 22": the month's short name and the day, with no weekday (it was another weekday last year) and no year (the words say "last year"). New `formatMonthDay(iso)` in `src/lib/dates.ts`, beside `formatDate`.
- All of it is pure and runs in Node with fixed dates.

### Rows when there's no year to compare

When the selected year isn't compared with the year before:

- **Top friends:** the count alone, with no "2024: 0" under it (the hidden year before the count stays, so VoiceOver hears "2025: 3").
- **By type and By group:** the count alone, with no "· 2024: 0" and no gray bar. `HBarList`'s `previousYear` becomes optional; without it there's no previous value or bar.
- Otherwise the rows are unchanged: they still compare the selected year with the whole year before (see Out of scope).

### "Not seen in <year>"

- `friendsNotSeenInYear` (`src/stats/breakdowns.ts`) leaves out a friend added after the year: one whose `createdAt`, read on the phone's calendar, falls in a later year. A friend with a `createdAt` that isn't a date still counts as known.
- So "Not seen in 2025" no longer lists friends added in 2026. "Not seen yet in 2026" is unchanged (every friend was added by now).

## 8. Easier-to-scan history (`src/components/MeetupRow.tsx`, `src/stats/meetupHistory.ts`)

### What the review saw

- Every row on the Meetups page starts with its type: a column of "Coffee", "Meal", "Coffee", "Drinks" (`b-31-meetups-full.png`). The people, what you remember a meetup by, are in the gray subtitle after "with".
- Searching "rainy" finds nothing, though the day was picked as Rainy (`b-33-meetups-search-rainy.png`).

### The row

```
 (🍽)  Mariya, Jessie and Brandon               [▢] ›
       Meal · Sat, Oct 3 · Movie, Shopping ·
       nonstopstyle, strand bookstore, Sammy L coffee and 5 more
```

- **Title:** who was there, as `formatNameList` writes it: "Mariya", "Mariya and Jessie", "Mariya, Jessie and Brandon", "Alex, Sam and 2 others". The emoji badge already shows the type.
  - **Short names:** each friend by their short name among all friends (`shortName`: the first name, or the full name when another friend has the same first name, ignoring case), as Birthdays soon does. A new `shortNameById(friends)` in `src/lib/text.ts` builds the map in one pass, with the same results as `shortName(friend, friends)`.
  - "Upcoming" follows the title as today, on the same rows as today.
- **Subtitle:** the type, the date, the activities and the day's snippet, joined by " · ": "Meal · Sat, Oct 3 · Movie, Shopping · nonstopstyle, strand bookstore, Sammy L coffee and 5 more". "with …" is gone (the title says it).
- **When no one else was there,** the title is the type and the subtitle starts with the date: "Coffee" over "Sat, Oct 3 · Tacos". That's:
  - on a friend's page, a meetup with just that friend (the title names the others: on Mariya's page, "Jessie and Brandon");
  - anywhere, a meetup whose friends have all been deleted.
- **A deleted type** still reads "Meetup" with ✨.
- **Everywhere the shared row is used:** a friend's History, Recent meetups (its subtitle still stops at two lines) and the Meetups page.
- **VoiceOver** reads the link as the title, then "Upcoming" when shown, then the subtitle: "Mariya, Jessie and Brandon, Meal · Sat, Oct 3 · …".

### Data (`src/stats/meetupHistory.ts`)

```ts
/** A meetup row's title: who was there ("Mariya, Jessie and Brandon"), or the type's name when no one else was. */
export function meetupTitle(names: string[], typeName: string): string
/**
 * A meetup row's subtitle: the type (when the title names people, else null), the date, the activities and the
 * day's snippet, joined by " · ".
 */
export function meetupSubtitle(meetup: Meetup, typeName: string | null, today: ISODate): string
```

- `meetupNames(meetup, nameById, leaveOut)` is unchanged. Rows pass it a map of short names; the Meetups search passes full names.

### Search matches the weather

- `meetupSearchText` adds the labels of the meetup's weather ("Sunny", "Rainy", …, from `WEATHER` in `src/lib/weather.ts`; unknown keys are skipped) as one more part, for every meetup, past or upcoming.
- "rainy" finds the Rainy meetups; "rainy jessie" finds those with Jessie.
- Moods and dates are still never searched, and weather still never shows in a row (the No Score Rule and "Don't show moods or weather in lists" are unchanged).

## 9. The largest text sizes (`src/components/InsetGroup.css`, `src/components/MeetupRow.css`, `src/components/Page.css`, `src/sheets/MeetupSheet.css`)

### What the review saw

- At 33px (an accessibility size) a meetup row's text column is about 85px wide, beside the badge, the 40px photo and the chevron, and its words break mid-word: "Mariy a", "Shopp ing", "nonst opstyl e" (`crop-ax-history.png`).
- The back label reads "F…" or "Fr…" on a friend with a long name, though "Friends" is short (`e-large-12-long-name.png`, `b-16-long-name-friend.png`).
- In the Log sheet's Who strip, names break inside words ("Mari ya", "Jessi e") and end early ("Alex Riv…", "Olivia Mar…") (`e-ax-02-log-sheet.png`).

### Rows wrap between words

- `.row__title` and `.row__subtitle` use `overflow-wrap: break-word` instead of `anywhere`. A line breaks inside a word only when that one word is wider than the line. `.row__main` keeps `min-width: 0`, so a long word can't push the row wider than the screen.

### The photo moves under the text at accessibility sizes

- Each inset group's body is an inline-size container (`container: inset-group / inline-size`). Its width never depends on its rows, so this changes nothing else.
- **When the group is narrower than 14.5em** (its own text size; 358px wide, that's above about 24.7px text, so every accessibility size and none of the standard ones, on every iPhone from the SE to the Pro Max), a meetup row with a photo becomes a two-row grid:

```
 (🍽)  Mariya, Jessie and           ›
       Brandon
       Meal · Sat, Oct 3 · …
       [▢]
```

  - the badge and the chevron span both rows, centered;
  - the title and subtitle fill the first row, about 52px wider than before;
  - the 40px photo sits on the second row, on the text's left edge, 8px below the text.
- Rows without a photo, and every other row, are unchanged. At 33px a 6-letter name ("Mariya") fits on a line.

### The back label isn't cut short while the large title shows

- The nav bar is three columns, `1fr auto 1fr`. The small centered title is invisible until the large title scrolls away, but it still took its width (up to half the screen), so with a long friend's name each side kept only about a quarter of the bar.
- **While the large title (or a friend's hero) shows,** the small title takes no width (`max-width: 0`), so each side gets half the bar and "Friends" shows whole at every text size up to 33px on a 390pt screen.
- **Once the large title scrolls away,** the small title fades in at its width as today, and a long back label shortens with "…" as today.

### Who tiles fit a first name

- Each tile's name wraps between words over at most two lines (`overflow-wrap: break-word`, still clamped at two lines with "…"). It breaks inside a word only when the word alone is wider than the tile.
- **Tiles widen at large text so a first name fits:** a column is at least 4.25rem wide.
  - **The swiping strip** (more than 8 friends): columns are `max((100% - 3 gaps) / 4.4, 4.25rem)`. At the default size nothing changes (4.4 columns to the width, the fifth peeking in). At the largest standard size about 3.4 columns show, and at 33px about 2.6, still peeking in.
  - **The still grid** (8 or fewer): `repeat(auto-fill, minmax(max(4.25rem, 22%), 1fr))`. Four across at the default size (as today), three at the largest standard size, two at 33px. Still filled a row at a time.

## 10. A friend's page: memories before numbers (`src/screens/FriendDetailScreen.tsx`)

### What the review saw

- On Mariya's page, History starts below the stat row and the Month by month chart, about 330pt further down than it needs to (`b-51-mariya-full.png`).
- A friend never seen gets "0 / 0 / 0", a flat chart of twelve gray and peach slivers, and then "Your first meetup will show up here." (`b-55-aisha-full.png`).

### Order, top to bottom

The hero (unchanged), the notes, **Birthday**, **Likes**, **Dislikes**, then **History**, then the stat row and **Month by month**.

### History shows the latest five

- **The first 5 rows,** in History's order (newest month first, upcoming meetups first in their month, as today), grouped by month as today (`firstRows` over the month groups; `FRIEND_HISTORY_ROWS = 5`, and `monthSections(meetups)` gives the friend's month groups in the shape the Meetups page uses).
- **Then "Show all 12 meetups"** (the friend's meetup count, upcoming ones included), when there are more than 5: its own untitled inset group after the last month shown, holding one accent row (Terracotta Ink title, no chevron, since it opens nothing). It's a button.
- **Tapping it** shows every meetup in place: the row goes, the rest of the groups show, and focus moves to the first newly shown meetup row (the 6th), without scrolling (it lands about where the row was). VoiceOver reads that row.
- **Going back** to the page (from a meetup opened in it) keeps History open, through the existing place memory (`usePlaceMemory`, keyed by the history entry, so ScrollManager can put the page back where it was). The app lock starts it fresh, as it does the Meetups page.

### A friend with no meetups

- **With no meetups at all,** History holds one calm line and the page ends there: "No meetups yet. Log one when you see them." (the `list-message` look). No stat row, no chart. It replaces "Your first meetup will show up here."
- **With only upcoming meetups,** History shows them, and the stat row and chart are left out too: they'd be all zeros.
- The hero's "Not seen yet" is unchanged.

### The stat row's same-date note

```
    6             9            12
 This year     Last year     All time
              3 by Oct 22
```

- **"Last year"** gets a note under its label: "3 by Oct 22", the meetups with this friend last year up to today's date a year ago (`countsByFriendByDateLastYear`). Footnote, Warm Ink Secondary, like the label; it wraps at large text, and at accessibility sizes (one item per line) it's the item's third line.
- **Shown** when last year had a meetup with them (a "0 by Oct 22" under a 0 says nothing). "0 by Oct 22" does show under a 2 whose meetups were later in the year.
- **When last year is before the app's first meetup** (`firstYear` of every meetup), "Last year" and its note are left out (the row is "This year" and "All time"), and Month by month draws this year alone: one bar a month, a legend of this year only, and a description without the year before ("January: 2 in 2026.").
- `StatRow` items gain an optional `note`, a second `dd` after the value. The DOM order is label, value, note, so VoiceOver reads "Last year, 9, 3 by Oct 22"; the value still shows above the label.
- `MonthBars`' `previous` becomes optional.

## Quick polish

### A long name in Who keeps its × (`src/sheets/MeetupSheet.tsx`, `src/components/Chip.tsx`)

- **Seen:** a selected friend's chip with a long name runs off the sheet and hides its × (`b-17-long-name-log-sheet.png`).
- **Now:** the chip is at most the row's width. The name shortens with "…" and the avatar and × always show. `Chip` gains `truncate`: the chip takes `max-width: 100%`, and its label (`.chip__label`, a span the caller puts the text in) shrinks with an ellipsis; icons and avatars don't shrink.
- **The accessible name stays full:** "Remove Maximiliana Alexandra Featherstonehaugh-Worthington".

### "Logged with" uses first names (`src/sheets/MeetupSheet.tsx`, `src/screens/DayScreen.tsx`)

- **Seen:** "Logged with Maximiliana Alexandra Featherstonehaugh-Worthington" wraps to four lines (`b-18-long-name-toast.png`).
- **Now:** the toast and the day page's Logged note name each friend by `shortName` among the meetup's friends, as the Paid chips do: "Logged with Mariya, Jessie and Brandon", "Logged with Maximiliana". Two friends who share a first name on one meetup keep their full names ("Logged with Sam Chen and Sam Lee").
- A new `shortNames(friends)` in `src/lib/text.ts`: each friend's short name among these friends, in order.

### A raised toast in dark mode (`src/styles/tokens.css`, `src/components/Toast.css`)

- **Seen:** in dark mode the toast is a bright cream pill on a near-black page, the brightest thing on screen (`e-dark-05-day-place-keyboard.png`).
- **Now:** two tokens, `--toast-bg` and `--toast-ink`:
  - **Light** (unchanged look): `--toast-bg` is Warm Ink `oklch(25% 0.014 50)`, `--toast-ink` Warm Paper `oklch(96.4% 0.009 60)`. 14.4:1.
  - **Dark:** `--toast-bg` is a raised warm surface, `oklch(35% 0.012 55)` (a step above Linen Pressed), and `--toast-ink` is Warm Ink `oklch(95% 0.008 70)`. 9.8:1.
- The Undo pill is `--toast-ink` at 18% over the toast in both themes (6.2:1 in dark). The Float shadow and the Peach check are unchanged.

### "Not seen in <year>" leaves out friends added later

See section 7.

### The Log pill steps aside while you type on a page (`src/components/LogButton.tsx`)

- **Seen:** "Add a like" opens its field under the floating Log pill (`b-53-add-like-field.png`).
- **Now:** while a text field on the page has focus, the pill fades out (160ms) and can't be tapped or reached by VoiceOver (`visibility: hidden`). It comes back when the field loses focus.
  - **A text field:** a `textarea`, or an `input` that takes text (text, search, email, url, tel, number, password).
  - **On the page:** not inside a sheet or an action sheet (a `dialog` or `alertdialog`), which covers the pill anyway; so focus going back to the pill when a sheet closes is never blocked.
  - That's the Likes and Dislikes fields, the Friends search and the Meetups search.
- `LogButton` listens to `focusin` and `focusout` on the document; on `focusout` it reads where focus went (`relatedTarget`).

### No group name while filtering by it (`src/screens/FriendsScreen.tsx`)

- **Seen:** filtering by Climbing, every row says "Climbing · 9 days ago" (`b-58-filter-climbing.png`).
- **Now:** while a group filter is on, the subtitle leaves the group out ("9 days ago"). With "All" it's as today.

### No "0 this year" for a friend never seen

- **Seen:** a new list of friends is a column of "0 / this year" (`a-light-07-three-friends.png`).
- **Now:** a friend with no meetup yet (the subtitle says "Not seen yet") has no trailing count. A friend seen before but not this year still shows "0 this year".

### No Sort button with no friends

- **Seen:** the Sort button shows on the empty Friends tab (`a-light-02-empty.png`).
- **Now:** it shows only when there's a friend. Add friend stays.

## Accessibility

- **Stats:** the lead's lines are read in order. With one year, the switcher is the year alone (still the group "Year"). The hidden "2026: " before each count stays.
- **Meetup rows:** the link reads the people first, then the type and the date, so VoiceOver and Voice Control start with the names you'd say ("Tap Mariya"). The emoji badge stays hidden.
- **Friend page:**
  - "Show all 12 meetups" is a button. After it, focus is on the 6th meetup row, so VoiceOver continues where the button was.
  - The stat row's note is a `dd`, read after the value.
  - The calm line is plain text in the History section.
- **The Log pill** is hidden from VoiceOver while it's hidden on screen, so swiping from a field never lands on something you can't see.
- **The selected chip** keeps its full name as its accessible name.
- **Targets:** the "Show all" row is a 52px row. Nothing else new is tappable.
- **Dynamic Type:** the stat note, the lead lines and the row titles wrap between words. At accessibility sizes a meetup row's photo sits under its text, the back label shows "Friends" whole while the large title shows, and Who tiles widen to fit a first name.
- **Reduce Motion:** the pill's fade stays (fades are allowed); nothing new moves.
- **Color:** the dark toast is 9.8:1 (text) and 6.2:1 (Undo); everything else uses existing pairs.

## DESIGN.md

Change or add:

- **Colors:** add **Toast** (`--toast-bg`, `--toast-ink`): "an inverted pill in light (Warm Ink with Warm Paper text, 14.4:1), a raised warm surface in dark (`oklch(35% 0.012 55)` with Warm Ink text, 9.8:1)".
- **The Dynamic Type Rule:** add "Rows break lines only between words, unless one word is wider than the line. At accessibility sizes (an inset group under 14.5em wide) a meetup row's photo moves under its text."
- **Buttons, Text button:** "The back button always keeps its chevron; a long label truncates with an ellipsis instead, and while the large title shows, the hidden small title takes no room from it."
- **"+ Log meetup" pill:** add "It fades out while a text field on the page has focus (the Likes and Dislikes fields, a search), and comes back when the field loses focus."
- **Chips:** add "A selected friend's chip in the log sheet is at most the row's width: a long name ends in "…", and its avatar and × always show."
- **Friend tiles (Who):** "a 52px avatar over a Footnote name of up to two lines, broken between words"; "Up to 8 friends: a still grid, four across (three at the largest standard size and two at accessibility sizes, so a first name fits)"; "More than 8: … its columns are a little narrower than a quarter of the width (`(100% - 3 gaps) / 4.4`, and at least 4.25rem)".
- **Inset groups and rows, Row:** "main text is a Body title with a Subhead Warm Ink Secondary subtitle, both wrapping between words".
- **Toast:** "An inverted pill in light mode (Warm Ink background, Warm Paper text), a raised warm surface in dark (`--toast-bg`, `--toast-ink`)"; "A meetup is "Logged with" each friend's first name, or the full name when two on it share one."
- **Friend detail column:** the order becomes "the notes, then Birthday, Likes and Dislikes, then History, then the stat row and "Month by month" (memories before numbers)"; History: "the 5 latest meetups, then a "Show all 12 meetups" accent row that shows the rest in place and moves focus to the first one it added; with no meetups, the one line "No meetups yet. Log one when you see them." and no stat row or chart".
- **Meetup row** (rewrite the first sentence): "One row for a meetup, the same everywhere (a friend's History, Recent meetups, the Meetups page): the type's emoji badge; who was there as the title, by short name ("Mariya, Jessie and Brandon", "Alex, Sam and 2 others"; on a friend's page the others, or the type when it was just the two of you), with "Upcoming" for a future date (…); a subtitle of the type (when the title names people), the date, the activities, and the day's first places …".
- **Meetups page:** the search "looks in friend names, the type, activities, the day, the weather's words and, for meetups that have happened, How it felt's words, …; never moods or dates".
- **Stat row:** add "An item can carry a note under its label (Footnote Warm Ink Secondary): "Last year" on a friend's page says how many were by today's date ("3 by Oct 22")."
- **Charts, Month bars:** add "Without a year before to compare (before the first meetup), it draws this year alone."
- **Charts, Horizontal bars:** add "Without a year before to compare, a row is the count and one bar."
- Add a **Stats** section: "The year switcher, the lead and the breakdowns. The lead is the year's meetups and friends in Title 600, then, for this year, "By Oct 22 last year: 11 meetups." and "All of 2025: 13 meetups with 14 friends."; for a past year, "2024: 9 meetups with 7 friends.". No year before the first meetup is offered or compared: no zeros for a year the app wasn't used, and no arrows when there's one year. "Not seen in 2025" leaves out friends added later."
- **Do's and Don'ts:** add "**Do** compare this year so far with last year up to the same date; a whole last year is named as the whole year ("All of 2025")." and "**Don't** compare with a year before the first meetup."

## Testing

**Unit tests:**

- **`src/stats/counts.test.ts`:**
  - `sameDateLastYear`: Oct 22, 2026 gives Oct 22, 2025; Feb 29, 2028 gives Feb 28, 2027; Jan 1 gives Jan 1; Mar 1, 2028 gives Mar 1, 2027; Dec 31 gives Dec 31.
  - `totalsByDateLastYear` on Oct 22, 2026: counts Jan 1 and Oct 22, 2025 (inclusive), not Oct 23 or Dec 31, 2025, nor Dec 31, 2024; a meetup once and friends distinctly; `through` is "2025-10-22". On Feb 29, 2028 it counts Feb 28, 2027 and not Mar 1. On Jan 1, 2026 it counts only Jan 1, 2025.
  - `countsByFriendByDateLastYear`: per friend, up to the same date, a friend listed twice counted once.
  - `firstYear`: this year with no meetups; the earliest meetup's year; this year when every meetup is later (upcoming).
- **`src/lib/dates.test.ts`:** `formatMonthDay` gives "Oct 22", "Feb 28", "Jan 1".
- **`src/stats/breakdowns.test.ts`:** `friendsNotSeenInYear` leaves out a friend added in 2026 from 2025, keeps one added on Dec 31, 2025 at 9 PM on the phone (Jan 1 in UTC), and keeps a friend whose `createdAt` isn't a date.
- **`src/stats/meetupHistory.test.ts`:**
  - `meetupTitle`: one, two, three and four names ("Alex, Sam and 2 others"); the type with none.
  - `meetupSubtitle`: "Meal · Sat, Oct 3 · Movie, Shopping · nonstopstyle, strand bookstore, Sammy L coffee and 5 more"; with no type: "Sat, Oct 3 · Tacos"; another year: "Coffee · Fri, Sep 12, 2025".
  - Search: "rainy" finds a Rainy meetup, upcoming too, and "rainy jessie" needs both; an unknown weather key is skipped; moods and dates still aren't found (the old "never searches the weather" case is turned around).
  - `FRIEND_HISTORY_ROWS` is 5; `monthSections` gives the month groups newest first with their titles, and `firstRows(monthSections(...), 5)` cuts across months.
- **`src/lib/text.test.ts`:** `shortNames` ("Mariya", "Jessie", "Brandon" from "Brandon Cao"; "Sam Chen" and "Sam Lee" both full); `shortNameById` equals `shortName(friend, friends)` for every friend, ignoring case and extra spaces.

**E2E** (WebKit, iPhone 13). New or changed, by file:

- **`e2e/stats.spec.ts`:**
  - On Oct 22, 2026 (fixed clock), with meetups on Mar 3 and Oct 22, 2025, Oct 23, 2025 and two this year: "2 meetups with 2 friends.", "By Oct 22 last year: 2 meetups." and "All of 2025: 3 meetups with 2 friends.".
  - The first year: one meetup this year shows the lead's first line alone, no "2025" anywhere on the page, no year arrows, and no gray bars.
  - A past year compared with a year that has meetups keeps "2024: …"; the first year (2025) shows no "2024".
  - "Not seen in 2025" leaves out a friend added in 2026 and lists one added in 2025.
  - "switches to last year" still passes: its arrows show, since there are two years.
- **`e2e/history.spec.ts`:**
  - Row titles are names: Recent meetups "Kim"; the Meetups page's groups ("Kim", "Alex and Sam", …); the link's name "Alex and Sam … Meal · Sat, Oct 3 · Tacos".
  - On Alex's page: "Sam" over "Meal · Sat, Oct 3 · Tacos"; a Coffee with Alex alone is "Coffee" over "Fri, Sep 25".
  - The search finds "rainy" (the karaoke meetup) and "rainy kim"; "rainy alex" finds nothing.
  - Tests that read titles or open rows by type now read names or match the subtitle.
- **`e2e/detail.spec.ts`:**
  - **Memories first:** the regions come in the order Birthday, Likes, Dislikes, History, then the stat row and Month by month.
  - **Five, then Show all:** with 8 meetups, History shows 5 rows and "Show all 8 meetups"; tapping it shows 8, the button goes and the 6th row is focused; opening the 8th and going back keeps all 8.
  - **No meetups:** "No meetups yet. Log one when you see them.", no `.stat-row` and no Month by month.
  - **Upcoming only:** the row shows, with no stat row.
  - **The note:** on Oct 22, 2026 with meetups on Mar 3 and Nov 5, 2025, "Last year" is 2 with "1 by Oct 22".
  - **No year before:** with every meetup this year, no "Last year" and a legend of this year alone.
  - "Your first meetup will show up here." becomes the new line in the delete test; the large text toast tests use two friends named Bartholomew, so the toast still wraps on full names.
- **`e2e/largeText.spec.ts`** (new):
  - At 33px, a meetup row with a photo has its photo under its subtitle, inside the row, and its title "Mariya, Jessie and Brandon" breaks only between words (each line's text is whole words).
  - At 23px and at 33px, on a friend named "Maximiliana Alexandra Featherstonehaugh-Worthington", the back label reads "Friends" untruncated (its `scrollWidth` fits).
  - At 33px, the Who strip's "Mariya" and "Jessie" each fit on one line, and the still grid is two across.
- **`e2e/friends.spec.ts`:**
  - Never seen: no "this year" count; seen: the count shows.
  - Filtering by a group leaves its name out of the subtitles; "All" puts it back.
  - No Sort button with no friends; it shows once there's one.
- **`e2e/preferences.spec.ts`:** opening "Add a like" hides the Log pill (not visible, not in the accessibility tree); closing the field brings it back. The Friends search does the same.
- **`e2e/sheetDetails.spec.ts`:** a long selected name's chip ends inside the sheet, its × is visible, and its accessible name is the full "Remove …"; "Logged with Friend" for "Friend 12" alone, and full names for two friends who share a first name.
- **`e2e/day.spec.ts`:** the Logged note says "Logged with Mariya, Jessie and Brandon" for "Brandon Cao".
- **Dark toast** (`e2e/detail.spec.ts` or `e2e/shell.spec.ts`): in dark mode the toast's background is darker than its text (computed colors' lightness).
- **Helpers:** `friendLink` now matches only links to a friend's page (`a[href^="#/friends/"]`), since a meetup row's name can start with a friend's name now.
- **Tests that break and must change:** the lines above, plus any test that opens a meetup row by a name starting with its type (`/^Coffee/`), or reads `.row__title` for a type.

**Screenshots** (`e2e/screenshots.spec.ts`, light, dark and large text, in `captureAll`, plus the accessibility size test):

- `06-stats` shows "By … last year" and "All of …"; `04-friend` and `05-friend-full` show History before the numbers; `19-meetups` shows names as titles; `20-meetups-search` reads the title "Alex and Sam".
- New `31-friend-no-meetups`: a friend never seen, with the calm line.
- New `ax-19-meetups` and `ax-04-friend`: the Meetups page and a friend's page at 33px (the photo under the text, the back label whole), and `ax-03-log-sheet`: the Who tiles at 33px.
- The dark toast shows in `dark-*` captures that hold a toast (`dark-29-settings-undo-restore`).

Review them by eye on the phone too: Playwright has no status bar, no safe areas and no 17px text.

## Risks and trade-offs

- **Row titles change everywhere.** A row is now found by who was there, not the type; the emoji badge carries the type. Someone used to scanning by type has to look at the badge.
- **Short names in rows** say "Sam" for Sam Chen when no other friend is a Sam. A new friend named Sam makes those rows say "Sam Chen" from then on.
- **The rows still compare with the whole year before** (Top friends, By type, By group), so in October a top friend can look "down" on last year when they aren't. Only the lead and the friend page's "Last year" are fair to the date.
- **`container-type` on every inset group body** adds layout containment to each. Nothing positioned inside reaches out of a group body, and its width never came from its rows, so nothing should change; the e2e suite and the screenshots check it.
- **The pill hides while you search Friends.** Logging takes tapping out of the search first (the keyboard's Search key does that already).
- **"Show all" keeps a friend's page short,** so the 6th meetup and older are a tap away. Its state is kept per history entry, not saved.
- **Who at large text:** the still grid goes three across at the largest standard size, so 8 friends take three rows instead of two.

## Out of scope

- Same-date comparisons in Top friends, By type and By group, and per-month same-date bars.
- A year picker or a range other than calendar years.
- Showing weather or moods in rows, searching moods or dates.
- Changing what "Recent meetups" shows, or the Meetups page's paging.
- Paging a friend's History beyond "Show all".
- Making other strips or chips (Birthdays soon, type chips) wider at large text.
- Hiding the pill for fields inside sheets, or moving it above the keyboard.
- Any schema or backup format change.
