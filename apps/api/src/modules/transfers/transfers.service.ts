import type { Connection } from "mysql2/promise"

import type { Context } from "hono"

import { DomainError, ERROR_CODES, notFound } from "../../core"
import { buildPage, normalizeListParams, type Id, type Page, type Transfer } from "../../db/models"
import type { Scope } from "../../shared/auth/auth-context"
import { withTransaction } from "../../db/transaction"
import { emit } from "../../shared/events/bus"
import type { AppEnv } from "../../types/env"
import { canTransitionParcel, canTransitionTransfer, TRANSFER_STATUSES } from "@dropx/types"

import { insertParcelEvent } from "../parcels/parcels.repository"
import type {
  CreateTransferInput,
  ListTransfersQuery,
  ReplaceTransferManifestInput,
  UpdateTransferInput,
  UpdateTransferStatusInput,
} from "./transfers.dto"
import {
  countManifest,
  deleteTransferRow,
  findHub,
  findManifestCandidates,
  findRoute,
  findStaffByRef,
  findVehicle,
  generateTransferNumber,
  insertTransfer,
  moveParcelsToHub,
  moveParcelsToStatus,
  replaceTransferManifest,
  selectTransferWithParcels,
  selectTransfers,
  stampManifestLoaded,
  stampManifestUnloaded,
  updateTransferRow,
  updateTransferStatusRow,
  type TransferWithParcels,
} from "./transfers.repository"

/**
 * Transfer rules.
 *
 * A transfer moves parcels between two hubs, and three couplings make it more
 * than a CRUD row:
 *
 * - **The manifest is sealed at departure.** Up to `IN_TRANSIT`, `PUT
 *   /transfers/:id/parcels` replaces the load list freely; from `IN_TRANSIT`
 *   onward the list is history — a parcel cannot be taken off a truck this system
 *   does not track, and one cannot be added to it either. Cancelling is not
 *   offered past departure for the same reason.
 * - **Departure and arrival move the parcels.** `IN_TRANSIT` sets every manifest
 *   parcel to `IN_TRANSIT`, and `ARRIVED` moves them to the destination hub and
 *   back to `AT_HUB`. The customer tracks `parcels.status`, so a truck that left
 *   without updating them would show every parcel on it as still sitting at the
 *   origin hub.
 * - **A truck cannot leave empty.** `IN_TRANSIT` requires a non-empty manifest,
 *   which is a 422 naming the transfer rather than a departure that arrives with
 *   nothing on it.
 *
 * The lifecycle is `TRANSFER_TRANSITIONS` from `@dropx/types`, next to the parcel
 * and pickup tables, so the admin's status control offers only legal moves.
 */

const STATUS_LABEL: Record<Transfer["status"], string> = Object.fromEntries(
  TRANSFER_STATUSES.map((status) => [status, status.toLowerCase().replaceAll("_", " ")]),
) as Record<Transfer["status"], string>

