import { Slot } from "@radix-ui/react-slot"
import { type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import * as React from "react"

import { cn } from "../../lib/cn"
import { buttonVariants } from "./button"

/**
 * LoadingButton.
 *
 * The brand's loading action: spinner beside the label, width preserved, focus
 * ring still orange. `disabled` stays true while loading so a double-submit
 * cannot fire, and `aria-busy` tells assistive tech the wait is intentional.
 */
export type LoadingButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }

export const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      type = "button",
      children,
      ...props
    },
    ref,
  ) => {
    if (asChild) {
      return (
        <Slot ref={ref} {...props}>
          <>
            {React.Children.map(
              children as React.ReactElement<{ className?: string; children?: React.ReactNode }>,
              (child: React.ReactElement<{ className?: string; children?: React.ReactNode }>) => {
                return React.cloneElement(child, {
                  className: cn(buttonVariants({ variant, size }), className),
                  children: (
                    <>
                      {loading ? (
                        <Loader2 className={cn("size-4 animate-spin", children && "mr-2")} />
                      ) : null}
                      {child.props.children}
                    </>
                  ),
                })
              },
            )}
          </>
        </Slot>
      )
    }

    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={loading || disabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className={cn("size-4 animate-spin", children && "mr-2")} /> : null}
        {children}
      </button>
    )
  },
)
LoadingButton.displayName = "LoadingButton"
