import type { Context } from "hono"

import { buildPage, normalizeListParams, type Page } from "../../db/models"
import type { AppEnv } from "../../types/env"

import type { ListRolesQuery, RoleResponse } from "./roles.dto"
import { selectRoles } from "./roles.repository"

/**
 * The role list — Batch 1's slice of the RBAC surface. It exists here so the
 * user form's role picker reads roles through the same policy-gated operation
 * Batch 2 will build the permission matrix on, instead of through a one-off
 * reference endpoint that would then have to be retired.
 */
export async function listRoles(
  c: Context<AppEnv>,
  query: ListRolesQuery,
): Promise<Page<RoleResponse>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectRoles(c.get("db")!, params, {
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}
