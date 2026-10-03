import { buildPage, normalizeListParams, type ListParams, type Page } from "../../db/models"

import type { Context } from "hono"
import type { AppEnv } from "../../types/env"

import type { Scope } from "../../shared/auth/auth-context"
import type { CustomerStatus } from "../../db/models"
import type {
  ListBranchesQuery,
  ListHubsQuery,
  ListZonesQuery,
  SearchCustomersQuery,
} from "./reference.dto"
import {
  listBranchRefs,
  listHubRefs,
  listZoneRefs,
  searchCustomerRefs,
  type BranchRef,
  type CustomerRef,
  type HubRef,
  type ListHubRefsFilter,
  type ListBranchesFilter,
  type ZoneRef,
} from "./reference.repository"

/**
 * Reference reads for the admin surface.
 *
 * This service is thinner than `parcels.service.ts` on purpose — there is no
 * fee to quote and no state machine to advance, so the only judgement it makes
 * is passing the caller's `Scope` down to the repository. It still exists rather
 * than being skipped, because the layering is the rule: a handler supplies
 * business input, a service resolves the database handle, a repository takes an
 * `Executor`.
 */

function toListParams(query: {
  page?: number | undefined
  limit?: number | undefined
  sortBy?: string | undefined
  sort?: "asc" | "desc" | undefined
  search?: string | undefined
}): ListParams {
  return normalizeListParams({
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sort: query.sort,
    search: query.search,
  })
}

/**
 * A picker is a dropdown, not a report. The default page of 500 is far more than
 * any combobox shows, and an unbounded limit on an endpoint the UI calls on
 * every keystroke is how a lookup table becomes an outage.
 */
const PICKER_MAX_LIMIT = 100

function pickerParams(query: {
  page?: number | undefined
  limit?: number | undefined
  sortBy?: string | undefined
  sort?: "asc" | "desc" | undefined
  search?: string | undefined
}): ListParams {
  const params = toListParams(query)
  return { ...params, limit: Math.min(params.limit, PICKER_MAX_LIMIT) }
}

export async function listHubs(
  c: Context<AppEnv>,
  scope: Scope,
  query: ListHubsQuery,
): Promise<Page<HubRef>> {
  const params = pickerParams(query)

  const { nodes, totalCount } = await listHubRefs(c.get("db")!, scope, params, {
    type: query.type,
    status: query.status,
    search: params.search,
  } satisfies ListHubRefsFilter)

  return buildPage(nodes, totalCount, params)
}

export async function listZones(c: Context<AppEnv>, query: ListZonesQuery): Promise<Page<ZoneRef>> {
  const params = pickerParams(query)

  const { nodes, totalCount } = await listZoneRefs(c.get("db")!, params, {
    search: params.search,
    status: "ACTIVE",
  })

  return buildPage(nodes, totalCount, params)
}

export async function listBranches(
  c: Context<AppEnv>,
  query: ListBranchesQuery,
): Promise<Page<BranchRef>> {
  const params = pickerParams(query)

  const { nodes, totalCount } = await listBranchRefs(c.get("db")!, params, {
    search: params.search,
  } satisfies ListBranchesFilter)

  return buildPage(nodes, totalCount, params)
}

export async function searchCustomers(
  c: Context<AppEnv>,
  query: SearchCustomersQuery,
  status?: CustomerStatus,
): Promise<Page<CustomerRef>> {
  const params = pickerParams(query)

  const { nodes, totalCount } = await searchCustomerRefs(c.get("db")!, params, {
    search: params.search,
    status,
  })

  return buildPage(nodes, totalCount, params)
}
