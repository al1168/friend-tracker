# Meetup memories (activities and photos): design

Date: 2026-10-03. Status: approved. The owner asked for "activities I can select so I can remember the day" and "pictures as well", with best-practice decisions and no approval stops.

## Goal

Make each meetup a small memory: what you did, plus a few photos, and a page to look back at it.

## Decisions

- **Activities are short, selectable tags on a meetup** ("Karaoke", "Board games"). They're picked from chips: activities you've used before come first, then a few starters, plus "+ New" for your own. They aren't a managed list; an activity you stop using simply stops being suggested.
- **Activities aren't meetup types.** The type stays the one kind of meetup (Coffee, Meal, Party…). Activities say what you did, and a meetup can have several.
- **Photos:**
  - Up to **20 per meetup**.
  - Resized on the phone before saving. Each photo is stored at full size (longest side 1600px, JPEG at 0.8) with a small thumbnail (longest side 320px, JPEG at 0.75).
  - Stored only on the phone, and included in backups.
- **A new Meetup page** is the memory view: type, date, who, activities, note and photos, plus a full-screen photo viewer. Its **Edit** button opens the existing meetup sheet. Tapping a meetup in a friend's history now opens this page instead of the sheet.
- **Out of scope:** captions per photo, video, sharing photos out of the app, editing photos, searching by activity, activity statistics, and choosing a cover photo.

## Data

```ts
interface Meetup {
  // ...existing fields
  activities: string[]  // tags in the order picked, cleaned like likes: trimmed, single-spaced, at most 60 characters, case-insensitive unique, at most 20
}

interface MeetupPhoto {
  id: string
  meetupId: string
  order: number          // 0-based position in the meetup
  full: string           // data:image/jpeg;base64,... (longest side ≤ 1600)
  thumb: string          // data:image/jpeg;base64,... (longest side ≤ 320)
  width: number          // of full
  height: number
  createdAt: string
}
```

**Storage:**
- Photos live in their own table, `meetupPhotos: 'id, meetupId'`, added in **Dexie `version(3)`**. They're never stored inside meetups, so the many places that load every meetup (stats, history, last seen) never load photo data.
- The existing reading hook pattern applies: meetups get `activities ??= []` on read.
- The v3 upgrade only adds the table.

**Data functions:**
- `addMeetup` and `updateMeetup` take `activities` (cleaned with the shared item rules from `src/lib/preferences.ts`).
- `addMeetup` and `updateMeetup` also take a photo change set: `{ add: NewPhoto[], removeIds: string[], order: string[] }`. All of it is applied in **one transaction** with the meetup write.
- `deleteMeetup` returns the meetup **and its photos**, and `restoreMeetup` (Undo) puts both back.
- `deleteFriend` also deletes the photos of meetups it deletes.
- `replaceAllData` and `readAllData` include photos.

**Suggestions:** `activitySuggestions(meetups)` returns every activity used before, sorted by how often it's used (then by name). After those come the starters not yet used: Board games, Karaoke, Movie, Walk, Concert, Shopping, Cooking, Sports, Beach, Museum. That's pure and unit tested.

## Backups

- **Version 4:** meetups carry `activities`, and there's a new top-level `meetupPhotos` list.
- **Importing v1 to v3 files:** meetups get `activities: []`, with no photos.
- **Validation:**
  - Photo `full` and `thumb` must be `data:image/jpeg;base64,` or `data:image/png;base64,` strings, `full` at most 4 MB and `thumb` at most 512 KB.
  - Each photo's `meetupId` must exist, with at most 20 photos per meetup.
  - Otherwise the file is refused with `Photo N is invalid.` or `Meetup N has an invalid "activities" list.`.
- Backups with many photos are large. The Backup section footer shows the photo count when there are any: "Includes 12 photos."

## Meetup sheet (log and edit)

Two new sections after **When** and before **Note**:

- **Activities.** A wrapping chip cluster built from `activitySuggestions`, shown 12 at a time.
  - Selected chips use the selected look (`aria-pressed`). An activity already on this meetup always shows, even if it isn't in the first 12. A "More" chip reveals the rest.
  - The last chip is "+ New", which opens an inline field with an Add button, the same pattern as the friend sheet's "New group". Adding an activity selects it.
- **Photos.** A grid of square thumbnails (3 across), with an "Add photos" tile, a dashed Linen square with a camera-plus icon. Each thumbnail has a 44px remove button ("Remove photo 2").
  - **The picker** is `<input type="file" accept="image/*" multiple>`. On iPhone it offers Photo Library, Take Photo and Choose File.
  - **Adding:** photos are resized one at a time, and the tile shows "Adding 2 of 5…". Past 20, the extras are skipped with the message "A meetup can have up to 20 photos." A photo that can't be read is skipped with "1 photo couldn't be added.".
  - **Saving:** changes are held in the sheet and saved with Save, so Cancel discards them. Dirty tracking includes activities and photos.
- **Storage:** the first time a photo is saved, call `navigator.storage.persist()` as a best effort.

## Meetup page (`/meetups/:id`)

- **Navigation bar:** a back button ("Back", or the friend's name when opened from a friend's page, using the existing back-label state pattern) and **Edit**, which opens the meetup sheet.
- **Hero:**
  - the type's emoji in a large badge;
  - the type name as the title, with the date under it (`formatDate`), and an "Upcoming" badge for future dates;
  - "With" and the friends as avatar chips; tapping one opens that friend.
- **Then, in order:**
  - **Activities:** chips, read-only. The section is hidden when there are none.
  - **Note:** text. Hidden when empty.
  - **Photos:** a 3-across grid of thumbnails. Tapping one opens the viewer. Hidden when there are none.
- **If the meetup is deleted** (from the sheet), go back, as the friend page does for a deleted friend.

**Photo viewer:**
- A full-screen dialog with a dark backdrop (the one place a near-black ground is used), showing the full image fit to the screen.
- A close button (44px, "Close"), "2 of 5" text, previous and next buttons, swipe left and right, and arrow keys.
- Escape closes it.
- Focus is trapped while open and goes back to the thumbnail on close.
- No zoom (out of scope).
- Reduced motion: no slide, just a fade.

## Friend page history

- **Tapping a row** opens the Meetup page, not the sheet.
- **Row subtitle:** the date, "with …", then the activities (comma list, before the note), then the note.
- **Photos:** when the meetup has photos, a 40px rounded-square trailing thumbnail of the first photo. Thumbnails load per row with a live query on that meetup's first photo, so only thumbnails are read.

## DESIGN.md

Add:
- the Activities chips, and the Photos grid and Add tile in sheets;
- the Meetup page;
- the photo viewer (the dark ground is the one exception);
- the history thumbnail.

## Testing

**Unit tests:**
- `activitySuggestions`;
- activity cleaning on add and update;
- the photo change set in one transaction: add, remove, reorder, and rollback on failure;
- delete and restore with photos;
- `deleteFriend` cascading to photos;
- the Dexie v3 upgrade from a real v2 database (meetups get activities, the photos table exists, nothing else changes);
- backups v4: round-trip with photos; v1 to v3 import; invalid photo or activities refused;
- the photo-count footer text.

**E2E:**
- log a meetup with two activities (one new) and two photos (use small fixture images via `setInputFiles`);
- the Meetup page shows them;
- the viewer opens, goes next, and closes with focus back on the thumbnail;
- remove a photo in Edit;
- Cancel discards photo changes;
- the history row shows activities and a thumbnail;
- delete plus Undo restores the photos;
- a backup round trip keeps photos and activities.

**Screenshots:** the meetup sheet with activities and photos, the Meetup page, and the viewer, in light, dark and large text.
