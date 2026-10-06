"use client"

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Card,
  CardContent,
  Input,
  LoadingButton,
  Separator,
  Skeleton,
  StatusBadge,
} from "@dropx/ui"
import { SearchIcon, TriangleAlertIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

import { EventTimeline } from "@/components/event-timeline"
import { isApiError } from "@/lib/api-client"
import { formatDateTime, formatMoney, formatWeight } from "@/lib/format"
import { useTracking } from "@/lib/queries"
import type { HubRef } from "@/lib/types"

/**
 * Public tracking.
 *
 * `GET /tracking/:trackingNumber` is the one read the API serves without a
 * token, so this screen works for anyone holding a tracking number — which is
 * why a submission is written back to the URL: a delivered parcel's status is
 * what people screenshot and share.
 */
export function TrackLookup({
  initialTrackingNumber = "",
  embedded = false,
}: {
  initialTrackingNumber?: string
  /** Render the search field without its own card, for placement inside one. */
  embedded?: boolean
}) {
  const router = useRouter()
  const [input, setInput] = React.useState(initialTrackingNumber)
  const [submitted, setSubmitted] = React.useState(initialTrackingNumber)

  const tracking = useTracking(submitted)
  const result = tracking.data
  const message = isApiError(tracking.error) ? tracking.error.message : null

  React.useEffect(() => {
    setInput(initialTrackingNumber)
    setSubmitted(initialTrackingNumber)
  }, [initialTrackingNumber])

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trackingNumber = input.trim().toUpperCase()
    setSubmitted(trackingNumber)
    router.replace(trackingNumber ? `/track?t=${encodeURIComponent(trackingNumber)}` : "/track", {
      scroll: false,
    })
  }

  const searchForm = (
    <form onSubmit={onSubmit} className="grid gap-3" noValidate>
      <label htmlFor="tracking-number" className="text-sm font-semibold">
        Tracking number
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="tracking-number"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="DPX260101123456"
          autoComplete="off"
          spellCheck={false}
          className="h-11 font-mono font-semibold tracking-wide uppercase"
          aria-describedby="tracking-number-hint"
        />
        <LoadingButton
          type="submit"
          size="lg"
          loading={tracking.isFetching}
          disabled={input.trim() === ""}
        >
          <SearchIcon aria-hidden />
          Track
        </LoadingButton>
      </div>
      <p id="tracking-number-hint" className="text-muted-foreground text-xs">
        Printed on your booking confirmation. No account needed.
      </p>
    </form>
  )

  return (
    <div className="grid gap-6">
      {embedded ? (
        searchForm
      ) : (
        <Card className="gap-0 py-0 shadow-sm">
          <CardContent>{searchForm}</CardContent>
        </Card>
      )}

      {message ? (
        <Alert variant="destructive">
          <TriangleAlertIcon aria-hidden />
          <AlertTitle>We could not show that parcel</AlertTitle>
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      ) : null}

      {tracking.isFetching && !result ? <TrackingSkeleton /> : null}

      {result ? (
        <Card>
          <CardContent className="grid gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid gap-1">
                <p className="text-muted-foreground text-xs">Tracking number</p>
                <p className="text-foreground font-mono text-xl font-extrabold tracking-tight">
                  {result.trackingNumber}
                </p>
              </div>
              <StatusBadge status={result.status} />
            </div>

            <Separator />

            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Fact label="From" value={hubLabel(result.originHub)} />
              <Fact label="To" value={hubLabel(result.destinationHub)} />
              <Fact
                label="Currently at"
                value={result.currentHub ? hubLabel(result.currentHub) : "—"}
              />
              <Fact
                label="Delivered"
                value={result.deliveredAt ? formatDateTime(result.deliveredAt) : "Not yet"}
              />
              <Fact label="Weight" value={formatWeight(result.weight)} />
              <Fact label="Parcel type" value={result.parcelType} />
              <Fact label="Payment" value={paymentLabel(result.paymentType, result.codAmount)} />
              <Fact label="Status" value={<StatusBadge status={result.status} />} bare />
            </dl>

            {result.paymentType === "COD" ? (
              <p className="text-muted-foreground text-xs">
                Keep {formatMoney(result.codAmount)} ready — the receiver pays the rider on
                delivery.
              </p>
            ) : null}

            <Separator />

            <div>
              <p className="text-accent-ink mb-1 text-xs font-semibold tracking-[0.16em] uppercase">
                Every handover
              </p>
              <h2 className="mb-4 text-base font-bold">Tracking history</h2>
              <EventTimeline events={result.events} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!embedded && !result && !tracking.isFetching && !message && submitted === "" ? (
        <p className="text-muted-foreground text-sm">
          Enter a tracking number above to see where a parcel is.
        </p>
      ) : null}
    </div>
  )
}

function hubLabel(hub: HubRef): string {
  return hub.district ? `${hub.name} (${hub.district})` : hub.name
}

function paymentLabel(paymentType: string, codAmount: number): string {
  return paymentType === "COD" ? `Cash on delivery · ${formatMoney(codAmount)}` : "Prepaid"
}

function Fact({
  label,
  value,
  bare = false,
}: {
  label: string
  value: React.ReactNode
  bare?: boolean
}) {
  return (
    <div className="grid gap-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className={bare ? undefined : "text-sm font-medium"}>{value}</dd>
    </div>
  )
}

function TrackingSkeleton() {
  return (
    <Card aria-busy="true" aria-live="polite">
      <CardContent className="grid gap-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-px w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
