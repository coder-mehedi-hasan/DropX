"use client"

import * as React from "react"
import type { FieldPath, FieldValues } from "react-hook-form"

import { Input } from "../components/ui/input"
import { BoundFormField, FormControl } from "./form-field"
import { FieldShell, type SharedFieldProps } from "./form-field"

export type FormOtpInputProps<TFieldValues extends FieldValues> = SharedFieldProps & {
  name: FieldPath<TFieldValues>
  length?: number
  disabled?: boolean
  className?: string
}

export function FormOtpInput<TFieldValues extends FieldValues>({
  name,
  label,
  description,
  required,
  length = 6,
  disabled,
  className,
}: FormOtpInputProps<TFieldValues>) {
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([])

  React.useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  return (
    <BoundFormField
      name={name}
      render={({ field }) => {
        const value = typeof field.value === "string" ? field.value : ""

        function updateAt(index: number, digit: string) {
          const next = value.padEnd(length, " ").split("")
          next[index] = digit
          field.onChange(next.join("").replace(/\s+$/, ""))
        }

        return (
          <FieldShell label={label} description={description} required={required}>
            <FormControl>
              <div
                className={className ?? "flex justify-center gap-3"}
                role="group"
                aria-label={typeof label === "string" ? label : "Verification code"}
              >
                {Array.from({ length }, (_, index) => (
                  <Input
                    key={index}
                    ref={(element) => {
                      inputRefs.current[index] = element
                    }}
                    value={value[index] ?? ""}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    maxLength={1}
                    disabled={disabled}
                    aria-label={`Digit ${index + 1} of ${length}`}
                    className="size-12 rounded-lg p-0 text-center font-mono text-xl font-semibold"
                    onChange={(event) => {
                      const digit = event.target.value.replace(/\D/g, "").slice(-1)
                      updateAt(index, digit)
                      if (digit && index < length - 1) inputRefs.current[index + 1]?.focus()
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Backspace" && !value[index] && index > 0) {
                        inputRefs.current[index - 1]?.focus()
                      }
                    }}
                    onPaste={(event) => {
                      event.preventDefault()
                      const pasted = event.clipboardData
                        .getData("text")
                        .replace(/\D/g, "")
                        .slice(0, length)
                      if (!pasted) return
                      field.onChange(pasted)
                      inputRefs.current[Math.min(pasted.length, length) - 1]?.focus()
                    }}
                  />
                ))}
              </div>
            </FormControl>
          </FieldShell>
        )
      }}
    />
  )
}
