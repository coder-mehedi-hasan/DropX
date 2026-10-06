import type { Context } from "hono"

import { notFound } from "../../core"
import { buildPage, normalizeListParams, type Page } from "../../db/models"
import { emit } from "../../shared/events/bus"
import type { AppEnv } from "../../types/env"

import {
  activateCustomerRow,
  selectCustomer,
  selectCustomerAddresses,
  selectCustomers,
} from "./customers.repository"
import type {
  CustomerResponse,
  CustomerWithAddressesResponse,
  ListCustomersQuery,
} from "./customers.dto"

export async function listCustomers(
  c: Context<AppEnv>,
  query: ListCustomersQuery,
): Promise<Page<CustomerResponse>> {
  const db = c.get("db")!
  const params = normalizeListParams(query)
  const { nodes, totalCount } = await selectCustomers(db, params, {
    status: query.status,
    search: query.search,
  })
  return buildPage(nodes, totalCount, params)
}

export async function getCustomer(
  c: Context<AppEnv>,
  customerId: string,
): Promise<CustomerWithAddressesResponse> {
  const db = c.get("db")!
  const customer = await selectCustomer(db, customerId)
  if (!customer) throw notFound("No such customer")
  const addresses = await selectCustomerAddresses(db, customerId)
  return { ...customer, addresses }
}

/**
 * The support override: flips a TEMP customer who accepted consent to ACTIVE
 * without a code. Idempotent by design — an ACTIVE customer passes straight
 * through untouched, so a retried POST (stale detail tab, double-click) is no
 * more harmful than a second glance. The event fires only on the actual
 * transition, mirroring what the OTP path means by "customer.activated".
 */
export async function activateCustomer(
  c: Context<AppEnv>,
  customerId: string,
): Promise<CustomerResponse> {
  const db = c.get("db")!
  const customer = await selectCustomer(db, customerId)
  if (!customer) throw notFound("No such customer")

  if (customer.status !== "ACTIVE") {
    if (await activateCustomerRow(db, customerId)) {
      emit("customer.activated", { customerId })
    }
  }

  const activated = await selectCustomer(db, customerId)
  /* c8 ignore next -- the row was just read above, or updated by the statement above. */
  if (!activated) throw notFound("No such customer")
  return activated
}
