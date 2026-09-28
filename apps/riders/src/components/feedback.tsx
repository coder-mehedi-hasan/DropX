import { AlertCircle, RefreshCw, TriangleAlert, WifiOff } from "lucide-react"
import type { ReactNode } from "react"
import { Alert, AlertDescription, AlertTitle, Button, Skeleton } from "@dropx/ui"
import { isApiError } from "../lib/api-client"

type DescribedError = {
  title: string
  message: string
}

export function describeApiError(error: unknown): DescribedError {
  if (isApiError(error)) {
    if (error.isOffline) {
      return {
        title: "No connection",
        message: "DropX could not be reached. Your last loaded jobs are still listed below.",
      }
    }
    if (error.isUnauthenticated) {
      return { title: "Session ended", message: "Sign in again to keep working your route." }
    }
    if (error.isForbidden) {
      return {
        title: "Not available to your account",
        message:
          "The API refused this request for your rider account. Ask dispatch to check the rider permissions on your role.",
      }
    }
    return { title: "Could not load", message: error.message }
  }
  return {
    title: "Could not load",
    message: "Something went wrong. Please try again.",
  }
}

export function ScreenPending({ label = "Loading" }: { label?: string }): ReactNode {
  return (
    <div className="flex flex-col items-center gap-4 py-16" role="status" aria-live="polite">
      <div className="w-full max-w-xs space-y-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  )
}

export function ErrorNotice({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}): ReactNode {
  const { title, message } = describeApiError(error)
  const offline = isApiError(error) && error.isOffline

  return (
    <Alert variant={offline ? "warning" : "destructive"}>
      {offline ? <WifiOff /> : <AlertCircle />}
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        {onRetry ? (
          <Button variant="outline" size="lg" className="tap-target" onClick={onRetry}>
            <RefreshCw />
            Try again
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}

/**
 * Offline-tolerant banner.
 *
 * A failed refetch must never blank a list a rider is working from, so the last
 * known rows stay on screen and this explains that they may be out of date.
 */
export function StaleDataNotice({ onRetry }: { onRetry: () => void }): ReactNode {
  return (
    <Alert variant="warning">
      <TriangleAlert />
      <AlertTitle>Showing the last jobs we loaded</AlertTitle>
      <AlertDescription>
        <p>These may be out of date. Pull the list again when you have signal.</p>
        <Button variant="outline" size="lg" className="tap-target" onClick={onRetry}>
          <RefreshCw />
          Refresh
        </Button>
      </AlertDescription>
    </Alert>
  )
}
