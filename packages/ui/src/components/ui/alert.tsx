import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "../../lib/cn"

/**
 * Alert.
 *
 * Ships `warning` and `success` alongside `destructive` because the two most common
 * DropX messages aren't errors at all: a rider marking a parcel out for delivery,
 * and a branch confirming a settlement was disbursed. Tinting them all red trains
 * ops staff to ignore alerts.
 */
const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground [&>svg]:text-primary",
        destructive: "border-destructive/30 bg-destructive/8 text-foreground [&>svg]:text-destructive",
        warning: "border-warning/30 bg-warning/8 text-foreground [&>svg]:text-warning",
        success: "border-success/30 bg-success/8 text-foreground [&>svg]:text-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export type AlertProps = React.ComponentProps<"div"> & VariantProps<typeof alertVariants>

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

export function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight", className)}
      {...props}
    />
  )
}

export function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn(
        "text-muted-foreground col-start-2 grid justify-items-start gap-1 text-sm [&_p]:leading-relaxed",
        className,
      )}      {...props}
    />
  )
}

export { alertVariants }
