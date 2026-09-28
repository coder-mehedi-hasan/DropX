const money = new Intl.NumberFormat("en-BD", {
  style: "currency",
  currency: "BDT",
  maximumFractionDigits: 2,
})

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

const timeOnly = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export function formatMoney(amount: number): string {
  return money.format(amount)
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date)
}

export function formatTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? "—" : timeOnly.format(date)
}

export function formatWeight(weight: number): string {
  return `${weight} kg`
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.charAt(0) ?? "?"
  const second = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? "") : ""
  return `${first}${second}`.toUpperCase()
}
