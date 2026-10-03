import { describe, expect, it } from 'vitest'
import { friend } from '../test/fixtures'
import { matchFriend, matchSubtitle } from './friendSearch'

const kim = { ...friend('k', 'Kim Park'), likes: ['Board games', 'Hiking', 'Hiking boots'], dislikes: ['Running'] }

describe('matchFriend', () => {
  it('matches everyone when the query is empty', () => {
    expect(matchFriend(kim, '  ')).toEqual({ like: null })
  })

  it('matches the name ignoring case, without naming a like', () => {
    expect(matchFriend(kim, ' kim ')).toEqual({ like: null })
    expect(matchFriend({ ...kim, name: 'Hiking Hal' }, 'hik')).toEqual({ like: null })
  })

  it('matches a like ignoring case and returns the first matching one as stored', () => {
    expect(matchFriend(kim, 'HIK')).toEqual({ like: 'Hiking' })
    expect(matchFriend(kim, 'games')).toEqual({ like: 'Board games' })
  })

  it('never matches dislikes', () => {
    expect(matchFriend(kim, 'running')).toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(matchFriend(kim, 'sushi')).toBeNull()
  })
})

describe('matchSubtitle', () => {
  it('names the like only when the friend was found through one', () => {
    expect(matchSubtitle({ like: 'Hiking' })).toBe('Likes Hiking')
    expect(matchSubtitle({ like: null })).toBeNull()
  })
})
