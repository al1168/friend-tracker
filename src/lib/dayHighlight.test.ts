import { describe, expect, it } from 'vitest'
import { OWNER_DAY_TYPED, OWNER_MESSAGE } from '../test/dayFixtures'
import { placeRuns, type TextRun } from './dayHighlight'

const plain = (text: string): TextRun => ({ text, place: false })
const place = (text: string): TextRun => ({ text, place: true })

describe('placeRuns', () => {
  it('gives nothing for an empty box, and one plain run for text without places', () => {
    expect(placeRuns('')).toEqual([])
    expect(placeRuns('Tacos\nThen karaoke')).toEqual([plain('Tacos\nThen karaoke')])
  })

  it('marks each place line, with the line breaks and the lines between in plain runs', () => {
    expect(placeRuns('Rainy\n@Cafe 10:30\nCoffee\n@Park')).toEqual([
      plain('Rainy\n'),
      place('@Cafe 10:30'),
      plain('\nCoffee\n'),
      place('@Park'),
    ])
  })

  it('keeps two place lines in a row apart', () => {
    expect(placeRuns('@A\n@B')).toEqual([place('@A'), plain('\n'), place('@B')])
  })

  it('marks only the words of a place line, never the spaces around them', () => {
    expect(placeRuns('  @Blue willow 3:30, ')).toEqual([plain('  '), place('@Blue willow 3:30,'), plain(' ')])
  })

  it('keeps a line break at the end, and an empty last line after it', () => {
    expect(placeRuns('@Cafe\n')).toEqual([place('@Cafe'), plain('\n')])
    expect(placeRuns('@Cafe\n\n')).toEqual([place('@Cafe'), plain('\n\n')])
    expect(placeRuns('\n@Cafe')).toEqual([plain('\n'), place('@Cafe')])
  })

  it('leaves "@" alone, a time alone and an "@" mid-sentence plain', () => {
    const text = '@\n@ 3:30\nThen walked to dinner @seoulsaloon'
    expect(placeRuns(text)).toEqual([plain(text)])
  })

  it('keeps \\r\\n line breaks from a backup as they are', () => {
    expect(placeRuns('@Cafe\r\nCoffee\r@Park')).toEqual([place('@Cafe'), plain('\r\nCoffee\r'), place('@Park')])
  })

  it.each([
    ['A', OWNER_DAY_TYPED],
    ['B', OWNER_MESSAGE],
  ])('gives back golden fixture %s exactly, with its 8 places marked', (_, note) => {
    const runs = placeRuns(note)
    expect(runs.map((run) => run.text).join('')).toBe(note)
    expect(runs.filter((run) => run.place)).toHaveLength(8)
  })
})
