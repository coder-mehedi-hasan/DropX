import type { Connection } from "mysql2/promise"

import type { Context } from "hono"

import { DomainError, ERROR_CODES, notFound } from "../../core"
import { buildPage, normalizeListParams, type Id, type Page, type Pickup } from "../../db/models"
import { canTransitionPickup } from "@dropx/types"
import type { Scope } from "../../shared/auth/auth-context"
import { withTransaction } from "../../db/transaction"
import { emit } from "../../shared/events/bus"
import type { AppEnv } from "../../types/env"

import { insertParcelEvent, lockScopedParcelForUpdate } from "../parcels/parcels.repository"
import { selectRider } from "../riders/riders.repository"
import type {
  AssignPickupInput,
  CreatePickupInput,
  ListPickupsQuery,
  UpdatePickupStatusInput,
} from "./pickups.dto"
import {
  assignPickupRow,
  countOpenPickups,
  insertPickup,
  selectPickup,
  selectPickups,
  updatePickupStatusRow,
} from "./pickups.repository"

/**
 * Pickup rules.
 *
 * A pickup is a collection against one parcel, so it inherits the parcel's scope
 * rather than owning a hub of its own. Three consequences worth stating:
 *
 * - **Every read and both writes take a `Scope`.** The repository has no
 *   unscoped variant to reach for by accident, because an unscoped pickup read
 *   is a tenancy bug, not a missing convenience.
 * - **One open pickup per parcel.** A parcel can be collected, fail, and be
 *   collected again, so it can have several pickups over its life — but only one
 *   unfinished one at a time, enforced here the way `deliveries` enforces a
 *   single open attempt.
 * - **`PICKED_UP` moves the parcel too.** A parcel whose collection finished is
 *   `PICKED_UP` as far as the customer is concerned, so the parcel row and its
 *   tracking event move in the same transaction as the pickup. Updating them
 *   separately is how a customer watches a parcel sit at `CREATED` while
 *   dispatch believes it was collected.
 *
 * The lifecycle itself is `PICKUP_TRANSITIONS` from `@dropx/types`, next to
 * `PARCEL_TRANSITIONS` and for the same reason: the admin's status control offers
 * exactly the moves the table allows, so a dropdown cannot contain a 409.
 */

