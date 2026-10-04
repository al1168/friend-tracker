import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, resetDatabase } from '../db/db'
import { friend } from '../test/fixtures'
import type { Birthday } from '../types'
import { clickTarget, onNotificationClick, onPush, openApp, type ClientsLike, type WindowClientLike } from './push'

beforeEach(resetDatabase)

const SCOPE = 'https://friend.example/'

/** 11:55 PM on Oct 13, 2026, in the test time zone (America/Los_Angeles). */
const NIGHT_BEFORE = new Date(2026, 9, 13, 23, 55).getTime()

function withBirthday(id: string, name: string, birthday: Birthday | null) {
  return { ...friend(id, name), birthday }
}

/** A push event whose waitUntil promises can be awaited. */
function pushEvent(data: { json(): unknown } | null) {
  const waits: Promise<unknown>[] = []
  return {
    event: { data, waitUntil: (promise: Promise<unknown>) => void waits.push(promise) },
    waits,
    settled: () => Promise.all(waits),
  }
}

function jsonData(value: unknown) {
  return { json: () => value }
}

function fakeRegistration() {
  return { showNotification: vi.fn(async (_title: string, _options: NotificationOptions) => {}) }
}

describe('onPush', () => {
  it('shows the test notification for a test push', async () => {
    const registration = fakeRegistration()
    const push = pushEvent(jsonData({ kind: 'test' }))
    onPush(push.event, { registration, now: () => NIGHT_BEFORE })
    await push.settled()
    expect(registration.showNotification.mock.calls).toEqual([
      [
        '🎂 Reminders work',
        { body: "You'll get a note at 11:55 PM before each birthday.", tag: 'reminders-test', data: { url: '/#/settings' } },
      ],
    ])
  })

  it("reads the app's database and names the friend whose birthday it is", async () => {
    await db.friends.bulkAdd([
      withBirthday('alex', 'Alex', { month: 10, day: 14, year: 1990 }),
      withBirthday('sam', 'Sam', { month: 3, day: 2, year: null }),
    ])
    const registration = fakeRegistration()
    const push = pushEvent(jsonData({ kind: 'birthday' }))
    onPush(push.event, { registration, now: () => NIGHT_BEFORE })
    await push.settled()
    expect(registration.showNotification.mock.calls).toEqual([
      [
        "🎂 Alex's birthday starts in 5 minutes",
        { body: 'Send them a message.', tag: 'birthday-2026-10-14', data: { url: '/#/friends/alex' } },
      ],
    ])
  })

  it('counts a missing or unreadable payload as a birthday reminder', async () => {
    await db.friends.add(withBirthday('alex', 'Alex', { month: 10, day: 14, year: null }))
    const unreadable = {
      json: () => {
        throw new SyntaxError('Unexpected token')
      },
    }
    for (const data of [null, unreadable, jsonData('hello')]) {
      const registration = fakeRegistration()
      const push = pushEvent(data)
      onPush(push.event, { registration, now: () => NIGHT_BEFORE })
      await push.settled()
      expect(registration.showNotification).toHaveBeenCalledTimes(1)
      expect(registration.showNotification.mock.calls[0][0]).toBe("🎂 Alex's birthday starts in 5 minutes")
    }
  })

  it('hands the notification to waitUntil before returning', async () => {
    const registration = fakeRegistration()
    const push = pushEvent(jsonData({ kind: 'birthday' }))
    onPush(push.event, { registration, now: () => NIGHT_BEFORE })
    // Called synchronously, so the browser keeps the worker alive until the notification shows.
    expect(push.waits).toHaveLength(1)
    await push.settled()
    expect(registration.showNotification).toHaveBeenCalledTimes(1)
  })

  it('still shows a notification when the friends cannot be read', async () => {
    const registration = fakeRegistration()
    const push = pushEvent(jsonData({ kind: 'birthday' }))
    const readFriends = () => Promise.reject(new Error('DatabaseClosedError'))
    onPush(push.event, { registration, readFriends, now: () => NIGHT_BEFORE })
    expect(push.waits).toHaveLength(1)
    await push.settled()
    expect(registration.showNotification.mock.calls).toEqual([
      [
        '🎂 A birthday is coming up',
        { body: 'Open Friend Tracker to see who.', tag: 'birthday-2026-10-14', data: { url: '/#/' } },
      ],
    ])
  })

  it('still shows a notification when reading the friends throws right away', async () => {
    const registration = fakeRegistration()
    const push = pushEvent(jsonData({ kind: 'birthday' }))
    const readFriends = () => {
      throw new Error('IndexedDB is not available')
    }
    onPush(push.event, { registration, readFriends, now: () => NIGHT_BEFORE })
    await push.settled()
    expect(registration.showNotification.mock.calls[0][0]).toBe('🎂 A birthday is coming up')
  })

  it('gives up on a read that takes too long', async () => {
    const registration = fakeRegistration()
    const push = pushEvent(jsonData({ kind: 'birthday' }))
    const readFriends = () => new Promise<never>(() => {})
    onPush(push.event, { registration, readFriends, now: () => NIGHT_BEFORE, timeoutMs: 20 })
    await push.settled()
    expect(registration.showNotification.mock.calls[0][0]).toBe('🎂 A birthday is coming up')
  })

  it('shows the fallback when nobody has a birthday that night', async () => {
    await db.friends.add(withBirthday('sam', 'Sam', { month: 3, day: 2, year: null }))
    const registration = fakeRegistration()
    const push = pushEvent(jsonData({ kind: 'birthday' }))
    onPush(push.event, { registration, now: () => NIGHT_BEFORE })
    await push.settled()
    expect(registration.showNotification.mock.calls[0][0]).toBe('🎂 A birthday is coming up')
  })
})

