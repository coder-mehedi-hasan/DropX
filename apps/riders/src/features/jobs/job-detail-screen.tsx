import { useState } from "react"
import { ClipboardList, RefreshCw, Settings2 } from "lucide-react"
import { Button, EmptyState, Skeleton } from "@dropx/ui"

import { ErrorNotice, StaleDataNotice } from "../../components/feedback"
import { ActionBar, AppHeader, AppShell } from "../../components/layout/app-shell"
import { usePermission } from "../../lib/auth"
import { RIDER_PERMISSIONS } from "../../lib/permissions"
import { DeliveryActionSheet } from "../delivery/delivery-action-sheet"
import { ParcelSummary } from "../delivery/parcel-summary"
import { DeliveryProofsCard } from "../delivery/delivery-proofs-card"
import { useJob } from "./job-queries"
import { isTerminalStatus } from "./jobs.api"

/**
 * One job, end to end: where it goes, what is in it, what it is worth, and the
 * outcomes a rider may report at the door.
 */
export function JobDetailScreen({ jobId }: { jobId: string }) {
  const job = useJob(jobId)
  const canUpdate = usePermission(RIDER_PERMISSIONS.JOBS_UPDATE)
  const [sheetOpen, setSheetOpen] = useState(false)

  const refetch = () => {
    void job.refetch()
  }

  const isTerminal = job.data ? isTerminalStatus(job.data.delivery.status) : false

  return (
    <AppShell>
      <AppHeader
        title="Job"
        back
        actions={[
          {
            label: job.isFetching ? "Updating…" : "Refresh",
            icon: <RefreshCw className={job.isFetching ? "animate-spin" : undefined} />,
            onClick: refetch,
            busy: job.isFetching,
          },
        ]}
      />

      <main className="flex-1 space-y-3 px-3 py-4">
        {job.isError && !job.data ? <ErrorNotice error={job.error} onRetry={refetch} /> : null}
        {job.isError && job.data ? <StaleDataNotice onRetry={refetch} /> : null}

        {job.isPending ? (
          <div className="space-y-3">
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : null}

        {job.data ? (
          <>
            <ParcelSummary job={job.data} />
            <DeliveryProofsCard
              parcelId={job.data.parcel.id}
              trackingNumber={job.data.parcel.trackingNumber}
            />
          </>
        ) : null}

        {job.isError && !job.data ? (
          <EmptyState
            icon={ClipboardList}
            title="This job is not available"
            description="The API could not return this job for your rider account. Ask dispatch to confirm the assignment."
          />
        ) : null}
      </main>

      {job.data ? (
        <ActionBar>
          {canUpdate ? (
            <Button
              size="lg"
              className="tap-target w-full text-base"
              disabled={isTerminal}
              onClick={() => setSheetOpen(true)}
            >
              <Settings2 className="size-5" />
              {isTerminal ? "No further changes" : "Update status"}
            </Button>
          ) : (
            <Button size="lg" className="tap-target w-full text-base" disabled>
              Read only — needs rider.jobs.update
            </Button>
          )}
        </ActionBar>
      ) : null}

      {job.data ? (
        <DeliveryActionSheet
          parcelId={job.data.parcel.id}
          trackingNumber={job.data.parcel.trackingNumber}
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          onCompleted={() => {
            refetch()
          }}
        />
      ) : null}
    </AppShell>
  )
}
