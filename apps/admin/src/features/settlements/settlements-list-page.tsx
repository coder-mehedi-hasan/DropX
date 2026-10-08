import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { CheckCircle2, Handshake, Plus } from "lucide-react"
import {
  AppToast,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  ServerDataTable,
} from "@dropx/ui"
import type { DataTableColumn } from "@dropx/ui"
import { SETTLEMENT_STATUSES, SETTLEMENT_TRANSITIONS, type SettlementStatus } from "@dropx/types"
import { ListFilterSelect } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listSettlements, setSettlementStatus } from "@/lib/endpoints"
import { formatDate, formatDateTime, formatMoney } from "@/lib/format"
import { useQueryParams } from "@/lib/list-params"
import type { SettlementListItem } from "@/lib/types"
import type { SettlementsSearch } from "@/routes/settlements-search-params"

import { SettlementFormSheet } from "./settlement-form-sheet"

const SETTLEMENT_SORT_COLUMNS = [
  "createdAt",
  "periodStart",
  "periodEnd",
  "totalCod",
  "netAmount",
  "status",
] as const

const STATUS_LABEL: Record<SettlementStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  PAID: "Paid",
  FAILED: "Failed",
}

const STATUS_BADGE: Record<SettlementStatus, "warning" | "success" | "destructive" | "outline"> = {
  PENDING: "warning",
  PROCESSING: "outline",
  PAID: "success",
  FAILED: "destructive",
}

/**
 * The happy-path successor of a status: PENDING → PROCESSING → PAID, with
 * FAILED re-arming to PROCESSING for a retry. A terminal PAID has none.
 */
function nextStatus(status: SettlementStatus): SettlementStatus | null {
  return SETTLEMENT_TRANSITIONS[status].find((candidate) => candidate !== "FAILED") ?? null
}

export function SettlementsListPage({ search }: { search: SettlementsSearch }) {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  // No debounce layer: the settlements API has no text search, so the where
  // object is the search params themselves, page and sort included.
  const params = useMemo(
    () => ({
      page: search.page,
      limit: search.limit,
      sortBy: search.sortBy,
      sort: search.sort,
      status: search.status as SettlementsSearch["status"],
    }),
    [search.page, search.limit, search.sortBy, search.sort, search.status],
  )

  const query = useQuery({
    queryKey: ["settlements", params],
    queryFn: () => listSettlements(params),
  })

  const [, patch] = useQueryParams<SettlementsSearch>("/settlements", search)

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

  const advance = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SettlementStatus }) =>
      setSettlementStatus(id, { status }),
    onSuccess: (settlement) => {
      AppToast.success(`${settlement.customerName} is ${STATUS_LABEL[settlement.status]}`)
      void queryClient.invalidateQueries({ queryKey: ["settlements"] })
    },
  })

  const canManage = hasPermission("settlements.manage")

  const columns = useMemo<DataTableColumn<SettlementListItem>[]>(
    () => [
      {
        id: "code",
        header: "Code",
        cell: (settlement) => <span className="font-mono text-sm">{settlement.code}</span>,
        value: (settlement) => settlement.code,
      },
      {
        id: "customer",
        header: "Merchant",
        cell: (settlement) => (
          <div className="flex flex-col">
            <span className="text-accent-ink text-sm font-semibold">{settlement.customerName}</span>
            <span className="text-muted-foreground text-xs">{settlement.customerPhone}</span>
          </div>
        ),
        value: (settlement) => settlement.customerName,
      },
      {
        id: "period",
        header: "Period",
        cell: (settlement) => (
          <span className="text-muted-foreground text-sm tabular-nums">
            {formatDate(settlement.periodStart)} → {formatDate(settlement.periodEnd)}
          </span>
        ),
        value: (settlement) => settlement.periodStart,
      },
      {
        id: "totalCod",
        header: "COD collected",
        cell: (settlement) => (
          <span className="text-accent-ink text-sm font-semibold tabular-nums">
            {formatMoney(settlement.totalCod)}
          </span>
        ),
        value: (settlement) => settlement.totalCod,
      },
      {
        id: "deliveryCharges",
        header: "Delivery fees",
        cell: (settlement) => (
          <span className="text-muted-foreground text-sm tabular-nums">
            - {formatMoney(settlement.deliveryCharges)}
          </span>
        ),
        value: (settlement) => settlement.deliveryCharges,
      },
      {
        id: "netAmount",
        header: "Net to pay",
        cell: (settlement) => (
          <span className="text-accent-ink text-sm font-semibold tabular-nums">
            {formatMoney(settlement.netAmount)}
          </span>
        ),
        value: (settlement) => settlement.netAmount,
      },
      {
        id: "status",
        header: "Status",
        cell: (settlement) => (
          <Badge variant={STATUS_BADGE[settlement.status]}>{STATUS_LABEL[settlement.status]}</Badge>
        ),
        value: (settlement) => settlement.status,
      },
      {
        id: "createdAt",
        header: "Raised",
        cell: (settlement) => (
          <span className="text-muted-foreground text-sm">
            {formatDateTime(settlement.createdAt)}
          </span>
        ),
        value: (settlement) => settlement.createdAt,
      },
    ],
    [],
  )

  const createButton = canManage ? (
    <Button onClick={() => setCreateOpen(true)}>
      <Plus />
      Create settlement
    </Button>
  ) : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Money"
        title="Settlements"
        description="Period statements of COD collected per merchant, and the disbursement against them."
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load settlements"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground text-sm">
              Net to pay = COD collected minus delivery fees. Paid statements are terminal; a
              correction is a new period's settlement.
            </p>
            <div className="flex items-center gap-2">
              <ListFilterSelect
                className="w-44"
                label="Filter by status"
                allLabel="All statuses"
                value={search.status ?? ""}
                onChange={(value) => patch({ status: value || undefined })}
                options={SETTLEMENT_STATUSES.map((status) => ({
                  value: status,
                  label: STATUS_LABEL[status],
                }))}
              />
              {createButton}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(settlement) => settlement.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof SETTLEMENT_SORT_COLUMNS)[number] | undefined}
            sort={search.sort}
            sortableColumns={SETTLEMENT_SORT_COLUMNS}
            loading={query.isPending}
            rowActions={(settlement) => {
              if (!canManage) return undefined
              const next = nextStatus(settlement.status)
              if (!next) return undefined
              return (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={advance.isPending}
                  onClick={() => advance.mutate({ id: settlement.id, status: next })}
                >
                  <CheckCircle2 />
                  Mark {STATUS_LABEL[next]}
                </Button>
              )
            }}
            emptyState={
              <EmptyState
                icon={Handshake}
                title="No settlements match these filters"
                description={
                  search.status
                    ? "Try a different status, or clear the filters."
                    : "Nothing has been settled yet. Raise the first statement when a merchant's period of COD is due."
                }
                action={createButton}
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as SettlementsSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <SettlementFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void query.refetch()}
      />
    </div>
  )
}
