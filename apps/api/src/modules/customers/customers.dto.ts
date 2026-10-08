import { z } from "zod"

import { CUSTOMER_STATUSES, CUSTOMER_TYPES } from "../../db/models"

const id = z.string().trim().min(1)

export const customerIdParamSchema = z.object({ id })

/**
 * List filters carry no `.default()` (P0 §3.3): the defaults live in the
 * pagination arithmetic, and a `.default()` here would also make the field
 * optional on any schema derived from it. `status` is a support-relevant
 * filter — TEMP customers are exactly the rows the override exists for — and
 * `sortBy` is the published allowlist the list screen's sortable columns match.
 */
export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["name", "phone", "status", "createdAt"]).default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
  status: z.enum(CUSTOMER_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
})

export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>

/**
 * The staff projection — every `customers` column the support surface needs.
 * `consentAcceptedAt` and `activatedAt` are included because the whole reason
 * for the read is deciding whether the `activate` override applies: a TEMP
 * customer whose consent is on file but who never verified a code.
 */
export const customerResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullable(),
  type: z.enum(CUSTOMER_TYPES),
  status: z.enum(CUSTOMER_STATUSES),
  consentAcceptedAt: z.string().nullable(),
  activatedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type CustomerResponse = z.infer<typeof customerResponseSchema>

export const customerAddressResponseSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  label: z.string().nullable(),
  cityId: z.string(),
  zoneId: z.string(),
  areaId: z.string().nullable(),
  cityName: z.string(),
  zoneName: z.string(),
  areaName: z.string().nullable(),
  addressLine: z.string(),
  landmark: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/**
 * `read` carries the addresses in the same response — `customer_addresses` is
 * owned by the customer through the OTP portal, so staff reads it and never
 * gets an operation that writes it. Plan Batch 3, first decision.
 */
export const customerWithAddressesResponseSchema = customerResponseSchema.extend({
  addresses: z.array(customerAddressResponseSchema),
})

export type CustomerWithAddressesResponse = z.infer<typeof customerWithAddressesResponseSchema>
