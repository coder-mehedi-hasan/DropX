"use client"

import type { FieldPath, FieldValues } from "react-hook-form"

import { Checkbox } from "../components/ui/checkbox"
import { FormDescription, FormLabel, FormMessage, FormItem } from "../components/ui/form"
import { BoundFormField, FormControl } from "./form-field"
import { type SharedFieldProps } from "./form-field"

export type FormCheckboxProps<TFieldValues extends FieldValues> = SharedFieldProps & {
  name: FieldPath<TFieldValues>
  disabled?: boolean
}

export function FormCheckbox<TFieldValues extends FieldValues>({
  name,
  label,
  description,
  required,
  disabled,
}: FormCheckboxProps<TFieldValues>) {
  return (
    <BoundFormField
      name={name}
      render={({ field }) => (
        <FormItem>
          <div className="flex items-start gap-3">
            <FormControl>
              <Checkbox
                checked={field.value === true}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
                disabled={disabled}
              />
            </FormControl>
            {label ? (
              <FormLabel className="items-start leading-5 font-normal">
                {label}
                {required ? <span aria-hidden="true"> *</span> : null}
              </FormLabel>
            ) : null}
          </div>
          {description ? <FormDescription>{description}</FormDescription> : null}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
