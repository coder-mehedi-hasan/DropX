import { z } from "zod"

import { PARCEL_STATUSES, PARCEL_TYPES, PAYMENT_TYPES } from "@dropx/db"

/**
 * Boundary DTOs.
 *
 * Whitelist-only: `senderCustomerId` is accepted on the **staff** create input
 * (staff book on a customer's behalf) but never on the customer one, where the
 * sender is stamped from the session.
 */

const id = z.string().trim().min(1)
const decimal = (max: number) => z.coerce.number().min(0).max(max)

const decimalPlacesError = "Use at most 2 decimal places"

const money = z.coerce
  .number()
  .min(0)
  .max(1_000_000)
  .refine((value) => Number.isInteger(value * 100), { message: decimalPlacesError })

export const listParcelsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(["createdAt", "updatedAt", "trackingNumber", "status", "weight"])
    .default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
  search: z.string().trim().max(100).optional(),
  status: z.enum(PARCEL_STATUSES).optional(),
  hubId: id.optional(),
  paymentType: z.enum(PAYMENT_TYPES).optional(),
})

export type ListParcelsQuery = z.infer<typeof listParcelsQuerySchema>

export const parcelIdParamSchema = z.object({ id })

export const parcelItemInputSchema = z.object({
  name: z.string().trim().min(1, "Item name is required").max(200),
  description: z.string().trim().max(2000).optional(),
  quantity: z.coerce.number().int().min(1).max(9999).default(1),
  unitPrice: money.default(0),
})

export const createParcelSchema = z.object({
  receiverCustomerId: id,
  receiverName: z.string().trim().min(1, "Receiver name is required").max(150),
  receiverPhone: z.string().trim().min(6).max(30),
  senderCustomerId: id.optional(),
  originHubId: id,
  destinationHubId: id,
  originZoneId: id,
  destinationZoneId: id,
  weight: decimal(9999).refine((value) => Number.isInteger(value * 100), {
    message: decimalPlacesError,
  }),
  length: decimal(9999).optional(),
  width: decimal(9999).optional(),
  height: decimal(9999).optional(),
  parcelType: z.enum(PARCEL_TYPES).default("PACKAGE"),
  paymentType: z.enum(PAYMENT_TYPES).default("PREPAID"),
  codAmount: money.default(0),
  items: z.array(parcelItemInputSchema).max(50).default([]),
})

export type CreateParcelInput = z.infer<typeof createParcelSchema>

export const updateParcelStatusSchema = z.object({
  status: z.enum(PARCEL_STATUSES),
  reason: z.string().trim().max(500).optional(),
  hubId: id.optional(),
})

export const cancelParcelSchema = z.object({
  reason: z.string().trim().min(1, "Tell us why you are cancelling").max(500),
})

/**
 * Sort keys a client may ask for — the published contract, and the enum the
 * query DTO validates against. These are camelCase because they are API surface,
 * not SQL.
 */
export const PARCEL_SORT_COLUMNS = [
  "createdAt",
  "updatedAt",
  "trackingNumber",
  "status",
  "weight",
] as const

export type ParcelSortKey = (typeof PARCEL_SORT_COLUMNS)[number]

/**
 * Sort key → the column it orders by.
 *
 * This is the seam the previous code was missing. `PARCEL_SORT_COLUMNS` was
 * passed to the query builder as if its entries were columns, so a client
 * sorting by `createdAt` produced `ORDER BY createdAt` and a 500 — the keys match
 * the DTO enum perfectly, which is exactly why it looked right. Keeping the
 * contract and the SQL in one map means a key cannot be added without naming the
 * column it reaches.
 */
export const PARCEL_SORT_COLUMN_BY_KEY: Readonly<Record<ParcelSortKey, string>> = {
  createdAt: "p.created_at",
  updatedAt: "p.updated_at",
  trackingNumber: "p.tracking_number",
  status: "p.status",
  weight: "p.weight",
}

/** Columns searched by the list `search` param. */
export const PARCEL_SEARCH_COLUMNS = ["p.tracking_number", "r.name", "r.phone"] as const

// --- Response bodies -------------------------------------------------------

export const parcelResponseSchema = z.object({
  id: z.string(),
  trackingNumber: z.string(),
  senderCustomerId: z.string(),
  receiverCustomerId: z.string(),
  originHubId: z.string(),
  destinationHubId: z.string(),
  currentHubId: z.string().nullable(),
  destinationZoneId: z.string(),
  weight: z.number(),
  length: z.number().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  parcelType: z.enum(PARCEL_TYPES),
  paymentType: z.enum(PAYMENT_TYPES),
  codAmount: z.number(),
  deliveryFee: z.number(),
  status: z.enum(PARCEL_STATUSES),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export const parcelItemResponseSchema = z.object({
  id: z.string(),
  parcelId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  quantity: z.number(),
  unitPrice: z.number(),
  totalPrice: z.number(),
  createdAt: z.iso.datetime(),
})

export const parcelWithItemsResponseSchema = parcelResponseSchema.extend({
  items: z.array(parcelItemResponseSchema),
})
