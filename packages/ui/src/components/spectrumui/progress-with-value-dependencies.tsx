"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "../../lib/cn"

export interface ProgressWithValueProps extends React.ComponentPropsWithoutRef<
  typeof ProgressPrimitive.Root
> {
  position?: "start" | "start-outside" | "follow" | "end" | "end-outside"
  label?: (value?: number | null) => React.ReactNode
  valueClassName?: string
}

const ProgressWithValue = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressWithValueProps
>(({ className, valueClassName, value, position = "end", label, ...props }, ref) => {
  const valueCommonClass = cn("absolute -top-0.5 left-0 h-fit px-4 w-full items-center hidden")

  const ProgressValue = () => (
    <span
      className={cn(
        "hidden",
        position === "start-outside" && "text-primary block",
        position === "follow" && cn(valueCommonClass, "text-primary-foreground flex justify-end"),
        position === "start" && cn(valueCommonClass, "text-primary-foreground flex justify-start"),
        position === "end" && cn(valueCommonClass, "text-primary flex justify-end"),
        position === "end-outside" && "text-primary block",
        valueClassName,
      )}
    >
      {typeof label === "function" ? label(value) : `${value}%`}
    </span>
  )

  return (
    <div className="flex items-center gap-2">
      {position === "start-outside" && <ProgressValue />}
      <ProgressPrimitive.Root
        ref={ref}
        className={cn("bg-secondary relative h-5 w-full overflow-hidden rounded-full", className)}
        {...props}
      >
        <ProgressPrimitive.Indicator
          className="bg-primary h-full w-full flex-1 transition-all"
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        >
          {position === "follow" && <ProgressValue />}
        </ProgressPrimitive.Indicator>
        {(position === "start" || position === "end") && <ProgressValue />}
      </ProgressPrimitive.Root>
      {position === "end-outside" && <ProgressValue />}
    </div>
  )
})
ProgressWithValue.displayName = "ProgressWithValue"

export { ProgressWithValue }
