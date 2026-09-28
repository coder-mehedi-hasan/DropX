"use client"

import * as React from "react"
import type { FieldPath, FieldValues } from "react-hook-form"
import { EyeIcon, EyeOffIcon } from "lucide-react"

import { Input } from "../components/ui/input"
import { BoundFormField, FormControl } from "./form-field"
import { FieldShell, type SharedFieldProps } from "./form-field"

export type FormPasswordInputProps<TFieldValues extends FieldValues> = SharedFieldProps &
  Omit<
    React.ComponentProps<typeof Input>,
    "name" | "type" | "value" | "defaultValue" | "onChange"
  > & {
    name: FieldPath<TFieldValues>
  }

export function FormPasswordInput<TFieldValues extends FieldValues>({
  name,
  label,
  description,
  required,
  ...inputProps
}: FormPasswordInputProps<TFieldValues>) {
  const [visible, setVisible] = React.useState(false)

  return (
    <BoundFormField
      name={name}
      render={({ field }) => (
        <FieldShell label={label} description={description} required={required}>
          <div className="relative">
            <FormControl>
              <Input
                {...inputProps}
                {...field}
                type={visible ? "text" : "password"}
                className="pr-11"
              />
            </FormControl>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-md outline-none focus-visible:ring-2"
              onClick={() => setVisible((current) => !current)}
              aria-label={visible ? "Hide password" : "Show password"}
            >
              {visible ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </FieldShell>
      )}
    />
  )
}
