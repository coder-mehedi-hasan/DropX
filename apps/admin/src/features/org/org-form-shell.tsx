import type * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormErrorSummary, FormSheetShell, ServerFormError, useServerErrors } from "@dropx/ui"
import { ServerError } from "@/components/server-error"

/**
 * Shared shell for every `org` create/edit overlay.
 *
 * Branches and hubs differ in their extra fields (a hub carries a branch
 * picker and a type union; a branch carries phone and city), so the shell owns
 * everything they share and asks the caller to render the differing fields:
 *
 * - the `<form>` and the scroll region (`FormSheetShell` provides it)
 * - `useServerErrors` — server errors map onto fields and the banner holds
 *   for one render so the two can never disagree
 * - the `onReset`/`onClose` split: reset on open (a create starts blank, an
 *   edit starts with the record's values), clear transient state on close
 *
 * The form is built here and handed to `renderFields` because react-hook-form
 * needs one owner. `onSubmit` receives the validated values; the shell calls
 * it on submit and the form's own validation runs first, so a client-side
 * error never reaches the endpoint and a server error never reaches a field
 * that does not exist.
 *
 * No generic. The schema is passed as a value and `zodResolver` infers the
 * value type from it — a generic constrained to `FieldValues` is not enough,
 * because `zodResolver`'s overloads expect a `Zod3Type`/`Zod4Type`, and a bare
 * `z.ZodType` infers `unknown`, which react-hook-form refuses. The parcel
 * create dialog gets the same behaviour by naming its value type explicitly;
 * here the shell is generic over the schema's *value*, which is the same thing
 * said one level up.
 */
export function OrgFormShell({
  schema,
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  busy,
  defaults,
  fieldLabels,
  onSubmit,
  error,
  renderFields,
}: {
  schema: z.ZodType<Record<string, unknown>>
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  submitLabel: string
  busy: boolean
  defaults: Record<string, unknown>
  fieldLabels: Record<string, string>
  onSubmit: (values: Record<string, unknown>) => Promise<unknown>
  error: unknown
  renderFields: (form: { control: unknown }) => React.ReactNode
}) {
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver(schema as never) as never,
    defaultValues: defaults,
  })

  const { error: serverError, capture, clear } = useServerErrors(form.setError as never)

  async function handleSubmit(values: Record<string, unknown>) {
    try {
      await onSubmit(values)
    } catch (e) {
      capture(e as never)
    }
  }

  return (
    <FormSheetShell
      open={open}
      title={title}
      description={description}
      submitLabel={submitLabel}
      busy={busy}
      onOpenChange={(next) => {
        if (busy) return
        if (next) form.reset(defaults)
        clear()
        onOpenChange(next)
      }}
      onReset={() => form.reset(defaults)}
      onClose={clear}
      onSubmit={form.handleSubmit(handleSubmit as never)}
    >
      <Form {...form}>
        <ServerError error={error} title="Could not load this record" />
        <ServerFormError error={serverError} title={title} onDismiss={clear} />
        <FormErrorSummary
          errors={form.formState.errors}
          labels={fieldLabels}
          title="Fix these before saving"
        />
        {renderFields({ control: form.control })}
      </Form>
    </FormSheetShell>
  )
}
