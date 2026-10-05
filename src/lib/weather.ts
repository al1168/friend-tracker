import type { Weather } from '../types'

// The service worker opens the database, which imports this file: nothing here may touch window, document or Intl.

export interface WeatherInfo {
  key: Weather
  emoji: string
  label: string
}

/** The weather chips, in order. Never a face emoji, so nothing competes with the mood faces. */
export const WEATHER: readonly WeatherInfo[] = [
  { key: 'sunny', emoji: '☀️', label: 'Sunny' },
  { key: 'cloudy', emoji: '⛅', label: 'Cloudy' },
  { key: 'rainy', emoji: '🌧️', label: 'Rainy' },
  { key: 'stormy', emoji: '⛈️', label: 'Stormy' },
  { key: 'snowy', emoji: '❄️', label: 'Snowy' },
  { key: 'windy', emoji: '🌬️', label: 'Windy' },
  { key: 'hot', emoji: '🌡️', label: 'Hot' },
  { key: 'cold', emoji: '🧣', label: 'Cold' },
]

const KEYS: readonly string[] = WEATHER.map((weather) => weather.key)

export function isWeather(value: unknown): value is Weather {
  return typeof value === 'string' && KEYS.includes(value)
}

/** A weather list as the app keeps it: something that isn't a list gives []; unknown keys and repeats are dropped; the rest go in chip order. */
export function cleanWeather(value: unknown): Weather[] {
  if (!Array.isArray(value)) return []
  return WEATHER.filter(({ key }) => value.includes(key)).map(({ key }) => key)
}

/** The chip for a weather key. */
export function weatherInfo(key: Weather): WeatherInfo {
  return WEATHER.find((weather) => weather.key === key)!
}
