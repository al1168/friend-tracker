import type { Friend } from '../types'

export interface FriendMatch {
  /** The first like that matched, as stored, when the name didn't. */
  like: string | null
}

/**
 * Matches the Friends search: the query (ignoring case) in the friend's name or in any of their
 * likes. Dislikes never match. An empty query matches everyone. Null when the friend doesn't match.
 */
export function matchFriend(friend: Pick<Friend, 'name' | 'likes'>, query: string): FriendMatch | null {
  const q = query.trim().toLocaleLowerCase()
  if (q === '' || friend.name.toLocaleLowerCase().includes(q)) return { like: null }
  const like = friend.likes.find((item) => item.toLocaleLowerCase().includes(q))
  return like === undefined ? null : { like }
}

/** The row subtitle part for a friend found through a like ("Likes Hiking"). */
export function matchSubtitle(match: FriendMatch): string | null {
  return match.like === null ? null : `Likes ${match.like}`
}
