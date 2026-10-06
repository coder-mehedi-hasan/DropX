import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Power, Truck } from "lucide-react"
import { useMemo, useState } from "react"
import {
  AppToast,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  ServerDataTable,
  useConfirmation,
  useFormSheetState,
  type DataTableColumn,
} from "@dropx/ui"
import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { deactivateVehicle, listVehicles } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import { type Vehicle } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { VehiclesSearch } from "@/routes/vehicles-search-params"
import { VehicleFormSheet } from "./vehicle-form-sheet"
import {
  VEHICLE_STATUS_LABELS,
  VEHICLE_TYPE_LABELS,
  vehicleStatusOptions,
  vehicleTypeOptions,
} from "./labels"

const VEHICLE_SORT_COLUMNS = [
  "registrationNumber",
  "type",
  "status",
  "capacityKg",
  "createdAt",
] as const

const STATUS_VARIANT: Record<Vehicle["status"], "success" | "secondary" | "destructive"> = {
  AVAILABLE: "success",
  IN_USE: "secondary",
  MAINTENANCE: "destructive",
  INACTIVE: "secondary",
}

export function VehiclesListPage({ search }: { search: VehiclesSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("vehicles.manage")

  // See the zones page: `useFormSheetState` owns the open flag and supplies the
  // remount key, so editing vehicle A then vehicle B cannot leave A's values behind.
  const sheet = useFormSheetState<string>()
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const { confirm, confirmationDialog } = useConfirmation()

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy,
      sort: where.sort,
      search: where.search,
      type: where.type as VehiclesSearch["type"],
      status: where.status as VehiclesSearch["status"],
    }),
    [where.page, where.limit, where.sortBy, where.sort, where.search, where.type, where.status],
  )

  const query = useQuery({
    queryKey: ["vehicles", params],
    queryFn: () => listVehicles(params),
  })

  const [, patch] = useQueryParams<VehiclesSearch>("/vehicles", search)

  const queryClient = useQueryClient()
  // The endpoint rejects a vehicle that is already inactive with a 409 precisely so
  // a double-click surfaces. A mutation with no `onError` would swallow that and the
  // button would look broken, so the failure is held here and rendered as a banner —
  // not a toast, which disappears before it can be read.
  const [actionError, setActionError] = useState<unknown>(null)
  const deactivate = useMutation({
    mutationFn: deactivateVehicle,
    onMutate: () => setActionError(null),
    onSuccess: (vehicle) => {
      AppToast.success(`${vehicle.registrationNumber} deactivated`)
      void queryClient.invalidateQueries({ queryKey: ["vehicles"] })
    },
    onError: (error) => setActionError(error),
  })

  async function askDeactivate(vehicle: Vehicle) {
    const ok = await confirm({
      title: `Deactivate ${vehicle.registrationNumber}?`,
      description:
        "It moves to Inactive and can no longer be assigned to a transfer. The vehicle record is kept.",
      confirmLabel: "Deactivate",
    })
    if (ok) deactivate.mutate(vehicle.id)
  }

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

  const columns = useMemo<DataTableColumn<Vehicle>[]>(
    () => [
      {
        id: "registrationNumber",
        header: "Registration",
        cell: (vehicle) => <span className="font-mono text-xs">{vehicle.registrationNumber}</span>,
        value: (vehicle) => vehicle.registrationNumber,
      },
      {
        id: "type",
        header: "Type",
        cell: (vehicle) => <Badge variant="secondary">{VEHICLE_TYPE_LABELS[vehicle.type]}</Badge>,
        value: (vehicle) => vehicle.type,
      },
      {
        id: "capacityKg",
        header: "Capacity",
        cell: (vehicle) => `${vehicle.capacityKg} kg`,
        value: (vehicle) => vehicle.capacityKg,
        numeric: true,
      },
      {
        id: "status",
        header: "Status",
        cell: (vehicle) => (
          <Badge variant={STATUS_VARIANT[vehicle.status]}>
            {VEHICLE_STATUS_LABELS[vehicle.status]}
          </Badge>
        ),
        value: (vehicle) => vehicle.status,
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (vehicle) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(vehicle.createdAt)}</span>
        ),
        value: (vehicle) => vehicle.createdAt,
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: "",
              align: "end" as const,
              cell: (vehicle: Vehicle) => (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${vehicle.registrationNumber}`}
                    onClick={() => {
                      setEditing(vehicle)
                      sheet.openFor(vehicle.id)
                    }}
                  >
                    <Pencil />
                    Edit
                  </Button>
                  {/* Retiring is one-way here and reversible from the sheet, so
                      the button is offered only while there is something to do. */}
                  {vehicle.status === "INACTIVE" ? null : (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Deactivate ${vehicle.registrationNumber}`}
                      onClick={() => void askDeactivate(vehicle)}
                    >
                      <Power />
                      Deactivate
                    </Button>
                  )}
                </div>
              ),
            },
          ]
        : []),
    ],
    // See the zones page: depend on the memoised callbacks, not on `sheet` itself.
    [canManage, confirm, sheet.openFor],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Fleet"
        title="Vehicles"
        description="Vehicles used for hub-to-hub transfers."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null)
                sheet.openNew()
              }}
            >
              <Plus />
              New vehicle
            </Button>
          ) : null
        }
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load vehicles"
        onDismiss={() => void query.refetch()}
      />

      <ServerError
        error={actionError}
        title="Could not deactivate the vehicle"
        onDismiss={() => setActionError(null)}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search vehicles"
                placeholder="Registration number"
              />
            </div>
            <ListFilterSelect
              className="w-40"
              label="Filter by type"
              allLabel="All types"
              value={search.type ?? ""}
              onChange={(value) => patch({ type: value || undefined })}
              options={vehicleTypeOptions()}
            />
            <ListFilterSelect
              className="w-40"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value || undefined })}
              options={vehicleStatusOptions()}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(vehicle) => vehicle.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof VEHICLE_SORT_COLUMNS)[number] | undefined}
            sort={search.sort}
            sortableColumns={VEHICLE_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={Truck}
                title="No vehicles match these filters"
                description={
                  search.search || search.type || search.status
                    ? "Try a different search, or clear the filters."
                    : "No vehicles yet. Register the first one."
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
                      New vehicle
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as VehiclesSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <VehicleFormSheet
        key={sheet.key}
        open={sheet.open}
        onOpenChange={sheet.onOpenChange}
        vehicle={editing}
      />
      {confirmationDialog}
    </div>
  )
}
