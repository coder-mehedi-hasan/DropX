import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { TrackLookup } from "@/components/track-lookup"

export const metadata: Metadata = {
  title: "Track a parcel",
  description:
    "Look up any DropX parcel with its tracking number from your account — see the status, the route and the full event history.",
}

/**
 * Same screen as the public `/track`, kept behind the portal so a signed-in
 * customer never leaves the account. The tracking number is read on the server
 * the same way, so the shareable URL stays statically renderable.
 */
export default async function PortalTrackPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>
}) {
  const params = await searchParams
  const raw = params.t
  const initialTrackingNumber = (Array.isArray(raw) ? raw[0] : raw) ?? ""

  return (
    <div className="grid gap-7">
      <PageHeader
        eyebrow="Track a parcel"
        title="Follow any shipment."
        description="Anyone with a tracking number can follow a parcel — you do not need it to be yours."
      />

      <TrackLookup initialTrackingNumber={initialTrackingNumber} submitPath="/dashboard/track" />
    </div>
  )
}
