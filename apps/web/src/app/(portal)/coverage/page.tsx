import type { Metadata } from "next"

import { PageHeader } from "@/components/page-header"
import { CoverageExplorer } from "@/components/coverage-explorer"

export const metadata: Metadata = {
  title: "Coverage area",
  description: "Every service city, its zones, and the named areas DropX delivers to.",
}

export default function CoveragePage() {
  return (
    <div className="grid gap-7">
      <PageHeader
        eyebrow="Coverage"
        title="Where we deliver."
        description="Open a city to see its zones, and a zone to see its named areas. If your area is not listed, you can still book to the zone and describe the address."
      />
      <CoverageExplorer />
    </div>
  )
}
