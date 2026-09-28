import { Package } from "lucide-react"
import type { ReactNode } from "react"
import { Separator } from "@dropx/ui"

/**
 * PageHeader.
 *
 * `eyebrow` is the brand's section label — Volt Deep (`text-accent-ink`) for
 * small type, matching the marketing site and rider app so a dispatcher moving
 * between the three DropX surfaces reads them as one product.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string
  description?: string
  eyebrow?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-accent-ink text-xs font-semibold tracking-[0.16em] uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {label}
      </dt>
      <dd className="text-sm font-medium break-words">{children}</dd>
    </div>
  )
}

export function PanelTitle({
  icon: Icon = Package,
  children,
}: {
  icon?: typeof Package
  children: ReactNode
}) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold">
      <Icon className="text-accent-ink size-4" aria-hidden />
      {children}
      <Separator className="ml-1 flex-1" />
    </h2>
  )
}
