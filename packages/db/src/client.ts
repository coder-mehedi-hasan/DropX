import { createDatabase } from "./adapters/registry"
import { resolveDatabaseConfig, type DatabaseSettings } from "./config"
import type { Database } from "./port/database"

/**
 * Process-wide handle on the database.
 *
 * `apps/api` imports `getDatabase()` from here and never sees mysql2. The
 * pool is created lazily so importing this module is free in tests and
 * tooling; `apps/api`'s readiness probe calls `ping()`.
 */
let instance: Database | undefined
let settings: DatabaseSettings | undefined

export function getDatabase(): Database {
  if (instance) return instance
  settings ??= resolveDatabaseConfig()
  instance = createDatabase(settings)
  return instance
}

/**
 * Test seam — install a handle (an in-memory double, say) so services can be
 * exercised without MySQL. Feature code resolves the handle through
 * `getDatabase()` rather than receiving it, so this is the only injection point.
 */
export function setDatabase(db: Database): void {
  instance = db
}

/** Explicitly chosen settings — used by migration scripts. */
export function createDatabaseWith(config: DatabaseSettings = resolveDatabaseConfig()): Database {
  return createDatabase(config)
}

export async function closeDatabase(): Promise<void> {
  if (!instance) return
  await instance.close()
  instance = undefined
  settings = undefined
}
