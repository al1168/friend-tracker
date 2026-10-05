# Meetup history (Recent meetups and the Meetups page): design

Date: 2026-10-05. Status: draft, for the owner to confirm.

The owner said "I also want to see the recent meetup histories, in case I need to edit or look back at it." Today a meetup can only be found again from one friend's page, under History. This design adds two ways in: a small "Recent meetups" group on the Friends tab, and a "See all meetups" row that opens every meetup on one page. Both reuse the friend page's history row, and every row opens the Meetup page, where Edit and "Edit the day" already do the editing.

## Goal

Make any meetup easy to find again, from the screen the app opens on: the last few at a glance, and all of them, grouped by month and searchable, one tap further. Logging, the Meetup page, The day and the friend page stay exactly as they are.

## Decisions

- **On the Friends tab, after Birthdays soon.** A "Recent meetups" group shows the 3 latest meetups, then a "See all meetups" row. Looking back starts from people, on the tab the app opens to. (Also considered: a fourth "Meetups" tab, rejected because the app is three tabs and a whole tab for a list opened now and then would crowd the thumb row; and a link on Stats, rejected because Stats counts and doesn't remember. Each friend's page keeps its own History.)
- **Recent means it happened.** Only meetups dated today or earlier, newest first; on the same date, the one logged later comes first, as on the friend page. Upcoming meetups stay on the friend page and at the top of the Meetups page.
- **Recent meetups gets out of the way.** It's hidden while searching or filtering by group (like Birthdays soon, so the list below stays a plain filtered list), when there are no friends (the welcome state shows instead), and when no meetup has happened yet.
- **One meetup row everywhere.** The friend page's history row becomes a shared `MeetupRow`: emoji badge, type (and "Upcoming"), the subtitle (date, "with", activities, the day's snippet) and the first photo's thumbnail. On a friend's page "with" still leaves that friend out; on the Friends tab and the Meetups page there's no friend to leave out, so it names everyone.
- **A Meetups page at `/meetups`,** pushed from the Friends tab, with "Friends" on its back button. It belongs to the Friends tab, which already owns every path that starts with `/meetups`.
- **Grouped like the friend page.** "Upcoming" first (soonest first), then one group per month, newest first, titled "October 2026". Inside a month the order comes from the same `groupByMonth` the friend page uses, so the two can never disagree.
- **Search finds memories by their words.** Friend names, the type, activities, the day (places are lines of the day, so they're in it) and How it felt's words. Every word typed must be found somewhere in the meetup, so "jessie coffee" finds coffees with Jessie. Case, accents ("cafe" finds "Café") and curly or straight apostrophes don't matter. Weather, moods and dates are never searched: a mood is never a way to list meetups (the No Score Rule), and months are already the groups.
- **Long histories show more when asked.** The page shows 60 rows, then a "Show older meetups" button adds 60 more. Nothing loads as you scroll (the app is not a feed), and only the rows shown read a thumbnail, through the existing key-only query.
- **Coming back keeps your place.** The search, the rows shown and the scroll position survive opening a meetup and going back, so look, edit, back, next works.
- **Nothing is edited on the lists.** A row opens the Meetup page; Edit there opens the Edit meetup sheet and "Edit the day" opens The day, exactly as today. No swipe actions.
- **No data changes.** No schema change, no Dexie version, no backup change.

## Friends tab: Recent meetups

`src/screens/FriendsScreen.tsx`. With friends, the body reads top to bottom: the install hint (when shown), Birthdays soon (when shown), **Recent meetups**, the search field and group chips, the friend list, and the "+ Log meetup" pill.

- **The group:** an `InsetGroup` titled "Recent meetups", with no footer.
- **Rows:** `recentMeetups(meetups, today)`, up to 3, each a `MeetupRow` naming everyone on the meetup, with the router state `{ backLabel: 'Friends' }`.
- **The last row:** `<Row to="/meetups" title="See all meetups" accent chevron />`: Terracotta Ink title, no badge, no subtitle. It always shows while the group does, even with fewer than 3 meetups (the Meetups page also holds upcoming meetups and the search). With no leading slot, its hairline starts at the 16px text edge, as the inset group rule already does.
- **Shown when** all hold: there's at least one friend, the trimmed search is blank, no group filter is on, and at least one meetup is dated today or earlier.
- **Data:** the screen already reads `useMeetups()` and `useFriends()`; it adds `useMeetupTypes()` and renders nothing until all have loaded, as it does now for the others. A meetup just logged shows at the top straight away (live queries).
- **Tapping a row** opens the Meetup page, whose back button reads "Friends". Back returns to the Friends tab.

With the owner's example from the debrief design and two older meetups, on Mon, Oct 5:

```
Recent meetups
 (🍽️)  Meal                                          [photo]  ›
       Sat, Oct 3 · with Mariya, Jessie and Brandon · Movie,
       Shopping · nonstopstyle, strand bookstore, Sammy L
       coffee and 5 more
 (☕)  Coffee                                                  ›
       Wed, Sep 30 · with Kim Park
 (🍻)  Drinks                                                  ›
       Sat, Sep 12 · with Alex Rivera
       See all meetups                                         ›
```

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
}
```

- It renders the existing `Row` linking to `/meetups/:id` with `state`; the leading `.emoji-badge` (`aria-hidden`) with the type's emoji, or ✨; the title, the type's name or "Meetup", then a space and the `.upcoming-badge` "Upcoming" when `meetup.date > today`; the subtitle `meetupSubtitle(meetup, names, today)`; the trailing thumbnail; and the chevron.
- **The thumbnail:** `HistoryThumb` moves into this file as `MeetupThumb`, unchanged: `useFirstPhotoThumb(meetup.id)` (a key-only read of the first photo's id, then that one row's thumbnail), shown as `<img className="history-thumb" alt="">`, or nothing without photos. The `.history-thumb` rule moves from `FriendDetailScreen.css` to `MeetupRow.css` under the same class name.
- **The friend page** (`src/screens/FriendDetailScreen.tsx`) uses it with `names={meetupNames(meetup, nameById, friend.id)}` and its existing `fromFriend` state, so the history still leaves out the friend it belongs to and still keeps the tab the page came from.

## Meetups page

New `src/screens/MeetupsScreen.tsx` and `MeetupsScreen.css`, routed in `src/App.tsx` with `<Route path="/meetups" element={<MeetupsScreen />} />` next to `/meetups/:id`. It's a `Page` with `title="Meetups"`, `back={{ label: 'Friends', fallback: '/' }}` and `pushed`, so the document title is "Meetups · Friend Tracker", the large title is "Meetups", and opened directly its back button goes to Friends. It reads `useMeetups()`, `useFriends()` and `useMeetupTypes()` and renders nothing until they load.

### Layout and copy

Top to bottom:

1. **Nav bar:** the back button "Friends"; the compact title "Meetups" once the large title scrolls away; no actions.
2. **Large title:** "Meetups".
3. **Search field,** the Friends tab's look: `<label className="search">` with the 18px magnifier and `<input type="search" className="search__input" placeholder="Search" aria-label="Search meetups" enterKeyHint="search">`. Enter hides the keyboard (`isPlainEnter`, then blur). It's left out of the empty state.
4. **Groups,** each an `InsetGroup` of `MeetupRow`s naming everyone, with the router state `{ backLabel: 'Meetups' }`:
   - **"Upcoming":** meetups dated after today, soonest first (on the same date, the one logged first). Their rows also carry the "Upcoming" badge, as the shared row does everywhere.
   - **One group per month** of meetups dated today or earlier, newest month first, titled with `formatMonthYear`: "October 2026", "September 2026", "December 2025". Inside a month: newest date first, then the one logged later.
   - Empty groups never show.
5. **"Show older meetups":** when rows are left to show, a centered `button button--secondary` after the last group (rules under "Long histories").
6. **The "+ Log meetup" pill** (`LogButton`, nothing preselected) whenever there's at least one friend, as on the Friends tab.

```
‹ Friends
Meetups
[ 🔍 Search                                          ]

