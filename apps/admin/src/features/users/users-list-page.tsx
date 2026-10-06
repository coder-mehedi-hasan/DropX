import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { KeyRound, Pencil, Plus, UserX, Users } from "lucide-react"
import { useMemo, useState } from "react"
import {
  AppToast,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  ServerDataTable,
  useConfirmation,
  useFormSheetState,
  type DataTableColumn,
} from "@dropx/ui"
import { USER_STATUSES } from "@dropx/types"
import { ListFilterSelect, ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { listUsers, setUserStatus } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import type { StaffUser, UserStatus } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { UsersSearch } from "@/routes/users-search-params"
import { UserFormSheet, UserResetPasswordSheet } from "./user-form-sheet"

const USER_SORT_COLUMNS = ["name", "email", "status", "createdAt"] as const

const STATUS_LABEL: Record<UserStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
}

const STATUS_BADGE: Record<UserStatus, "success" | "secondary" | "destructive"> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  SUSPENDED: "destructive",
}

export function UsersListPage({ search }: { search: UsersSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("users.manage")

  const sheet = useFormSheetState<string>()
  const resetSheet = useFormSheetState<string>()
  const [editing, setEditing] = useState<StaffUser | null>(null)
  const [resetting, setResetting] = useState<StaffUser | null>(null)
  const { confirm, confirmationDialog } = useConfirmation()

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy,
      sort: where.sort,
      search: where.search,
      status: where.status as UsersSearch["status"],
      branchId: where.branchId,
    }),
    [where.page, where.limit, where.sortBy, where.sort, where.search, where.status, where.branchId],
  )

  const query = useQuery({
    queryKey: ["users", params],
    queryFn: () => listUsers(params),
  })

  const [, patch] = useQueryParams<UsersSearch>("/users", search)

  const queryClient = useQueryClient()
  // Suspending is a 409 when it would strip the last active ADMIN — a real
  // answer the button must show, not a toast that vanishes, so the failure is
  // held here and rendered as a banner like the vehicle screen's.
  const [actionError, setActionError] = useState<unknown>(null)
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => setUserStatus(id, status),
    onMutate: () => setActionError(null),
    onSuccess: (saved) => {
      AppToast.success(`${saved.name} is now ${STATUS_LABEL[saved.status].toLowerCase()}`)
      void queryClient.invalidateQueries({ queryKey: ["users"] })
    },
    onError: (error) => setActionError(error),
  })

  async function askSuspend(user: StaffUser) {
    const ok = await confirm({
      title: `Suspend ${user.name}?`,
      description:
        "They can no longer sign in and their assigned work should be reassigned. The account and its history are kept.",
      confirmLabel: "Suspend",
    })
    if (ok) statusMutation.mutate({ id: user.id, status: "SUSPENDED" })
  }

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

  const columns = useMemo<DataTableColumn<StaffUser>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (user) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{user.name}</span>
            <span className="text-muted-foreground text-xs">{user.email}</span>
          </div>
        ),
        value: (user) => user.name,
      },
      {
        id: "roles",
        header: "Roles",
        cell: (user) =>
          user.roles.length === 0 ? (
            <span className="text-muted-foreground text-sm">—</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {user.roles.map((role) => (
                <Badge key={role.id} variant="secondary">
                  {role.name}
                </Badge>
              ))}
            </div>
          ),
        value: (user) => user.roles.map((role) => role.name).join(", "),
      },
      {
        id: "status",
        header: "Status",
        cell: (user) => (
          <Badge variant={STATUS_BADGE[user.status]}>{STATUS_LABEL[user.status]}</Badge>
        ),
        value: (user) => user.status,
      },
      {
        id: "branch",
        header: "Branch",
        cell: (user) => <span className="text-sm">{user.branchName ?? "All branches"}</span>,
        value: (user) => user.branchName ?? "",
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (user) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(user.createdAt)}</span>
        ),
        value: (user) => user.createdAt,
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: "",
              align: "end" as const,
              cell: (user: StaffUser) => (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Reset password for ${user.name}`}
                    onClick={() => {
                      setResetting(user)
                      resetSheet.openFor(user.id)
                    }}
                  >
                    <KeyRound />
                    Reset password
                  </Button>
                  {user.status === "SUSPENDED" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Activate ${user.name}`}
                      onClick={() => statusMutation.mutate({ id: user.id, status: "ACTIVE" })}
                    >
                      Activate
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Suspend ${user.name}`}
                      onClick={() => void askSuspend(user)}
                    >
                      <UserX />
                      Suspend
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit ${user.name}`}
                    onClick={() => {
                      setEditing(user)
                      sheet.openFor(user.id)
                    }}
                  >
                    <Pencil />
                    Edit
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    // Depend on the memoised callbacks, not on the component's render state.
    [canManage, confirm, sheet.openFor, resetSheet.openFor],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Organization"
        title="Staff users"
        description="Staff accounts, the roles they hold and the hubs they may work."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null)
                sheet.openNew()
              }}
            >
              <Plus />
              New account
            </Button>
          ) : null
        }
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load staff accounts"
        onDismiss={() => void query.refetch()}
      />

      <ServerError
        error={actionError}
        title="Could not change the account status"
        onDismiss={() => setActionError(null)}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search staff users"
                placeholder="Name, email or phone"
              />
            </div>
            <ListFilterSelect
              className="w-40"
              label="Filter by status"
              allLabel="All statuses"
              value={search.status ?? ""}
              onChange={(value) => patch({ status: value || undefined })}
              options={USER_STATUSES.map((status) => ({
                value: status,
                label: STATUS_LABEL[status],
              }))}
            />
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(user) => user.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof USER_SORT_COLUMNS)[number] | undefined}
            sort={search.sort}
            sortableColumns={USER_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={Users}
                title="No staff accounts match these filters"
                description={
                  search.search || search.status
                    ? "Try a different search, or clear the filters."
                    : "No staff accounts yet. Add the first one."
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
                      New account
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as UsersSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <UserFormSheet
        key={sheet.key}
        open={sheet.open}
        onOpenChange={sheet.onOpenChange}
        user={editing}
      />
      <UserResetPasswordSheet
        key={resetSheet.key}
        open={resetSheet.open}
        onOpenChange={resetSheet.onOpenChange}
        user={resetting}
      />
      {confirmationDialog}
    </div>
  )
}
