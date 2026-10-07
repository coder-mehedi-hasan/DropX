import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { PriceCalculator } from "@/components/price-calculator"

export const metadata: Metadata = {
  title: "Price calculator",
  description: "Estimate a delivery fee from the same pricing service booking uses.",
}

export default function CalculatorPage() {
  return (
    <div className="grid gap-7">
      <PageHeader
        eyebrow="Calculator"
        title="Know the fee before you book."
        description="Pick both ends of the route, enter the weight and — if you are collecting cash — the amount. The estimate comes straight from the pricing service, not from a copy of it."
      />
      <PriceCalculator />
    </div>
  )
}
