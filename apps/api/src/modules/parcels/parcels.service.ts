import { randomInt } from "node:crypto"

import {
  buildPage,
  canTransitionParcel,
  getDatabase,
  normalizeListParams,
  type Id,
  type ListParams,
  type Page,
  type Parcel,
} from "@dropx/db"

import { ERROR_CODES, DomainError, fromDatabaseError, notFound } from "../../core"
import type { Scope } from "../../shared/auth/auth-context"
import { emit } from "../../shared/events/bus"
import { quoteDeliveryFee } from "../pricing/pricing.service"
import type { CreateParcelInput, ListParcelsQuery } from "./parcels.dto"
import { PARCEL_SORT_COLUMN_BY_KEY } from "./parcels.dto"
import {
  findParcelById,
  findParcelForCustomer,
  insertParcel,
  insertParcelEvent,
  insertParcelItems,
  listParcelItems,
  listParcels,
  listParcelsForCustomer,
  updateParcelStatus as updateStatusRow,
} from "./parcels.repository"

/**
 * Parcel rules.
 *
 * Ownership and scope are stamped from the auth context; the delivery fee is
 * recomputed here and never read from the request. Parcel + items + the first
 * tracking event commit together, and domain events are emitted only after
 * that commit.
 *
 * The handle is resolved here rather than passed in, and threaded explicitly
 * into the repository so a transaction can hand it a `tx` executor.
 */

const TRACKING_PREFIX = "DPX"

/** `DPX` + `YYMMDD` + 6 digits, with a unique-index check on insert. */
export function generateTrackingNumber(now = new Date()): string {
  const y = String(now.getUTCFullYear()).slice(2)
  const m = String(now.getUTCMonth() + 1).padStart(2, "0")
  const d = String(now.getUTCDate()).padStart(2, "0")
  return `${TRACKING_PREFIX}${y}${m}${d}${String(randomInt(0, 1_000_000)).padStart(6, "0")}`
}

const COMPANY_WIDE: Scope = { userId: "", branchId: null, hubIds: [], isCompanyWide: true }

function toListParams(query: ListParcelsQuery): ListParams {
  return normalizeListParams({
    page: query.page,
    limit: query.limit,
    sortBy: query.sortBy,
    sort: query.sort,
    search: query.search,
  })
}

export type ParcelListFilter = {
  status?: ListParcelsQuery["status"]
  hubId?: string | undefined
  paymentType?: ListParcelsQuery["paymentType"]
}

/**
 * The sort allowlist is not a parameter. It used to be, and a handler passing
 * the DTO's camelCase keys here is what caused `ORDER BY createdAt` and a 500.
 * The service owns the key → column map so a caller cannot supply a list that
 * disagrees with the published contract.
 */
export async function listParcelsForStaff(
  scope: Scope,
  query: ListParcelsQuery,
  searchFields: readonly string[],
): Promise<Page<Parcel>> {
  const params = toListParams(query)

  const { nodes, totalCount } = await listParcels(
    getDatabase(),
    scope,
    params,
    { ...query, search: params.search, searchFields },
    PARCEL_SORT_COLUMN_BY_KEY,
  )

  return buildPage(nodes, totalCount, params)
}

export async function listParcelsForCustomerPortal(
  customerId: Id,
  query: ListParcelsQuery,
  searchFields: readonly string[],
): Promise<Page<Parcel>> {
  const params = toListParams(query)

  const { nodes, totalCount } = await listParcelsForCustomer(
    getDatabase(),
    customerId,
    params,
    { status: query.status, search: params.search, searchFields },
    PARCEL_SORT_COLUMN_BY_KEY,
  )

  return buildPage(nodes, totalCount, params)
}

export async function getParcelForStaff(scope: Scope, parcelId: Id): Promise<Parcel> {
  const parcel = await findParcelById(getDatabase(), scope, parcelId)
  if (!parcel) throw notFound("Parcel not found")
  return parcel
}

export async function getParcelForCustomer(customerId: Id, parcelId: Id): Promise<Parcel> {
  const parcel = await findParcelForCustomer(getDatabase(), parcelId, customerId)
  if (!parcel) throw notFound("Parcel not found")
  return parcel
}

export function getParcelItems(parcelId: Id) {
  return listParcelItems(getDatabase(), parcelId)
}

export type CreateParcelCommand = {
  senderCustomerId: Id
  originZoneId: Id
  input: CreateParcelInput
  actorId: Id | null
}

