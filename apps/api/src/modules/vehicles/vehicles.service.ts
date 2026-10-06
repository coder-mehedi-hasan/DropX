import { buildPage, normalizeListParams, type Page } from "../../db/models"

import type { Vehicle } from "../../db/models"

import { insertVehicle, patchVehicle, selectVehicle, selectVehicles } from "./vehicles.repository"

import type { Context } from "hono"
import type { AppEnv } from "../../types/env"

import { DomainError, fromDatabaseError, invalidTransition, notFound } from "../../core"

export async function listVehicles(
  c: Context<AppEnv>,
  query: {
    page?: number
    limit?: number
    sortBy?: string
    sort?: "asc" | "desc"
    type?: string
    status?: string
    search?: string
  },
): Promise<Page<Vehicle>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectVehicles(c.get("db")!, params, {
    type: query.type as Vehicle["type"] | undefined,
    status: query.status as Vehicle["status"] | undefined,
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function getVehicle(c: Context<AppEnv>, vehicleId: string): Promise<Vehicle> {
  const vehicle = await selectVehicle(c.get("db")!, vehicleId)
  if (!vehicle) throw notFound("No such vehicle")
  return vehicle
}

export async function createVehicle(
  c: Context<AppEnv>,
  input: {
    registrationNumber: string
    type: Vehicle["type"]
    capacityKg: number
    status: Vehicle["status"]
  },
): Promise<Vehicle> {
  try {
    const id = await insertVehicle(c.get("db")!, {
      registrationNumber: input.registrationNumber,
      type: input.type,
      capacityKg: input.capacityKg,
      status: input.status,
    })
    const vehicle = await selectVehicle(c.get("db")!, id)
    if (!vehicle) throw new Error("Vehicle disappeared immediately after insert")
    return vehicle
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, `A vehicle with registration number ${input.registrationNumber}`)
  }
}

export async function updateVehicle(
  c: Context<AppEnv>,
  vehicleId: string,
  patch: Partial<Omit<Vehicle, "id" | "createdAt" | "updatedAt">>,
): Promise<Vehicle> {
  try {
    const vehicle = await patchVehicle(c.get("db")!, vehicleId, patch)
    if (!vehicle) throw notFound("No such vehicle")
    return vehicle
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A vehicle with that registration number")
  }
}

/**
 * Retires a vehicle. A distinct operation rather than a `status` the caller
 * happens to send, for two reasons: the transition is stated once here rather
 * than left to each client, and a vehicle that is already inactive is reported
 * as a conflict instead of silently succeeding — so a double-click surfaces
 * rather than passing for a state change.
 *
 * `update` deliberately still accepts any status, including coming back from
 * `INACTIVE`: bringing a vehicle back is a manager's decision, and hiding it
 * would make the enum unreachable in both directions.
 */
export async function deactivateVehicle(c: Context<AppEnv>, vehicleId: string): Promise<Vehicle> {
  const vehicle = await getVehicle(c, vehicleId)
  if (vehicle.status === "INACTIVE") {
    throw invalidTransition("This vehicle is already inactive")
  }
  return updateVehicle(c, vehicleId, { status: "INACTIVE" })
}
