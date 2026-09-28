import { z } from "zod"

/**
 * Validated process configuration.
 *
 * Parsed once at boot so a missing or malformed variable fails immediately with
 * a readable message instead of surfacing as a confusing runtime error later.
 */
const csv = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)

/**
 * `z.coerce.boolean()` turns the string `"false"` into `true` — any non-empty
 * string is truthy. Parse the literal values explicitly instead, so
 * `MAIL_SECURE=false` in `.env` actually means `false`.
 */
const bool = (def: boolean) =>
  z.preprocess((val: unknown) => (val === undefined ? def : val === "true"), z.boolean())

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(8000),
  API_BASE_URL: z.string().url().default("http://localhost:8000"),
  API_CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:5173,http://localhost:5174"),
  API_LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "silent"]).default("info"),
  API_TRUST_PROXY: bool(false),

  APP_SECRET: z
    .string()
    .min(32, "APP_SECRET must be at least 32 characters")
    .default("dev-only-insecure-secret-change-me-now-please"),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL: z.coerce.number().int().positive().default(1_209_600),
  /** One audience per app, so an admin token cannot call rider endpoints. */
  TOKEN_AUDIENCES: z.string().default("admin,riders,web"),

  REDIS_URL: z.string().default("redis://localhost:6379"),

  MAIL_FROM: z.string().default("no-reply@dropx.local"),
  MAIL_HOST: z.string().optional(),
  MAIL_PORT: z.coerce.number().int().positive().optional(),
  MAIL_SECURE: bool(false),
  MAIL_USER: z.string().optional(),
  MAIL_PASSWORD: z.string().optional(),
  MAIL_BRAND_ASSET_URL: z.string().url().optional(),
})

export type AppConfig = {
  env: "development" | "test" | "production"
  isProduction: boolean
  port: number
  baseUrl: string
  corsOrigins: string[]
  logLevel: "debug" | "info" | "warn" | "error" | "silent"
  trustProxy: boolean
  auth: {
    secret: string
    accessTokenTtl: number
    refreshTokenTtl: number
    audiences: string[]
  }
  redis: { url: string }
  mail: {
    from: string
    host?: string
    port?: number
    secure?: boolean
    user?: string
    password?: string
    brandAssetUrl?: string
  }
}

function load(env: Record<string, string | undefined>): AppConfig {
  const parsed = schema.safeParse(env)

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n")
    throw new Error(`Invalid environment configuration:\n${details}`)
  }

  const value = parsed.data

  if (value.NODE_ENV === "production" && value.APP_SECRET.startsWith("dev-only")) {
    throw new Error("APP_SECRET must be set to a real secret in production")
  }

  if (value.NODE_ENV === "production") {
    if (!env.REDIS_URL) throw new Error("REDIS_URL must be set in production")
    if (!value.MAIL_HOST || !value.MAIL_USER || !value.MAIL_PASSWORD) {
      throw new Error("MAIL_HOST, MAIL_USER and MAIL_PASSWORD must be set in production")
    }
    if (!value.MAIL_BRAND_ASSET_URL || !value.MAIL_BRAND_ASSET_URL.startsWith("https://")) {
      throw new Error("MAIL_BRAND_ASSET_URL must be a public HTTPS URL in production")
    }
    if (value.MAIL_FROM.endsWith(".local")) {
      throw new Error("MAIL_FROM must use a real sender domain in production")
    }
  }

  return {
    env: value.NODE_ENV,
    isProduction: value.NODE_ENV === "production",
    port: value.API_PORT,
    baseUrl: value.API_BASE_URL,
    corsOrigins: csv(value.API_CORS_ORIGINS),
    logLevel: value.API_LOG_LEVEL,
    trustProxy: value.API_TRUST_PROXY,
    auth: {
      secret: value.APP_SECRET,
      accessTokenTtl: value.ACCESS_TOKEN_TTL,
      refreshTokenTtl: value.REFRESH_TOKEN_TTL,
      audiences: csv(value.TOKEN_AUDIENCES),
    },
    redis: { url: value.REDIS_URL },
    mail: {
      from: value.MAIL_FROM,
      host: value.MAIL_HOST,
      port: value.MAIL_PORT,
      secure: value.MAIL_SECURE,
      user: value.MAIL_USER,
      password: value.MAIL_PASSWORD,
      brandAssetUrl: value.MAIL_BRAND_ASSET_URL,
    },
  }
}

let cached: AppConfig | undefined

export function getConfig(): AppConfig {
  cached ??= load(process.env)
  return cached
}

/** Test seam — lets a test build a config without mutating `process.env`. */
export function configFrom(env: Record<string, string | undefined>): AppConfig {
  return load(env)
}
