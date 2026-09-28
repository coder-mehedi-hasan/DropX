/**
 * Wire types for the console.
 *
 * `Parcel`, `ParcelItem` and the status/type unions are re-exported from
 * `@dropx/db/entities` rather than restated, so the console cannot drift from
 * the API's domain model. The remaining types describe envelopes the API adds
 * around those entities: the `{ nodes, meta }` list contract, the tracking
 * projection, and the staff identity from `/auth/me`.
 */
import type {
  HubRef,
  Parcel,
  ParcelEventSummary,
  ParcelEventType,
  ParcelItem,
  ParcelStatus,
  ParcelTracking,
  ParcelType,
  ParcelWithItems,
} from "@dropx/db/entities"
import type { Id, Page, PageMeta } from "@dropx/db/port"

export type {
  HubRef,
  Id,
  Page,
  PageMeta,
  Parcel,
  ParcelEventSummary,
  ParcelEventType,
  ParcelItem,
  ParcelStatus,
  ParcelTracking,
  ParcelType,
  ParcelWithItems,
}

/** Alias for the one envelope the console adds to the shared entity types. */
export type ParcelDetail = ParcelWithItems

/** `GET /auth/me` for a `console` audience token. */
export type StaffIdentity = {
  kind: "staff"
  audience: string
  id: Id
  email: string
  roles: string[]
  permissions: string[]
  branchId: Id | null
  hubIds: Id[]
}

export type TokenPair = { accessToken: string; refreshToken: string; expiresIn: number }

export type LoginResult = TokenPair & {
  account: { id: Id; kind: "staff" | "rider"; name: string; email: string; roles: string[] }
}

/** The API computes the fee, so the create form only ever reads this. */
export type DeliveryQuote = {
  pricingRuleId: Id
  basePrice: number
  weightCharge: number
  codFee: number
  expressFee: number
  total: number
  currency: string
}
