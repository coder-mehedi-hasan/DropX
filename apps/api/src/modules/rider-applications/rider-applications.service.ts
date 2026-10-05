import type { Context } from "hono"

import { buildPage, normalizeListParams, type Page } from "../../db/models"
import { notFound } from "../../core"
import type { AppEnv } from "../../types/env"

import type { RiderApplication } from "./rider-applications.repository"
import { patchRiderApplication, selectRiderApplications } from "./rider-applications.repository"

export async function listRiderApplications(
  c: Context<AppEnv>,
  query: {
    page?: number
    limit?: number
    sortBy?: string
    sort?: "asc" | "desc"
    status?: string
    search?: string
  },
): Promise<Page<RiderApplication>> {
  const params = normalizeListParams(query)
  const result = await selectRiderApplications(c.get("db")!, params, {
    status: query.status as RiderApplication["status"] | undefined,
    search: query.search,
  })
  return buildPage(result.nodes, result.totalCount, params)
}

export async function updateRiderApplication(
  c: Context<AppEnv>,
  id: string,
  status: RiderApplication["status"],
): Promise<RiderApplication> {
  const application = await patchRiderApplication(c.get("db")!, id, status)
  if (!application) throw notFound("No such rider application")
  return application
}
