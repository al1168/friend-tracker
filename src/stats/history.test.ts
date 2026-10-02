import { describe, expect, it } from 'vitest'
import { meetup } from '../test/fixtures'
import { groupByMonth } from './history'

describe('groupByMonth', () => {
  it('groups meetups by month, newest first', () => {
    const groups = groupByMonth([
      meetup('m1', '2026-08-03', ['alex']),
      meetup('m2', '2026-09-20', ['alex']),
      meetup('m3', '2026-09-02', ['alex']),
    ])
    expect(groups.map((g) => [g.month, g.meetups.map((m) => m.id)])).toEqual([
      ['2026-09', ['m2', 'm3']],
      ['2026-08', ['m1']],
    ])
  })

  it('orders same-day meetups by when they were logged, newest first', () => {
    const a = { ...meetup('a', '2026-09-02', ['alex']), createdAt: '2026-09-02T10:00:00.000Z' }
    const b = { ...meetup('b', '2026-09-02', ['alex']), createdAt: '2026-09-02T18:00:00.000Z' }
    expect(groupByMonth([a, b])[0].meetups.map((m) => m.id)).toEqual(['b', 'a'])
  })
})
