import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { PricingPlans } from "@/components/pricing-plans"

export const metadata: Metadata = {
  title: "Pricing plans",
  description:
    "Every active pricing lane and its weight bands — the same matrix your delivery quote is computed from.",
}

export default function PricingPage() {
  return (
    <div className="grid gap-7">
      <PageHeader
        eyebrow="Pricing"
        title="Every lane, every weight band."
        description="The full price list: a base fee per weight band, an extra charge per kilogram above the top band, and the cash-on-delivery percentage — exactly what your quote is built from."
      />
      <PricingPlans />
    </div>
  )
}
