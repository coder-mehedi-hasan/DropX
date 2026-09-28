import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "../../lib/cn"
import { buttonVariants } from "../ui/button"

export type LoadingButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
  }

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, ...props }, ref) => {
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
                      {loading && (
                        <Loader2 className={cn("h-4 w-4 animate-spin", children && "mr-2")} />
                      )}
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
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={loading}
        ref={ref}
        {...props}
      >
        <>
          {loading && <Loader2 className={cn("h-4 w-4 animate-spin", children && "mr-2")} />}
          {children}
        </>
      </button>
    )
  },
)
LoadingButton.displayName = "LoadingButton"

export { LoadingButton }
