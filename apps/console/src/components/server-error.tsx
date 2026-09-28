import { AlertTriangle, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle, Button } from "@dropx/ui"

import { ApiError } from "@/lib/api-client"

/**
 * The single failure surface for a screen.
 *
 * Per the console's data contract, API failures render here — as the first child
 * of the form or above the list toolbar — instead of a toast. A toast disappears
 * before it can be read, and the form must stay open with the user's input
 * intact so a validation `details[]` entry can be mapped back onto its field.
 */
export function ServerError({
  error,
  title,
  onDismiss,
}: {
  error: unknown
  title: string
  onDismiss?: () => void
}) {
  if (!error) return null

  const isApi = error instanceof ApiError
  const code = isApi ? error.code : "CLIENT_ERROR"
  const message = isApi
    ? error.message
    : error instanceof Error
      ? error.message
      : "Something went wrong."

  const fieldErrors = isApi ? error.details : []

  return (
    <Alert variant="destructive">
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
        <p>{message}</p>
        {fieldErrors.length > 0 ? (
          <ul className="ml-4 list-disc space-y-0.5">
            {fieldErrors.map((detail, index) => (
              <li key={`${detail.field ?? "general"}-${index}`}>
                {detail.field ? <span className="font-medium">{detail.field}: </span> : null}
                {detail.message}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs opacity-70">Code: {code}</p>
      </AlertDescription>
    </Alert>
  )
}
