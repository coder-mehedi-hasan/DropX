import { DomainError, ERROR_CODES, fromDatabaseError, notFound } from "../../core"

import type { Context } from "hono"
import type { AppEnv } from "../../types/env"

import { buildPage, normalizeListParams, type Page } from "../../db/models"

import type { Route, RouteStop } from "../../db/models"

import {
  deleteRoute,
  insertRoute,
  patchRoute,
  replaceStops,
  selectRoute,
  selectRoutes,
  selectHubsProvidingService,
  selectStops,
} from "./routes.repository"

import type { ListRoutesQuery, UpdateRouteInput } from "./routes.dto"

export async function listRoutes(c: Context<AppEnv>, query: ListRoutesQuery): Promise<Page<Route>> {
  const params = normalizeListParams(query)
  const status = (query.status === "" ? undefined : query.status) as Route["status"] | undefined
  const { nodes, totalCount } = await selectRoutes(c.get("db")!, params, {
    status,
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function readRoute(c: Context<AppEnv>, routeId: string): Promise<Route> {
  const route = await selectRoute(c.get("db")!, routeId)
  if (!route) throw notFound("No such route")
  return route
}

export async function createRoute(
  c: Context<AppEnv>,
  input: Parameters<typeof insertRoute>[1],
): Promise<Route> {
  try {
    await requireSortingHubs(c, [
      { id: input.originHubId, field: "originHubId" },
      { id: input.destinationHubId, field: "destinationHubId" },
    ])
    const id = await insertRoute(c.get("db")!, input)
    const route = await selectRoute(c.get("db")!, id)
    if (!route) throw new Error("Route disappeared immediately after insert")
    return route
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A route with that code already exists")
  }
}

export async function updateRoute(
  c: Context<AppEnv>,
  routeId: string,
  patch: UpdateRouteInput,
): Promise<Route> {
  try {
    await requireSortingHubs(
      c,
      [
        patch.originHubId ? { id: patch.originHubId, field: "originHubId" } : null,
        patch.destinationHubId ? { id: patch.destinationHubId, field: "destinationHubId" } : null,
      ].filter((entry): entry is { id: string; field: string } => entry !== null),
    )
    const route = await patchRoute(c.get("db")!, routeId, patch)
    if (!route) throw notFound("No such route")
    return route
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A route with that code already exists")
  }
}

export async function deleteRouteService(c: Context<AppEnv>, routeId: string): Promise<void> {
  const exists = await selectRoute(c.get("db")!, routeId)
  if (!exists) throw notFound("No such route")

  try {
    const deleted = await deleteRoute(c.get("db")!, routeId)
    if (!deleted) throw new Error("Route disappeared during delete")
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "Cannot delete the route")
  }
}

// --- Stops -------------------------------------------------------------------

export async function listStops(c: Context<AppEnv>, routeId: string): Promise<RouteStop[]> {
  const route = await selectRoute(c.get("db")!, routeId)
  if (!route) throw notFound("No such route")
  return selectStops(c.get("db")!, routeId)
}

export async function updateRouteStops(
  c: Context<AppEnv>,
  routeId: string,
  stops: { hubId: string; sequenceNo: number; estimatedArrivalMinutes?: number | null }[],
): Promise<RouteStop[]> {
  const route = await selectRoute(c.get("db")!, routeId)
  if (!route) throw notFound("No such route")
  await requireSortingHubs(
    c,
    stops.map((stop, index) => ({ id: stop.hubId, field: `stops.${index}.hubId` })),
  )
  return replaceStops(c.get("db")!, routeId, stops)
}

async function requireSortingHubs(
  c: Context<AppEnv>,
  refs: Array<{ id: string; field: string }>,
): Promise<void> {
  if (refs.length === 0) return
  const supported = await selectHubsProvidingService(
    c.get("db")!,
    [...new Set(refs.map((ref) => ref.id))],
    "SORTING",
  )
  const invalid = refs.find((ref) => !supported.has(ref.id))
  if (!invalid) return
  throw new DomainError(
    ERROR_CODES.VALIDATION_FAILED,
    "Every route hub must be active and provide sorting service",
    {
      details: [{ field: invalid.field, message: "Choose a sorting-capable hub" }],
    },
  )
}
