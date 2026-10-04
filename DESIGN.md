---
name: Friend Tracker
description: A calm, cute, minimal iPhone app for remembering when you last saw your friends.
colors:
  # Light theme (canonical source: src/styles/tokens.css :root). OKLCH is the source of truth.
  warm-paper: "oklch(96.4% 0.009 60)"          # --bg
  paper-white: "oklch(99.4% 0.004 60)"         # --surface
  linen: "oklch(93.6% 0.011 60)"               # --surface-2
  linen-pressed: "oklch(91% 0.012 60)"         # --surface-pressed
  soft-rule: "oklch(89.5% 0.009 60)"           # --separator
  warm-ink: "oklch(25% 0.014 50)"              # --ink
  warm-ink-secondary: "oklch(47% 0.014 50)"    # --ink-2
  warm-ink-tertiary: "oklch(52% 0.012 50)"     # --ink-3
  peach: "oklch(81% 0.095 50)"                 # --accent
  peach-pressed: "oklch(77% 0.105 48)"         # --accent-pressed
  on-peach: "oklch(29% 0.06 40)"               # --on-accent
  terracotta-ink: "oklch(53% 0.15 38)"         # --accent-ink
  peach-wash: "oklch(94.5% 0.03 55)"           # --accent-soft
  this-year-bar: "oklch(60% 0.13 42)"          # --bar-current
  last-year-bar: "oklch(64% 0.012 60)"         # --bar-previous
  danger-red: "oklch(55% 0.19 27)"             # --danger
  scrim: "oklch(22% 0.02 45 / 0.32)"           # --scrim
  # Dark theme (prefers-color-scheme: dark)
  warm-paper-dark: "oklch(18.5% 0.008 55)"
  paper-white-dark: "oklch(23.5% 0.009 55)"
  linen-dark: "oklch(29% 0.011 55)"
  linen-pressed-dark: "oklch(33% 0.012 55)"
  soft-rule-dark: "oklch(32% 0.01 55)"
  warm-ink-dark: "oklch(95% 0.008 70)"
  warm-ink-secondary-dark: "oklch(76% 0.012 60)"
  warm-ink-tertiary-dark: "oklch(67% 0.012 60)"
  peach-dark: "oklch(80% 0.1 50)"
  peach-pressed-dark: "oklch(75% 0.11 48)"
  on-peach-dark: "oklch(26% 0.05 40)"
  terracotta-ink-dark: "oklch(81% 0.1 52)"
  peach-wash-dark: "oklch(31% 0.04 50)"
  this-year-bar-dark: "oklch(78% 0.11 48)"
  last-year-bar-dark: "oklch(54% 0.012 55)"
  danger-red-dark: "oklch(70% 0.17 25)"
  scrim-dark: "oklch(8% 0.01 45 / 0.55)"
typography:
  large-title:
    fontFamily: "ui-rounded, 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
  title:
    fontFamily: "ui-rounded, 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
  title-3:
    fontFamily: "ui-rounded, 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif"
    fontSize: "1.18rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.35
  subhead:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 400
    lineHeight: 1.35
  footnote:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.77rem"
    fontWeight: 600
    lineHeight: 1.35
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.7rem"
    fontWeight: 500
    lineHeight: 1.2
  numeral:
    fontFamily: "ui-rounded, 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif"
    fontWeight: 600
    fontFeature: "'tnum' 1"
rounded:
  field: "12px"
  group: "14px"
  sheet: "22px"
  pill: "999px"
