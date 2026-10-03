/**
 * Hub, zone and recipient reference data.
 *
 * Customer-facing booking references. These endpoints are mounted on the
 * customer surface, so the API checks the ACTIVE OTP session before exposing
 * any route or customer options.
 */

import { apiRequest } from "@/lib/api-client"

export type ReferenceOption = {
  id: string
  label: string
  description?: string
}

export type ReferenceSource = "hubs" | "zones" | "recipients"

/** Named so the UI can say which endpoint is missing instead of guessing. */
export const REFERENCE_ENDPOINTS: Readonly<Record<ReferenceSource, string>> = {
  hubs: "GET /api/v1/customer/reference/hubs",
  zones: "GET /api/v1/customer/reference/zones",
  recipients: "GET /api/v1/customer/reference/recipients",
}

export async function listHubs(): Promise<ReferenceOption[]> {
  const page = await apiRequest<{
    nodes: Array<{ id: string; name: string; code: string; district: string | null }>
    meta: unknown
  }>("/customer/reference/hubs", { query: { limit: 100, sortBy: "name", sort: "asc" } })
  return page.nodes.map((hub) => ({
    id: hub.id,
    label: `${hub.name} (${hub.code})`,
    description: hub.district ?? undefined,
  }))
}

export async function listZones(): Promise<ReferenceOption[]> {
  const page = await apiRequest<{
    nodes: Array<{ id: string; name: string; code: string }>
    meta: unknown
  }>("/customer/reference/zones", { query: { limit: 100, sortBy: "name", sort: "asc" } })
  return page.nodes.map((zone) => ({ id: zone.id, label: `${zone.name} (${zone.code})` }))
}

export async function listRecipients(): Promise<ReferenceOption[]> {
  const page = await apiRequest<{
    nodes: Array<{ id: string; name: string; phone: string; email: string | null }>
    meta: unknown
  }>("/customer/reference/recipients", { query: { limit: 100, sortBy: "name", sort: "asc" } })
  return page.nodes.map((recipient) => ({
    id: recipient.id,
    label: recipient.name,
    description: recipient.phone || recipient.email || undefined,
  }))
}
