# Sheet details, @ highlighting, swipeable friends and Save in the corner: design

Date: 2026-10-21. Status: approved (the owner asked for best-practice decisions without approval stops: "Auto approve").

## Owner feedback (verbatim)

1. "It seems like I am not able to put in some details when creating a new meetup."
2. "I want to be able to make it highlighted when I use '@ some place'."
3. "I would like to swipe to find my friends too. It seems like I can only see 8 friends right now when trying to log a meeting."
4. "I think the save button should just be on the top right when logging a new meetup."
5. "The keyboard and save button currently is taking up 50% of the screen when searching for friends."

## Goal

Make logging a meetup complete and comfortable in one sheet: pick any friend with a swipe, write what happened right there, see which lines become places as you type, and save from the top right like other iPhone sheets.

## Decisions

- **The day box in the meetup sheets.** The Log meetup and Edit meetup sheets get a "The day" text box after Photos. It edits the meetup's `note` (the same text The day page edits) and saves with the meetup. No new data and no backup change.
- **@ highlighting everywhere the day is typed.** While typing, every line the frozen grammar reads as a place (exactly the lines `readPlaceLine` in `src/lib/dayText.ts` accepts, so "@ some place" and "@Blue willow 3:30" both count, "@" alone does not) gets a soft highlight behind it. This applies in the sheet's The day box and on The day page. The highlight means "this line will show as a place in the timeline".
- **Swipe through every friend.** The Who section's 8-friend grid becomes a horizontally swipeable strip of all friends, two rows high, in the same order as today (most recently seen first, then never seen, by name). Search stays below it.
- **Save in the top right.** The meetup sheets and the friend sheet put Save in the header's trailing slot (Cancel left, title centered, Save right), as iOS sheets do. The footer's block Save button goes away.
- **"Save and write about the day" stays** in the Log sheet as a full-width secondary button at the end of the sheet body, for weather, mood and How it felt on The day page.
- **Out of scope:** changing the frozen grammar, highlighting anything the grammar doesn't read as a place (an "@" in the middle of a sentence), times or paid lines highlighting, reordering friends, favorites, and the Groups/Types screens.

## The day box in the meetup sheets

- **Placement.** A new section after Photos: a label "The day" (`form-section__label`, the same look as Who, What, When) and a `GrowField` with `minLines={4}`.
- **Copy.** Placeholder "What happened? Start a line with @ for a place." The hint under the box, in Footnote Warm Ink Secondary, reads "Lines that start with @ show as places." It is linked with `aria-describedby`.
- **Typing.** `autoCapitalize="sentences"`, `autoCorrect="on"`, `spellCheck`, `maxLength={DAY_MAX_TYPED}` (the same limit as The day page), and `enterKeyHint` left at its default so Return makes a new line.
- **Saving.**
  - Log: the new meetup is created with this text as its `note`.
  - Edit: the box starts with the meetup's current `note`, and Save writes the new text.
  - Both go through the meetup data layer in the same transaction as the rest of the meetup. Bring `note` back into `MeetupInput`, or write it with `updateDay` inside the same save, whichever keeps the transaction and validation clean. Trailing whitespace is kept exactly as typed, as The day page does.
- **Changes count.** The box counts toward the sheet's dirty tracking, so Cancel with typed text asks "Discard changes?" as the sheet already does for other changes.
- **Keyboard.** The sheet's existing reveal keeps the box above the keyboard (`useRevealFocusedField`). No new keyboard code.
- **The day page is unchanged** apart from the highlighting below. Text typed in the sheet shows there, and the other way round.

## @ highlighting

- **Look.** Each place line gets a soft Peach Wash (`--accent-soft`) rounded background behind its text, with the text itself unchanged. It's never the only signal: the place line also reads as a place on the Meetup page.
- **How.** A backdrop layer sits behind the textarea in the same grid cell as `GrowField`'s replicated copy. It has the same font, padding, line height, `white-space: pre-wrap` and wrapping, and renders the text with transparent glyphs, with each place line wrapped in a `<mark class="day-place">` that carries the background. The textarea's background becomes transparent so the marks show through. The textarea's own text stays visible, so if the layers ever disagree by a pixel, only the tint shifts and the text is never doubled or hidden. `GrowField` already never scrolls inside itself, so no scroll syncing is needed.
- **Reuse.** One component, for example `GrowField` with an optional `highlight` prop or a new `DayField` that wraps it, is used by both the sheet box and The day page's main box. The line test is the grammar's own `readPlaceLine` (export it, or a small `isPlaceLine(line)` built on it) so highlighting can never disagree with the timeline.
- **Accessibility.** Purely visual. The backdrop is `aria-hidden`, and the textarea's value, label and description are unchanged.
- **Themes.** Uses tokens only, so it works in light, dark and large text.

## Swipeable friends in Who

- **Order.** All friends, in `recentFriends` order without the 8 limit: most recently seen first, then never seen, by name. Selected friends keep showing as chips above, as now.
- **Layout.**
  - A horizontal scroller with two rows (`grid-auto-flow: column`, `grid-template-rows: repeat(2, auto)`). Columns are a little narrower than a quarter of the width, so the fifth column peeks in and shows there is more.
  - `overflow-x: auto`, `overscroll-behavior-x: contain`, `scroll-snap-type: x mandatory`, with each column snapping at its start.
  - `touch-action: pan-x pan-y`, and no visible scrollbar.
  - With 8 or fewer friends it looks the same as today, just not scrollable.
