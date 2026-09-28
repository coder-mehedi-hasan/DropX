import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ArrowRight, Search, Truck } from "lucide-react"
import { useEffect } from "react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Separator,
  Skeleton,
  StatusBadge,
} from "@dropx/ui"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"

import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { trackParcel } from "@/lib/endpoints"
import { formatDateTime, formatMoney, formatNumber } from "@/lib/format"
import type { ParcelTracking } from "@/lib/types"

import { EventTimeline } from "./event-timeline"

/** Mirrors `trackingNumberSchema` in `apps/api` so a typo never costs a request. */
const trackingSchema = z.object({
  trackingNumber: z
    .string()
    .trim()
    .toUpperCase()
    .min(6, "Enter a valid tracking number")
    .max(50)
    .regex(/^[A-Z0-9-]+$/, "Enter a valid tracking number"),
})

type TrackingValues = z.infer<typeof trackingSchema>

export function TrackingPage({ tracking }: { tracking?: string | undefined }) {
  const navigate = useNavigate()

  const query = useQuery({
    queryKey: ["tracking", tracking],
    queryFn: ({ signal }) => trackParcel(tracking ?? "", signal),
    enabled: Boolean(tracking),
  })

  const form = useForm<TrackingValues>({
    resolver: zodResolver(trackingSchema),
    defaultValues: { trackingNumber: tracking ?? "" },
  })

  // The URL is the source of truth, so a lookup started elsewhere — the parcel
  // list's "Track" action, or browser history — has to fill the field in.
  useEffect(() => {
    form.reset({ trackingNumber: tracking ?? "" })
  }, [tracking, form])

  function onSubmit(values: TrackingValues) {
    void navigate({ to: "/tracking", search: { tracking: values.trackingNumber } })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tracking"
        description="Public tracking lookup. Works for any tracking number in the network, including ones booked by another branch."
      />

      <Card className="gap-4 py-4">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-3 px-6 sm:flex-row sm:items-end"
          >
            <FormField
              control={form.control}
              name="trackingNumber"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Tracking number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="DPX260101123456"
                      className="font-mono"
                      autoComplete="off"
                      spellCheck={false}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="sm:mb-0">
              <Search />
              Look up
            </Button>
          </form>
        </Form>
      </Card>

      {!tracking ? (
        <EmptyState
          icon={Truck}
          title="Look up a parcel"
          description="Enter a tracking number above to see its current status and full event history. Paste one from the parcels list to jump straight here."
        />
      ) : query.isPending ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : query.isError ? (
        <ServerError
          error={query.error}
          title="Tracking lookup failed"
          onDismiss={() => void query.refetch()}
        />
      ) : (
        <TrackingResult tracking={query.data} />
      )}
    </div>
  )
}

function TrackingResult({ tracking }: { tracking: ParcelTracking }) {
  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="gap-4 py-4 lg:col-span-2">
        <CardHeader className="px-4">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="font-mono text-base">{tracking.trackingNumber}</CardTitle>
            <StatusBadge status={tracking.status} />
          </div>
          <CardDescription>
            Last updated {formatDateTime(tracking.events[0]?.createdAt ?? new Date())}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs uppercase">From</dt>
              <dd className="font-medium">{tracking.originHub.name}</dd>
              <dd className="text-muted-foreground text-xs">{tracking.originHub.code}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase">To</dt>
              <dd className="font-medium">{tracking.destinationHub.name}</dd>
              <dd className="text-muted-foreground text-xs">{tracking.destinationHub.code}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Current hub</dt>
              <dd className="font-medium">{tracking.currentHub?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Delivered</dt>
              <dd className="font-medium">
                {tracking.deliveredAt ? formatDateTime(tracking.deliveredAt) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Type</dt>
              <dd>
                <Badge variant="secondary">{tracking.parcelType}</Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Payment</dt>
              <dd>
                <Badge variant={tracking.paymentType === "COD" ? "warning" : "outline"}>
                  {tracking.paymentType === "COD" ? "Cash on delivery" : "Prepaid"}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Weight</dt>
              <dd className="font-medium">{formatNumber(tracking.weight)} kg</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase">Amount to collect</dt>
              <dd className="font-medium">
                {tracking.codAmount > 0 ? formatMoney(tracking.codAmount) : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="gap-4 py-4 lg:col-span-3">
        <CardHeader className="px-4">
          <CardTitle className="flex items-center gap-2">
            Event history
            <ArrowRight className="text-muted-foreground size-4" />
            newest first
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="px-4">
          <EventTimeline events={tracking.events} />
        </CardContent>
      </Card>
    </div>
  )
}
