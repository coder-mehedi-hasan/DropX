/**
 * Field name → label, for the form error summary.
 *
 * The mapping and the roll-up itself now live in `@dropx/ui`
 * (`FormErrorSummary` / `applyServerFieldErrors`) — this was the local
 * precedent they were promoted from, and it was the only call site. What stays
 * feature-local is this table, because the labels are parcel-specific: a shared
 * map would have to guess at every module's wording.
 *
 * Labels dropped the word "id" across the board. These fields no longer take an
 * id typed by hand — they are pickers — so "Sender customer id" described an
 * input that no longer exists.
 */
export const FIELD_LABELS: Record<string, string> = {
  senderCustomerId: "Sender",
  receiverCustomerId: "Receiver",
  receiverName: "Receiver name",
  receiverPhone: "Receiver phone",
  originHubId: "Origin hub",
  destinationHubId: "Destination hub",
  originZoneId: "Origin zone",
  destinationZoneId: "Destination zone",
  weight: "Weight",
  length: "Length",
  width: "Width",
  height: "Height",
  parcelType: "Parcel type",
  paymentType: "Payment type",
  codAmount: "Amount to collect",
  items: "Items",
  status: "Status",
  reason: "Reason",
  hubId: "Hub",
}
