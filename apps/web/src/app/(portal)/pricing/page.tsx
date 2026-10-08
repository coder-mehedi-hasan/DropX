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
        title="Simple, transparent delivery pricing."
        description="Choose a route and find the price for your parcel’s weight. Any extra-weight or cash-on-delivery charge is shown clearly before you book."
      />
      <PricingPlans />
    </div>
  )
}
