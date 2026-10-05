import type { Connection } from "mysql2/promise"

import type { Context } from "hono"

import { DomainError, ERROR_CODES, notFound } from "../../core"
import { buildPage, normalizeListParams, type Id, type Page } from "../../db/models"
import { canTransitionDelivery } from "@dropx/types"
import type { Scope } from "../../shared/auth/auth-context"
import { withTransaction } from "../../db/transaction"
import { emit } from "../../shared/events/bus"
import type { AppEnv } from "../../types/env"

import { insertParcelEvent, lockScopedParcelForUpdate } from "../parcels/parcels.repository"
import { selectRider } from "../riders/riders.repository"
import type {
  CreateDeliveryInput,
  ListDeliveriesQuery,
  ReassignDeliveryInput,
  UpdateDeliveryStatusInput,
} from "./deliveries.dto"
import {
  countOpenAttempts,
  insertDelivery,
  nextAttemptNo,
  parcelDispatchHub,
  reassignDeliveryRow,
  selectDelivery,
  selectDeliveries,
  updateDeliveryStatusRow,
  type DeliveryRow,
} from "./deliveries.repository"

/**
 * Delivery attempt rules.
 *
 * A delivery attempt is the rider's leg of the last mile, hanging off a parcel,
 * and there is exactly one open attempt per parcel at any time. Retries are new
 * rows with the next `attempt_no` (`uq_deliveries_parcel_attempt`), never
 * reopened rows — a closed attempt is the record of what happened, and the
 * parcel's status is what the customer tracks.
 *
 * Like pickups, every read and write takes a `Scope`, enforced through the
 * parcel-side hub for create and through the attempt's own `hub_id` for reads
 * and writes: a delivery departs the hub its parcel waits at.
 *
 * The parcel moves with the attempt, in the same transaction. A `FAILED`
 * attempt that leaves the parcel at `OUT_FOR_DELIVERY` is the exact
 * inconsistency this prevents.
 */

