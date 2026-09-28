"use client"

import type * as React from "react"
import {
  useFormContext,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"
import {
  FormControl,
  FormDescription,
  FormField as PrimitiveFormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../components/ui/form"

export type SharedFieldProps = {
  label?: React.ReactNode
  description?: React.ReactNode
  required?: boolean
}

export function FieldShell({
  label,
  description,
  required,
  children,
}: SharedFieldProps & { children: React.ReactNode }) {
  return (
    <FormItem>
      {label ? (
        <FormLabel>
          {label}
          {required ? <span aria-hidden="true"> *</span> : null}
        </FormLabel>
      ) : null}
      {children}
      {description ? <FormDescription>{description}</FormDescription> : null}
      <FormMessage />
    </FormItem>
  )
}

export function BoundFormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: Omit<ControllerProps<TFieldValues, TName>, "control">) {
  const { control } = useFormContext<TFieldValues>()

  return <PrimitiveFormField control={control} {...props} />
}

export { FormControl }
