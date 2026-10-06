import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus, ShieldCheck } from "lucide-react"
import { useMemo, useState } from "react"
import { z } from "zod"
import {
  AppToast,
  BoundFormField,
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  ServerDataTable,
  useFormSheetState,
  type DataTableColumn,
} from "@dropx/ui"
import { FormSheet } from "@/components/form-sheet"
import { ListSearchBar } from "@/components/list-search-bar"
import { PageHeader } from "@/components/page-parts"
import { ServerError } from "@/components/server-error"
import { useAuth } from "@/lib/auth"
import { createRole, listRoles } from "@/lib/endpoints"
import { formatDateTime } from "@/lib/format"
import { createRoleSchema, type CreateRoleBody, type RoleOption } from "@/lib/types"
import { usePaginatedListWhere, useQueryParams } from "@/lib/list-params"
import type { RolesSearch } from "@/routes/roles-search-params"
import { PermissionMatrixSheet } from "./permission-matrix-sheet"

const ROLE_SORT_COLUMNS = ["name", "createdAt"] as const

const BLANK: z.infer<typeof createRoleSchema> = { name: "", description: "" }

export function RolesListPage({ search }: { search: RolesSearch }) {
  const { hasPermission } = useAuth()
  const canManage = hasPermission("roles.manage")

  const createSheet = useFormSheetState<string>()
  const matrixSheet = useFormSheetState<string>()
  const [editing, setEditing] = useState<RoleOption | null>(null)

  const where = usePaginatedListWhere(search)
  const params = useMemo(
    () => ({
      page: where.page,
      limit: where.limit,
      sortBy: where.sortBy,
      sort: where.sort,
      search: where.search,
    }),
    [where.page, where.limit, where.sortBy, where.sort, where.search],
  )

  const query = useQuery({
    queryKey: ["roles", params],
    queryFn: () => listRoles(params),
  })

  const [, patch] = useQueryParams<RolesSearch>("/roles", search)

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

  const columns = useMemo<DataTableColumn<RoleOption>[]>(
    () => [
      {
        id: "name",
        header: "Name",
        cell: (role) => (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{role.name}</span>
            {role.description ? (
              <span className="text-muted-foreground text-xs">{role.description}</span>
            ) : null}
          </div>
        ),
        value: (role) => role.name,
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (role) => (
          <span className="text-muted-foreground text-sm">{formatDateTime(role.createdAt)}</span>
        ),
        value: (role) => role.createdAt,
      },
      ...(canManage
        ? [
            {
              id: "actions",
              header: "",
              align: "end" as const,
              cell: (role: RoleOption) => (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Edit permissions for ${role.name}`}
                    onClick={() => {
                      setEditing(role)
                      matrixSheet.openFor(role.id)
                    }}
                  >
                    <ShieldCheck />
                    Permissions
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ],
    [canManage, matrixSheet.openFor],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Organization"
        title="Roles"
        description="Staff roles and the permission keys they grant — what each kind of account may do."
        actions={
          canManage ? (
            <Button
              onClick={() => {
                setEditing(null)
                createSheet.openNew()
              }}
            >
              <Plus />
              New role
            </Button>
          ) : null
        }
      />

      <ServerError
        error={query.isError ? query.error : null}
        title="Unable to load roles"
        onDismiss={() => void query.refetch()}
      />

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-56 flex-1">
              <ListSearchBar
                value={search.search}
                onChange={(value) => patch({ search: value })}
                label="Search roles"
                placeholder="Name or description"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ServerDataTable
            rowId={(role) => role.id}
            data={nodes}
            columns={columns}
            meta={serverMeta}
            sortBy={search.sortBy as (typeof ROLE_SORT_COLUMNS)[number] | undefined}
            sort={search.sort}
            sortableColumns={ROLE_SORT_COLUMNS}
            loading={query.isPending}
            emptyState={
              <EmptyState
                icon={ShieldCheck}
                title="No roles match this search"
                description={
                  search.search
                    ? "Try a different search."
                    : "Roles are seeded with the database — run bun run db:seed."
                }
                action={
                  canManage ? (
                    <Button
                      onClick={() => {
                        setEditing(null)
                        createSheet.openNew()
                      }}
                    >
                      <Plus />
                      New role
                    </Button>
                  ) : null
                }
              />
            }
            onPageChange={(page) => patch({ page }, { keepPage: true })}
            onPageSizeChange={(limit) => patch({ limit })}
            onSortChange={(sortBy, sort) =>
              patch({ sortBy: sortBy as RolesSearch["sortBy"], sort })
            }
          />
        </CardContent>
      </Card>

      <RoleCreateSheet
        key={createSheet.key}
        open={createSheet.open}
        onOpenChange={createSheet.onOpenChange}
      />
      <PermissionMatrixSheet
        key={matrixSheet.key}
        open={matrixSheet.open}
        onOpenChange={matrixSheet.onOpenChange}
        role={editing}
      />
    </div>
  )
}

/**
 * Name and description only — a role is created empty and granted keys by the
 * matrix's own PUT, so this sheet is deliberately not a stub of the permission
 * grid. The API takes `description: null` for "none", which is what the blank
 * field converts to on submit.
 */
function RoleCreateSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: CreateRoleBody) => createRole(body),
    onSuccess: (saved) => {
      AppToast.success(`${saved.name} created — open it to grant permissions`)
      void queryClient.invalidateQueries({ queryKey: ["roles"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={createRoleSchema}
      open={open}
      onOpenChange={onOpenChange}
      title="New role"
      description="Names the role only. Grant its permissions from the list once it exists."
      submitLabel="Create role"
      busy={mutation.isPending}
      defaults={BLANK}
      fieldLabels={{ name: "Name", description: "Description" }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof createRoleSchema>
        await mutation.mutateAsync({
          name: typed.name,
          description: typed.description || null,
        })
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <Input placeholder="Branch manager" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description (optional)</FormLabel>
                <Input placeholder="What this role is for" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    />
  )
}
