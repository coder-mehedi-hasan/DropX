import { useQuery } from "@tanstack/react-query"
import { MapPin } from "lucide-react"
import { useMemo } from "react"
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
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { listRiderLocations } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import type { RiderLocation } from "@/lib/types"
import { useQueryParams } from "@/lib/list-params"
import type { RiderLocationsSearch } from "@/routes/rider-locations-search-params"

const LOCATION_SORT_COLUMNS = ["recordedAt"] as const

/** Seven decimals is what the column stores; more digits than that is noise. */
const COORDINATE = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
})

function formatCoordinate(value: number): string {
  return Number.isFinite(value) ? COORDINATE.format(value) : "—"
}

/**
 * How long ago a fix was taken, which is the only thing that tells dispatch
 * whether a position is worth acting on. A fix older than the rider app's push
 * interval is effectively stale and says so rather than looking live.
 */
const STALE_AFTER_MINUTES = 15

function freshness(recordedAt: string, now: number): { label: string; stale: boolean } {
  const at = Date.parse(recordedAt)
  if (!Number.isFinite(at)) return { label: "Unknown", stale: true }

  const minutes = Math.max(0, Math.round((now - at) / 60_000))
  if (minutes < 1) return { label: "Just now", stale: false }
  if (minutes === 1) return { label: "1 min ago", stale: false }
  if (minutes < 60) return { label: `${minutes} min ago`, stale: minutes > STALE_AFTER_MINUTES }

  const hours = Math.round(minutes / 60)
  const label = hours === 1 ? "1 hour ago" : `${hours} hours ago`
  return { label, stale: true }
}

/**
 * Rider location history.
 *
 * This is a log, not a map: the trail is what the API holds, and reading it as
 * newest-first rows is honest about that. There is nothing to create or edit here
 * — a fix is the rider's to report, pushed from their own app — so the screen has
 * no sheet, no row actions and no create button.
 */
export function RiderLocationsListPage({ search }: { search: RiderLocationsSearch }) {
  const params = useMemo(
    () => ({
      page: search.page,
      limit: search.limit,
      sortBy: search.sortBy,
      sort: search.sort,
      riderId: search.riderId,
    }),
    [search.page, search.limit, search.sortBy, search.sort, search.riderId],
  )

  const query = useQuery({
    queryKey: ["rider-locations", params],
    queryFn: () => listRiderLocations(params),
  })

  const [, patch] = useQueryParams<RiderLocationsSearch>("/rider-locations", search)

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

  const columns = useMemo<DataTableColumn<RiderLocation>[]>(() => {
    // One clock read for the whole table, or every row rounds against a slightly
    // different "now" and the freshness column flickers between renders.
    const now = Date.now()

    return [
      {
        id: "riderId",
        header: "Rider",
        cell: (location) => (
          <span className="font-mono text-xs font-medium">{location.riderId}</span>
        ),
        value: (location) => location.riderId,
      },
      {
        id: "latitude",
        header: "Latitude",
        cell: (location) => (
          <span className="font-mono text-xs">{formatCoordinate(location.latitude)}</span>
        ),
        value: (location) => location.latitude,
      },
      {
        id: "longitude",
        header: "Longitude",
        cell: (location) => (
          <span className="font-mono text-xs">{formatCoordinate(location.longitude)}</span>
        ),
        value: (location) => location.longitude,
      },
      {
        id: "recordedAt",
        header: "Recorded",
        cell: (location) => {
          const { label, stale } = freshness(location.recordedAt, now)
          return (
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-sm">{formatDateTime(location.recordedAt)}</span>
              <Badge variant={stale ? "secondary" : "success"}>{label}</Badge>
            </div>
          )
        },
        value: (location) => location.recordedAt,
      },
    ]
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Fleet"
        title="Rider locations"
        description="Every position fix riders have pushed from the rider app, newest first."
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load rider locations"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-muted-foreground text-sm">
              Filter to one rider by pasting their rider id.
            </p>
            {search.riderId ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => patch({ riderId: "" })}
                aria-label="Clear the rider filter"
              >
                Clear filter
              </Button>
            ) : null}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(location) => location.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy}
            sort={search.sort}
            sortableColumns={LOCATION_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={MapPin}
                title={
                  search.riderId ? "No fixes recorded for this rider" : "No positions recorded yet"
                }
                description={
                  search.riderId
                    ? "This rider has not pushed a position, or the filter is on the wrong id."
                    : "Riders report where they are from the rider app while they have jobs. Nothing has arrived yet."
                }
                action={
                  search.riderId ? (
                    <Button variant="outline" onClick={() => patch({ riderId: "" })}>
                      Show all riders
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as RiderLocationsSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
