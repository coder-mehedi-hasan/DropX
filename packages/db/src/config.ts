import type { DatabaseConfig } from "./port/database";

export type DatabaseSettings = DatabaseConfig & {
  url: string;
};

export class MissingDatabaseUrlError extends Error {
  override readonly name = "MissingDatabaseUrlError";
  constructor() {
    super("DATABASE_URL is not set. Copy .env.example to .env and fill in the connection string.");
  }
}

/**
 * Derives the driver from the connection-string protocol so callers only ever
 * set `DATABASE_URL`. `mysql://` and `postgres://` both resolve; the port layer
 * is identical either way.
 */
export function resolveDatabaseConfig(env: Record<string, string | undefined> = process.env): DatabaseSettings {
  const url = env.DATABASE_URL?.trim();
  if (!url) throw new MissingDatabaseUrlError();

  const protocol = url.slice(0, url.indexOf(":")).toLowerCase();
  const driver = protocol === "mysql" || protocol === "mysql2" ? "mysql" : protocol;

  return {
    driver,
    url,
    pool: {
      min: toInt(env.DATABASE_POOL_MIN, 1),
      max: toInt(env.DATABASE_POOL_MAX, 10),
      idleTimeoutMillis: toInt(env.DATABASE_POOL_IDLE_MS, 60_000),
      connectTimeoutMillis: toInt(env.DATABASE_CONNECT_TIMEOUT_MS, 10_000),
    },
  };
}

function toInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
