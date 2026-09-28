/**
 * Display formatting.
 *
 * `Intl` formatters are created once — a parcel table renders dozens of cells
 * and constructing a `DateTimeFormat` per cell is the single easiest way to make
 * a dense list feel sluggish. `BDT` matches the API's quote currency.
 */

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
})

const DATE = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" })

const MONEY = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "BDT",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const NUMBER = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 })

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? "—" : DATE_TIME.format(date)
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? "—" : DATE.format(date)
}

export function formatMoney(value: number): string {
  return MONEY.format(value)
}

export function formatNumber(value: number): string {
  return NUMBER.format(value)
}

/** Dimensions are optional on a parcel, so a partial set reads as "—". */
export function formatDimensions(
  length: number | null,
  width: number | null,
  height: number | null,
): string {
  if (length === null && width === null && height === null) return "—"
  return `${formatNumber(length ?? 0)} × ${formatNumber(width ?? 0)} × ${formatNumber(height ?? 0)} cm`
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ""
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
  return `${first}${last}`.toUpperCase() || "?"
}
