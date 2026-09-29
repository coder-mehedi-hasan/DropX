import { AlertTriangle, ClipboardList, X } from "lucide-react"
import * as React from "react"
import type { FieldErrors, FieldValues, Path, UseFormSetError } from "react-hook-form"

import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert"
import { Button } from "../components/ui/button"

/**
 * Server errors, mapped onto a form.
 *
 * An API rejects a write with a code, a message, and an optional `details[]`
 * naming which fields were wrong. That last channel is the only machine-readable
 * one, and a bare banner reading "originHubId is required" while the user stares
 * at a form they just filled in is the worst outcome available — so each detail
 * becomes a real message under the input it names, and whatever is left over is
 * rolled up into a summary.
 *
 * **Transport-agnostic on purpose.** The shape below is a structural subset of
 * the API's error envelope, so this file depends on no app's `api-client` and no
 * `ApiError` class. Each app keeps its own typed error; this recognises it by
 * shape. That is what lets `packages/ui` host it without importing from `apps/*`.
 */

export type ServerFieldError = { field?: string; message: string }

/** The subset of an app's `ApiError` this module needs. */
export type ServerErrorLike = {
  message: string
  code?: string
  details?: ServerFieldError[]
}

export function isServerErrorLike(error: unknown): error is ServerErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  )
}

function detailsOf(error: unknown): ServerFieldError[] {
  if (!isServerErrorLike(error)) return []
  return Array.isArray(error.details) ? error.details : []
}

function codeOf(error: unknown): string {
  return isServerErrorLike(error) && typeof error.code === "string" ? error.code : "CLIENT_ERROR"
}

function messageOf(error: unknown): string {
  if (isServerErrorLike(error)) return error.message
  return error instanceof Error ? error.message : "Something went wrong."
}

/**
 * Pushes `details[]` onto the owning inputs.
 *
 * A field the API names but the form does not have is dropped rather than cast
 * in blindly — `setError` on an unknown path throws in react-hook-form, and a
 * server inventing a field name is not a reason to crash the form over it.
 */
export function applyServerFieldErrors<TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
  isKnownField: (field: string) => boolean = () => true,
): number {
  if (!isServerErrorLike(error)) return 0

  let applied = 0
  for (const detail of detailsOf(error)) {
    if (!detail.field || !detail.message) continue
    if (!isKnownField(detail.field)) continue
    setError(detail.field as Path<TFieldValues>, { message: detail.message, type: "server" })
    applied += 1
  }
  return applied
}

/**
 * Owns the one `error` state a form needs.
 *
 * Success and failure are handled in different places on purpose: a successful
 * save toasts and closes, while a failure has to keep the sheet open with the
 * user's input intact so the details can be mapped back onto their fields. One
 * state, cleared on the next attempt, is what stops a stale banner from
 * outliving the thing that caused it.
 */
export function useServerErrors<TFieldValues extends FieldValues>(
  setError: UseFormSetError<TFieldValues>,
  isKnownField?: (field: string) => boolean,
) {
  const [error, setError_] = React.useState<unknown>(null)

  const capture = React.useCallback(
    (next: unknown) => {
      applyServerFieldErrors(next, setError, isKnownField)
      setError_(next)
    },
    [setError, isKnownField],
  )

  const clear = React.useCallback(() => setError_(null), [])

  return { error, capture, clear, setError: setError_ }
}

/* ------------------------------------------------------------------ *
 * Presentation
 * ------------------------------------------------------------------ */

export function ServerFormError({
  error,
  title,
  onDismiss,
}: {
  error: unknown
  title: string
  onDismiss?: () => void
}) {
  if (!error) return null

  const details = detailsOf(error)

  return (
    <Alert variant="destructive" data-slot="server-form-error">
      <AlertTriangle />
      <AlertTitle className="flex items-center gap-2">
        {title}
        {onDismiss ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={onDismiss}
            aria-label="Dismiss error"
          >
            <X />
          </Button>
        ) : null}
      </AlertTitle>
      <AlertDescription>
        <p>{messageOf(error)}</p>
        {details.length > 0 ? (
          <ul className="ml-4 list-disc space-y-0.5">
            {details.map((detail, index) => (
              <li key={`${detail.field ?? "general"}-${index}`}>
                {detail.field ? <span className="font-medium">{detail.field}: </span> : null}
                {detail.message}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs opacity-70">Code: {codeOf(error)}</p>
      </AlertDescription>
    </Alert>
  )
}

type ErrorLeaf = { message?: string; type?: string }
type ErrorNode = ErrorLeaf | ErrorNode[] | { [key: string]: ErrorNode | undefined } | undefined

function isLeaf(node: ErrorNode): node is ErrorLeaf {
  return typeof node === "object" && node !== null && !Array.isArray(node) && "type" in node
}

function collect(field: string, node: ErrorNode, out: { field: string; message: string }[]): void {
  if (!node) return

  if (isLeaf(node)) {
    if (typeof node.message === "string" && node.message.length > 0)
      out.push({ field, message: node.message })
    return
  }

  if (Array.isArray(node)) {
    node.forEach((entry, index) => collect(`${field}.${index}`, entry, out))
    return
  }

  for (const [key, entry] of Object.entries(node)) collect(`${field}.${key}`, entry, out)
}

/**
 * Roll-up of every outstanding validation failure.
 *
 * `FormMessage` already renders an error under the input that owns it, so this
 * is for what is left: array-level problems, and fields with no visible input.
 * Without it a rejected save can fail silently in a corner of a long form.
 */
export function FormErrorSummary<TFieldValues extends FieldValues>({
  errors,
  labels,
  title = "Fix these before saving",
}: {
  errors: FieldErrors<TFieldValues>
  /** Field name → human label. Unlisted names fall back to the raw name. */
  labels?: Record<string, string>
  title?: string
}) {
  const entries = React.useMemo(() => {
    const out: { field: string; message: string }[] = []
    for (const [field, value] of Object.entries(errors as Record<string, ErrorNode>)) {
      collect(field, value, out)
    }
    return out
  }, [errors])

  if (entries.length === 0) return null

  const labelFor = (field: string) => {
    const base = field.split(".")[0] ?? field
    return labels?.[base] ?? base
  }

  return (
    <Alert variant="warning" data-slot="form-error-summary">
      <ClipboardList />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <ul className="ml-4 list-disc space-y-0.5">
          {entries.map((entry) => (
            <li key={`${entry.field}:${entry.message}`}>
              <span className="font-medium">{labelFor(entry.field)}: </span>
              {entry.message}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