spacing:
  space-1: "0.25rem"
  space-2: "0.5rem"
  space-3: "0.75rem"
  space-4: "1rem"
  space-5: "1.25rem"
  space-6: "1.5rem"
  space-8: "2rem"
  space-10: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.peach}"
    textColor: "{colors.on-peach}"
    rounded: "{rounded.pill}"
    padding: "0 1.25rem"
    height: "44px"
  button-primary-active:
    backgroundColor: "{colors.peach-pressed}"
    textColor: "{colors.on-peach}"
  button-primary-block:
    backgroundColor: "{colors.peach}"
    textColor: "{colors.on-peach}"
    rounded: "{rounded.pill}"
    height: "52px"
    width: "100%"
  button-secondary:
    backgroundColor: "{colors.linen}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.pill}"
    padding: "0 1.25rem"
    height: "44px"
  text-button:
    textColor: "{colors.terracotta-ink}"
    height: "44px"
    padding: "0 0.5rem"
  log-meetup-pill:
    backgroundColor: "{colors.peach}"
    textColor: "{colors.on-peach}"
    rounded: "{rounded.pill}"
    padding: "0 1.5rem 0 1.25rem"
    height: "52px"
  chip:
    backgroundColor: "{colors.linen}"
    textColor: "{colors.warm-ink}"
    typography: "{typography.subhead}"
    rounded: "{rounded.pill}"
    padding: "0 14px"
    height: "36px"
  chip-selected:
    backgroundColor: "{colors.peach}"
    textColor: "{colors.on-peach}"
  field:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.field}"
    padding: "0.6rem 0.9rem"
    height: "44px"
  search-field:
    backgroundColor: "{colors.linen}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.field}"
    padding: "0 0.75rem"
    height: "44px"
  inset-group:
    backgroundColor: "{colors.paper-white}"
    rounded: "{rounded.group}"
  list-row:
    textColor: "{colors.warm-ink}"
    typography: "{typography.body}"
    padding: "0.5rem 1rem"
    height: "52px"
  bottom-sheet:
    backgroundColor: "{colors.warm-paper}"
    rounded: "{rounded.sheet}"
  tab-bar:
    backgroundColor: "{colors.paper-white}"
    textColor: "{colors.warm-ink-tertiary}"
    typography: "{typography.caption}"
    height: "50px"
  tab-bar-active:
    textColor: "{colors.terracotta-ink}"
  toast:
    backgroundColor: "{colors.warm-ink}"
    textColor: "{colors.warm-paper}"
    rounded: "26px"
    height: "52px"
  stat-row:
    backgroundColor: "{colors.paper-white}"
    typography: "{typography.numeral}"
    rounded: "{rounded.group}"
    padding: "1rem 0.5rem"
  install-hint:
    backgroundColor: "{colors.peach-wash}"
    textColor: "{colors.warm-ink}"
    rounded: "{rounded.group}"
    padding: "1rem"
---

# Design System: Friend Tracker

## 1. Overview

**Creative North Star: "The Pocket Address Book"**

A small, well-loved address book that lives in your pocket: soft rounded corners, warm paper-toned neutrals, and one peach accent that shows up only where you act. It belongs on an iPhone and is built from Apple's own patterns (large titles, inset grouped lists, bottom sheets, a tab bar). The cuteness comes from rounded type, pastel initial avatars, and one small happy moment on save, never from decoration.

The layout is one calm column, thumb-first. Content sits in a phone-width column (max 600px, centered on larger screens) with a 16px side margin (`space-4`) that the large title, search field, chips, and inset groups all share, so every left edge lines up. Sections breathe at 1.5rem (`space-6`) apart; inside a group, rows are tight and divided by hairlines. The primary action, "+ Log meetup", floats as a pill 16px above the tab bar, and the page's bottom padding (tab bar plus 96px) keeps the last row reachable above it. Density is moderate: one friend per row, plain dates and counts, nothing competing for attention.

It explicitly rejects **a business CRM** (friends are not leads: no pipelines, dense tables, or cold "last contacted" language), **guilt-trip streaks** (no Duolingo-style pressure, red alerts, or "you're losing touch!" shaming), **a social media feed** (not busy, noisy, attention-grabbing, or endlessly scrolling), and **a generic template app** (no purple gradients, identical card grids, or anything that looks AI-generated).

