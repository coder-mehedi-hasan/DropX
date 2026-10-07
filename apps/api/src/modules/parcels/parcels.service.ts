import { randomInt } from "node:crypto"

import type { Pool } from "mysql2/promise"
import type { Context } from "hono"
import type { AppEnv } from "../../types/env"
import { withTransaction } from "../../db/transaction"

import {
  buildPage,
  canTransitionParcel,
  normalizeListParams,
  type Id,
  type Page,
  type Parcel,
} from "../../db/models"

import { ERROR_CODES, DomainError, fromDatabaseError, notFound } from "../../core"
import type { Scope } from "../../shared/auth/auth-context"
import { emit } from "../../shared/events/bus"
import { quoteDeliveryFee } from "../pricing/pricing.service"
import { resolveAddress } from "../locations/locations.service"
import type { CreateParcelInput, ListParcelsQuery } from "./parcels.dto"
import { PARCEL_SORT_COLUMN_BY_KEY } from "./parcels.dto"
import {
  findParcelById,
  findParcelForCustomer,
  insertParcel,
  insertParcelAddresses,
  insertParcelEvent,
  insertParcelItems,
  listActiveRoutingHubs,
  listParcelAddresses,
  listParcelItems,
  listParcels,
  listParcelsForCustomer,
  updateParcelStatus as updateStatusRow,
  type ParcelAddressRecord,
  type RoutingHub,
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
  c: Context<AppEnv>,
  scope: Scope,
  query: ListParcelsQuery,
  searchFields: readonly string[],
): Promise<Page<Parcel>> {
  const params = normalizeListParams(query)

  const { nodes, totalCount } = await listParcels(
    c.get("db")!,
    scope,
    params,
    { ...query, search: params.search, searchFields },
    PARCEL_SORT_COLUMN_BY_KEY,
  )

  return buildPage(nodes, totalCount, params)
}

export async function listParcelsForCustomerPortal(
  c: Context<AppEnv>,
  customerId: Id,
  query: ListParcelsQuery,
  searchFields: readonly string[],
): Promise<Page<Parcel>> {
  const params = normalizeListParams(query)

  const { nodes, totalCount } = await listParcelsForCustomer(
    c.get("db")!,
    customerId,
    params,
    { status: query.status, search: params.search, searchFields },
    PARCEL_SORT_COLUMN_BY_KEY,
  )

  return buildPage(nodes, totalCount, params)
}

export async function getParcelForStaff(
  c: Context<AppEnv>,
  scope: Scope,
  parcelId: Id,
): Promise<Parcel> {
  const parcel = await findParcelById(c.get("db")!, scope, parcelId)
  if (!parcel) throw notFound("Parcel not found")
  return parcel
}

export async function getParcelForCustomer(
  c: Context<AppEnv>,
  customerId: Id,
  parcelId: Id,
): Promise<Parcel> {
  const parcel = await findParcelForCustomer(c.get("db")!, parcelId, customerId)
  if (!parcel) throw notFound("Parcel not found")
  return parcel
}

export function getParcelItems(c: Context<AppEnv>, parcelId: Id) {
  return listParcelItems(c.get("db")!, parcelId)
}

/**
 * The hub ids are required for staff — the admin schema keeps them required —
 * and absent for customers: `createOwnParcelSchema` omits them, because a
 * portal booking is addressed rather than routed. The pair is resolved before
 * the insert, so a command arriving here without them is a normal case, not a
 * hole in the contract.
 */
export type ParcelBookingInput = Omit<CreateParcelInput, "originHubId" | "destinationHubId"> & {
  originHubId?: Id | undefined
  destinationHubId?: Id | undefined
}

export type CreateParcelCommand = {
  senderCustomerId: Id
  input: ParcelBookingInput
  actorId: Id | null
}

type MapPoint = { latitude?: number | undefined; longitude?: number | undefined }

function distanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const deltaLat = toRadians(toLat - fromLat)
  const deltaLng = toRadians(toLng - fromLng)
  const h =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(deltaLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/**
 * The closest hub carrying coordinates, or the first candidate (lowest id,
 * because the list is ordered) when the address has no pin or no hub has any.
 * Coordinates are a ranking, not a requirement: a depot that never filled in
 * its location still books.
 */
function pickNearestHub(
  hubs: readonly RoutingHub[],
  point: MapPoint,
  excludeId?: Id,
): RoutingHub | undefined {
  const candidates = hubs.filter((hub) => hub.id !== excludeId)
  if (candidates.length === 0) return undefined

  const hasPoint = typeof point.latitude === "number" && typeof point.longitude === "number"
  if (!hasPoint) return candidates[0]

  let nearest: RoutingHub | undefined
  let nearestDistance = Number.POSITIVE_INFINITY
  for (const hub of candidates) {
    if (hub.latitude === null || hub.longitude === null) continue
    const distance = distanceKm(point.latitude!, point.longitude!, hub.latitude, hub.longitude)
    // Strictly-less keeps the lowest id on a tie, so the pick is deterministic.
    if (distance < nearestDistance) {
      nearest = hub
      nearestDistance = distance
    }
  }
  return nearest ?? candidates[0]
}

function hubMustDiffer(): DomainError {
  return new DomainError(ERROR_CODES.VALIDATION_FAILED, "Origin and destination hub must differ", {
    details: [{ field: "destinationHubId", message: "Pick a different destination hub" }],
  })
}

/**
 * Both ids in, both ids out — the staff path. Anything less is resolved from
 * the active hubs and the addresses' map coordinates: nearest to the pickup for
 * the origin, nearest to the delivery for the destination, never the same hub
 * twice. The customer portal sends no ids at all, so this is the only place its
 * parcel learns where it enters and leaves the network.
 */
async function resolveHubPair(
  db: Pool,
  input: ParcelBookingInput,
): Promise<{ originHubId: Id; destinationHubId: Id }> {
  const { originHubId, destinationHubId } = input
  if (originHubId !== undefined && destinationHubId !== undefined) {
    if (originHubId === destinationHubId) throw hubMustDiffer()
    return { originHubId, destinationHubId }
  }

  const hubs = await listActiveRoutingHubs(db)
  if (hubs.length === 0) {
    throw new DomainError(
      ERROR_CODES.VALIDATION_FAILED,
      "No active hub is configured, so nothing can be collected or delivered",
    )
  }

  const origin =
    originHubId ??
    pickNearestHub(hubs, {
      latitude: input.pickupAddress.latitude,
      longitude: input.pickupAddress.longitude,
    })?.id
  const destination =
    destinationHubId ??
    pickNearestHub(
      hubs,
      { latitude: input.deliveryAddress.latitude, longitude: input.deliveryAddress.longitude },
      origin,
    )?.id

  if (origin === undefined || destination === undefined || origin === destination) {
    throw hubMustDiffer()
  }
  return { originHubId: origin, destinationHubId: destination }
}

export async function createParcel(
  c: Context<AppEnv>,
  command: CreateParcelCommand,
): Promise<Parcel> {
  const { input, senderCustomerId, actorId: actor } = command

  // Resolved first, so a booking with no route fails before anything is quoted
  // or written. Both ids supplied is the staff path and validates here; the
  // customer path arrives with none and is routed from the address coordinates.
  const { originHubId, destinationHubId } = await resolveHubPair(c.get("db")!, input)

  if (input.paymentType === "PREPAID" && input.codAmount > 0) {
    throw new DomainError(ERROR_CODES.VALIDATION_FAILED, "COD amount only applies to COD parcels", {
      details: [{ field: "codAmount", message: "Set the payment type to COD first" }],
    })
  }

  // Resolved before anything is written: an address whose zone belongs to
  // another city, or whose city has been retired, must fail the booking rather
  // than half-commit it.
  const pickup = await resolveAddress(c, input.pickupAddress)
  const delivery = await resolveAddress(c, input.deliveryAddress)

  // Recomputed server-side: a client-supplied fee is never trusted. The weight
  // is kilograms on the wire and grams on the lane, so the conversion happens
  // here rather than in either client.
  const quote = await quoteDeliveryFee(c, {
    pickupCityId: pickup.city.id,
    pickupZoneId: pickup.zone.id,
    deliveryCityId: delivery.city.id,
    deliveryZoneId: delivery.zone.id,
    weightGrams: Math.round(input.weight * 1000),
    codAmount: input.codAmount,
  })

  const addresses: ParcelAddressRecord[] = [
    addressRecord("PICKUP", input.pickupAddress, pickup),
    addressRecord("DELIVERY", input.deliveryAddress, delivery),
  ]

  const trackingNumber = generateTrackingNumber()

  try {
    const parcelId = await withTransaction(c.get("db")!, async (tx) => {
      const id = await insertParcel(tx, {
        trackingNumber,
        senderCustomerId,
        receiverCustomerId: input.receiverCustomerId ?? null,
        receiverName: input.receiverName,
        receiverPhone: input.receiverPhone,
        ...(input.receiverSecondaryPhone
          ? { receiverSecondaryPhone: input.receiverSecondaryPhone }
          : {}),
        /* The legacy `receiver_address` and `destination_zone_id` columns are no
         * longer written: their foreign key points at the old flat `zones` table,
         * and the lane that priced this parcel lives on `parcel_addresses`. Rows
         * fall back to the column default NULL — historical parcels that
         * predate the migration keep their values for the reads that still use
         * them until those reads are removed. */
        originHubId,
        destinationHubId,
        currentHubId: originHubId,
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

      await insertParcelAddresses(tx, id, addresses)

      if (input.items.length > 0) {
        await insertParcelItems(tx, id, input.items)
      }

      // Tracking history begins with the creation event, same commit.
      await insertParcelEvent(tx, {
        parcelId: id,
        eventType: "CREATED",
        hubId: originHubId,
        userId: actor,
        description: `Booked with a delivery fee of ${quote.total} BDT`,
      })

      return id
    })

    const parcel = await findParcelById(c.get("db")!, COMPANY_WIDE, parcelId)
    if (!parcel) throw new Error("Parcel disappeared immediately after insert")

    // After the commit — a notification outage must not lose the parcel.
    emit("parcel.created", { parcelId, trackingNumber, customerId: senderCustomerId })

    return parcel
  } catch (error) {
    if (error instanceof DomainError) throw error
    throw fromDatabaseError(error, "A parcel with this tracking number")
  }
}

/** Turns a validated input plus its resolved rows into a storable address. */
function addressRecord(
  type: ParcelAddressRecord["type"],
  input: { addressLine: string; landmark?: string; latitude?: number; longitude?: number },
  resolved: Awaited<ReturnType<typeof resolveAddress>>,
): ParcelAddressRecord {
  return {
    type,
    cityId: resolved.city.id,
    zoneId: resolved.zone.id,
    areaId: resolved.area?.id ?? null,
    cityName: resolved.city.name,
    zoneName: resolved.zone.name,
    areaName: resolved.area?.name ?? null,
    addressLine: input.addressLine,
    landmark: input.landmark ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  }
}

export function getParcelAddresses(c: Context<AppEnv>, parcelId: Id) {
  return listParcelAddresses(c.get("db")!, parcelId)
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

export async function updateParcelStatus(
  c: Context<AppEnv>,
  command: UpdateStatusCommand,
): Promise<Parcel> {
  const current = await findParcelById(c.get("db")!, command.scope, command.parcelId)
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

  await withTransaction(c.get("db")!, async (tx) => {
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

  const updated = await findParcelById(c.get("db")!, command.scope, command.parcelId)
  if (!updated) throw notFound("Parcel not found")

  emit("parcel.status_changed", {
    parcelId: updated.id,
    trackingNumber: updated.trackingNumber,
    from: current.status,
    to: command.status,
  })

  return updated
}
