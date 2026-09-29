import { z } from "zod"

import { CUSTOMER_STATUSES, CUSTOMER_TYPES, HUB_STATUSES, HUB_TYPES } from "@dropx/db"

/**
 * Reference DTOs.
 *
 * The three query schemas are the same shape on purpose — a picker wants the
 * same controls regardless of what it is picking — so they are built from one
 * base rather than copy-pasted, which is what stops them drifting apart when
 * the sort allowlist changes.
 *
 * The response schemas are the published contract, and they are narrow on
 * purpose. `CustomerRefSchema` carries no address, no consent timestamp, and no
 * `customer_addresses` join: a dropdown has no use for them, and a contract that
 * omits them is a contract a later change cannot quietly widen.
 */

const referenceListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  /**
   * A picker shows a dropdown, not a report. The ceiling here is the second half
   * of the guard — the service clamps again, so a caller bypassing the DTO still
   * cannot ask for the whole table.
   */
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["asc", "desc"]).default("asc"),
  search: z.string().trim().max(100).optional(),
})

export const listHubsQuerySchema = referenceListQuery.extend({
  sortBy: z.enum(["name", "code", "type", "status"]).default("name"),
  type: z.enum(HUB_TYPES).optional(),
  status: z.enum(HUB_STATUSES).optional(),
})

export const listZonesQuerySchema = referenceListQuery.extend({
  sortBy: z.enum(["name", "code", "status"]).default("name"),
})

export const searchCustomersQuerySchema = referenceListQuery.extend({
  sortBy: z.enum(["name", "phone", "createdAt"]).default("name"),
})

export type ListHubsQuery = z.infer<typeof listHubsQuerySchema>
export type ListZonesQuery = z.infer<typeof listZonesQuerySchema>
export type SearchCustomersQuery = z.infer<typeof searchCustomersQuerySchema>

export const hubRefResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  type: z.enum(HUB_TYPES),
  district: z.string().nullable(),
  status: z.enum(HUB_STATUSES),
})

export const zoneRefResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  code: z.string(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
})

export const customerRefResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  type: z.enum(CUSTOMER_TYPES),
  status: z.enum(CUSTOMER_STATUSES),
})