Motion is responsive, not choreographed: 160ms for taps and color changes (`--dur-fast`), 220ms for fades (`--dur`), 340ms for sheets and pushed screens (`--dur-sheet`), always easing out (`--ease-out-quart` `cubic-bezier(0.25, 1, 0.5, 1)` and `--ease-out-expo` `cubic-bezier(0.16, 1, 0.3, 1)`). With Reduce Motion on, every slide, scale, and pop falls back to a plain fade.

**Key Characteristics:**
- Restrained color: warm tinted neutrals (hue 50 to 70, chroma 0.004 to 0.014) plus one peach accent on 10% of the screen or less.
- Apple-native structure: large titles, sticky compact nav bar, inset grouped lists, bottom sheets, action sheets, a three-tab bar.
- Rounded type (SF Pro Rounded) for titles, names, and numbers; SF Pro for everything you read or type.
- Both themes are first-class: the dark theme is warm near-black paper, not an inversion.
- Dynamic Type everywhere: 1rem follows the iPhone text-size setting and layouts wrap and grow rather than truncate.

## 2. Colors: The Warm Paper Palette

Warm, paper-toned neutrals tinted toward peach, with a single soft peach accent in two strengths: a fill for things you press and a deeper terracotta for peach-colored text.

### Primary
- **Peach** (`--accent`, light `oklch(81% 0.095 50)`, dark `oklch(80% 0.1 50)`): the fill for primary buttons, the "+ Log meetup" pill, selected chips, the selected-friend ring and check, the camera badge on the friend photo, and the toast's check mark. Text on it is always **On-Peach** (`--on-accent`, `oklch(29% 0.06 40)` / `oklch(26% 0.05 40)`), 7.8:1 in light and 8.2:1 in dark. Pressed: **Peach Pressed** (`--accent-pressed`).
- **Terracotta Ink** (`--accent-ink`, light `oklch(53% 0.15 38)`, dark `oklch(81% 0.1 52)`): peach-family text and icons. Nav bar actions (Edit, Cancel, back), header icon buttons, the active tab, accent rows such as "Export backup", and the 2px focus ring. 5.1:1 on paper in light, 10.1:1 in dark.
- **Peach Wash** (`--accent-soft`, light `oklch(94.5% 0.03 55)`, dark `oklch(31% 0.04 50)`): a quiet tint for the install hint card, the "Upcoming" badge, and the back circle of the empty-state art.

### Secondary: chart pair
- **This-Year Bar** (`--bar-current`, light `oklch(60% 0.13 42)`, dark `oklch(78% 0.11 48)`): the selected year's data in month bars and horizontal bars. Deeper than Peach in light mode so a thin bar still reads (4.1:1 against the surface).
- **Last-Year Bar** (`--bar-previous`, light `oklch(64% 0.012 60)`, dark `oklch(54% 0.012 55)`): the comparison year, a warm gray. Every chart pairs these with a legend and numbers; color is never the only signal.

