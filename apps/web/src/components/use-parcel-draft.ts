"use client"

import * as React from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"
import { useQueryClient } from "@tanstack/react-query"

import { draftsApi } from "@/lib/api"
import { queryKeys, useMyParcelDraft } from "@/lib/queries"
import type { ParcelDraftPayload } from "@/lib/types"
import { useDebouncedValue } from "@/lib/use-debounced-value"

/**
 * Draft autosave for the booking form.
 *
 * Three moving parts, in strict order:
 *
 * 1. **Restore** runs once, after the session's draft query settles. If the
 *    customer already typed something (the query lost the race), their input
 *    wins and the draft is discarded rather than overwriting them.
 * 2. **Autosave** watches the whole form, serialises it to JSON, and debounces
 *    *that string* — a value debounce, so unrelated re-renders cannot restart
 *    the timer. Every save carries an AbortController: the next debounced save
 *    (or an unmount) cancels the previous request instead of racing it.
 * 3. **Discard** flips a ref that makes every later save a no-op, then deletes
 *    the row — called the moment a real booking succeeds, so a slow autosave
 *    can never resurrect a draft after the parcel exists.
 *
 * Saves are best-effort: a failure surfaces only as a small status label, never
 * as a form error, because a draft that missed a beat must not block booking.
 */

export type DraftSaveStatus = "idle" | "saving" | "saved" | "error"

type UseParcelDraftOptions<T extends FieldValues> = {
  form: UseFormReturn<T>
  /** False while signed out — no query, no saves, nothing to restore. */
  enabled: boolean
  /** True while the real booking is being created: never autosave then. */
  paused?: boolean
  /** Applies a restored payload to the form (and the wizard's step). */
  restore: (payload: ParcelDraftPayload) => void
}

const DEBOUNCE_MS = 1500

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError"
}

export function useParcelDraft<T extends FieldValues>({
  form,
  enabled,
  paused = false,
  restore,
}: UseParcelDraftOptions<T>) {
  const queryClient = useQueryClient()
  const draftQuery = useMyParcelDraft(enabled)

  const [status, setStatus] = React.useState<DraftSaveStatus>("idle")
  const [restored, setRestored] = React.useState(false)

  const restoredRef = React.useRef(false)
  const discardedRef = React.useRef(false)
  const lastSavedRef = React.useRef<string | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  // The inline `restore` callback is recreated every render; reading it
  // through a ref keeps the restore effect from re-running on each one.
  const restoreRef = React.useRef(restore)
  restoreRef.current = restore

  const isDirty = form.formState.isDirty
  const draftJson = JSON.stringify(form.watch())
  const debouncedJson = useDebouncedValue(draftJson, DEBOUNCE_MS)

  React.useEffect(() => {
    if (!enabled) return
    if (draftQuery.isFetching) return
    if (restoredRef.current) return
    restoredRef.current = true

    const payload = draftQuery.data?.payload
    if (payload && !form.formState.isDirty) {
      restoreRef.current(payload)
      // Seed the comparison with what the form now holds, so restoring a draft
      // does not immediately re-save the payload that was just fetched.
      lastSavedRef.current = JSON.stringify(form.getValues())
    }
    setRestored(true)
  }, [enabled, draftQuery.isFetching, draftQuery.data, form])

  React.useEffect(() => {
    if (!restored || !enabled || paused || discardedRef.current) return
    if (!isDirty) return
    if (debouncedJson === lastSavedRef.current) return

    const controller = new AbortController()
    abortRef.current?.abort()
    abortRef.current = controller
    setStatus("saving")

    draftsApi
      .save(JSON.parse(debouncedJson) as ParcelDraftPayload, controller.signal)
      .then((draft) => {
        lastSavedRef.current = debouncedJson
        setStatus("saved")
        queryClient.setQueryData(queryKeys.parcelDraft(), draft)
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        setStatus("error")
      })

    // A newer save, a paused booking, or an unmount supersedes this request.
    return () => controller.abort()
  }, [restored, enabled, paused, isDirty, debouncedJson, queryClient])

  /** Best-effort delete after a successful booking; always resolves. */
  const discard = React.useCallback(async () => {
    discardedRef.current = true
    abortRef.current?.abort()
    lastSavedRef.current = null
    queryClient.removeQueries({ queryKey: queryKeys.parcelDraft() })
    try {
      await draftsApi.discard()
    } catch {
      // A leftover row would be restored on the next visit, never mistaken
      // for a booking — not worth surfacing on the success path.
    }
  }, [queryClient])

  return { status, discard }
}
