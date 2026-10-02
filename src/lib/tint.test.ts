import { describe, expect, it } from 'vitest'
import { TINT_COUNT, tintIndex } from './tint'

describe('tintIndex', () => {
  it('is stable for the same seed', () => {
    expect(tintIndex('friend-123')).toBe(tintIndex('friend-123'))
  })

  it('stays in range and spreads across tints', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']
    const values = seeds.map(tintIndex)
    expect(values.every((v) => v >= 0 && v < TINT_COUNT)).toBe(true)
    expect(new Set(values).size).toBeGreaterThan(2)
  })
})
