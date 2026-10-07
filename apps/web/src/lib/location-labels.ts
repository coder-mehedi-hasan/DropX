/**
 * Display labels for the location hierarchy's enumerations.
 *
 * Mirrors `apps/admin/src/features/locations/labels.ts` — the two apps cannot
 * share code, so the words stay identical across both.
 */

export const SERVICE_TYPE_LABEL: Record<string, string> = {
  ISD: "Inter-city same-day",
  SUBURB: "Suburban",
  OSD: "Outstation",
}

export function serviceTypeLabel(serviceType: string): string {
  return SERVICE_TYPE_LABEL[serviceType] ?? serviceType
}
