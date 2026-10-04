"use client"

import { useEffect, useRef } from "react"
import type * as React from "react"
import { useFormContext, type FieldPath, type FieldValues } from "react-hook-form"

import { Input } from "../components/ui/input"
import { BoundFormField, FormControl, FieldShell, type SharedFieldProps } from "./form-field"

export type FormInputSlugProps<TFieldValues extends FieldValues> = SharedFieldProps &
  Omit<React.ComponentProps<typeof Input>, "name" | "value" | "defaultValue" | "onChange"> & {
    name: FieldPath<TFieldValues>
    inheritFrom: FieldPath<TFieldValues>
  }

function slugify(value: string): string {
  return value
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

export function FormInputSlug<TFieldValues extends FieldValues>({
  name,
  inheritFrom,
  label,
  description,
  required,
  ...inputProps
}: FormInputSlugProps<TFieldValues>) {
  const { watch, setValue, getValues } = useFormContext<TFieldValues>()
  const sourceValue = watch(inheritFrom)
  const lastGenerated = useRef<string | null>(null)

  useEffect(() => {
    if (!sourceValue) return
    const slug = slugify(String(sourceValue))
    const current = getValues(name)

    if (!current || current === lastGenerated.current) {
      lastGenerated.current = slug
      setValue(name, slug as never, { shouldValidate: true, shouldDirty: true })
    }
  }, [sourceValue, name, setValue, getValues])

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
