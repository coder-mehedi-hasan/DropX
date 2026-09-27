import { registerCacheDriver, type Cache } from "./port";

/**
 * Process-local cache with TTL.
 *
 * Development and test driver only: a multi-process deployment needs the real
 * shared store, because an OTP issued on instance A must be readable on
 * instance B. Register a Redis driver against `REDIS_URL` before shipping.
 */
type Entry = {
  value: string;
  /** Epoch milliseconds. */
  expiresAt: number;
};

export function createMemoryCache(): Cache {
  const store = new Map<string, Entry>();

  const read = (key: string): Entry | null => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry;
  };

  return {
    async get(key) {
      return read(key)?.value ?? null;
    },

    async set(key, value, ttlSeconds) {
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },

    async delete(key) {
      store.delete(key);
    },

    async increment(key, ttlSeconds) {
      const entry = read(key);
      const next = entry ? Number(entry.value) + 1 : 1;
      store.set(key, {
        value: String(next),
        expiresAt: entry ? entry.expiresAt : Date.now() + ttlSeconds * 1000,
      });
      return next;
    },

    async ttl(key) {
      const entry = read(key);
      if (!entry) return null;
      return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
    },
  };
}

registerCacheDriver("memory", createMemoryCache);
