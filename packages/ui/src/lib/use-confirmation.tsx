"use client"

import * as React from "react"

import { Button } from "../components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog"

/**
 * Confirmation for destructive actions.
 *
 * One dialog per provider, opened imperatively, rather than a controlled
 * `<Dialog>` per call site: deleting ten rows should not mean ten pieces of
 * open/close state threaded through ten components.
 *
 * `confirm` resolves rather than throws. A rejected action is a normal outcome
 * of asking, not an exception, and a `try/catch` at every call site would be
 * noise that trains people to swallow real errors too.
 *
 * `requireText` is for the irreversible ones — a name typed to confirm a delete
 * cannot be mis-clicked. It is opt-in because it is friction on purpose.
 */
export type ConfirmOptions = {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Style the confirm button as destructive. Default true — most asks are deletes. */
  destructive?: boolean
  /** Require this exact text before the confirm button enables. */
  requireText?: string
}

type PendingConfirm = ConfirmOptions & {
  resolve: (ok: boolean) => void
}

export function useConfirmation() {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null)
  const [typed, setTyped] = React.useState("")

  const confirm = React.useCallback((options: ConfirmOptions) => {
    setTyped("")
    return new Promise<boolean>((resolve) => setPending({ ...options, resolve }))
  }, [])

  const settle = React.useCallback(
    (ok: boolean) => {
      pending?.resolve(ok)
      setPending(null)
      setTyped("")
    },
    [pending],
  )

  // A confirm that resolves `true` because the component unmounted would be worse
  // than one that never resolves: the caller's `then` would run a delete the
  // user never agreed to. Resolve `false` on the way out.
  React.useEffect(() => () => pending?.resolve(false), [pending])

  const dialog = (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) settle(false)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{pending?.title ?? ""}</DialogTitle>
          {pending?.description ? (
            <DialogDescription>{pending.description}</DialogDescription>
          ) : null}
        </DialogHeader>

        {pending?.requireText ? (
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">
              Type <span className="text-foreground font-medium">{pending.requireText}</span> to
              continue
            </span>
            <input
              className="border-input bg-background focus-visible:border-primary focus-visible:ring-ring/40 w-full rounded-lg border px-3 py-2 outline-none focus-visible:ring-[3px]"
              value={typed}
              autoComplete="off"
              autoFocus
              onChange={(event) => setTyped(event.target.value)}
            />
          </label>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => settle(false)}>
            {pending?.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            type="button"
            variant={pending?.destructive === false ? "default" : "destructive"}
            disabled={Boolean(pending?.requireText) && typed !== pending?.requireText}
            onClick={() => settle(true)}
          >
            {pending?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return { confirm, confirmationDialog: dialog }
}
