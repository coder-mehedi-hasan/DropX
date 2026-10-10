import type { Context } from "hono"

import { notFound } from "../../core"
import type { AppEnv } from "../../types/env"
import type {
  CustomerProfileResponse,
  UpdateCustomerProfileInput,
} from "./customer-profile.dto"
import {
  selectCustomerProfile,
  updateCustomerProfile as updateCustomerProfileRow,
  type CustomerProfileRecord,
} from "./customer-profile.repository"

/**
 * Profile rules.
 *
 * Deliberately thin: the row is the session's own, so the only question is
 * whether it exists, and the two editable fields are validated at the boundary.
 * Phone and email are the OTP identifiers and stay read-only here — changing
 * them is a verification flow, not a settings field.
 */

function toResponse(record: CustomerProfileRecord): CustomerProfileResponse {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    phone: record.phone,
    email: record.email,
    type: record.type,
    avatarUrl: record.avatarUrl,
    createdAt: record.createdAt,
  }
}

export async function getCustomerProfile(
  c: Context<AppEnv>,
  customerId: string,
): Promise<CustomerProfileResponse> {
  const record = await selectCustomerProfile(c.get("db")!, customerId)
  if (!record) throw notFound("No such customer")
  return toResponse(record)
}

export async function updateCustomerProfile(
  c: Context<AppEnv>,
  customerId: string,
  input: UpdateCustomerProfileInput,
): Promise<CustomerProfileResponse> {
  const record = await updateCustomerProfileRow(c.get("db")!, customerId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.avatarUrl !== undefined
      ? { avatarUrl: input.avatarUrl === "" ? null : input.avatarUrl }
      : {}),
  })
  if (!record) throw notFound("No such customer")
  return toResponse(record)
}