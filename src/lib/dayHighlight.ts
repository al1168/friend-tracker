import { isPlaceLine } from './dayText'

/** A stretch of a day's text: a place line's words, or everything between them. */
export interface TextRun {
  text: string
  place: boolean
}

/** A line break as readDay splits on it, kept in the pieces (a backup's "\r\n" stays as it is). */
const LINE_BREAK = /(\r\n?|\n)/

/**
 * A day's text cut into runs for The day boxes' place tint: each place line's words (isPlaceLine) in a run of
 * their own, and everything else, line breaks and the spaces around a place included, in plain runs between.
 * Joined back together, the runs are the text exactly.
 */
export function placeRuns(text: string): TextRun[] {
  const runs: TextRun[] = []
  const add = (part: string, place: boolean) => {
    if (part === '') return
    const last = runs.at(-1)
    if (last && !last.place && !place) last.text += part
    else runs.push({ text: part, place })
  }
  // Lines at even indexes, the line breaks between them at odd ones.
  text.split(LINE_BREAK).forEach((piece, index) => {
    if (index % 2 === 1 || !isPlaceLine(piece)) {
      add(piece, false)
      return
    }
    const start = piece.length - piece.trimStart().length
    const end = piece.trimEnd().length
    add(piece.slice(0, start), false)
    add(piece.slice(start, end), true)
    add(piece.slice(end), false)
  })
  return runs
}
