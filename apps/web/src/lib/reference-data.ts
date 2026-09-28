/**
 * Hub, zone and recipient reference data.
 *
 * The API exposes no customer-facing endpoint for these lists, and inventing ids
 * would be worse than showing nothing: a fabricated `destinationHubId` books a
 * real parcel to a hub the customer never chose. Each resolver therefore returns
 * an empty list and the booking screen renders a "not configured yet" state.
 *
 * Back each one with:
 *   - `listHubs()`       -> `GET /api/v1/reference/hubs`   (active bookable hubs)
 *   - `listZones()`      -> `GET /api/v1/reference/zones`  (active pricing zones)
 *   - `listRecipients()` -> `GET /api/v1/customers/recipients` (sender's saved recipients)
 *
 * The pickers and the payload are already typed against these, so wiring the
 * endpoint up is a body change and nothing else.
 */

export type ReferenceOption = {
  id: string
  label: string
  description?: string
}

export type ReferenceSource = "hubs" | "zones" | "recipients"

/** Named so the UI can say which endpoint is missing instead of guessing. */
export const REFERENCE_ENDPOINTS: Readonly<Record<ReferenceSource, string>> = {
  hubs: "GET /api/v1/reference/hubs",
  zones: "GET /api/v1/reference/zones",
  recipients: "GET /api/v1/customers/recipients",
}

export async function listHubs(): Promise<ReferenceOption[]> {
  return []
}

export async function listZones(): Promise<ReferenceOption[]> {
  return []
}

export async function listRecipients(): Promise<ReferenceOption[]> {
  return []
}