export async function listDeliveries(
  c: Context<AppEnv>,
  scope: Scope,
  query: ListDeliveriesQuery,
): Promise<Page<DeliveryRow>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectDeliveries(c.get("db")!, scope, params, {
    status: query.status,
    riderId: query.riderId,
    hubId: query.hubId,
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function getDelivery(
  c: Context<AppEnv>,
  scope: Scope,
  deliveryId: string,
): Promise<DeliveryRow> {
  const delivery = await selectDelivery(c.get("db")!, scope, deliveryId)
  if (!delivery) throw notFound("No such delivery")
  return delivery
}

export type CreateDeliveryCommand = {
  scope: Scope
  actorId: Id | null
  input: CreateDeliveryInput
}

/** The parcel statuses a dispatch can start a delivery attempt from. */
const DISPATCHABLE_PARCEL_STATUSES = ["AT_HUB", "FAILED"] as const

export async function createDelivery(
  c: Context<AppEnv>,
  command: CreateDeliveryCommand,
): Promise<DeliveryRow> {
  const db = c.get("db")!

  const created = await withTransaction(db, async (tx) => {
    // The parcel must exist *and* be in scope; the row lock serialises a
    // second dispatcher racing to open an attempt for the same parcel.
    const parcelId = await lockScopedParcelForUpdate(tx, command.scope, command.input.parcelId)
    if (!parcelId) throw notFound("No such parcel")

    const dispatch = await parcelDispatchHub(tx, command.scope, parcelId)
    if (!dispatch) throw notFound("No such parcel")

    if (!(DISPATCHABLE_PARCEL_STATUSES as readonly string[]).includes(dispatch.status)) {
      throw new DomainError(
        ERROR_CODES.VALIDATION_FAILED,
        `A parcel in ${dispatch.status} cannot start a delivery attempt`,
        {
          details: [
            {
              field: "parcelId",
              message:
                "Only a parcel at the hub, or one to retry after a failure, can be dispatched",
            },
          ],
        },
      )
    }

    const open = await countOpenAttempts(tx, parcelId)
    if (open > 0) {
      throw new DomainError(
        ERROR_CODES.ACTIVE_ATTEMPT_EXISTS,
        "This parcel already has an open delivery attempt. Finish or cancel it before dispatching again.",
      )
    }

    // Resolved before the insert so a bad rider id is a 404 naming the rider,
    // not a foreign-key failure surfacing as a 500.
    const rider = await selectRider(db, command.input.riderId)
    if (!rider) throw notFound("No such rider")
    if (rider.status === "SUSPENDED") {
      throw new DomainError(
        ERROR_CODES.VALIDATION_FAILED,
        "A suspended rider cannot be assigned to a delivery",
        { details: [{ field: "riderId", message: "Pick a rider who is available" }] },
      )
    }

    const attemptNo = await nextAttemptNo(tx, parcelId)

    const deliveryId = await insertDelivery(tx, {
      parcelId,
      hubId: dispatch.hubId,
      riderId: rider.id,
      attemptNo,
      deliveryAddress: command.input.deliveryAddress,
    })

    await insertParcelEvent(tx, {
      parcelId,
      eventType: "ASSIGNED_RIDER",
      riderId: rider.id,
      userId: command.actorId,
      description: `Delivery attempt ${attemptNo} assigned to ${rider.employeeCode}`,
    })

    return { deliveryId, attemptNo }
  })

  emit("delivery.assigned", {
    deliveryId: created.deliveryId,
    riderId: command.input.riderId,
    attemptNo: created.attemptNo,
  })

  return getDelivery(c, command.scope, created.deliveryId)
}

export type ReassignDeliveryCommand = {
  scope: Scope
  actorId: Id | null
  deliveryId: string
  input: ReassignDeliveryInput
}

export async function reassignDelivery(
  c: Context<AppEnv>,
  command: ReassignDeliveryCommand,
): Promise<DeliveryRow> {
  const db = c.get("db")!

  const rider = await selectRider(db, command.input.riderId)
  if (!rider) throw notFound("No such rider")
  if (rider.status === "SUSPENDED") {
    throw new DomainError(
      ERROR_CODES.VALIDATION_FAILED,
      "A suspended rider cannot be assigned to a delivery",
      { details: [{ field: "riderId", message: "Pick a rider who is available" }] },
    )
  }

  const attemptNo = await withTransaction(db, async (tx) => {
    const current = await readLocked(tx, command.scope, command.deliveryId)
    if (current.status !== "ASSIGNED") {
      throw new DomainError(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        "Only an attempt that has not started can be reassigned",
      )
    }

    const affected = await reassignDeliveryRow(tx, command.scope, command.deliveryId, rider.id)
    if (affected === 0) throw notFound("No such delivery")

    await insertParcelEvent(tx, {
      parcelId: current.parcelId,
      eventType: "ASSIGNED_RIDER",
      riderId: rider.id,
      userId: command.actorId,
      description: `Delivery attempt reassigned to ${rider.employeeCode}`,
    })

    return current.attemptNo
  })

  emit("delivery.assigned", { deliveryId: command.deliveryId, riderId: rider.id, attemptNo })

  return getDelivery(c, command.scope, command.deliveryId)
}

export type UpdateDeliveryStatusCommand = {
  scope: Scope
  actorId: Id | null
  deliveryId: string
  input: UpdateDeliveryStatusInput
}

export async function updateDeliveryStatus(
  c: Context<AppEnv>,
  command: UpdateDeliveryStatusCommand,
): Promise<DeliveryRow> {
  const db = c.get("db")!
  const { input } = command
  const reason = input.reason ?? null

  if ((input.status === "FAILED" || input.status === "CANCELLED") && !reason) {
    throw new DomainError(
      ERROR_CODES.VALIDATION_FAILED,
      "A reason is required when a delivery fails or is cancelled",
      { details: [{ field: "reason", message: "Say what happened" }] },
    )
  }

  await withTransaction(db, async (tx) => {
    const current = await readLocked(tx, command.scope, command.deliveryId)
    assertTransition(current.status, input.status)

    const affected = await updateDeliveryStatusRow(
      tx,
      command.scope,
      command.deliveryId,
      input.status,
      reason,
    )
    if (affected === 0) throw notFound("No such delivery")

    // The parcel moves with the attempt: it is what the customer tracks.
    // CANCELLED releases the parcel back to its hub for re-dispatch.
    const parcelMove: Array<[string, string]> = [
      ["OUT_FOR_DELIVERY", "OUT_FOR_DELIVERY"],
      ["DELIVERED", "DELIVERED"],
      ["FAILED", "FAILED"],
      ["RETURNED", "RETURNED"],
      ["CANCELLED", "AT_HUB"],
    ]
    const next = parcelMove.find(([from]) => from === input.status)
    if (next) {
      await tx.execute(`UPDATE parcels SET status = ? WHERE id = ?`, [next[1], current.parcelId])
    }

    await insertParcelEvent(tx, {
      parcelId: current.parcelId,
      eventType: input.status === "CANCELLED" ? "ARRIVED_HUB" : input.status,
      userId: command.actorId,
      riderId: current.riderId,
      description: reason ?? `Delivery ${label(input.status)}`,
    })
  })

  return getDelivery(c, command.scope, command.deliveryId)
}

/**
 * Scoped *and* locked, in one statement. Reading first and locking second
 * would leave a window where two dispatchers both read `ASSIGNED`, both pass
 * `assertTransition`, and both write.
 */
async function readLocked(tx: Connection, scope: Scope, deliveryId: string): Promise<DeliveryRow> {
  const delivery = await selectDelivery(tx, scope, deliveryId, { forUpdate: true })
  if (!delivery) throw notFound("No such delivery")
  return delivery
}

function assertTransition(from: DeliveryRow["status"], to: DeliveryRow["status"]): void {
  if (from === to) {
    throw new DomainError(
      ERROR_CODES.INVALID_STATE_TRANSITION,
      `This delivery is already ${label(from)}`,
    )
  }
  if (!canTransitionDelivery(from, to)) {
    throw new DomainError(
      ERROR_CODES.INVALID_STATE_TRANSITION,
      `A delivery cannot move from ${label(from)} to ${label(to)}`,
    )
  }
}

function label(status: DeliveryRow["status"]): string {
  return status.toLowerCase().replaceAll("_", " ")
}
