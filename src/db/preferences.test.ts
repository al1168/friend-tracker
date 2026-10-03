import { beforeEach, describe, expect, it } from 'vitest'
import { db, resetDatabase } from './db'
import { ValidationError } from './errors'
import { addFriend } from './friends'
import { addPreferences, movePreference, removePreference, restorePreference } from './preferences'

let friendId: string

beforeEach(async () => {
  await resetDatabase()
  friendId = (await addFriend({ name: 'Alex', groupId: null, photo: null, notes: '' })).id
})

async function lists() {
  const friend = await db.friends.get(friendId)
  return { likes: friend?.likes, dislikes: friend?.dislikes }
}

/** "Item 1, Item 2, ..." up to `count`. */
function manyItems(count: number): string {
  return Array.from({ length: count }, (_, i) => `Item ${i + 1}`).join(', ')
}

describe('addPreferences', () => {
  it('adds cleaned items in order, oldest first', async () => {
    expect(await addPreferences(friendId, 'likes', '  Board   games ')).toEqual({ added: ['Board games'], skipped: [] })
    expect(await addPreferences(friendId, 'likes', 'sushi, hiking\nJazz')).toEqual({
      added: ['sushi', 'hiking', 'Jazz'],
      skipped: [],
    })
    expect(await lists()).toEqual({ likes: ['Board games', 'sushi', 'hiking', 'Jazz'], dislikes: [] })
  })

  it('skips items already in the list, ignoring case, and keeps the first spelling', async () => {
    await addPreferences(friendId, 'likes', 'Sushi')
    expect(await addPreferences(friendId, 'likes', 'SUSHI, ramen')).toEqual({ added: ['ramen'], skipped: ['SUSHI'] })
    expect((await lists()).likes).toEqual(['Sushi', 'ramen'])
  })

  it('moves an item from the other list, keeping the new spelling', async () => {
    await addPreferences(friendId, 'dislikes', 'cilantro, Early mornings')
    expect(await addPreferences(friendId, 'likes', 'Cilantro')).toEqual({ added: ['Cilantro'], skipped: [] })
    expect(await lists()).toEqual({ likes: ['Cilantro'], dislikes: ['Early mornings'] })
  })

  it('adds nothing for empty text', async () => {
    expect(await addPreferences(friendId, 'likes', ' , \n ')).toEqual({ added: [], skipped: [] })
    expect((await lists()).likes).toEqual([])
  })

  it('refuses to pass 50 items and changes nothing', async () => {
    await addPreferences(friendId, 'likes', manyItems(49))
    await addPreferences(friendId, 'dislikes', 'Cilantro')
    await expect(addPreferences(friendId, 'likes', 'Ramen, Cilantro')).rejects.toThrow('This list is full.')
    expect((await lists()).likes).toHaveLength(49)
    expect((await lists()).dislikes).toEqual(['Cilantro'])
    await addPreferences(friendId, 'likes', 'Ramen')
    expect((await lists()).likes).toHaveLength(50)
  })

  it('still reports duplicates when the list is full', async () => {
    await addPreferences(friendId, 'likes', manyItems(50))
    expect(await addPreferences(friendId, 'likes', 'item 1')).toEqual({ added: [], skipped: ['item 1'] })
  })

  it('refuses an item over 60 characters and changes nothing', async () => {
    const attempt = addPreferences(friendId, 'likes', `Sushi, ${'x'.repeat(61)}`)
    await expect(attempt).rejects.toThrow(ValidationError)
    await expect(attempt).rejects.toThrow('Keep each one under 60 characters.')
    expect((await lists()).likes).toEqual([])
    await addPreferences(friendId, 'likes', 'y'.repeat(60))
    expect((await lists()).likes).toEqual(['y'.repeat(60)])
  })

  it('rejects a missing friend', async () => {
    const attempt = addPreferences('nope', 'likes', 'Sushi')
    await expect(attempt).rejects.toThrow(ValidationError)
    await expect(attempt).rejects.toThrow('This friend no longer exists.')
  })
})

