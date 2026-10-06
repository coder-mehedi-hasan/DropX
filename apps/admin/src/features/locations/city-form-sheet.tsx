import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import {
  AppToast,
  BoundFormField,
  FormInputSlug,
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
import { LOCATION_SERVICE_TYPES, RECORD_STATUSES } from "@dropx/types"
import { FormSheet } from "@/components/form-sheet"
import { createServiceCity, updateServiceCity } from "@/lib/endpoints"
import {
  createCitySchema,
  type CreateCityBody,
  type UpdateCityBody,
  type ServiceCity,
} from "@/lib/types"
import { serviceTypeLabel } from "./labels"

const schema = createCitySchema

const BLANK: z.infer<typeof schema> = {
  name: "",
  code: "",
  serviceType: "ISD",
  status: "ACTIVE",
}

export function CityFormSheet({
  open,
  onOpenChange,
  city,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  city?: ServiceCity | null
}) {
  const queryClient = useQueryClient()

  const defaults: z.infer<typeof schema> = city
    ? {
        name: city.name,
        code: city.code,
        serviceType: city.serviceType,
        status: city.status,
      }
    : BLANK

  const mutation = useMutation({
    mutationFn: (body: CreateCityBody | UpdateCityBody) =>
      city ? updateServiceCity(city.id, body) : createServiceCity(body as CreateCityBody),
    onSuccess: (saved) => {
      AppToast.success(city ? `${saved.name} updated` : `${saved.name} created`)
      void queryClient.invalidateQueries({ queryKey: ["location"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title={city ? "Edit city" : "New city"}
      description="A service territory whose zones and areas bookings are addressed by."
      submitLabel={city ? "Save city" : "Create city"}
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{
        name: "Name",
        code: "Code",
        serviceType: "Service type",
        status: "Status",
      }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof schema>
        await mutation.mutateAsync(typed as CreateCityBody)
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <Input placeholder="Dhaka" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormInputSlug name="code" inheritFrom="name" label="Code" placeholder="DHK" />
          <BoundFormField
            name="serviceType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCATION_SERVICE_TYPES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value} — {serviceTypeLabel(value)}
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
                    {RECORD_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status === "ACTIVE" ? "Active" : "Inactive"}
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
