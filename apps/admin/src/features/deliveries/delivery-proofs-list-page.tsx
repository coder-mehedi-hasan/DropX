import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FileCheck, ShieldCheck } from "lucide-react"
import { useMemo } from "react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  ServerDataTable,
  AppToast,
  type DataTableColumn,
} from "@dropx/ui"
import { PROOF_TYPES } from "@dropx/types"

import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listDeliveryProofs, verifyDeliveryProof } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import type { DeliveryProofRow } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { DeliveryProofsSearch } from "@/routes/delivery-proofs-search-params"

const PROOF_SORT_COLUMNS = ["createdAt", "type"] as const

const PROOF_TYPE_LABEL: Record<(typeof PROOF_TYPES)[number], string> = {
  SIGNATURE: "Signature",
  PHOTO: "Photo",
  OTP: "Receiver OTP",
  IDENTITY: "ID check",
}

/**
 * The proofs worklist. Viewing is `deliveries.view`; verifying is
 * `deliveries.manage` — the office confirms the artefact the rider filed,
 * and a rider never vouches for their own proof.
 */
export function DeliveryProofsListPage({ search }: { search: DeliveryProofsSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("deliveries.manage")

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy as DeliveryProofsSearch["sortBy"],
      sort: where.sort,
      search: where.search,
      type: where.type as DeliveryProofsSearch["type"],
      verified: where.verified as DeliveryProofsSearch["verified"],
      deliveryId: search.deliveryId,
    }),
    [
      where.page,
      where.limit,
      where.sortBy,
      where.sort,
      where.search,
      where.type,
      where.verified,
      search.deliveryId,
    ],
  )

  const query = useQuery({
    queryKey: ["delivery-proofs", params],
    queryFn: () => listDeliveryProofs(params),
  })

  const queryClient = useQueryClient()
  const verifyMutation = useMutation({
    mutationFn: (proofId: string) => verifyDeliveryProof(proofId),
    onSuccess: () => {
      AppToast.success("Proof verified")
      void queryClient.invalidateQueries({ queryKey: ["delivery-proofs"] })
    },
  })

  const [, patch] = useQueryParams<DeliveryProofsSearch>("/delivery-proofs", search)

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

  const columns = useMemo<DataTableColumn<DeliveryProofRow>[]>(
    () => [
      {
        id: "parcelTrackingNumber",
        header: "Parcel",
        cell: (proof) => <span className="font-mono text-xs">{proof.parcelTrackingNumber}</span>,
        value: (proof) => proof.parcelTrackingNumber,
      },
      {
        id: "type",
        header: "Type",
        cell: (proof) => <Badge variant="secondary">{PROOF_TYPE_LABEL[proof.type]}</Badge>,
        value: (proof) => proof.type,
      },
      {
        id: "riderName",
        header: "Rider",
        cell: (proof) => (
          <span className="text-sm">
            {proof.riderName}{" "}
            <span className="text-muted-foreground font-mono text-xs">
              {proof.riderEmployeeCode}
            </span>
          </span>
        ),
        value: (proof) => proof.riderName,
      },
      {
        id: "hubName",
        header: "Hub",
        cell: (proof) => <span className="text-sm">{proof.hubName}</span>,
        value: (proof) => proof.hubName,
      },
      {
        id: "attemptNo",
        header: "Attempt",
        cell: (proof) => <span className="font-mono text-xs">#{proof.attemptNo}</span>,
        value: (proof) => String(proof.attemptNo),
      },
      {
        id: "verifiedAt",
        header: "Verified",
        cell: (proof) =>
          proof.verifiedAt ? (
            <Badge variant="success">Verified</Badge>
          ) : (
            <Badge variant="warning">Awaiting review</Badge>
          ),
        value: (proof) => proof.verifiedAt ?? "",
      },
      {
        id: "createdAt",
        header: "Recorded",
        cell: (proof) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(proof.createdAt)}</span>
        ),
        value: (proof) => proof.createdAt,
      },
      {
        id: "actions",
        header: "",
        align: "end",
        cell: (proof) =>
          canManage && !proof.verifiedAt ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Verify proof ${proof.id}`}
              disabled={verifyMutation.isPending}
              onClick={() => verifyMutation.mutate(proof.id)}
            >
              <ShieldCheck />
              Verify
            </Button>
          ) : null,
      },
    ],
    [canManage, verifyMutation.isPending],
  )

  const filtered = Boolean(search.search || search.type || search.verified || search.deliveryId)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operations"
        title="Delivery proofs"
        description="What riders recorded at the door, and whether the office has confirmed it."
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load proofs"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search proofs"
                placeholder="Tracking number, rider, or hub"
              />
            </div>
            <ListFilterSelect
              className="w-44"
              label="Filter by type"
              allLabel="All types"
              value={search.type ?? ""}
              onChange={(value) => patch({ type: value || undefined })}
              options={PROOF_TYPES.map((type) => ({
                value: type,
                label: PROOF_TYPE_LABEL[type],
              }))}
            />
            <ListFilterSelect
              className="w-44"
              label="Filter by verification"
              allLabel="All"
              value={search.verified ?? ""}
              onChange={(value) =>
                patch({ verified: (value || undefined) as typeof search.verified })
              }
              options={[
                { value: "true", label: "Verified" },
                { value: "false", label: "Awaiting review" },
              ]}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(proof) => proof.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy}
            sort={search.sort}
            sortableColumns={PROOF_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={FileCheck}
                title="No proofs match these filters"
                description={
                  filtered
                    ? "Try a different search, or clear the filters."
                    : "Proofs appear here as riders file them at the door."
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as DeliveryProofsSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
