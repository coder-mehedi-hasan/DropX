"use client"

import { toast as sonnerToast } from "sonner"

/**
 * App-level toast surface.
 *
 * **Success only, by design.** A failure toast is the wrong tool: it disappears
 * before it can be read, and a rejected save has to keep the form open with the
 * user's input intact so `details[]` can be mapped back onto the fields it names.
 * Every API failure belongs in `ServerFormError` instead.
 *
 * Because this module does not export a general `error`, the one way to put a
 * failure on screen is to reach past it for `sonner` directly — which is a
 * deliberate bit of friction. If a screen seems to need an error toast, the fix
 * is almost always a banner, not a wider API here.
 *
 * Every message carries its own text label rather than relying on colour alone,
 * which the brand guidelines require of every status surface.
 */
export const AppToast = {
  success(message: string, options?: { description?: string }): string | number {
    return sonnerToast.success(message, options)
  },

  /** Neutral progress note — e.g. "copying" before a confirmation. */
  message(message: string, options?: { description?: string }): string | number {
    return sonnerToast(message, options)
  },

  /**
   * The one deliberate exception, for a **local** failure with no form to keep
   * open: a clipboard write that the browser refused, a download that never
   * started. Clicking "Copy" and seeing nothing happen is its own bug, and
   * there is no field to put a banner on.
   *
   * It is not a hole in the API rule. An API rejection always belongs in
   * `ServerFormError`, because that is the only path that can keep the user's
   * input intact and map `details[]` onto the fields it names. If you are
   * reaching for this after a request failed, you want `ServerFormError`
   * instead.
   */
  failure(message: string, options?: { description?: string }): string | number {
    return sonnerToast.error(message, options)
  },

  dismiss(id?: string | number): void {
    if (id === undefined) sonnerToast.dismiss()
    else sonnerToast.dismiss(id)
  },
}
