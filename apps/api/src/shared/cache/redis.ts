/**
 * Redis-backed cache driver.
 *
 * Shared across API processes, so an OTP issued on instance A is readable on
 * instance B. The TTL is set via Redis `EX` so it is enforced server-side even
 * if the client clock disagrees.
 */
import { createClient, type RedisClientType } from "redis"

import { registerCacheDriver, type Cache } from "./port"

export function createRedisCache(url: string): Cache {
  let client: RedisClientType | undefined

  async function ensureClient(): Promise<RedisClientType> {
    if (client) return client
    client = createClient({ url })
    client.on("error", (error) => console.error("[cache] redis error", error))
    await client.connect()
    return client
  }

  return {
    async get(key) {
      const c = await ensureClient()
      return (await c.get(key)) ?? null
    },

    async set(key, value, ttlSeconds) {
      const c = await ensureClient()
      await c.setEx(key, ttlSeconds, value)
    },

    async delete(key) {
      const c = await ensureClient()
      await c.del(key)
    },

    async increment(key, ttlSeconds) {
      const c = await ensureClient()
      const next = await c.incr(key)
      if (next === 1) await c.expire(key, ttlSeconds)
      return next
    },

    async ttl(key) {
      const c = await ensureClient()
      const remaining = await c.ttl(key)
      return remaining < 0 ? null : remaining
    },
  }
}

registerCacheDriver("redis", createRedisCache)