Upcoming
 (🎉)  Party Upcoming                                          ›
       Wed, Oct 7 · with Maya Patel

October 2026
 (🍽️)  Meal                                          [photo]  ›
       Sat, Oct 3 · with Mariya, Jessie and Brandon · Movie,
       Shopping · nonstopstyle, strand bookstore, Sammy L
       coffee and 5 more

September 2026
 (☕)  Coffee                                                  ›
       Wed, Sep 30 · with Kim Park
 (🍻)  Drinks                                                  ›
       Sat, Sep 12 · with Alex Rivera

                   ( Show older meetups )
                                         ( + Log meetup )
```

**Empty states:**
- **No meetups at all:** the shared `EmptyState` with the title "No meetups yet." and the message "Your first meetup will show up here." (the friend page's History words), with no search field and no button of its own: the "+ Log meetup" pill below is the way to log one. This shows after the last meetup is deleted, or on `/#/meetups` opened directly before any meetup.
- **No search match:** in place of the groups, a `.list-message` paragraph: "No meetups match “zebra”." (the trimmed query between curly quotes, as the Friends search does).

### Search

- **What it looks in,** for each meetup (`meetupSearchText`): the names of everyone on it (all of them, including those a row shortens to "and 2 others"), the type's name ("Meetup" when the type is gone), each activity, the day (the stored note, so every place and every line), and How it felt's words.
- **Never:** weather, mood, dates, photos, or the friend's group.
- **How it matches** (`matchesSearch`): the query and the text are folded the same way (`searchKey`: lowercased, accents and other marks removed, ‘ and ’ made ' and “ and ” made ", runs of spaces and line breaks made one space). The query is split into words, and a meetup matches when every word is found somewhere in its text, inside a word or not: "sam" finds "Samantha", "blue willow" finds "@Blue willow 3:30", and "didn't" finds "didn’t". A blank query matches everything.
- **Results** keep the same groups and order, and the same 60-row limit. The groups, the button and the no-match line follow the query as you type.
- **Fast enough for years of days:** each meetup's folded text is built once per change of meetups, friends or types (`useMemo`), not per keystroke, and the list filters on `useDeferredValue(query)` so typing never waits for the list.
- **What VoiceOver hears:** a visually hidden polite live region, updated once typing pauses for 700ms and only while the query isn't blank: "1 meetup matches.", "12 meetups match." (every match, not only the rows shown), or "No meetups match “zebra”.". It's empty while the query is blank. The visible no-match line isn't a live region, so nothing is read twice.

### Long histories

- The page shows the first 60 rows (`MEETUPS_PAGE_SIZE`), counted in order across the groups: Upcoming first, then the months.
- **"Show older meetups"** (44px, Linen, Warm Ink 600) adds the next 60. It shows only while rows are left, and the label never changes.
- **Focus** moves to the first row it added, so VoiceOver reads on from there and keyboard focus isn't left on a button that may be gone.
- A new search starts again at 60 rows.
- **Thumbnails:** each row shown runs its own `useFirstPhotoThumb` (a key-only read, then one thumbnail), so 60 rows read at most 60 thumbnails and never a full image. Rows not shown read nothing.
- The meetups table never holds photos, so reading every meetup for the list stays small; the Friends tab already reads them all.

### Keeping your place

- The search text and the rows shown are kept in a small in-memory map in `MeetupsScreen.tsx`, keyed by the history entry (`location.key`), the way `ScrollManager` keeps scroll positions. Going back to the same entry finds them; a fresh visit from the Friends tab is a new entry and starts blank at 60 rows.
- Because the rows are back before `ScrollManager` restores the scroll, it lands where you were, even past row 60.
- Nothing is stored on the phone, and the app lock (which mounts the app again) starts the page fresh.

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

None. No new table, field, index or Dexie version; no backup format change; no new writes. The lists read what's already there: `useMeetups()`, `useFriends()`, `useMeetupTypes()`, and one `useFirstPhotoThumb` per row shown.

### Pure logic (`src/lib/meetupHistory.ts`)

No window, document or Intl of its own (it uses `formatDate` and `formatMonthYear` from `src/lib/dates.ts`, as the rows do today), so it's unit tested in Node with fixed dates.

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

/** Everything the Meetups search looks in, folded: the names, the type's name, activities, the day and How it felt. */
export function meetupSearchText(meetup: Meetup, names: string[], typeName: string): string

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
- `meetupSearchText` folds each part and joins them with a line break; query words never hold a space, so a word can't match across two parts.
- `historySections` takes the months from `groupByMonth` in `src/stats/history.ts` (which imports only types), so a month reads in the same order as on the friend page.

## Accessibility

**VoiceOver, the Friends tab:**
- "Recent meetups" is a region named by its heading (an h2, like "Birthdays soon"), so the rotor finds it.
- Each row is one link read as its words: "Meal, Sat, Oct 3 · with Mariya, Jessie and Brandon · Movie, Shopping · nonstopstyle, strand bookstore, Sammy L coffee and 5 more". A future one reads "Party Upcoming, Wed, Oct 7 · with Maya Patel". The badge's emoji and the thumbnail are hidden (`aria-hidden`, `alt=""`), as on the friend page.
- "See all meetups" is a link with that name.

**VoiceOver, the Meetups page:**
- The back button reads "Friends"; the large title is the h1 "Meetups".
- The search is a search field named "Search meetups". Results are announced by the live region above.
- Each group is a region named by its h2 ("Upcoming", "October 2026"), so the rotor jumps from month to month.
- "Show older meetups" is a button; after it, focus is on the first row it added.
- A Meetup page opened from here reads "Meetups" on its back button.

**Targets:** rows are at least 52px; "See all meetups" is a 52px row; "Show older meetups", the search field and the back button are 44px; the pill is 52px.

**Dynamic Type:** everything is in rem and grows. Rows grow taller and their subtitles wrap (the shared row already does); group titles wrap; "Show older meetups" may wrap onto two centered lines at accessibility sizes and keeps its 44px minimum. The only fixed size is the 40px thumbnail, already an exception.

**Color and themes:** existing pairs only: Warm Ink and Warm Ink Secondary on Paper White for rows, Terracotta Ink for "See all meetups", Warm Ink on Linen for the search and the button, the Peach Wash "Upcoming" badge. No new color, no color as a signal.

**Reduce Motion:** the Meetups page pushes in like a friend's page, and with Reduce Motion it fades, through the existing `page--pushed` rule. Nothing new moves.

**Hardware keyboard and Voice Control:** the tab order follows the page (back, search, rows in order, "Show older meetups", the pill). Enter in the search hides the keyboard. Every control is named by the words it shows.

## DESIGN.md

Add or change:
- **Typography, Large Title:** "the page title on Friends, Stats, Settings, Groups, Meetup types, and Meetups."
- **The Dynamic Type Rule:** "the history thumbnail (40px)" becomes "the meetup row's thumbnail (40px)".
- **Buttons,** new: "**Show more:** a long list ends with a centered secondary button that adds the next rows ("Show older meetups"). Rows never load by themselves as you scroll."
- **Inputs and fields, Search:** add "Friends and Meetups each have one, above their list."
- **"+ Log meetup" pill:** "The thumb-reachable primary action on Friends, friend detail and Meetups."
- **New, Meetup row:** "One row for a meetup, the same everywhere (a friend's History, Recent meetups, the Meetups page): the type's emoji badge, the type as the title (with "Upcoming" for a future date), a subtitle of the date, "with" the friends, the activities, and the day's first places ("and 5 more") or its first line cut at 80 characters, then the first photo as a 40px thumbnail with 8px corners, before the chevron. On a friend's page "with" leaves that friend out; everywhere else it names everyone. Moods, weather and How it felt never show. Tapping it opens the Meetup page."
- **Friend detail column, History:** "rows grouped by month, each a Meetup row naming the others. Tapping a row opens the Meetup page."
- **Birthdays soon:** "at the top of the Friends tab, above Recent meetups and the search field".
- **New, Recent meetups:** "An inset group titled "Recent meetups" on the Friends tab, after Birthdays soon and before the search field: the 3 latest meetups dated today or earlier, newest first, as Meetup rows naming everyone, then "See all meetups", an accent row with a chevron and no badge, which opens the Meetups page. Hidden when no meetup has happened yet, while searching, and while a group filter is on."
- **New, Meetups page:** "Every meetup, pushed from Recent meetups: back "Friends", the large title "Meetups", a search field ("Search meetups"), then "Upcoming" (soonest first) and one group per month, newest first ("October 2026"), as Meetup rows naming everyone. The search looks in friend names, the type, activities, the day and How it felt's words, ignoring case and accents, and every word typed must be found; never weather, moods or dates. It shows 60 rows, then "Show older meetups" adds 60. Going back to it keeps the search, the rows shown and the scroll. Empty: "No meetups yet." with "Your first meetup will show up here."; no match: "No meetups match “zebra”." The "+ Log meetup" pill shows whenever there's a friend."
- **Meetup page,** nav bar: "back ("Back", the friend's name from their history, "Friends" from Recent meetups, or "Meetups" from the Meetups page)".
- **Navigation, Tab bar:** "A friend's page, a Meetup page and the Meetups page belong to Friends, unless they were opened from Stats, which then stays current."
- **Don'ts:** "**Don't** load more rows as a list scrolls; a long list ends with a button that shows more."

## Testing

**Unit tests** (`src/lib/meetupHistory.test.ts`, with today fixed at Mon, Oct 5, 2026 and the shared `meetup()` fixture):
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
  - How it felt's words ("outsidery");
  - "cafe" finds "Café", "didn't" finds "didn’t" and "didn’t" finds "didn't";
  - "jessie coffee" finds a Coffee with Jessie and not a Meal with Jessie;
  - weather alone ("rainy" with `weather: ['rainy']` and no such word written), a mood alone ("okay" with `mood: 'okay'`) and a date ("oct") don't match;
  - a blank or spaces-only query matches everything.
- `historySections`: Oct 9, Oct 7 (two, logged in order), Oct 5, Sep 30 and Dec 24, 2025 give "Upcoming" (Oct 7 logged first, Oct 7 logged second, Oct 9), "October 2026" (Oct 5: today isn't upcoming), "September 2026" and "December 2025"; no meetups gives `[]`; only future meetups give just "Upcoming".
- `firstRows`: 70 meetups across groups give the first 60 in order and `more: 10`; a cut at a group's end drops the groups after it; a count past the total gives everything and `more: 0`.

**E2E** (WebKit, iPhone 13), new `e2e/history.spec.ts`, with `page.clock` set to Mon, Oct 5, 2026, 12:00 PM where dates matter:
- **Recent meetups shows the three latest that happened, naming everyone:** with a Coffee with Alex on Sep 25, a Meal with Alex and Sam ("Tacos") on Oct 3, Drinks with Kim on Oct 4, a Call with Sam on Sep 5 and a Party with Kim on Oct 8, the "Recent meetups" region's links are, in order, Drinks, Meal ("Sat, Oct 3 · with Alex and Sam · Tacos"), Coffee, then "See all meetups"; there's no Party and no Call.
- **It hides and comes back:** with only the upcoming Party it's hidden; after logging a past one it shows; typing in "Search friends" hides it and clearing shows it; a group filter hides it and "All" shows it.
- **A recent meetup opens its page with "Friends" on the back button,** and Back lands on the Friends tab.
- **See all opens Meetups:** with the meetups above plus a Trip with Sam on Dec 24, 2025: the h1 "Meetups", the back button "Friends", the Friends tab `aria-current="page"`, and the regions in order "Upcoming", "October 2026", "September 2026", "December 2025", each with its rows in order (Upcoming soonest first).
- **Search:** "alex", "MEAL", "karaoke", a place, a word of the day, a word of How it felt, "didn't" against a day written with "didn’t", and "sam tacos" each show just the meetups expected; "zebra" shows "No meetups match “zebra”." and the live region says the same; "rainy", picked as weather only, matches nothing; clearing brings every group back.
- **Opening from Meetups and coming back:** search "tacos", open the Meal: its back button reads "Meetups"; Edit, change the type to Drinks, Save; Back: the search still reads "tacos" and the row is now Drinks.
- **Delete and Undo from Meetups:** delete a meetup from its Edit sheet; the page goes back to Meetups without that row; Undo puts it back in its month.
- **Long histories:** 130 past meetups (one with a photo) written straight into IndexedDB, then a reload: 60 rows and "Show older meetups"; the tap shows 120 and focus is on row 61; a second tap shows 130 and the button is gone; the meetup with a photo shows its `img.history-thumb`; open row 100 and go back: 130 rows still show and row 100 is in view.
- **Empty:** `/#/meetups` with one friend and no meetups shows "No meetups yet." and "Your first meetup will show up here.", no search field, and the "+ Log meetup" pill; logging from it shows the meetup under "October 2026".
- **The friend page still leaves its friend out:** the same Meal reads "with Sam" in Alex's History and "with Alex and Sam" on the Friends tab.

**Updated tests.** Rows in Recent meetups name friends ("with Alex and Sam"), so every test that finds a friend on the Friends tab with a loose name pattern (`getByRole('link', { name: /Alex/ })`) now also finds a meetup row. They move to a new `friendLink(page, name)` helper in `e2e/helpers.ts`, `page.getByRole('link', { name: new RegExp('^' + name) })`: a friend row's name starts with the friend's name (the avatar is hidden), while a meetup row's starts with its type. This covers `openFriendPage`, `birthdays.spec.ts`, `detail.spec.ts`, `friends.spec.ts`, `meetups.spec.ts`, `preferences.spec.ts`, `settings.spec.ts` and `screenshots.spec.ts`; tests that already pick `.last()` for a name also in Birthdays soon keep it. The long-history test adds a `seedMeetups(page, { friends, meetups, photos })` helper that writes rows like `putSetting` does. `detail.spec.ts` keeps finding `img.history-thumb` in History.

**Screenshots** (`e2e/screenshots.spec.ts`, in light, dark and large text, inside `captureAll`, so the test count stays 15):
- The seed adds an upcoming Party with Maya Patel in 2 days (Stats and the friend pages captured don't change; future meetups aren't counted).
- `02-friends` now shows Recent meetups under Birthdays soon.
- New `19-meetups`: the Meetups page, full page, after the owner's example is logged (Upcoming, then the months).
- New `20-meetups-search`: the Meetups page searched for "ramen".
- `04-friend` and `05-friend-full` look the same as before (the shared row).

Nothing compares images: review them by eye.

## Risks and trade-offs

- **The friend list starts lower** on the Friends tab: Birthdays soon (up to 3 rows) and Recent meetups (up to 4) come first. Both hide the moment you search or filter, and Recent meetups never grows past 3.
- **A row found by a name it doesn't show:** with four or more friends the row says "and 2 others", and a match deep in the day or in How it felt isn't shown in the row (rows never show How it felt). The meetup still matched; opening it shows why.
- **Many live queries:** 60 thumbnails per page of rows, each a tiny key-only read. "Show older meetups" adds them 60 at a time, so even long histories never start hundreds at once.
- **Search reads every day:** the folded text is built once per data change, and filtering is deferred, so typing stays smooth at hundreds of days of up to 10,000 characters.

## Out of scope

- A Meetups tab, or links from Stats or Settings.
- Filters (by friend, type, activity or group), sorting choices, or a jump-to-month scrubber.
- Searching weather, moods (the No Score Rule), dates, photos or groups; showing or highlighting where a search matched.
- Editing, deleting or swiping on the lists; selecting several meetups.
- Upcoming meetups in Recent meetups, or more than 3 there; a count on "See all meetups".
- Loading rows as you scroll, or saving the search between visits.
- Making the Friends search find meetups.
- Any change to logging, the Meetup page, The day, the friend page, the data or backups.
