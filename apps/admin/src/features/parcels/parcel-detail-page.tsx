import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Ban, History, Package, RefreshCw, Truck } from "lucide-react"
import { useState } from "react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  parcelStatusLabel,
} from "@dropx/ui"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { DetailRow, PageHeader, PanelTitle } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { cancelParcel, getParcel, trackParcel, updateParcelStatus } from "@/lib/endpoints"
import { formatDateTime, formatDimensions, formatMoney, formatNumber } from "@/lib/format"
import { DEFAULT_PARCELS_SEARCH, nextStatuses } from "@/lib/parcels"
import type { ParcelDetail, ParcelStatus } from "@/lib/parcels"
import { EventTimeline } from "@/features/tracking/event-timeline"

const statusChangeSchema = z.object({
  status: z.string().trim().min(1, "Pick the new status"),
  reason: z.string().trim().max(500, "Keep the reason under 500 characters").optional(),
  hubId: z.string().trim().optional(),
})

const cancelSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, "Tell us why the parcel is being cancelled")
    .max(500, "Keep the reason under 500 characters"),
})

type StatusChangeValues = z.infer<typeof statusChangeSchema>

export function ParcelDetailPage({ parcelId }: { parcelId: string }) {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const [statusOpen, setStatusOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const parcel = useQuery({
    queryKey: ["parcels", "detail", parcelId],
    queryFn: ({ signal }) => getParcel(parcelId, signal),
  })

  const events = useQuery({
    queryKey: ["tracking", parcel.data?.trackingNumber],
    queryFn: ({ signal }) => trackParcel(parcel.data?.trackingNumber ?? "", signal),
    enabled: Boolean(parcel.data?.trackingNumber),
  })

  if (parcel.isPending) return <ParcelDetailSkeleton />

  if (parcel.isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ServerError
          error={parcel.error}
          title="Unable to load this parcel"
          onDismiss={() => void parcel.refetch()}
        />
      </div>
    )
  }

  const data = parcel.data
  const allowed = nextStatuses(data.status)
  const terminal = allowed.length === 0

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <PageHeader
        title={data.trackingNumber}
        description={`Booked ${formatDateTime(data.createdAt)} · last updated ${formatDateTime(data.updatedAt)}`}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                void navigate({ to: "/tracking", search: { tracking: data.trackingNumber } })
              }
            >
              <Truck />
              Track
            </Button>
            {hasPermission("parcels.update") && !terminal ? (
              <Button onClick={() => setStatusOpen(true)}>
                <RefreshCw />
                Update status
              </Button>
            ) : null}
            {hasPermission("parcels.cancel") && !terminal ? (
              <Button variant="destructive" onClick={() => setCancelOpen(true)}>
                <Ban />
                Cancel parcel
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={data.status} />
        <Badge variant="secondary">{data.parcelType}</Badge>
        <Badge variant={data.paymentType === "COD" ? "warning" : "outline"}>
          {data.paymentType === "COD" ? "Cash on delivery" : "Prepaid"}
        </Badge>
        {data.codAmount > 0 ? (
          <Badge variant="warning">Collect {formatMoney(data.codAmount)}</Badge>
        ) : null}
        {terminal ? (
          <span className="text-muted-foreground text-sm">
            This parcel is in a terminal state, so it can no longer be changed.
          </span>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="gap-4 py-4 lg:col-span-2">
          <CardHeader className="px-4">
            <PanelTitle icon={Package}>Parcel</PanelTitle>
          </CardHeader>
          <CardContent className="px-4">
            <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <DetailRow label="Sender customer">#{data.senderCustomerId}</DetailRow>
              <DetailRow label="Receiver customer">#{data.receiverCustomerId}</DetailRow>
              <DetailRow label="Origin hub">#{data.originHubId}</DetailRow>
              <DetailRow label="Destination hub">#{data.destinationHubId}</DetailRow>
              <DetailRow label="Current hub">
                {data.currentHubId ? `#${data.currentHubId}` : "—"}
              </DetailRow>
              <DetailRow label="Destination zone">#{data.destinationZoneId}</DetailRow>
              <DetailRow label="Weight">{formatNumber(data.weight)} kg</DetailRow>
              <DetailRow label="Dimensions">
                {formatDimensions(data.length, data.width, data.height)}
              </DetailRow>
              <DetailRow label="Delivery fee">{formatMoney(data.deliveryFee)}</DetailRow>
            </dl>
          </CardContent>
        </Card>

        <Card className="gap-4 py-4">
          <CardHeader className="px-4">
            <PanelTitle icon={History}>Next statuses</PanelTitle>
          </CardHeader>
          <Separator />
          <CardContent className="px-4">
            {terminal ? (
              <p className="text-muted-foreground text-sm">
                Nothing further is possible from {parcelStatusLabel(data.status)}.
              </p>
            ) : (
              <>
                <p className="text-muted-foreground mb-2 text-sm">
                  The API accepts these moves from the current status:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {allowed.map((status) => (
                    <Badge key={status} variant="outline">
                      {parcelStatusLabel(status)}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="gap-4 py-4">
        <CardHeader className="px-4">
          <CardTitle>Contents &amp; history</CardTitle>
        </CardHeader>
        <CardContent className="px-4">
          <Tabs defaultValue="items">
            <TabsList>
              <TabsTrigger value="items">Items ({data.items.length})</TabsTrigger>
              <TabsTrigger value="timeline">
                Timeline ({events.data?.events.length ?? 0})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="items">
              {data.items.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="No line items declared"
                  description="This parcel was booked without declared contents, which is normal for documents and unlisted goods."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-muted-foreground max-w-80 truncate">
                          {item.description ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(item.quantity)}</TableCell>
                        <TableCell className="text-right">{formatMoney(item.unitPrice)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatMoney(item.totalPrice)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="timeline">
              {events.isError ? (
                <ServerError
                  error={events.error}
                  title="Unable to load the tracking timeline"
                  onDismiss={() => void events.refetch()}
                />
              ) : events.isPending ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }, (_, index) => (
                    <Skeleton key={index} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <EventTimeline events={events.data.events} />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <StatusChangeDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        parcel={data}
        allowed={allowed}
        onDone={() => {
          void parcel.refetch()
          void events.refetch()
        }}
      />
      <CancelParcelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        parcelId={data.id}
        onDone={() => {
          void parcel.refetch()
          void events.refetch()
        }}
      />
    </div>
  )
}

function BackLink() {
  const navigate = useNavigate()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 w-fit"
      onClick={() => void navigate({ to: "/parcels", search: DEFAULT_PARCELS_SEARCH })}
    >
      <ArrowLeft />
      All parcels
    </Button>
  )
}

function StatusChangeDialog({
  open,
  onOpenChange,
  parcel,
  allowed,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcel: ParcelDetail
  allowed: readonly ParcelStatus[]
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<unknown>(null)

  const form = useForm<StatusChangeValues>({
    resolver: zodResolver(statusChangeSchema),
    defaultValues: { status: "", reason: "", hubId: "" },
  })

  const mutation = useMutation({
    mutationFn: (values: StatusChangeValues) =>
      updateParcelStatus(parcel.id, {
        status: values.status as ParcelStatus,
        reason: values.reason?.trim() ? values.reason.trim() : undefined,
        hubId: values.hubId?.trim() ? values.hubId.trim() : undefined,
      }),
    onSuccess: (updated) => {
      toast.success(`Parcel is now ${parcelStatusLabel(updated.status).toLowerCase()}`)
      void queryClient.invalidateQueries({ queryKey: ["parcels"] })
      onDone()
      onOpenChange(false)
    },
    onError: setServerError,
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return
        if (next) {
          form.reset({ status: allowed[0] ?? "", reason: "", hubId: "" })
          setServerError(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update status</DialogTitle>
          <DialogDescription>
            {parcel.trackingNumber} is currently {parcelStatusLabel(parcel.status).toLowerCase()}.
            The API rejects moves the lifecycle does not allow, and records the change as a tracking
            event.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-4"
            noValidate
            onSubmit={form.handleSubmit((values) => {
              setServerError(null)
              mutation.mutate(values)
            })}
          >
            <ServerError
              error={serverError}
              title="Unable to change the status"
              onDismiss={() => setServerError(null)}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New status</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={mutation.isPending}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allowed.map((status) => (
                        <SelectItem key={status} value={status}>
                          {parcelStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hubId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Hub id</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Leave blank to keep the current hub"
                      disabled={mutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Moves the parcel's current hub, which is what branch and hub scoping filters on.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Recorded on the tracking timeline"
                      disabled={mutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Change status"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function CancelParcelDialog({
  open,
  onOpenChange,
  parcelId,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  parcelId: string
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<unknown>(null)

  const form = useForm<z.infer<typeof cancelSchema>>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { reason: "" },
  })

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof cancelSchema>) =>
      cancelParcel(parcelId, { reason: values.reason }),
    onSuccess: () => {
      toast.success("Parcel cancelled")
      void queryClient.invalidateQueries({ queryKey: ["parcels"] })
      onDone()
      onOpenChange(false)
    },
    onError: setServerError,
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (mutation.isPending) return
        if (next) {
          form.reset({ reason: "" })
          setServerError(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this parcel?</DialogTitle>
          <DialogDescription>
            Cancellation is terminal — the API refuses any further status change afterwards. A
            collected COD amount still has to be settled separately.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            className="space-y-4"
            noValidate
            onSubmit={form.handleSubmit((values) => {
              setServerError(null)
              mutation.mutate(values)
            })}
          >
            <Alert variant="warning">
              <Ban />
              <AlertTitle>This cannot be undone</AlertTitle>
              <AlertDescription>
                The reason below is written to the parcel's tracking timeline for audit.
              </AlertDescription>
            </Alert>

            <ServerError
              error={serverError}
              title="Unable to cancel this parcel"
              onDismiss={() => setServerError(null)}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Customer requested cancellation before pickup"
                      disabled={mutation.isPending}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={() => onOpenChange(false)}
              >
                Keep parcel
              </Button>
              <Button type="submit" variant="destructive" disabled={mutation.isPending}>
                {mutation.isPending ? "Cancelling…" : "Cancel parcel"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function ParcelDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-56 lg:col-span-2" />
        <Skeleton className="h-56" />
      </div>
      <Skeleton className="h-72 w-full" />
    </div>
  )
}