describe('removePreference', () => {
  it('removes an item ignoring case and returns where it was', async () => {
    await addPreferences(friendId, 'likes', 'Sushi, Hiking, Jazz')
    expect(await removePreference(friendId, 'likes', 'hiking')).toBe(1)
    expect((await lists()).likes).toEqual(['Sushi', 'Jazz'])
  })

  it('returns -1 when the item is not there', async () => {
    await addPreferences(friendId, 'likes', 'Sushi')
    expect(await removePreference(friendId, 'likes', 'Ramen')).toBe(-1)
    expect((await lists()).likes).toEqual(['Sushi'])
  })

  it('rejects a missing friend', async () => {
    await expect(removePreference('nope', 'likes', 'Sushi')).rejects.toThrow('This friend no longer exists.')
  })
})

describe('restorePreference', () => {
  it('puts the item back where it was', async () => {
    await addPreferences(friendId, 'likes', 'Sushi, Hiking, Jazz')
    const index = await removePreference(friendId, 'likes', 'Hiking')
    await restorePreference(friendId, 'likes', 'Hiking', index)
    expect((await lists()).likes).toEqual(['Sushi', 'Hiking', 'Jazz'])
  })

  it('clamps the index to the list', async () => {
    await addPreferences(friendId, 'likes', 'Sushi')
    await restorePreference(friendId, 'likes', 'Jazz', 7)
    await restorePreference(friendId, 'likes', 'Ramen', -3)
    expect((await lists()).likes).toEqual(['Ramen', 'Sushi', 'Jazz'])
  })

  it('does nothing when the item is already back in the list', async () => {
    await addPreferences(friendId, 'likes', 'Sushi, Jazz')
    await restorePreference(friendId, 'likes', 'sushi', 1)
    expect((await lists()).likes).toEqual(['Sushi', 'Jazz'])
  })

  it('moves the item back from the other list', async () => {
    await addPreferences(friendId, 'likes', 'Sushi, Jazz')
    const index = await removePreference(friendId, 'likes', 'Sushi')
    await addPreferences(friendId, 'dislikes', 'sushi')
    await restorePreference(friendId, 'likes', 'Sushi', index)
    expect(await lists()).toEqual({ likes: ['Sushi', 'Jazz'], dislikes: [] })
  })

  it('refuses when the list is full', async () => {
    await addPreferences(friendId, 'likes', manyItems(50))
    await expect(restorePreference(friendId, 'likes', 'Sushi', 0)).rejects.toThrow('This list is full.')
  })

  it('rejects a missing friend', async () => {
    await expect(restorePreference('nope', 'likes', 'Sushi', 0)).rejects.toThrow('This friend no longer exists.')
  })
})

describe('movePreference', () => {
  it('moves an item to the end of the other list', async () => {
    await addPreferences(friendId, 'likes', 'Sushi, Hiking')
    await addPreferences(friendId, 'dislikes', 'Cilantro')
    await movePreference(friendId, 'likes', 'sushi')
    expect(await lists()).toEqual({ likes: ['Hiking'], dislikes: ['Cilantro', 'Sushi'] })
    await movePreference(friendId, 'dislikes', 'Cilantro')
    expect(await lists()).toEqual({ likes: ['Hiking', 'Cilantro'], dislikes: ['Sushi'] })
  })

  it('refuses when the other list is full and changes nothing', async () => {
    await addPreferences(friendId, 'dislikes', manyItems(50))
    await addPreferences(friendId, 'likes', 'Sushi')
    await expect(movePreference(friendId, 'likes', 'Sushi')).rejects.toThrow('This list is full.')
    expect((await lists()).likes).toEqual(['Sushi'])
    expect((await lists()).dislikes).toHaveLength(50)
  })

  it('rejects a missing friend', async () => {
    await expect(movePreference('nope', 'likes', 'Sushi')).rejects.toThrow('This friend no longer exists.')
  })
})