### Neutral
- **Warm Paper** (`--bg`, light `oklch(96.4% 0.009 60)`, dark `oklch(18.5% 0.008 55)`): the page and sheet background. The PWA `theme-color` matches it (#F8F2ED light, #16120F dark).
- **Paper White** (`--surface`, light `oklch(99.4% 0.004 60)`, dark `oklch(23.5% 0.009 55)`): inset groups, the tab bar, text fields inside sheets, the stat row, chart containers, the "Last seen" pill, action sheet groups.
- **Linen** (`--surface-2`, light `oklch(93.6% 0.011 60)`, dark `oklch(29% 0.011 55)`): unselected chips, search fields, secondary buttons, emoji badges, icon-button press. **Linen Pressed** (`--surface-pressed`) is the row and action-sheet press state.
- **Soft Rule** (`--separator`, light `oklch(89.5% 0.009 60)`, dark `oklch(32% 0.01 55)`): 0.5px hairlines between rows, the sheet grabber, the tab bar's top edge, and the compact nav bar's bottom edge.
- **Warm Ink** (`--ink`, light `oklch(25% 0.014 50)`, dark `oklch(95% 0.008 70)`): primary text, 14.4:1 on paper.
- **Warm Ink Secondary** (`--ink-2`, light `oklch(47% 0.014 50)`, dark `oklch(76% 0.012 60)`): subtitles, section labels, footers, trailing values, the stats comparison line, neutral reorder arrows. 6.2:1 on paper.
- **Warm Ink Tertiary** (`--ink-3`, light `oklch(52% 0.012 50)`, dark `oklch(67% 0.012 60)`): placeholders, chevrons, inactive tabs, month initials. Still 5.0:1 on paper and 4.6:1 on Linen, so it passes AA as text.
- **Scrim** (`--scrim`, light `oklch(22% 0.02 45 / 0.32)`, dark `oklch(8% 0.01 45 / 0.55)`): dims the page behind sheets and action sheets.

### Destructive
- **Danger Red** (`--danger`, light `oklch(55% 0.19 27)`, dark `oklch(70% 0.17 25)`): destructive action-sheet buttons ("Delete friend", "Discard changes", "Replace all data"), destructive rows, and form field errors. Nothing else.

### Avatar tints
Six soft pastel pairs (`.tint-0` to `.tint-5`, hues 50, 85, 145, 215, 285, 350), chosen per friend by hashing the friend id so a tint survives renames. Light: background `oklch(91% 0.045 h)`, initials `oklch(42% 0.08 h)`. Dark: background `oklch(36% 0.05 h)`, initials `oklch(90% 0.05 h)`. Every pair is above 6.3:1. These are the only non-peach hues in the app, and they live only inside avatars.

### Named Rules
**The One Peach Rule.** Peach appears only on things you can act on, the current selection, or the current year's data. If more than about 10% of a screen is peach, something is decorative and must go. Repeated controls (a column of reorder arrows) stay neutral Warm Ink Secondary so they don't outshout the list.

**The Two Peaches Rule.** Peach is a fill; Terracotta Ink is a text color. Never set text in Peach on paper (1.7:1) and never put Terracotta Ink text on a Peach fill. Text on a Peach fill is On-Peach.

**The No Alarm Rule.** No red, orange, or warning colors for "haven't seen in a while". Time since is plain Warm Ink Secondary text. Danger Red is reserved for destructive actions only.

## 3. Typography

**Display Font:** SF Pro Rounded (with ui-rounded first, then the system font; also used for numerals)
**Body Font:** SF Pro (with -apple-system, BlinkMacSystemFont, system-ui)

**Character:** Apple's rounded face gives titles, names, and numbers a soft, friendly voice; plain SF Pro keeps body text, labels, and controls feeling native. Two faces from one family, so the pairing never fights.

### Hierarchy
- **Large Title** (rounded, 700, 2rem, line-height 1.15): the page title on Friends, Stats, Settings, Groups, and Meetup types. Wraps (never truncates) and shares the 16px left edge with the content below.
- **Title** (rounded, 700, 1.5rem, line-height 1.2): the friend's name in the detail hero and the Stats year. The Stats summary sentence ("4 meetups with 4 friends.") uses it at 600 with `text-wrap: balance`.
- **Title 3** (rounded, 600, 1.18rem): empty-state headlines (balanced, max 22ch). The "+ Log meetup" pill uses rounded 600 at 1.06rem.
- **Body** (SF Pro, 400, 1rem, line-height 1.35): row titles, fields, buttons (600), sheet titles (600). Prose blocks (notes, About your data) cap at 65ch.
- **Subhead** (0.88rem): row subtitles, chips, the "Last seen" pill, hint and note text (line-height 1.45 for multi-line help).
- **Footnote** (600, 0.77rem): section labels above inset groups and form sections ("Top friends", "Who", "What"), action-sheet titles, group footers (400), stat-row labels (400).
- **Caption** (0.7rem): tab bar labels (500, capped at 13px), the "this year" label under counts, the "Upcoming" badge (600), month initials (capped at 18px).

### Named Rules
**The Dynamic Type Rule.** The root font is `-apple-system-body`, so 1rem follows the iPhone text-size setting; every type size and spacing step is in rem. Layouts must survive the largest standard size (about 23px body): rows grow taller, subtitles wrap, the stat row stays three across up to about 28px and stacks beyond, the "+ Log meetup" pill stays on one line. The only fixed-pixel exceptions are avatars, icons (except the Log pill's plus, which is 1.15em), tab labels (capped at 13px), month initials (capped at 18px), input text (never below 16px, so iOS doesn't zoom), and the lock screen's keypad and the Face ID switch (listed under "Lock screen and PIN pad").

**The Rounded Numbers Rule.** Counts and years use the `.numeric` treatment: the rounded face with tabular numerals, so columns of numbers line up.

**The Rounded Is For Voice Rule.** The rounded face is for titles, names, numbers, avatars, and the Log pill. Body copy, labels, form fields, and buttons stay in SF Pro.

## 4. Elevation

Flat by default, with depth from tonal layering, as in iOS Settings: Paper White groups sit on a slightly darker Warm Paper page, and Linen marks controls inside them. In dark mode the same steps run the other way (page 18.5%, groups 23.5%, controls 29% lightness), so surfaces rise by getting lighter. Only things that truly float above content cast a shadow, and a Scrim dims what's behind a sheet.

### Shadow Vocabulary
- **Float** (`box-shadow: 0 10px 30px oklch(35% 0.04 45 / 0.16), 0 2px 6px oklch(35% 0.04 45 / 0.1)`): `--shadow-float`, a soft warm two-layer lift for the bottom sheet, the "+ Log meetup" pill, and the toast. Nothing else.
- **Float, dark** (`box-shadow: 0 10px 30px oklch(5% 0 0 / 0.5), 0 2px 6px oklch(5% 0 0 / 0.4)`): the same token in dark mode, deeper so it still reads against near-black paper.

### Named Rules
**The Flat-By-Default Rule.** If a resting list, card, or section has a shadow, remove it. Grouping is done with surface color and 14px corners, never with shadows or borders.

**The No Glass Rule.** No blur, no translucency, no backdrop filters. The sticky nav bar is solid Warm Paper and gains a 0.5px Soft Rule hairline when the large title scrolls under it.

## 5. Components

### Buttons
- **Shape:** fully rounded pills (`999px`), at least 44px tall.
- **Primary:** Peach fill, On-Peach 600 text, `0 1.25rem` padding. Pressed: Peach Pressed and a 0.97 scale over 160ms. Disabled: 45% opacity. The sheet footer uses the block variant: full width, 52px tall, 1.06rem.
- **Secondary:** Linen fill, Warm Ink text, same shape.
- **Text button:** no fill, Terracotta Ink text, 44×44 minimum, fades to 50% opacity on press. Used for Cancel, Edit, and the back button. The back button always keeps its chevron; a long label truncates with an ellipsis instead.
- **Icon button:** 44px circle, Terracotta Ink glyph, Linen circle on press. Neutral (Warm Ink Secondary) when repeated in a list, such as reorder arrows. Disabled: Warm Ink Tertiary at 45%.
- **Focus:** a 2px Terracotta Ink outline with a 2px offset on every focusable element.

### "+ Log meetup" pill (signature)
The thumb-reachable primary action on Friends and friend detail. Peach fill, On-Peach rounded 600 text at 1.06rem, a plus icon at 1.15em, 52px tall, Float shadow, fixed 16px above the tab bar. It's centered with auto margins and `width: max-content` (never `left: 50%` plus a translate, which halves its available width and wraps the label at large text). Pressed: Peach Pressed and a 0.96 scale.

### Chips
- **Style:** Linen pill, 36px tall with an invisible extension to a 44px hit area, `0 14px` padding, Subhead 500 text, no wrapping inside a chip (except the wrapping variant below).
- **Selected:** Peach fill with On-Peach text, announced with `aria-pressed`. Selected-friend tokens in the log sheet use the same look with a 24px avatar and a close glyph.
- **Wrapping (`.chip--wrap`):** for user-entered items, such as a friend's likes and dislikes. Long text wraps inside the chip instead of overflowing. It keeps the 36px minimum height with `6px 14px` padding, is capped at the full width, and has `1.2em` corners: a pill on one line, a soft rounded box when the text wraps.
- **Layouts:** a horizontally scrolling row that bleeds to the screen edges for filters and meetup types; a wrapping cluster for group pickers, dates, and a friend's likes and dislikes.

### Inset groups and rows
- **Container:** Paper White, 14px corners, no shadow, no border. A Footnote section label sits above (inset 16px from the group edge, aligned with row text) and an optional footer below.
- **Row:** at least 52px tall, `0.5rem 1rem` padding, `0.75rem` gap. Leading slot is 44px wide (avatar or emoji badge); main text is a Body title with a Subhead Warm Ink Secondary subtitle, both wrapping; trailing values in Warm Ink Secondary; an 18px Warm Ink Tertiary chevron for navigation.
- **Separators:** 0.5px Soft Rule hairlines, inset to the text edge (past the 44px leading slot when rows have one), never full-bleed.
- **Press:** Linen Pressed background over 160ms. Accent rows use Terracotta Ink titles; destructive rows use Danger Red.

### Inputs and fields
- **Field:** Paper White on Warm Paper (inside sheets), 12px corners, 44px minimum height, `0.6rem 0.9rem` padding, no border. Labels are Footnote 600 Warm Ink Secondary above the field. Placeholders are Warm Ink Tertiary.
- **Search:** Linen, 12px corners, 44px tall, an 18px magnifier in Warm Ink Tertiary. Focus draws the 2px Terracotta Ink outline around the whole field.
- **Error:** Footnote Danger Red text under the field, announced with `role="alert"`.
- **Hint (`.field-hint`):** a neutral note under a field for things that aren't errors, such as "Already in Likes.". Footnote Warm Ink Secondary, announced with `role="alert"`, never red.
- **Select row (`.birthday-row`):** native selects, so iOS shows its wheel, with the Field look, `appearance: none` and a 16px Warm Ink Tertiary chevron. The empty choice ("Month", "Day", "No year") is Warm Ink Tertiary, like a placeholder. The friend sheet's Birthday puts Month, Day and Year in one row of equal-height fields, Month widest (flex bases 7.5em, 4.5em and 6em); at large text sizes the row wraps. Each select has its own accessible name ("Birthday month"); an error sits under the row and the selects point to it with `aria-describedby`. A "Remove birthday" text button under the row clears all three.

### Bottom sheets
Used for adding or editing a friend, logging a meetup, and editing groups and types. Warm Paper with 22px top corners and the Float shadow, rising over 340ms with ease-out-expo, draggable to dismiss from its header. Header: a 36×5px Soft Rule grabber, then a three-column bar with Cancel (text button), a centered Body 600 title, and an optional trailing action. Body: 16px side padding, sections 1.5rem apart. Footer: a hairline-topped bar holding the block primary button above the safe area. Cancelling with unsaved changes asks first through an action sheet.

### Action sheets and confirms
iOS-style stacks pinned to the bottom with 8px margins: a Paper White group (14px corners) with an optional centered Footnote 600 title and message, 56px buttons in Terracotta Ink at 1.1rem divided by hairlines, then a separate Cancel group in 600. Destructive buttons use Danger Red. The sort chooser is a `dialog`; destructive confirms are an `alertdialog`.

### Toast
The one happy moment. An inverted pill (Warm Ink background, Warm Paper text, Float shadow), 52px tall, above the Log pill. Its 26px corners keep it a pill on one line and make it a soft box when a long message wraps. It layers above sheets but below action sheets, so an open action sheet's scrim covers it. A 24px Peach circle draws its check mark in over 420ms; an optional "Undo" pill sits at the end. It stays 5 seconds, 8 with an action, and pauses while touched or focused.

### Navigation
- **Nav bar:** sticky, 44px plus the safe area, solid Warm Paper. Back and actions in Terracotta Ink. When the large title scrolls away, a centered Body 600 title fades in and a 0.5px Soft Rule appears underneath.
- **Tab bar:** fixed, Paper White, 50px plus the safe area, hairline on top. Three tabs (Friends, Stats, Settings) with 26px line icons over Caption labels: Warm Ink Tertiary at rest, Terracotta Ink with a heavier stroke and 600 label when current.

### Avatars
Circles. Initials in the rounded face (600, 40% of the size) on a per-friend pastel tint, or a cropped photo. Sizes: 44px in rows, 52px in the recent-friends grid, 96px in the detail hero, 24 to 28px inside chips.

### Friend detail column
Reads as one calm column, not a grid of cards: centered 96px avatar, Title name, group in Warm Ink Secondary, then a Paper White "Last seen" pill (Subhead, 1em corners so it becomes a soft box if large text wraps it between the date and the time since). Below: the notes, then **Birthday**, **Likes** and **Dislikes** (people before numbers), then the stat row, "Month by month", and the history grouped by month.
- **Birthday:** always shown. With a birthday, one inset row: a 🎂 emoji badge leading, the date as the title ("March 14, 1996", or "March 14" without a year), the countdown as the subtitle ("In 12 days · turns 31", "Tomorrow", "Today"), and a chevron. Tapping it opens the Edit friend sheet. Without one, a "+ Add birthday" chip opens the same sheet. Plain facts: no color, badge or reminder copy.
- **Likes and Dislikes:** each a section with a Footnote label over a wrapping cluster of item chips (the wrapping variant) on the page background, with no container. The cluster ends with a "+ Add" chip; tapping it puts a Paper White field and a secondary **Add** button in its place (one field open at a time). Notes under the field ("Already in Likes.", "This list is full.") are Footnote Warm Ink Secondary with `role="alert"`, never red. Tapping an item opens an action sheet titled with it: **Move to Dislikes** (or **Move to Likes**) and a destructive **Remove**, which an Undo toast reverses. An empty list shows only the "+ Add" chip.

### Birthdays soon
An inset group titled "Birthdays soon" at the top of the Friends tab, above the search field, listing friends whose birthday is today or in the next 14 days, soonest first. Each row is a link with the 44px avatar, the name and the countdown ("Today · turns 31", "Tomorrow", "In 5 days"), like the friend rows below it. At most 3 rows; the footer counts the rest ("And 3 more in the next two weeks."). The group is hidden when no birthday is that close, while searching, and while a group filter is on, so the list below stays a plain filtered list.

### Stat row
One Paper White group (not three cards) with three centered items: a 1.6rem rounded numeral over a Footnote Warm Ink Secondary label. Wraps to one item per line only at accessibility text sizes.

### Charts
- **Month bars:** twelve month pairs on Paper White, last year then this year, each bar at most 8px wide with 3px top corners, 128px tall. A Footnote legend sits top right; month initials in Warm Ink Tertiary. The chart carries a full text description for VoiceOver.
- **Horizontal bars:** a list of label rows, each with "count · last year: n" values and two 6px bars (this year over last year). A zero is a 6px round dot, never a sliver.

### Empty states
Centered: two overlapping circles (Peach Wash and Peach at 75%) as a quiet mark, a balanced Title 3 headline, a balanced Warm Ink Secondary message, then at most one primary button. The copy is kind and plain ("Add the people you want to keep up with.").

### Lock screen and PIN pad
Shown instead of the app, never over it, when the app lock is on and the app has been away 15 minutes or more. One centered column on Warm Paper: the two-circle mark (72×48px), "Friend Tracker is locked" in Title 3 (rounded, 600), "Enter your PIN" in Subhead Warm Ink Secondary, an optional "Unlock with Face ID" primary pill (52px), the PIN pad, and a "Forgot PIN?" text button.
- **Dots:** six 14px circles with a 1.5px Warm Ink Secondary ring, filled Warm Ink as digits go in. A wrong PIN clears them with one 400ms shake (none with Reduce Motion).
- **Message line:** one reserved Subhead line under the dots in Warm Ink Secondary, never red: "Wrong PIN. Try again.", or the "Try again in 0:30" countdown (`role="timer"`) while PIN entry is paused.
- **Keys:** Paper White circles, 72px (shrinking to no less than 64px on short screens, so large text still fits) with rounded tabular digits (capped at 34px), Linen Pressed on press, in a 3×4 grid: 1 to 9, a blank, 0, and a quiet delete glyph that appears once a digit is entered.
- **Fixed pixel sizes (exceptions to the Dynamic Type Rule):** the keypad is a touch target and a fixed shape, so it does not grow with text size. The key size `clamp(64px, 10dvh, 72px)`, the 14px row and 24px column gaps between keys, the 14px dots, and the 51×31px Face ID switch in Settings stay in pixels. Everything around them (prompts, messages, buttons, the sheet's intro) follows the text size.
- The same pad sits in the Turn on app lock, Change PIN, Turn off app lock and Reset PIN sheets, under a Title 3 prompt that takes focus when the step changes, so VoiceOver reads it once.
- The website sign-in page (`server/loginPage.ts`) is a standalone copy of this look: the mark, a Title, a password field and a block primary button, in both themes.

## 6. Do's and Don'ts

### Do:
- **Do** keep the "+ Log meetup" pill in the bottom third of the screen, 16px above the tab bar, reachable by thumb.
- **Do** use iOS-native patterns: large titles, inset grouped lists, bottom sheets, action sheets, a bottom tab bar.
- **Do** make every tap target at least 44×44pt; extend small visuals (36px chips) with an invisible hit area.
- **Do** keep every left edge on the 16px page margin: large title, search, chips, and inset groups.
- **Do** phrase "time since" neutrally ("Last seen 3 months ago", "Not seen yet"), never as a warning.
- **Do** let text wrap and rows grow at large text sizes. Truncate only where iOS does (the back label, a two-line name under an avatar).
- **Do** use undo toasts instead of confirmation dialogs where the action is easily reversible; confirm only destructive, hard-to-undo actions.
- **Do** pair every chart color with a legend and the numbers themselves.
- **Do** check both themes: every text pair passes WCAG AA (Warm Ink Tertiary on Linen is the floor at 4.6:1).

### Don't:
- **Don't** look like a business CRM: no pipelines, dense tables, or cold "last contacted" language. Friends are not leads.
- **Don't** add guilt-trip streaks: no Duolingo-style pressure, red alerts, overdue badges, or "you're losing touch!" shaming.
- **Don't** feel like a social media feed: nothing busy, noisy, attention-grabbing, or endlessly scrolling.
- **Don't** look like a generic template app: no purple gradients, identical card grids, gradient text, or glassmorphism.
- **Don't** use colored side-stripe borders on rows or cards, or any border thicker than a 0.5px hairline.
- **Don't** put a shadow on anything that rests on the page; Float is for the sheet, the Log pill, and the toast only.
- **Don't** use Danger Red, orange, or any warning color for anything except a destructive action.
- **Don't** set peach text on paper; use Terracotta Ink.
- **Don't** center fixed elements with `left: 50%` and a translate; use auto margins.
- **Don't** use bouncy or elastic animations; ease out smoothly, and fade instead when Reduce Motion is on.
- **Don't** open a modal as the first answer; prefer sheets, inline editing, and undo.
- **Don't** use em dashes in UI copy; use commas, colons, periods, or parentheses.
