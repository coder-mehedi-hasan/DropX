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
import { RECORD_STATUSES } from "@dropx/types"
import { FormSheet } from "@/components/form-sheet"
import { createServiceZone, updateServiceZone } from "@/lib/endpoints"
import {
  createServiceZoneSchema,
  type CreateServiceZoneBody,
  type ServiceZone,
  type UpdateServiceZoneBody,
} from "@/lib/types"
import { useCityOptions } from "./location-options"

const schema = createServiceZoneSchema

const BLANK: z.infer<typeof schema> = {
  cityId: "",
  name: "",
  code: "",
  status: "ACTIVE",
}

export function ServiceZoneFormSheet({
  open,
  onOpenChange,
  zone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  zone?: ServiceZone | null
}) {
  const queryClient = useQueryClient()
  const cityOptions = useCityOptions()

  const defaults: z.infer<typeof schema> = zone
    ? {
        cityId: zone.cityId,
        name: zone.name,
        code: zone.code,
        status: zone.status,
      }
    : BLANK

  const mutation = useMutation({
    mutationFn: (body: CreateServiceZoneBody | UpdateServiceZoneBody) =>
      zone ? updateServiceZone(zone.id, body) : createServiceZone(body as CreateServiceZoneBody),
    onSuccess: (saved) => {
      AppToast.success(zone ? `${saved.name} updated` : `${saved.name} created`)
      void queryClient.invalidateQueries({ queryKey: ["location"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title={zone ? "Edit zone" : "New zone"}
      description="A district inside a city. Zones bundle the areas below them."
      submitLabel={zone ? "Save zone" : "Create zone"}
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{
        cityId: "City",
        name: "Name",
        code: "Code",
        status: "Status",
      }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof schema>
        await mutation.mutateAsync(typed as CreateServiceZoneBody)
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="cityId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a city" />
                  </SelectTrigger>
                  <SelectContent>
                    {cityOptions.data?.nodes.map((city) => (
                      <SelectItem key={city.id} value={city.id}>
                        {city.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <Input placeholder="Dhanmondi" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormInputSlug name="code" inheritFrom="name" label="Code" placeholder="DHK-DMN" />
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
