import "./memory"
import "./redis"

import { getConfig } from "../../config"
import { createCache, type Cache } from "./port"

let instance: Cache | undefined

/**
 * Process-wide cache handle.
 *
 * `CACHE_DRIVER` defaults to `memory` for local development. Point it at a
 * registered Redis driver before running more than one API process.
 */
export function getCache(): Cache {
  if (instance) return instance
  const driver = process.env.CACHE_DRIVER ?? "memory"
  instance = createCache(driver, getConfig().redis.url)
  return instance
}

/** Test seam. */
export function setCache(cache: Cache): void {
  instance = cache
}

export { createCache, registerCacheDriver, type Cache } from "./port"
