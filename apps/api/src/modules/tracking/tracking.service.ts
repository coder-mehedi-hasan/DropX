import { getDatabase, type ParcelTracking } from "@dropx/db"

import { ERROR_CODES, DomainError } from "../../core"
import { getRedisClient } from "../../shared/redis/client"
import { decodeEventRow, decodeTrackingRow, trackingRepository } from "./tracking.repository"

/**
 * Public tracking.
 *
 * The only unauthenticated read of operational data, so it is throttled per
 * identifier and per caller to keep it from being used as an enumeration oracle.
 * The caller key is request data, so it stays a parameter; the database handle
 * and the cache are resolved here.
 */

const RATE_LIMIT = 30
const RATE_WINDOW_SECONDS = 60

function bucketKey(callerKey: string, trackingNumber: string): string {
  return `rate:tracking:${callerKey}:${trackingNumber}`
}

export async function trackParcel(
  trackingNumber: string,
  /** Usually the client IP; falls back to a fixed bucket behind a proxy. */
  callerKey: string,
): Promise<ParcelTracking> {
  const db = getDatabase()
  const redis = await getRedisClient()
  const counterKey = bucketKey(callerKey, trackingNumber)
  const attempts = await redis.incr(counterKey)

  if (attempts === 1) await redis.expire(counterKey, RATE_WINDOW_SECONDS)

  if (attempts > RATE_LIMIT) {
    throw new DomainError(
      ERROR_CODES.RATE_LIMITED,
      "Too many lookups. Please wait a minute and try again.",
    )
  }

  const row = await trackingRepository.findByTrackingNumber(db, trackingNumber)

  // 404 rather than 403: an unknown tracking number must not be distinguishable
  // from one the caller is not allowed to see.
  if (!row) {
    throw new DomainError(ERROR_CODES.NOT_FOUND, "We could not find that tracking number")
  }

  const events = await trackingRepository.findEvents(db, row.id)

  return {
    ...decodeTrackingRow(row),
    events: events.map(decodeEventRow),
  }
}
