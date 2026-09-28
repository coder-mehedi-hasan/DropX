import { Package } from "lucide-react"
import type { ReactNode } from "react"
import { Separator } from "@dropx/ui"

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
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
      <Icon className="text-muted-foreground size-4" />
      {children}
      <Separator className="ml-1 flex-1" />
    </h2>
  )
}
