import { useNavigate } from "@tanstack/react-router"
import { ArrowRight, ClipboardList, KeyRound, MapPinned, RefreshCw, Route } from "lucide-react"
import { Button, EmptyState, Tabs, TabsList, TabsTrigger, cn } from "@dropx/ui"

import { ErrorNotice, StaleDataNotice } from "../../components/feedback"
import { AppHeader, AppShell } from "../../components/layout/app-shell"
import { useAuth } from "../../lib/auth"
import { RIDER_PERMISSIONS } from "../../lib/permissions"
import { useJobList } from "./job-queries"
import { LocationPushStatus, useLocationPush } from "./location-push"
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
  // Dispatch watches the fleet while a rider works, so the push runs from the
  // jobs screen — the one they keep open all shift — rather than from a setting
  // nobody opens.
  const location = useLocationPush()

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
        actions={
          canViewJobs
            ? [
                {
                  label: jobs.isFetching ? "Updating…" : "Refresh",
                  icon: <RefreshCw className={cn(jobs.isFetching && "animate-spin")} />,
                  onClick: refetch,
                  busy: jobs.isFetching,
                },
              ]
            : undefined
        }
      />

      <main className="flex-1 space-y-4 px-4 py-5">
        {!canViewJobs ? (
          <section className="bg-card overflow-hidden rounded-[1.35rem] shadow-sm">
            <div className="bg-primary h-1.5" />
            <div className="px-5 pt-6 pb-7">
              <div className="bg-primary/10 text-primary grid size-12 place-items-center rounded-2xl">
                <KeyRound className="size-6" aria-hidden />
              </div>
              <p className="text-muted-foreground mt-6 text-xs font-semibold tracking-wide uppercase">
                Access required
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] text-balance">
                Your route is not available yet
              </h2>
              <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6 text-pretty">
                Dispatch needs to grant this account permission to view assigned jobs. Your sign-in
                is working; only route access is missing.
              </p>

              <div className="bg-muted/70 mt-6 rounded-xl px-4 py-3">
                <p className="text-muted-foreground text-xs font-medium">Permission needed</p>
                <p data-numeric className="mt-1 font-mono text-sm font-semibold">
                  rider.jobs.view
                </p>
              </div>

              <Button
                variant="secondary"
                size="lg"
                className="tap-target mt-5 w-full justify-between rounded-xl"
                onClick={() => void navigate({ to: "/profile" })}
              >
                Review rider access
                <ArrowRight aria-hidden />
              </Button>
            </div>
          </section>
        ) : (
          <>
            <section className="bg-foreground text-background relative overflow-hidden rounded-[1.35rem] px-5 py-5 shadow-lg">
              <div className="bg-primary/20 absolute -top-10 -right-8 size-32 rounded-full blur-2xl" />
              <div className="relative flex items-end justify-between gap-4">
                <div>
                  <p className="text-background/60 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
                    <Route className="text-primary size-4" aria-hidden />
                    Route overview
                  </p>
                  <p data-numeric className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">
                    {jobs.data?.meta.totalCount ?? "—"}
                  </p>
                  <p className="text-background/65 mt-1 text-sm">
                    {filter === "ALL" ? "Assigned route jobs" : JOB_STATUS_FILTER_LABELS[filter]}
                  </p>
                </div>
                <div className="bg-background/10 grid size-12 place-items-center rounded-2xl ring-1 ring-white/10">
                  <MapPinned className="text-primary size-6" aria-hidden />
                </div>
              </div>
            </section>

            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList className="rider-filter-tabs flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl p-1">
                {JOB_STATUS_FILTERS.map((value) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="min-h-10 flex-none rounded-lg px-3 text-xs"
                  >
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
              <ul className="space-y-4">
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

            <LocationPushStatus state={location.state} canPush={location.canPush} />
          </>
        )}
      </main>
    </AppShell>
  )
}
