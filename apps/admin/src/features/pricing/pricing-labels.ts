/**
 * Display helpers for the pricing matrix.
 *
 * The wire speaks grams and the type enums the seeded lanes use; staff read
 * kilograms and plain words.
 */

export function formatGrams(grams: number): string {
  if (grams >= 1000 && grams % 1000 === 0) return `${grams / 1000} kg`
  if (grams >= 1000) return `${(grams / 1000).toFixed(1).replace(/\.0$/, "")} kg`
  return `${grams} g`
}

const PICKUP_TYPE_LABEL: Record<string, string> = {
  ISD: "Inter-city",
  SUBURB: "Suburban",
  OSD: "Outstation",
  ISD_ON_DEMAND: "Inter-city on-demand",
}

const DELIVERY_TYPE_LABEL: Record<string, string> = {
  ISD: "Inter-city",
  SUBURB: "Suburban",
  OSD: "Outstation",
  SAME_CITY: "Same city",
  DIFFERENT_CITY: "Different city",
  SAME_CITY_ON_DEMAND: "Same-city on-demand",
}

export function pickupTypeLabel(value: string): string {
  return PICKUP_TYPE_LABEL[value] ?? value
}

export function deliveryTypeLabel(value: string): string {
  return DELIVERY_TYPE_LABEL[value] ?? value
}
