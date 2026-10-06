import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { useMemo, useState } from "react"
import { Plus, Wallet, MoreHorizontal, ArrowLeftRight } from "lucide-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ServerDataTable,
} from "@dropx/ui"
import type { DataTableColumn } from "@dropx/ui"
import {
  PAYMENT_STATES,
  type PaymentKind,
  type PaymentMethod,
  type PaymentState,
} from "@dropx/types"
import { ListFilterSelect } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listPayments } from "@/lib/endpoints"
import { formatDateTime, formatMoney } from "@/lib/format"
import { useQueryParams } from "@/lib/list-params"
import type { PaymentListItem } from "@/lib/types"
import type { PaymentsSearch } from "@/routes/payments-search-params"

import { PaymentRecordSheet } from "./payment-record-sheet"
import { PaymentRefundSheet } from "./payment-refund-sheet"

const PAYMENT_SORT_COLUMNS = ["createdAt", "paidAt", "amount", "status"] as const

const TYPE_LABEL: Record<PaymentKind, string> = {
  DELIVERY_FEE: "Delivery fee",
  COD: "COD",
  REFUND: "Refund",
  OTHER: "Other",
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BKASH: "bKash",
  NAGAD: "Nagad",
  CARD: "Card",
  BANK: "Bank",
  ONLINE: "Online",
}

const STATUS_LABEL: Record<PaymentState, string> = {
  PENDING: "Pending",
  PAID: "Paid",
  FAILED: "Failed",
  REFUNDED: "Refunded",
}

const STATUS_BADGE: Record<PaymentState, "warning" | "success" | "destructive" | "outline"> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "destructive",
  REFUNDED: "outline",
}

export function PaymentsListPage({ search }: { search: PaymentsSearch }) {
  const { hasPermission } = useAuth()
  const [recordOpen, setRecordOpen] = useState(false)
  const [refundTarget, setRefundTarget] = useState<PaymentListItem | null>(null)

  // No debounce layer: the payments API has no text search, so the where object
  // is the search params themselves, page and sort included.
  const params = useMemo(
    () => ({
      page: search.page,
      limit: search.limit,
      sortBy: search.sortBy,
      sort: search.sort,
      status: search.status as PaymentsSearch["status"],
    }),
    [search.page, search.limit, search.sortBy, search.sort, search.status],
  )

  const query = useQuery({
    queryKey: ["payments", params],
    queryFn: () => listPayments(params),
  })

  const [, patch] = useQueryParams<PaymentsSearch>("/payments", search)

  const meta = query.data?.meta
  const nodes = query.data?.nodes ?? []

  const serverMeta = useMemo(
    () =>
      meta
        ? {
            page: meta.currentPage,
            limit: search.limit,
            totalCount: meta.totalCount,
            totalPages: meta.totalPages,
            hasNextPage: meta.hasNextPage,
            hasPreviousPage: meta.hasPreviousPage,
          }
        : undefined,
    [meta, search.limit],
  )

  const canManage = hasPermission("payments.manage")

  const columns = useMemo<DataTableColumn<PaymentListItem>[]>(
    () => [
      {
        id: "trackingNumber",
        header: "Parcel",
        cell: (payment) => (
          <div className="flex flex-col">
            <Link
              to="/parcels/$parcelId"
              params={{ parcelId: payment.parcelId }}
              className="text-accent-ink hover:text-accent-ink-hover font-mono text-sm font-semibold underline-offset-4 hover:underline"
            >
              {payment.trackingNumber}
            </Link>
            <span className="text-muted-foreground text-xs">Parcel #{payment.parcelId}</span>
          </div>
        ),
        value: (payment) => payment.trackingNumber,
      },
      {
        id: "type",
        header: "Type",
        cell: (payment) => <Badge variant="secondary">{TYPE_LABEL[payment.type]}</Badge>,
        value: (payment) => TYPE_LABEL[payment.type],
      },
      {
        id: "amount",
        header: "Amount",
        cell: (payment) => (
          <span className="text-accent-ink text-sm font-semibold tabular-nums">
            {formatMoney(payment.amount)}
          </span>
        ),
        value: (payment) => payment.amount,
      },
      {
        id: "method",
        header: "Method",
        cell: (payment) => (
          <span className="text-muted-foreground text-sm">{METHOD_LABEL[payment.method]}</span>
        ),
        value: (payment) => METHOD_LABEL[payment.method],
      },
      {
        id: "status",
        header: "Status",
        cell: (payment) => (
          <Badge variant={STATUS_BADGE[payment.status]}>{STATUS_LABEL[payment.status]}</Badge>
        ),
        value: (payment) => payment.status,
      },
      {
        id: "paidAt",
        header: "Paid / returned on",
        cell: (payment) => (
          <span className="text-muted-foreground text-sm">
            {payment.paidAt ? formatDateTime(payment.paidAt) : "—"}
          </span>
        ),
        value: (payment) => payment.paidAt ?? "",
      },
    ],
    [],
  )

  const rowActions = (payment: PaymentListItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Payment actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-mono text-xs">
          {payment.trackingNumber}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hasPermission("parcels.view") ? (
          <DropdownMenuItem asChild>
            <Link to="/parcels/$parcelId" params={{ parcelId: payment.parcelId }}>
              Open parcel
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canManage && payment.type === "COD" && payment.status === "PAID" ? (
          <DropdownMenuItem onSelect={() => setRefundTarget(payment)}>
            <ArrowLeftRight />
            Refund
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const recordButton = canManage ? (
    <Button onClick={() => setRecordOpen(true)}>
      <Plus />
      Record remittance
    </Button>
  ) : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Money"
        title="Payments"
        description="Cash COD collections remitted to the company, and refunds against them."
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load payments"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ListFilterSelect
              className="w-44"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value || undefined })}
              options={PAYMENT_STATES.map((status) => ({
                value: status,
                label: STATUS_LABEL[status],
              }))}
            />
            {recordButton}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(payment) => payment.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof PAYMENT_SORT_COLUMNS)[number] | undefined}
            sort={search.sort}
            sortableColumns={PAYMENT_SORT_COLUMNS}
            loading={query.isPending}
            rowActions={rowActions}
            emptyState={
              <EmptyState
                icon={Wallet}
                title="No payments match these filters"
                description={
                  search.status
                    ? "Try a different status, or clear the filters."
                    : "No remittances yet. Record the first one when a rider hands in COD cash."
                }
                action={recordButton}
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as PaymentsSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <PaymentRecordSheet
        open={recordOpen}
        onOpenChange={setRecordOpen}
        onRecorded={() => void query.refetch()}
      />

      {refundTarget ? (
        <PaymentRefundSheet
          open={refundTarget !== null}
          payment={refundTarget}
          onOpenChange={(open) => {
            if (!open) setRefundTarget(null)
          }}
          onRefunded={() => void query.refetch()}
        />
      ) : null}
    </div>
  )
}
