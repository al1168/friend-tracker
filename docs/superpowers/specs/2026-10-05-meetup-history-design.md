# Meetup history (Recent meetups and the Meetups page): design

Date: 2026-10-05. Status: approved. The owner said "Auto approve" on 2026-10-05, after the UX, engineering and integration reviews, with Recent meetups after Birthdays soon (option A) showing two rows while Birthdays soon shows (option B); see "Where the friend list lands".

The owner said "I also want to see the recent meetup histories, in case I need to edit or look back at it." Today a meetup can only be found again from one friend's page, under History. This design adds two ways in: a small "Recent meetups" group on the Friends tab, and a "See all meetups" row that opens every meetup on one page. Both reuse the friend page's history row, and every row opens the Meetup page, where Edit and "Edit the day" already do the editing.

## Goal

Make any meetup easy to find again, from the screen the app opens on: the last few at a glance, and all of them, grouped by month and searchable, one tap further. Logging, the Meetup page, The day and the friend page stay exactly as they are.

## Decisions

- **On the Friends tab, after Birthdays soon and before the search field (options A and B, the owner's choice).** A "Recent meetups" group shows the 3 latest meetups, or the 2 latest on days Birthdays soon is showing, then a "See all meetups" row. Looking back starts from people, on the tab the app opens to. (Also considered: a fourth "Meetups" tab, rejected because the app is three tabs and a whole tab for a list opened now and then would crowd the thumb row; a link on Stats, rejected because Stats counts and doesn't remember; and moving the search field and chips to the top of the Friends tab (option C), out of scope because it would also move the shipped Birthdays soon below the chips. Each friend's page keeps its own History.)
- **Recent meetups stays short.** Its rows' subtitles stop at two lines, like a Mail preview, so a long day can't push the friend list off the screen, and it gives up a row while Birthdays soon shows. The full text stays in the row for VoiceOver, and the Meetups page and a friend's History still show it all. Even so, on days Birthdays soon shows 3 rows the friend list starts below the first screen; "Where the friend list lands" gives the positions.
- **Recent means it happened.** Only meetups dated today or earlier, newest first; on the same date, the one logged later comes first, as on the friend page. Upcoming meetups stay on the friend page and at the top of the Meetups page.
- **Recent meetups gets out of the way.** It's hidden while searching or filtering by group (like Birthdays soon, so the list below stays a plain filtered list), when there are no friends (the welcome state shows instead), and when no meetup has happened yet. Searching or picking a group hides it and Birthdays soon without moving the search field: the page scrolls by what went away, so the field stays where your eyes are.
- **One meetup row everywhere.** The friend page's history row becomes a shared `MeetupRow`: emoji badge, type (and "Upcoming"), the subtitle (date, "with", activities, the day's snippet) and the first photo's thumbnail. On a friend's page "with" still leaves that friend out; on the Friends tab and the Meetups page there's no friend to leave out, so it names everyone. Under the Meetups page's "Upcoming" title the rows leave out the "Upcoming" badge, because the title already says it.
- **A Meetups page at `/meetups`,** pushed from the Friends tab, with "Friends" on its back button. It belongs to the Friends tab, which already owns every path that starts with `/meetups`.
- **Grouped like the friend page.** "Upcoming" first (soonest first), then one group per month, newest first, titled "October 2026". Inside a month the order comes from the same `groupByMonth` the friend page uses, so the two can never disagree.
- **Search finds memories by their words.** Friend names, the type, activities, the day (places are lines of the day, so they're in it) and How it felt's words for meetups that have happened (How it felt never shows for an upcoming one, so it's never searched there either). Every word typed must be found somewhere in the meetup, so "sam tacos" finds the Meal with Sam where you wrote "Tacos". Case, accents ("cafe" finds "Café") and curly or straight apostrophes don't matter. Weather, moods and dates are never searched: a mood is never a way to list meetups (the No Score Rule), and months are already the groups.
- **Long histories show more when asked.** The page shows 60 rows, then a "Show older meetups" button adds 60 more. Nothing loads as you scroll (the app is not a feed), and only the rows shown that have a photo read a thumbnail.
- **Coming back keeps your place.** The search, the rows shown and the scroll position survive opening a meetup and going back, so look, edit, back, next works. The app lock starts the page fresh.
- **Nothing is edited on the lists.** A row opens the Meetup page; Edit there opens the Edit meetup sheet and "Edit the day" opens The day, exactly as today. No swipe actions.
- **No data changes.** No schema change, no Dexie version, no backup change. The only new thing kept is an in-memory cache of thumbnails, so going back to a list doesn't read every photo again.

## Friends tab: Recent meetups

`src/screens/FriendsScreen.tsx`. With friends, the body reads top to bottom: the install hint (when shown), Birthdays soon (when shown), **Recent meetups**, the search field and group chips, the friend list, and the "+ Log meetup" pill.

- **The group:** an `InsetGroup` titled "Recent meetups", with no footer.
- **Rows:** `recentMeetups(meetups, today, RECENT_MEETUPS)`, cut to its first `RECENT_MEETUPS_WITH_BIRTHDAYS` while `showBirthdaysSoon`: up to 3, or up to 2 while Birthdays soon is showing, each a `MeetupRow` naming everyone on the meetup, with `subtitleLines={2}` and the router state `{ backLabel: 'Friends' }`. `showBirthdaysSoon` is the screen's existing flag (a birthday in the next 14 days, a blank search and no group filter), so Recent meetups never counts a Birthdays soon that isn't on screen.
- **The last row:** `<Row to="/meetups" title="See all meetups" accent chevron />`: Terracotta Ink title, no badge, no subtitle. It always shows while the group does, even with fewer meetups than rows (the Meetups page also holds upcoming meetups and the search). With no leading slot, its hairline starts at the 16px text edge, as the inset group rule already does.
- **Shown when** all hold: there's at least one friend, the trimmed search is blank, no group filter is on, and at least one meetup is dated today or earlier.
- **Data:** the screen already reads `useMeetups()` and `useFriends()`; it adds `useMeetupTypes()` and `useMeetupIdsWithPhotosAmong(ids)` for the ids of the 3 latest past meetups (see "Data") and renders nothing until all have loaded, as it does now for the others. It always asks about the 3 latest, even while 2 show (the 2 are the first of the 3), so searching, a chip or Birthdays soon hiding and showing never changes what it reads. It never waits for the app-wide `useMeetupIdsWithPhotos()` walk, which grows with the photo history and starts again on every open and every unlock: this is the screen the app opens on. A meetup just logged shows at the top straight away (live queries).
- **Tapping a row** opens the Meetup page, whose back button reads "Friends". Back returns to the Friends tab.

With the owner's example from the debrief design and two older meetups, on Mon, Oct 5, a day with no birthday in the next two weeks (while Birthdays soon shows, the Drinks row isn't there). The text column is drawn at its real width on an iPhone 13: about 190px (about 30 characters of Subhead) on a row with a photo, about 245px (about 38) on a row without one, which has no thumbnail slot. The badge, thumbnail and chevron are centered on each row:

```
Recent meetups
 (🍽️)  Meal                             [photo] ›
       Sat, Oct 3 · with Mariya,
       Jessie and Brandon · Movie,…
 (☕)  Coffee                                   ›
       Wed, Sep 30 · with Kim Park
 (🍻)  Drinks                                   ›
       Sat, Sep 12 · with Alex Rivera
       See all meetups                          ›
```

### Two lines, like a Mail preview

- With `subtitleLines`, `MeetupRow` passes `Row` its subtitle wrapped in `<span className="meetup-row__clamp" style={{ WebkitLineClamp: subtitleLines }}>`, and `MeetupRow.css` gives `.meetup-row__clamp` `display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden`. WebKit ends the second line with "…". `Row` and its markup stay as they are: it has no `className` prop, and a wrapper around the row would become the inset group body's direct child, which the hairline rules (`> * + *::before` and the `:has(.row__leading)` inset) target.
- The whole subtitle stays in the DOM, so the link's name (what VoiceOver reads) is the full text, as on the friend page.
- It stays two lines at every text size; the row grows taller with the text, as every row does.
- Only Recent meetups clamps. A friend's History and the Meetups page wrap the whole subtitle, as the History does today.

### Keeping the search field still

Safari has no scroll anchoring (`overflow-anchor` isn't supported), and when the field is low on the screen iOS scrolls the page on focus to lift it above the keyboard. Without help, the first letter typed (or a chip tap) would remove Birthdays soon and Recent meetups, about 455-520px above the field (Recent meetups alone, about 285-345px, on days with no birthday soon), and the field and the first matches would end up above the screen. Clearing the search would push the field the same distance down. So `FriendsScreen` keeps the field still itself:

- `.friends-filters` gets a ref. `unfiltered` is `query.trim() === '' && activeGroup === null`, the part of "Shown when" that the search and the chips change.
- In the search's `onChange` and each chip's `onClick`, when the change flips `unfiltered` (blank to typed, typed to blank, All to a group, a group to All), the handler records `ref.current.getBoundingClientRect().top` before calling the state setter.
- A `useLayoutEffect` keyed on `unfiltered` then measures the top again, calls `window.scrollBy(0, newTop - oldTop)` and forgets the recorded top. It runs before paint, so nothing visibly jumps. The browser clamps the scroll at 0, so near the top of the page the field can move up into view, never away from it.
- **At the bottom of the page the browser clamps too.** Clearing a search with only a few friends brings the groups back above the field, but the page may end before it can scroll the whole distance: the field then comes to rest lower than it was by what's left over, with the end of the page at the bottom of the screen. It never leaves the screen, because the scroll stops short only when what's below the field (the chips, a short list and the page's bottom padding) is shorter than the screen, and that padding keeps the field above the tab bar and the pill. Typing on a page barely taller than the screen works the same way: the page shrinks, the browser lowers the scroll first, and the layout effect measures after that, so its correction only does what's left. The e2e test seeds 12 friends, so the page is long enough to scroll the whole distance there.
- Changes that don't flip it (typing more letters, one group to another) do nothing. This also fixes the jump Birthdays soon causes today (about 230px, about 255px with its "And N more" line).
- Only the search and the chips are corrected. When the data changes what sits above the field (the first past meetup logged, the last one deleted or moved to a future date, a newer meetup whose subtitle wraps to a different number of lines, Birthdays soon changing at midnight, which also changes Recent meetups between 2 and 3 rows), the field moves with the page, as any list does when its content changes.

### Where the friend list lands

The owner chose A plus B: Recent meetups after Birthdays soon (A), with 2 rows while Birthdays soon shows and 3 otherwise (B). The positions below are page positions at the default text size, from the top of the page; what shows on first open is what sits above the tab bar, about 614px in Safari and about 713px on the Home Screen, with the "+ Log meetup" pill floating over the middle of the list at about 546-598px in Safari and 645-697px on the Home Screen ("Risks" has the measurements).

- **On days Birthdays soon shows 3 rows** (so Recent meetups shows 2): the search field sits at about 550-590px, clear of the pill on the Home Screen, but in Safari level with the pill, its bottom running under the tab bar at the high end. The first friend row sits at about 666-706px: none shows in Safari, and on the Home Screen at most its top peeks out beside the pill. Today the field sits clear at 326-370px. With 3 recent rows (A alone) the field would sit at about 610-670px, off the first screen, which is what B saves.
- **With fewer birthdays,** each birthday row fewer lifts everything about 60px: with 2 birthdays everything sits about 60px higher, and with 1 about 120px higher. With 1 birthday the first friend row comes into view on the Home Screen, just above the pill (in Safari it sits behind the pill).
- **On days with no birthday in the next two weeks** (Recent meetups shows 3): the search field sits at about 385-445px and the first friend row at about 500-560px. One or two friends show clear on the Home Screen, at most one in Safari.
- **What it doesn't do:** on days Birthdays soon shows 3 rows, no friend row is on the first screen. Only a layout with no Recent meetups above the friend list on those days (hidden while Birthdays soon shows, or placed after the friend list) would bring one back; even one recent row leaves the first friend at about 605-625px: below the fold in Safari, its lower part under the pill on the Home Screen.
- **Out of scope, option C:** the search field and chips at the top, just under the large title as in iOS Contacts, at about 100px every day. It would keep search on the first screen and make the scroll correction unnecessary, but it moves Birthdays soon, which already ships at the top of the Friends tab, below the chips (about 116px lower), and it still puts no friend row on the first screen on days Birthdays soon shows 3 rows.

**VoiceOver and large text:** swiping from the top, VoiceOver passes the title, Birthdays soon (its heading, up to 3 links and the "And N more" line), then Recent meetups (its heading, 2 links while Birthdays soon shows or 3 otherwise, each read with its whole subtitle, and "See all meetups") before it reaches the search field; the rotor's Form Controls setting still jumps straight to it. At the large-text size the search field moves from about 440px today to an estimated 800-900px with 3 recent rows (about one row less on Birthdays soon days), and the friend list is about two screens down.

## Shared meetup row

New `src/components/MeetupRow.tsx` and `MeetupRow.css`, taken from the friend page's history row with nothing visible changed once its thumbnail has loaded (see "Why the box"):

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
  /** Whether the meetup has a photo (from useMeetupIdsWithPhotos, or useMeetupIdsWithPhotosAmong on the Friends tab), so the thumbnail's box is there from the first render. */
  hasPhoto: boolean
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
- **The thumbnail:** `HistoryThumb` moves into this file as `MeetupThumb`, now rendered only when `hasPhoto`. It always draws a 40px box, `<span className="meetup-thumb" aria-hidden="true">` (40 by 40, 8px corners, Linen, `display: block`), and puts `<img className="history-thumb" alt="">` inside it once `useFirstPhotoThumb(meetup.id)` resolves (a key-only read of the first photo's id, then that photo's thumbnail, from the cache under "Data" when it's there). A row without a photo has no trailing slot and runs no thumbnail query. The `.history-thumb` rule moves from `FriendDetailScreen.css` to `MeetupRow.css` under the same class name, next to the new `.meetup-thumb`.
- **Why the box:** `.row__trailing:empty` takes no space, so today a History row's text column is about 52px wider until its thumbnail arrives (the first render of a live query is always empty), and a subtitle that fit on one line wraps to two when it does. Knowing from the first render whether the row has a photo makes its width final on first paint: about 190px of text with the box, about 245px without. A thumbnail arriving only fills a box that's already there, so it never moves the page, the restored scroll or the search field.
- **The friend page** (`src/screens/FriendDetailScreen.tsx`) uses it with `names={meetupNames(meetup, nameById, friend.id)}`, `hasPhoto={withPhotos.has(meetup.id)}` (the screen waits for `useMeetupIdsWithPhotos()` with its other data) and its existing `fromFriend` state, so the history still leaves out the friend it belongs to, still keeps the tab the page came from, still shows the "Upcoming" badge and still wraps the whole subtitle. The only visible change: a History row with a photo shows its Linen box for a moment before the thumbnail, instead of growing a line when it arrives.

## Meetups page

New `src/screens/MeetupsScreen.tsx` and `MeetupsScreen.css`, routed in `src/App.tsx` with `<Route path="/meetups" element={<MeetupsScreen />} />` next to `/meetups/:id`. It's a `Page` with `title="Meetups"`, `back={{ label: 'Friends', fallback: '/' }}` and `pushed`, so the document title is "Meetups · Friend Tracker", the large title is "Meetups", and opened directly its back button goes to Friends. It reads `useMeetups()`, `useFriends()`, `useMeetupTypes()` and `useMeetupIdsWithPhotos()` and renders nothing until they load.

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

The text column is drawn at its real widths again (narrower only on the row with a photo); here subtitles wrap in full:

```
‹ Friends
Meetups
[ 🔍 Search                                   ]

Upcoming
 (🎉)  Party                                    ›
       Wed, Oct 7 · with Maya Patel

October 2026
 (🍽️)  Meal                             [photo] ›
       Sat, Oct 3 · with Mariya,
       Jessie and Brandon · Movie,
       Shopping · nonstopstyle,
       strand bookstore, Sammy L
       coffee and 5 more

September 2026
 (☕)  Coffee                                   ›
       Wed, Sep 30 · with Kim Park
 (🍻)  Drinks                                   ›
       Sat, Sep 12 · with Alex Rivera

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
- **Fast enough for years of days:** the folded text of every meetup is built in a `useMemo` keyed on meetups, friends, types and today, and only while the deferred trimmed query isn't blank (the memo returns null otherwise). A blank query skips the index and the filtering altogether, so the most common visit, coming back with no search, folds nothing.
- **Typing never waits for the list:** `useDeferredValue` only helps when the slow part can skip the urgent render, so `MeetupsScreen` renders the groups, the no-match line and "Show older meetups" in a `memo`-wrapped `MeetupList`, whose props are the deferred trimmed query, the row count, the loaded data and a stable `onShowMore` (`useCallback`). A keystroke then re-renders only the field until the deferred value catches up. `MeetupRow` is wrapped in `memo` too: each meetup's `names` come from a `useMemo` keyed on meetups and friends, and the router state is a module constant, so when the results change only rows that weren't shown before render (and read their day for the snippet).
- **What VoiceOver hears:** `<p className="visually-hidden meetups-announcer" aria-live="polite">`, with no role. It must not be `role="status"`: the toast region already is, and toast lookups (`getByRole('status')`, in 43 e2e assertions) would find two. This follows the PIN pad's announcer (`src/lock/PinPad.tsx`). It's mounted whenever the list shows (not in the empty state) and empty while the query is blank. The search's `onChange` restarts a 700ms timer whenever the trimmed search changes (a space typed at either end leaves the timer and what was read out alone, so the same result isn't read twice); when typing pauses that long, the region says "1 meetup matches.", "12 meetups match." (every match, not only the rows shown), or "No meetups match “zebra”.". It starts empty, so a search restored on Back is never announced. The visible no-match line isn't a live region, so nothing is read twice. The timer is cleared on unmount.

### Long histories

- The page shows the first 60 rows (`MEETUPS_PAGE_SIZE`), counted in order across the groups: Upcoming first, then the months.
- **"Show older meetups"** (44px, Linen, Warm Ink 600) adds the next 60. It shows only while rows are left, and the label never changes.
- **A new search starts again at 60 rows.** The reset happens in the search input's `onChange`, in the same handler that sets the query, never in an effect on the query: an effect would also run when the page comes back with a restored search and undo the restored row count. A keystroke that leaves the trimmed search the same (a space at either end, on the way to a second word) isn't a new search: it changes nothing shown, so the rows shown, the focus index and the announcement stay, and only the kept query is updated.
- **Focus** moves to what the button added, so VoiceOver reads on from there and keyboard focus isn't left on a button that may be gone: the first row it added, or, when that row starts a new month, that month's heading, so VoiceOver reads "August 2026" before the row instead of skipping it. The button's handler records the current row count as the pending focus index and raises the count. The row at that index gets a `ref`; when it's the first row of its group, the group gets `InsetGroup`'s existing `titleRef` instead (which makes the h2 focusable from code, for moving focus after a control is replaced, and draws no ring). An effect keyed on the count calls `focus({ preventScroll: true })` on whichever is set and clears the pending index. A restore or a search never sets it, so they never move focus. The focused element sits where the button was (a new month's heading exactly there, a row that continues its month a little higher), so nothing needs to scroll.
- **No stray ring on touch:** the app draws a 2px `:focus-visible` ring. WebKit shouldn't show it for focus moved by script after a tap, but this is checked in WebKit (the e2e below and by eye). If a tap does paint a ring on row 61, focus moves only when the button itself had focus (`document.activeElement` was the button: a hardware keyboard or Voice Control), and this spec is updated to say so.
- **Thumbnails:** each row shown that has a photo runs its own `useFirstPhotoThumb`, a key-only index read of its first photo's id; rows without a photo run none (the page's one `useMeetupIdsWithPhotos` says which is which). The first time a photo's thumbnail is needed, its photo record is read once (IndexedDB can't read part of a record, so the full image comes with it and is dropped at once); after that the thumbnail comes from the cache under "Data". So 60 rows read at most 60 photo records the first time and none when you come back (up to the cache's 300), and nothing keeps a full image. Rows not shown read nothing.
- The meetups table never holds photos, so reading every meetup for the list stays small; the Friends tab already reads them all.

### Keeping your place

- The search text and the rows shown are kept in memory per history entry (`location.key`), the way `ScrollManager` keeps scroll positions. The map lives in a small `PlaceMemoryProvider` (`src/components/PlaceMemory.tsx`) that `App` renders inside the `HashRouter`, next to `ScrollManager`: it holds `useRef(new Map<string, { query: string; count: number }>())`, and `usePlaceMemory()` hands the map to `MeetupsScreen`.
- `MeetupsScreen` reads its first query and row count from the map in `useState` initializers, and writes to it from the same handlers that change them (the search's `onChange` and "Show older meetups"). Going back to the same entry finds them; a fresh visit from the Friends tab is a new entry and starts blank at 60 rows.
- **The scroll:** `ScrollManager`'s layout effect runs on the key change while `MeetupsScreen` still renders nothing (its four live queries are loading). The rows come back on the first render after the data loads, already at the restored count and at their final size, and `ScrollManager`'s retry (every frame for up to 1s, stopping early on a touch or wheel) then reaches the saved offset, even past row 60. The retry stops as soon as it gets there, before any thumbnail has arrived, so the rows must not change size afterwards: a row with a photo keeps its 40px box from the first render (see "Why the box"), so its thumbnail arriving changes nothing above the place you return to. The e2e step "open row 100 and go back" pins this.
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

No stored data changes. No new table, field, index or Dexie version; no backup format change; no new writes. The lists read what's already there: `useMeetups()`, `useFriends()`, `useMeetupTypes()`, `useMeetupIdsWithPhotos()` (the Meetups page and the friend page) or `useMeetupIdsWithPhotosAmong()` (the Friends tab), and one `useFirstPhotoThumb` per row shown that has a photo.

### Which meetups have photos (`src/db/meetups.ts`, `src/data/hooks.ts`)

- `meetupIdsWithPhotos()` is `db.meetupPhotos.orderBy('meetupId').uniqueKeys()`: a key-only walk of the existing `meetupId` index that names each meetup with photos once, reading no record and no image. IndexedDB has no bulk read of index keys, so the walk is a cursor: one round trip per meetup with photos.
- `useMeetupIdsWithPhotos(): ReadonlySet<string> | undefined` wraps it in a live query, `new Set(...)`, so it follows a photo added, removed or put back by Undo. It's one live query for the whole app (see "Decisions made while building"); the Meetups page and the friend page read it and pass `hasPhoto` to their rows.
- `meetupIdsWithPhotosAmong(ids): Promise<Set<string>>` answers for a few known meetups: for each id, the same key-only read of its first photo's id through `[meetupId+order]` that `firstPhotoThumb` makes (`limit(1).primaryKeys()`, one `getAllKeys` request), all sent at once, so it takes about one round trip however long the history is, and reads no image. `useMeetupIdsWithPhotosAmong(ids)` keeps it live, keyed on the ids; it's `undefined` while the ids are (their data is loading) and until the first answer, and when the ids change it keeps the last answer until the new one arrives, so the screen never blanks. The Friends tab reads it for its 3 latest past meetups.

### Thumbnail cache (`src/db/meetups.ts`)

`firstPhotoThumb` reads its first photo's id from the `[meetupId+order]` index without loading the row, then calls `db.meetupPhotos.get(id)`, which returns the whole record, full image included. On the friend page that's one friend's rows; on the Meetups page it's 60 or more, again on every return. So:

- A module-level `Map<string, string>` from photo id to thumbnail. `firstPhotoThumb` keeps its index-only read of the first photo's id (so the live query still fires when photos are added, removed or reordered), returns the cached thumbnail for a known id, and calls `get()` only on a miss, caching the result.
- Caching by id is safe: a photo's thumbnail never changes. Updates touch only `order`, and Undo puts back the same ids with the same thumbnails.
- It holds at most 300 thumbnails and drops the least recently used first: a hit deletes the entry and sets it again, so it moves to the newest end of the `Map`'s insertion order, and a new entry past 300 drops the oldest end. `deleteMeetup` and photos removed in an edit drop their ids; a backup restore (`replaceAllData` in `src/backup/storage.ts`) clears it through a new `forgetPhotoThumbs()`.
- The limit: with more than 300 photo rows shown at once (five or more taps of "Show older meetups" on a history full of photos), coming back reads some photo records again, since a page longer than the cache can't be held whatever the order.
- The friend page uses the same function, so its History gets the same saving with nothing visible changed.

### Pure logic (`src/stats/meetupHistory.ts`)

It lives in `src/stats`, next to `history.ts` (whose `groupByMonth` it uses) and `recent.ts`, so the dependency keeps running from stats to lib and never the other way. No window, document or Intl of its own (it uses `formatDate` and `formatMonthYear` from `src/lib/dates.ts`, as the rows do today), so it's unit tested in Node with fixed dates.

```ts
/** How many meetups Recent meetups shows on the Friends tab. */
export const RECENT_MEETUPS = 3
/** How many it shows while Birthdays soon is showing above it. */
export const RECENT_MEETUPS_WITH_BIRTHDAYS = 2
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
- "Show older meetups" is a button; after it, focus is on the first row it added, or on its month's heading when that row starts a month (see "Long histories" and "No stray ring on touch").
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
- **New, Meetup row:** "One row for a meetup, the same everywhere (a friend's History, Recent meetups, the Meetups page): the type's emoji badge, the type as the title (with "Upcoming" for a future date, except under the Meetups page's "Upcoming" title, which already says it), a subtitle of the date, "with" the friends, the activities, and the day's first places ("and 5 more") or its first line cut at 80 characters, then the first photo as a 40px thumbnail with 8px corners, before the chevron (its Linen box shows from the start, so a row never shifts when the photo arrives). On a friend's page "with" leaves that friend out; everywhere else it names everyone. In Recent meetups the subtitle stops at two lines; elsewhere it wraps in full. Moods, weather and How it felt never show. Tapping it opens the Meetup page."
- **Friend detail column, History:** "rows grouped by month, each a Meetup row naming the others. Tapping a row opens the Meetup page."
- **Birthdays soon:** "at the top of the Friends tab, above Recent meetups and the search field", and add "Searching or picking a group hides it (and Recent meetups) without moving the search field: the page scrolls by what went away."
- **New, Recent meetups:** "An inset group titled "Recent meetups" on the Friends tab, after Birthdays soon and before the search field: the 3 latest meetups dated today or earlier (the 2 latest while Birthdays soon shows), newest first, as Meetup rows naming everyone, each subtitle stopped at two lines, then "See all meetups", an accent row with a chevron and no badge, which opens the Meetups page. Hidden when no meetup has happened yet, while searching, and while a group filter is on; searching or picking a group hides it without moving the search field."
- **New, Meetups page:** "Every meetup, pushed from Recent meetups: back "Friends", the large title "Meetups", a search field ("Search meetups"), then "Upcoming" (soonest first, its rows without the "Upcoming" badge) and one group per month, newest first ("October 2026"), as Meetup rows naming everyone. The search looks in friend names, the type, activities, the day and, for meetups that have happened, How it felt's words, ignoring case and accents, and every word typed must be found; never weather, moods or dates. It shows 60 rows, then "Show older meetups" adds 60. Going back to it keeps the search, the rows shown and the scroll; the app lock starts it fresh. Empty: "No meetups yet." with "Your first meetup will show up here."; no match: "No meetups match “zebra”." The "+ Log meetup" pill shows whenever there's a friend."
- **Meetup page,** nav bar: "back ("Back", the friend's name from their history, "Friends" from Recent meetups, or "Meetups" from the Meetups page)".
- **Navigation, Tab bar:** "A friend's page, a Meetup page and the Meetups page belong to Friends, unless they were opened from Stats, which then stays current."
- **Do's and Don'ts, "Truncate only where iOS does":** add "a Recent meetups row's subtitle, which stops at two lines like a Mail preview".
- **Don'ts:** "**Don't** load more rows as a list scrolls; a long list ends with a button that shows more."

## Testing

Counts afterwards: unit tests go from 57 files to 58 (the new `src/stats/meetupHistory.test.ts`; the cache and photo-ids cases join `src/db/meetups.test.ts`), with the cases below added to today's 676. E2E goes from 158 to 173 (15 tests in the new `e2e/history.spec.ts`, one per bullet below). Screenshots stay at 15 tests and gain 9 PNGs: light, dark and large-text versions of `02-friends-full`, `19-meetups` and `20-meetups-search`.

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

**Unit tests, the thumbnail cache** (`src/db/meetups.test.ts`, fake-indexeddb): a second `firstPhotoThumb` for the same meetup doesn't call `db.meetupPhotos.get` (a `vi.spyOn`); after the photos are reordered it returns the new first photo's thumbnail; after `forgetPhotoThumbs()` it reads again; a meetup without photos still gives null; a delete and an edit forget the photos they remove (after an edit removes a photo, a photo put back under the same id shows its own thumbnail, not the old one); a hit keeps a thumbnail past the cap, and the cap is exactly 300 (302 meetups with a photo: read A, then 299 others, A again, then 2 more; A is still a hit, the third of the 299 is still a hit, and the second and the first of the 299 are read again).

**Unit tests, which meetups have photos** (same file): `meetupIdsWithPhotos()` gives each meetup with photos once (a meetup with three photos appears once, one without none), includes a meetup after its first photo is added, drops it after its last photo is deleted, and never calls `db.meetupPhotos.get`. `meetupIdsWithPhotosAmong(ids)` gives only the ids asked about that have photos (a meetup without photos, an unknown id and a meetup with photos not asked about are left out; no ids give an empty set), never calls `db.meetupPhotos.get`, and, in a `liveQuery`, follows a first photo added and a last photo deleted.

**E2E** (WebKit, iPhone 13), new `e2e/history.spec.ts`, with `page.clock` set to Mon, Oct 5, 2026, 12:00 PM where dates matter:
- **Recent meetups shows the three latest that happened, naming everyone:** with a Coffee with Alex on Sep 25, a Meal with Alex and Sam ("Tacos") on Oct 3, Drinks with Kim on Oct 4, a Call with Sam on Sep 5 and a Party with Kim on Oct 8, the "Recent meetups" region's links are, in order, Drinks, Meal ("Sat, Oct 3 · with Alex and Sam · Tacos"), Coffee, then "See all meetups"; there's no Party and no Call.
- **Two recent rows while Birthdays soon shows:** with the same past meetups and Lee, whose birthday is Oct 8, Birthdays soon shows Lee and the "Recent meetups" region's links are Drinks, Meal, then "See all meetups"; with the clock moved to Oct 20 and a reload, no birthday is in the next two weeks, Birthdays soon is hidden and the links are Drinks, Meal, Coffee, then "See all meetups".
- **Two lines in Recent meetups:** with the owner's example logged (three friends, Movie and Shopping, the owner's typed day), its subtitle's `.meetup-row__clamp` in Recent meetups is no taller than two of its lines (its height is at most twice its computed line height, plus 1px) and the link's accessible name still holds the whole subtitle; the same row on the Meetups page is taller than two lines.
- **It hides and comes back:** with only the upcoming Party it's hidden; after logging a past one it shows; typing in "Search friends" hides it and clearing shows it; a group filter hides it and "All" shows it.
- **The search field stays put:** with Birthdays soon (a friend whose birthday is in 3 days), Recent meetups (one of them with a photo and a subtitle of about 33 characters, one line without a thumbnail and two with one), a group, and 12 friends whose names hold an "a", scroll so the search field's top is just under the nav bar; fill "a": the field's top stays within 4px of where it was and the first friend row is in view; clear it: the same, and the field's top stays within 4px of that over the next 10 animation frames, while Recent meetups comes back and its thumbnail arrives. Tapping the group's chip and then "All" keeps the chip row within 4px each time.
- **A recent meetup opens its page with "Friends" on the back button,** and Back lands on the Friends tab.
- **See all opens Meetups:** with the meetups above plus a Trip with Sam on Dec 24, 2025: the h1 "Meetups", the back button "Friends", the Friends tab `aria-current="page"`, and the regions in order "Upcoming", "October 2026", "September 2026", "December 2025", each with its rows in order (Upcoming soonest first). The Party row under "Upcoming" has no "Upcoming" badge (its name doesn't contain "Upcoming"); on Kim's page the same Party still shows it.
- **Search:** "alex", "MEAL", "karaoke", a place, a word of the day, a word of How it felt, "didn't" against a day written with "didn’t", and "sam tacos" each show just the meetups expected; "zebra" shows "No meetups match “zebra”." and `page.locator('.meetups-announcer')` reaches the same text (`toHaveText` waits past the 700ms); "rainy", picked as weather only, matches nothing; clearing brings every group back. Toast assertions on this page keep using `getByRole('status')`.
- **Opening from Meetups and coming back:** search "tacos", open the Meal: its back button reads "Meetups"; Edit, change the type to Drinks, Save; Back: the search still reads "tacos", the row is now Drinks, and the announcer is empty (a restored search isn't announced).
- **Delete and Undo from Meetups:** delete a meetup from its Edit sheet; the page goes back to Meetups without that row; Undo puts it back in its month.
- **Long histories:** 130 past meetups seeded with `seedMeetups`, then a reload. The first 120 are dated Sep 1 to Oct 5, 2026 and the last 10 in August 2026, so row 61 continues September and row 121 opens "August 2026"; 100 of them have a photo, and their subtitles run about 33 characters (one line without a thumbnail, two with one). 60 rows and "Show older meetups"; a tap on it shows 120, focus is on row 61, and no element matches `:focus-visible`; focusing the button and pressing Enter shows 130, focus is on the "August 2026" heading, and the button is gone; a meetup with a photo shows its `img.history-thumb` and one without has no `.meetup-thumb`; open row 100 and go back: 130 rows still show, row 100 is in view, and its top stays within 1px over the next 10 animation frames.
- **A space at the end isn't a new search:** with the 130 seeded meetups, search "coffee" (the announcer reads "130 meetups match.") and tap "Show older meetups" (120 rows); fill "coffee ": the announcer still reads the same at once (it isn't cleared to be read again), and a second later 120 rows still show; fill "coffee sam": the announcer is empty at once, 60 rows show, and once typing pauses it reads "130 meetups match." again.
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

- **The friend list starts lower on the Friends tab** (the chosen A plus B; "Where the friend list lands" sums it up). Measured on `e2e/screenshots/light-02-friends.png` (iPhone 13, default text size, Safari's 664px viewport): Birthdays soon (3 rows) ends at about 302px, the search field sits at 326-370px, the group chips at 386-422px and the first friend row starts at 442px; friend rows are 60px.
  - **What shows** is what sits above the tab bar: about 614px in Safari (the 664px viewport less the 50px tab bar) and about 713px on the Home Screen (844px less the 47px status bar, the 34px home indicator and the 50px tab bar). The "+ Log meetup" pill floats over the middle of the list, at about 546-598px in Safari and 645-697px on the Home Screen, and hides most of the name of any row behind it. Playwright doesn't emulate the status bar or the safe areas, so the captures show the Safari layout and the Home Screen figures are worked out, to check on the phone. In Safari the install hint, until it's dismissed, pushes everything lower still.
  - **Row widths:** a meetup row's text column is about 190px with a photo's thumbnail (16px padding, the 44px badge, 12px gaps, the 40px thumbnail, the chevron), about 30 characters of 15px Subhead, and about 245px (about 38) without one. Subtitles wrap far more than a wide mock suggests: the owner's example wraps to about 5 lines (a row about 140px tall), and the screenshot seed's Meal to about 4. Unclamped, Recent meetups would add about 320-370px with the seed, and 500px or more with three long days. With subtitles stopped at two lines, a row is about 61px (one line) or 81px (two), so the group (title, 3 rows, "See all meetups" and the 24px gap) adds about 285-345px, about 305px for the mock above.
  - **With Birthdays soon at 3 rows,** Recent meetups shows 2 rows (about 224-264px for the group), so the search field sits at about 550-590px and the first friend row at about 666-706px. No friend row shows on first open; the search field is clear of the pill on the Home Screen, and in Safari level with the pill. Today it sits clear at 326-370px. With 3 recent rows (A alone) the field would sit at about 610-670px, behind the tab bar in Safari. Each birthday row fewer lifts everything about 60px (2 birthdays about 60px, 1 about 120px); with 4 or more birthdays the "And N more" line adds about 25px.
  - **On days with no birthday in the next two weeks** (Birthdays soon looks 14 days ahead, so with many friends this isn't most days), the search field sits at about 385-445px and the first friend row at about 500-560px. In Safari one friend shows at best, its last line touching the top of the pill, and none when the recent rows wrap to two lines (the first then sits behind the pill and runs under the tab bar). On the Home Screen one or two friends show clear, with one more partly behind the pill.
  - **At large text sizes** the search field moves from about 440px today to an estimated 800-900px with 3 recent rows (about one row less on Birthdays soon days), and the friend list is about two screens down.
  This works against PRODUCT.md's "opening the app tells you when you last saw anyone without digging". Showing 2 rows while Birthdays soon shows (B) lifts the search field by one row on those days, but on days Birthdays soon shows 3 rows no friend row is on the first screen. The `02-friends-full` and `large-text-02-friends` captures show it.
- **Hiding the groups moves content above the search field.** Typing a letter or picking a chip removes about 455-520px above the field (about 285-345px on days with no birthday soon). The scroll correction under "Keeping the search field still" keeps the field in place; without it, the field would end up above the screen or jump. When the page is too short to scroll the whole distance, the field comes to rest a little lower but stays on screen. Data changes above the field (a meetup logged or deleted, Birthdays soon at midnight, which also moves Recent meetups between 2 and 3 rows) aren't corrected and move the field with the page. Option C, the search field at the top, would have removed this risk and the correction; it's out of scope.
- **A row found by a name it doesn't show:** with four or more friends the row says "and 2 others", and a match deep in the day or in How it felt isn't shown in the row (rows never show How it felt). The meetup still matched; opening it shows why. (How it felt words of a meetup moved to a future date are hidden and never searched.)
- **Thumbnails read whole photo records once.** IndexedDB can't read part of a record, so the first time a row with a photo shows, its full image (a JPEG up to 1600px, often several hundred KB) is read and dropped. The cache keeps the thumbnail, so coming back to the list reads only the indexes, and "Show older meetups" bounds a first visit to 60 new records at a time. The cache holds the 300 most recently used thumbnails; past 300 photo rows shown at once, coming back reads some records again. Avoiding even that first read would need a separate thumbnail table (a schema change), which this design doesn't make.
- **The app-wide walk of which meetups have photos** takes one IndexedDB round trip per meetup with photos, and it starts again on every open and every unlock (`LockGate` unmounts `App`). Measured in the Windows WebKit the e2e runs on: 100 meetups with photos took about 1.5s and 400 about 6.1s, about 15ms a step, suspiciously close to the Windows timer tick, so a real iPhone is probably far faster; it hasn't been measured on the phone yet (time a cold open of `/#/meetups` with a few hundred seeded photo meetups). The Friends tab, the screen the app opens on, doesn't wait for it: its 3 rows take one batch of key-only reads (about 15ms there, for 100 or 400 photo meetups alike), and it drew about 0.4s after the page loaded with either history. The Meetups page and a friend's page do wait for it when they're the first screen after an open or an unlock (opened from a link, or the page the lock covered); the Meetups page then drew at about 1.8s with 100 photo meetups and about 6.3s with 400 in that WebKit. Opened from the Friends tab, the walk started when the app did, so it has usually finished.
- **Many live queries:** one app-wide walk of the photos' `meetupId` index and the Friends tab's few reads (above), then one key-only index read per row shown that has a photo. "Show older meetups" adds 60 rows at a time, but going back to a page that shows more restores every row at once, so it starts one key-only read per restored row with a photo (a few hundred at most after many taps), with their thumbnails from the cache.
- **Search reads every day:** the folded text is built only while there's a search, once per data change; filtering is deferred, and the memoized list and rows keep a keystroke from re-rendering them, so typing stays smooth at hundreds of days of up to 10,000 characters.

## Out of scope

- A Meetups tab, or links from Stats or Settings.
- Filters (by friend, type, activity or group), sorting choices, or a jump-to-month scrubber.
- Searching weather, moods (the No Score Rule), dates, photos or groups; showing or highlighting where a search matched.
- Editing, deleting or swiping on the lists; selecting several meetups.
- Upcoming meetups in Recent meetups, or more than 3 there (2 while Birthdays soon shows); a count on "See all meetups".
- Moving the Friends tab's search field and chips to the top (option C).
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

## Changes after the integration review

- **The options are restated with what each does and doesn't do:** positions are counted against the top of the tab bar (about 614px in Safari, about 713px on the Home Screen) and the pill; on Birthdays soon days no option puts a friend row on the first screen, and under A the search field is off it too; B's search field is at about 550-590px; on other days B changes nothing and C moves only the search field.
- **C is no longer called additive:** it moves the shipped Birthdays soon below the search field and drops the scroll correction and its test, so it's cheaper to choose before A is built. B stays the one that can be added later.
- **VoiceOver order and large text** are compared for each option.
- **Rows know whether they have a photo from the first render** (`useMeetupIdsWithPhotos`, `hasPhoto`, the `.meetup-thumb` box), so a thumbnail arriving never re-wraps a row, moves the search field after a search is cleared or shifts a restored scroll; the false "never shift the page" line is replaced, and the e2e tests now seed photos where it matters.
- **The thumbnail cache is least recently used,** with its 300 limit stated, and "Many live queries" says what a Back with many rows starts.
- **The clamp is an inner span** (`.meetup-row__clamp`), so `Row` and the History markup don't change.
- **The Meetups list and rows are memoized,** so `useDeferredValue` really keeps typing from waiting on them.
- **After "Show older meetups", a new month's heading takes focus** when the first added row starts that month.
- **Smaller corrections:** the mocks use about 190px only for rows with a photo and about 245px otherwise; the removed heights read about 230px for Birthdays soon and about 510-600px for both groups; "never moves the search field" now says searching or picking a group, and data changes are named as not corrected.

## Changes at approval

- **Approved** by the owner ("Auto approve", 2026-10-05) with A plus B: Recent meetups after Birthdays soon and before the search field, the 3 latest past meetups or 2 while Birthdays soon is showing (`RECENT_MEETUPS_WITH_BIRTHDAYS`), each subtitle stopped at two lines, then "See all meetups", and the search field kept still when the groups above it hide or show. Option C is out of scope. The open options ("If it still feels crowded") become "Where the friend list lands", which records the choice and its positions.
- **E2E:** a fourteenth test in `e2e/history.spec.ts`, "Two recent rows while Birthdays soon shows", so E2E goes from 158 to 172.
- **Corrections:** with 2 birthdays everything sits about 60px higher and with 1 about 120px higher (the pairing was reversed); the removed heights read about 455-520px with Birthdays soon (2 recent rows) and about 285-345px without it; and "Keeping the search field still" covers the bottom of the page, where a page too short to scroll the whole distance (clearing a search with only a few friends) leaves the field a little lower but on screen.

## Decisions made while building

- **Which meetups have photos is one live query for the whole app.** `useMeetupIdsWithPhotos()` reads a context that `MeetupIdsWithPhotosProvider` (`src/data/MeetupIdsWithPhotosProvider.tsx`, inside `App` next to `PlaceMemoryProvider`) fills from the `uniqueKeys()` walk. A walk takes one IndexedDB round trip per meetup with photos, and in WebKit each round trip is slow (about 15ms each in the WebKit the e2e runs on, where 100 meetups with photos took about 1.5s). Read per screen, going back to a long Meetups page rendered its rows after `ScrollManager`'s 1s retry had given up, and the scroll was lost. Kept for the app, the set is there the moment a screen mounts; it still follows every photo change, and the app lock drops it with the rest of `App`. `ScrollManager` is unchanged. The Friends tab doesn't read it, so the screen the app opens on never waits for the walk (see `meetupIdsWithPhotosAmong` under "Data", and "Risks").
- **`newestFirst`** (newest date first, then the one logged later) is exported from `src/stats/history.ts` and shared by `groupByMonth` and `recentMeetups`, so Recent meetups, the months and a friend's History order meetups the same way.
- **The thumbnail cache forgets** the photo ids `deleteMeetup` deletes and the `removeIds` an `updateMeetup` gives, after the transaction, and `replaceAllData` clears it after a restore (with a unit test that a restored photo shows its own thumbnail). `deleteFriend`, which deletes the photos of meetups left with no one, doesn't: photo ids are never reused, so an entry left behind only takes room until the 300 limit drops it.
- **Focus after "Show older meetups":** the button's handler sets a pending flag and the row count it had; that index picks the row (or its group's heading) that gets a callback ref, and an effect keyed on the row count focuses it with `preventScroll` once. The index isn't cleared afterwards, because taking the heading's `tabIndex` away while it has focus would drop focus; a new search clears it. `MeetupList` passes its row count to `onShowMore`, so the callback stays stable without reading a stale count.
- **The live region's words** come from the trimmed query the 700ms timer saw, shown only while it equals the deferred trimmed query, so the announcement never disagrees with the list; each keystroke that changes the trimmed query clears it first.
- **`MeetupList` gets the searched groups,** built in `useMemo`s keyed on the deferred query in `MeetupsScreen`, rather than the raw data; a keystroke still re-renders only the field until the deferred value catches up.
- **E2E helpers:** `seedMeetups` also takes `groups`, and `e2e/helpers.ts` gains the row builders `friendRow`, `meetupRow` and `photoRow` (with the shapes `SeedFriend`, `SeedMeetup` and `SeedPhoto` defined there, since the e2e project can't import `src/types.ts`'s extensionless imports).
- **E2E details:** each test lands with its task (the Friends tab tests with Recent meetups, the Meetups page tests with the page). "The search field stays put" puts all 12 friends in the group, so the group's chip leaves the page long enough to keep the field still (a short page clamps the scroll, as "Keeping the search field still" says). "See all opens Meetups" adds a second upcoming meetup (an Activity on Oct 12) so "soonest first" is checked. `detail.spec.ts` also checks that the History thumbnail sits in its `.meetup-thumb` box and that a row without a photo has none.
