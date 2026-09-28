import type { ParcelEventType, ParcelStatus } from "@/lib/types"

/**
 * Formatting helpers.
 *
 * Every formatter pins its locale and time zone: these run during server render
 * and again after hydration, and anything derived from the runtime's own locale
 * or zone produces a different string on each pass, which React reports as a
 * hydration mismatch. The API serves UTC timestamps.
 */

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
})

export function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return `${dateFormat.format(date)}`
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "—"
  return `${dateTimeFormat.format(date)} UTC`
}

export function formatMoney(amount: number, currency = "BDT"): string {
  return `${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export function formatWeight(kg: number): string {
  return `${kg.toLocaleString("en-US", { maximumFractionDigits: 2 })} kg`
}

export function formatDimensions(
  length: number | null,
  width: number | null,
  height: number | null,
): string {
  const [l, w, h] = [length, width, height]
  if (l === null && w === null && h === null) return "—"
  const format = (value: number | null) =>
    value === null ? "—" : value.toLocaleString("en-US", { maximumFractionDigits: 2 })
  return `${format(l)} × ${format(w)} × ${format(h)} cm`
}

const EVENT_LABELS: Readonly<Record<ParcelEventType, string>> = {
  CREATED: "Parcel booked",
  PICKED_UP: "Picked up",
  ARRIVED_HUB: "Arrived at hub",
  DEPARTED_HUB: "Departed hub",
  LOADED: "Loaded on transfer",
  UNLOADED: "Unloaded from transfer",
  ASSIGNED_RIDER: "Rider assigned",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  FAILED: "Delivery attempt failed",
  RETURNED: "On its way back",
}

export function eventTypeLabel(eventType: string): string {
  return EVENT_LABELS[eventType as ParcelEventType] ?? eventType
}

const TERMINAL_STATUSES: ReadonlySet<ParcelStatus> = new Set(["DELIVERED", "CANCELLED", "RETURNED"])

export function isTerminal(status: ParcelStatus): boolean {
  return TERMINAL_STATUSES.has(status)
}

/** Masking matters here: the tracking view is reachable without an account. */
export function maskPhone(phone: string | null): string {
  if (!phone) return "—"
  const digits = phone.replace(/[^\d]/g, "")
  if (digits.length < 4) return phone
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`
}
