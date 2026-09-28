import { createRoute } from "@tanstack/react-router"

import { JobListScreen } from "../features/jobs/job-list-screen"
import { DEFAULT_JOB_STATUS_FILTER, isJobStatusFilter } from "../features/jobs/jobs.api"
import { appLayoutRoute } from "./app-layout"

type JobsSearch = {
  status?: string
}

/**
 * The filter lives in the search string rather than in component state so a
 * rider's current list survives a refresh, a back gesture from a job, and a
 * shared link — and so the tab is a real URL a dispatcher can talk about.
 *
 * The key is omitted rather than defaulted in the URL, which keeps `/jobs` and
 * `/jobs?status=OUT_FOR_DELIVERY` the same list and lets a plain `<Link to="/jobs">`
 * typecheck without a `search` prop.
 */
export const jobsRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/jobs",
  validateSearch: (search: Record<string, unknown>): JobsSearch =>
    typeof search.status === "string" ? { status: search.status } : {},
  component: JobsRouteComponent,
})

function JobsRouteComponent() {
  const { status } = jobsRoute.useSearch()
  return <JobListScreen filter={isJobStatusFilter(status) ? status : DEFAULT_JOB_STATUS_FILTER} />
}