- **Edges.** The strip runs to the sheet's edges, with the first column on the 16px margin, like the meetup type chip row.
- **Accessibility.**
  - The group is named "Friends". Each tile stays a toggle button (`aria-pressed`) named by the friend's name, so VoiceOver swipes through every friend in order.
  - Keyboard focus scrolls the focused tile into view.
- **Search** ("Search all friends") stays below the strip, unchanged.

## Room to search friends (owner feedback 5)

- **Today the footer eats the space.** The sheet's footer (the block Save button, plus "Save and write about the day" when the keyboard is down) stays above the keyboard, so with the keyboard up the friend search results get about half the screen. Removing the footer (Save moves to the header, below) gives that room back.
- **The search field goes to the top.** When "Search all friends" gets focus, or its text changes while it has focus, the sheet body scrolls so the field sits at the top of the visible part of the body, 12px below the header, and the results fill the space down to the keyboard. This is a deliberate, single scroll, adjusting only `.sheet__body`'s scroll position, like the reveal hook. It must not fight `useRevealFocusedField`, which keeps a focused field in view: for this field, run the top alignment after the reveal, or teach the reveal an opt-in "align to top" per field, for example `data-reveal="top"`. Nothing moves while the owner scrolls the results by hand.
- **Test it.** An e2e with the fake keyboard (e2e/sheetKeyboard.spec.ts helpers) checks that, with 12 friends, focusing the search and typing one letter puts the field at the top of the visible body. It also checks that at least 4 result rows are visible above the keyboard on the iPhone 13 profile, and that there is no footer.

## Save in the top right

- **Sheet header.** `Sheet` gets an optional trailing `action`. When it's given, the right side of the header shows it instead of the invisible spacer. The title stays centered: equal side columns sized to the wider of the two sides, and the title still wraps at large text sizes.
- **The action.** A text button in Terracotta Ink, weight 600, 44 by 44px minimum, labeled "Save". It's disabled (45% opacity, `aria-disabled` handled as the codebase does) when saving isn't possible.
- **Meetup sheets.**
  - Save is disabled until a friend is picked, while photos are being added, and while saving.
  - There is no "Pick a friend" label, button or hint anywhere (the owner, after this design: "I don't think there should be a pick friend button, it is implied when I click on their profile that I am picking that friend."). Save is always labeled "Save" and simply stays dimmed until a friend is picked, the standard iOS pattern; VoiceOver reads it as dimmed. Nothing else explains it.
  - Errors ("Couldn't save. Please try again." and validation messages) show at the top of the sheet body with `role="alert"`.
- **Friend sheet.** Save moves to the header the same way. It's disabled while saving or processing a photo. A missing name still shows its existing error under Name and focuses the field.
- **Footer.**
  - The meetup sheets drop their footer entirely. The Log sheet's "Save and write about the day" becomes a full-width secondary button (Linen) at the end of the body, after The day box. It's disabled under the same rules as Save, and keeps the same behavior.
  - The friend sheet drops its footer too.
- **Everything else stays.** Keyboard shortcuts and Enter behaviors that called save keep calling it. The discard confirm, Undo toasts and focus management are unchanged.

## Accessibility

- Header Save is a real `button`, named "Save", reachable after Cancel in focus order.
- Before a friend is picked, Save is a disabled button, so VoiceOver reads "Save, dimmed". No hint or `aria-describedby` goes with it.
- The day box has a label and a hint description.
- The friend strip keeps a sensible VoiceOver order.
- 44px targets everywhere, and Dynamic Type at the largest sizes: the header wraps the title, Save stays tappable, and the strip's tiles grow with their names.

## DESIGN.md

- **Bottom sheets:** the header's trailing Save, and that sheets no longer use a footer Save.
- **Chips and tiles:** the swipeable two-row friend strip.
- **Inputs and fields:** the place highlight in The day boxes.

## Testing

**Unit tests:**
- the place-line predicate matches `readDay` for every golden fixture line (each line is a place exactly when the grammar makes a stop from it);
- friend ordering without the limit;
- any pure helper the highlight uses (for example, splitting text into marked and unmarked runs, including trailing newlines and an empty last line).

**E2E tests:**
- **Log with The day text.** Log a meetup with The day text typed in the sheet (including "@Blue willow 3:30"). It saves, and the Meetup page timeline shows the place.
- **Edit The day text.** Edit the text in the Edit sheet, then check The day page shows the change.
- **Discard.** Cancel with typed text asks to discard.
- **Highlight.** A `mark.day-place` appears for "@ some place" and "@Blue willow 3:30", not for "@", nor for a sentence with "@" in the middle. It's on both the sheet box and The day page.
- **Swiping friends.** With 12 friends, the 12th is reachable by scrolling the strip horizontally and can be picked, and the strip has more than 8 tiles.
- **Header Save.**
  - It's disabled before a friend is picked (and no "Pick a friend" text shows anywhere), and saves after.
  - Every existing e2e that clicked the footer Save or "Pick a friend" is updated to the header Save.
  - The friend sheet saves from the header too.
- **Existing tests:** all existing e2e and unit tests stay green.

**Screenshots:** the Log sheet with the strip, The day box with a highlighted place line, and the header Save, in light, dark and large text; The day page with highlights.
