import { useQuery } from "@tanstack/react-query"
import { MapPin, Pencil, Plus } from "lucide-react"
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
import { listServiceZones } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import type { ServiceZone } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { ServiceZonesSearch } from "@/routes/locations-search-params"
import { LocationTabs } from "./location-tabs"
import { useCityOptions } from "./location-options"
import { ServiceZoneFormSheet } from "./service-zone-form-sheet"

const ZONE_SORT_COLUMNS = ["name", "code", "status", "createdAt"] as const

export function ServiceZonesListPage({ search }: { search: ServiceZonesSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("locations.manage")

  const sheet = useFormSheetState<string>()
  const [editing, setEditing] = useState<ServiceZone | null>(null)

  const cityOptions = useCityOptions()
  const cityById = useMemo(
    () => new Map(cityOptions.data?.nodes.map((city) => [city.id, city.name])),
    [cityOptions.data],
  )

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy,
      sort: where.sort,
      search: where.search,
      status: where.status as ServiceZonesSearch["status"],
      cityId: where.cityId ?? "",
    }),
    [where.page, where.limit, where.sortBy, where.sort, where.search, where.status, where.cityId],
  )

  const query = useQuery({
    queryKey: ["location-zones", params],
    queryFn: () => listServiceZones(params),
  })

  const [, patch] = useQueryParams<ServiceZonesSearch>("/locations/zones", search)

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

  const columns = useMemo<DataTableColumn<ServiceZone>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (zone) => <span className="font-medium">{zone.name}</span>,
        value: (zone) => zone.name,
      },
      {
        id: "city",
        header: "City",
        cell: (zone) => (
          <span className="text-muted-foreground">{cityById.get(zone.cityId) ?? "—"}</span>
        ),
        value: (zone) => cityById.get(zone.cityId) ?? "",
      },
      {
        id: "code",
        header: "Code",
        cell: (zone) => <span className="font-mono text-xs">{zone.code}</span>,
        value: (zone) => zone.code,
      },
      {
        id: "status",
        header: "Status",
        cell: (zone) =>
          zone.status === "ACTIVE" ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
        value: (zone) => zone.status,
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (zone) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(zone.createdAt)}</span>
        ),
        value: (zone) => zone.createdAt,
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: "",
              align: "end" as const,
              cell: (zone: ServiceZone) => (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${zone.name}`}
                  onClick={() => {
                    setEditing(zone)
                    sheet.openFor(zone.id)
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
    [cityById, canManage, sheet.openFor],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Network"
        title="Zones"
        description="A district inside a city. Pickup, delivery and pricing all key on a zone."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null)
                sheet.openNew()
              }}
            >
              <Plus />
              New zone
            </Button>
          ) : null
        }
      />

      <LocationTabs active="zones" />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load zones"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search zones"
                placeholder="Name or code"
              />
            </div>
            <ListFilterSelect
              className="w-44"
              label="Filter by city"
              allLabel="All cities"
              value={search.cityId ?? ""}
              onChange={(value) => patch({ cityId: value || undefined })}
              options={(cityOptions.data?.nodes ?? []).map((city) => ({
                value: city.id,
                label: city.name,
              }))}
            />
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
            rowId={(zone) => zone.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof ZONE_SORT_COLUMNS)[number] | undefined}
            sort={search.sort}
            sortableColumns={ZONE_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={MapPin}
                title="No zones match these filters"
                description={
                  search.search || search.status || search.cityId
                    ? "Try a different search, or clear the filters."
                    : "No zones yet. Create the first one."
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
                      New zone
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as ServiceZonesSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <ServiceZoneFormSheet
        key={sheet.key}
        open={sheet.open}
        onOpenChange={sheet.onOpenChange}
        zone={editing}
      />
    </div>
  )
}
