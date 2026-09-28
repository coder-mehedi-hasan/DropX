import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import {
  Building2,
  KeyRound,
  MapPinned,
  PackagePlus,
  PackageSearch,
  Rocket,
  Truck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  Skeleton,
} from "@dropx/ui"
import type { ReactNode } from "react"

import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listParcels } from "@/lib/endpoints"
import { formatNumber } from "@/lib/format"
import { DEFAULT_PARCELS_SEARCH } from "@/lib/parcels"
import type { PermissionKey } from "@/lib/permissions"

/**
 * The dashboard.
 *
 * There is no stats endpoint in `apps/api`, so nothing here is invented: each
 * card is either a real read (`GET /parcels` for the in-scope count) or a fact
 * `/auth/me` already returned. When a role has no admin permissions at all,
 * the screen says so instead of showing an empty grid of zeros.
 */
export function DashboardPage() {
  const { user, displayName, adminPermissions, hasPermission, hasAnyPermission } = useAuth()
  const canReadParcels = hasPermission("parcels.view")
  const canCreateParcels = hasPermission("parcels.create")

  const parcelCount = useQuery({
    queryKey: ["parcels", "count", user?.branchId ?? "company", user?.hubIds.join(",") ?? ""],
    queryFn: ({ signal }) =>
      listParcels({ page: 1, limit: 1, sortBy: "createdAt", sort: "desc" }, signal),
    enabled: canReadParcels,
    staleTime: 30_000,
  })

  const nothingToDo = adminPermissions.length === 0

  if (nothingToDo) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Overview"
          title={`Welcome, ${displayName || "there"}`}
          description="Your DropX admin overview."
        />
        <EmptyState
          icon={KeyRound}
          title="No admin permissions yet"
          description="Your account is active but no role grants an admin permission key. An administrator has to assign an admin role (for example HUB_OPERATOR or DISPATCHER) before any operations screen becomes available."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Overview"
        title={`Welcome, ${displayName || "there"}`}
        description="Your DropX admin overview. Everything here reflects the live scope your roles allow."
      />

      <ServerError
        error={parcelCount.isError ? parcelCount.error : null}
        title="Unable to load the parcel count"
        onDismiss={() => void parcelCount.refetch()}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Parcels in your scope"
          icon={PackageSearch}
          value={
            canReadParcels
              ? parcelCount.isPending
                ? null
                : formatNumber(parcelCount.data?.meta.totalCount ?? 0)
              : "—"
          }
          description={
            canReadParcels
              ? "Company-wide, your branch, or your hubs — whichever your roles allow."
              : "Requires parcels.view."
          }
          hidden={!canReadParcels}
        />
        <SummaryCard
          title="Roles"
          icon={KeyRound}
          value={String(user?.roles.length ?? 0)}
          description={
            user?.roles.length ? user.roles.join(" · ") : "No roles assigned to this account."
          }
        />
        <SummaryCard
          title="Access scope"
          icon={MapPinned}
          value={scopeLabel(user?.roles ?? [], user?.branchId ?? null, user?.hubIds.length ?? 0)}
          description={
            user?.branchId
              ? `Branch #${user.branchId}`
              : user?.hubIds.length
                ? `${user.hubIds.length} hub${user.hubIds.length === 1 ? "" : "s"} via user_hubs`
                : "All branches and hubs"
          }
        />
        <SummaryCard
          title="Permissions granted"
          icon={Building2}
          value={String(adminPermissions.length)}
          description="Admin keys attached to your roles. Rider-only keys are not included."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="gap-4 py-4">
          <CardHeader className="px-4">
            <CardTitle>Getting started</CardTitle>
            <CardDescription>
              The quickest routes from a fresh account to useful work.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4">
            <ol className="space-y-3 text-sm">
              <Step
                index={1}
                done={canReadParcels}
                title="Find a parcel"
                body="Search the parcel list by tracking number, receiver name or phone, then filter by status."
                action={
                  canReadParcels ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/parcels" search={DEFAULT_PARCELS_SEARCH}>
                        <PackageSearch />
                        Open parcels
                      </Link>
                    </Button>
                  ) : null
                }
              />
              <Step
                index={2}
                done={canCreateParcels}
                title="Book on a customer's behalf"
                body="Staff booking names a sender and receiver customer; the API calculates the delivery fee."
                action={
                  canCreateParcels ? (
                    <Button asChild size="sm" variant="outline">
                      <Link to="/parcels" search={DEFAULT_PARCELS_SEARCH}>
                        <PackagePlus />
                        Book a parcel
                      </Link>
                    </Button>
                  ) : null
                }
              />
              <Step
                index={3}
                done={hasAnyPermission(["hubs.view", "routes.view", "riders.view"])}
                title="Network and riders"
                body="Hub, route and rider administration lives behind hubs.view, routes.view and riders.view."
                action={<Badge variant="secondary">Coming next</Badge>}
              />
            </ol>
          </CardContent>
        </Card>

        <Card className="gap-4 py-4">
          <CardHeader className="px-4">
            <CardTitle>Where to go next</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <ul className="space-y-2 text-sm">
              <Shortcut to="/parcels" permission="parcels.view" icon={PackageSearch}>
                <strong>Parcels</strong> — the list, detail view, status changes and cancellations.
              </Shortcut>
              <Shortcut to="/tracking" permission="parcels.view" icon={Truck}>
                <strong>Tracking</strong> — public lookup by tracking number, with the full event
                timeline.
              </Shortcut>
            </ul>
          </CardContent>
          <CardFooter className="px-4">
            <p className="text-muted-foreground text-xs">
              A summary endpoint is not implemented in the API yet, so this page reports only what
              the parcel list and your session actually know.
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

function scopeLabel(roles: string[], branchId: string | null, hubCount: number): string {
  if (roles.includes("ADMIN")) return "Company-wide"
  if (branchId) return "Branch scoped"
  if (hubCount > 0) return "Hub scoped"
  return "Unscoped"
}

function SummaryCard({
  title,
  description,
  value,
  icon: Icon,
  hidden,
}: {
  title: string
  description: string
  value: string | null
  icon: LucideIcon
  hidden?: boolean
}) {
  if (hidden) return null

  return (
    <Card className="gap-2 py-4 transition-colors hover:border-primary/30">
      <CardHeader className="px-4">
        <CardTitle className="text-muted-foreground flex items-center gap-2 text-xs font-semibold tracking-wide uppercase">
          <Icon className="text-primary size-3.5" aria-hidden />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4">
        {value === null ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        )}
        <p className="text-muted-foreground mt-1 text-xs">{description}</p>
      </CardContent>
    </Card>
  )
}

function Step({
  index,
  title,
  body,
  done,
  action,
}: {
  index: number
  title: string
  body: string
  done: boolean
  action?: ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span
        className={
          done
            ? "bg-success text-success-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            : "bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
        }
      >
        {done ? <Rocket className="size-3.5" /> : index}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground mt-0.5">{body}</p>
      </div>
      {action}
    </li>
  )
}

function Shortcut({
  to,
  permission,
  icon: Icon,
  children,
}: {
  to: "/parcels" | "/tracking"
  permission: PermissionKey
  icon: LucideIcon
  children: ReactNode
}) {
  const { hasPermission } = useAuth()
  if (!hasPermission(permission)) return null

  return (
    <li>
      <Link
        to={to}
        search={to === "/parcels" ? DEFAULT_PARCELS_SEARCH : undefined}
        className="hover:bg-accent hover:text-accent-foreground -mx-2 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors"
      >
        <Icon className="text-muted-foreground size-4" />
        {children}
      </Link>
    </li>
  )
}
