import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  AppToast,
  BoundFormField,
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
import { COMPENSATION_TYPES, RIDER_STATUSES } from "@dropx/types"
import { FormSheet } from "@/components/form-sheet"
import { ReferenceCombobox } from "@/components/reference-combobox"
import { createRider, updateRider } from "@/lib/endpoints"
import {
  createRiderSchema,
  updateRiderSchema,
  type CreateRiderBody,
  type Rider,
  type UpdateRiderBody,
} from "@/lib/types"

const STATUS_LABEL: Record<(typeof RIDER_STATUSES)[number], string> = {
  AVAILABLE: "Available",
  BUSY: "Busy",
  OFFLINE: "Offline",
  SUSPENDED: "Suspended",
}

const BLANK: z.infer<typeof createRiderSchema> = {
  email: "",
  name: "",
  password: "",
  phone: "",
  hubId: "",
  licenseNumber: "",
  compensationType: "SALARIED",
  status: "OFFLINE",
}

export function RiderFormSheet({
  open,
  onOpenChange,
  rider,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rider?: Rider | null
}) {
  const queryClient = useQueryClient()

  // Create validates the account fields too; edit cannot, so it uses the narrower
  // schema and therefore a different form. `FormSheet` reads one `schema` prop,
  // so the edit sheet is a separate component rather than one sheet with branches.
  if (rider) return <EditRiderFormSheet open={open} onOpenChange={onOpenChange} rider={rider} />

  return <CreateRiderFormSheet open={open} onOpenChange={onOpenChange} queryClient={queryClient} />
}

function CreateRiderFormSheet({
  open,
  onOpenChange,
  queryClient,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  queryClient: ReturnType<typeof useQueryClient>
}) {
  const mutation = useMutation({
    mutationFn: (body: CreateRiderBody) => createRider(body),
    onSuccess: (saved) => {
      AppToast.success(`${saved.employeeCode} created`)
      void queryClient.invalidateQueries({ queryKey: ["riders"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={createRiderSchema}
      open={open}
      onOpenChange={onOpenChange}
      title="New rider"
      description="Creates the rider's sign-in account and their rider record together."
      submitLabel="Create rider"
      busy={mutation.isPending}
      defaults={BLANK}
      fieldLabels={{
        name: "Name",
        email: "Email",
        password: "Temporary password",
        phone: "Phone",
        hubId: "Home hub",
        licenseNumber: "Licence number",
        compensationType: "Pay type",
        status: "Status",
      }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof createRiderSchema>
        await mutation.mutateAsync({
          ...typed,
          phone: typed.phone || null,
          licenseNumber: typed.licenseNumber || null,
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
            name="hubId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Home hub</FormLabel>
                <ReferenceCombobox
                  source="hubs"
                  placeholder="Select home hub"
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="licenseNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Licence number (optional)</FormLabel>
                <Input placeholder="DL-4471-99200" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="compensationType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pay type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPENSATION_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
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
                    {RIDER_STATUSES.map((value) => (
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

function EditRiderFormSheet({
  open,
  onOpenChange,
  rider,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rider: Rider
}) {
  const queryClient = useQueryClient()

  const defaults: z.infer<typeof updateRiderSchema> = {
    hubId: rider.hubId,
    licenseNumber: rider.licenseNumber ?? "",
    compensationType: rider.compensationType,
    status: rider.status,
  }

  const mutation = useMutation({
    mutationFn: (body: UpdateRiderBody) => updateRider(rider.id, body),
    onSuccess: (saved) => {
      AppToast.success(`${saved.employeeCode} updated`)
      void queryClient.invalidateQueries({ queryKey: ["riders"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={updateRiderSchema}
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${rider.employeeCode}`}
      description="Hub, licence, pay type and availability. Sign-in details are managed on the user account."
      submitLabel="Save rider"
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{
        hubId: "Home hub",
        licenseNumber: "Licence number",
        compensationType: "Pay type",
        status: "Status",
      }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof updateRiderSchema>
        await mutation.mutateAsync({ ...typed, licenseNumber: typed.licenseNumber || null })
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="hubId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Home hub</FormLabel>
                <ReferenceCombobox
                  source="hubs"
                  placeholder="Select home hub"
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="licenseNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Licence number</FormLabel>
                <Input placeholder="DL-4471-99200" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="compensationType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pay type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPENSATION_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
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
                    {RIDER_STATUSES.map((value) => (
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
