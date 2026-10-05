import { describe, expect, it } from 'vitest'
import { friend } from '../test/fixtures'
import { paidBy, payerLabel } from './payers'

const mariya = friend('f-mariya', 'Mariya')
const jessie = friend('f-jessie', 'Jessie Tran')
const samLee = friend('f-sam-lee', 'Sam Lee')
const samPark = friend('f-sam-park', 'sam Park')

describe('payerLabel', () => {
  it('uses the first name', () => {
    expect(payerLabel(jessie, [mariya, jessie])).toBe('Jessie')
    expect(payerLabel(mariya, [mariya, jessie])).toBe('Mariya')
  })

  it('uses the full name when two friends on the meetup share a first name, ignoring case', () => {
    expect(payerLabel(samLee, [samLee, samPark, mariya])).toBe('Sam Lee')
    expect(payerLabel(samPark, [samLee, samPark, mariya])).toBe('sam Park')
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
