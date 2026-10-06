import {
  PARCEL_STATUSES,
  PARCEL_TRANSITIONS,
  PARCEL_TYPES,
  PAYMENT_TYPES,
  type PaymentType,
  type ParcelType,
} from "@dropx/types"

import type {
  DeliveryQuote,
  Id,
  Page,
  Parcel,
  ParcelAddressInput,
  ParcelDetail,
  ParcelStatus,
  ParcelTracking,
} from "./types"
import type { BranchesSearch, HubsSearch } from "@/routes/org-search-params"
import { DEFAULT_BRANCHES_SEARCH, DEFAULT_HUBS_SEARCH } from "@/routes/org-search-params"

export type {
  DeliveryQuote,
  Id,
  Page,
  Parcel,
  ParcelAddressInput,
  ParcelDetail,
  ParcelStatus,
  ParcelTracking,
}
export type { ParcelType, PaymentType }
export { PARCEL_STATUSES, PARCEL_TRANSITIONS, PARCEL_TYPES, PAYMENT_TYPES }

/** Columns the API allowlists in `sortBy` — anything else is rejected. */
export const PARCEL_SORT_COLUMNS = [
  "createdAt",
  "updatedAt",
  "trackingNumber",
  "status",
  "weight",
] as const
export type ParcelSortColumn = (typeof PARCEL_SORT_COLUMNS)[number]

/** Columns the API allowlists in `sortBy` for branches. */
export const BRANCH_SORT_COLUMNS = ["name", "code", "status", "createdAt"] as const
export type BranchSortColumn = (typeof BRANCH_SORT_COLUMNS)[number]

/** Columns the API allowlists in `sortBy` for hubs. */
export const HUB_SORT_COLUMNS = ["name", "code", "type", "status", "createdAt"] as const
export type HubSortColumn = (typeof HUB_SORT_COLUMNS)[number]

/**
 * The `/parcels` default view. Links into the list need a complete search
 * object because `validateSearch` resolves every field as required, so the
 * default lives next to the sort columns rather than being reinvented per link.
 */
export const DEFAULT_PARCELS_SEARCH: ParcelListSearch = {
  page: 1,
  limit: 20,
  sortBy: "createdAt",
  sort: "desc",
  search: "",
}

/** Re-exported from `org-search-params` so nav and routes share one default. */
export type { BranchesSearch, HubsSearch }
export { DEFAULT_BRANCHES_SEARCH, DEFAULT_HUBS_SEARCH }

export type ParcelListSearch = {
  page: number
  limit: number
  sortBy: ParcelSortColumn
  sort: "asc" | "desc"
  search: string
  status?: ParcelStatus | "" | undefined
  paymentType?: PaymentType | "" | undefined
  hubId?: string | undefined
}

/** A `<Select>` expresses "no filter" as `""`; the API wants it absent. */
export function statusFilter(value: ParcelStatus | "" | undefined): ParcelStatus | undefined {
  return value === "" ? undefined : value
}

export function paymentFilter(value: PaymentType | "" | undefined): PaymentType | undefined {
  return value === "" ? undefined : value
}

/**
 * Forward edges of the lifecycle, read straight from `@dropx/types` so the
 * status picker can only offer moves the API will accept.
 */
export function nextStatuses(status: ParcelStatus): readonly ParcelStatus[] {
  return PARCEL_TRANSITIONS[status]
}

export type ParcelListParams = {
  page: number
  limit: number
  sortBy: ParcelSortColumn
  sort: "asc" | "desc"
  search?: string | undefined
  status?: ParcelStatus | undefined
  hubId?: string | undefined
  paymentType?: PaymentType | undefined
  customerId?: string | undefined
}

export type CreateParcelItemInput = {
  name: string
  description?: string | undefined
  quantity: number
  unitPrice: number
}

export type CreateParcelBody = {
  receiverCustomerId: string
  receiverName: string
  receiverPhone: string
  /** The staff route rejects a parcel without a sender customer. */
  senderCustomerId: string
  originHubId: string
  destinationHubId: string
  originZoneId: string
  destinationZoneId: string
  weight: number
  length?: number | undefined
  width?: number | undefined
  height?: number | undefined
  parcelType: ParcelType
  paymentType: PaymentType
  codAmount: number
  items: CreateParcelItemInput[]
}

export type UpdateParcelStatusBody = {
  status: ParcelStatus
  reason?: string | undefined
  hubId?: string | undefined
}

export type CancelParcelBody = { reason: string }

export type QuoteParams = {
  originZoneId: string
  destinationZoneId: string
  weightKg: number
  codAmount: number
  express: boolean
}
