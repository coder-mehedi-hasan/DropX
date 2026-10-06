import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { SiteFooter, SiteHeader } from "@/components/site-chrome"
import { TrackLookup } from "@/components/track-lookup"

export const metadata: Metadata = {
  title: "Track a parcel",
  description:
    "Look up any DropX parcel with its tracking number. No account needed — see the status, the route and the full event history.",
}

/**
 * The tracking number is read on the server so the screen stays statically
 * renderable; a client `useSearchParams` would force the whole page to
 * client-render and throw away the shareable URL's first paint.
 */
export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>
}) {
  const params = await searchParams
  const raw = params.t
  const initialTrackingNumber = (Array.isArray(raw) ? raw[0] : raw) ?? ""

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12">
        <PageHeader
          className="mb-8"
          eyebrow="Public tracking"
          title="Track a parcel"
          description="Anyone with the tracking number can follow a parcel — you do not need an account."
        />

        <TrackLookup initialTrackingNumber={initialTrackingNumber} />
      </main>

      <SiteFooter />
    </div>
  )
}
