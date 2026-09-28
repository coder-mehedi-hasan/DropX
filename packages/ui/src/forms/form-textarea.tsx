"use client"

import type * as React from "react"
import type { FieldPath, FieldValues } from "react-hook-form"

import { Textarea } from "../components/ui/textarea"
import { BoundFormField, FormControl } from "./form-field"
import { FieldShell, type SharedFieldProps } from "./form-field"

export type FormTextareaProps<TFieldValues extends FieldValues> = SharedFieldProps &
  Omit<React.ComponentProps<typeof Textarea>, "name" | "value" | "defaultValue" | "onChange"> & {
    name: FieldPath<TFieldValues>
  }

export function FormTextarea<TFieldValues extends FieldValues>({
  name,
  label,
  description,
  required,
  ...textareaProps
}: FormTextareaProps<TFieldValues>) {
  return (
    <BoundFormField
      name={name}
      render={({ field }) => (
        <FieldShell label={label} description={description} required={required}>
          <FormControl>
            <Textarea {...textareaProps} {...field} />
          </FormControl>
        </FieldShell>
      )}
    />
  )
}
