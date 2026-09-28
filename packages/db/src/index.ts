/**
 * `@dropx/db` — the only place in the monorepo that knows a database exists.
 *
 * Consumers import the **port** (interfaces, pagination contract, query builder)
 * and the **entities** (shared domain models). Drivers are registered in
 * `./adapters` and never referenced from feature code.
 */
export * from "./port"
export * from "./entities"
export * from "./codecs"

export { createDatabase, registerDriver, supportedDrivers } from "./adapters/registry"
export { createMySqlDatabase, type MySqlDatabase } from "./adapters/mysql2"
export { resolveDatabaseConfig, type DatabaseSettings } from "./config"
export { getDatabase, createDatabaseWith, closeDatabase } from "./client"
