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
import { COMPENSATION_TYPES } from "@dropx/types"

import { FormSheet } from "@/components/form-sheet"
import { ReferenceCombobox } from "@/components/reference-combobox"
import { approveRiderApplication } from "@/lib/endpoints"
import type { ApproveRiderApplicationBody, RiderApplication } from "@/lib/types"

const schema = z.object({
  email: z.string().trim().email("Enter a valid login email").or(z.literal("")),
  password: z.string().min(8, "Password must be at least 8 characters"),
  hubId: z.string().trim().min(1, "Select a home hub"),
  licenseNumber: z.string().trim().or(z.literal("")),
  compensationType: z.enum(COMPENSATION_TYPES),
})

type Values = z.infer<typeof schema>

export function ApproveRiderApplicationSheet({
  application,
  open,
  onOpenChange,
}: {
  application: RiderApplication | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (body: ApproveRiderApplicationBody) =>
      approveRiderApplication(application!.id, body),
    onSuccess: (result) => {
      AppToast.success(`${result.application.name} is now a rider`)
      void queryClient.invalidateQueries({ queryKey: ["rider-applications"] })
      void queryClient.invalidateQueries({ queryKey: ["riders"] })
      onOpenChange(false)
    },
  })

  const defaults: Values = {
    email: application?.email ?? "",
    password: "",
    hubId: "",
    licenseNumber: application?.licenseNumber ?? "",
    compensationType: "SALARIED",
  }

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title="Approve and create rider"
      description="This creates the rider's login and rider record, then marks the application approved."
      submitLabel="Create rider and approve"
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{
        email: "Login email",
        password: "Temporary password",
        hubId: "Home hub",
        licenseNumber: "Licence number",
        compensationType: "Pay type",
      }}
      onSubmit={async (values) => {
        const typed = values as Values
        await mutation.mutateAsync({
          ...typed,
          email: typed.email || undefined,
          licenseNumber: typed.licenseNumber || undefined,
        })
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Login email</FormLabel>
                <Input type="email" placeholder="rider@example.com" {...field} />
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
            name="hubId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Home hub</FormLabel>
                <ReferenceCombobox
                  source="hubs"
                  placeholder="Select home hub"
                  value={field.value as string}
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
                <Select value={field.value as string} onValueChange={field.onChange}>
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
        </>
      )}
    />
  )
}
