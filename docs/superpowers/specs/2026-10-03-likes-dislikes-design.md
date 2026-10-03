# Likes and dislikes: design

Date: 2026-10-03. Status: approved (the owner asked for best-practice decisions without approval stops).

## Goal

Give each friend a dedicated place for what they like and what they'd rather avoid, quick to add to in the moment you remember it ("she hates cilantro") and easy to scan when planning a meetup or a gift.

## Decisions

- **Two lists per friend: Likes and Dislikes.** Short items ("Sushi", "Board games", "Early mornings"), not free text. Notes stay for everything else.
- **Shown and edited on the friend's page,** not in the Edit friend sheet. Adding is inline, so it takes a tap and a few words.
- **Tapping an item offers Move and Remove.** Remove is easy to undo (a toast with Undo), so there's no confirmation, matching DESIGN.md's "undo toasts instead of confirmation dialogs".
- **Search on the Friends tab also matches likes,** so "hiking" finds who likes hiking. Dislikes aren't matched: searching "hiking" should never list people who hate it.
- **Out of scope:** reordering items, editing an item's text in place (remove and re-add), other categories (gift ideas, allergies), showing likes anywhere else.

## Data

`Friend` gains two fields:

```ts
likes: string[]     // in the order added, oldest first
dislikes: string[]
```

**Item rules,** in one pure module (`src/lib/preferences.ts`) shared by the data layer and the backup parser:
- An item is trimmed, and runs of whitespace (including newlines) become one space. Empty items are dropped.
- At most **60 characters** after cleaning. The input allows 300 characters so several items can be typed at once; each item over 60 is refused with a `ValidationError`.
- A list never holds the same item twice, comparing case-insensitively (`toLocaleLowerCase`). The first spelling wins.
- At most **50 items** per list.
- Typed text is split on commas and newlines, so "sushi, hiking" adds two items.
- An item is never in both lists. Adding to one list an item that's in the other moves it, keeping the new spelling.

**Data functions** (`src/db/preferences.ts`), each one Dexie `rw` transaction on `friends` that throws `ValidationError('This friend no longer exists.')` for a missing friend:
- `addPreferences(friendId, kind, text)`: splits and cleans `text`, appends the new items (moving any from the other list), and returns `{ added: string[], skipped: string[] }`. `skipped` holds items already in this list. If the list would pass 50 items it throws `ValidationError('This list is full.')` and changes nothing. An item over 60 characters throws `ValidationError('Keep each one under 60 characters.')` and changes nothing.
- `removePreference(friendId, kind, item)`: removes the case-insensitive match and returns its index, or `-1` if absent.
- `restorePreference(friendId, kind, item, index)`: the Undo. It puts the item back at `index` (clamped to the list length), unless the item is already in this list. If it's in the other list by now, it's moved back.
- `movePreference(friendId, from, item)`: removes the item from `from` and appends it to the other list.

`kind` is `'likes' | 'dislikes'`. Move and restore also respect the 50-item limit, throwing `ValidationError('This list is full.')`. The page shows that message as a plain toast.

