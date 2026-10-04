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
import { ReferenceCombobox } from "@/components/reference-combobox"
import { createPricingRule, updatePricingRule } from "@/lib/endpoints"
import {
  createPricingRuleSchema,
  type CreatePricingRuleBody,
  type UpdatePricingRuleBody,
  type PricingRule,
} from "@/lib/types"

const schema = createPricingRuleSchema

const BLANK: z.infer<typeof schema> = {
  name: "",
  originZoneId: "",
  destinationZoneId: "",
  minWeight: 0,
  maxWeight: undefined,
  basePrice: 0,
  pricePerKg: 0,
  codPercentage: 0,
  codFixedFee: 0,
  expressFee: 0,
  status: "ACTIVE",
}

export function PricingRuleFormSheet({
  open,
  onOpenChange,
  pricingRule,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pricingRule?: PricingRule | null
}) {
  const queryClient = useQueryClient()

  const defaults: z.infer<typeof schema> = pricingRule
    ? {
        name: pricingRule.name,
        originZoneId: pricingRule.originZoneId,
        destinationZoneId: pricingRule.destinationZoneId,
        minWeight: pricingRule.minWeight,
        maxWeight: pricingRule.maxWeight ?? undefined,
        basePrice: pricingRule.basePrice,
        pricePerKg: pricingRule.pricePerKg,
        codPercentage: pricingRule.codPercentage,
        codFixedFee: pricingRule.codFixedFee,
        expressFee: pricingRule.expressFee,
        status: pricingRule.status,
      }
    : BLANK

  const mutation = useMutation({
    mutationFn: (body: CreatePricingRuleBody | UpdatePricingRuleBody) =>
      pricingRule
        ? updatePricingRule(pricingRule.id, body)
        : createPricingRule(body as CreatePricingRuleBody),
    onSuccess: (saved) => {
      AppToast.success(pricingRule ? `${saved.name} updated` : `${saved.name} created`)
      void queryClient.invalidateQueries({ queryKey: ["pricing-rules"] })
      onOpenChange(false)
    },
  })

  return (
    <FormSheet
      schema={schema}
      open={open}
      onOpenChange={onOpenChange}
      title={pricingRule ? "Edit pricing rule" : "New pricing rule"}
      description="Delivery fee for a zone pair and weight band."
      submitLabel={pricingRule ? "Save pricing rule" : "Create pricing rule"}
      busy={mutation.isPending}
      defaults={defaults}
      fieldLabels={{
        name: "Name",
        originZoneId: "Origin zone",
        destinationZoneId: "Destination zone",
        minWeight: "Min weight (kg)",
        maxWeight: "Max weight (kg)",
        basePrice: "Base price (BDT)",
        pricePerKg: "Price per kg (BDT)",
        codPercentage: "COD %",
        codFixedFee: "COD fixed fee (BDT)",
        expressFee: "Express fee (BDT)",
        status: "Status",
      }}
      onSubmit={async (values) => {
        const typed = values as z.infer<typeof schema>
        await mutation.mutateAsync({
          ...typed,
          maxWeight: typed.maxWeight || undefined,
        } as CreatePricingRuleBody)
      }}
      error={null}
      renderFields={() => (
        <>
          <BoundFormField
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <Input placeholder="DHAKA to CHITTAGONG (0-5 kg)" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="originZoneId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Origin zone</FormLabel>
                <ReferenceCombobox
                  source="zones"
                  placeholder="Select origin zone"
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="destinationZoneId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Destination zone</FormLabel>
                <ReferenceCombobox
                  source="zones"
                  placeholder="Select destination zone"
                  value={field.value}
                  onChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <BoundFormField
              name="minWeight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Min weight (kg)</FormLabel>
                  <Input type="number" step="0.01" min="0" placeholder="0" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <BoundFormField
              name="maxWeight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max weight (kg)</FormLabel>
                  <Input type="number" step="0.01" min="0" placeholder="Unlimited" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <BoundFormField
            name="basePrice"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base price (BDT)</FormLabel>
                <Input type="number" step="0.01" min="0" placeholder="120" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <BoundFormField
            name="pricePerKg"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price per kg (BDT)</FormLabel>
                <Input type="number" step="0.01" min="0" placeholder="15" {...field} />
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <BoundFormField
              name="codPercentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>COD percentage</FormLabel>
                  <Input type="number" step="0.01" min="0" max="100" placeholder="1.5" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
            <BoundFormField
              name="codFixedFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>COD fixed fee (BDT)</FormLabel>
                  <Input type="number" step="0.01" min="0" placeholder="20" {...field} />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <BoundFormField
            name="expressFee"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Express fee (BDT)</FormLabel>
                <Input type="number" step="0.01" min="0" placeholder="50" {...field} />
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
