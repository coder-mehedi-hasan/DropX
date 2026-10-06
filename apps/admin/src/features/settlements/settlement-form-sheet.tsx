import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { AppToast, BoundFormField, FormItem, FormLabel, FormMessage, Input } from "@dropx/ui"
import { ReferenceCombobox } from "@/components/reference-combobox"
import { FormSheet } from "@/components/form-sheet"
import { createSettlement } from "@/lib/endpoints"
import { formatMoney } from "@/lib/format"
import type { CreateSettlementBody } from "@/lib/types"

const date = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")

/**
 * The finance clerk's period statement to a merchant. Only the merchant and the
 * period are asked for: the COD collected, the delivery fees earned and the net
 * the company will disburse are all computed server-side from the merchant's
 * paid payments inside the period — a client-typed total is the statement lying.
 */
const schema = z
  .object({
    customerId: z.string().trim().min(1, "Pick the merchant to settle"),
    periodStart: date,
    periodEnd: date,
  })
  .refine((value) => value.periodEnd >= value.periodStart, {
    message: "The period cannot end before it starts",
    path: ["periodEnd"],
  })

const DEFAULT_VALUES: CreateSettlementBody = {
  customerId: "",
  periodStart: "",
  periodEnd: "",
}

export function SettlementFormSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: CreateSettlementBody) => createSettlement(body),
    onSuccess: (settlement) => {
      AppToast.success(`${formatMoney(settlement.netAmount)} net for ${settlement.customerName}`)
      void queryClient.invalidateQueries({ queryKey: ["settlements"] })
      onCreated()
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title="Create settlement"
      description="The period statement of a merchant's collected COD. Totals are computed from their paid payments inside the period."
      submitLabel="Create settlement"
      busy={mutation.isPending}
      defaults={DEFAULT_VALUES}
      fieldLabels={{ customerId: "Merchant", periodStart: "Period from", periodEnd: "Period to" }}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values as CreateSettlementBody)
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="customerId"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>Merchant</FormLabel>
                <ReferenceCombobox
                  source="customers"
                  placeholder="Search by name or phone"
                  value={field.value as string}
                  onChange={field.onChange}
                  invalid={!!fieldState.error}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <BoundFormField
              name="periodStart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period from</FormLabel>
                  <Input type="date" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <BoundFormField
              name="periodEnd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period to</FormLabel>
                  <Input type="date" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </>
      )}
    />
  )
}
