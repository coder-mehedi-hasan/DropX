import type { Metadata } from "next"

import { ParcelList } from "@/components/parcel-list"

export const metadata: Metadata = {
  title: "My parcels",
  description: "Every parcel you have sent, with its current status, fee and tracking number.",
}

export default function DashboardPage() {
  return (
    <div className="grid gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">My parcels</h1>
        <p className="text-muted-foreground text-sm">
          Parcels you have sent. Booked parcels appear here the moment they are created.
        </p>
      </div>

      <ParcelList />
    </div>
  )
}
