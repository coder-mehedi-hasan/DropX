import { randomUUID } from "node:crypto"

import type { LogLevel } from "./levels"

/**
 * Minimal structured logger.
 *
 * Logs are JSON in production (so a log shipper can index them) and human
 * readable elsewhere. `fields` carries the correlation id and actor on every
 * request so an error can be traced back to a call without guessing.
 */

export type LogFields = Record<string, unknown>

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
}

export type Logger = {
  level: LogLevel
  debug(message: string, fields?: LogFields): void
  info(message: string, fields?: LogFields): void
  warn(message: string, fields?: LogFields): void
  error(message: string, fields?: LogFields): void
  child(fields: LogFields): Logger
}

function serialise(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  if (value instanceof Date) return value.toISOString()
  return value
}

function emit(
  level: Exclude<LogLevel, "silent">,
  minLevel: LogLevel,
  base: LogFields,
  message: string,
  fields?: LogFields,
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return

  const payload: LogFields = { level, msg: message, ...base, ...fields }
  for (const [key, value] of Object.entries(payload)) {
    if (key === "level" || key === "msg") continue
    payload[key] = serialise(value)
  }

  if (minLevel === "silent") return
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}`

  if (level === "error") console.error(line, JSON.stringify(payload))
  else if (level === "warn") console.warn(line, JSON.stringify(payload))
  else console.log(line, JSON.stringify(payload))
}

export function createLogger(level: LogLevel, base: LogFields = {}): Logger {
  return {
    level,
    debug: (message, fields) => emit("debug", level, base, message, fields),
    info: (message, fields) => emit("info", level, base, message, fields),
    warn: (message, fields) => emit("warn", level, base, message, fields),
    error: (message, fields) => emit("error", level, base, message, fields),
    child: (fields) => createLogger(level, { ...base, ...fields }),
  }
}

export function newCorrelationId(): string {
  return randomUUID()
}
