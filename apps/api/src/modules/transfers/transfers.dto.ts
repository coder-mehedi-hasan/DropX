import { z } from "zod"

import {
  PARCEL_STATUSES,
  TRANSFER_STATUSES,
  type ParcelStatus,
} from "../../db/models"

const id = z.string().trim().min(1)

/**
 * Two shapes on purpose, for the reason `docs/handoff.md` §3.3 records: an absent
 * filter stays absent, while `createStatus` may invent a value — and only for
 * create.
 */
const recordStatus = z.enum(TRANSFER_STATUSES)
const createStatus = recordStatus.default("PLANNED")

export const listTransfersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["departedAt", "arrivedAt", "status", "createdAt"]).default("createdAt"),
  sort: z.enum(["asc", "desc"]).default("desc"),
  status: recordStatus.optional(),
  /**
   * Matches `from_hub_id` **or** `to_hub_id`, because both are ends the caller's
   * hub has to see: the transfer it is loading and the one it is about to
   * unload. See the scope note in `transfers.repository.ts`.
   */
  hubId: id.optional(),
  vehicleId: id.optional(),
  driverId: id.optional(),
  search: z.string().trim().max(100).optional(),
})
export type ListTransfersQuery = z.infer<typeof listTransfersQuerySchema>

export const transferIdParamSchema = z.object({ id })

/**
 * `driverRef` rather than `driverId`: rule 9 makes a transfer driver a **staff
 * user**, and there is no staff directory endpoint to pick from — the admin app
 * has no screen that lists `users`. So the field accepts either the row id or the
 * staff member's email, which is the one string a dispatcher actually has. The
 * service resolves it to an id and stores only that; `driver_id` is never
 * attacker-chosen because it has to match a real, active user.
 */
export const createTransferSchema = z.object({
  fromHubId: id,
  toHubId: id,
  routeId: id.nullish(),
  vehicleId: id.nullish(),
  driverRef: z.string().trim().min(1).max(255).nullish(),
  status: createStatus,
})
export type CreateTransferInput = z.infer<typeof createTransferSchema>

/**
 * Update. Every field is optional and none of them may be nulled except the three
 * that are genuinely optional on the row — a transfer that loses its origin hub
 * mid-plan is a new transfer, not an edit.
 */
export const updateTransferSchema = z
  .object({
    fromHubId: id.optional(),
    toHubId: id.optional(),
    routeId: id.nullish(),
    vehicleId: id.nullish(),
    driverRef: z.string().trim().min(1).max(255).nullish(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "Nothing to change",
  })
export type UpdateTransferInput = z.infer<typeof updateTransferSchema>

export const updateTransferStatusSchema = z.object({
  status: recordStatus,
  /** Required for `CANCELLED`, as for a delivery or a pickup. */
  reason: z.string().trim().max(500).optional(),
})
export type UpdateTransferStatusInput = z.infer<typeof updateTransferStatusSchema>

/**
 * The manifest is replaced wholesale rather than patched. A PUT here is honest
 * about what it is: "these are the parcels on this truck". It mirrors Batch 3's
 * `PUT /routes/:id/stops`, which replaced the stop list for the same reason —
 * add and remove in one body beats two operations that race each other.
 */
export const replaceTransferManifestSchema = z.object({
  parcelIds: z.array(id).max(500).refine((ids) => new Set(ids).size === ids.length, {
    message: "The same parcel was listed twice",
  }),
})
export type ReplaceTransferManifestInput = z.infer<typeof replaceTransferManifestSchema>

/**
 * The parcel statuses a parcel may be in to be put on a truck. It has to be
 * physically at the origin hub and not yet departed, which in this domain is
 * exactly these two: `PICKED_UP` (just collected) and `AT_HUB` (sorted).
 */
export const MANIFEST_PARCEL_STATUSES = ["PICKED_UP", "AT_HUB"] as const
export type ManifestParcelStatus = (typeof MANIFEST_PARCEL_STATUSES)[number]
export const MANIFEST_PARCEL_STATUS_SET: ReadonlySet<ParcelStatus> = new Set(MANIFEST_PARCEL_STATUSES)

/**
 * Both hub names and codes ride along with the ids.
 *
 * A dispatcher reads "Kamalpur → Faridpur", not two UUIDs, and the list is the
 * screen where that matters most. They are non-nullable because both ends are
 * required by the schema — the `LEFT JOIN` in the repository is only there so a
 * broken hub row degrades to an empty string rather than failing the whole read.
 */
const transferCore = z.object({
  id: z.string(),
  transferNumber: z.string(),
  fromHubId: z.string(),
  toHubId: z.string(),
  routeId: z.string().nullable(),
  vehicleId: z.string().nullable(),
  driverId: z.string().nullable(),
  status: z.enum(TRANSFER_STATUSES),
  departedAt: z.string().nullable(),
  arrivedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  fromHubName: z.string(),
  fromHubCode: z.string(),
  toHubName: z.string(),
  toHubCode: z.string(),
})

export const transferResponseSchema = transferCore
export type TransferResponse = z.infer<typeof transferResponseSchema>

/**
 * The manifest item, as it appears inside a transfer and as a list of its own.
 */
export const transferParcelSchema = z.object({
  parcelId: z.string(),
  trackingNumber: z.string(),
  status: z.enum(PARCEL_STATUSES),
  loadedAt: z.string().nullable(),
  unloadedAt: z.string().nullable(),
})
export type TransferParcelResponse = z.infer<typeof transferParcelSchema>

/**
 * The manifest on its own, as a bare array rather than a `{ nodes, meta }` page.
 *
 * A manifest is capped at 500 parcels by the `PUT` that writes it, so paging it
 * would be a fiction: there is no page 2 to fetch, and a `meta` block implying
 * otherwise would push the admin client into rendering pagination controls that
 * cannot work. `routes/:id/stops` made the same call for the same reason, and a
 * reader comparing the two features should find them shaped alike.
 */
export const transferParcelListSchema = z.array(transferParcelSchema)

/**
 * The read, update, and status operations return the manifest with the transfer,
 * so opening one row is one request.
 */
export const transferWithManifestResponseSchema = transferCore.extend({
  parcels: z.array(transferParcelSchema),
})
export type TransferWithManifest = z.infer<typeof transferWithManifestResponseSchema>

/**
 * The list row: the transfer plus a **count**, not the manifest.
 *
 * A page of 20 transfers each carrying up to 500 manifest rows would be a
 * 10,000-row response for a screen that renders 20 lines. The count is the part a
 * dispatcher reads while scanning — "12 parcels on this truck" — so it is computed
 * by one grouped subquery over the page rather than one query per row.
 */
export const transferListItemSchema = transferCore.extend({
  parcelCount: z.number().int().min(0),
})
export type TransferListItem = z.infer<typeof transferListItemSchema>