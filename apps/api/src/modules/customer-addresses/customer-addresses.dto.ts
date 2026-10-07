import { z } from "zod"

const id = z.string().trim().min(1)

/**
 * Boundary DTOs for the customer's saved-address book.
 *
 * A saved address is structured exactly like one end of a booking — the same
 * `cityId`/`zoneId`/`areaId` cascade plus an address line — so selecting one in
 * the booking form can prefill the picker without a translation layer. The
 * service re-checks the parent-child relationship server-side, because a client
 * that skipped the cascade is exactly the client that will send a zone from
 * another city.
 *
 * The response carries the resolved `cityName`/`zoneName`/`areaName` alongside the
 * ids. A saved address is editable, so it reads the location's *current* name
 * rather than snapshotting one — rename a zone and the address book follows,
 * which is the behaviour a customer editing their own book expects.
 */

export const createCustomerAddressSchema = z.object({
  label: z.string().trim().max(50).nullish(),
  cityId: id,
  zoneId: id,
  areaId: id.optional(),
  addressLine: z.string().trim().min(1, "Enter the house, building or flat details").max(300),
  landmark: z.string().trim().max(200).nullish(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  isDefault: z.boolean().default(false),
})

export type CreateCustomerAddressInput = z.infer<typeof createCustomerAddressSchema>

export const updateCustomerAddressSchema = createCustomerAddressSchema.partial()

export type UpdateCustomerAddressInput = z.infer<typeof updateCustomerAddressSchema>

export const customerAddressIdParamSchema = z.object({ id })

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
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
})

export type CustomerAddressResponse = z.infer<typeof customerAddressResponseSchema>
