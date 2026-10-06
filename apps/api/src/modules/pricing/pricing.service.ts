import type { RowDataPacket } from "mysql2/promise"

import type { Context } from "hono"
import type { AppEnv } from "../../types/env"

import { ERROR_CODES, DomainError } from "../../core"
import type { FeeQuote, LocationServiceType, PricingDeliveryType, PricingPickupType } from "@dropx/types"
import { selectServiceCity, selectServiceZone } from "../locations/locations.repository"
import { selectLaneSlabs } from "./pricing-lanes.repository"

type Id = string

/** DECIMAL(12,2) columns — round once, here, and nowhere else. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Delivery fee quoting.
 *
 * The rule is anchored on the **lane matrix**: the trip's pickup city and
 * delivery city say which of the twelve rows applies, and the weight says which
 * slab under that row. Zones are validated, never used for pricing — they are
 * part of the address, and an address whose zone belongs to another city would
 * otherwise be billed as if it belonged here.
 *
 * This is its own module because pricing is a domain other features (admin
 * pricing screens, booking, settlements) also need.
 */

export type QuoteInput = {
  pickupCityId: Id
  pickupZoneId: Id
  deliveryCityId: Id
  deliveryZoneId: Id
  weightGrams: number
  codAmount: number
}

type LaneRow = {
  id: Id
  pickupType: PricingPickupType
  deliveryType: PricingDeliveryType
  sameCity: boolean
}

// --- Lane selection ---------------------------------------------------------

/**
 * Which of the twelve rows prices this trip.
 *
 * The mapping is not symmetric, and that is the plan's matrix rather than a
 * slip: an ISD pickup prices by the destination's service type in both
 * directions (there is one ISD row per destination type, and a same-city ISD
 * trip has an ISD destination, so it lands there too), while a SUBURB or OSD
 * pickup has a dedicated `SAME_CITY` row and a `DIFFERENT_CITY` row that covers
 * a destination of its own kind in another city.
 *
 * `sameCity` is `pickupCityId === deliveryCityId`, decided before this is
 * called, so the trip itself never guesses at its own shape.
 */
function laneKeyFor(
  pickupType: LocationServiceType,
  deliveryType: LocationServiceType,
  sameCity: boolean,
): { pickupType: PricingPickupType; deliveryType: PricingDeliveryType; sameCity: boolean } {
  if (sameCity) {
    if (pickupType === "ISD") {
      // One ISD row serves same-city and cross-city ISD trips — the plan's
      // matrix prices them identically.
      return { pickupType: "ISD", deliveryType: "ISD", sameCity: false }
    }
    return { pickupType, deliveryType: "SAME_CITY", sameCity: true }
  }

  if (pickupType === "SUBURB" && deliveryType === "SUBURB") {
    return { pickupType, deliveryType: "DIFFERENT_CITY", sameCity: false }
  }
  if (pickupType === "OSD" && deliveryType === "OSD") {
    return { pickupType, deliveryType: "DIFFERENT_CITY", sameCity: false }
  }
  return { pickupType, deliveryType, sameCity: false }
}

function invalid(message: string, field: string): DomainError {
  return new DomainError(ERROR_CODES.VALIDATION_FAILED, message, {
    details: [{ field, message }],
  })
}

/**
 * Loads one end of the trip and insists the pieces fit together.
 *
 * Both checks matter for pricing: a zone filed under another city would still
 * resolve, quietly, and a retired city would still price. The relationship is
 * re-asserted here rather than trusted from the picker, because the picker is
 * one client and this is the server.
 */
async function resolveEnd(
  c: Context<AppEnv>,
  end: { cityId: string; zoneId: string },
  labels: { city: string; zone: string },
): Promise<{ cityId: Id; serviceType: LocationServiceType }> {
  const city = await selectServiceCity(c.get("db")!, end.cityId)
  if (!city) throw invalid(`No such ${labels.city} city`, labels.city + "CityId")
  if (city.status !== "ACTIVE") {
    throw invalid(`That ${labels.city} city is not accepting bookings`, labels.city + "CityId")
  }

  const zone = await selectServiceZone(c.get("db")!, end.zoneId)
  if (!zone) throw invalid(`No such ${labels.city} zone`, labels.city + "ZoneId")
  if (zone.status !== "ACTIVE") {
    throw invalid(`That ${labels.city} zone is not accepting bookings`, labels.city + "ZoneId")
  }
  if (zone.cityId !== city.id) {
    throw invalid(`That ${labels.city} zone belongs to another city`, labels.city + "ZoneId")
  }

  return { cityId: city.id, serviceType: city.serviceType }
}

