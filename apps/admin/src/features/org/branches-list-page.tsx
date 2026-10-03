import { useQuery } from "@tanstack/react-query"
import { Building2, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  ServerDataTable,
  type DataTableColumn,
} from "@dropx/ui"
import { BRANCH_STATUSES } from "@dropx/db"
import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { createBranch, listBranches } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import { type Branch } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { BranchesSearch } from "@/routes/org-search-params"

import { BranchFormSheet } from "./branch-form-sheet"

const BRANCH_SORT_COLUMNS = ["name", "code", "status", "createdAt"] as const

export function BranchesListPage({ search }: { search: BranchesSearch }) {
  const { hasPermission } = useAuth()
  const canCreate = hasPermission("branches.manage")

  const [createOpen, setCreateOpen] = useState(false)

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy,
      sort: where.sort,
      search: where.search,
      status: where.status as BranchesSearch["status"],
    }),
    [where.page, where.limit, where.sortBy, where.sort, where.search, where.status],
  )

  const query = useQuery({
    queryKey: ["branches", params],
    queryFn: () => listBranches(params),
  })

  const [, patch] = useQueryParams<BranchesSearch>("/branches", search)

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

  const columns = useMemo<DataTableColumn<Branch>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (branch) => <span className="font-medium">{branch.name}</span>,
        value: (branch) => branch.name,
      },
      {
        id: "code",
        header: "Code",
        cell: (branch) => <span className="font-mono text-xs">{branch.code}</span>,
        value: (branch) => branch.code,
      },
      {
        id: "district",
        header: "District",
        cell: (branch) => branch.district ?? "—",
        value: (branch) => branch.district ?? "",
      },
      {
        id: "status",
        header: "Status",
        cell: (branch) =>
          branch.status === "ACTIVE" ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
        value: (branch) => branch.status,
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (branch) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(branch.createdAt)}</span>
        ),
        value: (branch) => branch.createdAt,
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Organization"
        title="Branches"
        description="Regional offices. Staff are created against a branch, and hubs hang off one."
        actions={
          canCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              New branch
            </Button>
          ) : null
        }
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load branches"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search branches"
                placeholder="Name, code or district"
              />
            </div>
            <ListFilterSelect
              className="w-40"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value || undefined })}
              options={BRANCH_STATUSES.map((status: (typeof BRANCH_STATUSES)[number]) => ({
                value: status,
                label: status === "ACTIVE" ? "Active" : "Inactive",
              }))}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(branch) => branch.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof BRANCH_SORT_COLUMNS)[number] | undefined}
            sort={search.sort}
            sortableColumns={BRANCH_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={Building2}
                title="No branches match these filters"
                description={
                  search.search || search.status
                    ? "Try a different search, or clear the filters."
                    : "No branches yet. Create the first one."
                }
                action={
                  canCreate ? (
                    <Button onClick={() => setCreateOpen(true)}>
                      <Plus />
                      New branch
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as BranchesSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <BranchFormSheet open={createOpen} onOpenChange={setCreateOpen} onSubmit={createBranch} />
    </div>
  )
}
