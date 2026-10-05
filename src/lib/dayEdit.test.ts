import { describe, expect, it } from 'vitest'
import { OWNER_DAY_TYPED } from '../test/dayFixtures'
import { changeBetween, type DayEdit, insertAtCaret, insertPaidLine, insertPlaceLine } from './dayEdit'

describe('insertPlaceLine', () => {
  it('starts an empty day with the place, and leaves the caret on the line under it', () => {
    expect(insertPlaceLine('', 0, 'Blue willow 3:30')).toEqual({ value: '@Blue willow 3:30\n', caret: 18 })
  })

  it('puts the place on a blank line the caret is on', () => {
    expect(insertPlaceLine('Rainy\n\nWalked home', 6, 'Cafe')).toEqual({ value: 'Rainy\n@Cafe\nWalked home', caret: 11 })
    expect(insertPlaceLine('Rainy\n  ', 8, 'Cafe')).toEqual({ value: 'Rainy\n@Cafe\n', caret: 12 })
  })

  it('at the end, adds the place after the caret’s line with an empty line under it', () => {
    expect(insertPlaceLine('Took haircut', 12, 'strand bookstore 11:30')).toEqual({
      value: 'Took haircut\n@strand bookstore 11:30\n',
      caret: 37,
    })
    // Anywhere on the last line, the place still goes after it.
    expect(insertPlaceLine('Took haircut', 4, 'Cafe')).toEqual({ value: 'Took haircut\n@Cafe\n', caret: 19 })
  })

  it('in the middle, adds the place after the caret’s line with the caret at its end and no empty line', () => {
    expect(insertPlaceLine('One\nTwo', 2, 'Cafe')).toEqual({ value: 'One\n@Cafe\nTwo', caret: 9 })
  })

  it('drops a leading "@" typed into the field and keeps one inside', () => {
    expect(insertPlaceLine('', 0, '@Cafe').value).toBe('@Cafe\n')
    expect(insertPlaceLine('', 0, ' @@ Cafe ').value).toBe('@Cafe\n')
    expect(insertPlaceLine('', 0, 'holister + @h&m 7:30 - ~8:10').value).toBe('@holister + @h&m 7:30 - ~8:10\n')
  })

  it('changes nothing for an empty field', () => {
    expect(insertPlaceLine('One', 3, ' @ ')).toEqual({ value: 'One', caret: 3 })
  })

  it('reads a caret at the very start as the first line', () => {
    expect(insertPlaceLine('\nOne', 0, 'Cafe')).toEqual({ value: '@Cafe\nOne', caret: 5 })
  })
})

describe('insertPaidLine', () => {
  it('adds the line after the caret’s line with the caret at its end, and no empty line after it', () => {
    expect(insertPaidLine('Ordered tea.', 12, 'Jessie paid')).toEqual({ value: 'Ordered tea.\nJessie paid', caret: 24 })
    expect(insertPaidLine('One\nTwo', 1, 'I paid')).toEqual({ value: 'One\nI paid\nTwo', caret: 10 })
  })

  it('puts the line on a blank line the caret is on', () => {
    expect(insertPaidLine('One\n', 4, 'We split it')).toEqual({ value: 'One\nWe split it', caret: 15 })
    expect(insertPaidLine('', 0, 'I paid')).toEqual({ value: 'I paid', caret: 6 })
  })
})

describe('insertAtCaret', () => {
  it('puts a space before the text unless the caret follows a space or starts a line', () => {
    expect(insertAtCaret('Left at', 7, '9:52 PM')).toEqual({ value: 'Left at 9:52 PM', caret: 15 })
    expect(insertAtCaret('Left at ', 8, '9:52 PM')).toEqual({ value: 'Left at 9:52 PM', caret: 15 })
    expect(insertAtCaret('Left\n', 5, '9:52 PM')).toEqual({ value: 'Left\n9:52 PM', caret: 12 })
    expect(insertAtCaret('', 0, '21:52')).toEqual({ value: '21:52', caret: 5 })
    expect(insertAtCaret('Home by end', 7, '9:52 PM')).toEqual({ value: 'Home by 9:52 PM end', caret: 15 })
  })
})

describe('changeBetween', () => {
  it('finds the one stretch to replace', () => {
    expect(changeBetween('Took', 'Took\n@Cafe\n')).toEqual({ from: 4, to: 4, text: '\n@Cafe\n' })
    expect(changeBetween('One\n\nTwo', 'One\n@Cafe\nTwo')).toEqual({ from: 4, to: 4, text: '@Cafe' })
    expect(changeBetween('abc', 'abc')).toEqual({ from: 3, to: 3, text: '' })
  })
})

describe('the owner’s walk home, replayed', () => {
  it('writes golden fixture A exactly, with the helpers and the typing in the walkthrough', () => {
    let day: DayEdit = { value: '', caret: 0 }
    const type = (text: string) => {
      day = { value: day.value.slice(0, day.caret) + text + day.value.slice(day.caret), caret: day.caret + text.length }
    }
    const place = (text: string) => {
      day = insertPlaceLine(day.value, day.caret, text)
    }
    const paid = (line: string) => {
      day = insertPaidLine(day.value, day.caret, line)
    }

    place('nonstopstyle 10:30')
    type('Took haircut with dyno')
    place('strand bookstore 11:30')
    place('Sammy L coffee 11:53')
    type('Read book and vibe code until 2:50')
    place('Blue willow 3:30')
    type('Walked to mariya at blue willow. Then Jessie came, then Brandon (late) due to construction')
    type('\n')
    type('Ordered Kong pao chicken (salty) garlic string beans, szcheuan beef and jasmine dragon pearl tea.')
    paid('Jessie paid')
    place('hey tea Broadway')
    type('Walked to hey tea (got the king jasmine honeydew)')
    place('amc 34 5:30')
    type('Walked to amc and watch prime time(didn’t like it)')
    place('holister + @h&m 7:30 - ~8:10')
    type('Stalled time for dinner at holister and H&M')
    place('seoulSaloon 8:30')
    for (const line of [
      'Then walked to dinner @seoulsaloon',
      'Ate rose tteboki, fried chicken(chicken nuggets?), octopus kimbap',
      'Talked about relationship + movie',
      'Jessie Brandon age gap like 3 years',
    ]) {
      type(line)
      type('\n')
    }
    type('Mariya like 3 years older 1/2 younger')
    paid('Mariya paid')
    type('\n')
    type('Split ways went home')

    expect(day.value).toBe(OWNER_DAY_TYPED)
  })
})
