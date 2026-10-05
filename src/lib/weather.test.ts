import { describe, expect, it } from 'vitest'
import { MOODS } from './moods'
import { cleanWeather, isWeather, WEATHER, weatherInfo } from './weather'

describe('WEATHER', () => {
  it('lists the eight chips in order, each with its own label and emoji', () => {
    expect(WEATHER.map((weather) => weather.key)).toEqual([
      'sunny',
      'cloudy',
      'rainy',
      'stormy',
      'snowy',
      'windy',
      'hot',
      'cold',
    ])
    expect(WEATHER.map((weather) => `${weather.emoji} ${weather.label}`)).toEqual([
      '☀️ Sunny',
      '⛅ Cloudy',
      '🌧️ Rainy',
      '⛈️ Stormy',
      '❄️ Snowy',
      '🌬️ Windy',
      '🌡️ Hot',
      '🧣 Cold',
    ])
    expect(new Set(WEATHER.map((weather) => weather.label)).size).toBe(8)
    expect(new Set(WEATHER.map((weather) => weather.emoji)).size).toBe(8)
  })

  it('never uses a face, so nothing competes with the mood faces', () => {
    for (const { emoji } of WEATHER) {
      expect(emoji).not.toMatch(/[\u{1F600}-\u{1F64F}\u{1F910}-\u{1F92F}\u{1F970}-\u{1F97A}]/u)
      expect(MOODS.map((mood) => mood.emoji)).not.toContain(emoji)
    }
  })

  it('finds a chip by its key', () => {
    expect(weatherInfo('rainy')).toEqual({ key: 'rainy', emoji: '🌧️', label: 'Rainy' })
  })
})

describe('isWeather', () => {
  it('knows the eight keys and nothing else', () => {
    expect(isWeather('rainy')).toBe(true)
    for (const value of ['Rainy', 'fog', '', 'toString', 3, null, undefined]) expect(isWeather(value)).toBe(false)
  })
})

describe('cleanWeather', () => {
  it('gives an empty list for anything that is not a list', () => {
    expect(cleanWeather('rainy')).toEqual([])
    expect(cleanWeather(null)).toEqual([])
    expect(cleanWeather(undefined)).toEqual([])
    expect(cleanWeather({ 0: 'rainy' })).toEqual([])
  })

  it('drops unknown keys and repeats, and puts the rest in chip order', () => {
    expect(cleanWeather(['windy', 'fog', 'rainy', 'rainy', 3])).toEqual(['rainy', 'windy'])
    expect(cleanWeather([])).toEqual([])
  })
})
