import { describe, expect, it } from 'vitest'
import { friend } from '../test/fixtures'
import { paidBy } from './payers'
import { shortName } from './text'

const mariya = friend('f-mariya', 'Mariya')
const jessie = friend('f-jessie', 'Jessie Tran')
const samLee = friend('f-sam-lee', 'Sam Lee')
const samPark = friend('f-sam-park', 'sam Park')

// "Who paid?" names each friend on the meetup by shortName.
describe('shortName among the friends on a meetup', () => {
  it('uses the first name', () => {
    expect(shortName(jessie, [mariya, jessie])).toBe('Jessie')
    expect(shortName(mariya, [mariya, jessie])).toBe('Mariya')
  })

  it('uses the full name when two friends on the meetup share a first name, ignoring case', () => {
    expect(shortName(samLee, [samLee, samPark, mariya])).toBe('Sam Lee')
    expect(shortName(samPark, [samLee, samPark, mariya])).toBe('sam Park')
  })
})

describe('paidBy', () => {
  const people = [mariya, jessie, samLee, samPark]

  it('finds the one friend a paid line names, by first or full name, ignoring case', () => {
    expect(paidBy('Jessie', people)).toBe(jessie)
    expect(paidBy('jessie tran', people)).toBe(jessie)
    expect(paidBy('MARIYA', people)).toBe(mariya)
    expect(paidBy('Sam Lee', people)).toBe(samLee)
  })

  it('finds no one for a shared bill, "I", an unknown name or a name that fits two friends', () => {
    expect(paidBy(null, people)).toBeNull()
    expect(paidBy('I', people)).toBeNull()
    expect(paidBy('Brandon', people)).toBeNull()
    expect(paidBy('Sam', people)).toBeNull()
    expect(paidBy('Jessie', [])).toBeNull()
  })
})
