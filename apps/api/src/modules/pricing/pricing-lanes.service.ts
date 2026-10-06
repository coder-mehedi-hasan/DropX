import type { Context } from "hono"

import { buildPage, normalizeListParams, type Page } from "../../db/models"
import type { PricingLane, PricingLaneWithSlabs, PricingSlab } from "../../db/models"
import { DomainError, ERROR_CODES, fromDatabaseError, notFound } from "../../core"
import type { AppEnv } from "../../types/env"

import type {
  CreatePricingSlabInput,
  ListPricingLanesQuery,
  UpdateCodSettingsInput,
  UpdatePricingLaneInput,
  UpdatePricingSlabInput,
} from "./pricing-lanes.dto"
import {
  attachSlabs,
  insertPricingSlab,
  patchPricingLane,
  patchPricingSlab,
  selectOverlappingSlab,
  selectLaneSlabs,
  selectPricingLane,
  selectPricingLanes,
  selectSlab,
  updateCodEverywhere,
} from "./pricing-lanes.repository"

/**
 * The lane matrix, admin side.
 *
 * Two rules hold the whole thing together and both live here, not in the UI:
 * a lane cannot be created (the twelve rows are product configuration), and a
 * slab cannot overlap another slab of the same lane. The first keeps the matrix
 * the plan's matrix; the second is what makes "which band does 620g fall in?"
 * have one answer. The unique keys on `(lane, min)` and `(lane, max)` stop a
 * repeated boundary; only this check stops `0-500g` next to `0-200g`.
 */

function overlapError(existing: PricingSlab): DomainError {
  return new DomainError(
    ERROR_CODES.ALREADY_EXISTS,
    `That band overlaps ${existing.minWeightGrams}-${existing.maxWeightGrams}g`,
    { status: 409 },
  )
}

export async function listPricingLanes(
  c: Context<AppEnv>,
  query: ListPricingLanesQuery,
): Promise<Page<PricingLaneWithSlabs>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectPricingLanes(c.get("db")!, params, {
    status: query.status,
  })
  const decorated = await attachSlabs(c.get("db")!, nodes)
  return buildPage(decorated, totalCount, params)
}

export async function getPricingLane(
  c: Context<AppEnv>,
  laneId: string,
): Promise<PricingLaneWithSlabs> {
  const lane = await selectPricingLane(c.get("db")!, laneId)
  if (!lane) throw notFound("No such lane")
  const slabs = await selectLaneSlabs(c.get("db")!, laneId)
  return { ...lane, slabs }
}

export async function updatePricingLane(
  c: Context<AppEnv>,
  laneId: string,
  patch: UpdatePricingLaneInput,
): Promise<PricingLane> {
  const lane = await patchPricingLane(c.get("db")!, laneId, patch)
  if (!lane) throw notFound("No such lane")
  return lane
}

export async function createPricingSlab(
  c: Context<AppEnv>,
  laneId: string,
  input: CreatePricingSlabInput,
): Promise<PricingSlab> {
  const lane = await selectPricingLane(c.get("db")!, laneId)
  if (!lane) throw notFound("No such lane")

  const clash = await selectOverlappingSlab(
    c.get("db")!,
    laneId,
    input.minWeightGrams,
    input.maxWeightGrams,
  )
  if (clash) throw overlapError(clash)

  try {
    const id = await insertPricingSlab(c.get("db")!, {
      pricingLaneId: laneId,
      minWeightGrams: input.minWeightGrams,
      maxWeightGrams: input.maxWeightGrams,
      baseFee: input.baseFee,
      extraKgFee: input.extraKgFee,
      codPercentage: input.codPercentage,
      codFixedFee: input.codFixedFee,
      status: input.status,
    })
    const slab = await selectSlab(c.get("db")!, id)
    if (!slab) throw new Error("Pricing slab disappeared immediately after insert")
    return slab
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A slab with that band")
  }
}

export async function updatePricingSlab(
  c: Context<AppEnv>,
  slabId: string,
  patch: UpdatePricingSlabInput,
): Promise<PricingSlab> {
  const current = await selectSlab(c.get("db")!, slabId)
  if (!current) throw notFound("No such slab")

  const minWeightGrams = patch.minWeightGrams ?? current.minWeightGrams
  const maxWeightGrams = patch.maxWeightGrams ?? current.maxWeightGrams
  const moved = minWeightGrams !== current.minWeightGrams || maxWeightGrams !== current.maxWeightGrams

  if (moved) {
    const clash = await selectOverlappingSlab(
      c.get("db")!,
      current.pricingLaneId,
      minWeightGrams,
      maxWeightGrams,
      slabId,
    )
    if (clash) throw overlapError(clash)
  }

  try {
    const slab = await patchPricingSlab(c.get("db")!, slabId, patch)
    if (!slab) throw notFound("No such slab")
    return slab
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A slab with that band")
  }
}

export async function updateCodSettings(
  c: Context<AppEnv>,
  input: UpdateCodSettingsInput,
): Promise<{ codPercentage: number; codFixedFee: number; slabsUpdated: number }> {
  const slabsUpdated = await updateCodEverywhere(
    c.get("db")!,
    input.codPercentage,
    input.codFixedFee,
  )
  return { codPercentage: input.codPercentage, codFixedFee: input.codFixedFee, slabsUpdated }
}
