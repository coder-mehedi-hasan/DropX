import { useMutation, useQueryClient } from "@tanstack/react-query"
import { z } from "zod"
import { AppToast, BoundFormField, FormItem, FormLabel, FormMessage, Input } from "@dropx/ui"
import { FormSheet } from "@/components/form-sheet"
import { refundPayment } from "@/lib/endpoints"
import { formatMoney, formatNumber } from "@/lib/format"
import type { PaymentListItem, RefundPaymentBody } from "@/lib/types"

/**
 * Refunds a paid COD collection. The anchor is the *payment* row a finance
 * clerk can see, and the sheet pre-fills its amount so "refund everything" is
 * one click and a partial refund is a downward correction. The API validates
 * the refund against the parcel's remaining balance and refuses to overdo it.
 */
function refundSchema(payment: PaymentListItem) {
  return z.object({
    amount: z.coerce
      .number()
      .positive("Amount must be more than zero")
      .max(payment.amount)
      .refine((value) => Number.isInteger(Math.round(value * 100)), {
        message: "Use at most 2 decimal places",
        path: ["amount"],
      }),
  })
}

export function PaymentRefundSheet({
  open,
  payment,
  onOpenChange,
  onRefunded,
}: {
  open: boolean
  payment: PaymentListItem
  onOpenChange: (open: boolean) => void
  onRefunded: () => void
}) {
  const queryClient = useQueryClient()
  const schema = refundSchema(payment)

  const mutation = useMutation({
    mutationFn: (body: RefundPaymentBody) => refundPayment(payment.id, body),
    onSuccess: (refund) => {
      AppToast.success(`${formatNumber(refund.amount)} Tk refunded`)
      void queryClient.invalidateQueries({ queryKey: ["payments"] })
      onRefunded()
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      key={payment.id}
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title="Refund COD collection"
      description={`${payment.trackingNumber} — refund money collected on it that was returned. A full refund closes the COD balance.`}
      submitLabel="Refund"
      busy={mutation.isPending}
      defaults={{ amount: payment.amount }}
      fieldLabels={{ amount: `Amount (max ${formatMoney(payment.amount)})` }}
      onSubmit={async (values) => {
        await mutation.mutateAsync(values as RefundPaymentBody)
      }}
      error={null}
      renderFields={() => (
        <BoundFormField
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount (Tk)</FormLabel>
              <Input type="number" step="0.01" min="0" {...field} />
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    />
  )
}
