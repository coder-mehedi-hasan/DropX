import { buildPage, normalizeListParams, type Page } from "../../db/models"

import type { Zone } from "../../db/models"

import { insertZone, patchZone, selectZone, selectZones } from "./zones.repository"

import type { Context } from "hono"
import type { AppEnv } from "../../types/env"

import { DomainError, fromDatabaseError, notFound } from "../../core"

export async function listZones(
  c: Context<AppEnv>,
  query: {
    page?: number
    limit?: number
    sortBy?: string
    sort?: "asc" | "desc"
    status?: string
    search?: string
  },
): Promise<Page<Zone>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectZones(c.get("db")!, params, {
    status: query.status as Zone["status"] | undefined,
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function getZone(c: Context<AppEnv>, zoneId: string): Promise<Zone> {
  const zone = await selectZone(c.get("db")!, zoneId)
  if (!zone) throw notFound("No such zone")
  return zone
}

export async function createZone(
  c: Context<AppEnv>,
  input: {
    name: string
    code: string
    description?: string
    status: Zone["status"]
  },
): Promise<Zone> {
  try {
    const id = await insertZone(c.get("db")!, {
      name: input.name,
      code: input.code,
      description: input.description ?? null,
      status: input.status,
    })
    const zone = await selectZone(c.get("db")!, id)
    if (!zone) throw new Error("Zone disappeared immediately after insert")
    return zone
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A zone with that code")
  }
}

export async function updateZone(
  c: Context<AppEnv>,
  zoneId: string,
  patch: Partial<Omit<Zone, "id" | "createdAt" | "updatedAt">>,
): Promise<Zone> {
  try {
    const zone = await patchZone(c.get("db")!, zoneId, patch)
    if (!zone) throw notFound("No such zone")
    return zone
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A zone with that code")
  }
}
