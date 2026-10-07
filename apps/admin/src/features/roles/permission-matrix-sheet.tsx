import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { AppToast, Checkbox, FormSheetShell } from "@dropx/ui"
import { ServerError } from "@/components/server-error"
import { getRole, replaceRolePermissions } from "@/lib/endpoints"
import type { PermissionKey } from "@/lib/permissions"
import type { RoleOption } from "@/lib/types"

/**
 * Sections as `docs/rbac.md` tables them, in reading order. The grouping is
 * presentation only — the catalog itself stays the flat static list in
 * `lib/permissions.ts` — and any key the API returns that is not named here
 * still renders, under "More permissions", so a catalog addition cannot make
 * a grant invisible on the one screen that edits grants.
 */
const SECTIONS: { label: string; keys: PermissionKey[] }[] = [
  {
    label: "Organization",
    keys: [
      "branches.view",
      "branches.manage",
      "hubs.view",
      "hubs.manage",
      "users.view",
      "users.manage",
      "roles.view",
      "roles.manage",
    ],
  },
  {
    label: "Customers & pricing",
    keys: [
      "customers.view",
      "customers.manage",
      "locations.view",
      "locations.manage",
      "pricing.view",
      "pricing.manage",
    ],
  },
  {
    label: "Fleet & network",
    keys: [
      "vehicles.view",
      "vehicles.manage",
      "routes.view",
      "routes.manage",
      "riders.view",
      "riders.manage",
    ],
  },
  {
    label: "Parcels & operations",
    keys: [
      "parcels.view",
      "parcels.create",
      "parcels.update",
      "parcels.cancel",
      "pickups.view",
      "pickups.manage",
      "pickups.assign",
      "transfers.view",
      "transfers.manage",
      "deliveries.view",
      "deliveries.manage",
      "deliveries.assign",
    ],
  },
  {
    label: "Money & support",
    keys: [
      "payments.view",
      "payments.manage",
      "settlements.view",
      "settlements.manage",
      "notifications.view",
      "support.view",
      "support.manage",
      "audit.view",
    ],
  },
]

/**
 * The permission matrix. A sheet rather than a route — one role's key set is a
 * single scrollable grid, which is what `FormSheetShell` exists for — and it
 * reads `GET /roles/:id` on open rather than taking grants from the list row,
 * because the list carries no grants and fetching them per row would be N
 * requests for a number the table never shows.
 *
 * Local state rather than `FormSheet`'s react-hook-form: the values are a set
 * of checkboxes, not text fields, and the detail read arrives after mount — a
 * resolver-bound form would reset to an empty set when the sheet opens and
 * only correct itself once, silently. `selected` starts `null` and fills from
 * the response exactly once per open, so a refocus-triggered refetch cannot
 * wipe edits in progress.
 *
 * Saving is the whole set, PUT — same replace semantics as the stops and
 * manifest screens. The API rejects a replace that would leave no active
 * account able to manage users, and that 409 is shown here as a banner: it is
 * an answer, not a vanished toast.
 */
export function PermissionMatrixSheet({
  open,
  onOpenChange,
  role,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  role: RoleOption | null
}) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string[] | null>(null)
  const [saveError, setSaveError] = useState<unknown>(null)

  const detail = useQuery({
    queryKey: ["role", role?.id],
    queryFn: ({ signal }) => getRole(role!.id, signal),
    enabled: open && role !== null,
  })

  useEffect(() => {
    if (selected !== null || !detail.data) return
    setSelected(detail.data.permissions.filter((grant) => grant.granted).map((grant) => grant.key))
  }, [detail.data, selected])

  const save = useMutation({
    mutationFn: (permissionKeys: string[]) => replaceRolePermissions(role!.id, { permissionKeys }),
    onMutate: () => setSaveError(null),
    onSuccess: (updated) => {
      AppToast.success(`${updated.name} — permissions saved`)
      void queryClient.invalidateQueries({ queryKey: ["roles"] })
      void queryClient.invalidateQueries({ queryKey: ["role", updated.id] })
      onOpenChange(false)
    },
    onError: (error) => setSaveError(error),
  })

  const groups = useMemo(() => {
    if (!detail.data) return []
    const available = new Set(detail.data.permissions.map((grant) => grant.key))
    const covered = new Set<string>(SECTIONS.flatMap((section) => section.keys))
    const sections: { label: string; keys: string[] }[] = SECTIONS.map((section) => ({
      label: section.label,
      keys: section.keys.filter((key) => available.has(key)),
    })).filter((section) => section.keys.length > 0)
    const extra = [...available].filter((key) => !covered.has(key))
    if (extra.length > 0) sections.push({ label: "More permissions", keys: extra })
    return sections
  }, [detail.data])

  if (!role) return null

  const selectedKeys = selected ?? []

  function toggle(key: string, checked: boolean) {
    setSelected((current) => {
      if (current === null) return current
      return checked ? [...current, key] : current.filter((existing) => existing !== key)
    })
  }

  return (
    <FormSheetShell
      open={open}
      title={`Permissions — ${role.name}`}
      description="Every key the staff portal checks, in the groups the RBAC doc tables them. Saving replaces this role's whole set."
      submitLabel="Save permissions"
      busy={save.isPending}
      onOpenChange={(next) => {
        if (save.isPending) return
        if (next) setSelected(null)
        setSaveError(null)
        onOpenChange(next)
      }}
      onClose={() => setSaveError(null)}
      onSubmit={() => {
        if (selected === null || save.isPending) return
        save.mutate(selected)
      }}
    >
      <ServerError
        error={saveError}
        title="Could not save these permissions"
        onDismiss={() => setSaveError(null)}
      />

      <ServerError
        error={detail.isError ? detail.error : null}
        title="Unable to load this role's permissions"
        onDismiss={() => void detail.refetch()}
      />

      {detail.isPending || selected === null ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading permissions…
        </p>
      ) : (
        <div className="space-y-6">
          <p className="text-muted-foreground text-sm">
            {selectedKeys.length} of {detail.data?.permissions.length ?? 0} granted. An unchecked
            role keeps no trace of a removed key — saving writes exactly what is checked.
          </p>

          {groups.map((section) => {
            const grantedHere = section.keys.filter((key) => selectedKeys.includes(key)).length
            return (
              <section key={section.label} className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <h4 className="text-sm font-medium">{section.label}</h4>
                  <span className="text-muted-foreground text-xs">
                    {grantedHere}/{section.keys.length}
                  </span>
                </div>
                <div className="grid gap-1 sm:grid-cols-2">
                  {section.keys.map((key) => (
                    <label
                      key={key}
                      className="hover:bg-accent -mx-2 flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 text-sm leading-5"
                    >
                      <Checkbox
                        checked={selectedKeys.includes(key)}
                        onCheckedChange={(checked) => toggle(key, checked === true)}
                      />
                      <span className="font-mono text-xs">{key}</span>
                    </label>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </FormSheetShell>
  )
}
