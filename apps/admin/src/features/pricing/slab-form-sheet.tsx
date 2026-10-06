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
import { RECORD_STATUSES } from "@dropx/types"
import { FormSheet } from "@/components/form-sheet"
import { createPricingSlab, updatePricingSlab } from "@/lib/endpoints"
import {
  createSlabSchema,
  type CreateSlabBody,
  type PricingSlab,
  type UpdateSlabBody,
} from "@/lib/types"

const schema = createSlabSchema

const BLANK: z.infer<typeof schema> = {
  minWeightGrams: 0,
  maxWeightGrams: 200,
  baseFee: 0,
  extraKgFee: 0,
  codPercentage: 1.5,
  codFixedFee: 20,
  status: "ACTIVE",
}

/**
 * One weight band of one lane. Create and edit share the shell; the lane id
 * belongs to the caller (the row the band button was clicked on), so it is not
 * a field of the form.
 */
export function SlabFormSheet({
  open,
  onOpenChange,
  laneId,
  slab,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  laneId: string
  slab?: PricingSlab | null
}) {
  const queryClient = useQueryClient()

  const defaults: z.infer<typeof schema> = slab
    ? {
        minWeightGrams: slab.minWeightGrams,
        maxWeightGrams: slab.maxWeightGrams,
        baseFee: slab.baseFee,
        extraKgFee: slab.extraKgFee,
        codPercentage: slab.codPercentage,
        codFixedFee: slab.codFixedFee,
        status: slab.status,
      }
    : BLANK

  const mutation = useMutation({
    mutationFn: (body: CreateSlabBody | UpdateSlabBody) =>
      slab ? updatePricingSlab(slab.id, body) : createPricingSlab(laneId, body as CreateSlabBody),
    onSuccess: () => {
      AppToast.success(slab ? "Band updated" : "Band added")
      void queryClient.invalidateQueries({ queryKey: ["pricing"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title={slab ? "Edit band" : "Add band"}
      description="A weight band of the lane. Bands must not overlap the lane's existing ones."
      submitLabel={slab ? "Save band" : "Add band"}
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{
        minWeightGrams: "Min weight (g)",
        maxWeightGrams: "Max weight (g)",
        baseFee: "Base fee (৳)",
        extraKgFee: "Extra per kg (৳)",
        codPercentage: "COD %",
        codFixedFee: "COD flat fee (৳)",
        status: "Status",
      }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof schema>
        await mutation.mutateAsync(typed as CreateSlabBody)
      }}
      error={null}
      renderFields={() => (
        <>
          <div className="grid grid-cols-2 gap-4">
            <BoundFormField
              name="minWeightGrams"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Min weight (g)</FormLabel>
                  <Input type="number" inputMode="numeric" placeholder="0" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <BoundFormField
              name="maxWeightGrams"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max weight (g)</FormLabel>
                  <Input type="number" inputMode="numeric" placeholder="200" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <BoundFormField
            name="baseFee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base fee (৳)</FormLabel>
                <Input type="number" inputMode="decimal" placeholder="0.00" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="extraKgFee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Extra per kg (৳)</FormLabel>
                <Input type="number" inputMode="decimal" placeholder="0.00" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
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
          </div>
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
