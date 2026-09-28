import type { Id } from "../port/database"
import type { EntityBase, Nullable, Timestamped } from "./base"

export const CUSTOMER_TYPES = ["INDIVIDUAL", "BUSINESS"] as const
export type CustomerType = (typeof CUSTOMER_TYPES)[number]

/**
 * `TEMP` — consented, OTP not yet verified. Portal access is denied.
 * `ACTIVE` — OTP verified. May book parcels, manage addresses, open tickets.
 * OTP codes themselves live in Redis, never here.
 */
export const CUSTOMER_STATUSES = ["TEMP", "ACTIVE"] as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

export type Customer = EntityBase &
  Timestamped & {
    name: string
    /** Unique — the primary OTP channel. */
    phone: string
    /** Unique when present. */
    email: Nullable<string>
    type: CustomerType
    status: CustomerStatus
    consentAcceptedAt: Nullable<Date>
    activatedAt: Nullable<Date>
  }

export type CustomerAddress = EntityBase &
  Timestamped & {
    customerId: Id
    label: Nullable<string>
    addressLine: string
    city: Nullable<string>
    district: Nullable<string>
    postalCode: Nullable<string>
    latitude: Nullable<number>
    longitude: Nullable<number>
    isDefault: boolean
  }

export type CustomerWithAddresses = Customer & {
  addresses: CustomerAddress[]
}
