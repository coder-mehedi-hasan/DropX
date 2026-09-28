import type { DatabaseConfig, DatabaseFactory } from "../port/database"
import { DatabaseError } from "../port/errors"
import { createMySqlDatabase } from "./mysql2/adapter"

/**
 * Driver registry.
 *
 * `createDatabase({ driver: "..." })` resolves here, so adding a Postgres or
 * SQLite adapter means registering one factory — no call site changes.
 */
const DRIVERS: Record<string, DatabaseFactory> = {
  mysql: createMySqlDatabase,
}

export function registerDriver(name: string, factory: DatabaseFactory): void {
  DRIVERS[name] = factory
}

export function supportedDrivers(): string[] {
  return Object.keys(DRIVERS)
}

export function createDatabase(config: DatabaseConfig) {
  const factory = DRIVERS[config.driver]
  if (!factory) {
    throw new DatabaseError(
      "UNSUPPORTED_DRIVER",
      `Unsupported database driver "${config.driver}". Available: ${supportedDrivers().join(", ")}`,
    )
  }
  return factory(config)
}
