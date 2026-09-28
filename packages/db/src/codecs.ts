/**
 * Row decoding.
 *
 * The MySQL adapter runs with `bigNumberStrings: true` / `dateStrings: true`,
 * so BIGINT UNSIGNED, DECIMAL and DATETIME all arrive as strings. These helpers
 * are the single place that knowledge lives, so swapping to a driver that
 * returns native types is a change in one file.
 */

import type { Id } from "./port/database"

function requireString(value: unknown, column: string): string {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "bigint") return String(value)
  throw new TypeError(`Expected ${column} to be a scalar id, received ${typeof value}`)
}

export function toId(value: unknown, column = "id"): Id {
  return requireString(value, column)
}

export function toNullableId(value: unknown, column = "id"): Id | null {
  return value === null || value === undefined ? null : toId(value, column)
}

export function toInt(value: unknown, fallback = 0): number {
  if (typeof value === "number") return value
  if (typeof value === "bigint") return Number(value)
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

export function toNullableInt(value: unknown): number | null {
  return value === null || value === undefined ? null : toInt(value)
}

/** DECIMAL columns carry money and weights — convert to number, never float math. */
export function toDecimal(value: unknown, fallback = 0): number {
  return toInt(value, fallback)
}

export function toNullableDecimal(value: unknown): number | null {
  return value === null || value === undefined ? null : toDecimal(value)
}

export function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") return value === "1" || value.toLowerCase() === "true"
  return false
}

export function toNullableBoolean(value: unknown): boolean | null {
  return value === null || value === undefined ? null : toBoolean(value)
}

/** DATETIME (no zone) is treated as UTC; see `TZ=UTC` in the api dev script. */
export function toDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === "number") return new Date(value)
  if (typeof value === "string") {
    // `2026-09-28 10:00:00` is not valid ISO for Date(); normalise the separator.
    const normalised = value.includes("T") ? value : value.replace(" ", "T")
    const parsed = new Date(normalised.endsWith("Z") ? normalised : `${normalised}Z`)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

export function toStringOrNull(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

export function toStringOr(value: unknown, fallback = ""): string {
  return value === null || value === undefined ? fallback : String(value)
}

export function toJson<T>(value: unknown): T | null {
  if (value === null || value === undefined) return null
  if (typeof value === "object") return value as T
  if (typeof value !== "string") return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function toJsonArray<T>(value: unknown): T[] {
  const parsed = toJson<T[]>(value)
  return Array.isArray(parsed) ? parsed : []
}

/** Builds a `{ column: decoded }` projection without scattering casts in repositories. */
export function pick<T>(row: Record<string, unknown>, keys: (keyof T)[]): T {
  const out = {} as Record<string, unknown>
  for (const key of keys) out[key as string] = row[key as string]
  return out as T
}
