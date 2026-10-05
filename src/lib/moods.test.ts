import { describe, expect, it } from 'vitest'
import { feelingsApply, INVALID_MOOD, isMood, moodInfo, MOODS } from './moods'

describe('MOODS', () => {
  it('lists the four faces low to high, each with its own label and emoji', () => {
    expect(MOODS.map((mood) => `${mood.key} ${mood.emoji} ${mood.label}`)).toEqual([
      'heavy 😔 Heavy',
      'okay 🙂 Okay',
      'good 😊 Good',
      'great 😄 Great',
    ])
    expect(new Set(MOODS.map((mood) => mood.emoji)).size).toBe(4)
  })

  it('has a message for a mood that is not on the list', () => {
    expect(INVALID_MOOD).toBe('Please pick a mood from the list.')
  })
})

describe('isMood', () => {
  it('knows the four keys and nothing else', () => {
    for (const key of ['heavy', 'okay', 'good', 'great']) expect(isMood(key)).toBe(true)
    for (const value of ['Good', 'amazing', 3, '', 'toString', null, undefined]) expect(isMood(value)).toBe(false)
  })
})

describe('moodInfo', () => {
  it('finds a face by its key, and gives null for anything else without throwing', () => {
    expect(moodInfo('okay')).toEqual({ key: 'okay', emoji: '🙂', label: 'Okay' })
    expect(moodInfo('amazing')).toBeNull()
    expect(moodInfo(null)).toBeNull()
    expect(moodInfo({ key: 'okay' })).toBeNull()
  })
})

describe('feelingsApply', () => {
  it('is true for meetups dated today or earlier', () => {
    expect(feelingsApply({ date: '2026-10-03' }, '2026-10-03')).toBe(true)
    expect(feelingsApply({ date: '2026-09-30' }, '2026-10-03')).toBe(true)
    expect(feelingsApply({ date: '2026-10-04' }, '2026-10-03')).toBe(false)
  })
})