async function findLane(
  c: Context<AppEnv>,
  key: { pickupType: PricingPickupType; deliveryType: PricingDeliveryType; sameCity: boolean },
): Promise<LaneRow> {
  const [rows] = await c.get("db")!.query<(RowDataPacket & Record<string, unknown>)[]>(
    `SELECT id, pickup_type, delivery_type, same_city
       FROM pricing_lanes
      WHERE status = 'ACTIVE'
        AND pickup_type = ?
        AND delivery_type = ?
        AND same_city = ?
      LIMIT 1`,
    [key.pickupType, key.deliveryType, key.sameCity],
  )

  const row = rows[0]
  if (!row) {
    throw new DomainError(
      ERROR_CODES.VALIDATION_FAILED,
      "No delivery price is configured for that route",
      { details: [{ field: "deliveryCityId", message: "No price covers this route" }] },
    )
  }

  return {
    id: String(row.id),
    pickupType: row.pickup_type as PricingPickupType,
    deliveryType: row.delivery_type as PricingDeliveryType,
    sameCity: Boolean(row.same_city),
  }
}

/**
 * The slab, or the top slab plus the charge for the excess.
 *
 * `extraKgFee` is a charge for weight *above* the band, not a per-kilogram rate
 * applied to the whole parcel — so a 2.4kg parcel pays the 1–2kg price plus one
 * extra kilogram, and the plan's "do not silently reuse `price_per_kg`" holds:
 * there is no per-kilogram rate anywhere in this path.
 */
function pickSlab(
  weightGrams: number,
  slabs: Awaited<ReturnType<typeof selectLaneSlabs>>,
): { slab: (typeof slabs)[number]; extraWeightFee: number } {
  const band = slabs.find(
    (slab) => slab.status === "ACTIVE" && weightGrams >= slab.minWeightGrams && weightGrams <= slab.maxWeightGrams,
  )
  if (band) return { slab: band, extraWeightFee: 0 }

  const top = slabs[slabs.length - 1]
  if (top && top.status === "ACTIVE" && weightGrams > top.maxWeightGrams) {
    const extraUnits = Math.ceil((weightGrams - top.maxWeightGrams) / 1000)
    return { slab: top, extraWeightFee: round2(extraUnits * top.extraKgFee) }
  }

  throw new DomainError(
    ERROR_CODES.VALIDATION_FAILED,
    "No delivery price is configured for that weight",
    { details: [{ field: "weightGrams", message: "Choose a weight covered by the price list" }] },
  )
}

/**
 * The quote. Everything a client displays comes back here; it never multiplies,
 * never picks a lane, and never falls back to a different route's price.
 */
export async function quoteDeliveryFee(c: Context<AppEnv>, input: QuoteInput): Promise<FeeQuote> {
  const pickup = await resolveEnd(
    c,
    { cityId: input.pickupCityId, zoneId: input.pickupZoneId },
    { city: "pickup", zone: "pickup" },
  )
  const delivery = await resolveEnd(
    c,
    { cityId: input.deliveryCityId, zoneId: input.deliveryZoneId },
    { city: "delivery", zone: "delivery" },
  )

  const sameCity = pickup.cityId === delivery.cityId
  const key = laneKeyFor(pickup.serviceType, delivery.serviceType, sameCity)
  const lane = await findLane(c, key)

  const slabs = await selectLaneSlabs(c.get("db")!, lane.id)
  const { slab, extraWeightFee } = pickSlab(input.weightGrams, slabs)

  const baseFee = slab.baseFee
  const codFee =
    input.codAmount > 0
      ? round2((slab.codPercentage / 100) * input.codAmount + slab.codFixedFee)
      : 0

  return {
    baseFee,
    codFee,
    extraWeightFee,
    total: round2(baseFee + codFee + extraWeightFee),
    currency: "BDT",
    lane: {
      pickupType: lane.pickupType,
      deliveryType: lane.deliveryType,
      sameCity: lane.sameCity,
    },
    slab: {
      minWeightGrams: slab.minWeightGrams,
      maxWeightGrams: slab.maxWeightGrams,
    },
  }
}

// --- Legacy per-zone rules --------------------------------------------------

/**
 * The pre-migration `pricing_rules` lookup, kept because the admin's rule-match
 * preview and the rule CRUD still speak zone-to-zone. It is not used by
 * `quoteDeliveryFee` and goes away with the rules themselves.
 */
export async function findMatchingRule(
  c: Context<AppEnv>,
  input: { originZoneId: Id; destinationZoneId: Id; weightKg: number },
): Promise<RowDataPacket | null> {
  const [rows] = await c.get("db")!.query<(RowDataPacket & Record<string, unknown>)[]>(
    `SELECT id
       FROM pricing_rules
      WHERE status = 'ACTIVE'
        AND origin_zone_id = ?
        AND destination_zone_id = ?
        AND min_weight <= ?
        AND (max_weight IS NULL OR max_weight >= ?)
      ORDER BY min_weight DESC
      LIMIT 1`,
    [input.originZoneId, input.destinationZoneId, input.weightKg, input.weightKg],
  )
  return rows[0] ?? null
}
