import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import type * as React from "react"

import { cn } from "../../lib/cn"

/**
 * Button.
 *
 * Matches the brand Action matrix: one primary (Volt Orange + white label),
 * outline secondary (ink on white), link tertiary (Volt Deep). `asChild` keeps
 * router `<Link>` styling without a nested button.
 *
 * Every variant sets an explicit text colour so a Button-as-link cannot inherit
 * the global prose `a` accent-ink treatment.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold",
    "transition-[color,background-color,border-color,box-shadow,opacity] duration-150 ease-brand",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground disabled:bg-primary/40 disabled:text-primary-foreground/80 disabled:opacity-100",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground disabled:opacity-50",
        outline:
          "border border-input bg-background text-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground disabled:opacity-50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:text-secondary-foreground disabled:opacity-50",
        ghost:
          "text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
        link: "text-accent-ink hover:text-accent-ink-hover underline-offset-4 hover:underline disabled:opacity-50",
        success:
          "bg-success text-success-foreground hover:bg-success/90 hover:text-success-foreground disabled:opacity-50",
        warning:
          "bg-warning text-warning-foreground hover:bg-warning/90 hover:text-warning-foreground disabled:opacity-50",
      },
      size: {
        default: "h-10 px-4 py-2 text-sm",
        sm: "h-8 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-lg px-6 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button"
  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { buttonVariants }
