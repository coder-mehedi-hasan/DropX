import { useNavigate } from "@tanstack/react-router"
import { ClipboardList, RefreshCw } from "lucide-react"
import { Button, EmptyState, Tabs, TabsList, TabsTrigger, cn } from "@dropx/ui"

import { ErrorNotice, StaleDataNotice } from "../../components/feedback"
import { AppHeader, AppShell } from "../../components/layout/app-shell"
import { useAuth } from "../../lib/auth"
import { RIDER_PERMISSIONS } from "../../lib/permissions"
import { useJobList } from "./job-queries"
import { JobCard, JobCardSkeleton } from "./job-card"
import {
  DEFAULT_JOB_STATUS_FILTER,
  JOB_STATUS_FILTER_LABELS,
  JOB_STATUS_FILTERS,
  isJobStatusFilter,
  type JobStatusFilter,
} from "./jobs.api"

const EMPTY_TITLES: Record<JobStatusFilter, string> = {
  ASSIGNED: "No jobs assigned to you",
  OUT_FOR_DELIVERY: "Nothing out for delivery",
  DELIVERED: "Nothing delivered yet",
  FAILED: "No failed deliveries",
  ALL: "No jobs yet",
}

export function JobListScreen({ filter }: { filter: JobStatusFilter }) {
  const { rider, can } = useAuth()
  const navigate = useNavigate()
  const jobs = useJobList(filter)
  const canViewJobs = can(RIDER_PERMISSIONS.JOBS_VIEW)

  const setFilter = (next: string) => {
    void navigate({
      to: "/jobs",
      search: { status: isJobStatusFilter(next) ? next : DEFAULT_JOB_STATUS_FILTER },
      replace: true,
    })
  }

  const refetch = () => {
    void jobs.refetch()
  }

  return (
    <AppShell>
      <AppHeader
        title="Today's jobs"
        subtitle={rider ? `Signed in as ${rider.name}` : undefined}
        actions={[
          {
            label: jobs.isFetching ? "Updating…" : "Refresh",
            icon: <RefreshCw className={cn(jobs.isFetching && "animate-spin")} />,
            onClick: refetch,
            busy: jobs.isFetching,
          },
        ]}
      />

      <main className="flex-1 space-y-4 px-3 py-4">
        {!canViewJobs ? (
          <EmptyState
            icon={ClipboardList}
            title="You cannot view jobs"
            description="Your account is missing the rider.jobs.view permission. Ask dispatch to grant it."
          />
        ) : (
          <>
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList className="grid h-auto w-full grid-cols-5">
                {JOB_STATUS_FILTERS.map((value) => (
                  <TabsTrigger key={value} value={value} className="min-h-11 px-1 text-xs">
                    {JOB_STATUS_FILTER_LABELS[value]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {jobs.isError ? <ErrorNotice error={jobs.error} onRetry={refetch} /> : null}
            {jobs.isError && jobs.data ? <StaleDataNotice onRetry={refetch} /> : null}

            {jobs.isPending ? (
              <div className="space-y-3">
                <JobCardSkeleton />
                <JobCardSkeleton />
                <JobCardSkeleton />
              </div>
            ) : null}

            {jobs.isSuccess && jobs.data.nodes.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={EMPTY_TITLES[filter]}
                description="Nothing is waiting for you in this list right now. Check the other tabs or refresh."
                action={
                  <Button variant="outline" size="lg" className="tap-target" onClick={refetch}>
                    <RefreshCw />
                    Refresh
                  </Button>
                }
              />
            ) : null}

            {jobs.data && jobs.data.nodes.length > 0 ? (
              <ul className="space-y-3">
                {jobs.data.nodes.map((job) => (
                  <li key={job.parcel.id}>
                    <JobCard job={job} />
                  </li>
                ))}
              </ul>
            ) : null}

            {jobs.data ? (
              <p className="text-muted-foreground text-center text-xs">
                {jobs.data.meta.totalCount} job{jobs.data.meta.totalCount === 1 ? "" : "s"} in this
                list
              </p>
            ) : null}
          </>
        )}
      </main>
    </AppShell>
  )
}