export async function listPickups(
  c: Context<AppEnv>,
  scope: Scope,
  query: ListPickupsQuery,
): Promise<Page<Pickup>> {
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectPickups(c.get("db")!, scope, params, {
    status: query.status,
    riderId: query.riderId,
    hubId: query.hubId,
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function getPickup(
  c: Context<AppEnv>,
  scope: Scope,
  pickupId: string,
): Promise<Pickup> {
  const pickup = await selectPickup(c.get("db")!, scope, pickupId)
  if (!pickup) throw notFound("No such pickup")
  return pickup
}

export type CreatePickupCommand = {
  scope: Scope
  /** The authenticated actor. `requested_by` is never taken from the body. */
  actorId: Id | null
  input: CreatePickupInput
}

export async function createPickup(
  c: Context<AppEnv>,
  command: CreatePickupCommand,
): Promise<Pickup> {
  const db = c.get("db")!

  const pickupId = await withTransaction(db, async (tx) => {
    // The parcel must exist *and* be in scope. Checking the pickup's own scope is
    // not enough — a pickup inherits its parcel's geography, so an out-of-scope
    // parcel is an out-of-scope pickup.
    const parcelId = await lockScopedParcelForUpdate(tx, command.scope, command.input.parcelId)
    if (!parcelId) throw notFound("No such parcel")

    const open = await countOpenPickups(tx, parcelId)
    if (open > 0) {
      throw new DomainError(
        ERROR_CODES.ACTIVE_ATTEMPT_EXISTS,
        "This parcel already has an unfinished pickup. Cancel or finish it before raising another.",
      )
    }

    return insertPickup(tx, {
      parcelId,
      requestedBy: command.actorId,
      pickupAddress: command.input.pickupAddress,
      scheduledAt: command.input.scheduledAt ?? null,
      status: command.input.status,
    })
  })

  return getPickup(c, command.scope, pickupId)
}

export type AssignPickupCommand = {
  scope: Scope
  actorId: Id | null
  pickupId: string
  input: AssignPickupInput
}

export async function assignPickup(
  c: Context<AppEnv>,
  command: AssignPickupCommand,
): Promise<Pickup> {
  const db = c.get("db")!

  // The rider is resolved before the transaction so a bad id is a 404 naming the
  // rider, instead of a foreign-key failure surfacing as a 500.
  const rider = await selectRider(db, command.input.riderId)
  if (!rider) throw notFound("No such rider")

  await withTransaction(db, async (tx) => {
    const current = await readLocked(tx, command.scope, command.pickupId)
    if (current.status !== "ASSIGNED") {
      assertTransition(current.status, "ASSIGNED")
    }

    // A pickup that is already assigned can be reassigned until work starts.
    // `IN_PROGRESS` and terminal states still fail through the transition guard.
    await assignPickupRow(tx, command.pickupId, rider.id, command.input.scheduledAt ?? null)

    await insertParcelEvent(tx, {
      parcelId: current.parcelId,
      eventType: "ASSIGNED_RIDER",
      riderId: rider.id,
      userId: command.actorId,
      description:
        current.status === "ASSIGNED"
          ? `Pickup reassigned to ${rider.employeeCode}`
          : `Pickup assigned to ${rider.employeeCode}`,
    })
  })

  // Fires only after the commit, so a listener can trust the assignment exists.
  emit("pickup.assigned", { pickupId: command.pickupId, riderId: rider.id })

  return getPickup(c, command.scope, command.pickupId)
}

export type UpdatePickupStatusCommand = {
  scope: Scope
  actorId: Id | null
  pickupId: string
  input: UpdatePickupStatusInput
}

export async function updatePickupStatus(
  c: Context<AppEnv>,
  command: UpdatePickupStatusCommand,
): Promise<Pickup> {
  const db = c.get("db")!
  const { input } = command
  const reason = input.reason ?? null

  // Checked here rather than in the Zod schema because it is conditional: a
  // refinement on `status` would have to reject the whole object to explain one
  // field, and this message names the pickup.
  if ((input.status === "FAILED" || input.status === "CANCELLED") && !reason) {
    throw new DomainError(
      ERROR_CODES.VALIDATION_FAILED,
      "A reason is required when a pickup fails or is cancelled",
      { details: [{ field: "reason", message: "Say what happened" }] },
    )
  }

  await withTransaction(db, async (tx) => {
    const current = await readLocked(tx, command.scope, command.pickupId)
    assertTransition(current.status, input.status)

    const affected = await updatePickupStatusRow(
      tx,
      command.scope,
      command.pickupId,
      input.status,
      reason,
    )
    if (affected === 0) throw notFound("No such pickup")

    // The parcel moves with the collection, and only on `PICKED_UP` — the other
    // statuses describe how far the *pickup* has got, and the parcel is still
    // waiting at the origin hub.
    if (input.status === "PICKED_UP") {
      await tx.execute(`UPDATE parcels SET status = 'PICKED_UP' WHERE id = ?`, [current.parcelId])
    }

    await insertParcelEvent(tx, {
      parcelId: current.parcelId,
      eventType: input.status === "PICKED_UP" ? "PICKED_UP" : "ARRIVED_HUB",
      userId: command.actorId,
      riderId: current.assignedRiderId,
      description: reason ?? `Pickup ${label(input.status)}`,
    })
  })

  return getPickup(c, command.scope, command.pickupId)
}

/**
 * Scoped *and* locked, in one statement. Reading first and locking second would
 * leave a window where two dispatchers both read `REQUESTED`, both pass
 * `assertTransition`, and both write.
 */
async function readLocked(tx: Connection, scope: Scope, pickupId: string): Promise<Pickup> {
  const pickup = await selectPickup(tx, scope, pickupId, { forUpdate: true })
  if (!pickup) throw notFound("No such pickup")
  return pickup
}

function assertTransition(from: Pickup["status"], to: Pickup["status"]): void {
  if (from === to) {
    throw new DomainError(
      ERROR_CODES.INVALID_STATE_TRANSITION,
      `This pickup is already ${label(from)}`,
    )
  }
  if (!canTransitionPickup(from, to)) {
    throw new DomainError(
      ERROR_CODES.INVALID_STATE_TRANSITION,
      `A pickup cannot move from ${label(from)} to ${label(to)}`,
    )
  }
}

function label(status: Pickup["status"]): string {
  return status.toLowerCase().replaceAll("_", " ")
}
