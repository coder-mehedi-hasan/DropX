/**
 * Wire types for the admin.
 *
 * `Parcel`, `ParcelItem` and the status/type unions are re-exported from
 * `@dropx/db/entities` rather than restated, so the admin cannot drift from
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

/** Alias for the one envelope the admin adds to the shared entity types. */
export type ParcelDetail = ParcelWithItems

/** `GET /auth/me` for an `admin` audience token. */
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

/*
 * Reference reads, mirroring the three `admin.reference.*` response schemas.
 *
 * Named `*Option`, not `*Ref`, on purpose. `@dropx/db/entities` already exports a
 * `HubRef` and it is a different thing: that one is the `{ code, name, district }`
 * join embedded in a parcel detail, and it carries no `id` — a picker option has
 * to, because its whole job is to be selected and sent back as a foreign key. The
 * suffix marks a row you can choose, as against a row that decorates another one.
 */

export type HubOption = {
  id: Id
  name: string
  code: string
  type: "ORIGIN" | "SORTATION" | "HUB" | "LAST_MILE"
  district: string | null
  status: "ACTIVE" | "INACTIVE"
}

export type ZoneOption = {
  id: Id
  name: string
  code: string
  status: "ACTIVE" | "INACTIVE"
}

export type CustomerOption = {
  id: Id
  name: string
  phone: string
  email: string | null
  type: "INDIVIDUAL" | "BUSINESS"
  status: "TEMP" | "ACTIVE" | "BLOCKED"
}

/** Shared by all three pickers: the API owns the ceiling, the client just sends it. */
export type ReferenceListParams = {
  page: number
  limit: number
  search?: string
  sort?: "asc" | "desc"
  sortBy?: string
}
