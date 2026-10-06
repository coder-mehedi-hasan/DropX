import type { Context } from "hono"

import { DomainError, ERROR_CODES, fromDatabaseError } from "../../core"
import { buildPage, normalizeListParams, type Page } from "../../db/models"
import type { AppEnv } from "../../types/env"
import type { RiderLocation } from "@dropx/types"

import type { ListRiderLocationsQuery, ReportLocationInput } from "./rider-locations.dto"
import { insertRiderLocation, selectRiderLocations } from "./rider-locations.repository"
import { selectRider } from "./riders.repository"

/** Dispatch-side read: any rider's history, newest first. */
export async function listRiderLocations(
  c: Context<AppEnv>,
  query: ListRiderLocationsQuery,
): Promise<Page<RiderLocation>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectRiderLocations(c.get("db")!, params, {
    riderId: query.riderId,
  })
  return buildPage(nodes, totalCount, params)
}

/**
 * A fix is append-only and keyed on the token's rider, so the write path never
 * takes a rider id from a body: a rider who could name another rider would be
 * writing into someone else's trail.
 *
 * `recordedAt` is the device's clock, not the server's, and a phone with a wrong
 * clock is common enough that a client-supplied instant is accepted — but only
 * within a bounded window, and never far enough ahead to become the rider's
 * "latest" position forever. A stale fix is still stored; it just cannot win.
 */
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000

export async function recordRiderLocation(
  c: Context<AppEnv>,
  riderId: string,
  input: ReportLocationInput,
): Promise<RiderLocation> {
  const db = c.get("db")!

  // The FK is `riders.id`, so an unknown rider is a 404 rather than a driver error.
  if (!(await selectRider(db, riderId))) {
    throw new DomainError(ERROR_CODES.NOT_FOUND, "No such rider")
  }

  const now = Date.now()
  const reportedAt = input.recordedAt ? Date.parse(input.recordedAt) : now
  if (!Number.isFinite(reportedAt)) {
    throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "recordedAt is not a valid instant")
  }
  if (reportedAt > now + MAX_FUTURE_SKEW_MS) {
    throw new DomainError(
      ERROR_CODES.VALIDATION_FAILED,
      "A location cannot be recorded in the future. Check the device clock.",
    )
  }

  const location: Omit<RiderLocation, "id"> = {
    riderId,
    latitude: input.latitude,
    longitude: input.longitude,
    recordedAt: new Date(reportedAt).toISOString(),
  }

  let id: string
  try {
    id = await insertRiderLocation(db, location)
  } catch (error) {
    throw fromDatabaseError(error, "Could not record that location")
  }

  return { id, ...location }
}
