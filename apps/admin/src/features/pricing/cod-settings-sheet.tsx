import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { AppToast, BoundFormField, FormItem, FormLabel, FormMessage, Input } from "@dropx/ui"
import { FormSheet } from "@/components/form-sheet"
import { updateCodSettings } from "@/lib/endpoints"
import { codSettingsSchema, type CodSettingsBody } from "@/lib/types"

const schema = codSettingsSchema

/**
 * The COD figures every slab is re-priced with. The values shown are the lane
 * matrix's current ones — read from the first slab the page loaded — and
 * saving pushes a bulk update the server applies to every active band.
 */
export function CodSettingsSheet({
  open,
  onOpenChange,
  defaults,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaults: z.infer<typeof schema>
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: CodSettingsBody) => updateCodSettings(body),
    onSuccess: (result) => {
      AppToast.success(`COD settings updated on ${result.slabsUpdated} bands`)
      void queryClient.invalidateQueries({ queryKey: ["pricing"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title="COD settings"
      description="Applied to every active weight band in the matrix."
      submitLabel="Save settings"
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{
        codPercentage: "COD %",
        codFixedFee: "COD flat fee (৳)",
      }}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values as CodSettingsBody)
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="codPercentage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>COD %</FormLabel>
                <Input type="number" inputMode="decimal" placeholder="1.5" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="codFixedFee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>COD flat fee (৳)</FormLabel>
                <Input type="number" inputMode="decimal" placeholder="20" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    />
  )
}
