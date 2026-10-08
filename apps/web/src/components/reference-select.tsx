"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@dropx/ui"
import * as React from "react"

import type { ReferenceOption } from "@/lib/reference-data"

export function ReferenceSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  loading = false,
}: {
  value: string
  onValueChange: (value: string) => void
  options: ReferenceOption[]
  placeholder: string
  className?: string
  /** Upstream selection not made yet — render a disabled trigger, not the missing-endpoint state. */
  loading?: boolean
}) {
  const isEmpty = options.length === 0

  if (loading) {
    return (
      <div className={cn("grid gap-2", className)}>
        <Select disabled>
          <SelectTrigger className="w-full" aria-label={placeholder}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
        </Select>
      </div>
    )
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Select value={isEmpty ? undefined : value} onValueChange={onValueChange} disabled={isEmpty}>
        <SelectTrigger className="w-full" aria-label={placeholder}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        {!isEmpty ? (
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                <span className="grid gap-0.5">
                  <span>{option.label}</span>
                  {option.description ? (
                    <span className="text-muted-foreground text-xs">{option.description}</span>
                  ) : null}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        ) : null}
      </Select>
    </div>
  )
}