**Database upgrade.** `db.version(2)` keeps the same stores (no new indexes) and runs an upgrade that sets `likes` and `dislikes` to `[]` on every friend missing them. Nothing else is touched. `version(1)` stays declared. `addFriend` creates friends with empty lists, and `updateFriend` never touches the lists (it updates only the sheet's fields).

## Backups

- Export writes `version: 2`, and each friend carries `likes` and `dislikes`.
- Import accepts version 1 and version 2:
  - **Version 1:** friends get empty lists.
  - **Version 2:** each list must be an array of strings, or the file is refused. Items are cleaned with the same rules: duplicates and empties are dropped quietly, but an item over 60 characters or a list over 50 items refuses the file with a clear message (`Friend 3 has an invalid "likes" list.`).
- Any other version keeps today's message: "This backup was made by a different version of Friend Tracker."
- The lock settings are still never in backups, and importing still keeps them.

## Friend page

Order: hero, notes, **Likes**, **Dislikes**, stat row, Month by month, History. People before numbers.

Each list is a `Section` (Footnote group title "Likes" or "Dislikes") holding a wrapping chip cluster on the page background, with no container:

```
LIKES
(Sushi) (Board games) (Hiking) (+ Add)

DISLIKES
(Cilantro) (Early mornings) (+ Add)
```

- **Item chips** use the Linen chip look. Long items wrap inside the chip instead of overflowing: a `.chip--wrap` modifier that allows wrapping, keeps the 36px minimum height with vertical padding, and caps the width at 100%. A tap opens an action sheet titled with the item, offering **Move to Dislikes** (or **Move to Likes**) and **Remove** (destructive), then Cancel.
  - **Remove:** the item disappears and a toast says `Removed “Sushi”` with **Undo**, which restores it in place.
  - **Move:** the chip appears in the other list. No toast.
- **"+ Add" chip** (plus icon, accessible name "Add a like" / "Add a dislike"). Tapping it replaces the chip, in place, with a row holding a field and a secondary **Add** button (the same pattern as "New group" in the friend sheet).
  - The field takes focus and has `enterKeyHint="done"`, `autoCapitalize="sentences"` and `maxLength={300}`. Placeholders: Likes "Sushi, hiking…", Dislikes "Cilantro, early mornings…". Accessible names: "New like" / "New dislike".
  - **Enter or Add** saves the text, clears the field and keeps focus, so several can be added in a row.
  - **Blur:** text left in the field is saved, then the field closes. An empty field just closes.
  - **Escape** closes the field without saving.
  - Only one add field is open at a time on the page. Opening the other list's closes this one, saving its text.
- **Messages** appear under the field as a Footnote with `role="alert"`, in Warm Ink Secondary (never red, since these aren't errors):
  - every typed item was already in the list: "Already in Likes."
  - the list is full: "This list is full."
  - an item is too long: "Keep each one under 60 characters."

  A save failure uses the existing plain toast: "Couldn't save. Please try again."
- **Empty lists** show only the "+ Add" chip. No extra copy.

## Friends search

The filter keeps a friend when the query is in their name or in any of their likes (case-insensitive substring). When a friend matches only through a like, the row subtitle gains `Likes <item>` (the first matching like, as stored) after the existing parts, for example `Work · 3 weeks ago · Likes Hiking`. The no-results message stays as is.

## Friend sheet

The Notes placeholder becomes "Birthday, partner's name", since favourite things now have their own home.

## DESIGN.md

- Under **Friend detail column**, add the Likes and Dislikes sections.
- Under **Chips**, add the wrapping variant for user-entered items.

## Testing

**Unit tests:**
- the cleaning, splitting, dedupe and limit rules;
- every data function, including move-on-add, restore at index, the full and too-long errors, and the missing-friend error;
- the v1 to v2 database upgrade: build a version-1 database with a friend that has no lists, open the app database, and see empty lists with everything else unchanged;
- backup parsing for v1 (empty lists) and v2 (cleaned, refused when invalid), export writing v2, and import keeping lists;
- the search predicate and its subtitle.

**E2E (WebKit, iPhone 13):**
- add a like, add two at once with a comma, see "Already in Likes." for a duplicate;
- add a dislike, move it to Likes, remove an item and Undo it;
- the lists persist after a reload;
- searching a like finds the friend with the subtitle;
- export and import keeps the lists.

**Screenshots:** the friend page with both lists, in light, dark and large text.

## Decisions made while planning

Recorded in [the plan](../plans/2026-10-03-likes-dislikes.md):

- **Repeats in one entry.** "sushi, Sushi" adds one item (the first spelling). Only items already in the list count as skipped.
- **Field length.** The add field allows 300 characters, so several items fit in one entry. Each item is still limited to 60 characters.
- **After Enter or Add.** A save that works clears the field, even when every item was already there (then "Already in Likes." shows). A refused save ("This list is full.", "Keep each one under 60 characters.") keeps the text so it can be fixed. Enter on an empty field closes it, like the keyboard's Done.
- **A field that closes with text in it** (blur, or opening the other list's field) saves it. If that text can't be saved (an item over 60 characters, or the list is full), the field stays open with its text and the hint, so nothing is lost.
- **Clear button.** A "Clear text" button (iOS style) appears in the field whenever it has text.
- **Switching apps.** Blur while the app is in the background (`!document.hasFocus()`) doesn't close the field.
- **Taps inside the lists keep the field focused.** While a field is open, tapping Add, the other list's "+ Add" or an item doesn't blur the field first, so nothing moves under the finger before the tap lands. The other list's "+ Add" saves and switches; an item's action sheet takes focus, so the field saves and closes behind it.
- **Focus.** After Remove, focus moves to the neighbouring chip or "+ Add". After Move, it goes to the moved chip. After Escape, or Enter on an empty field, it goes to "+ Add" (with no visible ring for the Enter case). A tap away doesn't move focus.
- **Announcements.** After items are added, a polite live region announces "Added ...". It is cleared when the field closes.
- **Toast layering.** Toasts sit between sheets and action sheets (z-index 55), so an action sheet's scrim covers a pending Undo toast. A toast that wraps becomes a soft box with 26px corners.
- **Failure toasts.** A move or remove that fails for a reason other than these rules shows "Couldn't save. Please try again."; a failed Undo shows "Couldn't undo. Please try again." All are plain toasts.
- **Backups.** List limits are checked after cleaning. Items aren't split on commas. An item in both lists of an edited file stays in Likes.
- **Stale actions.** Removing an item that's already gone does nothing. Moving an item the other list already has just removes it from this one.
- **Missing lists.** A Dexie reading hook fills in missing `likes` and `dislikes` on read. This covers friends written later by older code, such as a second tab or a rollback.
