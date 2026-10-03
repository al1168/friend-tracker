import type { KVLike } from './attempts.ts'

/** Test helper: an in-memory stand-in for a Workers KV namespace. */
export interface MemoryKv extends KVLike {
  readonly entries: Map<string, { value: string; expirationTtl?: number }>
  /** When true, every call throws, like KV having an outage. */
  failing: boolean
}

export function createMemoryKv(): MemoryKv {
  const entries = new Map<string, { value: string; expirationTtl?: number }>()
  const kv: MemoryKv = {
    entries,
    failing: false,
    async get(key) {
      if (kv.failing) throw new Error('KV unavailable')
      return entries.get(key)?.value ?? null
    },
    async put(key, value, options) {
      if (kv.failing) throw new Error('KV unavailable')
      entries.set(key, { value, expirationTtl: options?.expirationTtl })
    },
    async delete(key) {
      if (kv.failing) throw new Error('KV unavailable')
      entries.delete(key)
    },
  }
  return kv
}
