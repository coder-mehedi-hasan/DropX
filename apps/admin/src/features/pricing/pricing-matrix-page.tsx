import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowRight, Ban, Pencil, Plus, RotateCcw, Settings2, Unplug } from "lucide-react"
import { Fragment, useMemo, useState } from "react"
import {
  AppToast,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useFormSheetState,
} from "@dropx/ui"
import { RECORD_STATUSES } from "@dropx/types"
import { ListFilterSelect } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listPricingLanes, updatePricingLane, updatePricingSlab } from "@/lib/endpoints"
import { formatMoney } from "@/lib/format"
import type { PricingLaneWithSlabs, PricingSlab } from "@/lib/types"
import { useQueryParams } from "@/lib/list-params"
import type { PricingLanesSearch } from "@/routes/pricing-lanes-search-params"
import { deliveryTypeLabel, formatGrams, pickupTypeLabel } from "./pricing-labels"
import { SlabFormSheet } from "./slab-form-sheet"
import { CodSettingsSheet } from "./cod-settings-sheet"

/** The COD figures the matrix currently runs on — read off the first slab, which
 *  the server keeps equal across bands unless a band was edited by hand. */
const FALLBACK_COD = { codPercentage: 1.5, codFixedFee: 20 } as const

export function PricingMatrixPage({ search }: { search: PricingLanesSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("pricing.manage")

  const queryClient = useQueryClient()
  const slabSheet = useFormSheetState<string>()
  const codSheet = useFormSheetState<string>()
  const [slabTarget, setSlabTarget] = useState<{ laneId: string; slab: PricingSlab | null } | null>(
    null,
  )

  const params = useMemo(
    () => ({
      page: search.page,
      limit: search.limit,
      sortBy: search.sortBy,
      sort: search.sort,
      status: search.status,
    }),
    [search.page, search.limit, search.sortBy, search.sort, search.status],
  )

  const query = useQuery({
    queryKey: ["pricing-lanes", params],
    queryFn: () => listPricingLanes(params),
  })

  const [, patch] = useQueryParams<PricingLanesSearch>("/pricing/matrix", search)

  const lanes = query.data?.nodes ?? []
  const [firstSlab] = lanes.flatMap((lane) => lane.slabs)
  const codDefaults = firstSlab
    ? { codPercentage: firstSlab.codPercentage, codFixedFee: firstSlab.codFixedFee }
    : FALLBACK_COD

  const toggleLane = useMutation({
    mutationFn: (lane: PricingLaneWithSlabs) =>
      updatePricingLane(lane.id, {
        status: lane.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      }),
    onSuccess: (saved) => {
      AppToast.success(saved.status === "ACTIVE" ? "Lane restored" : "Lane deactivated")
      void queryClient.invalidateQueries({ queryKey: ["pricing"] })
    },
  })

  const toggleSlab = useMutation({
    mutationFn: (slab: PricingSlab) =>
      updatePricingSlab(slab.id, {
        status: slab.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      }),
    onSuccess: (saved) => {
      AppToast.success(saved.status === "ACTIVE" ? "Band restored" : "Band deactivated")
      void queryClient.invalidateQueries({ queryKey: ["pricing"] })
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Pricing"
        title="Pricing matrix"
        description="One row per pickup-to-delivery lane. Weight bands hang off a lane."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                codSheet.openNew()
              }}
            >
              <Settings2 />
              COD settings
            </Button>
          ) : null
        }
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load pricing lanes"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <ListFilterSelect
              className="w-40"
              label="Filter by status"
              allLabel="All lanes"
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bands</TableHead>
                <TableHead>Base fee</TableHead>
                <TableHead>Extra / kg</TableHead>
                <TableHead>COD</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isPending ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    Loading lanes…
                  </TableCell>
                </TableRow>
              ) : lanes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8">
                    <EmptyState
                      icon={Unplug}
                      title="No lanes match these filters"
                      description={
                        search.status
                          ? "Clear the filter to see the whole matrix."
                          : "No lanes were seeded. Re-run the database seed."
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                lanes.map((lane) => (
                  <Fragment key={lane.id}>
                    <TableRow className="bg-muted/40">
                      <TableCell colSpan={4} className="font-medium">
                        <span className="flex items-center gap-2">
                          <Badge variant="secondary">{lane.pickupType}</Badge>
                          <ArrowRight className="text-muted-foreground size-3.5" />
                          <Badge variant="secondary">{lane.deliveryType}</Badge>
                          {lane.sameCity ? <Badge variant="outline">Same city only</Badge> : null}
                        </span>
                        <span className="text-muted-foreground mt-1 block text-xs font-normal">
                          {pickupTypeLabel(lane.pickupType)} →{" "}
                          {deliveryTypeLabel(lane.deliveryType)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={lane.status === "ACTIVE" ? "success" : "secondary"}>
                          {lane.status === "ACTIVE" ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canManage ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={toggleLane.isPending}
                              aria-label={
                                lane.status === "ACTIVE"
                                  ? `Deactivate ${lane.pickupType} to ${lane.deliveryType}`
                                  : `Restore ${lane.pickupType} to ${lane.deliveryType}`
                              }
                              onClick={() => void toggleLane.mutateAsync(lane)}
                            >
                              {lane.status === "ACTIVE" ? <Ban /> : <RotateCcw />}
                              {lane.status === "ACTIVE" ? "Deactivate" : "Restore"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSlabTarget({ laneId: lane.id, slab: null })
                                slabSheet.openFor(lane.id)
                              }}
                            >
                              <Plus />
                              Bands
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>

                    {lane.slabs.map((slab) => (
                      <TableRow
                        key={slab.id}
                        className={slab.status === "ACTIVE" ? "" : "opacity-60"}
                      >
                        <TableCell className="font-mono text-xs">
                          {formatGrams(slab.minWeightGrams)} – {formatGrams(slab.maxWeightGrams)}
                        </TableCell>
                        <TableCell>{formatMoney(slab.baseFee)}</TableCell>
                        <TableCell>
                          {slab.extraKgFee > 0 ? `${formatMoney(slab.extraKgFee)}/kg` : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {slab.codPercentage}% + {formatMoney(slab.codFixedFee)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={slab.status === "ACTIVE" ? "success" : "secondary"}>
                            {slab.status === "ACTIVE" ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {canManage ? (
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Edit band for ${lane.pickupType} to ${lane.deliveryType}`}
                                onClick={() => {
                                  setSlabTarget({ laneId: lane.id, slab })
                                  slabSheet.openFor(slab.id)
                                }}
                              >
                                <Pencil />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={toggleSlab.isPending}
                                aria-label={
                                  slab.status === "ACTIVE" ? "Deactivate band" : "Restore band"
                                }
                                onClick={() => void toggleSlab.mutateAsync(slab)}
                              >
                                {slab.status === "ACTIVE" ? <Ban /> : <RotateCcw />}
                                {slab.status === "ACTIVE" ? "Deactivate" : "Restore"}
                              </Button>
                            </div>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <SlabFormSheet
        key={slabSheet.key}
        open={slabSheet.open}
        onOpenChange={slabSheet.onOpenChange}
        laneId={slabTarget?.laneId ?? ""}
        slab={slabTarget?.slab ?? null}
      />

      <CodSettingsSheet
        key={codSheet.key}
        open={codSheet.open}
        onOpenChange={codSheet.onOpenChange}
        defaults={codDefaults}
      />
    </div>
  )
}
