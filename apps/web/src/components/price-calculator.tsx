"use client"

import * as React from "react"
import { ArrowRightIcon, ReceiptIcon } from "lucide-react"
import Link from "next/link"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Skeleton,
} from "@dropx/ui"

import { ReferenceSelect } from "@/components/reference-select"
import { formatMoney } from "@/lib/format"
import { deliveryTypeLabel, pickupTypeLabel } from "@/lib/pricing-labels"
import { useCities, useCityZones, useFeeQuote } from "@/lib/queries"
import type { QuoteRequest } from "@/lib/types"

/**
 * A quote machine with no booking attached: both ends of the route, a weight
 * and an optional cash amount in, the server's fee breakdown out.
 *
 * It never computes a price itself — `quoteRequest` is built exactly the way
 * the booking form builds it, and `useFeeQuote` calls the same
 * `GET /pricing/quote` the booking sidebar does, so an estimate here and the
 * fee at checkout come from one code path.
 */
export function PriceCalculator() {
  const [pickupCityId, setPickupCityId] = React.useState("")
  const [pickupZoneId, setPickupZoneId] = React.useState("")
  const [deliveryCityId, setDeliveryCityId] = React.useState("")
  const [deliveryZoneId, setDeliveryZoneId] = React.useState("")
  const [weight, setWeight] = React.useState("")
  const [codAmount, setCodAmount] = React.useState("")

  const cities = useCities()
  const pickupZones = useCityZones(pickupCityId)
  const deliveryZones = useCityZones(deliveryCityId)

  const quoteRequest = React.useMemo<QuoteRequest | null>(() => {
    if (!pickupCityId || !pickupZoneId || !deliveryCityId || !deliveryZoneId) return null
    const weightKg = Number(weight)
    if (!Number.isFinite(weightKg) || weightKg <= 0) return null

    const collected = Number(codAmount)
    return {
      pickupCityId,
      pickupZoneId,
      deliveryCityId,
      deliveryZoneId,
      weightGrams: Math.round(weightKg * 1000),
      codAmount: Number.isFinite(collected) && collected > 0 ? collected : 0,
    }
  }, [pickupCityId, pickupZoneId, deliveryCityId, deliveryZoneId, weight, codAmount])

  const quote = useFeeQuote(quoteRequest)

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,1fr)] 2xl:items-start">
      <Card className="overflow-hidden py-0 shadow-[0_1px_2px_rgba(13,15,18,.04),0_18px_48px_-30px_rgba(13,15,18,.3)] ring-1 ring-black/5">
        <CardHeader className="border-b border-black/6 bg-[#FCFCFD] px-5 py-5 sm:px-7">
          <CardTitle className="text-lg font-bold tracking-[-0.02em]">Route and parcel</CardTitle>
          <CardDescription>
            Both ends of the route, the weight band it lands in, and anything you are collecting.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid gap-7 px-5 py-6 sm:px-7">
          <fieldset className="grid gap-4 rounded-2xl bg-[#F6F8FB] p-4 sm:p-5">
            <legend className="px-1 text-sm font-semibold">Pickup</legend>
            <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
              <div className="grid gap-2">
                <Label>City</Label>
                <ReferenceSelect
                  value={pickupCityId}
                  onValueChange={(value) => {
                    setPickupCityId(value)
                    setPickupZoneId("")
                  }}
                  options={cities.data ?? []}
                  placeholder="Pick the pickup city"
                />
              </div>
              <div className="grid gap-2">
                <Label>Zone</Label>
                <ReferenceSelect
                  value={pickupZoneId}
                  onValueChange={setPickupZoneId}
                  options={pickupZones.data ?? []}
                  loading={pickupCityId.length > 0 && pickupZones.isLoading}
                  placeholder="Pick the pickup zone"
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="grid gap-4 rounded-2xl bg-[#F6F8FB] p-4 sm:p-5">
            <legend className="px-1 text-sm font-semibold">Delivery</legend>
            <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
              <div className="grid gap-2">
                <Label>City</Label>
                <ReferenceSelect
                  value={deliveryCityId}
                  onValueChange={(value) => {
                    setDeliveryCityId(value)
                    setDeliveryZoneId("")
                  }}
                  options={cities.data ?? []}
                  placeholder="Pick the delivery city"
                />
              </div>
              <div className="grid gap-2">
                <Label>Zone</Label>
                <ReferenceSelect
                  value={deliveryZoneId}
                  onValueChange={setDeliveryZoneId}
                  options={deliveryZones.data ?? []}
                  loading={deliveryCityId.length > 0 && deliveryZones.isLoading}
                  placeholder="Pick the delivery zone"
                />
              </div>
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="calc-weight">Weight (kg)</Label>
              <Input
                id="calc-weight"
                type="number"
                inputMode="decimal"
                min="0.001"
                step="0.1"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                placeholder="e.g. 1.5"
                className="bg-white"
              />
              <p className="text-muted-foreground text-xs">
                The fee follows the weight band this lands in.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="calc-cod">Cash to collect (optional)</Label>
              <Input
                id="calc-cod"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={codAmount}
                onChange={(event) => setCodAmount(event.target.value)}
                placeholder="0 — leave empty for prepaid"
                className="bg-white"
              />
              <p className="text-muted-foreground text-xs">
                Cash-on-delivery adds a percentage plus a handling fee.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden border-0 bg-[#0D0F12] py-0 text-white shadow-[0_24px_60px_-30px_rgba(13,15,18,.9)] 2xl:sticky 2xl:top-6">
        <div className="pointer-events-none absolute -top-20 -right-16 size-52 rounded-full bg-[#FF5500]/20 blur-3xl" />
        <CardHeader className="relative gap-1 px-5 pt-6 pb-4 sm:px-7">
          <span className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[#FF5500] text-white shadow-[0_10px_24px_-12px_rgba(255,85,0,.9)]">
            <ReceiptIcon className="size-5" aria-hidden />
          </span>
          <CardTitle className="text-xl font-bold tracking-[-0.02em]">Your estimate</CardTitle>
          <CardDescription className="text-[#C8CBD1]">
            Computed by the same pricing service booking uses.
          </CardDescription>
        </CardHeader>

        <CardContent className="relative grid gap-4 px-5 pb-6 sm:px-7">
          {!quoteRequest ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-medium text-white">Waiting for the route and weight</p>
              <ul className="mt-2 grid gap-1.5 text-xs text-[#C8CBD1]">
                <li>· Pick a city and zone at both ends</li>
                <li>· Enter a weight above zero</li>
              </ul>
            </div>
          ) : quote.isPending ? (
            <div className="grid gap-3">
              <Skeleton className="h-5 w-full bg-white/10" />
              <Skeleton className="h-5 w-4/5 bg-white/10" />
              <Skeleton className="h-5 w-3/5 bg-white/10" />
            </div>
          ) : quote.isError ? (
            <Alert variant="destructive">
              <AlertTitle>Could not reach pricing</AlertTitle>
              <AlertDescription className="flex items-center gap-3">
                <span>We could not reach the pricing service.</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void quote.refetch()}
                >
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : quote.data ? (
            <>
              <dl className="grid gap-2.5 text-sm">
                <QuoteRow
                  label="Base fee"
                  value={formatMoney(quote.data.baseFee, quote.data.currency)}
                />
                <QuoteRow
                  label="Extra weight"
                  value={
                    quote.data.extraWeightFee > 0
                      ? formatMoney(quote.data.extraWeightFee, quote.data.currency)
                      : "—"
                  }
                />
                <QuoteRow
                  label="Cash on delivery"
                  value={
                    quote.data.codFee > 0
                      ? formatMoney(quote.data.codFee, quote.data.currency)
                      : "—"
                  }
                />
              </dl>

              <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3.5">
                <span className="text-sm font-medium text-[#C8CBD1]">Estimated total</span>
                <span className="text-2xl font-extrabold tracking-[-0.03em] tabular-nums">
                  {formatMoney(quote.data.total, quote.data.currency)}
                </span>
              </div>

              <p className="text-xs text-[#8B909A]">
                {pickupTypeLabel(quote.data.lane.pickupType)} →{" "}
                {deliveryTypeLabel(quote.data.lane.deliveryType)}
                {quote.data.lane.sameCity ? " · same city" : ""} · band up to{" "}
                {quote.data.slab.maxWeightGrams.toLocaleString("en-US")} g. Recomputed when you
                book.
              </p>

              <Button
                asChild
                size="lg"
                className="mt-1 shadow-[0_12px_24px_-12px_rgba(255,85,0,.75)]"
              >
                <Link href="/book">
                  Book this delivery
                  <ArrowRightIcon aria-hidden />
                </Link>
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function QuoteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-[#C8CBD1]">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  )
}
