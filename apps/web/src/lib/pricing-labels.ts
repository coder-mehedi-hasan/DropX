/**
 * Display helpers for the pricing matrix, for when the wire's codes and grams
 * reach a customer-facing screen.
 *
 * Mirrors `apps/admin/src/features/pricing/pricing-labels.ts` — the two apps
 * cannot share code, so the labels are kept word-for-word identical to stop the
 * portal and the admin matrix from describing the same lane differently.
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
