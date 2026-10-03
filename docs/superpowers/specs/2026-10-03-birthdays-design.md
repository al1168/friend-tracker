# Birthdays: design

Date: 2026-10-03. Status: approved (the owner asked for best-practice decisions without approval stops). Part 1 of 2; part 2, an 11:55 PM reminder notification, gets its own spec and builds on this data.

## Goal

Remember each friend's birthday and see the next ones coming, so the owner never misses one.

## Decisions

- **A birthday is a month and a day, with an optional year.** People often don't know a friend's birth year.
- **Edited in the Edit friend sheet,** next to name, group and notes, like a birthday in iOS Contacts. That means it can be set when adding a new friend too.
- **Shown on the friend's page** in a Birthday section, and on the Friends tab in a **Birthdays soon** group covering today and the next 14 days.
- **Feb 29 birthdays** are celebrated on Feb 28 in years without a Feb 29.
- **Facts, not pressure.** Plain dates and day counts. No red, no badges, no "don't forget!".
- **Out of scope** (part 2 covers reminders): notifications, calendar export, zodiac signs, a birthday sort order, birthdays in search, and birthdays in Stats.

## Data

`Friend` gains:

```ts
birthday: Birthday | null

interface Birthday {
  month: number        // 1-12
  day: number          // 1-31, valid for the month (Feb allows 29)
  year: number | null  // 1900 to the current year, or null when unknown
}
```

**Validity** is checked in one pure module, `src/lib/birthdays.ts`:
- `month` is an integer from 1 to 12, and `day` is an integer valid for that month (Feb 29 allowed).
- `year` is null or an integer from 1900 to the current year. With a year, the date must exist: Feb 29 needs a leap year, and the date can't be in the future.

**Storage.** No index changes, so no Dexie version bump. The existing friends `reading` hook in `src/db/db.ts` also sets `friend.birthday ??= null`. `addFriend` and `updateFriend` take and write `birthday`. `FriendInput` gains `birthday: Birthday | null`, and the data layer throws `ValidationError('Pick a valid birthday.')` for an invalid value.

**Helpers** in `src/lib/birthdays.ts`, all pure and taking `today: ISODate`:
- `nextBirthday(b, today): ISODate`. The next date it falls on, today included. Feb 29 maps to Feb 28 in non-leap years.
- `daysUntilBirthday(b, today): number`. 0 means today.
- `ageOnNextBirthday(b, today): number | null`. Null without a year.
- `formatBirthday(b): string`. "March 14, 1996", or "March 14" without a year.
- `describeNextBirthday(b, today): string`. One of "Today", "Tomorrow" or "In 12 days" (any count from 2 up). With a year, the age is added with a dot: "Today · turns 31", "In 12 days · turns 31".
- `upcomingBirthdays(friends, today, days = 14)`. Friends whose next birthday is within `days`, sorted soonest first, then by name.

## Backups

- Export writes `version: 3`, and each friend carries `birthday` (an object or null).
- Import accepts versions 1, 2 and 3. In v1 and v2 files, friends get `birthday: null`. In v3 files, `birthday` must be null or a valid birthday per the rules above, or the file is refused with `Friend N has an invalid birthday.`.
- Any other version keeps the "different version" message.

## Edit friend sheet

A **Birthday** form section after Group and before Notes:

```
BIRTHDAY
[ Month ▾ ] [ Day ▾ ] [ Year ▾ ]
```

- **Three native selects** in a row, which give iOS wheels:
  - **Month:** first option "Month" (empty), then January to December.
  - **Day:** first option "Day" (empty), then 1 up to the month's length. Feb shows 29, and with no month chosen the days run to 31.
  - **Year:** first option "No year", then the current year down to 1900.
- **Accessible names:** "Birthday month", "Birthday day", "Birthday year". Each select has the `.field` look, the same height, and shares the row (Month wider). At large text sizes the row wraps.
- **Changing the month** to one where the chosen day doesn't exist (Jan 31 to Feb, for example) resets Day to empty.
- **Validation on Save:**
  - Month and day both empty: no birthday (null).
  - Only one of them set: error "Pick a month and a day." under the row.
  - Feb 29 with a non-leap year, or a date after today: error "That date doesn't exist." or "That date is in the future.", in the existing `.field-error` style.
- **When a birthday is set,** a "Remove birthday" text button sits under the row and clears all three selects.
- **Dirty tracking** and the discard confirm include the birthday.
- **Notes placeholder:** "Partner's name, how you met", since the birthday has its own field now.

## Friend page

Order: hero, notes, **Birthday**, Likes, Dislikes, stat row, Month by month, History.

The **Birthday** section always shows:
- **With a birthday:** one inset row with a 🎂 emoji badge leading. The title is `formatBirthday` ("March 14, 1996") and the subtitle is `describeNextBirthday` ("In 12 days · turns 31"). Tapping the row opens the Edit friend sheet (it's a button row with a chevron, the same as the history rows).
- **Without one:** a "+ Add birthday" chip, with accessible name "Add birthday", that opens the Edit friend sheet.

The sheet doesn't need to scroll to the field; it's near the top.

## Friends tab: Birthdays soon

Above the search field, an inset group titled **Birthdays soon** lists `upcomingBirthdays(friends, today, 14)`:
- **Rows:** each has the avatar leading, the name as title, and `describeNextBirthday` as the subtitle (for example "Today · turns 31", "Tomorrow", "In 5 days · turns 40"). Tapping a row opens the friend.
- **When it shows:**
  - Hidden when the list is empty, while searching (the query isn't empty), and while a group filter is active, so the list stays a plain filtered list.
  - Hidden when the owner has no friends yet (the empty state shows).
- **Size:** at most 5 rows. If more are due, the group's footer says "And 3 more in the next two weeks."

## DESIGN.md

- In **Friend detail column**, add the Birthday section.
- In **Inputs and fields**, add the select row.
- In **Components**, add a short **Birthdays soon** subsection: an inset group above the search field on the Friends tab, with at most 5 rows and its footer.

## Testing

**Unit tests:**
- **Validity:** month and day ranges, Feb 29 with and without a year, future dates, 1900.
- **`nextBirthday`:**
  - today vs past this year;
  - Dec 31 rolling into January;
  - Feb 29 in leap and non-leap years.
- **The other helpers:** `daysUntilBirthday`, `ageOnNextBirthday`, `formatBirthday`, every `describeNextBirthday` branch, and `upcomingBirthdays` (window, order, ties broken by name).
- **Data layer:** `addFriend`/`updateFriend` validation, the reading hook default, and backups (v1/v2 give null, v3 valid and refused, export writes v3).

**E2E:**
- **Add and edit:** add a birthday in the sheet, with and without a year; see it on the friend page with the countdown; edit it; remove it.
- **Validation:** "Pick a month and a day.", and a Feb 29 non-leap year error.
- **Birthdays soon:** shows a friend whose birthday is within 14 days, is hidden while searching, and opens the friend.
- **Backup:** export and import keeps birthdays.

**Screenshots:** the friend page with a birthday, and the Friends tab with Birthdays soon, in light, dark and large text.
