# Meetup debrief: design

Date: 2026-10-05. Status: approved (the owner confirmed the summary on 2026-10-05).

The owner said "The current notes is not very user friendly. I also want to add this type of information on to each meeting" and shared one real day: the weather, a list of places with times, what happened at each, who paid, what they talked about, and how they felt. Earlier they asked for "a mood option for each meetup ... kinda like a debrief". This design replaces the small mood design of 2026-10-04 (approved, never built) and keeps its four faces. The owner's message, exactly as sent, is the acceptance test.

## Goal

Give every meetup an optional place to write the whole day the way the owner already writes it, comfortably on an iPhone with thumbs, and read it back later as a calm memory instead of a block of text. Logging stays exactly as fast as today, and every existing note stays as it is.

## Decisions

- **The day is text you write, read back as a timeline.** The meetup's existing `note` becomes **The day**: one big box that grows as you write. A line that starts with "@" is a place, with an optional time at the end ("@Blue willow 3:30"). The lines under it go with that place. "Jessie paid" on its own line reads back as a small tag. This is how the owner's notes already look, so typing and pasting both work, nothing is a form, and lines like "Walked to hey tea" or dinner-table talk stay where the owner put them, in the owner's words. (Stop cards with a field per fact were considered and rejected: eight cards of four rows is data entry, and the owner's in-between lines had no home.)
- **Your words are stored exactly as typed.** Reading the day only changes how it looks on the Meetup page. Nothing is moved, rewritten, sorted, or guessed into another field.
- **The reading rules are a frozen grammar.** Grammar 1 (below) is pinned by golden fixtures that are never edited, so a memory never reads differently after an app update. A future change adds grammar 2 for days saved after it.
- **Who paid stays words.** It's a plain fact on one place, never totaled, counted or compared (the No Ledger Rule). A friend's face shows beside "Jessie paid" only when the name matches exactly one friend on that meetup; it's decoration, so a rename only loses the face.
- **AM or PM is read, never written.** An unmarked time reads in day order ("3:30" after 11:53 AM is 3:30 PM) and shows in the phone's clock style. A typed "am", "pm" or 24-hour time always wins. Nothing is stored or reordered because of it.
- **A full-screen page, not a sheet.** "The day" is its own route, `/meetups/:id/day`, built as a fixed layer on the sheets' proven keyboard hooks. The nav bar can't pan away, the helper bar rides on the keyboard, and after the 15-minute app lock the page comes back by itself because the URL survives `LockGate`.
- **A helper bar on the keyboard:** "@ Place" (a one-line field with autocorrect off, so "nonstopstyle" stays as typed), "Now" (the current time, on today's meetups), "Paid" (one tap writes "Jessie paid") and "Hide keyboard".
- **Everything saves as you type.** There is no Save button on the page, and no "Discard changes?" unless a save actually failed.
- **Weather is one tap** on eight chips with no face emoji, so nothing competes with the mood faces. More than one can be picked ("rainy, then windy").
- **How it felt comes last,** as the owner writes it: the four faces (😔 Heavy, 🙂 Okay, 😊 Good, 😄 Great) and a box for your own words. Only for meetups dated today or earlier.
- **The quick log is unchanged.** Pick friends, Save. The one-line Note leaves the sheet. A "Save and write about the day" button sits above Save in the Log footer, disabled (never hidden) until a friend is picked, so Save never moves.
- **One way in from the Meetup page:** a "Write about the day" row, which reads "Edit the day" once something is written.
- **Mood and weather never appear in lists.** No mood in friend history rows, Stats or the Friends list, and no mood pill in the hero (the 2026-10-04 design had both; dropped so a friend's history never reads like a scorecard). History rows show the first few places instead of a whole note.
- **Existing notes are never migrated.** They already are days, and show under "The day".
- **Backups move to version 5,** reading 1 to 5, and fix the `version === 4` checks that would otherwise drop activities and photos from a version 5 file.
- **No Dexie version bump.** Nothing new is indexed; the reading hook fills the new fields.

## Data

### Types

```ts
// src/types.ts
/** The day's weather. Emoji and labels live in src/lib/weather.ts. */
export type Weather = 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'windy' | 'hot' | 'cold'

/** How a meetup felt to you. Emoji and labels live in src/lib/moods.ts. A word, never a number (the No Score Rule). */
export type Mood = 'heavy' | 'okay' | 'good' | 'great'

export interface Meetup {
  id: string
  date: ISODate
  typeId: string
  friendIds: string[]
  /**
   * The day, in your words ("The day" in the app). This was the one-line note, so every existing note is
   * already a day. Stored exactly as typed (line breaks as \n). Lines that start with "@" read back as
   * places (src/lib/dayText.ts); reading never changes the text.
   */
  note: string
  /** What you did, in the order picked. Cleaned like likes (see src/lib/activities.ts). */
  activities: string[]
  /** Weather picked, in chip order, no repeats. [] when none. */
  weather: Weather[]
  /** One of four faces, or null. Never preselected, scored, averaged, counted or charted. */
  mood: Mood | null
  /** "How it felt", in your words. Stored as typed (line breaks as \n), at most 4,000 characters. '' when none. */
  feelings: string
  createdAt: string
}
```

### Constants

- `src/lib/weather.ts`: `WEATHER`, in chip order, as `{ key, emoji, label }`: sunny ☀️ "Sunny", cloudy ⛅ "Cloudy", rainy 🌧️ "Rainy", stormy ⛈️ "Stormy", snowy ❄️ "Snowy", windy 🌬️ "Windy", hot 🌡️ "Hot", cold 🧣 "Cold". Also `isWeather(value)` and `cleanWeather(value: unknown): Weather[]`: something that isn't a list gives `[]`; unknown keys and repeats are dropped; the rest go in chip order.
- `src/lib/moods.ts`, from the approved mood design: `MOODS`, low to high, as `{ key, emoji, label }`: heavy 😔 "Heavy", okay 🙂 "Okay", good 😊 "Good", great 😄 "Great". Also `isMood(value)`, `moodInfo(value)` (null for anything unknown, never throws), `INVALID_MOOD = 'Please pick a mood from the list.'`, and `feelingsApply(meetup, today)`, true when `meetup.date <= today`.
- `src/lib/dayText.ts`: `DAY_MAX_TYPED = 10_000`, `FEELINGS_MAX = 4_000`, `TOO_LONG_FEELINGS = 'Keep how it felt under 4,000 characters.'`.

`weather.ts` and `moods.ts` touch no window, document or Intl, because the service worker opens `db.ts`, which imports them.

### Defaults and cleaning

- **New meetups:** `note: ''`, `weather: []`, `mood: null`, `feelings: ''`.
- **note:** `\r\n` and `\r` become `\n`; nothing else changes. No trimming and no limit in data. The day box stops typing at 10,000 characters (`maxLength`), so a longer note from before, or from a backup, is kept, shown and still editable: you can delete from it, it just can't grow.
- **weather:** `cleanWeather`, quietly.
- **mood:** `null` or a known key. Anything else throws `ValidationError(INVALID_MOOD)`, which only code can reach.
- **feelings:** line breaks normalized like the note. Over 4,000 characters throws `ValidationError(TOO_LONG_FEELINGS)`; the box's `maxLength` means only code can reach it.
- When shown, each line's ends are trimmed and blank lines at the start and end are ignored. Storage keeps them.

### Reading the day (grammar 1)

`readDay(note: string): DayPart[]` in `src/lib/dayText.ts`. Pure: no window, document or Intl.

```ts
export type DayLine =
  | { kind: 'text'; text: string }
  /** "Jessie paid": `who` is the words before "paid"; null for a shared bill ("We split it"). */
  | { kind: 'paid'; text: string; who: string | null }

export interface DayTime {
  /** Minutes after the day's midnight, 0 to 2879: a reading past midnight adds 1,440. */
  minutes: number
  /** Typed with "~", "about" or "around". */
  approx: boolean
}

export interface DayStop {
  place: string
  start: DayTime | null
  end: DayTime | null
  lines: DayLine[]
}

export type DayPart =
  | { kind: 'heading'; text: string }
  | { kind: 'timeline'; stops: DayStop[] }
  | { kind: 'prose'; lines: (DayLine | { kind: 'gap' })[] }
```

**Lines.** The text is split at line breaks, and each line is read with its ends trimmed.

**Place lines.** A line whose first character, after any spaces, is "@" and which has more after it.
1. A line that is only "@" (a place you started and left) is skipped.
2. Trailing spaces, commas, periods, semicolons and exclamation marks are dropped.
3. A time at the end is taken off (see Times).
4. What's left is the place. Every "@" at the start of a word is dropped, and runs of spaces become one: "@holister + @h&m" reads "holister + h&m". The "&" inside "h&m" stays. If nothing is left ("@ 3:30"), the line is ordinary text.
5. An "@" anywhere else in a line ("Then walked to dinner @seoulsaloon") is ordinary text.

**Times,** only at the end of a place line, after a space:
- A clock is an hour, then optionally ":" or "." and two-digit minutes, then optionally "am" or "pm" in any case, with or without a space. A clock needs minutes or am/pm, so a bare number is never a time: "amc 34" keeps its 34.
- Hours run 1 to 12 with am/pm, and 0 to 23 without; minutes run 00 to 59. Anything else isn't a time and stays part of the place ("@Bar 25:00").
- "~", "about " or "around " right before a clock marks it rough.
- A range is two clocks joined by "-" or an en or em dash (U+2013, U+2014), with or without spaces, or by " to ". In a range, the first clock may be a bare hour when the second has minutes or am/pm ("7-9pm").

| Line | Place | Time |
|---|---|---|
| `@nonstopstyle 10:30` | nonstopstyle | 10:30 |
| `@Blue willow 3:30, ` | Blue willow | 3:30 |
| ` @seoulSaloon 8:30. ` | seoulSaloon | 8:30 |
| `@hey tea Broadway ` | hey tea Broadway | none |
| `@amc 34 5:30` | amc 34 | 5:30 |
| `@amc 34` | amc 34 | none |
| `@holister + @h&m 7:30 - ~8:10` | holister + h&m | 7:30 to about 8:10 |
| `@Bar 7-9pm` | Bar | 7 PM to 9 PM |
| `@Cafe 3pm` | Cafe | 3:00 PM |
| `@Cafe 10.30` | Cafe | 10:30 |
| `@Park about 8:10` | Park | about 8:10 |
| `@Gym 15:30` | Gym | 3:30 PM |
| `@Bar 25:00` | Bar 25:00 | none |
| `@` | skipped | |
| `@ 3:30` | ordinary text | |

**Paid lines.** A line that isn't a place line, read with its ends trimmed and a trailing "." or "!" dropped, that is:
- one to three words, then "paid", optionally followed by " for " and anything: "Jessie paid", "I paid", "Jessie paid for dinner". The words before "paid" are who paid. "Nobody paid" and "No one paid" are ordinary text.
- or exactly "split", "split it", "we split", "we split it", "split the bill" or "split the check", in any case: a shared bill. "Split ways went home" is ordinary text.

**Headings.** A line that isn't a place or paid line, ends with ":" and is at most 40 characters: "Locations:" reads as the heading "Locations", and "How I felt:" as "How I felt". "Note to self: buy milk" is ordinary text.

**Grouping,** top to bottom:
- A place line starts a stop. Place lines in a row make one timeline, even with blank lines between them.
- The lines right after a place line belong to its stop, up to a blank line, a heading or the next place line.
- A heading ends a timeline and stands on its own.
- Any other line is prose. Prose runs until a place line or a heading. Blank lines inside prose become one small gap, however many there are.
- Paid lines stay where they were written, under a stop or in prose.

**Frozen.** The fixtures for grammar 1 (the owner's message verbatim, the same day written in the app, and every row above) are never edited. Changing a rule means adding grammar 2, storing `dayGrammar: 2` on meetups whose day is saved after that change, and keeping grammar 1 for everything else. Until then meetups carry no grammar field: absent means 1.

### AM or PM

`readDay` resolves every time, top to bottom through all place lines:
- **Fixed as typed:** a time with "am" or "pm", an hour of 0 or 13 to 23, or a leading zero ("08:30").
- **Read in day order:** any other time (hour 1 to 12) takes the earliest reading that isn't before the latest time so far: the starts and ends of earlier stops, plus this stop's start when reading its end. Readings go AM, PM, then the same two past midnight. "12" reads as 12 AM (midnight) or 12 PM (noon).
- **The first time of the day,** with nothing before it: 7 to 11 read as AM; 12 and 1 to 6 as PM.
- **A range with am/pm only on its end:** the start takes the same half of the day when that keeps it before the end ("7-9pm" is 7 PM to 9 PM; "11-1pm" is 11 AM to 1 PM).
- **A fixed time earlier than the latest so far** counts as past midnight, for the times after it.
- The text never changes and stops are never sorted. Adding a place higher up can change how a later unmarked time reads; typing "am" or "pm" fixes it.

For the owner's day: 10:30 AM, 11:30 AM, 11:53 AM, 3:30 PM (3:30 AM is before 11:53 AM), no time, 5:30 PM, 7:30 PM to about 8:10 PM, 8:30 PM.

**Showing times** (`src/lib/clock.ts`): `formatClock(minutes, style)` gives "3:30 PM" (a no-break space before AM or PM, built by hand so the spacing never depends on the browser) or "15:30" when `clockStyle()` finds a 24-hour clock (`new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle` is `h23` or `h24`, read once). Rough times get "~": "~8:10 PM". `speakTime(stop)` gives the VoiceOver sentence: "At 10:30 AM.", "About 5:30 PM.", "From 7:30 PM to about 8:10 PM.".

### Other helpers

- `daySnippet(note): string | null`, for history rows. With places: up to three, in order and counted once ignoring case, written like names: "nonstopstyle", "nonstopstyle and strand bookstore", "nonstopstyle, strand bookstore and Sammy L coffee", then "nonstopstyle, strand bookstore, Sammy L coffee and 5 more". Without places: the first non-blank line, ends trimmed; over 80 characters it's cut at the last space within the first 80 (or at 80 for one long word) and ends with "…". An empty day gives null. A one-line note of 80 characters or fewer reads exactly as today.
- `isDayEmpty(meetup)`: the note and feelings are blank, and there's no weather and no mood.
- `src/lib/dayEdit.ts`: pure string functions for the helper bar, each returning `{ value, caret }`: `insertPlaceLine(value, caret, text)`, `insertPaidLine(value, caret, line)` and `insertAtCaret(value, caret, text)` (rules under "Helper bar").
- `src/lib/caret.ts` (uses the DOM): `caretLineSpan(textarea): Span`, the screen top and bottom of the line holding the caret. It's measured with a hidden mirror copy of the box (same width, font, padding, line height and wrapping) holding the text up to the caret and a marker.

### Data functions (`src/db/meetups.ts`)

```ts
export interface MeetupInput {
  date: ISODate
  typeId: string
  friendIds: string[]
  /** In the order picked. Cleaned like likes: empties and repeats are dropped. */
  activities: string[]
}

/** The day page's fields. Only the fields given are written. */
export type DayInput = Partial<Pick<Meetup, 'note' | 'weather' | 'mood' | 'feelings'>>

/** Saves the day page's fields. Resolves false, and never throws for this, when the meetup is gone. */
export function updateDay(id: string, input: DayInput): Promise<boolean>
```

- `MeetupInput` loses `note`: the sheet no longer edits it.
- `addMeetup` stores the four defaults.
- `updateMeetup` writes only `{ date, typeId, friendIds, activities }` and the photo changes. It never reads or writes the day's fields, so the Edit sheet can't overwrite a day being saved, and the note is no longer trimmed on every edit.
- `updateDay` cleans what it's given (rules above, so it can throw `INVALID_MOOD` or `TOO_LONG_FEELINGS`), then, in one `rw` transaction on `db.meetups`, reads the meetup: if it's gone it resolves false; otherwise it calls `db.meetups.update(id, fields)` with just the given fields and resolves true. It never uses `put`, so a deleted meetup can't come back, and it can never touch the date, type, friends or activities.
- `deleteMeetup` and `restoreMeetup` move whole records, so Undo keeps the day. `deleteFriend` only edits `friendIds`, so days stay; a "Mariya paid" tag just loses its face once Mariya is deleted.

### Database

No version bump: nothing new is indexed, and `db.version(3)` stays as it is, with no upgrade step. The meetups reading hook in `src/db/db.ts` becomes:

```ts
// Meetups saved before activities existed have none. The day's fields came without a version bump
// (no index changed), so older meetups get empty ones here, and anything that isn't a known weather
// or mood (from older code in a second tab, or a rollback) reads as none.
db.meetups.hook('reading', (meetup) => {
  if (meetup) {
    meetup.activities ??= []
    meetup.weather = cleanWeather(meetup.weather)
    if (!isMood(meetup.mood)) meetup.mood = null
    if (typeof meetup.feelings !== 'string') meetup.feelings = ''
  }
  return meetup
})
```

Older code that is still running uses Dexie's partial `update`, which leaves fields it doesn't know untouched. The shared `meetup()` fixture in `src/test/fixtures.ts` gains `weather: []`, `mood: null` and `feelings: ''`.

### Existing notes

Nothing moves and nothing is rewritten. Every note stays in `note`, byte for byte, and is the text of that meetup's day: shown under "The day" on the Meetup page, held in the day page's box, and still previewed in history rows (its first line, see `daySnippet`). A plain note like "Ramen night" has no "@" lines, so it reads as one line of prose, much like today's Note box. A note only changes when the owner edits it on the day page.

### Size and live queries

Days live inside the meetup row, like activities. The owner's full day is about 1.3 KB, and typing stops at 10,000 characters for the day and 4,000 for how it felt. Each save updates one row, which re-runs the live queries on meetups: `useMeetups()` (always mounted, because `SheetsProvider` always renders the meetup sheet) and the page's own `useMeetup(id)`. Saves come at most once per 600ms pause, which is fine at hundreds of meetups. If it ever shows, the day can move to its own table in a later Dexie version, the way photos did.

## Backups

`src/backup/format.ts`:
- **Version 5.** `BackupFile.version` becomes `5` and `createBackup` writes 5. `readBackup` accepts versions 1 to 5; any other value keeps "This backup was made by a different version of Friend Tracker."
- **Required fix in the same change.** Activities and photos test `version === 4` today, so a version 5 file would silently lose every activity and photo. Both become `version >= 4`:

```ts
// Versions 1 to 3 were made before activities existed.
activities: version >= 4 ? activityList(r, where) : [],
// Versions 1 to 4 were made before the day's weather, mood and feelings existed.
weather: version >= 5 ? weatherList(r, where) : [],
mood: version >= 5 ? moodOf(r, where) : null,
feelings: version >= 5 ? feelingsOf(r, where) : '',
```

  and `version >= 4 ? list(raw, 'meetupPhotos').map(...) : []` for photos, with its comment unchanged.
- **note** is read exactly as today: any string, no length limit, kept byte for byte. No backup is ever refused for a long note.
- **Version 5 is strict,** like birthdays in version 3 and activities in version 4. Each problem refuses the file, naming the meetup's position:
  - `weather` must be a list of known keys, or the file is refused with `Meetup 3 has an invalid "weather" list.`. Repeats are dropped quietly and the rest put in chip order.
  - `mood` must be `null` or a known key. Anything else, a missing key included ("Good", "amazing", 3), gives `Meetup 3 has an invalid "mood".`.
  - `feelings` must be a string of at most 4,000 characters, or the file is refused with `Meetup 3 has a missing or invalid "feelings".` (the existing `text()` message).
- **Versions 1 to 4:** meetups get `weather: []`, `mood: null` and `feelings: ''`, and keep their note exactly.
- **Unchanged:** `exportBackup`, `readAllData` and `replaceAllData` (meetups go out and come back whole), the Settings Backup footer and its photo count, and lock settings (never exported). Days are text, so files barely grow.
- **Older builds** refuse a version 5 file with the existing message. That's correct: they would drop the day's new fields.

## Log meetup sheet

`src/sheets/MeetupSheet.tsx`. The sections are Who, What, When, Activities and Photos, then "Delete meetup" when editing.
- **Note is removed** from both Log and Edit: its label, field and state, and its part of the unsaved-changes check.
- **Footer, Log meetup only,** top to bottom: the error line (as today), a centered 44px text button **"Save and write about the day"** (Terracotta Ink, Body 600), then the block Save button, unchanged.
  - The button is disabled at 45% whenever Save is (no friend picked, saving, or photos still being added). It is never hidden for lack of a friend, so Save never moves.
  - While the keyboard is up (`html.keyboard-open`) the button is hidden, so the friend search keeps its room. Save stays at the bottom of the footer, in the same place on screen.
- **Tapping it** saves exactly like Save, with the same toast ("Logged with Mariya, Jessie and Brandon", with Undo), closes the sheet, then pushes `/meetups/:id` and `/meetups/:id/day` on top of it. The Meetup page's back button reads the friend's name when the sheet was opened from that friend's page, and "Back" otherwise. Back from the day lands on the new memory. If the save fails, the sheet stays open with its error line, as Save does.
- **Edit meetup:** the footer is unchanged, with no new button. The day is edited from the Meetup page.
- **A quick one-line note** takes as many taps as today: "Save and write about the day", tap The day, type, Back. (Today: scroll down, tap Note, type, Save.)

## The day page

New route `/meetups/:id/day`, in `src/screens/DayScreen.tsx` and `DayScreen.css`. Document title "The day · Friend Tracker". The tab bar is hidden on this route (`TabBar` renders nothing for a path matching `/meetups/<id>/day`). An unknown or deleted meetup goes back one step, or to Friends when opened directly, like the Meetup page.

### Layout and copy

A fixed full-screen layer (`.day-page`, Warm Paper, at most 600px wide and centered with auto margins) slides in like a pushed page over 340ms, or fades with Reduce Motion. Its bottom sits at `--keyboard-inset` and its height is `--viewport-height`, so it always fills exactly the part of the screen above the keyboard. Inside, top to bottom: the nav bar, a scrolling body and the footer.

**Nav bar:** 44px plus the safe area, solid Warm Paper, gaining a 0.5px Soft Rule hairline once the body scrolls. Leading: the back text button with its chevron and the meetup type's name ("Meal", or "Meetup" if the type is gone). Center: the h1 "The day" in Body 600. Trailing: an empty slot as wide as the back button, so the title stays centered.

**Body** (16px sides, sections 1.5rem apart, its own scroll):
1. **Context line,** centered, Subhead Warm Ink Secondary, balanced: "Sat, Oct 3 · with Mariya, Jessie and Brandon" (`formatDate` and `formatNameList`).
2. **Weather:** a Footnote label "Weather" (an h2) over a horizontally scrolling chip row that bleeds to the screen edges, like meetup types: "☀️ Sunny", "⛅ Cloudy", "🌧️ Rainy", "⛈️ Stormy", "❄️ Snowy", "🌬️ Windy", "🌡️ Hot", "🧣 Cold". Tap to pick, tap again to clear; any number can be picked. Picked chips are Peach. Each tap saves at once.
3. **The day:** a Footnote label "The day" (an h2), then a Footnote Warm Ink Secondary hint: "Start a line with @ for each place, with a time if you like. Lines under a place go with it." Then the box:
   - Paper White, 12px corners, `0.75rem 0.9rem` padding, no border; text at `max(16px, 1rem)` with line height 1.5; at least 12 lines tall. It grows with its text and never scrolls inside itself.
   - Placeholder, on two lines: "@Blue willow 3:30" and "Who came, what you ate, what you talked about".
   - `autocapitalize="sentences"`, autocorrect and spellcheck on, `maxLength` 10,000. Return adds a line.
   - At the limit, a `.field-hint` under it: "This box is full."
   - It holds the meetup's note, old notes included.
4. **How it felt,** only when the meetup is dated today or earlier: a Footnote label "How it felt" (an h2), the four mood tiles, then a box.
   - **Tiles,** the approved look: a row of four buttons, "😔 Heavy", "🙂 Okay", "😊 Good", "😄 Great". Each is a centered column: a 44px Linen circle with the emoji at 26px, over the word in Footnote 400 Warm Ink. Four across at every standard text size, and two by two once a quarter of the row is narrower than 3.25rem (a flex-basis calculation, as in the stat row), so a word never breaks. Press: the tile turns Linen Pressed, with no scale. Picked: a 3px Peach outline at a 2px offset around the face, the 22px Peach check badge (shared with the recent-friend check) and the word at 600. Tapping the picked face clears it. Nothing is picked at first. Each tap saves at once.
   - **Box:** the same look as The day, at least 4 lines, growing, placeholder "A few words, just for you", `maxLength` 4,000, with "This box is full." at the limit.
5. **Footnote,** centered, Warm Ink Secondary: "Saves as you type, and stays on this iPhone."

**Footer:** hairline-topped Warm Paper with `0.5rem 1rem` padding plus the bottom safe area (none while the keyboard is up, since it covers the home indicator). It holds the save error line, when a save has failed, above the helper bar.

### Helper bar

A group named "Writing helpers": one row of 36px chips (with 44px hit areas) that scrolls sideways at large text sizes. While the keyboard is up, a 44px "Hide keyboard" icon button (a downward chevron in Terracotta Ink) is pinned at its end in every state. The row has three states.

**Normal:**
- **"@ Place"** opens the Place row.
- **"Now"**, only while the meetup's date is today, puts the current time at the caret in The day: "9:52 PM", or "21:52" on a 24-hour phone, with a space before it when the character before isn't a space or the start of a line.
- **"Paid"** opens the Who paid row.
- While the How it felt box has focus, only "Hide keyboard" shows: the helpers write into The day.

**Place row:** a Paper White field (44px tall, 12px corners, 16px text) with the placeholder "Place, then a time if you like", then "Now" (today only), which adds the time to the end of the field, then an "Add" text button (shown once the field has text), then a 44px "Close" icon button.
- The field has `autocapitalize="none"`, autocorrect and spellcheck off (place names are typed exactly as you want them, the way your notes already have them), and `enterkeyhint="next"`.
- Return or Add with text puts the place line into The day with `insertPlaceLine`, moves focus to The day with the caret where the details go, closes the row, and announces "Added Blue willow, 3:30 PM." (or "Added hey tea Broadway." with no time). A leading "@" typed into the field is dropped, so there's never "@@".
- Return or Add with an empty field, and Close, close the row and put focus back in The day. Close empties the field.
- Text still in the field when you tap Back or the app goes to the background is added as a place line first, so nothing typed is lost.

**Who paid row:** a Footnote label "Who paid?", then chips: "Me", one per friend on the meetup in the meetup's order (a 24px avatar and the first name, or the full name when two of them share a first name), "Split", and a 44px "Close" icon button. Opening it announces "Pick who paid." A chip writes "I paid", "Jessie paid" or "We split it" as its own line with `insertPaidLine`, puts the caret at the end of that line, closes the row, and announces "Added Jessie paid.".

**Where text goes** (`src/lib/dayEdit.ts`). Everything is placed relative to the caret in The day, or the end of the text if The day hasn't had focus since the page opened:
- `insertPlaceLine`: on a blank line, the place replaces it; otherwise it goes on a new line after the caret's line. At the end of the text, a new empty line follows with the caret on it, ready for what happened there. In the middle of the text, the caret goes to the end of the place line instead, so no stray blank line splits what's below.
- `insertPaidLine`: the same placement, with the caret at the end of the new line and no empty line after it.
- `insertAtCaret`: the text at the caret, with the spacing rule for "Now".

**How the keyboard stays up:**
- Every helper button calls `preventDefault()` on `pointerdown` and `mousedown`, so a focused box keeps its focus.
- Any focus a helper moves (into the Place field, or back into The day) happens inside the tap or the Return keypress, with `flushSync` when a row has to render first, so iOS raises or keeps the keyboard.
- Text goes in with `document.execCommand('insertText')` while The day has focus, so shake to undo and three-finger undo still work. If it returns false, `setRangeText` and an `input` event are used instead, losing only native undo for that one insert.
- "Hide keyboard" blurs the focused field.

### Saving

- The page keeps its own copy of the note, weather, mood and feelings, taken once when it opens. While you're there, it only takes a newer stored value (from another tab or a backup restore) into a field that isn't focused and has nothing waiting to save, so nothing changes under your thumb.
- **Text** saves 600ms after the last change, and right away when a box loses focus, when the app goes to the background (`visibilitychange` to hidden, and `pagehide`), when you tap Back, and when the page unmounts (the app lock included). **Weather and faces** save on the tap.
- One write at a time, sending only the fields that changed (`updateDay`). Changes made meanwhile go in the next write; an older value never lands after a newer one.
- Nothing announces each save; the footnote says how it works.
- **If the meetup is gone** (`updateDay` resolves false, as after Undo on the "Logged" toast), saving stops quietly and the page goes back, like the Meetup page does, and the Meetup page then goes back too. Undo means the meetup wasn't meant to be logged, so its day goes with it.
- **If a write fails,** a Footnote Danger Red line with `role="alert"` shows above the helper bar: "Couldn't save just now. Your words are still here, and the app will try again." The page tries again every 5 seconds and with the next change, and the line goes away once a save works. Back, while changes are still unsaved after a failure, asks the existing "Discard changes?" (a destructive "Discard changes", or Cancel to stay). Otherwise Back never asks.
- **Back** saves anything waiting, then goes back one step (to `/meetups/:id`, replacing, when the page was opened directly).
- After the app lock, `LockGate` mounts the app again on the same URL, so the day page comes back holding everything saved before the phone went to the background.

### Keyboard and long text

- **The layer** uses `useScrollLock`, `useKeyboardInset` and `useRevealFocusedField` exactly as a sheet does, on its own body. Only the body scrolls. The nav bar and helper bar are inside the layer, so iOS panning the visual viewport can't push them off screen, and the helper bar always sits right on the keyboard.
- **`useKeyboardInset` becomes reference-counted,** like `useScrollLock`. A module count tracks its users, and only the last one to stop resets `--keyboard-inset`, removes `--viewport-height` and drops `keyboard-open`. Without this, the Log sheet still closing (its 260ms exit) would clear them while the day page is using them.
- **Boxes grow with their text** using the replicated-value grid technique: the textarea and a hidden copy of its text (`data-value`, with the same font, padding and wrapping) share one grid cell, so the box is always as tall as its text, with no height measuring and no jump in the scroll. No box scrolls inside itself; the body is the one scroll.
- **The caret stays in view.** `useRevealFocusedField` learns to follow the caret's line:
  - A field that fits in the visible body shows whole, as today.
  - A text box taller than that shows the line with the caret, 12px clear of the nav bar and helper bar. For a box grown to fit its text, the line comes from `caretLineSpan` (the mirror in `src/lib/caret.ts`) and goes to the existing pure `revealOffset`. For a box that scrolls inside itself (the friend sheet's Notes), `caretEdge` works as today. `caretEdge` alone can't do this: a box grown to fit never overflows, so it would show the box's top.
  - Besides the keyboard opening and focus moving, it now also acts on typing (`input`) and caret moves (`selectionchange`), one frame later, only while the keyboard is up and only when the caret's line is hidden. It still never moves the body while you're just scrolling.
- **The day** uses the normal keyboard with autocorrect, predictions and dictation, so a whole stretch can be spoken on the walk home. Dragging the caret with the space bar, the loupe, select, cut, copy and paste all work, because it's a plain textarea. Pasted text is kept exactly.
- **Text in fields is never smaller than 16px,** so iOS doesn't zoom.

## Meetup page

`src/screens/MeetupScreen.tsx`, top to bottom:
1. **Nav bar:** unchanged ("Back" or the friend's name, and Edit for the Edit meetup sheet).
2. **Hero:** unchanged, except the date line gains the weather after a middle dot: "Sat, Oct 3 · 🌧️ Rainy", or "Sat, Oct 3 · 🌧️ Rainy, 🌬️ Windy". The emoji are hidden from VoiceOver. The "Upcoming" badge still follows.
3. **Activities:** unchanged.
4. **The day** (the section that was "Note"; hidden when the note is blank): one Paper White box with 14px corners and `0 1rem` padding, holding the day's parts in order, with 0.5px Soft Rule hairlines between parts.
   - **A timeline** is an ordered list. Each stop is a row at least 52px tall with `0.75rem` above and below: a time column, then the place and its lines.
     - **Time column:** 7em wide at Subhead size, rounded tabular numerals, Warm Ink Secondary, right-aligned and top-aligned. "10:30 AM"; a range adds a second line, "to 2:50 PM"; rough times show "~" ("to ~8:10 PM"). A stop without a time leaves it blank, so places still line up.
     - **Place:** Body 600 Warm Ink, wrapping anywhere.
     - **Lines:** Body Warm Ink, each its own paragraph, 0.25rem apart, at most 65ch.
     - **Paid tag:** a read-only Linen pill (min-height 28px, `0.15rem 0.6rem` padding, 1em corners, Subhead 500 Warm Ink): "🧾", then a 20px avatar when the name matches exactly one friend on the meetup (first or full name, ignoring case), then the words as written ("Jessie paid").
     - A 0.5px Soft Rule hairline sits above each stop after the first, starting at the place column. No rail, dots or stripes.
     - **Large text:** the box is a size container. Below 22em wide, the time moves above the place as a Footnote 600 Warm Ink Secondary line ("7:30 PM to ~8:10 PM"), and the place takes the full width.
   - **A heading** is Footnote 600 Warm Ink Secondary ("Locations").
   - **Prose** is one paragraph per line, Body Warm Ink, at most 65ch, with a 0.75em gap for blank lines. Paid tags show here too.
5. **How it felt** (hidden when there's no mood and no words, and for meetups dated after today): one Paper White box with 14px corners. With a mood, a row: the 44px Linen circle with the 26px face, then the word in Body 600 ("Okay"). Then the words, in Body with line breaks kept. A mood alone shows just the row; words alone show just the words. No colors and no scale.
6. **The day row:** an inset group with one row linking to `/meetups/:id/day`, with a 📝 emoji badge leading and a chevron.
   - With nothing written yet (`isDayEmpty`): an accent row, "Write about the day", with the subtitle "Places, what happened, how it felt".
   - Otherwise: "Edit the day".
   - It always sits after the day's sections and before Photos, so with an empty day it comes right after Activities.
7. **Photos:** unchanged.

There is no mood pill in the hero, and nothing on this page is edited in place.

## Friend page history

`src/screens/FriendDetailScreen.tsx`: the row subtitle is the date, "with …", the activities, then `daySnippet(meetup.note)` (it was the whole note).
- "Sat, Oct 3 · with Jessie and Brandon · Movie, Shopping · nonstopstyle, strand bookstore, Sammy L coffee and 5 more"
- An old meetup still reads "Sat, Sep 12 · with Sam · Karaoke · Tacos".
- A long note is cut at 80 characters with "…", so a row never becomes a wall.
- Weather, mood and feelings never appear in rows.

## Everywhere else

Unchanged: Stats, the Friends list and its search, Birthdays soon, notifications, the photo viewer and its alt text, the Settings Backup footer, and every existing toast. On the day page the toast sits 8px above the helper bar: the page adds `day-open` to `<html>` and publishes the bar's height as `--day-bar-height`, and `.day-open .toast-region` sits at `calc(var(--keyboard-inset, 0px) + var(--day-bar-height) + var(--space-2))` from the bottom.

## The owner's example, end to end

Saturday, Oct 3, 2026, about 9:50 PM, walking home from Seoul Saloon. Mariya, Jessie and Brandon are friends in the app.

### Writing it on the walk home

1. Friends tab, "+ Log meetup". Who: tap Mariya, Jessie and Brandon under Recent. What: "🍽️ Meal". When: Today is already picked. Activities, optional: "Movie" and "Shopping". (Tapping Save here is the usual quick log.)
2. Tap **"Save and write about the day"**, just above Save. The toast says "Logged with Mariya, Jessie and Brandon" with Undo, and the day page slides in: "‹ Meal", "The day", "Sat, Oct 3 · with Mariya, Jessie and Brandon".
3. **"Rainy day":** tap "🌧️ Rainy". Saved.
4. **"Locations:" and the story,** one place at a time. "@ Place" opens the Place row with the keyboard up; type the place and its time, tap next, and the caret waits on the line under it.
   - "@ Place", `nonstopstyle 10:30`, next. Type "Took haircut with dyno".
   - "@ Place", `strand bookstore 11:30`, next.
   - "@ Place", `Sammy L coffee 11:53`, next. Type "Read book and vibe code until 2:50".
   - "@ Place", `Blue willow 3:30`, next. Type "Walked to mariya at blue willow. Then Jessie came, then Brandon (late) due to construction", Return, "Ordered Kong pao chicken (salty) garlic string beans, szcheuan beef and jasmine dragon pearl tea.". Tap "Paid", then "Jessie": the line "Jessie paid" appears.
   - "@ Place", `hey tea Broadway`, next. Type "Walked to hey tea (got the king jasmine honeydew)".
   - "@ Place", `amc 34 5:30`, next. Type "Walked to amc and watch prime time(didn’t like it)".
   - "@ Place", `holister + @h&m 7:30 - ~8:10`, next. Type "Stalled time for dinner at holister and H&M".
   - "@ Place", `seoulSaloon 8:30`, next. Type, one line each: "Then walked to dinner @seoulsaloon", "Ate rose tteboki, fried chicken(chicken nuggets?), octopus kimbap", "Talked about relationship + movie", "Jessie Brandon age gap like 3 years", "Mariya like 3 years older 1/2 younger". Tap "Paid", then "Mariya". Return, "Split ways went home".
5. **"How I felt:"** tap "Hide keyboard", scroll down, tap "🙂 Okay", then tap the box and type "It was an ok day. I still do feel almost outsidery but it’s okay."
6. Tap "‹ Meal". Everything was saved along the way (had the phone locked halfway, nothing would be lost), and the memory shows.

Eight places, two payers and a face, with no forms, no AM/PM taps and no time wheels. Every line of the owner's message is in the record, in the owner's words and order. "Rainy day", "Locations:" and "How I felt:" became the Rainy chip, the timeline and the How it felt section.

### Pasting it instead

Copy the whole message from Notes, open the day page, tap The day and paste. It's stored exactly as pasted. The Meetup page shows "Rainy day" as a line, "Locations" as a heading, the eight places as one timeline with the same times, then the story line by line with "Jessie paid" and "Mariya paid" as tags ("Split ways went home" stays a plain line), then "How I felt" as a heading over its sentence. Nothing is lost, and the owner can still tap 🌧️ and 🙂.

### Stored record (typed version; ids shortened)

```json
{
  "id": "m1",
  "date": "2026-10-03",
  "typeId": "type-meal",
  "friendIds": ["f-mariya", "f-jessie", "f-brandon"],
  "note": "@nonstopstyle 10:30\nTook haircut with dyno\n@strand bookstore 11:30\n@Sammy L coffee 11:53\nRead book and vibe code until 2:50\n@Blue willow 3:30\nWalked to mariya at blue willow. Then Jessie came, then Brandon (late) due to construction\nOrdered Kong pao chicken (salty) garlic string beans, szcheuan beef and jasmine dragon pearl tea.\nJessie paid\n@hey tea Broadway\nWalked to hey tea (got the king jasmine honeydew)\n@amc 34 5:30\nWalked to amc and watch prime time(didn’t like it)\n@holister + @h&m 7:30 - ~8:10\nStalled time for dinner at holister and H&M\n@seoulSaloon 8:30\nThen walked to dinner @seoulsaloon\nAte rose tteboki, fried chicken(chicken nuggets?), octopus kimbap\nTalked about relationship + movie\nJessie Brandon age gap like 3 years\nMariya like 3 years older 1/2 younger\nMariya paid\nSplit ways went home",
  "activities": ["Movie", "Shopping"],
  "weather": ["rainy"],
  "mood": "okay",
  "feelings": "It was an ok day. I still do feel almost outsidery but it’s okay.",
  "createdAt": "2026-10-04T01:52:00.000Z"
}
```

### How it reads back

```
‹ Back                                                Edit
                         ( 🍽️ )
                          Meal
                 Sat, Oct 3 · 🌧️ Rainy
                          With
              (Mariya) (Jessie) (Brandon)

Activities
(Movie) (Shopping)

The day
    10:30 AM  nonstopstyle
              Took haircut with dyno
              .........................................
    11:30 AM  strand bookstore
              .........................................
    11:53 AM  Sammy L coffee
              Read book and vibe code until 2:50
              .........................................
     3:30 PM  Blue willow
              Walked to mariya at blue willow. Then Jessie
              came, then Brandon (late) due to construction
              Ordered Kong pao chicken (salty) garlic string
              beans, szcheuan beef and jasmine dragon pearl tea.
              (🧾 (J) Jessie paid)
              .........................................
              hey tea Broadway
              Walked to hey tea (got the king jasmine honeydew)
              .........................................
     5:30 PM  amc 34
              Walked to amc and watch prime time(didn’t like it)
              .........................................
     7:30 PM  holister + h&m
 to ~8:10 PM  Stalled time for dinner at holister and H&M
              .........................................
     8:30 PM  seoulSaloon
              Then walked to dinner @seoulsaloon
              Ate rose tteboki, fried chicken(chicken nuggets?),
              octopus kimbap
              Talked about relationship + movie
              Jessie Brandon age gap like 3 years
              Mariya like 3 years older 1/2 younger
              (🧾 (M) Mariya paid)
              Split ways went home

How it felt
    (🙂) Okay
    It was an ok day. I still do feel almost outsidery but it’s okay.

    [📝] Edit the day                                     ›

Photos (when there are any)
```

The dotted lines stand for hairlines. VoiceOver reads stop 7 as "holister + h&m, heading level 3. From 7:30 PM to about 8:10 PM. Stalled time for dinner at holister and H&M."

In Mariya's history the row reads "Meal", with the subtitle "Sat, Oct 3 · with Jessie and Brandon · Movie, Shopping · nonstopstyle, strand bookstore, Sammy L coffee and 5 more".

## Accessibility

**VoiceOver, the day page:**
- On arrival, focus moves to the h1 "The day" (`tabIndex={-1}`, without scrolling), so VoiceOver starts at the top. The back button reads the meetup type ("Meal").
- Sections are named by their h2s: "Weather", "The day", "How it felt". The day box is labeled "The day" and described by the hint (`aria-describedby`). The How it felt box is labeled "How it felt, in your words".
- Weather is a group named "Weather" of toggle buttons (`aria-pressed`) named by their word ("Rainy"); the emoji are `aria-hidden`.
- Mood is a group named "Mood" of four toggle buttons named "Heavy", "Okay", "Good" and "Great", in that order in both layouts. Tapping the picked one again is announced as not selected.
- The helper bar is a group named "Writing helpers" with "Add a place" (shows "@ Place"), "Add the time, 9:52 PM" (shows "Now", updated each minute), "Paid" (with `aria-expanded`) and "Hide keyboard". The Place row has a field named "Place and time", "Add" and "Close". The Who paid row is a group named "Who paid?" with "I paid" (shows "Me"), each friend's name, "We split it" (shows "Split") and "Close". Opening the Who paid row moves no focus, so the keyboard stays up; it announces "Pick who paid."
- A polite live region announces "Added Blue willow, 3:30 PM.", "Added 9:52 PM." and "Added Jessie paid.". Saves are never announced. The save error line and "This box is full." use `role="alert"`.

**VoiceOver, the Meetup page:**
- The hero's weather reads "Rainy".
- Each timeline is an ordered list named "Places, 8 stops" ("Places, 1 stop" for one). In each stop the place is an h3, so the rotor jumps from place to place, followed by a visually hidden time sentence ("At 10:30 AM.", "About 5:30 PM.", "From 7:30 PM to about 8:10 PM."); the visible time column is `aria-hidden`. Then come the lines in order. Paid tags read their words ("Jessie paid"); the 🧾 and the avatar are hidden. Headings inside the day are h3s too.
- How it felt reads "Mood: Okay" (a visually hidden "Mood: ", with the face hidden), then the words.
- The day row is a link named "Write about the day" (with its subtitle) or "Edit the day".
- History subtitles are plain words.

**Targets:** chips are 36px with invisible 44px hit areas; the helper icon buttons, Add, Close and the back button are 44px; the Place field is 44px tall; mood tiles are about 80 by 77pt; rows are at least 52px. Paid tags on the Meetup page are text, not controls.

**Dynamic Type:** everything is in rem and grows. The helper row scrolls sideways with "Hide keyboard" pinned at its end; the weather row scrolls as one line; mood tiles are four across through the largest standard size and two by two at accessibility sizes; the timeline puts its times above the places below 22em; boxes grow; text in fields is never under 16px. The new fixed-pixel exceptions are the mood face (a 44px circle with a 26px emoji) and the 20px avatar in a paid tag.

**Color and themes:** existing token pairs only, all AA in both themes: Warm Ink on Paper White and on Linen, Warm Ink Secondary for times, hints and headings, Warm Ink Tertiary for placeholders, On-Peach on Peach for picked chips and the check, and Danger Red only for the save error line. Picked never relies on color: there's `aria-pressed`, the check badge and the heavier word. Rough times show "~" and are read as "about". No mood, weather or payer gets a color.

**Reduce Motion:** the day page fades in instead of sliding, and the mood check's pop fades (the shared rule). Nothing else new moves.

**Hardware keyboard and Voice Control:** the tab order follows the page (nav bar, weather, The day, faces, How it felt, then the helper bar); Enter in the Place field adds the place; every control is named by a word you can see.

## DESIGN.md

Add:
- **Colors.** Peach: "the picked mood's ring and check". Linen: "mood faces, helper chips and paid tags". Paper White: "the day view and How it felt boxes on the Meetup page, and the day page's text boxes and Place field". Danger Red: "the day page's save error line".
- **The Dynamic Type Rule:** add "the mood face (a 44px circle with a 26px emoji)" and "the 20px avatar in a paid tag" to the fixed-pixel exceptions.
- **Meetup sheet:** rename "Meetup sheet: Activities and Photos" to "Meetup sheet: Activities, Photos and footer". Activities and Photos now follow When and end the sheet; there is no Note. Add: "Log meetup's footer has a centered 44px Terracotta Ink text button, "Save and write about the day", above the Save block button. It's disabled whenever Save is, never hidden for a missing friend, and hidden only while the keyboard is up, so Save never moves."
- **New, The day page:** "A pushed, full-screen layer at `/meetups/:id/day` that fills the screen above the keyboard (bottom at `--keyboard-inset`, height `--viewport-height`), with no tab bar. Nav bar: back (the meetup type), the title "The day". Body: the context line, Weather chips, The day box with its hint, How it felt (mood tiles and a box, only for today or earlier), and "Saves as you type, and stays on this iPhone.". Boxes are Paper White, grow with their text and never scroll inside themselves. It saves as you type; a failed save shows a Footnote Danger Red line above the helper bar."
- **New, Helper bar:** "The day page's footer, riding on the keyboard: a row of chips ("@ Place", "Now" for today's meetups, "Paid") with a 44px "Hide keyboard" button pinned at the end while the keyboard is up. "@ Place" swaps the row for a one-line Place field (autocorrect off) with Add and Close; "Paid" swaps it for "Who paid?" chips (Me, each friend, Split). Helpers never take focus from the box you're typing in."
- **New, Mood tiles:** the approved text: "Four tiles, low to high: 😔 Heavy, 🙂 Okay, 😊 Good, 😄 Great. Each is a 44px Linen circle with a 26px emoji over a Footnote Warm Ink word, four across, or two by two once a quarter of the row is narrower than 3.25rem. Nothing is picked at first. The picked tile gets the selected-friend ring and check and a 600 word; tapping it again clears it. Press is Linen Pressed, with no scale."
- **New, Weather chips:** "Eight chips in a scrolling row, ☀️ Sunny, ⛅ Cloudy, 🌧️ Rainy, ⛈️ Stormy, ❄️ Snowy, 🌬️ Windy, 🌡️ Hot, 🧣 Cold. Never a face emoji. Any number can be picked."
- **Meetup page:** the hero's date line gains the weather ("Sat, Oct 3 · 🌧️ Rainy"). "Then, each hidden when empty: Activities, The day (the day view), How it felt, the day row ("Write about the day" or "Edit the day"), and Photos."
- **New, Day view:** "The day's text read back: Paper White, 14px corners. Places form an ordered list: a 7em Subhead time column (rounded tabular, Warm Ink Secondary, right-aligned; a range adds "to 8:10 PM", rough times show "~"), the place in Body 600, then each line as its own paragraph. Hairlines (0.5px, inset to the place column) separate stops; no rails or dots. Below 22em wide the time sits above the place. Headings are Footnote 600 Warm Ink Secondary; other lines read as prose. Paid lines are read-only Linen tags: 🧾, a 20px avatar when the name matches one friend, and the words."
- **Friend detail column, History:** the subtitle becomes "the date, "with" the others, the activities, and the day's first places ("and 5 more") or its first line, cut at 80 characters".
- **Navigation:** "The tab bar is hidden on the day page."
- **Toast:** "On the day page it sits 8px above the helper bar."
- **Named rules:**
  - **The No Score Rule** (from the approved mood design): "A mood is a word about how a meetup felt to you. It is never stored or shown as a number, stars or a score; never averaged, counted, charted or ranked; never summed up per friend; never shown in lists; and no mood gets a color of its own."
  - **The No Ledger Rule:** "Who paid is a plain fact on one place, in your words. It's never totaled, balanced, counted or compared across meetups or friends."
  - **The Your Words Rule:** "The day is stored exactly as typed. The app may change how text looks when it's read back, never the text itself, and it never moves words between fields."
  - **The Frozen Grammar Rule:** "The rules that read a day (grammar 1) never change. A new rule is a new grammar for days saved after it, so a memory reads the same after every update."
- **Don'ts:** "**Don't** show moods or weather in lists, rows, Stats or summaries." "**Don't** draw timeline rails, dots or connecting lines; stops are separated by hairlines." "**Don't** rewrite, sort or move what the owner wrote."

## Testing

**Unit tests:**
- `src/lib/dayText.test.ts`:
  - **Golden fixture A,** the day as written in the app (the note in the stored record): one timeline of 8 stops with exactly these places, minutes, rough flags, lines and payers, and no prose.
  - **Golden fixture B,** the owner's message byte for byte (curly apostrophes, trailing spaces, and the two blank lines before "How I felt:"): prose "Rainy day"; the heading "Locations"; a timeline of the 8 places with the same times and no lines; prose of 15 lines with "Jessie paid" and "Mariya paid" as paid lines and "Split ways went home" as text; the heading "How I felt"; prose with the last sentence.
  - Every row of the place-line table; the paid and split cases ("Nobody paid" and "Split ways went home" stay text); headings (40 characters, 41 characters, "Note to self: buy milk"); grouping (blank lines between places keep one timeline, a blank line after a stop's lines ends it, a heading ends a timeline, several blank lines make one gap); "@" alone is skipped.
  - AM or PM: the owner's sequence; the first-time defaults (7 AM, 11 AM, 12 PM, 6 PM); "12:30" after 9 PM is 12:30 AM; "1am" after 9 PM counts past midnight; "7-9pm"; "11-1pm"; "15:30", "08:30" and "0:15" fixed; an unmarked time after a past-midnight one.
  - `daySnippet`: 8 places; 1, 2 and 3 places; repeats ignoring case; no places; the 80-character cut at a space and for one long word; a blank day gives null; "Tacos" gives "Tacos".
  - `isDayEmpty`.
  - Both golden fixtures carry a comment that they are frozen for grammar 1.
- `src/lib/dayEdit.test.ts`: `insertPlaceLine` into empty text, onto a blank line, after a line at the end (an empty line follows), and in the middle (no empty line), dropping a leading "@" and keeping an inner one; `insertPaidLine`; `insertAtCaret` spacing; replaying the walkthrough's steps (helper inserts plus typed text) gives fixture A exactly.
- `src/lib/clock.test.ts`: the 12-hour and 24-hour formats, the no-break space, "~", and every `speakTime` sentence.
- `src/lib/weather.test.ts` and `src/lib/moods.test.ts`: keys in order with distinct labels and emoji, and no face emoji in weather; `cleanWeather` (not a list, unknown keys, repeats, order); `isMood` false for "Good", "amazing", 3, "", "toString", null and undefined.
- `src/db/meetups.test.ts`: `addMeetup` stores the defaults; `updateMeetup` leaves the day alone (a day saved by `updateDay`, trailing spaces included, survives an Edit save untouched); `updateDay` writes only the given fields and never the date, type, friends or activities; it resolves false for a missing id and creates nothing; it refuses an unknown mood ("Please pick a mood from the list.") and long feelings ("Keep how it felt under 4,000 characters.") and writes nothing; it saves a 30,000-character note; it normalizes line breaks and cleans weather; delete then restore keeps the day.
- `src/db/db.test.ts`: rows written through a bare version 3 database without the new fields read back with the defaults; `mood: "amazing"` reads as null; `weather: "rainy"` reads as `[]`; `["rainy", "fog", "rainy"]` reads as `["rainy"]`; the stored rows are untouched.
- `src/backup/format.test.ts`: export writes version 5; a version 5 round trip of the owner's example keeps the note, weather, mood (null too) and feelings identical, and keeps activities and photos (the `>= 4` regression); a version 4 file with a note keeps its activities and photos, gets the defaults and keeps the note byte for byte; versions 1 to 3 get the defaults; every refusal message above, including a missing `mood`; version 6 is refused. The existing test that expects version 5 to be refused now uses version 6.
- `src/backup/storage.test.ts`: replace then read keeps the day's fields.
- `src/hooks/useKeyboardInset.test.ts` (jsdom with a fake visual viewport): two users publish; stopping the first keeps `--keyboard-inset`, `--viewport-height` and `keyboard-open`; stopping the last resets them.
- `src/hooks/useAutosave.test.ts` (fake timers): it saves 600ms after the last change and not before; chip taps save at once; it flushes on blur, `visibilitychange`, `pagehide` and unmount; one write is in flight at a time and the latest wins; a failure sets the error state, retries every 5 seconds and on the next change, and clears on success; a "gone" result stops quietly.
- `src/lib/viewport.test.ts`: the existing tests unchanged, plus `revealOffset` with a caret line inside a field taller than the view.

**E2E** (WebKit, iPhone 13):
- `e2e/day.spec.ts`:
  - **The quick log is unchanged:** the Log sheet has no Note; Save's position is the same before and after picking a friend; "Save and write about the day" is disabled until a friend is picked; Save alone logs, and the Meetup page shows "Write about the day".
  - **The owner's example, typed:** every step of the walkthrough through the helpers, with `page.clock` set to Sat, Oct 3, 2026, 9:52 PM. Then: the stored meetup, read from IndexedDB in the page, equals the stored record above apart from ids and `createdAt`; Back lands on "Meal"; the list "Places, 8 stops" has the eight places in order with "10:30 AM", "11:30 AM", "11:53 AM", "3:30 PM", no time, "5:30 PM", "7:30 PM" with "to ~8:10 PM", and "8:30 PM"; "Jessie paid" is in Blue willow's stop and "Mariya paid" in seoulSaloon's; How it felt shows "Okay" and the sentence; the hero reads "Rainy"; Mariya's history row reads exactly the subtitle above and contains neither "Okay" nor "Rainy".
  - **The owner's example, pasted:** fill The day with the message byte for byte; the Meetup page shows "Rainy day", the "Locations" heading, the 8-stop list, the story lines and the "How I felt" heading; the stored note is identical to what was pasted.
  - **Autosave:** type, wait 1 second, reload: the text is back. Type, fire `visibilitychange` to hidden at once, reload: back.
  - **App lock:** with the app lock on and text on the day page, go 16 minutes into the background (the lock spec's `ft:lastActiveAt` method) and unlock with the PIN: the day page is open with the text.
  - **Undo:** tap "Save and write about the day", type a line, tap Undo on the toast: the app goes back to Friends and the meetup is gone.
  - **Old notes:** import a version 4 backup whose note is "Tacos", a line break and "Then karaoke": The day on the Meetup page shows both lines, the history row ends "Tacos", and the day page's box holds the note.
  - **Backup round trip** of the typed example keeps the day, its activities and its photos.
  - **Helpers:** "Now" shows only on today's meetup and inserts "9:52 PM"; the Who paid row lists "Me", "Mariya", "Jessie", "Brandon" and "Split"; Close puts focus back in The day; a future-dated meetup's day page has no How it felt.
- `e2e/dayKeyboard.spec.ts`, using the fake visual viewport from `sheetKeyboard.spec.ts` (moved into a shared `e2e/keyboard.ts`):
  - The layer sits on the keyboard: `--keyboard-inset` is set, the helper bar's bottom is the keyboard's top, and "Hide keyboard" shows.
  - With iOS panning the visual viewport (offsetTop 120), the nav bar and the focused box are both on screen.
  - The day box comes into view when the keyboard opens, before any typing.
  - Typing new lines at the end of a 60-line day keeps the caret's line above the helper bar with 12px to spare, after every line.
  - Moving the caret to line 5 of 60 (`setSelectionRange`) brings that line into view.
  - Moving to the How it felt box with the keyboard up shows it above the helper bar.
  - The sheet race: tap "Save and write about the day", then open the keyboard on the day page during the sheet's exit; 400ms later `--keyboard-inset` and `--viewport-height` are still set.
- **Updated tests:** the `note` option of `logMeetup` in `e2e/helpers.ts` now taps "Save and write about the day", fills The day and taps back, so tests like "Tacos" keep their meaning. `e2e/meetupPage.spec.ts` looks for "The day" instead of "Note", and its hidden-when-empty loop covers Activities, The day, How it felt and Photos. `e2e/detail.spec.ts` keeps its history check. The Log sheet Note tests in `e2e/sheetKeyboard.spec.ts` are removed (the field is gone; their cases now live in `dayKeyboard.spec.ts`), and the friend Notes tests stay as they are.

**Screenshots** (`e2e/screenshots.spec.ts`, in light, dark and large text; the seed's "Ramen night" is written through the day page):
- `03-log-sheet`: the footer with "Save and write about the day".
- `12-meetup`: the Meetup page with the owner's example, full page.
- `15-day-empty`: the day page just after "Save and write about the day".
- `16-day-written`: the day page holding the example, full page.
- `17-day-place`: the Place row open over the fake keyboard.
- `18-day-paid`: the Who paid row.
- `ax-16-day-written` at a 33px text size: the faces two by two, and the timeline's times above the places.

Nothing compares images: review them by eye, and judge the emoji on a real iPhone.

**On a real iPhone** (what e2e can't prove): the keyboard stays up through every helper tap; "@ Place" raises the keyboard from a cold tap; shake to undo after a helper insert; dictation into The day; autocorrect off in the Place field; the 24-hour time setting.

## Build order

About 7 to 8 focused days:
1. Data: the types, `weather.ts`, `moods.ts`, `dayText.ts`, `dayEdit.ts` and `clock.ts` with their tests, the reading hook, `updateDay`, `MeetupInput` without `note`, and the fixtures.
2. Backups version 5, with the `>= 4` fix.
3. Shared hooks: the reference-counted `useKeyboardInset`, `caret.ts`, and the caret-following reveal.
4. The day page: the layer, sections, mood tiles, weather chips, helper bar and autosave.
5. The Log sheet: Note out, "Save and write about the day" in.
6. The Meetup page's reading view, the history snippet, the tab bar rule and the toast position.
7. E2E, screenshots and DESIGN.md.

## Risks and trade-offs

- **A line read differently than meant** (a heading, a time, an "X paid"). It's display only: the words still show, the text never changes, and the grammar is small, frozen and pinned by fixtures.
- **AM or PM read wrong.** It shows on the Meetup page, and typing "am" or "pm" fixes it. Adding a place higher up can change how a later unmarked time reads; this is documented, and nothing stored changes.
- **iOS editing craft** (keeping focus on helper taps, `execCommand`, the caret mirror). Plain inputs and a plain textarea, a fallback for each, e2e with the fake keyboard, and the device checklist.
- **Autocorrect in The day.** An "@" line typed by hand straight into The day still gets autocorrect; the Place field is the way around it.
- **Moving a place** means selecting, cutting and pasting its lines. Stops never move by themselves.
- **A pasted "How I felt:"** stays in The day under its own heading. The faces and the How it felt box are there for anything new; nothing moves text between fields.
- **Live-query churn:** see "Size and live queries".
- **Older builds** refuse version 5 backups (correct). A rolled-back build's one-line Edit sheet would flatten a multi-line note on Save; accepted, as with past format changes.
- **Undo on the "Logged" toast** removes the day just written, which is what Undo means there.

## Out of scope

- Turning text into stops or moving lines between fields: no "Sort into sections", and nothing reads "Rainy day" into the weather or "How I felt:" into the How it felt box.
- Sorting stops by time, an AM/PM toggle, time wheels, or reorder controls.
- Place suggestions or autocomplete from earlier days, maps, addresses, location or place search.
- Weather from the internet, or anything else that leaves the phone.
- Money: amounts, totals, balances, who owes whom, or counting who paid (the No Ledger Rule).
- Mood or weather statistics, averages, counts, charts, trends or per-friend summaries, and mood or weather in history rows, Stats, the Friends list or the hero (the No Score Rule).
- A mood, or any of the day's fields, in the Log meetup sheet.
- Mood for upcoming meetups.
- Who was at each place, or a mood per friend.
- Photos or captions attached to one place.
- Rich text, Markdown, bullets or checklists, and linking names in the text to friends beyond the paid tag's face.
- Searching, filtering or sharing days, or exporting one day as text.
- A version history of a day, or undo after leaving the page (native undo covers the page while you're on it).
- Prompts, badges, reminders or notifications to write about a day.
- AI of any kind.
- Dates per place or multi-day meetups (late-night times read as past midnight, without dates).

## Decisions made while planning

Recorded in [the plan](../plans/2026-10-05-meetup-debrief.md):

- **Golden fixtures** live in `src/test/dayFixtures.ts`, shared by the unit tests and `e2e/day.spec.ts`: fixture A is the stored record's note (808 characters) and fixture B the owner's message exactly as sent (925 characters, 31 lines, from "Rainy day" to the last sentence). Both lengths are pinned by tests.
- **Times.** "~" may have spaces after it; "about", "around", "to", "am" and "pm" are read in any case. A range's end needs minutes or am/pm like any lone clock, so "@Show 11am-1" has no time. A 24-hour phone shows two-digit hours ("09:05"). "Now" types an ordinary space before AM or PM ("9:52 PM"); only what the app shows uses the no-break space.
- **Lines.** "paid" and "for" are read in any case, and one trailing "." or "!" is dropped before matching; a tag shows the line as written ("Mariya paid."). A line that is only "@" is skipped as if it weren't there, so it doesn't end a stop's lines. Headings count characters as code points, and ":" alone is text. Line breaks are split at `\r\n`, `\r` and `\n`, so a note from a backup with Windows line breaks reads the same.
- **The timeline's large-text layout** switches below 16em, not 22em. The box's content on a 390pt iPhone is 326px, which is under 22em at every iPhone text size (17px by default), so 22em would put every time above its place. 16em keeps the side-by-side timeline at the default and larger standard sizes and moves times above places from about 21px, the largest standard sizes and every accessibility size.
- **Who paid.** `src/lib/payers.ts` names the chips (`payerLabel`: the first name, or the full name when two friends on the meetup share a first name, ignoring case) and finds a tag's face (`paidBy`: exactly one friend whose first or full name matches, ignoring case).
- **Announcements** read a new place in the day as it stands ("Added holister + h&m, 7:30 PM to about 8:10 PM."), so its time reads in day order. Escape closes the Place row too.
- **The day page** starts the scroll lock and the keyboard publishing as soon as its route opens, before its data loads, so a Log sheet still closing always hands the keyboard over. Focus moves to its title before the first paint. It sits at z-index 40: above the tab bar and pages, below sheets, the toast and action sheets. Discarding after a failed save stops the saver, so nothing is written later.
- **The toast's room** stays after a tall toast goes and resets on the next page; a new page keeps room only for a toast that is showing.
- **Tests without jsdom.** Unit tests run in Node, so the keyboard and autosave logic live in plain functions (`startKeyboardInset`, `createAutosave`, `flushWhenHidden`) tested with fakes and fake timers; the hooks are thin wrappers.
- **Between tasks** the Log sheet's one-line Note saved through `updateDay` until the sheet lost it, so every task stayed green.
- **Screenshots.** The seed adds Mariya, Jessie and Brandon; `12-meetup` shows the owner's example, logged through "Save and write about the day", while the viewer and the Edit sheet still use the seed's Meal. The accessibility-size test captures the day page (`ax-16-day-written`, faces two by two) and its Meetup page (`ax-12-meetup`, times above places).
