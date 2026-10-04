import { VEHICLE_STATUSES, VEHICLE_TYPES } from "@dropx/db"

/**
 * Display names for the vehicle enums.
 *
 * `VEHICLE_TYPES` and `VEHICLE_STATUSES` are the wire values — `COVERED_VAN`,
 * `IN_USE`. They are fine as filter defaults and as sort keys, but a table cell
 * or a `<SelectItem>` that renders the raw value shows the user the storage
 * format rather than the word. The zones screen already labels its status; this
 * is the same idea, kept in one place because the list, the form and the two
 * filter dropdowns all have to agree.
 *
 * Typed as exhaustive `Record`s over the enums, so adding a status to the API is
 * a compile error here until it has a label — the same guarantee
 * `STATUS_LABELS` in the form gives for free once it lives outside it.
 */
export const VEHICLE_TYPE_LABELS: Record<(typeof VEHICLE_TYPES)[number], string> = {
  BIKE: "Bike",
  VAN: "Van",
  TRUCK: "Truck",
  COVERED_VAN: "Covered van",
}

export const VEHICLE_STATUS_LABELS: Record<(typeof VEHICLE_STATUSES)[number], string> = {
  AVAILABLE: "Available",
  IN_USE: "In use",
  MAINTENANCE: "Maintenance",
  INACTIVE: "Inactive",
}

/** `{ value, label }` for a `ListFilterSelect`, in enum order. */
export function vehicleTypeOptions() {
  return VEHICLE_TYPES.map((value) => ({ value, label: VEHICLE_TYPE_LABELS[value] }))
}

export function vehicleStatusOptions() {
  return VEHICLE_STATUSES.map((value) => ({ value, label: VEHICLE_STATUS_LABELS[value] }))
}
