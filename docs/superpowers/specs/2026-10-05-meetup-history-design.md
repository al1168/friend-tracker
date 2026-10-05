# Meetup history (Recent meetups and the Meetups page): design

Date: 2026-10-05. Status: draft, revised after the UX and engineering reviews, for the owner to confirm.

The owner said "I also want to see the recent meetup histories, in case I need to edit or look back at it." Today a meetup can only be found again from one friend's page, under History. This design adds two ways in: a small "Recent meetups" group on the Friends tab, and a "See all meetups" row that opens every meetup on one page. Both reuse the friend page's history row, and every row opens the Meetup page, where Edit and "Edit the day" already do the editing.

## Goal

Make any meetup easy to find again, from the screen the app opens on: the last few at a glance, and all of them, grouped by month and searchable, one tap further. Logging, the Meetup page, The day and the friend page stay exactly as they are.

## Decisions

- **On the Friends tab, after Birthdays soon.** A "Recent meetups" group shows the 3 latest meetups, then a "See all meetups" row. Looking back starts from people, on the tab the app opens to. (Also considered: a fourth "Meetups" tab, rejected because the app is three tabs and a whole tab for a list opened now and then would crowd the thumb row; and a link on Stats, rejected because Stats counts and doesn't remember. Each friend's page keeps its own History.)
- **Recent meetups stays short.** Its rows' subtitles stop at two lines, like a Mail preview, so a long day can't push the friend list off the screen. The full text stays in the row for VoiceOver, and the Meetups page and a friend's History still show it all. If the Friends tab still feels crowded, the owner has two more options (see "If it still feels crowded").
- **Recent means it happened.** Only meetups dated today or earlier, newest first; on the same date, the one logged later comes first, as on the friend page. Upcoming meetups stay on the friend page and at the top of the Meetups page.
- **Recent meetups gets out of the way.** It's hidden while searching or filtering by group (like Birthdays soon, so the list below stays a plain filtered list), when there are no friends (the welcome state shows instead), and when no meetup has happened yet. Hiding it (or Birthdays soon) never moves the search field: the page scrolls by what went away, so the field stays where your eyes are.
- **One meetup row everywhere.** The friend page's history row becomes a shared `MeetupRow`: emoji badge, type (and "Upcoming"), the subtitle (date, "with", activities, the day's snippet) and the first photo's thumbnail. On a friend's page "with" still leaves that friend out; on the Friends tab and the Meetups page there's no friend to leave out, so it names everyone. Under the Meetups page's "Upcoming" title the rows leave out the "Upcoming" badge, because the title already says it.
- **A Meetups page at `/meetups`,** pushed from the Friends tab, with "Friends" on its back button. It belongs to the Friends tab, which already owns every path that starts with `/meetups`.
- **Grouped like the friend page.** "Upcoming" first (soonest first), then one group per month, newest first, titled "October 2026". Inside a month the order comes from the same `groupByMonth` the friend page uses, so the two can never disagree.
- **Search finds memories by their words.** Friend names, the type, activities, the day (places are lines of the day, so they're in it) and How it felt's words for meetups that have happened (How it felt never shows for an upcoming one, so it's never searched there either). Every word typed must be found somewhere in the meetup, so "sam tacos" finds the Meal with Sam where you wrote "Tacos". Case, accents ("cafe" finds "Café") and curly or straight apostrophes don't matter. Weather, moods and dates are never searched: a mood is never a way to list meetups (the No Score Rule), and months are already the groups.
- **Long histories show more when asked.** The page shows 60 rows, then a "Show older meetups" button adds 60 more. Nothing loads as you scroll (the app is not a feed), and only the rows shown read a thumbnail.
- **Coming back keeps your place.** The search, the rows shown and the scroll position survive opening a meetup and going back, so look, edit, back, next works. The app lock starts the page fresh.
- **Nothing is edited on the lists.** A row opens the Meetup page; Edit there opens the Edit meetup sheet and "Edit the day" opens The day, exactly as today. No swipe actions.
- **No data changes.** No schema change, no Dexie version, no backup change. The only new thing kept is an in-memory cache of thumbnails, so going back to a list doesn't read every photo again.

## Friends tab: Recent meetups

`src/screens/FriendsScreen.tsx`. With friends, the body reads top to bottom: the install hint (when shown), Birthdays soon (when shown), **Recent meetups**, the search field and group chips, the friend list, and the "+ Log meetup" pill.

- **The group:** an `InsetGroup` titled "Recent meetups", with no footer.
- **Rows:** `recentMeetups(meetups, today)`, up to 3, each a `MeetupRow` naming everyone on the meetup, with `subtitleLines={2}` and the router state `{ backLabel: 'Friends' }`.
- **The last row:** `<Row to="/meetups" title="See all meetups" accent chevron />`: Terracotta Ink title, no badge, no subtitle. It always shows while the group does, even with fewer than 3 meetups (the Meetups page also holds upcoming meetups and the search). With no leading slot, its hairline starts at the 16px text edge, as the inset group rule already does.
- **Shown when** all hold: there's at least one friend, the trimmed search is blank, no group filter is on, and at least one meetup is dated today or earlier.
- **Data:** the screen already reads `useMeetups()` and `useFriends()`; it adds `useMeetupTypes()` and renders nothing until all have loaded, as it does now for the others. A meetup just logged shows at the top straight away (live queries).
- **Tapping a row** opens the Meetup page, whose back button reads "Friends". Back returns to the Friends tab.

With the owner's example from the debrief design and two older meetups, on Mon, Oct 5. The text column is drawn at its real width on an iPhone 13 (about 190px, about 25 characters of Subhead); the badge, thumbnail and chevron are centered on each row:

```
Recent meetups
 (🍽️)  Meal                       [photo] ›
       Sat, Oct 3 · with Mariya,
       Jessie and Brandon · Mov…
 (☕)  Coffee                              ›
       Wed, Sep 30 · with Kim Park
 (🍻)  Drinks                              ›
       Sat, Sep 12 · with Alex
       Rivera
       See all meetups                     ›
```

### Two lines, like a Mail preview

- `MeetupRow` with `subtitleLines={2}` adds the class `meetup-row--clamp`, whose `.row__subtitle` is `display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden`. WebKit ends the second line with "…".
- The whole subtitle stays in the DOM, so the link's name (what VoiceOver reads) is the full text, as on the friend page.
- It stays two lines at every text size; the row grows taller with the text, as every row does.
- Only Recent meetups clamps. A friend's History and the Meetups page wrap the whole subtitle, as the History does today.

### Keeping the search field still

Safari has no scroll anchoring (`overflow-anchor` isn't supported), and when the field is low on the screen iOS scrolls the page on focus to lift it above the keyboard. Without help, the first letter typed (or a chip tap) would remove Birthdays soon and Recent meetups, about 550-650px above the field, and the field and the first matches would end up above the screen. Clearing the search would push the field the same distance down. So `FriendsScreen` keeps the field still itself:

- `.friends-filters` gets a ref. `unfiltered` is `query.trim() === '' && activeGroup === null`, the part of "Shown when" that the search and the chips change.
- In the search's `onChange` and each chip's `onClick`, when the change flips `unfiltered` (blank to typed, typed to blank, All to a group, a group to All), the handler records `ref.current.getBoundingClientRect().top` before calling the state setter.
- A `useLayoutEffect` keyed on `unfiltered` then measures the top again, calls `window.scrollBy(0, newTop - oldTop)` and forgets the recorded top. It runs before paint, so nothing visibly jumps. The browser clamps the scroll at 0, so near the top of the page the field can move up into view, never away from it.
- Changes that don't flip it (typing more letters, one group to another) do nothing. This also fixes the jump Birthdays soon causes today (about 260px).

### If it still feels crowded

The owner chose 3 rows after Birthdays soon, and this design keeps that. The numbers under "Risks" show that on a day with Birthdays soon at 3 rows the friend list starts below the first screen. If that feels crowded once it's built, either of these can be added without changing anything else:

- **B: two recent rows while Birthdays soon shows.** Recent meetups shows 2 rows on days Birthdays soon is showing, and 3 otherwise. The search field rises by one row (about 60-80px).
- **C: the search field and chips at the top,** just under the large title, as in iOS Contacts. Finding a friend is then never below the fold, and hiding the groups can't move the field (it's above them). The friend list itself still starts below both groups.

## Shared meetup row

New `src/components/MeetupRow.tsx` and `MeetupRow.css`, taken from the friend page's history row with nothing visible changed:

```tsx
interface MeetupRowProps {
  meetup: Meetup
  /** Undefined when the meetup's type was deleted: the row then reads "Meetup" with ✨. */
  type: MeetupType | undefined
  /** The names after "with", in the meetup's order (see meetupNames). */
  names: string[]
  today: ISODate
  /** Router state for the Meetup page: its back label, and the tab it keeps. */
  state: NavState
  /** Stops the subtitle at this many lines (Recent meetups passes 2). Omitted: the whole subtitle wraps. */
  subtitleLines?: number
  /** The "Upcoming" badge on a future date. False under the Meetups page's "Upcoming" title. Default true. */
  showUpcoming?: boolean
  /** Lets the Meetups page move focus to this row (see "Long histories"). */
  ref?: Ref<HTMLAnchorElement>
}
```

- It renders the existing `Row` linking to `/meetups/:id` with `state`; the leading `.emoji-badge` (`aria-hidden`) with the type's emoji, or ✨; the title, the type's name or "Meetup", then a space and the `.upcoming-badge` "Upcoming" when `showUpcoming` and `meetup.date > today`; the subtitle `meetupSubtitle(meetup, names, today)`; the trailing thumbnail; and the chevron.
- **`Row` gains `ref?: Ref<HTMLAnchorElement>`,** set on its `Link` (React 19 passes `ref` as a prop). `MeetupRow` passes its `ref` through. Nothing else about `Row` changes.
- **The thumbnail:** `HistoryThumb` moves into this file as `MeetupThumb`, unchanged: `useFirstPhotoThumb(meetup.id)` (a key-only read of the first photo's id, then that photo's thumbnail, from the cache under "Data" when it's there), shown as `<img className="history-thumb" alt="">`, or nothing without photos. The `.history-thumb` rule moves from `FriendDetailScreen.css` to `MeetupRow.css` under the same class name.
- **The friend page** (`src/screens/FriendDetailScreen.tsx`) uses it with `names={meetupNames(meetup, nameById, friend.id)}` and its existing `fromFriend` state, so the history still leaves out the friend it belongs to, still keeps the tab the page came from, still shows the "Upcoming" badge and still wraps the whole subtitle.

## Meetups page

New `src/screens/MeetupsScreen.tsx` and `MeetupsScreen.css`, routed in `src/App.tsx` with `<Route path="/meetups" element={<MeetupsScreen />} />` next to `/meetups/:id`. It's a `Page` with `title="Meetups"`, `back={{ label: 'Friends', fallback: '/' }}` and `pushed`, so the document title is "Meetups · Friend Tracker", the large title is "Meetups", and opened directly its back button goes to Friends. It reads `useMeetups()`, `useFriends()` and `useMeetupTypes()` and renders nothing until they load.

### Layout and copy

Top to bottom:

1. **Nav bar:** the back button "Friends"; the compact title "Meetups" once the large title scrolls away; no actions.
2. **Large title:** "Meetups".
3. **Search field,** the Friends tab's look: `<label className="search">` with the 18px magnifier and `<input type="search" className="search__input" placeholder="Search" aria-label="Search meetups" enterKeyHint="search">`. Enter hides the keyboard (`isPlainEnter`, then blur). It's left out of the empty state.
4. **Groups,** each an `InsetGroup` of `MeetupRow`s naming everyone, with the router state `{ backLabel: 'Meetups' }`:
   - **"Upcoming":** meetups dated after today, soonest first (on the same date, the one logged first). Their rows pass `showUpcoming={false}`: the group's title already says it, and VoiceOver hears the region name "Upcoming" on entering it.
   - **One group per month** of meetups dated today or earlier, newest month first, titled with `formatMonthYear`: "October 2026", "September 2026", "December 2025". Inside a month: newest date first, then the one logged later.
   - Empty groups never show.
5. **"Show older meetups":** when rows are left to show, a centered `button button--secondary` after the last group (rules under "Long histories").
6. **The "+ Log meetup" pill** (`LogButton`, nothing preselected) whenever there's at least one friend, as on the Friends tab.

The text column is drawn at its real width again; here subtitles wrap in full:

```
‹ Friends
Meetups
[ 🔍 Search                              ]

Upcoming
 (🎉)  Party                               ›
       Wed, Oct 7 · with Maya
       Patel

October 2026
 (🍽️)  Meal                       [photo] ›
       Sat, Oct 3 · with Mariya,
       Jessie and Brandon · Movie,
       Shopping · nonstopstyle,
       strand bookstore, Sammy L
       coffee and 5 more

September 2026
 (☕)  Coffee                              ›
       Wed, Sep 30 · with Kim Park
 (🍻)  Drinks                              ›
       Sat, Sep 12 · with Alex
       Rivera

          ( Show older meetups )
                       ( + Log meetup )
```

**Empty states:**
- **No meetups at all:** the shared `EmptyState` with the title "No meetups yet." and the message "Your first meetup will show up here." (the friend page's History words), with no search field and no button of its own: the "+ Log meetup" pill below is the way to log one. This shows after the last meetup is deleted, or on `/#/meetups` opened directly before any meetup.
- **No search match:** in place of the groups, a `.list-message` paragraph: "No meetups match “zebra”." (the deferred trimmed query between curly quotes, as the Friends search does).

### Search

- **What it looks in,** for each meetup (`meetupSearchText`): the names of everyone on it (all of them, including those a row shortens to "and 2 others"), the type's name ("Meetup" when the type is gone), each activity, the day (the stored note, so every place and every line), and How it felt's words when `feelingsApply(meetup, today)` (dated today or earlier). A meetup moved to a future date keeps its How it felt words stored but hidden, so they aren't searched: a row is never matched by words you can't see anywhere.
- **Never:** weather, mood, dates, photos, or the friend's group.
- **How it matches** (`matchesSearch`): the query and the text are folded the same way (`searchKey`: lowercased, accents and other marks removed, ‘ and ’ made ' and “ and ” made ", runs of spaces and line breaks made one space). The query is split into words, and a meetup matches when every word is found somewhere in its text, inside a word or not: "sam" finds "Samantha", "blue willow" finds "@Blue willow 3:30", and "didn't" finds "didn’t". A blank query matches everything.
- **One query for what shows:** the list filters on `useDeferredValue(query)`, trimmed. The results, the no-match line and the announcement all use that deferred trimmed query, so they never disagree with each other while typing catches up.
- **Results** keep the same groups and order, and the same 60-row limit. The groups, the button and the no-match line follow the query as you type.
- **Fast enough for years of days:** the folded text of every meetup is built in a `useMemo` keyed on meetups, friends, types and today, and only while the deferred trimmed query isn't blank (the memo returns null otherwise). A blank query skips the index and the filtering altogether, so the most common visit, coming back with no search, folds nothing. Typing never waits for the list.
- **What VoiceOver hears:** `<p className="visually-hidden meetups-announcer" aria-live="polite">`, with no role. It must not be `role="status"`: the toast region already is, and toast lookups (`getByRole('status')`, in 43 e2e assertions) would find two. This follows the PIN pad's announcer (`src/lock/PinPad.tsx`). It's mounted whenever the list shows (not in the empty state) and empty while the query is blank. The search's `onChange` restarts a 700ms timer; when typing pauses that long, the region says "1 meetup matches.", "12 meetups match." (every match, not only the rows shown), or "No meetups match “zebra”.". It starts empty, so a search restored on Back is never announced. The visible no-match line isn't a live region, so nothing is read twice. The timer is cleared on unmount.

### Long histories

- The page shows the first 60 rows (`MEETUPS_PAGE_SIZE`), counted in order across the groups: Upcoming first, then the months.
- **"Show older meetups"** (44px, Linen, Warm Ink 600) adds the next 60. It shows only while rows are left, and the label never changes.
- **A new search starts again at 60 rows.** The reset happens in the search input's `onChange`, in the same handler that sets the query, never in an effect on the query: an effect would also run when the page comes back with a restored search and undo the restored row count.
- **Focus** moves to the first row it added, so VoiceOver reads on from there and keyboard focus isn't left on a button that may be gone. The button's handler records the current row count as the pending focus index and raises the count; the row at that index gets a `ref`; an effect keyed on the count calls `ref.current.focus({ preventScroll: true })` and clears the pending index. A restore or a search never sets it, so they never move focus. The new row sits where the button was, so nothing scrolls.
- **No stray ring on touch:** the app draws a 2px `:focus-visible` ring. WebKit shouldn't show it for focus moved by script after a tap, but this is checked in WebKit (the e2e below and by eye). If a tap does paint a ring on row 61, focus moves only when the button itself had focus (`document.activeElement` was the button: a hardware keyboard or Voice Control), and this spec is updated to say so.
- **Thumbnails:** each row shown runs its own `useFirstPhotoThumb`, a key-only index read of its first photo's id. The first time a photo's thumbnail is needed, its photo record is read once (IndexedDB can't read part of a record, so the full image comes with it and is dropped at once); after that the thumbnail comes from the cache under "Data". So 60 rows read at most 60 photo records the first time and none when you come back, and nothing keeps a full image. Rows not shown read nothing.
- The meetups table never holds photos, so reading every meetup for the list stays small; the Friends tab already reads them all.

### Keeping your place

- The search text and the rows shown are kept in memory per history entry (`location.key`), the way `ScrollManager` keeps scroll positions. The map lives in a small `PlaceMemoryProvider` (`src/components/PlaceMemory.tsx`) that `App` renders inside the `HashRouter`, next to `ScrollManager`: it holds `useRef(new Map<string, { query: string; count: number }>())`, and `usePlaceMemory()` hands the map to `MeetupsScreen`.
- `MeetupsScreen` reads its first query and row count from the map in `useState` initializers, and writes to it from the same handlers that change them (the search's `onChange` and "Show older meetups"). Going back to the same entry finds them; a fresh visit from the Friends tab is a new entry and starts blank at 60 rows.
- **The scroll:** `ScrollManager`'s layout effect runs on the key change while `MeetupsScreen` still renders nothing (its three live queries are loading). The rows come back on the first render after the data loads, already at the restored count, and `ScrollManager`'s retry (every frame for up to 1s, stopping early on a touch or wheel) then reaches the saved offset, even past row 60. Thumbnails are a fixed 40px inside rows of at least 52px, so they never shift the page as they arrive. The e2e step "open row 100 and go back" pins this.
- **The app lock starts the page fresh:** `LockGate` unmounts `App` while locked, and the map goes with it, like `ScrollManager`'s positions. (A map at module level would survive: `HashRouter` rebuilds the location from `history.state`, so the entry keeps its key after unlocking, and the old search would come back at the top of the page.) After unlocking, `/#/meetups` shows a blank search and 60 rows. Nothing is stored on the phone.

### From the Meetups page

- **Tapping a row** opens the Meetup page with "Meetups" on its back button. Back returns to the list with its place kept.
- **Edit** there opens the Edit meetup sheet; after Save the row reads the new type, date, friends or activities when you go back (live query).
- **Deleting** the meetup from its sheet goes back one step, as today, so the Meetups page shows without that row; the existing Undo toast brings it back into its group.
- **Logging** from the pill works as on the Friends tab: the toast "Logged with Mariya, Jessie and Brandon" with Undo, and the new meetup shows in its group. "Save and write about the day" opens the new Meetup page with "Back" on its back button, as it does from the Friends tab.

## Meetup page

`src/screens/MeetupScreen.tsx` is unchanged. Its back button already reads `backLabel` from the router state: "Friends" when opened from Recent meetups, "Meetups" from the Meetups page, the friend's name from their history, and "Back" otherwise. A friend chip opened from it still says the meetup type on the friend page's back button.

## Tab bar

`src/components/TabBar.tsx` is unchanged: the Friends tab's `matches` already covers every path that starts with `/meetups`, so it's current on the Meetups page and on a Meetup page opened from it, and the day page rule (`/meetups/<id>/day`) doesn't match `/meetups`. Rows opened from the Friends tab or the Meetups page carry no `tab` in their state, so Friends stays current.

## Data

No stored data changes. No new table, field, index or Dexie version; no backup format change; no new writes. The lists read what's already there: `useMeetups()`, `useFriends()`, `useMeetupTypes()`, and one `useFirstPhotoThumb` per row shown.

### Thumbnail cache (`src/db/meetups.ts`)

`firstPhotoThumb` reads its first photo's id from the `[meetupId+order]` index without loading the row, then calls `db.meetupPhotos.get(id)`, which returns the whole record, full image included. On the friend page that's one friend's rows; on the Meetups page it's 60 or more, again on every return. So:

- A module-level `Map<string, string>` from photo id to thumbnail. `firstPhotoThumb` keeps its index-only read of the first photo's id (so the live query still fires when photos are added, removed or reordered), returns the cached thumbnail for a known id, and calls `get()` only on a miss, caching the result.
- Caching by id is safe: a photo's thumbnail never changes. Updates touch only `order`, and Undo puts back the same ids with the same thumbnails.
- It holds at most 300 thumbnails (the oldest goes first, using the `Map`'s insertion order). `deleteMeetup` and photos removed in an edit drop their ids; a backup restore (`replaceAllData` in `src/backup/storage.ts`) clears it through a new `forgetPhotoThumbs()`.
- The friend page uses the same function, so its History gets the same saving with nothing visible changed.

### Pure logic (`src/stats/meetupHistory.ts`)

It lives in `src/stats`, next to `history.ts` (whose `groupByMonth` it uses) and `recent.ts`, so the dependency keeps running from stats to lib and never the other way. No window, document or Intl of its own (it uses `formatDate` and `formatMonthYear` from `src/lib/dates.ts`, as the rows do today), so it's unit tested in Node with fixed dates.

```ts
/** How many meetups Recent meetups shows on the Friends tab. */
export const RECENT_MEETUPS = 3
/** Rows the Meetups page shows at first, and how many each "Show older meetups" adds. */
export const MEETUPS_PAGE_SIZE = 60

/** The latest meetups dated today or earlier: newest date first, then the one logged later. */
export function recentMeetups(meetups: Meetup[], today: ISODate, limit = RECENT_MEETUPS): Meetup[]

/**
 * The names a row says after "with", in the meetup's order. Ids with no friend are skipped. `leaveOut` is the
 * friend whose page the row is on.
 */
export function meetupNames(meetup: Meetup, nameById: ReadonlyMap<string, string>, leaveOut?: string): string[]

/** A meetup row's subtitle: the date, "with …" (when there are names), the activities, the day's snippet, joined by " · ". */
export function meetupSubtitle(meetup: Meetup, names: string[], today: ISODate): string

/** Text folded for search: lowercased, marks removed, curly quotes made straight, runs of spaces made one. */
export function searchKey(text: string): string

/**
 * Everything the Meetups search looks in, folded: the names, the type's name, activities, the day, and How it
 * felt's words when the meetup has happened (feelingsApply).
 */
export function meetupSearchText(meetup: Meetup, names: string[], typeName: string, today: ISODate): string

/** True when every word of the query is found in `searchText`. A blank query matches everything. */
export function matchesSearch(searchText: string, query: string): boolean

export interface HistorySection {
  /** "upcoming", or the month as YYYY-MM */
  key: string
  /** "Upcoming", or the month as "October 2026" */
  title: string
  meetups: Meetup[]
}

/** The Meetups page's groups: Upcoming (soonest first), then each month, newest first. No empty groups. */
export function historySections(meetups: Meetup[], today: ISODate): HistorySection[]

/** The first `count` rows in order across the groups (groups left empty are dropped), and how many are left. */
export function firstRows(sections: HistorySection[], count: number): { sections: HistorySection[]; more: number }
```

- `meetupSubtitle` is the friend page's subtitle moved here unchanged: `formatDate(meetup.date, today)`, `with ${formatNameList(names)}`, `meetup.activities.join(', ')`, `daySnippet(meetup.note)`, empty parts left out.
- `searchKey` is `text.normalize('NFD')`, marks (`\p{M}`) removed, `toLowerCase()`, the quote swaps, then whitespace runs to one space and trimmed. The query and the text always go through it together, so any script folds the same way on both sides.
- `meetupSearchText` folds each part and joins them with a line break; query words never hold a space, so a word can't match across two parts. It uses `feelingsApply` from `src/lib/moods.ts`.
- `historySections` takes the months from `groupByMonth` in `src/stats/history.ts`, so a month reads in the same order as on the friend page.

## Accessibility

**VoiceOver, the Friends tab:**
- "Recent meetups" is a region named by its heading (an h2, like "Birthdays soon"), so the rotor finds it.
- Each row is one link read as its words, the whole subtitle even where the screen stops at two lines: "Meal, Sat, Oct 3 · with Mariya, Jessie and Brandon · Movie, Shopping · nonstopstyle, strand bookstore, Sammy L coffee and 5 more". The badge's emoji and the thumbnail are hidden (`aria-hidden`, `alt=""`), as on the friend page. (Recent meetups never holds an upcoming meetup.)
- "See all meetups" is a link with that name.
- Typing in the search or picking a chip leaves the field where it was, so VoiceOver and keyboard focus stay on a field that's on screen.

**VoiceOver, the Meetups page:**
- The back button reads "Friends"; the large title is the h1 "Meetups".
- The search is a search field named "Search meetups". Results are announced by the live region above.
- Each group is a region named by its h2 ("Upcoming", "October 2026"), so the rotor jumps from month to month. Rows in "Upcoming" read without the badge ("Party, Wed, Oct 7 · with Maya Patel"); the region's name says it. On a friend's page the same row still reads "Party Upcoming, Wed, Oct 7 · with Maya Patel".
- "Show older meetups" is a button; after it, focus is on the first row it added (see "No stray ring on touch").
- A Meetup page opened from here reads "Meetups" on its back button.

**Targets:** rows are at least 52px; "See all meetups" is a 52px row; "Show older meetups", the search field and the back button are 44px; the pill is 52px.

**Dynamic Type:** everything is in rem and grows. Rows grow taller and their subtitles wrap (the shared row already does), except in Recent meetups, where the subtitle stops at two lines at every size; group titles wrap; "Show older meetups" may wrap onto two centered lines at accessibility sizes and keeps its 44px minimum. The only fixed size is the 40px thumbnail, already an exception.

**Color and themes:** existing pairs only: Warm Ink and Warm Ink Secondary on Paper White for rows, Terracotta Ink for "See all meetups", Warm Ink on Linen for the search and the button, the Peach Wash "Upcoming" badge. No new color, no color as a signal.

**Reduce Motion:** the Meetups page pushes in like a friend's page, and with Reduce Motion it fades, through the existing `page--pushed` rule. Nothing new moves; the Friends tab's scroll correction happens before paint, so it never shows as motion.

**Hardware keyboard and Voice Control:** the tab order follows the page (back, search, rows in order, "Show older meetups", the pill). Enter in the search hides the keyboard. Every control is named by the words it shows.

## DESIGN.md

Add or change:
- **Typography, Large Title:** "the page title on Friends, Stats, Settings, Groups, Meetup types, and Meetups."
- **The Dynamic Type Rule:** "the history thumbnail (40px)" becomes "the meetup row's thumbnail (40px)".
- **Buttons,** new: "**Show more:** a long list ends with a centered secondary button that adds the next rows ("Show older meetups"). Rows never load by themselves as you scroll."
- **Inputs and fields, Search:** add "Friends and Meetups each have one, above their list."
- **"+ Log meetup" pill:** "The thumb-reachable primary action on Friends, friend detail and Meetups."
- **New, Meetup row:** "One row for a meetup, the same everywhere (a friend's History, Recent meetups, the Meetups page): the type's emoji badge, the type as the title (with "Upcoming" for a future date, except under the Meetups page's "Upcoming" title, which already says it), a subtitle of the date, "with" the friends, the activities, and the day's first places ("and 5 more") or its first line cut at 80 characters, then the first photo as a 40px thumbnail with 8px corners, before the chevron. On a friend's page "with" leaves that friend out; everywhere else it names everyone. In Recent meetups the subtitle stops at two lines; elsewhere it wraps in full. Moods, weather and How it felt never show. Tapping it opens the Meetup page."
- **Friend detail column, History:** "rows grouped by month, each a Meetup row naming the others. Tapping a row opens the Meetup page."
- **Birthdays soon:** "at the top of the Friends tab, above Recent meetups and the search field", and add "Hiding it (or Recent meetups) never moves the search field: the page scrolls by what went away."
- **New, Recent meetups:** "An inset group titled "Recent meetups" on the Friends tab, after Birthdays soon and before the search field: the 3 latest meetups dated today or earlier, newest first, as Meetup rows naming everyone, each subtitle stopped at two lines, then "See all meetups", an accent row with a chevron and no badge, which opens the Meetups page. Hidden when no meetup has happened yet, while searching, and while a group filter is on; hiding it never moves the search field."
- **New, Meetups page:** "Every meetup, pushed from Recent meetups: back "Friends", the large title "Meetups", a search field ("Search meetups"), then "Upcoming" (soonest first, its rows without the "Upcoming" badge) and one group per month, newest first ("October 2026"), as Meetup rows naming everyone. The search looks in friend names, the type, activities, the day and, for meetups that have happened, How it felt's words, ignoring case and accents, and every word typed must be found; never weather, moods or dates. It shows 60 rows, then "Show older meetups" adds 60. Going back to it keeps the search, the rows shown and the scroll; the app lock starts it fresh. Empty: "No meetups yet." with "Your first meetup will show up here."; no match: "No meetups match “zebra”." The "+ Log meetup" pill shows whenever there's a friend."
- **Meetup page,** nav bar: "back ("Back", the friend's name from their history, "Friends" from Recent meetups, or "Meetups" from the Meetups page)".
- **Navigation, Tab bar:** "A friend's page, a Meetup page and the Meetups page belong to Friends, unless they were opened from Stats, which then stays current."
- **Do's and Don'ts, "Truncate only where iOS does":** add "a Recent meetups row's subtitle, which stops at two lines like a Mail preview".
- **Don'ts:** "**Don't** load more rows as a list scrolls; a long list ends with a button that shows more."

## Testing

Counts afterwards: unit tests go from 57 files to 58 (the new `src/stats/meetupHistory.test.ts`; the cache cases join `src/db/meetups.test.ts`), with the cases below added to today's 676. E2E goes from 158 to 171 (13 tests in the new `e2e/history.spec.ts`, one per bullet below). Screenshots stay at 15 tests and gain 9 PNGs: light, dark and large-text versions of `02-friends-full`, `19-meetups` and `20-meetups-search`.

**Unit tests** (`src/stats/meetupHistory.test.ts`, with today fixed at Mon, Oct 5, 2026 and the shared `meetup()` fixture):
- `recentMeetups`: two meetups today (logged at 10:00 and 18:00), one on Oct 1, one on Sep 20 and one tomorrow give the 18:00 one, the 10:00 one, then Oct 1; tomorrow's never shows; fewer than 3 gives what there is; only future meetups give `[]`; the limit can be changed.
- `meetupNames`: the meetup's order; an unknown id is skipped; `leaveOut` drops just that friend.
- `meetupSubtitle`, exact strings:
  - the owner's example (Oct 3, Mariya, Jessie and Brandon, Movie and Shopping, `OWNER_DAY_TYPED`): "Sat, Oct 3 · with Mariya, Jessie and Brandon · Movie, Shopping · nonstopstyle, strand bookstore, Sammy L coffee and 5 more";
  - with no names and the note "Tacos": "Sat, Oct 3 · Tacos";
  - a date in another year with Sam: "Fri, Sep 12, 2025 · with Sam";
  - four names: "with Alex, Sam and 2 others".
- `searchKey`: "Crème Brûlée" gives "creme brulee"; "didn’t" gives "didn't"; "  Blue\n\nwillow " gives "blue willow".
- `matchesSearch` with `meetupSearchText`:
  - a friend's name in any case ("MARIYA");
  - a name a row shortens to "and 2 others";
  - the type's name, and "Meetup" for a meetup whose type is gone;
  - an activity ("karaoke");
  - a place with its "@" ("blue willow" in "@Blue willow 3:30") and a plain line of the day;
  - How it felt's words ("outsidery") on a meetup dated today; the same meetup dated tomorrow, its stored feelings unchanged, doesn't match "outsidery";
  - "cafe" finds "Café", "didn't" finds "didn’t" and "didn’t" finds "didn't";
  - "jessie coffee" finds a Coffee with Jessie and not a Meal with Jessie whose day is "Tacos" (an explicit note with no "coffee"); the owner's Meal with Jessie (`OWNER_DAY_TYPED`) does match "jessie coffee", through its place "@Sammy L coffee";
  - weather alone ("rainy" with `weather: ['rainy']` and no such word written), a mood alone ("okay" with `mood: 'okay'`) and a date ("oct") don't match;
  - a blank or spaces-only query matches everything.
- `historySections`: Oct 9, Oct 7 (two, logged in order), Oct 5, Sep 30 and Dec 24, 2025 give "Upcoming" (Oct 7 logged first, Oct 7 logged second, Oct 9), "October 2026" (Oct 5: today isn't upcoming), "September 2026" and "December 2025"; no meetups gives `[]`; only future meetups give just "Upcoming".
- `firstRows`: 70 meetups across groups give the first 60 in order and `more: 10`; a cut at a group's end drops the groups after it; a count past the total gives everything and `more: 0`.

**Unit tests, the thumbnail cache** (`src/db/meetups.test.ts`, fake-indexeddb): a second `firstPhotoThumb` for the same meetup doesn't call `db.meetupPhotos.get` (a `vi.spyOn`); after the photos are reordered it returns the new first photo's thumbnail; after `forgetPhotoThumbs()` it reads again; a meetup without photos still gives null.

**E2E** (WebKit, iPhone 13), new `e2e/history.spec.ts`, with `page.clock` set to Mon, Oct 5, 2026, 12:00 PM where dates matter:
- **Recent meetups shows the three latest that happened, naming everyone:** with a Coffee with Alex on Sep 25, a Meal with Alex and Sam ("Tacos") on Oct 3, Drinks with Kim on Oct 4, a Call with Sam on Sep 5 and a Party with Kim on Oct 8, the "Recent meetups" region's links are, in order, Drinks, Meal ("Sat, Oct 3 · with Alex and Sam · Tacos"), Coffee, then "See all meetups"; there's no Party and no Call.
- **Two lines in Recent meetups:** with the owner's example logged (three friends, Movie and Shopping, the owner's typed day), its subtitle in Recent meetups is no taller than two of its lines (its height is at most twice its computed line height, plus 1px) and the link's accessible name still holds the whole subtitle; the same row on the Meetups page is taller than two lines.
- **It hides and comes back:** with only the upcoming Party it's hidden; after logging a past one it shows; typing in "Search friends" hides it and clearing shows it; a group filter hides it and "All" shows it.
- **The search field stays put:** with Birthdays soon (a friend whose birthday is in 3 days), Recent meetups, a group, and 12 friends whose names hold an "a", scroll so the search field's top is just under the nav bar; fill "a": the field's top stays within 4px of where it was and the first friend row is in view; clear it: the same. Tapping the group's chip and then "All" keeps the chip row within 4px each time.
- **A recent meetup opens its page with "Friends" on the back button,** and Back lands on the Friends tab.
- **See all opens Meetups:** with the meetups above plus a Trip with Sam on Dec 24, 2025: the h1 "Meetups", the back button "Friends", the Friends tab `aria-current="page"`, and the regions in order "Upcoming", "October 2026", "September 2026", "December 2025", each with its rows in order (Upcoming soonest first). The Party row under "Upcoming" has no "Upcoming" badge (its name doesn't contain "Upcoming"); on Kim's page the same Party still shows it.
- **Search:** "alex", "MEAL", "karaoke", a place, a word of the day, a word of How it felt, "didn't" against a day written with "didn’t", and "sam tacos" each show just the meetups expected; "zebra" shows "No meetups match “zebra”." and `page.locator('.meetups-announcer')` reaches the same text (`toHaveText` waits past the 700ms); "rainy", picked as weather only, matches nothing; clearing brings every group back. Toast assertions on this page keep using `getByRole('status')`.
- **Opening from Meetups and coming back:** search "tacos", open the Meal: its back button reads "Meetups"; Edit, change the type to Drinks, Save; Back: the search still reads "tacos", the row is now Drinks, and the announcer is empty (a restored search isn't announced).
- **Delete and Undo from Meetups:** delete a meetup from its Edit sheet; the page goes back to Meetups without that row; Undo puts it back in its month.
- **Long histories:** 130 past meetups (one with a photo) seeded with `seedMeetups`, then a reload: 60 rows and "Show older meetups"; a tap on it shows 120 and no element matches `:focus-visible`; focusing the button and pressing Enter shows 130, focus is on row 121, and the button is gone; the meetup with a photo shows its `img.history-thumb`; open row 100 and go back: 130 rows still show and row 100 is in view.
- **The app lock starts the page fresh:** with the lock on (`seedAppLock`) and 130 seeded meetups, on Meetups type "coffee" (every meetup is a Coffee, so 60 rows show) and tap "Show older meetups" (120 rows); lock the app the way `lock.spec.ts` does in the background (hidden, 16 minutes, visible) and unlock with the PIN: `/#/meetups` shows a blank search, 60 rows and "Show older meetups".
- **Empty:** `/#/meetups` with one friend and no meetups shows "No meetups yet." and "Your first meetup will show up here.", no search field, and the "+ Log meetup" pill; logging from it shows the meetup under "October 2026".
- **The friend page still leaves its friend out:** the same Meal reads "with Sam" in Alex's History and "with Alex and Sam" on the Friends tab.

**The `seedMeetups(page, { friends, meetups, photos })` helper** (`e2e/helpers.ts`): called after the first `page.goto`, so the version 3 stores exist, then a reload. It writes in one readwrite transaction, as `putSetting` does, and skips the app's checks, so every row is complete: friends are full `Friend` rows; meetups use the default type ids (`'type-coffee'`, `'type-meal'` and so on) with every field (`note`, `activities`, `weather: []`, `mood: null`, `feelings: ''`, `createdAt`), dated in the past (or under `page.clock.setFixedTime`); a photo is `{ id, meetupId, order: 0, full, thumb, width, height, createdAt }`, with `thumb` (and `full`) a valid `data:image/png;base64,${ONE_PIXEL_PNG}`.

**Updated tests.** Rows in Recent meetups name friends ("with Alex and Sam"), so a test that finds a friend on the Friends tab with a loose name pattern after logging a meetup now also finds a meetup row. A new `friendLink(page, name)` helper in `e2e/helpers.ts` returns `page.getByRole('link', { name: new RegExp('^' + escapeRegExp(name)) })`, with the name escaped (`name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`): a friend row's name starts with the friend's name (the avatar is hidden), while a meetup row's starts with its type. Tests that already pick `.last()` for a name also in Birthdays soon keep it. The tests that break, and must change:
- `openFriendPage` in `e2e/helpers.ts`, and so every spec that uses it (`day`, `dayKeyboard`, `meetupPage`, `memories`);
- `detail.spec.ts` (each `getByRole('link', { name: /Alex/ })` on the Friends tab);
- `meetups.spec.ts` lines 11-13, 21 and 38 (to `friendLink`), and line 57, "sorts friends by most seen this year", whose `page.locator('.row__title')` would now read Coffee, See all meetups, Amy, Zoe: it scopes to the friend rows with `page.getByRole('link', { name: /^(Amy|Zoe)/ }).locator('.row__title')`;
- `settings.spec.ts:77` (it logs before the export);
- `screenshots.spec.ts:66` and `:154`.

`friends.spec.ts`, `birthdays.spec.ts` and `preferences.spec.ts` never log a meetup, so they don't break; moving them to `friendLink` is optional, for consistency. `detail.spec.ts` keeps finding `img.history-thumb` in History.

**Screenshots** (`e2e/screenshots.spec.ts`, in light, dark and large text, inside `captureAll`, so the test count stays 15):
- The seed adds an upcoming Party with Maya Patel in 2 days (Stats and the friend pages captured don't change; future meetups aren't counted).
- `02-friends` now shows Recent meetups under Birthdays soon.
- New `02-friends-full`: the Friends tab, full page, right after `02-friends`, to see where the search field and the friend list land.
- New `19-meetups`: the Meetups page, full page, after the owner's example is logged (Upcoming, then the months).
- New `20-meetups-search`: the Meetups page searched for "ramen".
- `04-friend` and `05-friend-full` look the same as before (the shared row).

Nothing compares images: review them by eye, `large-text-02-friends` and `02-friends-full` especially (how far down the friend list starts).

## Risks and trade-offs

- **The friend list starts lower on the Friends tab.** Measured on `e2e/screenshots/light-02-friends.png` (iPhone 13, default text size): Birthdays soon (3 rows) ends at about 302px, the search field sits at 326-370px and the first friend row starts near 442px. A meetup row's text column is only about 190px (16px padding, the 44px badge, 12px gaps, the 40px thumbnail, the chevron), about 25 characters of 15px Subhead, so subtitles wrap far more than a wide mock suggests: the owner's example wraps to about 5 lines (a row about 140px tall), and the screenshot seed's Meal to about 4. Unclamped, Recent meetups would add about 320-370px with the seed, and 500px or more with three long days. With subtitles stopped at two lines, a row is about 61px (one line) or 81px (two), so the group (title, 3 rows, "See all meetups" and the 24px gap) adds about 285-345px, about 325px for the mock above:
  - **With Birthdays soon at 3 rows,** the search field sits at about 610-670px and the first friend row at about 730-790px: on first open no friend row shows, in Safari (a 664px viewport) or on the Home Screen (about 760px of content).
  - **Without Birthdays soon (most days),** the search field sits at about 385-445px and the first friend row at about 500-560px: one or two friends show in Safari, two or three on the Home Screen, under the floating "+ Log meetup" pill.
  - **At large text sizes** the friend list is about two screens down.
  This works against PRODUCT.md's "opening the app tells you when you last saw anyone without digging". Options B and C under "If it still feels crowded" are ready if the owner finds it so; the `02-friends-full` and `large-text-02-friends` captures show it.
- **Hiding the groups moves content above the search field.** Typing a letter or picking a chip removes up to about 550-650px above the field. The scroll correction under "Keeping the search field still" keeps the field in place; without it, the field would end up above the screen or jump.
- **A row found by a name it doesn't show:** with four or more friends the row says "and 2 others", and a match deep in the day or in How it felt isn't shown in the row (rows never show How it felt). The meetup still matched; opening it shows why. (How it felt words of a meetup moved to a future date are hidden and never searched.)
- **Thumbnails read whole photo records once.** IndexedDB can't read part of a record, so the first time a row with a photo shows, its full image (a JPEG up to 1600px, often several hundred KB) is read and dropped. The cache keeps the thumbnail, so coming back to the list reads only the indexes, and "Show older meetups" bounds a first visit to 60 new records at a time. Avoiding even that first read would need a separate thumbnail table (a schema change), which this design doesn't make.
- **Many live queries:** one key-only index read per row shown, 60 at a time, so even long histories never start hundreds at once.
- **Search reads every day:** the folded text is built only while there's a search, once per data change, and filtering is deferred, so typing stays smooth at hundreds of days of up to 10,000 characters.

## Out of scope

- A Meetups tab, or links from Stats or Settings.
- Filters (by friend, type, activity or group), sorting choices, or a jump-to-month scrubber.
- Searching weather, moods (the No Score Rule), dates, photos or groups; showing or highlighting where a search matched.
- Editing, deleting or swiping on the lists; selecting several meetups.
- Upcoming meetups in Recent meetups, or more than 3 there; a count on "See all meetups".
- Loading rows as you scroll, or saving the search between visits or across the app lock.
- Making the Friends search find meetups.
- Any change to logging, the Meetup page, The day, the friend page, the data or backups.

## Changes after review

- **Recent meetups stays short:** subtitles stop at two lines (`subtitleLines`), the mocks are drawn at the real column width, and Risks gives the measured positions, with options B and C for the owner.
- **The search field stays still** when Birthdays soon and Recent meetups hide or come back (a scroll correction before paint), with an e2e test.
- **The Upcoming group's rows drop the "Upcoming" badge** (`showUpcoming`); the friend page keeps it.
- **Search skips the hidden How it felt words** of future-dated meetups (`meetupSearchText` takes `today`), and only builds its index while there's a search.
- **Keeping your place** lives in a `PlaceMemoryProvider` inside `App`, so the app lock really starts the page fresh (with an e2e test); the row count resets only in the search's `onChange`; the ScrollManager wording is corrected.
- **Focus after "Show older meetups"** goes through a `ref` on `Row`, with `preventScroll`, and a check for a stray focus ring on touch.
- **The live region** has no role (`.meetups-announcer`), so toast lookups still find one `status`; it uses the deferred query and never announces a restored search.
- **Thumbnails:** the claim "never a full image" is corrected, and a capped in-memory cache by photo id stops repeat reads.
- **Tests:** the exact list of e2e files that break (including `meetups.spec.ts:57`), an escaped `friendLink`, the `seedMeetups` row shapes, the corrected "jessie coffee" case, and the expected counts.
- **The pure logic moves to `src/stats/meetupHistory.ts`,** so lib never imports from stats.
