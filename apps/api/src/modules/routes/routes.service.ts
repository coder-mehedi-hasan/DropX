import { DomainError, fromDatabaseError, notFound } from "../../core"

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
  return replaceStops(c.get("db")!, routeId, stops)
}
