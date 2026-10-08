"use client"

import {
  ArrowRightIcon,
  CalculatorIcon,
  CircleDollarSignIcon,
  PackageCheckIcon,
  ReceiptIcon,
  RouteIcon,
  ScaleIcon,
} from "lucide-react"
import Link from "next/link"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dropx/ui"

import { formatMoney } from "@/lib/format"
import { deliveryTypeLabel, formatGrams, pickupTypeLabel } from "@/lib/pricing-labels"
import { usePricingPlans } from "@/lib/queries"

/**
 * The published price list: one card per lane, one row per weight band — the
 * same matrix the server quotes and charges from, so this page cannot drift
 * from what booking actually costs.
 */
export function PricingPlans() {
  const plans = usePricingPlans()

  if (plans.isLoading) {
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index} className="py-0">
            <CardHeader className="gap-2">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent className="grid gap-3 pb-6">
              {Array.from({ length: 4 }, (_, row) => (
                <Skeleton key={row} className="h-9 w-full" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (plans.isError) {
    return (
      <Alert variant="destructive">
        <ReceiptIcon aria-hidden />
        <AlertTitle>We could not load the price list</AlertTitle>
        <AlertDescription className="flex items-center gap-3">
          <span>The pricing service did not answer.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void plans.refetch()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const lanes = plans.data ?? []
  const activeLanes = lanes.filter((lane) => lane.status === "ACTIVE")

  if (activeLanes.length === 0) {
    return (
      <EmptyState
        icon={ReceiptIcon}
        title="No prices published yet"
        description="The price list is empty right now — check back soon."
        className="rounded-2xl bg-white py-14 ring-1 ring-black/5"
      />
    )
  }

  return (
    <div className="grid gap-7">
      <div className="grid gap-3 rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgba(13,15,18,.04)] ring-1 ring-black/5 sm:grid-cols-3 sm:p-5">
        <PricingFact
          icon={ScaleIcon}
          title="Find your weight band"
          description="The base fee covers parcels within that range."
        />
        <PricingFact
          icon={PackageCheckIcon}
          title="Extra weight is clear"
          description="An extra-kilogram charge applies only above the top band."
        />
        <PricingFact
          icon={CircleDollarSignIcon}
          title="COD shown separately"
          description="Collection charges apply only when the receiver pays."
        />
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-[-0.02em]">Delivery routes</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Compare the available routes and weight bands.
          </p>
        </div>
        <p className="text-muted-foreground hidden text-sm sm:block">
          {activeLanes.length} active {activeLanes.length === 1 ? "route" : "routes"}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {activeLanes.map((lane) => {
          const slabs = lane.slabs.filter((slab) => slab.status === "ACTIVE")
          const topSlab = slabs.length > 0 ? slabs[slabs.length - 1] : null

          return (
            <Card
              key={lane.id}
              className="group overflow-hidden border-0 py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.24)] ring-1 ring-black/5 transition-shadow hover:shadow-[0_1px_2px_rgba(13,15,18,.04),0_22px_52px_-28px_rgba(13,15,18,.32)]"
            >
              <CardHeader className="border-b border-black/6 bg-[#FCFCFD] px-5 py-5 sm:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="bg-primary/10 text-accent-ink flex size-10 shrink-0 items-center justify-center rounded-xl">
                      <RouteIcon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        <span>{pickupTypeLabel(lane.pickupType)}</span>
                        <ArrowRightIcon className="text-primary size-4 shrink-0" aria-hidden />
                        <span>{deliveryTypeLabel(lane.deliveryType)}</span>
                      </CardTitle>
                      <CardDescription className="mt-1">Rates by parcel weight</CardDescription>
                    </div>
                  </div>
                  {lane.sameCity ? (
                    <Badge variant="outline" className="shrink-0 bg-white">
                      Same city
                    </Badge>
                  ) : null}
                </div>
              </CardHeader>

              <CardContent className="px-5 py-5 sm:px-6">
                {slabs.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No bands published for this route yet.
                  </p>
                ) : (
                  <Table className="min-w-[32rem] xl:min-w-0">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[0.68rem] tracking-[0.08em] uppercase">
                          Weight
                        </TableHead>
                        <TableHead className="text-right text-[0.68rem] tracking-[0.08em] uppercase">
                          Delivery fee
                        </TableHead>
                        <TableHead className="text-right">Extra / kg</TableHead>
                        <TableHead className="text-right">COD fee</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slabs.map((slab) => (
                        <TableRow key={slab.id}>
                          <TableCell className="text-sm font-medium whitespace-nowrap">
                            {formatGrams(slab.minWeightGrams)} – {formatGrams(slab.maxWeightGrams)}
                          </TableCell>
                          <TableCell className="text-right font-bold tabular-nums">
                            {formatMoney(slab.baseFee, "BDT")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {slab.extraKgFee > 0 ? formatMoney(slab.extraKgFee, "BDT") : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-right text-xs tabular-nums">
                            {slab.codPercentage}% + {formatMoney(slab.codFixedFee, "BDT")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {topSlab && topSlab.extraKgFee > 0 ? (
                  <div className="bg-primary/5 mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs">
                    <ScaleIcon className="text-accent-ink mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <p className="text-muted-foreground leading-5">
                      Above{" "}
                      <strong className="text-foreground">
                        {formatGrams(topSlab.maxWeightGrams)}
                      </strong>
                      ,{" "}
                      <strong className="text-foreground">
                        {formatMoney(topSlab.extraKgFee, "BDT")}
                      </strong>{" "}
                      is added per extra kilogram.
                    </p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="bg-[#0D0F12] py-0 text-white shadow-[0_24px_60px_-30px_rgba(13,15,18,.9)]">
        <CardHeader className="gap-2 px-5 py-6 sm:px-7">
          <p className="text-accent-ink text-xs font-semibold tracking-[0.14em] uppercase">
            Good to know
          </p>
          <CardTitle className="text-xl font-bold tracking-[-0.02em]">
            The quote you see is the price you pay.
          </CardTitle>
          <CardDescription className="max-w-prose text-[#C8CBD1]">
            Fees are computed server-side from this same matrix when you quote, and recomputed when
            the parcel is created — the price cannot drift between the two.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 px-5 pb-6 sm:px-7">
          <Button asChild size="lg" className="shadow-[0_12px_24px_-12px_rgba(255,85,0,.75)]">
            <Link href="/calculator">
              <CalculatorIcon aria-hidden />
              Estimate a price
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="border-white/15 bg-white/10 text-white hover:bg-white/15"
          >
            <Link href="/book">
              Book a parcel
              <ArrowRightIcon aria-hidden />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function PricingFact({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof ScaleIcon
  title: string
  description: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl px-2 py-2 sm:px-3">
      <span className="bg-primary/10 text-accent-ink flex size-9 shrink-0 items-center justify-center rounded-lg">
        <Icon className="size-4" aria-hidden />
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground mt-1 text-xs leading-5">{description}</p>
      </div>
    </div>
  )
}
