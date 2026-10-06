/**
 * Display labels for the location hierarchy's enumerations.
 *
 * The `serviceType` enum is ISD/SUBURB/OSD on the wire — short codes the rows
 * and the API agree on. These are the English words staff read instead.
 */

export const SERVICE_TYPE_LABEL: Record<string, string> = {
  ISD: "Inter-city same-day",
  SUBURB: "Suburban",
  OSD: "Outstation",
}

export function serviceTypeLabel(serviceType: string): string {
  return SERVICE_TYPE_LABEL[serviceType] ?? serviceType
}
