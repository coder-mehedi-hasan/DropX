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
  Textarea,
} from "@dropx/ui"
import { ZONE_STATUSES } from "@dropx/types"
import { FormSheet } from "@/components/form-sheet"
import { createZone, updateZone } from "@/lib/endpoints"
import { createZoneSchema, type CreateZoneBody, type UpdateZoneBody, type Zone } from "@/lib/types"

/** The form's schema. It is the same shape the API validates, so a field added
 *  here is a field the endpoint rejects — the two cannot drift. */
const schema = createZoneSchema

const BLANK: z.infer<typeof schema> = {
  name: "",
  code: "",
  description: undefined,
  status: "ACTIVE",
}

/**
 * One sheet for both directions. `zone` absent means create; present means edit,
 * and the shell resets to the record's values on open — which is why the
 * defaults are derived per render instead of being a module constant.
 */
export function ZoneFormSheet({
  open,
  onOpenChange,
  zone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  zone?: Zone | null
}) {
  const queryClient = useQueryClient()

  const defaults: z.infer<typeof schema> = zone
    ? {
        name: zone.name,
        code: zone.code,
        description: zone.description ?? undefined,
        status: zone.status,
      }
    : BLANK

  const mutation = useMutation({
    mutationFn: (body: CreateZoneBody | UpdateZoneBody) =>
      zone ? updateZone(zone.id, body) : createZone(body as CreateZoneBody),
    onSuccess: (saved) => {
      AppToast.success(zone ? `${saved.name} updated` : `${saved.name} created`)
      void queryClient.invalidateQueries({ queryKey: ["zones"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title={zone ? "Edit zone" : "New zone"}
      description="A geographic area used to calculate delivery fees."
      submitLabel={zone ? "Save zone" : "Create zone"}
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{
        name: "Name",
        code: "Code",
        description: "Description",
        status: "Status",
      }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof schema>
        // `mutateAsync`, awaited — not `mutate`. The shell owns the error banner and
        // only learns there is an error because this handler rejects: it wraps the
        // call in `try/catch` and hands the rejection to `useServerErrors`. `mutate`
        // returns before the request settles and never rejects, so a 409 "A zone with
        // that code already exists" would be discarded silently — the sheet would sit
        // there looking unsaved with no explanation.
        await mutation.mutateAsync({
          ...typed,
          // An emptied textarea means "no description", not the empty string,
          // which the column stores as a value rather than as absence.
          description: typed.description?.trim() || null,
        } as CreateZoneBody)
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <Input placeholder="Dhaka Metro" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="code"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Code</FormLabel>
                <Input placeholder="DHK-METRO" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <Textarea rows={2} placeholder="Coverage area description" {...field} />
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
                    {ZONE_STATUSES.map((status) => (
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
