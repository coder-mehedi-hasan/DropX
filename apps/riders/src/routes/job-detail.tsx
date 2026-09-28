import { createRoute } from "@tanstack/react-router"

import { JobDetailScreen } from "../features/jobs/job-detail-screen"
import { appLayoutRoute } from "./app-layout"

export const jobDetailRoute = createRoute({
  getParentRoute: () => appLayoutRoute,
  path: "/jobs/$jobId",
  component: JobDetailRouteComponent,
})

function JobDetailRouteComponent() {
  const { jobId } = jobDetailRoute.useParams()
  return <JobDetailScreen jobId={jobId} />
}
