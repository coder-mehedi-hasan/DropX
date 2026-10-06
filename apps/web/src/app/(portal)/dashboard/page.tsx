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
    <div className="grid gap-8">
      <PageHeader
        eyebrow="Customer portal"
        title="My parcels"
        description="Everything you have sent, with its latest status. Private to your account."
        actions={
          <>
            <Button asChild variant="outline" size="lg">
              <Link href="/track">
                <SearchIcon aria-hidden />
                Track a parcel
              </Link>
            </Button>
            <Button asChild size="lg">
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
