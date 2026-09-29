import { buildPage, getDatabase, normalizeListParams, type ListParams, type Page } from "@dropx/db"

import type { Branch, HubWithBranch } from "@dropx/db"

import {
  insertBranch,
  insertHub,
  patchBranch,
  patchHub,
  selectBranch,
  selectBranches,
  selectHub,
  selectHubs,
} from "./org.repository"

import { DomainError, fromDatabaseError, notFound } from "../../core"

/**
 * The `org` service.
 *
 * Branches and hubs are unscoped reads — see the repository header for why.
 * What the service owns is the FK-shaped failure: `hubs.branch_id` is NOT NULL
 * and references `branches`, so creating a hub against a branch that does not
 * exist surfaces as a driver error. Catching it here turns a raw FK message
 * into `NOT_FOUND` with the branch id in the detail, which is what a form needs
 * to show ("pick a branch") rather than a 500.
 */

function toListParams(query: {
  page?: number
  limit?: number
  sortBy?: string
  sort?: "asc" | "desc"
  search?: string
}): ListParams {
  return normalizeListParams({
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sort: query.sort,
    search: query.search,
  })
}

export async function listBranches(query: {
  page?: number
  limit?: number
  sortBy?: string
  sort?: "asc" | "desc"
  status?: string
  search?: string
}): Promise<Page<Branch>> {
  const params = toListParams(query)
  const { nodes, totalCount } = await selectBranches(getDatabase(), params, {
    status: query.status as Branch["status"] | undefined,
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function getBranch(branchId: string): Promise<Branch> {
  const branch = await selectBranch(getDatabase(), branchId)
  if (!branch) throw notFound("No such branch")
  return branch
}

export async function createBranch(input: {
  name: string
  code: string
  phone?: string
  address?: string
  city?: string
  district?: string
  latitude?: number
  longitude?: number
  status: Branch["status"]
}): Promise<Branch> {
  const id = await insertBranch(getDatabase(), {
    name: input.name,
    code: input.code,
    phone: input.phone ?? null,
    address: input.address ?? null,
    city: input.city ?? null,
    district: input.district ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    status: input.status,
  })
  const branch = await selectBranch(getDatabase(), id)
  if (!branch) throw new Error("Branch disappeared immediately after insert")
  return branch
}

export async function updateBranch(
  branchId: string,
  patch: Partial<Omit<Branch, "id" | "createdAt" | "updatedAt">>,
): Promise<Branch> {
  const branch = await patchBranch(getDatabase(), branchId, patch)
  if (!branch) throw notFound("No such branch")
  return branch
}

export async function listHubs(query: {
  page?: number
  limit?: number
  sortBy?: string
  sort?: "asc" | "desc"
  branchId?: string
  type?: string
  status?: string
  search?: string
}): Promise<Page<HubWithBranch>> {
  const params = toListParams(query)
  const { nodes, totalCount } = await selectHubs(getDatabase(), params, {
    branchId: query.branchId,
    type: query.type as HubWithBranch["type"] | undefined,
    status: query.status as HubWithBranch["status"] | undefined,
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function getHub(hubId: string): Promise<HubWithBranch> {
  const hub = await selectHub(getDatabase(), hubId)
  if (!hub) throw notFound("No such hub")
  return hub
}

export async function createHub(input: {
  branchId: string
  name: string
  code: string
  type: HubWithBranch["type"]
  address?: string
  district?: string
  latitude?: number
  longitude?: number
  capacity?: number
  status: HubWithBranch["status"]
}): Promise<HubWithBranch> {
  try {
    const id = await insertHub(getDatabase(), {
      branchId: input.branchId,
      name: input.name,
      code: input.code,
      type: input.type,
      address: input.address ?? null,
      district: input.district ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      capacity: input.capacity ?? null,
      status: input.status,
    })
    const hub = await selectHub(getDatabase(), id)
    if (!hub) throw new Error("Hub disappeared immediately after insert")
    return hub
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, `A hub for branch ${input.branchId}`)
  }
}

export async function updateHub(
  hubId: string,
  patch: Partial<Omit<HubWithBranch, "id" | "createdAt" | "updatedAt">>,
): Promise<HubWithBranch> {
  // `branchId` is part of a hub's identity, not a mutable attribute — moving a
  // hub to a different branch after creation would orphan the rows that hang
  // off it. Strip it here rather than letting it through to the UPDATE, so the
  // FK stays the single source of truth for where a hub belongs.
  const { branchId: _branchId, ...rest } = patch
  void _branchId

  const hub = await patchHub(getDatabase(), hubId, rest)
  if (!hub) throw notFound("No such hub")
  return hub
}
