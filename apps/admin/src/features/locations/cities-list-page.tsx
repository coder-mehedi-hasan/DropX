import { useQuery } from "@tanstack/react-query"
import { Building, Pencil, Plus } from "lucide-react"
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
import { LOCATION_SERVICE_TYPES, RECORD_STATUSES } from "@dropx/types"
import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listServiceCities } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import type { ServiceCity } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { ServiceCitiesSearch } from "@/routes/locations-search-params"
import { LocationTabs } from "./location-tabs"
import { serviceTypeLabel } from "./labels"
import { CityFormSheet } from "./city-form-sheet"

const CITY_SORT_COLUMNS = ["name", "code", "serviceType", "status", "createdAt"] as const

export function CitiesListPage({ search }: { search: ServiceCitiesSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("locations.manage")

  const sheet = useFormSheetState<string>()
  const [editing, setEditing] = useState<ServiceCity | null>(null)

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy,
      sort: where.sort,
      search: where.search,
      status: where.status as ServiceCitiesSearch["status"],
      serviceType: where.serviceType as ServiceCitiesSearch["serviceType"],
    }),
    [
      where.page,
      where.limit,
      where.sortBy,
      where.sort,
      where.search,
      where.status,
      where.serviceType,
    ],
  )

  const query = useQuery({
    queryKey: ["location-cities", params],
    queryFn: () => listServiceCities(params),
  })

  const [, patch] = useQueryParams<ServiceCitiesSearch>("/locations/cities", search)

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

  const columns = useMemo<DataTableColumn<ServiceCity>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (city) => <span className="font-medium">{city.name}</span>,
        value: (city) => city.name,
      },
      {
        id: "serviceType",
        header: "Service",
        cell: (city) => (
          <span className="text-muted-foreground">{serviceTypeLabel(city.serviceType)}</span>
        ),
        value: (city) => city.serviceType,
      },
      {
        id: "code",
        header: "Code",
        cell: (city) => <span className="font-mono text-xs">{city.code}</span>,
        value: (city) => city.code,
      },
      {
        id: "status",
        header: "Status",
        cell: (city) =>
          city.status === "ACTIVE" ? (
            <Badge variant="success">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
        value: (city) => city.status,
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (city) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(city.createdAt)}</span>
        ),
        value: (city) => city.createdAt,
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: "",
              align: "end" as const,
              cell: (city: ServiceCity) => (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Edit ${city.name}`}
                  onClick={() => {
                    setEditing(city)
                    sheet.openFor(city.id)
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
        eyebrow="Network"
        title="Cities"
        description="The top level of the service territory. Zones hang off a city."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null)
                sheet.openNew()
              }}
            >
              <Plus />
              New city
            </Button>
          ) : null
        }
      />

      <LocationTabs active="cities" />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load cities"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search cities"
                placeholder="Name or code"
              />
            </div>
            <ListFilterSelect
              className="w-44"
              label="Filter by service"
              allLabel="All services"
              value={search.serviceType ?? ""}
              onChange={(value) => patch({ serviceType: value || undefined })}
              options={LOCATION_SERVICE_TYPES.map((value) => ({
                value,
                label: `${value} — ${serviceTypeLabel(value)}`,
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
            rowId={(city) => city.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof CITY_SORT_COLUMNS)[number] | undefined}
            sort={search.sort}
            sortableColumns={CITY_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={Building}
                title="No cities match these filters"
                description={
                  search.search || search.status || search.serviceType
                    ? "Try a different search, or clear the filters."
                    : "No cities yet. Create the first one."
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
                      New city
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as ServiceCitiesSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <CityFormSheet
        key={sheet.key}
        open={sheet.open}
        onOpenChange={sheet.onOpenChange}
        city={editing}
      />
    </div>
  )
}
