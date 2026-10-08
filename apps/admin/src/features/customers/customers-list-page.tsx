import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { UserRound } from "lucide-react"
import { useMemo } from "react"
import { Badge, Card, CardContent, CardHeader, EmptyState, ServerDataTable } from "@dropx/ui"
import type { DataTableColumn } from "@dropx/ui"
import { CUSTOMER_STATUSES, type CustomerStatus, type CustomerType } from "@dropx/types"
import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { listCustomers } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { Customer } from "@/lib/types"
import type { CustomersSearch } from "@/routes/customers-search-params"

const CUSTOMER_SORT_COLUMNS = ["name", "phone", "status", "createdAt"] as const

const STATUS_LABEL: Record<CustomerStatus, string> = {
  TEMP: "Not verified",
  ACTIVE: "Active",
}

const STATUS_BADGE: Record<CustomerStatus, "warning" | "success"> = {
  TEMP: "warning",
  ACTIVE: "success",
}

const TYPE_LABEL: Record<CustomerType, string> = {
  INDIVIDUAL: "Individual",
  BUSINESS: "Business",
}

export function CustomersListPage({ search }: { search: CustomersSearch }) {
  const where = usePaginatedListWhere(search)

  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy,
      sort: where.sort,
      search: where.search,
      status: where.status as CustomersSearch["status"],
    }),
    [where.page, where.limit, where.sortBy, where.sort, where.search, where.status],
  )

  const query = useQuery({
    queryKey: ["customers", params],
    queryFn: () => listCustomers(params),
  })

  const [, patch] = useQueryParams<CustomersSearch>("/customers", search)

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

  const columns = useMemo<DataTableColumn<Customer>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (customer) => (
          <div className="flex flex-col">
            <Link
              to="/customers/$customerId"
              params={{ customerId: customer.id }}
              className="text-accent-ink hover:text-accent-ink-hover text-sm font-semibold underline-offset-4 hover:underline"
            >
              {customer.name}
            </Link>
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs">{customer.code}</span>
              <span className="text-muted-foreground text-xs">{customer.phone}</span>
            </span>
          </div>
        ),
        value: (customer) => customer.name,
      },
      {
        id: "phone",
        header: "Phone",
        cell: (customer) => <span className="text-muted-foreground text-sm">{customer.phone}</span>,
        value: (customer) => customer.phone,
      },
      {
        id: "email",
        header: "Email",
        cell: (customer) => (
          <span className="text-muted-foreground block max-w-56 truncate text-sm">
            {customer.email ?? "—"}
          </span>
        ),
        value: (customer) => customer.email ?? "",
      },
      {
        id: "type",
        header: "Type",
        cell: (customer) => <Badge variant="outline">{TYPE_LABEL[customer.type]}</Badge>,
        value: (customer) => TYPE_LABEL[customer.type],
      },
      {
        id: "status",
        header: "Status",
        cell: (customer) => (
          <Badge variant={STATUS_BADGE[customer.status]}>{STATUS_LABEL[customer.status]}</Badge>
        ),
        value: (customer) => customer.status,
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (customer) => (
          <span className="text-muted-foreground text-sm">
            {formatDateTime(customer.createdAt)}
          </span>
        ),
        value: (customer) => customer.createdAt,
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Organization"
        title="Customers"
        description="Who books parcels. TEMP rows are consents that never verified a code."
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load customers"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search customers"
                placeholder="Code, name, phone or email"
              />
            </div>
            <ListFilterSelect
              className="w-44"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value || undefined })}
              options={CUSTOMER_STATUSES.map((status) => ({
                value: status,
                label: STATUS_LABEL[status],
              }))}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(customer) => customer.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof CUSTOMER_SORT_COLUMNS)[number] | undefined}
            sort={search.sort}
            sortableColumns={CUSTOMER_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={UserRound}
                title="No customers match these filters"
                description={
                  search.search || search.status
                    ? "Try a different search, or clear the filters."
                    : "No customers yet. They appear here when a phone or email requests a verification code."
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as CustomersSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
