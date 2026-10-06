import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { AppToast, BoundFormField, FormItem, FormLabel, FormMessage, Input } from "@dropx/ui"
import { ReferenceCombobox } from "@/components/reference-combobox"
import { FormSheet } from "@/components/form-sheet"
import { recordRemittance } from "@/lib/endpoints"
import type { RecordRemittanceBody } from "@/lib/types"

/**
 * The finance clerk's remittance of a cash COD collection. The parcel is picked
 * by tracking number — the parcels combobox carries the COD amount as its hint,
 * so the clerk sees what a parcel collects before settling it — and the amount
 * is the only other input. Method is CASH by definition; the API writes the row
 * straight to PAID.
 */
const schema = z.object({
  parcelId: z.string().trim().min(1, "Pick the parcel the money was collected for"),
  amount: z.coerce
    .number()
    .positive("Amount must be more than zero")
    .max(1_000_000)
    .refine((value) => Number.isInteger(Math.round(value * 100)), {
      message: "Use at most 2 decimal places",
      path: ["amount"],
    }),
})

const DEFAULT_VALUES = {
  parcelId: "",
  amount: undefined,
}

export function PaymentRecordSheet({
  open,
  onOpenChange,
  onRecorded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRecorded: () => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: RecordRemittanceBody) => recordRemittance(body),
    onSuccess: (payment) => {
      AppToast.success(`${new Intl.NumberFormat("en-GB").format(payment.amount)} Tk recorded`)
      void queryClient.invalidateQueries({ queryKey: ["payments"] })
      onRecorded()
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title="Record COD remittance"
      description="Cash a rider collected on delivery, remitted to the company. The parcel must collect on delivery (COD)."
      submitLabel="Record remittance"
      busy={mutation.isPending}
      defaults={DEFAULT_VALUES}
      fieldLabels={{ parcelId: "Parcel", amount: "Amount (Tk)" }}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values as RecordRemittanceBody)
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="parcelId"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Parcel</FormLabel>
                <ReferenceCombobox
                  source="parcels"
                  placeholder="Search by tracking number"
                  value={field.value as string}
                  onChange={field.onChange}
                  invalid={!!fieldState.error}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (Tk)</FormLabel>
                <Input type="number" step="0.01" min="0" placeholder="900.00" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
    />
  )
}
