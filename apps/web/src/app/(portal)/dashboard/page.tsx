import type { Metadata } from "next"
import { ArrowRightIcon, SearchIcon, ShieldCheckIcon } from "lucide-react"
import Link from "next/link"

import { Button, Card, CardContent } from "@dropx/ui"

import { ParcelList } from "@/components/parcel-list"

export const metadata: Metadata = {
  title: "My parcels",
  description: "Every parcel you have sent, with its current status, fee and tracking number.",
}

export default function DashboardPage() {
  return (
    <div className="grid gap-8">
      <section className="bg-primary/8 relative overflow-hidden rounded-3xl px-6 py-8 sm:px-8 sm:py-10">
        <div className="bg-primary/15 pointer-events-none absolute -top-20 -right-20 size-56 rounded-full blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div className="grid max-w-2xl gap-3">
            <p className="text-accent-ink text-xs font-semibold tracking-[0.16em] uppercase">
              Customer portal
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Send something somewhere.
            </h1>
            <p className="text-muted-foreground max-w-xl text-sm leading-6 sm:text-base">
              Book a pickup, see the fee before you commit, and follow every handover from hub to
              doorstep.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/book">
                Book a parcel
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-background/70">
              <Link href="/track">
                <SearchIcon aria-hidden />
                Track a parcel
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="grid gap-1">
        <h2 className="text-2xl font-bold tracking-tight">Your parcels</h2>
        <p className="text-muted-foreground text-sm">
          Everything you have sent, with its latest status and tracking number.
        </p>
      </div>

      <Card className="bg-card/60 border-0 shadow-sm">
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="bg-primary/10 text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
              <ShieldCheckIcon className="size-4" aria-hidden />
            </span>
            <p className="text-muted-foreground text-sm leading-5">
              Your parcel history is private to your account. Public tracking only needs a tracking
              number.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="shrink-0 self-start sm:self-auto">
            <Link href="/track">Public tracking</Link>
          </Button>
        </CardContent>
      </Card>

      <ParcelList />
    </div>
  )
}
