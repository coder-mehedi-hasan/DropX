"use client"

import * as React from "react"

import { Button } from "../components/ui/button"
import { LoadingButton } from "../components/ui/loading-button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet"

/**
 * The one create/edit overlay, for all CRUD.
 *
 * Decided once here so twenty screens do not each answer "dialog or sheet?"
 * differently. A sheet is right when the form is one scrollable column of
 * fields, which is every DropX CRUD form so far; a genuinely multi-section
 * entity (more than a couple of pages) should be a route instead, and this
 * component is not that.
 *
 * Three things it does that a bare `<Sheet>` does not:
 *
 * 1. **Blocks closing mid-save.** A dismiss during a pending mutation loses the
 *    response — the sheet vanishes and the toast arrives into nothing. The
 *    overlay and the escape key both respect `busy`.
 * 2. **Owns the scroll region.** The form scrolls, the header and footer stay
 *    put, so a long form never pushes its own submit button off screen.
 * 3. **Supplies the remount key.** See `useFormSheetState` — without it, Radix
 *    keeps the previous entity's DOM and an edit sheet opens pre-filled with
 *    whatever was open before.
 */
export function FormSheetShell({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  busy = false,
  onSubmit,
  onReset,
  onClose,
  maxWidth = "sm:max-w-3xl",
  footerExtra,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  submitLabel?: string
  /** Pending save. Locks dismissal and swaps the submit button for a spinner. */
  busy?: boolean
  onSubmit?: () => void
  /** Reset the form when the sheet opens. A create sheet starts blank; an edit
   *  sheet starts with the record's values, so callers decide which. */
  onReset?: () => void
  /** Clear transient state (errors, toasts) when the sheet closes. */
  onClose?: () => void
  /** Width override. The default is the wide one — most CRUD forms are two
   *  columns wide, and a 384px sheet is a cramped one. */
  maxWidth?: string
  /** Anything left of the footer that is not a button — e.g. a delete link. */
  footerExtra?: React.ReactNode
  children: React.ReactNode
}) {
  function requestClose(next: boolean) {
    // A close requested while saving is dropped, not deferred — re-opening
    // afterwards would be surprising, and the save is about to report itself.
    if (busy && !next) return
    if (next) onReset?.()
    else onClose?.()
    onOpenChange(next)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={requestClose}
      // Escape and outside-click both route through onOpenChange, so `busy`
      // above is what stops either from discarding a pending save.
    >
      <SheetContent className={`w-full gap-0 p-0 ${maxWidth}`}>
        <SheetHeader className="border-b">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>

        {/*
          The form element wraps the scroll region so `onSubmit` is a real
          submit — Enter in any field books the parcel, same as clicking.
        */}
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            onSubmit?.()
          }}
          noValidate
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">{children}</div>

          <SheetFooter className="bg-background flex-row items-center justify-end gap-2 border-t">
            {footerExtra ? <div className="mr-auto">{footerExtra}</div> : null}
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => requestClose(false)}
            >
              Cancel
            </Button>
            <LoadingButton type="submit" loading={busy}>
              {submitLabel ?? "Save"}
            </LoadingButton>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

/**
 * Sheet state for one entity, with the remount key that goes with it.
 *
 * Returns a `key` for the sheet subtree. Changing the key remounts the form, so
 * switching from editing parcel A to parcel B cannot leave A's values behind —
 * the failure mode when a sheet is reused across entities is a form that looks
 * populated and is quietly saving the wrong record.
 *
 * `open` and `onOpenChange` are returned separately rather than folded into one
 * setter so a caller can still reset the form on open.
 */
export function useFormSheetState<TId extends string | number>() {
  const [open, setOpen] = React.useState(false)
  // `null` is the "new" case, so the state is TId | null rather than TId — a
  // caller that only ever edits existing records still gets create for free.
  const [activeId, setActiveId] = React.useState<TId | null>(null)

  // Changing what is open re-keys the sheet, which is what makes it clean.
  const key = `${activeId ?? "new"}`

  const openFor = React.useCallback((id: TId) => {
    setActiveId(id)
    setOpen(true)
  }, [])

  const openNew = React.useCallback(() => {
    setActiveId(null)
    setOpen(true)
  }, [])

  const onOpenChange = React.useCallback((next: boolean) => setOpen(next), [])

  return {
    open,
    onOpenChange,
    openFor,
    openNew,
    close: React.useCallback(() => setOpen(false), []),
    activeId,
    /** Pass to the sheet subtree: `<FormSheetShell key={sheet.key} …>`. */
    key,
    /** Non-null exactly when the sheet is open on an existing entity. */
    isEditing: open && activeId !== null,
  }
}
