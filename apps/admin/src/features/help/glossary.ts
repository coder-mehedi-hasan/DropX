/**
 * Admin glossary — the words the dispatcher sees on screen and what each one
 * means. Grouped by domain so a confused user lands on the right tab rather
 * than scrolling one flat list.
 *
 * Every transfer-lifecycle entry mirrors the exact button/status labels shown
 * on the Transfers page (`FORWARD_ACTION` / `STATUS_MOVE`), so the popup and
 * the screen cannot disagree about what a word means.
 */

export type GlossaryEntry = {
  term: string
  /** What the thing actually is. */
  meaning: string
  /** When a dispatcher should use it. */
  whenToUse: string
}

export type GlossaryGroup = {
  id: string
  label: string
  description: string
  entries: GlossaryEntry[]
}

export const GLOSSARY_GROUPS: readonly GlossaryGroup[] = [
  {
    id: "operations",
    label: "Operations",
    description: "The core objects of the courier machine, start to finish.",
    entries: [
      {
        term: "Parcel",
        meaning: "One shipper's consignment, tracked end to end from booking to delivery.",
        whenToUse:
          "When you mean a single tracked item. One parcel = one tracking number = one receiver.",
      },
      {
        term: "Tracking number",
        meaning: "The unique code on every parcel that customers and staff use to identify it.",
        whenToUse: "In search, to open a parcel, or to answer a customer's 'where is my parcel?'.",
      },
      {
        term: "Pickup",
        meaning: "The collection leg: a rider goes to the shipper and brings the parcel to a hub.",
        whenToUse: "Booking or assigning a collection while the parcel is still with the shipper.",
      },
      {
        term: "Transfer",
        meaning: "Moving a group of parcels between two hubs on one vehicle.",
        whenToUse: "Moving parcels from one sorting hub to another on a route.",
      },
      {
        term: "Manifest",
        meaning: "The list of parcels assigned to one truck / transfer.",
        whenToUse: "Building or checking what is physically loaded before a transfer departs.",
      },
      {
        term: "Delivery attempt",
        meaning:
          "One try at delivering a parcel to the receiver. A failed attempt is retried as a fresh attempt, never reopened.",
        whenToUse: "Tracking last-mile work — a parcel can have more than one attempt.",
      },
      {
        term: "Delivery proof",
        meaning: "The record a rider files when a delivery is done (photo, signature, note).",
        whenToUse: "Confirming what actually happened at the door before an attempt is closed.",
      },
    ],
  },
  {
    id: "transfer-lifecycle",
    label: "Transfer lifecycle",
    description: "The buttons on a transfer row and what each one does. Order is fixed.",
    entries: [
      {
        term: "Planned",
        meaning:
          "A transfer that has been raised but has nothing moving yet. Everything is still editable.",
        whenToUse: "Fine-tuning hubs, vehicle, driver, or adding parcels. No truck has left.",
      },
      {
        term: "Start loading",
        meaning:
          "Moves the transfer from Planned to Loading — parcels are being counted onto the truck.",
        whenToUse: "The moment loading begins. The manifest can still change until departure.",
      },
      {
        term: "Depart",
        meaning:
          "The truck leaves the origin hub. Seals the manifest and flips every parcel to In transit.",
        whenToUse:
          "Only when the truck is truly leaving. It cannot be undone, and no parcels can be added or removed after it.",
      },
      {
        term: "Mark arrived",
        meaning: "The truck reaches the destination hub. Parcels land there and go back to At hub.",
        whenToUse:
          "When the truck arrives. Only 'Mark arrived' is possible once a transfer is In transit.",
      },
      {
        term: "Back to planned",
        meaning: "Moves a Loading transfer back to a draft, keeping the manifest intact.",
        whenToUse:
          "Loading was abandoned but you want to keep the parcel list and start again later.",
      },
      {
        term: "Cancel",
        meaning:
          "Scraps the transfer and drops the manifest. Parcels stay on the origin hub's shelf.",
        whenToUse:
          "The transfer is not going at all. Prefer this over deleting once parcels are involved.",
      },
    ],
  },
  {
    id: "money",
    label: "Money",
    description: "How payments move from the receiver to your company.",
    entries: [
      {
        term: "COD",
        meaning: "Cash on delivery — the receiver pays for the parcel when it is handed over.",
        whenToUse: "When a parcel is booked as COD: the customer pays the rider at the door.",
      },
      {
        term: "Delivery fee",
        meaning:
          "The shipping charge for a parcel, computed server-side from the destination zone's pricing rules.",
        whenToUse: "Pricing — the fee is always recalculated from zone rules, never typed by hand.",
      },
      {
        term: "Remittance",
        meaning: "Collected COD money handed back from the rider/transfer into the company.",
        whenToUse: "Recording cash that came off a delivery route.",
      },
      {
        term: "Settlement",
        meaning: "The regular payout the company makes — rider compensation or COD you owe out.",
        whenToUse: "The Settlements screen: money going out of the company.",
      },
      {
        term: "Refund",
        meaning: "Money returned to a customer, for example when a parcel never made it.",
        whenToUse: "Recording money going back out to a customer.",
      },
    ],
  },
  {
    id: "network",
    label: "Network",
    description: "The physical structure parcels move through.",
    entries: [
      {
        term: "Branch",
        meaning: "A top-level office of the courier company.",
        whenToUse: "The org unit that hubs belong to.",
      },
      {
        term: "Hub",
        meaning: "A sorting centre. Parcels live on a hub's shelf and move from hub to hub.",
        whenToUse: "Scoping transfers and deliveries — only sorting hubs can be transfer ends.",
      },
      {
        term: "Zone",
        meaning: "A destination region used to compute delivery fees.",
        whenToUse: "Pricing rules: which zone a parcel is going to decides its fee.",
      },
      {
        term: "Route",
        meaning: "A defined path between hubs, with ordered stops, that transfers follow.",
        whenToUse: "Assigning a transfer a path and knowing which hub loads it next.",
      },
      {
        term: "Vehicle",
        meaning: "A truck assigned to hub-to-hub transfers.",
        whenToUse: "Choosing what carries the manifest.",
      },
    ],
  },
]
