<!-- SEED: re-run /impeccable document once there's code to capture the actual tokens and components. -->
---
name: Friend Tracker
description: A calm, cute, minimal iPhone app for remembering when you last saw your friends.
---

# Design System: Friend Tracker

## 1. Overview

**Creative North Star: "The Pocket Address Book"**

A small, well-loved address book that lives in your pocket: soft rounded corners, warm paper-toned neutrals, and one peach accent that shows up only where you act. It looks like it belongs on an iPhone, built from Apple's own patterns (large titles, inset grouped lists, bottom sheets, a tab bar), with the cuteness carried by rounded type, friendly avatars, and gentle motion rather than decoration.

The interface is mobile-first and thumb-first. The primary action (log a meetup) sits at the bottom of the screen; everything else is a calm list. Density is moderate: one friend per row, generous spacing, nothing competing for attention.

It explicitly rejects the business CRM look, guilt-trip streaks, the social media feed, and the generic template app (see PRODUCT.md).

**Key Characteristics:**
- Restrained color: warm tinted neutrals plus one peach/coral accent.
- Apple-native structure with rounded, friendly type.
- Follows the system light/dark setting; both themes are first-class.
- Responsive motion: quick feedback and sheet transitions, one small happy moment on save.

## 2. Colors

Warm, paper-toned neutrals tinted toward peach, with a single soft peach/coral accent. Exact values `[to be resolved during implementation]` in OKLCH.

### Primary
- **Peach / coral accent**: primary buttons, selected chips, the active tab, and "this year" data. Hue family around warm peach-coral.

### Neutral
- **Warm paper background, warm ink text, soft dividers**: tinted toward the accent hue at very low chroma. Never pure black or white.

### Named Rules
**The One Peach Rule.** The accent appears only on things you can act on or the current year's data. If more than about 10% of a screen is peach, something is decorative and must go.

**The No Alarm Rule.** No red, orange, or warning colors for "haven't seen in a while". Red is reserved for destructive actions (delete) only.

## 3. Typography

**Display / Numerals Font:** SF Pro Rounded (`ui-rounded`), falling back to the system font
**Body Font:** SF Pro (`-apple-system`, `system-ui`)

**Character:** Apple's rounded face gives headings and numbers a soft, friendly voice; plain SF Pro keeps body text and controls feeling native.

### Named Rules
**The Dynamic Type Rule.** Base size comes from the iPhone's text-size setting (`font: -apple-system-body`); every other size scales from it in `rem`. Nothing is set in fixed pixels.

**The Rounded Numbers Rule.** Counts and dates in stats use the rounded face with tabular numerals so columns line up.

## 4. Elevation

Flat by default, using tonal layering: the page background is slightly darker than the grouped list surfaces sitting on it, as in iOS Settings. Shadows appear only on things that float above content: the bottom sheet, the floating Log button, and toasts.

**The Flat-By-Default Rule.** If a resting list or section has a shadow, remove it.

## 6. Do's and Don'ts

### Do:
- **Do** keep the Log meetup action in the bottom third of the screen, reachable by thumb.
- **Do** use iOS-native patterns: large titles, inset grouped lists, bottom sheets, a bottom tab bar.
- **Do** make every tap target at least 44×44pt.
- **Do** phrase "time since" neutrally ("Last seen 3 months ago"), never as a warning.
- **Do** use undo toasts instead of confirmation dialogs where the action is easily reversible.

### Don't:
- **Don't** look like a business CRM: no dense tables, pipelines, or cold "last contacted" language.
- **Don't** add guilt-trip streaks: no red alerts, overdue badges, or "you're losing touch!" copy.
- **Don't** feel like a social media feed: no busy, noisy, attention-grabbing layouts.
- **Don't** look like a generic template app: no purple gradients, identical card grids, gradient text, or glassmorphism.
- **Don't** use colored side-stripe borders on rows or cards.
- **Don't** use bouncy or elastic animations; ease out smoothly instead.
- **Don't** open a modal as the first answer; prefer sheets, inline editing, and undo.
