import { createClient, type RedisClientType } from "redis"

import { getConfig } from "../../config"

let client: RedisClientType | undefined

/**
 * Get the process-wide Redis client.
 *
 * Created once on first use with an error handler attached; every call returns
 * the same handle. There is no driver switch and no cache abstraction — this is
 * direct redis, wired through a tiny singleton.
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (client) return client
  client = await createClient({ url: getConfig().redis.url })
    .on("error", (error) => console.error("[cache] redis error", error))
    .connect()
  return client
}
