// Pure string edits for the day page's helper bar. Each returns the new text and where the caret goes.
// Everything is placed relative to the caret in The day.

export interface DayEdit {
  value: string
  caret: number
}

/** The start and end of the line holding the caret. */
function lineAround(value: string, caret: number): { start: number; end: number } {
  const start = caret === 0 ? 0 : value.lastIndexOf('\n', caret - 1) + 1
  const next = value.indexOf('\n', caret)
  return { start, end: next === -1 ? value.length : next }
}

/**
 * Puts `line` on its own line: it replaces a blank line holding the caret, or goes on a new line after the
 * caret's line. `openLine` adds an empty line after it, with the caret there, when it lands at the end of the text.
 */
function placeLine(value: string, caret: number, line: string, openLine: boolean): DayEdit {
  const { start, end } = lineAround(value, caret)
  const blank = value.slice(start, end).trim() === ''
  const before = blank ? value.slice(0, start) : `${value.slice(0, end)}\n`
  const after = value.slice(end)
  if (after === '' && openLine) {
    const next = `${before}${line}\n`
    return { value: next, caret: next.length }
  }
  return { value: `${before}${line}${after}`, caret: before.length + line.length }
}

/**
 * Adds a place line ("@Blue willow 3:30") from the Place field's text. A leading "@" typed into the field is
 * dropped, so there's never "@@". At the end of the text an empty line follows with the caret on it, ready for
 * what happened there; in the middle the caret goes to the end of the place line, so no blank line splits what's
 * below. Text that is empty once trimmed changes nothing.
 */
export function insertPlaceLine(value: string, caret: number, text: string): DayEdit {
  const place = text.trim().replace(/^@+/, '').trim()
  if (place === '') return { value, caret }
  return placeLine(value, caret, `@${place}`, true)
}

/** Adds "Jessie paid" (or "I paid", "We split it") as its own line, with the caret at its end. */
export function insertPaidLine(value: string, caret: number, line: string): DayEdit {
  return placeLine(value, caret, line, false)
}

/**
 * Where a place or paid line goes when The day has a selection: after the selection's last line, so nothing
 * selected is removed. A selection that ends just after a line break (a whole line selected) counts as ending on
 * that line, so the new line goes right under it. With no selection, it's the caret.
 */
export function lineCaret(value: string, start: number, end: number): number {
  return end > start && value[end - 1] === '\n' ? end - 1 : end
}

/** Puts text at the caret, with a space before it unless the caret follows a space or starts a line. */
export function insertAtCaret(value: string, caret: number, text: string): DayEdit {
  const space = caret > 0 && !/\s/.test(value[caret - 1]) ? ' ' : ''
  const insert = `${space}${text}`
  return { value: `${value.slice(0, caret)}${insert}${value.slice(caret)}`, caret: caret + insert.length }
}

/** The smallest change that turns `before` into `after`: replace `from` to `to` with `text`. */
export function changeBetween(before: string, after: string): { from: number; to: number; text: string } {
  let from = 0
  while (from < before.length && from < after.length && before[from] === after[from]) from += 1
  let tail = 0
  while (
    tail < before.length - from &&
    tail < after.length - from &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail += 1
  }
  return { from, to: before.length - tail, text: after.slice(from, after.length - tail) }
}
