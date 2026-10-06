import type { Metadata } from "next"
import { ArrowRightIcon, SearchIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@dropx/ui"

import { PageHeader } from "@/components/page-header"
import { ParcelList } from "@/components/parcel-list"

export const metadata: Metadata = {
  title: "My parcels",
  description: "Every parcel you have sent, with its current status, fee and tracking number.",
}

export default function DashboardPage() {
  return (
    <div className="grid gap-7">
      <PageHeader
        eyebrow="Delivery overview"
        title="Your parcels, moving clearly."
        description="Book a delivery, check what is in motion, and open any shipment for its full journey."
        actions={
          <>
            <Button asChild variant="outline" size="lg" className="bg-white shadow-sm">
              <Link href="/track">
                <SearchIcon aria-hidden />
                Quick track
              </Link>
            </Button>
            <Button asChild size="lg" className="shadow-[0_12px_24px_-12px_rgba(255,85,0,.75)]">
              <Link href="/book">
                Book a parcel
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          </>
        }
      />

      <ParcelList />
    </div>
  )
}
