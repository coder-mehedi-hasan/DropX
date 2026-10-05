import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, ClipboardList, Eye, X } from "lucide-react"
import { useMemo, useState } from "react"
import {
  AppToast,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ServerDataTable,
  type DataTableColumn,
} from "@dropx/ui"

import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { formatDateTime } from "@/lib/format"
import { listRiderApplications, updateRiderApplicationStatus } from "@/lib/endpoints"
import type { RiderApplication, RiderApplicationStatus } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { RiderApplicationsSearch } from "@/routes/rider-applications-search-params"

const SORT_COLUMNS = ["name", "district", "status", "createdAt"] as const
const STATUS_LABEL: Record<RiderApplicationStatus, string> = {
  PENDING: "Pending",
  REVIEWING: "Reviewing",
  APPROVED: "Approved",
  REJECTED: "Rejected",
}
const STATUS_VARIANT: Record<
  RiderApplicationStatus,
  "warning" | "secondary" | "success" | "destructive"
> = {
  PENDING: "warning",
  REVIEWING: "secondary",
  APPROVED: "success",
  REJECTED: "destructive",
}

export function RiderApplicationsListPage({ search }: { search: RiderApplicationsSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("riders.manage")
  const [selected, setSelected] = useState<RiderApplication | null>(null)
  const [actionError, setActionError] = useState<unknown>(null)
  const queryClient = useQueryClient()
  const where = usePaginatedListWhere(search)
  const params = useMemo(() => ({ ...where, status: where.status || undefined }), [where])
  const query = useQuery({
    queryKey: ["rider-applications", params],
    queryFn: () => listRiderApplications(params),
  })
  const [, patch] = useQueryParams<RiderApplicationsSearch>("/rider-applications", search)
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RiderApplicationStatus }) =>
      updateRiderApplicationStatus(id, status),
    onMutate: () => setActionError(null),
    onSuccess: (application) => {
      AppToast.success(`Application marked ${STATUS_LABEL[application.status].toLowerCase()}`)
      void queryClient.invalidateQueries({ queryKey: ["rider-applications"] })
      setSelected((current) => (current?.id === application.id ? application : current))
    },
    onError: setActionError,
  })

  const nodes = query.data?.nodes ?? []
  const meta = query.data?.meta
  const serverMeta = meta
    ? {
      page: meta.currentPage,
      limit: search.limit,
      totalCount: meta.totalCount,
      totalPages: meta.totalPages,
      hasNextPage: meta.hasNextPage,
      hasPreviousPage: meta.hasPreviousPage,
    }
    : undefined
  const columns = useMemo<DataTableColumn<RiderApplication>[]>(
    () => [
      {
        id: "name",
        header: "Applicant",
        cell: (application) => (
          <div>
            <p className="font-medium">{application.name}</p>
            <p className="text-muted-foreground text-xs">{application.phone}</p>
          </div>
        ),
        value: (application) => application.name,
      },
      {
        id: "district",
        header: "District",
        cell: (application) => application.district,
        value: (application) => application.district,
      },
      {
        id: "vehicleType",
        header: "Vehicle",
        cell: (application) => application.vehicleType,
        value: (application) => application.vehicleType,
      },
      {
        id: "status",
        header: "Status",
        cell: (application) => (
          <Badge variant={STATUS_VARIANT[application.status]}>
            {STATUS_LABEL[application.status]}
          </Badge>
        ),
        value: (application) => application.status,
      },
      {
        id: "createdAt",
        header: "Applied",
        cell: (application) => (
          <span className="text-muted-foreground text-sm">
            {formatDateTime(application.createdAt)}
          </span>
        ),
        value: (application) => application.createdAt,
      },
      {
        id: "actions",
        header: "",
        align: "end",
        cell: (application) => (
          <Button variant="ghost" size="sm" onClick={() => setSelected(application)}>
            <Eye /> View
          </Button>
        ),
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Fleet"
        title="Rider applications"
        description="Review people who applied to join the DropX rider network."
      />

      <ServerError
        error={query.isError ? query.error : actionError}
        title="Unable to load rider applications"
        onDismiss={() => {
          setActionError(null)
          void query.refetch()
        }}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search applications"
                placeholder="Name, phone, email or district"
              />
            </div>
            <ListFilterSelect
              className="w-40"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value as RiderApplicationsSearch["status"] })}
              options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ServerDataTable
            rowId={(application) => application.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy}
            sort={search.sort}
            sortableColumns={SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={ClipboardList}
                title="No rider applications"
                description={
                  search.search || search.status
                    ? "Try a different search or clear the filter."
                    : "Applications from the public rider form will appear here."
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as RiderApplicationsSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.name}</DialogTitle>
            <DialogDescription>
              {selected?.phone}
              {selected?.email ? ` · ${selected.email}` : ""}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="grid gap-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Detail label="District" value={selected.district} />
                <Detail label="Vehicle" value={selected.vehicleType} />
                <Detail label="License" value={selected.licenseNumber || "Not provided"} />
                <Detail
                  label="Experience"
                  value={
                    selected.experienceYears === null
                      ? "Not provided"
                      : `${selected.experienceYears} years`
                  }
                />
                <Detail label="Availability" value={selected.availability} />
                <Detail label="Applied" value={formatDateTime(selected.createdAt)} />
              </div>
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  Additional details
                </p>
                <p className="mt-1 whitespace-pre-wrap">
                  {selected.notes || "No additional details."}
                </p>
              </div>
              {canManage ? (
                <>
                  <hr className="my-4" />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={update.isPending || selected.status === "REVIEWING"}
                      onClick={() => update.mutate({ id: selected.id, status: "REVIEWING" })}
                    >
                      Reviewing
                    </Button>
                    <Button
                      size="sm"
                      disabled={update.isPending || selected.status === "APPROVED"}
                      onClick={() => update.mutate({ id: selected.id, status: "APPROVED" })}
                    >
                      <Check /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={update.isPending || selected.status === "REJECTED"}
                      onClick={() => update.mutate({ id: selected.id, status: "REJECTED" })}
                    >
                      <X /> Reject
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}