export async function createParcel(command: CreateParcelCommand): Promise<Parcel> {
  const db = getDatabase()
  const { input, senderCustomerId, actorId: actor } = command

  if (input.originHubId === input.destinationHubId) {
    throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "Origin and destination hub must differ", {
      details: [{ field: "destinationHubId", message: "Pick a different destination hub" }],
    })
  }

  if (input.paymentType === "PREPAID" && input.codAmount > 0) {
    throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "COD amount only applies to COD parcels", {
      details: [{ field: "codAmount", message: "Set the payment type to COD first" }],
    })
  }

  // Recomputed server-side: a client-supplied fee is never trusted.
  const quote = await quoteDeliveryFee({
    originZoneId: command.originZoneId,
    destinationZoneId: input.destinationZoneId,
    weightKg: input.weight,
    codAmount: input.codAmount,
  })

  const trackingNumber = generateTrackingNumber()

  try {
    const parcelId = await db.transaction(async (tx) => {
      const id = await insertParcel(tx, {
        trackingNumber,
        senderCustomerId,
        receiverCustomerId: input.receiverCustomerId,
        originHubId: input.originHubId,
        destinationHubId: input.destinationHubId,
        currentHubId: input.originHubId,
        destinationZoneId: input.destinationZoneId,
        weight: input.weight,
        length: input.length,
        width: input.width,
        height: input.height,
        parcelType: input.parcelType,
        paymentType: input.paymentType,
        codAmount: input.codAmount,
        deliveryFee: quote.total,
        status: "CREATED",
      })

      if (input.items.length > 0) {
        await insertParcelItems(tx, id, input.items)
      }

      // Tracking history begins with the creation event, same commit.
      await insertParcelEvent(tx, {
        parcelId: id,
        eventType: "CREATED",
        hubId: input.originHubId,
        userId: actor,
        description: `Booked with a delivery fee of ${quote.total} BDT`,
      })

      return id
    })

    const parcel = await findParcelById(db, COMPANY_WIDE, parcelId)
    if (!parcel) throw new Error("Parcel disappeared immediately after insert")

    // After the commit — a notification outage must not lose the parcel.
    emit("parcel.created", { parcelId, trackingNumber, customerId: senderCustomerId })

    return parcel
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A parcel with this tracking number")
  }
}

export type UpdateStatusCommand = {
  parcelId: Id
  status: Parcel["status"]
  reason?: string | undefined
  hubId?: Id | undefined
  scope: Scope
  actorId: Id | null
}

/** Parcel status -> tracking event recorded alongside it. */
const STATUS_EVENT: Readonly<Record<Parcel["status"], string>> = {
  CREATED: "CREATED",
  PICKED_UP: "PICKED_UP",
  IN_TRANSIT: "DEPARTED_HUB",
  AT_HUB: "ARRIVED_HUB",
  OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  RETURNED: "RETURNED",
}

export async function updateParcelStatus(command: UpdateStatusCommand): Promise<Parcel> {
  const db = getDatabase()
  const current = await findParcelById(db, command.scope, command.parcelId)
  if (!current) throw notFound("Parcel not found")

  if (current.status === command.status) {
    throw new DomainError(
      ERROR_CODES.INVALID_STATE_TRANSITION,
      `Parcel is already ${current.status.toLowerCase().replaceAll("_", " ")}`,
    )
  }

  if (!canTransitionParcel(current.status, command.status)) {
    throw new DomainError(
      ERROR_CODES.INVALID_STATE_TRANSITION,
      `A parcel cannot move from ${current.status} to ${command.status}`,
    )
  }

  if (command.status === "CANCELLED" && !command.reason) {
    throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "A cancellation reason is required", {
      details: [{ field: "reason", message: "Tell us why the parcel is being cancelled" }],
    })
  }

  await db.transaction(async (tx) => {
    const affected = await updateStatusRow(tx, command.scope, command.parcelId, {
      status: command.status,
      currentHubId: command.hubId,
    })

    // Zero rows means the scope predicate no longer matches — treat as not
    // found rather than silently succeeding.
    if (affected === 0) throw notFound("Parcel not found")

    await insertParcelEvent(tx, {
      parcelId: command.parcelId,
      eventType: STATUS_EVENT[command.status],
      hubId: command.hubId ?? current.currentHubId,
      userId: command.actorId,
      description: command.reason ?? `Status changed to ${command.status}`,
    })
  })

  const updated = await findParcelById(db, command.scope, command.parcelId)
  if (!updated) throw notFound("Parcel not found")

  emit("parcel.status_changed", {
    parcelId: updated.id,
    trackingNumber: updated.trackingNumber,
    from: current.status,
    to: command.status,
  })

  return updated
}
