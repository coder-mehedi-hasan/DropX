import type { RedisClientType } from "redis"

/**
 * Thin shortcut over a single Redis client, attached to the Hono context so
 * handlers call `c.redis.get(key)` instead of wiring `getRedisClient()` each
 * time. No abstraction — just fewer keystrokes.
 *
 * Redis is a singleton: the same client is wrapped once at boot and handed out
 * on every request.
 */
export interface RedisShortcut {
  get(key: string): Promise<string | null>
  setEx(key: string, ttlSeconds: number, value: string): Promise<void>
  del(key: string): Promise<void>
  ttl(key: string): Promise<number | null>
  incr(key: string): Promise<number>
  expire(key: string, ttlSeconds: number): Promise<boolean>
}

export function createRedisShortcut(client: RedisClientType): RedisShortcut {
  return {
    async get(key: string): Promise<string | null> {
      const value = await client.get(key)
      return value ?? null
    },
    async setEx(key: string, ttlSeconds: number, value: string): Promise<void> {
      await client.setEx(key, ttlSeconds, value)
    },
    async del(key: string): Promise<void> {
      await client.del(key)
    },
    async ttl(key: string): Promise<number | null> {
      const remaining = await client.ttl(key)
      return remaining < 0 ? null : remaining
    },
    async incr(key: string): Promise<number> {
      return client.incr(key)
    },
    async expire(key: string, ttlSeconds: number): Promise<boolean> {
      return (await client.expire(key, ttlSeconds)) === 1
    },
  }
}
