import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormErrorSummary, FormSheetShell, ServerFormError, useServerErrors } from "@dropx/ui"
import { ServerError } from "@/components/server-error"

/**
 * Shared shell for every admin create/edit sheet.
 *
 * Features differ only in their fields (a hub carries a branch picker and a type
 * union; a zone carries a description; a vehicle carries a registration number
 * and a capacity), so the shell owns everything they share and asks the caller to
 * render the differing fields:
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
 * No generic over the value type. The schema is passed as a value and
 * `zodResolver` infers the value type from it — a generic constrained to
 * `FieldValues` is not enough, because `zodResolver`'s overloads expect a
 * `Zod3Type`/`Zod4Type`, and a bare `z.ZodType` infers `unknown`, which
 * react-hook-form refuses. The parcel create dialog gets the same behaviour by
 * naming its value type explicitly; here the shell is generic over the schema's
 * *value*, which is the same thing said one level up. Callers therefore cast
 * their own `handleSubmit` to `(values: Record<string, unknown>) => Promise<unknown>`,
 * which is the one assertion this component cannot do on their behalf.
 *
 * **`onSubmit` must reject when the save fails.** This shell has no `onError` of
 * its own to give: it learns about a failure the only way it can — by catching a
 * rejection from `onSubmit` and handing it to `useServerErrors`. A caller that
 * reaches for `mutation.mutate` instead of `await mutation.mutateAsync` hands back
 * a promise that resolves the instant the request is dispatched, so the banner
 * never appears and a 409 is discarded while the sheet sits there looking unsaved.
 * That is the whole reason `parcel-create-dialog` wires `onError: capture` itself
 * and this contract is stated here rather than left to be rediscovered.
 */
export function FormSheet({
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

  // A `details[].field` the form does not have is dropped rather than passed to
  // `setError`, which throws on an unknown path. Deriving the field names from the
  // schema means the guard cannot fall out of step with the form: a caller cannot
  // add a field and forget this, because there is nothing to keep in sync.
  const knownFields = React.useMemo(
    () => (schema instanceof z.ZodObject ? new Set(Object.keys(schema.shape)) : undefined),
    [schema],
  )
  const isKnownField = React.useCallback(
    (field: string) => (knownFields ? knownFields.has(field) : true),
    [knownFields],
  )

  const {
    error: serverError,
    capture,
    clear,
  } = useServerErrors(form.setError as never, isKnownField)

  async function handleSubmit(values: Record<string, unknown>) {
    try {
      // Clear first, so the banner and the fields it is mapped onto describe the
      // attempt in flight rather than the one before it. Without this a stale
      // "code already exists" sits on screen through the retry that is fixing it.
      clear()
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
