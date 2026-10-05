// Golden fixtures for reading a day (grammar 1). FROZEN: never edit them. They pin how every saved day reads
// back, so a memory never reads differently after an update. A change to the reading rules is a new grammar
// with fixtures of its own (see src/lib/dayText.ts). Shared by the unit tests and e2e/day.spec.ts.

/** Fixture A: the owner's day of Sat, Oct 3, 2026 as written in the app with the helpers (the spec's stored record). */
export const OWNER_DAY_TYPED = [
  '@nonstopstyle 10:30',
  'Took haircut with dyno',
  '@strand bookstore 11:30',
  '@Sammy L coffee 11:53',
  'Read book and vibe code until 2:50',
  '@Blue willow 3:30',
  'Walked to mariya at blue willow. Then Jessie came, then Brandon (late) due to construction',
  'Ordered Kong pao chicken (salty) garlic string beans, szcheuan beef and jasmine dragon pearl tea.',
  'Jessie paid',
  '@hey tea Broadway',
  'Walked to hey tea (got the king jasmine honeydew)',
  '@amc 34 5:30',
  'Walked to amc and watch prime time(didn’t like it)',
  '@holister + @h&m 7:30 - ~8:10',
  'Stalled time for dinner at holister and H&M',
  '@seoulSaloon 8:30',
  'Then walked to dinner @seoulsaloon',
  'Ate rose tteboki, fried chicken(chicken nuggets?), octopus kimbap',
  'Talked about relationship + movie',
  'Jessie Brandon age gap like 3 years',
  'Mariya like 3 years older 1/2 younger',
  'Mariya paid',
  'Split ways went home',
].join('\n')

/** Fixture B: the owner's message exactly as sent, curly apostrophes, trailing spaces and blank lines included. */
export const OWNER_MESSAGE = [
  'Rainy day',
  'Locations:',
  '',
  '@nonstopstyle 10:30',
  '@strand bookstore 11:30',
  '@Sammy L coffee 11:53',
  '@Blue willow 3:30, ',
  '@hey tea Broadway ',
  '@amc 34 5:30',
  '@holister + @h&m 7:30 - ~8:10',
  ' @seoulSaloon 8:30. ',
  '',
  'Took haircut with dyno ',
  'Read book and vibe code until 2:50',
  'Walked to mariya at blue willow. Then Jessie came, then Brandon (late) due to construction',
  'Ordered Kong pao chicken (salty) garlic string beans, szcheuan beef and jasmine dragon pearl tea. ',
  'Jessie paid',
  'Walked to hey tea (got the king jasmine honeydew)',
  'Walked to amc and watch prime time(didn’t like it)',
  'Stalled time for dinner at holister and H&M ',
  'Then walked to dinner @seoulsaloon',
  'Ate rose tteboki, fried chicken(chicken nuggets?), octopus kimbap ',
  'Talked about relationship + movie ',
  'Jessie Brandon age gap like 3 years ',
  'Mariya like 3 years older 1/2 younger',
  'Mariya paid ',
  'Split ways went home ',
  '',
  '',
  'How I felt:',
  'It was an ok day. I still do feel almost outsidery but it’s okay.',
].join('\n')

/** The rest of the owner's stored record: How it felt, in their words. */
export const OWNER_FEELINGS = 'It was an ok day. I still do feel almost outsidery but it’s okay.'
