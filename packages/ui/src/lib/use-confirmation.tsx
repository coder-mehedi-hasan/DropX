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
import { Textarea } from "../components/ui/textarea"

/**
 * Confirmation for destructive or milestone actions.
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
 *
 * `reason` turns the dialog into a prompt with an **optional** free-text box
 * beside the question. Use `confirmWithReason` when you want the value back,
 * because the reason is only ever returned alongside the boolean answer; plain
 * `confirm` keeps resolving a boolean so older call sites never see it.
 */
export type ConfirmReasonOptions = {
  /** Label above the reason box. Defaults to "Reason (optional)". */
  label?: string
  placeholder?: string
}

export type ConfirmOptions = {
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Style the confirm button as destructive. Default true — most asks are deletes. */
  destructive?: boolean
  /** Require this exact text before the confirm button enables. */
  requireText?: string
  /** Collect an optional free-text reason aside the answer. */
  reason?: boolean | ConfirmReasonOptions
}

export type ConfirmResult = {
  confirmed: boolean
  reason: string
}

type PendingConfirm = ConfirmOptions & {
  resolve: (result: ConfirmResult) => void
}

export function useConfirmation() {
  const [pending, setPending] = React.useState<PendingConfirm | null>(null)
  const [typed, setTyped] = React.useState("")
  const [reason, setReason] = React.useState("")

  const ask = React.useCallback((options: ConfirmOptions) => {
    setTyped("")
    setReason("")
    return new Promise<ConfirmResult>((resolve) => setPending({ ...options, resolve }))
  }, [])

  const confirm = React.useCallback(
    (options: ConfirmOptions) => ask(options).then((result) => result.confirmed),
    [ask],
  )

  const confirmWithReason = React.useCallback((options: ConfirmOptions) => ask(options), [ask])

  const settle = React.useCallback(
    (confirmed: boolean) => {
      pending?.resolve({ confirmed, reason: confirmed ? reason.trim() : "" })
      setPending(null)
      setTyped("")
      setReason("")
    },
    [pending, reason],
  )

  // A confirm that resolves `true` because the component unmounted would be worse
  // than one that never resolves: the caller's `then` would run a delete the
  // user never agreed to. Resolve `false` on the way out.
  React.useEffect(() => () => pending?.resolve({ confirmed: false, reason: "" }), [pending])

  const reasonOptions =
    pending && pending.reason ? (typeof pending.reason === "boolean" ? {} : pending.reason) : null

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

        {reasonOptions && pending ? (
          <label className="space-y-2 text-sm">
            <span className="text-muted-foreground">
              {reasonOptions.label ?? "Reason (optional)"}
            </span>
            <Textarea
              rows={2}
              placeholder={reasonOptions.placeholder ?? "Optional note recorded with this action"}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
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

  return { confirm, confirmWithReason, confirmationDialog: dialog }
}
