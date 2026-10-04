import { useQuery } from "@tanstack/react-query"
import { Package, Pencil, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  ServerDataTable,
  useFormSheetState,
  type DataTableColumn,
} from "@dropx/ui"
import { RECORD_STATUSES } from "@dropx/types"
import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listPricingRules } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import { type PricingRule } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { PricingRulesSearch } from "@/routes/pricing-rules-search-params"
import { PricingRuleFormSheet } from "./pricing-rule-form-sheet"

const PRICING_RULE_SORT_COLUMNS = [
  "name",
  "originZone",
  "destinationZone",
  "minWeight",
  "createdAt",
] as const

export function PricingRulesListPage({ search }: { search: PricingRulesSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("pricing.manage")

  const sheet = useFormSheetState<string>()
  const [editing, setEditing] = useState<PricingRule | null>(null)

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy,
      sort: where.sort,
      search: where.search,
      status: where.status as PricingRulesSearch["status"],
    }),
    [where.page, where.limit, where.sortBy, where.sort, where.search, where.status],
  )

  const query = useQuery({
    queryKey: ["pricing-rules", params],
    queryFn: () => listPricingRules(params),
  })

  const [, patch] = useQueryParams<PricingRulesSearch>("/pricing-rules", search)

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

  const columns = useMemo<DataTableColumn<PricingRule>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (rule) => <span className="font-medium">{rule.name}</span>,
        value: (rule) => rule.name,
      },
      {
        id: "originZone",
        header: "Origin zone",
        cell: (rule) => <span className="font-mono text-xs">{rule.originZoneId}</span>,
        value: (rule) => rule.originZoneId,
      },
      {
        id: "destinationZone",
        header: "Destination zone",
        cell: (rule) => <span className="font-mono text-xs">{rule.destinationZoneId}</span>,
        value: (rule) => rule.destinationZoneId,
      },
      {
        id: "minWeight",
        header: "Min weight (kg)",
        cell: (rule) => rule.minWeight,
        value: (rule) => rule.minWeight,
      },
      {
        id: "maxWeight",
        header: "Max weight (kg)",
        cell: (rule) => (rule.maxWeight === null ? "—" : rule.maxWeight),
        value: (rule) => rule.maxWeight ?? 0,
        hideBelow: "lg",
      },
      {
        id: "basePrice",
        header: "Base price",
        cell: (rule) => `${rule.basePrice} BDT`,
        value: (rule) => rule.basePrice,
      },
      {
        id: "status",
        header: "Status",
        cell: (rule) =>
          rule.status === "ACTIVE" ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
        value: (rule) => rule.status,
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (rule) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(rule.createdAt)}</span>
        ),
        value: (rule) => rule.createdAt,
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: "",
              align: "end" as const,
              cell: (rule: PricingRule) => (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${rule.name}`}
                  onClick={() => {
                    setEditing(rule)
                    sheet.openFor(rule.id)
                  }}
                >
                  <Pencil />
                  Edit
                </Button>
              ),
            },
          ]
        : []),
    ],
    [canManage, sheet.openFor],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pricing"
        title="Pricing rules"
        description="Zone-pair and weight-band delivery fees."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null)
                sheet.openNew()
              }}
            >
              <Plus />
              New rule
            </Button>
          ) : null
        }
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load pricing rules"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search pricing rules"
                placeholder="Name"
              />
            </div>
            <ListFilterSelect
              className="w-40"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value || undefined })}
              options={RECORD_STATUSES.map((status) => ({
                value: status,
                label: status === "ACTIVE" ? "Active" : "Inactive",
              }))}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(rule) => rule.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof PRICING_RULE_SORT_COLUMNS)[number] | undefined}
            sort={search.sort}
            sortableColumns={PRICING_RULE_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={Package}
                title="No pricing rules match these filters"
                description={
                  search.search || search.status
                    ? "Try a different search, or clear the filters."
                    : "No pricing rules yet. Create the first one."
                }
                action={
                  canManage ? (
                    <Button
                      onClick={() => {
                        setEditing(null)
                        sheet.openNew()
                      }}
                    >
                      <Plus />
                      New rule
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as PricingRulesSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <PricingRuleFormSheet
        key={sheet.key}
        open={sheet.open}
        onOpenChange={sheet.onOpenChange}
        pricingRule={editing}
      />
    </div>
  )
}
