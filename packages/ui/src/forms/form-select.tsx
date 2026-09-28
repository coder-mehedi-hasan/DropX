"use client"

import type * as React from "react"
import type { FieldPath, FieldValues } from "react-hook-form"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select"
import { BoundFormField, FormControl } from "./form-field"
import { FieldShell, type SharedFieldProps } from "./form-field"

export type FormSelectOption = {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

export type FormSelectProps<TFieldValues extends FieldValues> = SharedFieldProps & {
  name: FieldPath<TFieldValues>
  options: readonly FormSelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function FormSelect<TFieldValues extends FieldValues>({
  name,
  label,
  description,
  required,
  options,
  placeholder = "Select an option",
  disabled,
  className,
}: FormSelectProps<TFieldValues>) {
  return (
    <BoundFormField
      name={name}
      render={({ field }) => (
        <FieldShell label={label} description={description} required={required}>
          <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={disabled}>
            <FormControl>
              <SelectTrigger className={className ?? "w-full"}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldShell>
      )}
    />
  )
}