/** A window the notification can bring forward, recording what happened to it. */
function fakeWindow(options: { focusFails?: boolean; navigateFails?: boolean } = {}) {
  const calls: string[] = []
  const client: WindowClientLike = {
    focus: async () => {
      calls.push('focus')
      if (options.focusFails) throw new Error('InvalidAccessError')
      return client
    },
    navigate: async (url: string) => {
      calls.push(`navigate ${url}`)
      if (options.navigateFails) throw new TypeError('Not controlled')
      return client
    },
  }
  return { client, calls }
}

function fakeClients(windows: WindowClientLike[]) {
  const opened: string[] = []
  const clients: ClientsLike = {
    matchAll: async () => windows,
    openWindow: async (url: string) => {
      opened.push(url)
      return null
    },
  }
  return { clients, opened }
}

describe('clickTarget', () => {
  it('resolves the notification link on this site', () => {
    expect(clickTarget({ url: '/#/friends/alex' }, SCOPE)).toBe('https://friend.example/#/friends/alex')
    expect(clickTarget({ url: '/#/' }, SCOPE)).toBe('https://friend.example/#/')
  })

  it('goes to the Friends tab for anything else', () => {
    for (const data of [null, undefined, 'x', {}, { url: 42 }, { url: 'https://evil.example/' }, { url: '//evil.example/' }]) {
      expect(clickTarget(data, SCOPE)).toBe('https://friend.example/#/')
    }
  })

  it('goes to the Friends tab when the link cannot be parsed', () => {
    expect(clickTarget({ url: 'https://[' }, SCOPE)).toBe('https://friend.example/#/')
  })
})

describe('openApp', () => {
  it('brings an open window forward and takes it to the link', async () => {
    const open = fakeWindow()
    const { clients, opened } = fakeClients([open.client])
    await openApp('https://friend.example/#/friends/alex', clients)
    expect(open.calls).toEqual(['focus', 'navigate https://friend.example/#/friends/alex'])
    expect(opened).toEqual([])
  })

  it('leaves the window where it was when it cannot be moved', async () => {
    const open = fakeWindow({ navigateFails: true })
    const { clients, opened } = fakeClients([open.client])
    await openApp('https://friend.example/#/', clients)
    expect(open.calls).toEqual(['focus', 'navigate https://friend.example/#/'])
    expect(opened).toEqual([])
  })

  it('opens the app when no window can come forward', async () => {
    const stuck = fakeWindow({ focusFails: true })
    const { clients, opened } = fakeClients([stuck.client])
    await openApp('https://friend.example/#/', clients)
    expect(opened).toEqual(['https://friend.example/#/'])

    const none = fakeClients([])
    await openApp('https://friend.example/#/friends/alex', none.clients)
    expect(none.opened).toEqual(['https://friend.example/#/friends/alex'])
  })
})

describe('onNotificationClick', () => {
  it('closes the notification and opens its link inside waitUntil', async () => {
    const close = vi.fn()
    const waits: Promise<unknown>[] = []
    const { clients, opened } = fakeClients([])
    onNotificationClick(
      { notification: { data: { url: '/#/friends/alex' }, close }, waitUntil: (promise) => void waits.push(promise) },
      clients,
      SCOPE,
    )
    expect(close).toHaveBeenCalledTimes(1)
    expect(waits).toHaveLength(1)
    await Promise.all(waits)
    expect(opened).toEqual(['https://friend.example/#/friends/alex'])
  })
})
