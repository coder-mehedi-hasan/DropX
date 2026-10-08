import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, MapPin, Package, UserRound, Zap } from "lucide-react"
import { useMemo, useState } from "react"
import {
  AppToast,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Skeleton,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useConfirmation,
} from "@dropx/ui"
import { DetailRow, PageHeader, PanelTitle } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { activateCustomer, getCustomer, listParcels } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import type { ParcelListParams } from "@/lib/parcels"
import type { Customer, CustomerAddress, Parcel } from "@/lib/types"
import { DEFAULT_CUSTOMERS_SEARCH_PARAMS } from "@/routes/customers-search-params"

const STATUS_LABEL: Record<Customer["status"], string> = {
  TEMP: "Not verified",
  ACTIVE: "Active",
}

export function CustomerDetailPage({ customerId }: { customerId: string }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("customers.manage")
  const { confirm, confirmationDialog } = useConfirmation()
  const [actionError, setActionError] = useState<unknown>(null)

  const customer = useQuery({
    queryKey: ["customers", "detail", customerId],
    queryFn: ({ signal }) => getCustomer(customerId, signal),
  })

  const historyParams = useMemo<ParcelListParams>(
    () => ({ page: 1, limit: 20, sortBy: "createdAt", sort: "desc", customerId }),
    [customerId],
  )

  const history = useQuery({
    queryKey: ["parcels", "history", customerId],
    queryFn: ({ signal }) => listParcels(historyParams, signal),
    enabled: Boolean(customer.data),
  })

  const queryClient = useQueryClient()
  const activate = useMutation({
    mutationFn: () => activateCustomer(customerId),
    onMutate: () => setActionError(null),
    onSuccess: (saved) => {
      AppToast.success(`${saved.name} is now active`)
      void queryClient.invalidateQueries({ queryKey: ["customers"] })
    },
    onError: (error) => setActionError(error),
  })

  async function askActivate() {
    const ok = await confirm({
      title: "Activate this customer?",
      description:
        "Marks the TEMP account active without a verification code — the support override for a customer who accepted consent but never completed OTP.",
      confirmLabel: "Activate",
    })
    if (ok) activate.mutate()
  }

  if (customer.isPending) return <CustomerDetailSkeleton />

  if (customer.isError) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ServerError
          error={customer.error}
          title="Unable to load this customer"
          onDismiss={() => void customer.refetch()}
        />
      </div>
    )
  }

  const data = customer.data

  return (
    <div className="flex flex-col gap-6">
      <BackLink />

      <PageHeader
        eyebrow="Customer"
        title={data.name}
        description={
          data.email
            ? `${data.phone} · ${data.email}`
            : `Phone ${data.phone} · account registered ${formatDateTime(data.createdAt)}`
        }
        actions={
          canManage && data.status === "TEMP" ? (
            <Button onClick={() => void askActivate()}>
              <Zap />
              Activate customer
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={data.status} />
        <Badge variant="secondary">{data.type}</Badge>
        {data.status === "TEMP" ? (
          <span className="text-muted-foreground text-sm">
            {data.consentAcceptedAt
              ? `Consent accepted ${formatDateTime(data.consentAcceptedAt)} — never verified a code`
              : "Consent not recorded"}
          </span>
        ) : null}
      </div>

      <ServerError
        error={actionError}
        title="Could not activate the customer"
        onDismiss={() => setActionError(null)}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="gap-4 py-4">
          <CardHeader className="px-4">
            <PanelTitle icon={UserRound}>Account</PanelTitle>
          </CardHeader>
          <CardContent className="px-4">
            <dl className="grid grid-cols-2 gap-5">
              <DetailRow label="Code">
                <span className="font-mono">{data.code}</span>
              </DetailRow>
              <DetailRow label="Phone">{data.phone}</DetailRow>
              <DetailRow label="Email">{data.email ?? "—"}</DetailRow>
              <DetailRow label="Type">{data.type}</DetailRow>
              <DetailRow label="Status">{STATUS_LABEL[data.status]}</DetailRow>
              <DetailRow label="Consent accepted">
                {data.consentAcceptedAt ? formatDateTime(data.consentAcceptedAt) : "—"}
              </DetailRow>
              <DetailRow label="Activated">
                {data.activatedAt ? formatDateTime(data.activatedAt) : "—"}
              </DetailRow>
              <DetailRow label="Customer id">#{data.id}</DetailRow>
              <DetailRow label="Updated">{formatDateTime(data.updatedAt)}</DetailRow>
            </dl>
          </CardContent>
        </Card>

        <Card className="gap-4 py-4 lg:col-span-2">
          <CardHeader className="px-4">
            <PanelTitle icon={MapPin}>Addresses</PanelTitle>
          </CardHeader>
          <CardContent className="px-4">
            {data.addresses.length === 0 ? (
              <EmptyState
                icon={MapPin}
                title="No saved addresses"
                description="This customer has not saved an address. Addresses are managed from the customer portal."
              />
            ) : (
              <div className="space-y-4">
                {data.addresses.map((address) => (
                  <AddressCard key={address.id} address={address} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="gap-4 py-4">
        <CardHeader className="px-4">
          <PanelTitle icon={Package}>Parcel history</PanelTitle>
        </CardHeader>
        <CardContent className="px-4">
          {history.isError ? (
            <ServerError
              error={history.error}
              title="Unable to load the parcel history"
              onDismiss={() => void history.refetch()}
            />
          ) : history.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : history.data?.nodes.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No parcels yet"
              description="Parcels this customer sent or received will appear here."
            />
          ) : (
            <PackageHistoryTable parcels={history.data?.nodes ?? []} />
          )}
        </CardContent>
      </Card>

      {confirmationDialog}
    </div>
  )
}

function AddressCard({ address }: { address: CustomerAddress }) {
  const addressLine = [address.addressLine, address.city, address.district, address.postalCode]
    .filter(Boolean)
    .join(", ")

  return (
    <div className="border-border rounded-lg border p-4">
      <div className="mb-1 flex items-center gap-2">
        {address.label ? <span className="text-sm font-medium">{address.label}</span> : null}
        {address.isDefault ? <Badge variant="secondary">Default</Badge> : null}
      </div>
      <p className="text-muted-foreground text-sm">{addressLine}</p>
    </div>
  )
}

function PackageHistoryTable({ parcels }: { parcels: Parcel[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tracking</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead className="text-right">Weight</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {parcels.map((parcel) => (
          <TableRow key={parcel.id}>
            <TableCell>
              <Link
                to="/parcels/$parcelId"
                params={{ parcelId: parcel.id }}
                className="text-accent-ink hover:text-accent-ink-hover font-mono text-xs font-semibold underline-offset-4 hover:underline"
              >
                {parcel.trackingNumber}
              </Link>
            </TableCell>
            <TableCell>
              <StatusBadge status={parcel.status} />
            </TableCell>
            <TableCell>
              {parcel.paymentType === "COD" ? (
                <Badge variant="warning">COD</Badge>
              ) : (
                <Badge variant="outline">Prepaid</Badge>
              )}
            </TableCell>
            <TableCell className="text-right">{parcel.weight} kg</TableCell>
            <TableCell>
              <span className="text-muted-foreground text-sm">
                {formatDateTime(parcel.createdAt)}
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function BackLink() {
  const navigate = useNavigate()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 w-fit"
      onClick={() => void navigate({ to: "/customers", search: DEFAULT_CUSTOMERS_SEARCH_PARAMS })}
    >
      <ArrowLeft />
      All customers
    </Button>
  )
}

function CustomerDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full lg:col-span-2" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  )
}
