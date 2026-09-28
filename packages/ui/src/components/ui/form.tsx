"use client"

import * as LabelPrimitive from "@radix-ui/react-label"
import { Slot } from "@radix-ui/react-slot"
import * as React from "react"
import {
  Controller,
  FormProvider,
  useFormContext,
  useFormState,
  type ControllerProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"

import { cn } from "../../lib/cn"
import { Label } from "./label"

/**
 * Form / FormField.
 *
 * `FormProvider` + `Controller` from react-hook-form, so DropX forms get a single
 * resolver (`zodResolver` from `@hookform/resolvers/zod`) and one `formState`
 * subscription rather than per-field `useForm` calls that re-render every input on
 * every keystroke.
 */
export function Form<TFieldValues extends FieldValues = FieldValues>({
  ...props
}: React.ComponentProps<typeof FormProvider<TFieldValues>>) {
  return <FormProvider {...props} />
}

const FormFieldContext = React.createContext<string | null>(null)
const FormItemContext = React.createContext<{ id: string } | null>(null)

/**
 * FormField.
 *
 * Wires a control to react-hook-form by field path and generates the id that every
 * other Form sub-component uses to point `htmlFor` / `aria-describedby` at the right
 * element, so a field's label, control, hint and error message stay associated for
 * screen readers without the caller passing ids around.
 */
export function FormField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({ ...props }: ControllerProps<TFieldValues, TName>) {
  const id = React.useId()

  return (
    <FormFieldContext.Provider value={props.name}>
      <FormItemContext.Provider value={{ id }}>
        <Controller {...props} />
      </FormItemContext.Provider>
    </FormFieldContext.Provider>
  )
}

/**
 * useFormField.
 *
 * Throws rather than returning null when used outside `FormField`: this is always a
 * wiring mistake in a component, and failing at render tells the author which form
 * is missing the wrapper instead of silently producing an unlabelled input.
 */
function useFormField() {
  const fieldContext = React.useContext(FormFieldContext)
  const itemContext = React.useContext(FormItemContext)
  const { getFieldState } = useFormContext()
  const formState = useFormState({ name: fieldContext ?? undefined })

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>")
  }
  if (!itemContext) {
    throw new Error("useFormField should be used within <FormItem>")
  }

  const { id } = itemContext
  const fieldState = getFieldState(fieldContext, formState)

  return {
    id,
    name: fieldContext,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  }
}

export function FormItem({ className, ...props }: React.ComponentProps<"div">) {
  const { id } = useFormField()

  return (
    <FormItemContext.Provider value={{ id }}>
      <div data-slot="form-item" className={cn("grid gap-2", className)} {...props} />
    </FormItemContext.Provider>
  )
}

export function FormLabel({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  const { formItemId, error } = useFormField()

  return (
    <Label
      data-slot="form-label"
      data-error={!!error}
      className={cn("data-[error=true]:text-destructive", className)}
      htmlFor={formItemId}
      {...props}
    />
  )
}

export function FormControl({ ...props }: React.ComponentProps<typeof Slot>) {
  const { formItemId, formDescriptionId, formMessageId, error } = useFormField()

  return (
    <Slot
      data-slot="form-control"
      id={formItemId}
      aria-describedby={error ? `${formDescriptionId} ${formMessageId}` : formDescriptionId}
      aria-invalid={!!error}
      {...props}
    />
  )
}

export function FormDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { formDescriptionId } = useFormField()

  return (
    <p
      data-slot="form-description"
      id={formDescriptionId}
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

/**
 * FormMessage.
 *
 * Renders nothing until there is something to say, and falls back to a `children`
 * string so a caller can show a server-side validation error (e.g. a rejected
 * parcel booking) through the same live region as client-side rule failures.
 */
export function FormMessage({ className, children, ...props }: React.ComponentProps<"p">) {
  const { formMessageId, error } = useFormField()
  const body = error ? String(error?.message ?? "") : children

  if (!body) {
    return null
  }

  return (
    <p
      data-slot="form-message"
      id={formMessageId}
      className={cn("text-destructive text-sm font-medium", className)}
      {...props}
    >
      {body}
    </p>
  )
}

export { useFormField }
