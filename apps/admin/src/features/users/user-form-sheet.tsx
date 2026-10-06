import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  AppToast,
  BoundFormField,
  Checkbox,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dropx/ui"
import { USER_STATUSES } from "@dropx/types"
import { FormSheet } from "@/components/form-sheet"
import { ReferenceCombobox } from "@/components/reference-combobox"
import {
  createUser,
  listHubsForPicker,
  listRolesForPicker,
  resetUserPassword,
  updateUser,
} from "@/lib/endpoints"
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  type CreateUserBody,
  type ResetPasswordBody,
  type StaffUser,
  type UpdateUserBody,
} from "@/lib/types"

const STATUS_LABEL: Record<(typeof USER_STATUSES)[number], string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  SUSPENDED: "Suspended",
}

const BLANK: z.infer<typeof createUserSchema> = {
  email: "",
  name: "",
  password: "",
  phone: "",
  branchId: "",
  status: "ACTIVE",
  roleIds: [],
  hubIds: [],
}

/**
 * Create validates the account fields too; edit cannot, so it uses the narrower
 * schema and therefore a different form. `FormSheet` reads one `schema` prop,
 * so the edit sheet is a separate component rather than one sheet with branches
 * — the rider sheet does the same.
 */
export function UserFormSheet({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: StaffUser | null
}) {
  if (user) return <EditUserFormSheet open={open} onOpenChange={onOpenChange} user={user} />

  return <CreateUserFormSheet open={open} onOpenChange={onOpenChange} />
}

/**
 * Roles and hubs for the checkbox groups, loaded once per sheet mount.
 *
 * A page of 100 rather than a query per keystroke: role sets are small and
 * stable, and a checkbox group that re-renders its options under the cursor
 * loses checks. Both keys are stable across sheets, so opening create after
 * edit does not refetch.
 */
function useAssignmentOptions() {
  const roles = useQuery({
    queryKey: ["roles", "assignment-picker"],
    queryFn: () => listRolesForPicker({ page: 1, limit: 100 }),
    staleTime: 5 * 60_000,
  })
  const hubs = useQuery({
    queryKey: ["hubs", "assignment-picker"],
    queryFn: () => listHubsForPicker({ page: 1, limit: 100 }),
    staleTime: 5 * 60_000,
  })

  return {
    roles: roles.data?.nodes ?? [],
    hubs: hubs.data?.nodes ?? [],
    rolesPending: roles.isPending,
    hubsPending: hubs.isPending,
    rolesError: roles.isError,
    hubsError: hubs.isError,
  }
}

/**
 * The multi-select the reference combobox cannot be: a staff account holds a
 * set of roles and a set of hubs, and a single-select would make every account
 * a one-role account by accident of the control.
 */
