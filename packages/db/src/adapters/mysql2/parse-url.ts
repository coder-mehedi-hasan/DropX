import type { SslOptions } from "mysql2";

export type MySqlSslMode = "DISABLED" | "PREFERRED" | "REQUIRED" | "VERIFY_CA" | "VERIFY_IDENTITY";

export type MySqlConnectionConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: SslOptions | undefined;
  charset: string;
  /**
   * BIGINT UNSIGNED and DECIMAL exceed `Number.MAX_SAFE_INTEGER` precision, so
   * they come back as strings and are converted by `src/codecs.ts`.
   */
  supportBigNumbers: boolean;
  bigNumberStrings: boolean;
  /** DATETIME (no zone) stays a string; `codecs.toDate` normalises it. */
  dateStrings: boolean;
};

const DEFAULT_PORT = 3306;

export class DatabaseUrlError extends Error {
  override readonly name = "DatabaseUrlError";
}

function sslFor(mode: MySqlSslMode, ca: string | null): SslOptions | undefined {
  if (mode === "DISABLED") return undefined;

  if (mode === "VERIFY_CA" || mode === "VERIFY_IDENTITY") {
    return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: true };
  }

  // REQUIRED/PREFERRED: encrypted but not identity-verified. This is the
  // managed-database default (Aiven and friends) and needs no CA bundle.
  return ca ? { ca, rejectUnauthorized: false } : { rejectUnauthorized: false };
}

export function parseMySqlUrl(connectionString: string): MySqlConnectionConfig {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new DatabaseUrlError(
      "DATABASE_URL is not a valid URL. Expected mysql://user:password@host:port/database",
    );
  }

  if (!url.protocol.startsWith("mysql:")) {
    throw new DatabaseUrlError(
      `Unsupported database protocol "${url.protocol}". This deployment is configured for mysql2.`,
    );
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) {
    throw new DatabaseUrlError("DATABASE_URL is missing a database name (the path segment)");
  }

  const mode = (url.searchParams.get("ssl-mode") ?? "REQUIRED").toUpperCase() as MySqlSslMode;
  const ca = url.searchParams.get("ssl-ca");
  const charset = url.searchParams.get("charset") ?? "utf8mb4_unicode_ci";

  return {
    host: decodeURIComponent(url.hostname),
    port: url.port ? Number(url.port) : DEFAULT_PORT,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    ssl: sslFor(mode, ca),
    charset,
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: true,
  };
}
