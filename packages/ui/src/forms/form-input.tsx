"use client"

import type * as React from "react"
import type { FieldPath, FieldValues } from "react-hook-form"

import { Input } from "../components/ui/input"
import { BoundFormField, FormControl } from "./form-field"
import { FieldShell, type SharedFieldProps } from "./form-field"

export type FormInputProps<TFieldValues extends FieldValues> = SharedFieldProps &
  Omit<React.ComponentProps<typeof Input>, "name" | "value" | "defaultValue" | "onChange"> & {
    name: FieldPath<TFieldValues>
  }

export function FormInput<TFieldValues extends FieldValues>({
  name,
  label,
  description,
  required,
  ...inputProps
}: FormInputProps<TFieldValues>) {
  return (
    <BoundFormField
      name={name}
      render={({ field }) => (
        <FieldShell label={label} description={description} required={required}>
          <FormControl>
            <Input {...inputProps} {...field} />
          </FormControl>
        </FieldShell>
      )}
    />
  )
}
