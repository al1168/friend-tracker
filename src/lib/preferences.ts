// Rules for a friend's likes and dislikes, shared by the data layer and the backup parser.

export type PreferenceKind = 'likes' | 'dislikes'

/** The longest an item can be, after cleaning. */
export const MAX_ITEM_LENGTH = 60
/** The most items one list can hold. */
export const MAX_ITEMS = 50

export function otherKind(kind: PreferenceKind): PreferenceKind {
  return kind === 'likes' ? 'dislikes' : 'likes'
}

/** Trims an item and turns runs of whitespace (newlines too) into one space. */
export function cleanItem(item: string): string {
  return item.replace(/\s+/g, ' ').trim()
}

/** Items are compared ignoring case. */
export function itemKey(item: string): string {
  return cleanItem(item).toLocaleLowerCase()
}

/** Where `item` is in `list` (ignoring case), or -1. */
export function indexOfItem(list: readonly string[], item: string): number {
  const key = itemKey(item)
  return list.findIndex((existing) => itemKey(existing) === key)
}

/** Cleans every item, then drops empty ones and repeats. The first spelling wins. */
export function cleanItems(items: readonly string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of items) {
    const item = cleanItem(raw)
    const key = itemKey(item)
    if (item === '' || seen.has(key)) continue
    seen.add(key)
    result.push(item)
  }
  return result
}

/** Splits typed text on commas and newlines: "sushi, hiking" is two items. */
export function splitItems(text: string): string[] {
  return cleanItems(text.split(/[,\r\n]/))
}