function AssignmentCheckboxes({
  name,
  label,
  options,
  emptyHint,
}: {
  name: "roleIds" | "hubIds"
  label: string
  options: { id: string; name: string }[]
  emptyHint: string
}) {
  return (
    <BoundFormField
      name={name}
      render={({ field }) => {
        const selected: string[] = Array.isArray(field.value) ? (field.value as string[]) : []
        return (
          <FormItem>
            <FormLabel>{label}</FormLabel>
            {options.length === 0 ? (
              <p className="text-muted-foreground text-sm">{emptyHint}</p>
            ) : (
              <div className="grid gap-2">
                {options.map((option) => (
                  <label
                    key={option.id}
                    className="hover:bg-accent -mx-2 flex cursor-pointer items-start gap-3 rounded-md px-2 py-1.5 text-sm leading-5"
                  >
                    <Checkbox
                      checked={selected.includes(option.id)}
                      onCheckedChange={(checked) =>
                        field.onChange(
                          checked === true
                            ? [...selected, option.id]
                            : selected.filter((id) => id !== option.id),
                        )
                      }
                      onBlur={field.onBlur}
                    />
                    <span>{option.name}</span>
                  </label>
                ))}
              </div>
            )}
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}

function CreateUserFormSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
}) {
  const queryClient = useQueryClient()
  const options = useAssignmentOptions()

  const mutation = useMutation({
    mutationFn: (body: CreateUserBody) => createUser(body),
    onSuccess: (saved) => {
      AppToast.success(`${saved.name} created`)
      void queryClient.invalidateQueries({ queryKey: ["users"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={createUserSchema}
      open={open}
      onOpenChange={onOpenChange}
      title="New staff account"
      description="Creates the account with its roles and hub scope together. The temporary password becomes the sign-in password."
      submitLabel="Create account"
      busy={mutation.isPending}
      defaults={BLANK}
      fieldLabels={{
        name: "Name",
        email: "Email",
        password: "Temporary password",
        phone: "Phone",
        branchId: "Branch",
        status: "Status",
        roleIds: "Roles",
        hubIds: "Hub scope",
      }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof createUserSchema>
        await mutation.mutateAsync({
          ...typed,
          phone: typed.phone || null,
          branchId: typed.branchId || null,
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
                <Input placeholder="Rakib Hasan" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <Input type="email" placeholder="rakib@dropx.com" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Temporary password</FormLabel>
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  {...field}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone (optional)</FormLabel>
                <Input type="tel" placeholder="+8801…" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="branchId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch (optional)</FormLabel>
                <ReferenceCombobox
                  source="branches"
                  placeholder="No branch restriction"
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <AssignmentCheckboxes
            name="roleIds"
            label="Roles"
            options={options.roles}
            emptyHint={
              options.rolesPending
                ? "Loading roles…"
                : "No roles available yet — run bun run db:seed."
            }
          />
          <AssignmentCheckboxes
            name="hubIds"
            label="Hub scope (optional)"
            options={options.hubs}
            emptyHint={
              options.hubsPending
                ? "Loading hubs…"
                : "No hubs yet — leave unchecked for no hub restriction."
            }
          />
          <BoundFormField
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {STATUS_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    />
  )
}

function EditUserFormSheet({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  user: StaffUser
}) {
  const queryClient = useQueryClient()
  const options = useAssignmentOptions()

  const defaults: z.infer<typeof updateUserSchema> = {
    name: user.name,
    phone: user.phone ?? "",
    branchId: user.branchId ?? "",
    status: user.status,
    roleIds: user.roles.map((role) => role.id),
    hubIds: user.hubs.map((hub) => hub.id),
  }

  const mutation = useMutation({
    mutationFn: (body: UpdateUserBody) => updateUser(user.id, body),
    onSuccess: (saved) => {
      AppToast.success(`${saved.name} updated`)
      void queryClient.invalidateQueries({ queryKey: ["users"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={updateUserSchema}
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${user.name}`}
      description="Profile, branch restriction, roles and hub scope. Email and password are managed elsewhere — password by reset."
      submitLabel="Save account"
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{
        name: "Name",
        phone: "Phone",
        branchId: "Branch",
        status: "Status",
        roleIds: "Roles",
        hubIds: "Hub scope",
      }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof updateUserSchema>
        await mutation.mutateAsync({
          ...typed,
          phone: typed.phone || null,
          branchId: typed.branchId || null,
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
                <Input {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone (optional)</FormLabel>
                <Input type="tel" placeholder="+8801…" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="branchId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Branch (optional)</FormLabel>
                <ReferenceCombobox
                  source="branches"
                  placeholder="No branch restriction"
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <AssignmentCheckboxes
            name="roleIds"
            label="Roles"
            options={options.roles}
            emptyHint={
              options.rolesPending
                ? "Loading roles…"
                : "No roles available yet — run bun run db:seed."
            }
          />
          <AssignmentCheckboxes
            name="hubIds"
            label="Hub scope (optional)"
            options={options.hubs}
            emptyHint={
              options.hubsPending
                ? "Loading hubs…"
                : "No hubs yet — leave unchecked for no hub restriction."
            }
          />
          <BoundFormField
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {STATUS_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    />
  )
}

/**
 * A sheet, not a confirm dialog: unlike a status flip, a password reset has a
 * value to enter. It states what actually happens — the new password works
 * immediately — because the staff change-password gate the `must_change_password`
 * flag anticipates does not exist yet.
 */
export function UserResetPasswordSheet({
  open,
  onOpenChange,
  user,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  user: StaffUser | null
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ResetPasswordBody }) =>
      resetUserPassword(id, body),
    onSuccess: (saved) => {
      AppToast.success(`Password reset for ${saved.name}`)
      void queryClient.invalidateQueries({ queryKey: ["users"] })
      onOpenChange(false)
    },
  })

  if (!user) return null

  return (
    <FormSheet
      schema={resetPasswordSchema}
      open={open}
      onOpenChange={onOpenChange}
      title={`Reset password — ${user.name}`}
      description="The account signs in with this password from now on. Give it to them out of band, not over the same channel you would send the username."
      submitLabel="Reset password"
      busy={mutation.isPending}
      defaults={{ password: "" }}
      fieldLabels={{ password: "New temporary password" }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof resetPasswordSchema>
        await mutation.mutateAsync({ id: user.id, body: { password: typed.password } })
      }}
      error={null}
      renderFields={() => (
        <BoundFormField
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New temporary password</FormLabel>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                {...field}
              />
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    />
  )
}
