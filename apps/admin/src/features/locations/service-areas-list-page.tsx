import { useQuery } from "@tanstack/react-query"
import { Pencil, Plus, MapPinned } from "lucide-react"
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
import { listServiceAreas } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import type { ServiceArea } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { ServiceAreasSearch } from "@/routes/locations-search-params"
import { LocationTabs } from "./location-tabs"
import { useCityOptions, useServiceZoneOptions } from "./location-options"
import { ServiceAreaFormSheet } from "./service-area-form-sheet"

const AREA_SORT_COLUMNS = ["name", "code", "status", "createdAt"] as const

export function ServiceAreasListPage({ search }: { search: ServiceAreasSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("locations.manage")

  const sheet = useFormSheetState<string>()
  const [editing, setEditing] = useState<ServiceArea | null>(null)

  const cityOptions = useCityOptions()
  const cityById = useMemo(
    () => new Map(cityOptions.data?.nodes.map((city) => [city.id, city.name])),
    [cityOptions.data],
  )
  const zoneOptions = useServiceZoneOptions(search.cityId || undefined)
  const zoneOptionsByCity = useMemo(() => {
    const map = new Map<string, string>()
    for (const zone of zoneOptions.data?.nodes ?? []) {
      map.set(zone.id, `${cityById.get(zone.cityId) ?? ""} — ${zone.name}`.replace(/^ — /, ""))
    }
    return map
  }, [zoneOptions.data, cityById])

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy,
      sort: where.sort,
      search: where.search,
      status: where.status as ServiceAreasSearch["status"],
      zoneId: where.zoneId ?? "",
    }),
    [where.page, where.limit, where.sortBy, where.sort, where.search, where.status, where.zoneId],
  )

  const query = useQuery({
    queryKey: ["location-areas", params],
    queryFn: () => listServiceAreas(params),
  })

  const [, patch] = useQueryParams<ServiceAreasSearch>("/locations/areas", search)

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

  const columns = useMemo<DataTableColumn<ServiceArea>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (area) => <span className="font-medium">{area.name}</span>,
        value: (area) => area.name,
      },
      {
        id: "zone",
        header: "Zone",
        cell: (area) => (
          <span className="text-muted-foreground">{zoneOptionsByCity.get(area.zoneId) ?? "—"}</span>
        ),
        value: (area) => zoneOptionsByCity.get(area.zoneId) ?? "",
      },
      {
        id: "code",
        header: "Code",
        cell: (area) => <span className="font-mono text-xs">{area.code}</span>,
        value: (area) => area.code,
      },
      {
        id: "status",
        header: "Status",
        cell: (area) =>
          area.status === "ACTIVE" ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
        value: (area) => area.status,
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (area) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(area.createdAt)}</span>
        ),
        value: (area) => area.createdAt,
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: "",
              align: "end" as const,
              cell: (area: ServiceArea) => (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${area.name}`}
                  onClick={() => {
                    setEditing(area)
                    sheet.openFor(area.id)
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
    [zoneOptionsByCity, canManage, sheet.openFor],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Network"
        title="Areas"
        description="The finest addressable place. A booking's street address hangs off an area."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null)
                sheet.openNew()
              }}
            >
              <Plus />
              New area
            </Button>
          ) : null
        }
      />

      <LocationTabs active="areas" />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load areas"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search areas"
                placeholder="Name or code"
              />
            </div>
            <ListFilterSelect
              className="w-44"
              label="Filter by city"
              allLabel="All cities"
              value={search.cityId ?? ""}
              onChange={(value) => {
                patch({ cityId: value || undefined, zoneId: undefined })
              }}
              options={(cityOptions.data?.nodes ?? []).map((city) => ({
                value: city.id,
                label: city.name,
              }))}
            />
            <ListFilterSelect
              className="w-48"
              label="Filter by zone"
              allLabel="All zones"
              value={search.zoneId ?? ""}
              onChange={(value) => patch({ zoneId: value || undefined })}
              options={(zoneOptions.data?.nodes ?? []).map((zone) => ({
                value: zone.id,
                label: zoneOptionsByCity.get(zone.id) ?? zone.name,
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
            rowId={(area) => area.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof AREA_SORT_COLUMNS)[number] | undefined}
            sort={search.sort}
            sortableColumns={AREA_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={MapPinned}
                title="No areas match these filters"
                description={
                  search.search || search.status || search.zoneId
                    ? "Try a different search, or clear the filters."
                    : "No areas yet. Create the first one."
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
                      New area
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as ServiceAreasSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <ServiceAreaFormSheet
        key={sheet.key}
        open={sheet.open}
        onOpenChange={sheet.onOpenChange}
        area={editing}
      />
    </div>
  )
}