export async function listTransfers(
  c: Context<AppEnv>,
  scope: Scope,
  query: ListTransfersQuery,
): Promise<Page<TransferWithParcels>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectTransfers(c.get("db")!, scope, params, {
    status: query.status,
    hubId: query.hubId,
    vehicleId: query.vehicleId,
    driverId: query.driverId,
    direction: query.direction,
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

/**
 * The read path returns the manifest itself, so `parcelCount` — which exists for
 * the list, where the manifest is not fetched — is dropped rather than published
 * as a `null` the schema does not declare.
 */
function withoutParcelCount(
  transfer: TransferWithParcels,
): Omit<TransferWithParcels, "parcelCount"> {
  const { parcelCount: _parcelCount, ...rest } = transfer
  return rest
}

export async function getTransfer(
  c: Context<AppEnv>,
  scope: Scope,
  transferId: string,
): Promise<Omit<TransferWithParcels, "parcelCount">> {
  const transfer = await selectTransferWithParcels(c.get("db")!, scope, transferId)
  if (!transfer) throw notFound("No such transfer")
  return withoutParcelCount(transfer)
}

export async function listTransferManifest(
  c: Context<AppEnv>,
  scope: Scope,
  transferId: string,
): Promise<TransferWithParcels["parcels"]> {
  const transfer = await selectTransferWithParcels(c.get("db")!, scope, transferId)
  if (!transfer) throw notFound("No such transfer")
  return transfer.parcels
}

export type CreateTransferCommand = {
  scope: Scope
  input: CreateTransferInput
}

export async function createTransfer(
  c: Context<AppEnv>,
  command: CreateTransferCommand,
): Promise<Omit<TransferWithParcels, "parcelCount">> {
  const db = c.get("db")!
  const { input } = command

  const fromHubId = await requireHub(db, input.fromHubId, "origin hub")
  const toHubId = await requireHub(db, input.toHubId, "destination hub")
  if (fromHubId === toHubId) {
    throw new DomainError(
      ERROR_CODES.VALIDATION_FAILED,
      "A transfer has to go somewhere: the origin and destination hubs are the same",
      { details: [{ field: "toHubId", message: "Pick a different hub" }] },
    )
  }

  const routeId = await optionalReference(db, input.routeId, findRoute, "route")
  const vehicleId = await optionalReference(db, input.vehicleId, findVehicle, "vehicle")
  const driverId = await resolveDriver(db, input.driverRef)

  const transferNumber = generateTransferNumber()
  const transferId = await insertTransfer(db, {
    transferNumber,
    fromHubId,
    toHubId,
    routeId,
    vehicleId,
    driverId,
    status: input.status,
  })

  emit("transfer.created", { transferId, transferNumber })
  return getTransfer(c, command.scope, transferId)
}

export type UpdateTransferCommand = {
  scope: Scope
  transferId: string
  input: UpdateTransferInput
}

export async function updateTransfer(
  c: Context<AppEnv>,
  command: UpdateTransferCommand,
): Promise<Omit<TransferWithParcels, "parcelCount">> {
  const db = c.get("db")!
  const { input } = command

  const affected = await withTransaction(db, async (tx) => {
    const current = await readLocked(tx, command.scope, command.transferId)

    // Hubs are only editable while it is still a draft. Changing the origin after
    // parcels have been added would silently invalidate every manifest row, since
    // each parcel was validated against the *old* origin's shelf.
    const movesHubs = input.fromHubId !== undefined || input.toHubId !== undefined
    if (movesHubs && current.status !== "PLANNED") {
      throw invalidState(
        `A transfer's hubs cannot change once it is ${STATUS_LABEL[current.status]}. Cancel it and raise a new one.`,
      )
    }
    if (!movesHubs && current.status === "IN_TRANSIT") {
      throw invalidState("A transfer in transit cannot be edited.")
    }

    const patch: Parameters<typeof updateTransferRow>[3] = {}

    if (input.fromHubId !== undefined)
      patch.fromHubId = await requireHub(tx, input.fromHubId, "origin hub")
    if (input.toHubId !== undefined)
      patch.toHubId = await requireHub(tx, input.toHubId, "destination hub")
    if (patch.fromHubId !== undefined && patch.fromHubId === (patch.toHubId ?? current.toHubId)) {
      throw new DomainError(
        ERROR_CODES.VALIDATION_FAILED,
        "A transfer has to go somewhere: the origin and destination hubs are the same",
        { details: [{ field: "toHubId", message: "Pick a different hub" }] },
      )
    }
    if (input.routeId !== undefined)
      patch.routeId = await optionalReference(tx, input.routeId, findRoute, "route")
    if (input.vehicleId !== undefined)
      patch.vehicleId = await optionalReference(tx, input.vehicleId, findVehicle, "vehicle")
    if (input.driverRef !== undefined) patch.driverId = await resolveDriver(tx, input.driverRef)

    return updateTransferRow(tx, command.scope, command.transferId, patch)
  })

  if (affected === 0) throw notFound("No such transfer")
  return getTransfer(c, command.scope, command.transferId)
}

export type UpdateTransferStatusCommand = {
  scope: Scope
  actorId: Id | null
  transferId: string
  input: UpdateTransferStatusInput
}

export async function updateTransferStatus(
  c: Context<AppEnv>,
  command: UpdateTransferStatusCommand,
): Promise<Omit<TransferWithParcels, "parcelCount">> {
  const db = c.get("db")!
  const { input } = command
  const reason = input.reason ?? null

  if (input.status === "CANCELLED" && !reason) {
    throw new DomainError(
      ERROR_CODES.VALIDATION_FAILED,
      "A reason is required to cancel a transfer",
      {
        details: [{ field: "reason", message: "Say why it is not going" }],
      },
    )
  }

  const departed = await withTransaction(db, async (tx) => {
    const current = await readLocked(tx, command.scope, command.transferId)
    assertTransition(current.status, input.status)

    if (input.status === "IN_TRANSIT") {
      const parcels = await countManifest(tx, command.transferId)
      if (parcels === 0) {
        throw new DomainError(
          ERROR_CODES.VALIDATION_FAILED,
          "This transfer cannot depart empty — put at least one parcel on it first",
          { details: [{ field: "parcelIds", message: "The manifest is empty" }] },
        )
      }
    }

    if (input.status === "CANCELLED") {
      // The manifest rows go, but the parcels do not: they never left, they are
      // still on the origin hub's shelf.
      await replaceTransferManifest(tx, command.transferId, [])
    }

    const affected = await updateTransferStatusRow(
      tx,
      command.scope,
      command.transferId,
      input.status,
    )
    if (affected === 0) throw notFound("No such transfer")

    // Departure: the parcels move with the truck.
    if (input.status === "IN_TRANSIT") {
      const parcelIds = await stampManifestLoaded(tx, command.transferId)
      await moveParcelsToStatus(tx, parcelIds, "IN_TRANSIT")
      await recordEvent(tx, current, parcelIds, "DEPARTED_HUB", command.actorId, reason)
    }

    // Arrival: the parcels land at the destination and are sorted there again.
    if (input.status === "ARRIVED") {
      const parcelIds = await stampManifestUnloaded(tx, command.transferId)
      await moveParcelsToHub(tx, parcelIds, current.toHubId)
      await moveParcelsToStatus(tx, parcelIds, "AT_HUB")
      await recordEvent(tx, current, parcelIds, "ARRIVED_HUB", command.actorId, reason)
    }

    return current
  })

  if (input.status === "IN_TRANSIT") {
    emit("transfer.departed", { transferId: command.transferId, fromHubId: departed.fromHubId })
  }
  if (input.status === "ARRIVED") {
    emit("transfer.arrived", { transferId: command.transferId, toHubId: departed.toHubId })
  }

  return getTransfer(c, command.scope, command.transferId)
}

export type ReplaceManifestCommand = {
  scope: Scope
  transferId: string
  input: ReplaceTransferManifestInput
}

export async function replaceManifest(
  c: Context<AppEnv>,
  command: ReplaceManifestCommand,
): Promise<TransferWithParcels["parcels"]> {
  const db = c.get("db")!

  await withTransaction(db, async (tx) => {
    const current = await readLocked(tx, command.scope, command.transferId)

    // Past departure the manifest is a record of what was on the truck, not a
    // plan. Editing it would rewrite history the other hub has already seen.
    if (
      current.status === "IN_TRANSIT" ||
      current.status === "ARRIVED" ||
      current.status === "CANCELLED"
    ) {
      throw invalidState(
        `The manifest cannot be changed once a transfer is ${STATUS_LABEL[current.status]}.`,
      )
    }

    const parcelIds = command.input.parcelIds
    if (parcelIds.length > 0) {
      // Locked, because two dispatchers building two manifests for the same
      // origin hub would otherwise both pass this check against a stale reading.
      const candidates = await findManifestCandidates(tx, current.fromHubId, parcelIds)
      const rejected: string[] = []

      for (const parcelId of parcelIds) {
        const candidate = candidates.get(parcelId)
        if (!candidate) {
          rejected.push(parcelId)
          continue
        }
        // `canTransitionParcel` is the same table the parcel's own status update
        // uses, so a manifest cannot be built from a parcel that could not legally
        // be put on a truck.
        if (!canTransitionParcel(candidate.status, "IN_TRANSIT")) {
          rejected.push(parcelId)
        }
      }

      if (rejected.length > 0) {
        throw new DomainError(
          ERROR_CODES.VALIDATION_FAILED,
          `These parcels are not at the origin hub, or have already moved: ${rejected.join(", ")}`,
          { details: rejected.map((parcelId) => ({ field: "parcelIds", message: parcelId })) },
        )
      }
    }

    await replaceTransferManifest(tx, command.transferId, parcelIds)
  })

  return listTransferManifest(c, command.scope, command.transferId)
}

export type DeleteTransferCommand = {
  scope: Scope
  transferId: string
}

export async function deleteTransfer(
  c: Context<AppEnv>,
  command: DeleteTransferCommand,
): Promise<void> {
  const db = c.get("db")!

  const deleted = await withTransaction(db, async (tx) => {
    const current = await readLocked(tx, command.scope, command.transferId)

    if (current.status !== "PLANNED") {
      throw invalidState(
        `Only a planned transfer can be deleted. Cancel this one instead — it is ${STATUS_LABEL[current.status]}.`,
      )
    }
    // A manifest means parcels were counted onto a truck, which is a fact about
    // the operation even at `PLANNED`. Cancelling keeps that record.
    if (current.parcels.length > 0) {
      throw invalidState("This transfer has parcels on it. Cancel it instead of deleting it.")
    }

    return deleteTransferRow(tx, command.scope, command.transferId)
  })

  if (deleted === 0) throw notFound("No such transfer")
}

async function readLocked(
  tx: Connection,
  scope: Scope,
  transferId: string,
): Promise<Omit<TransferWithParcels, "parcelCount">> {
  const transfer = await selectTransferWithParcels(tx, scope, transferId, { forUpdate: true })
  if (!transfer) throw notFound("No such transfer")
  return withoutParcelCount(transfer)
}

function assertTransition(from: Transfer["status"], to: Transfer["status"]): void {
  if (from === to) {
    throw invalidState(`This transfer is already ${STATUS_LABEL[from]}.`)
  }
  if (!canTransitionTransfer(from, to)) {
    throw invalidState(`A transfer cannot move from ${STATUS_LABEL[from]} to ${STATUS_LABEL[to]}.`)
  }
}

function invalidState(message: string): DomainError {
  return new DomainError(ERROR_CODES.INVALID_STATE_TRANSITION, message)
}

/**
 * One parcel event per manifest parcel, not one per transfer: `parcel_events`
 * hangs off a parcel, and the customer's timeline is read per parcel. A transfer
 * that moved forty parcels has to leave forty traces.
 */
async function recordEvent(
  tx: Connection,
  transfer: { id: string; transferNumber: string },
  parcelIds: readonly string[],
  eventType: string,
  actorId: Id | null,
  reason: string | null,
): Promise<void> {
  for (const parcelId of parcelIds) {
    await insertParcelEvent(tx, {
      parcelId,
      eventType,
      userId: actorId,
      description:
        reason ??
        `${eventType === "DEPARTED_HUB" ? "Departed" : "Arrived"} on ${transfer.transferNumber}`,
    })
  }
}

async function requireHub(db: Connection, hubId: string, label: string): Promise<string> {
  if (await findHub(db, hubId)) return hubId
  throw notFound(`No such ${label}`)
}

/**
 * `null` in, `null` out — clearing a reference is a legitimate edit, so the
 * difference between "not mentioned" and "explicitly cleared" has to be carried by
 * the DTO's `undefined` vs `null` rather than collapsed here.
 */
async function optionalReference(
  db: Connection,
  value: string | null | undefined,
  lookup: (db: Connection, id: string) => Promise<boolean>,
  label: string,
): Promise<string | null> {
  if (value === null || value === undefined) return null
  if (await lookup(db, value)) return value
  throw notFound(`No such ${label}`)
}

async function resolveDriver(
  db: Connection,
  ref: string | null | undefined,
): Promise<string | null> {
  if (ref === null || ref === undefined || ref === "") return null
  const driverId = await findStaffByRef(db, ref)
  if (!driverId) throw notFound("No such staff member to drive this transfer")
  return driverId
}
