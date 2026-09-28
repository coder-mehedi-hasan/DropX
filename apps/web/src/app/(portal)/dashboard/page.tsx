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
        <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
          Customer portal
        </p>
        <h1 className="text-3xl font-bold tracking-tight">My parcels</h1>
        <p className="text-muted-foreground text-sm">
          Parcels you have sent. Booked parcels appear here the moment they are created.
        </p>
      </div>

      <ParcelList />
    </div>
  )
}
