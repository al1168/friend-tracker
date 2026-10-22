const DAY_PAGE = /^\/meetups\/[^/]+\/day$/

/**
 * Whether `pathname` is a meetup's day page (`/meetups/:id/day`). It fills the screen, so it has no tab bar, and it
 * shows no toast: it says what it needs in its own lines.
 */
export function isDayPage(pathname: string): boolean {
  return DAY_PAGE.test(pathname)
}
