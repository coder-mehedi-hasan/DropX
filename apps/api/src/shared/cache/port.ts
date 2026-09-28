/**
 * Cache port.
 *
 * OTP codes and rate-limit counters live here and **never** in MySQL (see
 * `docs/overview.md` and `docs/rbac.md` rule 11). The port is intentionally
 * narrow so the Redis driver can be swapped for an in-memory one in tests.
 */
export type Cache = {
  get(key: string): Promise<string | null>
  /** Sets with a TTL in seconds. */
  set(key: string, value: string, ttlSeconds: number): Promise<void>
  delete(key: string): Promise<void>
  /** Atomically increments and returns the new value, applying `ttlSeconds` on first write. */
  increment(key: string, ttlSeconds: number): Promise<number>
  /** Remaining TTL in seconds, or `null` when the key does not exist. */
  ttl(key: string): Promise<number | null>
}

export type CacheFactory = (url: string) => Cache

const drivers = new Map<string, CacheFactory>()

export function registerCacheDriver(name: string, factory: CacheFactory): void {
  drivers.set(name, factory)
}

export function createCache(driver: string, url: string): Cache {
  const factory = drivers.get(driver)
  if (!factory) {
    throw new Error(
      `Unsupported cache driver "${driver}". Available: ${[...drivers.keys()].join(", ")}`,
    )
  }
  return factory(url)
}
