import type { Id } from "../port/database"
import type { EntityBase, Nullable, Timestamped } from "./base"

export type RecordStatus = "ACTIVE" | "INACTIVE"

export type Zone = EntityBase &
  Timestamped & {
    name: string
    code: string
    description: Nullable<string>
    status: RecordStatus
  }

/**
 * Fee is resolved by **destination zone** plus weight band, per `docs/overview.md`.
 * `parcels.destination_zone_id` is the anchor; `originZoneId` narrows rules when
 * the company needs directional pricing.
 */
export type PricingRule = EntityBase &
  Timestamped & {
    name: string
    originZoneId: Id
    destinationZoneId: Id
    minWeight: number
    maxWeight: Nullable<number>
    basePrice: number
    pricePerKg: number
    codPercentage: number
    codFixedFee: number
    expressFee: number
    status: RecordStatus
  }

export type Route = EntityBase &
  Timestamped & {
    name: string
    code: string
    originHubId: Id
    destinationHubId: Id
    distanceKm: Nullable<number>
    estimatedMinutes: Nullable<number>
    status: RecordStatus
  }

/** Ordered hop along a route; `sequenceNo` is unique per route. */
export type RouteStop = EntityBase & {
  routeId: Id
  hubId: Id
  sequenceNo: number
  estimatedArrivalMinutes: Nullable<number>
}

export type RouteWithStops = Route & {
  stops: RouteStop[]
}
