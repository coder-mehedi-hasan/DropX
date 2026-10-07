import type { Context } from "hono"
import type { AppEnv } from "../../types/env"

import { notFound } from "../../core"
import { resolveAddress } from "../locations/locations.service"
import type {
  CreateCustomerAddressInput,
  UpdateCustomerAddressInput,
} from "./customer-addresses.dto"
import {
  deleteCustomerAddress,
  insertCustomerAddress,
  listCustomerAddresses,
  selectCustomerAddress,
  updateCustomerAddress,
  type CustomerAddressRecord,
} from "./customer-addresses.repository"

/**
 * Saved-address rules.
 *
 * A customer's address book is theirs alone: every operation is scoped to the
 * session's `customerId`, and the cascade is re-validated server-side on every
 * write because a saved address is only useful if it can prefill a booking —
 * and a booking refuses a zone that belongs to another city.
 *
 * `isDefault` is a customer-side convenience (which address to suggest first),
 * not a second address: setting one default simply clears the flag on the rest
 * of the book in the same statement, so the column can never hold two defaults.
 */

function toResponse(record: CustomerAddressRecord) {
  return {
    id: record.id,
    customerId: record.customerId,
    label: record.label,
    cityId: record.cityId,
    zoneId: record.zoneId,
    areaId: record.areaId,
    cityName: record.cityName,
    zoneName: record.zoneName,
    areaName: record.areaName,
    addressLine: record.addressLine,
    landmark: record.landmark,
    latitude: record.latitude,
    longitude: record.longitude,
    isDefault: record.isDefault,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export async function listAddresses(c: Context<AppEnv>, customerId: string) {
  const records = await listCustomerAddresses(c.get("db")!, customerId)
  return records.map(toResponse)
}

export async function createAddress(
  c: Context<AppEnv>,
  customerId: string,
  input: CreateCustomerAddressInput,
) {
  // Re-check the cascade before storing: a saved address that cannot prefill a
  // booking is a dead row, and the failure belongs at the write, not at the
  // booking the customer thought they had saved.
  await resolveAddress(c, { cityId: input.cityId, zoneId: input.zoneId, areaId: input.areaId })

  const id = await insertCustomerAddress(c.get("db")!, {
    customerId,
    label: input.label ?? null,
    cityId: input.cityId,
    zoneId: input.zoneId,
    areaId: input.areaId ?? null,
    addressLine: input.addressLine,
    landmark: input.landmark ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
  })

  const record = await selectCustomerAddress(c.get("db")!, customerId, id)
  if (!record) throw new Error("Saved address disappeared immediately after insert")
  return toResponse(record)
}

export async function updateAddress(
  c: Context<AppEnv>,
  customerId: string,
  addressId: string,
  input: UpdateCustomerAddressInput,
) {
  const existing = await selectCustomerAddress(c.get("db")!, customerId, addressId)
  if (!existing) throw notFound("No such saved address")

  // Re-validate only when the location actually moved — a label-only edit must
  // not fail because a zone was renamed under a still-valid address.
  if (input.cityId || input.zoneId || input.areaId !== undefined) {
    await resolveAddress(c, {
      cityId: input.cityId ?? existing.cityId,
      zoneId: input.zoneId ?? existing.zoneId,
      areaId: input.areaId !== undefined ? input.areaId : (existing.areaId ?? undefined),
    })
  }

  const record = await updateCustomerAddress(c.get("db")!, customerId, addressId, {
    ...(input.label !== undefined ? { label: input.label } : {}),
    ...(input.cityId ? { cityId: input.cityId } : {}),
    ...(input.zoneId ? { zoneId: input.zoneId } : {}),
    ...(input.areaId !== undefined ? { areaId: input.areaId } : {}),
    ...(input.addressLine !== undefined ? { addressLine: input.addressLine } : {}),
    ...(input.landmark !== undefined ? { landmark: input.landmark } : {}),
    ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
    ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
    ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
  })
  if (!record) throw notFound("No such saved address")
  return toResponse(record)
}

export async function deleteAddress(c: Context<AppEnv>, customerId: string, addressId: string) {
  const deleted = await deleteCustomerAddress(c.get("db")!, customerId, addressId)
  if (!deleted) throw notFound("No such saved address")
}
