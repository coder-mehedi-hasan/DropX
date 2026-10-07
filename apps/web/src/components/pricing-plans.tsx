"use client"

import { ArrowRightIcon, CalculatorIcon, ReceiptIcon } from "lucide-react"
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
      <div className="grid gap-5 lg:grid-cols-2">
        {activeLanes.map((lane) => {
          const slabs = lane.slabs.filter((slab) => slab.status === "ACTIVE")
          const topSlab = slabs.length > 0 ? slabs[slabs.length - 1] : null

          return (
            <Card
              key={lane.id}
              className="overflow-hidden py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.3)] ring-1 ring-black/5"
            >
              <CardHeader className="border-b border-black/6 bg-[#FCFCFD] px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{lane.pickupType}</Badge>
                  <ArrowRightIcon className="text-muted-foreground size-3.5" aria-hidden />
                  <Badge variant="secondary">{lane.deliveryType}</Badge>
                  {lane.sameCity ? <Badge variant="outline">Same city only</Badge> : null}
                </div>
                <CardDescription>
                  {pickupTypeLabel(lane.pickupType)} → {deliveryTypeLabel(lane.deliveryType)}
                </CardDescription>
              </CardHeader>

              <CardContent className="px-5 py-5 sm:px-6">
                {slabs.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No bands published for this route yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Weight band</TableHead>
                        <TableHead className="text-right">Base fee</TableHead>
                        <TableHead className="text-right">Extra / kg</TableHead>
                        <TableHead className="text-right">Cash on delivery</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slabs.map((slab) => (
                        <TableRow key={slab.id}>
                          <TableCell className="font-mono text-xs whitespace-nowrap">
                            {formatGrams(slab.minWeightGrams)} – {formatGrams(slab.maxWeightGrams)}
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatMoney(slab.baseFee, "BDT")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {slab.extraKgFee > 0 ? formatMoney(slab.extraKgFee, "BDT") : "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
                            {slab.codPercentage}% + {formatMoney(slab.codFixedFee, "BDT")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {topSlab && topSlab.extraKgFee > 0 ? (
                  <p className="text-muted-foreground mt-3 text-xs">
                    Above {formatGrams(topSlab.maxWeightGrams)},{" "}
                    {formatMoney(topSlab.extraKgFee, "BDT")} is added per extra kilogram.
                  </p>
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
