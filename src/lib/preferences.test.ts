import { describe, expect, it } from 'vitest'
import { cleanItem, cleanItems, indexOfItem, MAX_ITEM_LENGTH, MAX_ITEMS, otherKind, splitItems } from './preferences'

describe('limits', () => {
  it('allows 60 characters per item and 50 items per list', () => {
    expect(MAX_ITEM_LENGTH).toBe(60)
    expect(MAX_ITEMS).toBe(50)
  })
})

describe('otherKind', () => {
  it('pairs likes with dislikes', () => {
    expect(otherKind('likes')).toBe('dislikes')
    expect(otherKind('dislikes')).toBe('likes')
  })
})

describe('cleanItem', () => {
  it('trims and turns runs of whitespace into one space', () => {
    expect(cleanItem('  Board   games ')).toBe('Board games')
    expect(cleanItem('Early\n\tmornings')).toBe('Early mornings')
    expect(cleanItem('   ')).toBe('')
  })
})

describe('indexOfItem', () => {
  it('finds an item ignoring case and extra spaces', () => {
    expect(indexOfItem(['Sushi', 'Board games'], 'board GAMES')).toBe(1)
    expect(indexOfItem(['Sushi'], ' sushi ')).toBe(0)
    expect(indexOfItem(['Sushi'], 'Ramen')).toBe(-1)
  })
})

describe('cleanItems', () => {
  it('drops empty items and repeats, keeping the first spelling', () => {
    expect(cleanItems(['Sushi', ' ', 'SUSHI', ' Hiking ', 'sushi'])).toEqual(['Sushi', 'Hiking'])
  })
})

describe('splitItems', () => {
  it('splits on commas and newlines', () => {
    expect(splitItems('sushi, hiking')).toEqual(['sushi', 'hiking'])
    expect(splitItems('Sushi\nBoard games\r\nHiking')).toEqual(['Sushi', 'Board games', 'Hiking'])
  })

  it('skips empty pieces and repeats within the text', () => {
    expect(splitItems(' , sushi,, Sushi ,')).toEqual(['sushi'])
    expect(splitItems('')).toEqual([])
  })
})
