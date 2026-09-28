import { AlertTriangle, Loader2, RefreshCw } from "lucide-react"
import type { ErrorComponentProps } from "@tanstack/react-router"
import { Alert, AlertDescription, AlertTitle, Button } from "@dropx/ui"

/**
 * Shared route boundaries.
 *
 * Both are used from `rootRoute`, so a crashed screen anywhere in the rider app
 * gets the same readable, thumb-sized recovery control instead of a raw error
 * page — a blank page on a phone in a dead spot is indistinguishable from a
 * crashed app.
 */

export function RoutePending() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="text-muted-foreground flex min-h-dvh flex-col items-center justify-center gap-3"
    >
      <Loader2 className="size-8 animate-spin" aria-hidden />
      <p className="text-sm">Loading…</p>
    </div>
  )
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>This screen could not open</AlertTitle>
        <AlertDescription>
          <p>{error instanceof Error ? error.message : "An unexpected error occurred."}</p>
          <Button variant="outline" size="lg" className="tap-target" onClick={() => reset()}>
            <RefreshCw />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </main>
  )
}
