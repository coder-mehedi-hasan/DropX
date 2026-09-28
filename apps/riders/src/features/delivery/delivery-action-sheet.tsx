import { zodResolver } from "@hookform/resolvers/zod"
import { CheckCircle2, ChevronLeft, Loader2, Undo2, XCircle } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
} from "@dropx/ui"

import { describeApiError } from "../../components/feedback"
import { isApiError } from "../../lib/api-client"
import { useUpdateJobStatus } from "../jobs/job-queries"
import { DELIVERY_STATUS_LABELS, type JobOutcome } from "../jobs/jobs.api"

const FAILED_REASONS = [
  "Recipient not available",
  "Recipient refused the parcel",
  "Address could not be found",
  "Phone number unreachable",
  "Parcel arrived damaged",
] as const

const RETURNED_REASONS = [
  "Recipient refused the parcel",
  "Address could not be found",
  "Phone number unreachable",
  "Too many attempts made",
  "Not collectable at the hub",
] as const

type ReasonOutcome = "FAILED" | "RETURNED"

/**
 * `FAILED` and `RETURNED` share one step because they are the same decision — this
 * attempt ends here — and the API takes one free-text `reason` for both. Keeping
 * the preset lists apart stops a rider handing support a reason that belongs to
 * the other outcome.
 */
const REASON_PRESETS: Record<ReasonOutcome, readonly string[]> = {
  FAILED: FAILED_REASONS,
  RETURNED: RETURNED_REASONS,
}

const DONE_COPY: Record<JobOutcome, string> = {
  OUT_FOR_DELIVERY: "The job list has been refreshed.",
  DELIVERED: "The job list has been refreshed.",
  FAILED: "This attempt stays on your failed list until dispatch re-assigns it.",
  RETURNED: "The parcel goes back to the hub, and the sender is told it did not reach them.",
}

const DONE_TONES: Record<JobOutcome, "success" | "warning"> = {
  OUT_FOR_DELIVERY: "success",
  DELIVERED: "success",
  FAILED: "warning",
  RETURNED: "warning",
}

/**
 * The reason is a `string` rather than the preset tuple's union so an unselected
 * Select is representable as `""` and the refine can own the "choose a reason"
 * message — the same thing a `z.enum` would do, without a default that lies
 * about what the rider picked. The API rejects a blank reason for either outcome,
 * so the refine is the only thing standing between a rider and a support ticket.
 */
function reasonSchema(outcome: ReasonOutcome) {
  return z.object({
    reason: z.string().refine((value) => REASON_PRESETS[outcome].includes(value), {
      error: "Choose a reason",
    }),
    note: z.string().trim().max(500, "Keep the note under 500 characters"),
  })
}

type ReasonForm = z.infer<ReturnType<typeof reasonSchema>>

const deliveredSchema = z.object({
  note: z.string().trim().max(500, "Keep the note under 500 characters"),
})

type Step = "choose" | "delivered" | "reason" | "done"

type DeliveryActionSheetProps = {
  parcelId: string
  trackingNumber: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCompleted: (status: JobOutcome) => void
}

/**
 * The outcomes a rider can report at the door.
 *
 * `PATCH /jobs/:id/status` requires a non-empty `reason` for `FAILED` and
 * `RETURNED` and rejects the request without one, so the preset is required
 * client-side too — that is what makes "mark failed" impossible to submit blank.
 *
 * Every step confirms before it writes: a mis-tap that marks a parcel delivered
 * is a dispatch incident, so a gloved thumb gets a deliberate second action.
 */
export function DeliveryActionSheet({
  parcelId,
  trackingNumber,
  open,
  onOpenChange,
  onCompleted,
}: DeliveryActionSheetProps) {
  const [step, setStep] = useState<Step>("choose")
  const [outcome, setOutcome] = useState<JobOutcome | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const mutation = useUpdateJobStatus()

  const reasonOutcome: ReasonOutcome = outcome === "RETURNED" ? "RETURNED" : "FAILED"

  const deliveredForm = useForm<z.infer<typeof deliveredSchema>>({
    resolver: zodResolver(deliveredSchema),
    defaultValues: { note: "" },
  })
  const reasonForm = useForm<ReasonForm>({
    resolver: zodResolver(reasonSchema(reasonOutcome)),
    defaultValues: { reason: "", note: "" },
  })

  const close = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("choose")
      setOutcome(null)
      setFailure(null)
      deliveredForm.reset()
      reasonForm.reset()
    }
    onOpenChange(isOpen)
  }

  const openReason = (next: ReasonOutcome) => {
    setOutcome(next)
    setFailure(null)
    reasonForm.reset()
    setStep("reason")
  }

  const run = (status: JobOutcome, reason?: string) => {
    setFailure(null)
    mutation.mutate(
      { parcelId, status, ...(reason ? { reason } : {}) },
      {
        onSuccess: () => {
          setOutcome(status)
          setStep("done")
          onCompleted(status)
        },
        onError: (error) => {
          const reasonRejected = isApiError(error) ? error.fieldMessage("reason") : undefined
          if (step === "reason" && reasonRejected) {
            reasonForm.setError("reason", { message: reasonRejected })
          } else {
            setFailure(error)
          }
        },
      },
    )
  }

  const title = (() => {
    if (step === "choose") return "Update job"
    if (step === "delivered") return "Mark delivered"
    if (step === "reason") return reasonOutcome === "RETURNED" ? "Return to hub" : "Mark failed"
    return outcome ? `Marked as ${DELIVERY_STATUS_LABELS[outcome].toLowerCase()}` : "Updated"
  })()

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="bottom" className="max-h-[90dvh] gap-0 overflow-y-auto p-0">
        <SheetHeader>
          <SheetTitle className="text-lg">{title}</SheetTitle>
          <SheetDescription className="font-mono">{trackingNumber}</SheetDescription>
        </SheetHeader>

        {step === "choose" ? (
          <div className="grid gap-3 px-4 pt-2 pb-4">
            <Button
              variant="success"
              size="lg"
              className="tap-target h-14 text-base"
              onClick={() => {
                setOutcome("DELIVERED")
                setStep("delivered")
              }}
            >
              <CheckCircle2 className="size-5" />
              Delivered to receiver
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="tap-target h-14 text-base"
              onClick={() => openReason("FAILED")}
            >
              <XCircle className="size-5" />
              Delivery failed
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="tap-target h-14 text-base"
              onClick={() => openReason("RETURNED")}
            >
              <Undo2 className="size-5" />
              Return to hub
            </Button>
          </div>
        ) : null}

        {step === "delivered" ? (
          <Form {...deliveredForm}>
            <form
              className="grid gap-4 px-4 pt-2"
              noValidate
              onSubmit={deliveredForm.handleSubmit((values) => run("DELIVERED", values.note))}
            >
              <Alert>
                <CheckCircle2 />
                <AlertTitle>Only confirm after handover</AlertTitle>
                <AlertDescription>
                  <p>Confirming marks the delivery delivered for every team that follows it.</p>
                </AlertDescription>
              </Alert>

              <FormField
                control={deliveredForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Note (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        className="text-base"
                        placeholder="Left with concierge, paid by card, and so on."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {failure ? (
                <Alert variant="destructive">
                  <XCircle />
                  <AlertTitle>Could not save</AlertTitle>
                  <AlertDescription>
                    <p>{describeApiError(failure).message}</p>
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-2">
                <Button
                  type="submit"
                  variant="success"
                  size="lg"
                  className="tap-target h-14 text-base"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
                  {mutation.isPending ? "Saving…" : "Confirm delivered"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="tap-target h-12"
                  onClick={() => setStep("choose")}
                >
                  <ChevronLeft />
                  Back
                </Button>
              </div>
            </form>
          </Form>
        ) : null}

        {step === "reason" ? (
          <Form {...reasonForm}>
            <form
              className="grid gap-4 px-4 pt-2"
              noValidate
              onSubmit={reasonForm.handleSubmit((values) =>
                run(
                  reasonOutcome,
                  values.note ? `${values.reason} — ${values.note}` : values.reason,
                ),
              )}
            >
              <FormField
                control={reasonForm.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">
                      {reasonOutcome === "RETURNED"
                        ? "Why is it going back? *"
                        : "Why did it fail? *"}
                    </FormLabel>
                    {/*
                      `FormControl` wraps the trigger, not the `Select` root: the
                      root renders no DOM, so the id, `aria-describedby` and
                      `aria-invalid` have to land on the button a screen reader
                      actually focuses.
                    */}
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={mutation.isPending}
                    >
                      <FormControl>
                        <SelectTrigger className="tap-target h-12 w-full text-base">
                          <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {REASON_PRESETS[reasonOutcome].map((reason) => (
                          <SelectItem key={reason} value={reason} className="min-h-11 text-base">
                            {reason}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {reasonOutcome === "RETURNED"
                        ? "The sender is told this reason, so record what you actually found at the door."
                        : "Dispatch uses this reason to decide whether the parcel is re-attempted or returned."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={reasonForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Extra detail (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        className="text-base"
                        placeholder="Buzzer 4A no answer, left a card."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {failure ? (
                <Alert variant="destructive">
                  <XCircle />
                  <AlertTitle>Could not save</AlertTitle>
                  <AlertDescription>
                    <p>{describeApiError(failure).message}</p>
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="grid gap-2">
                <Button
                  type="submit"
                  variant={reasonOutcome === "RETURNED" ? "secondary" : "destructive"}
                  size="lg"
                  className="tap-target h-14 text-base"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : reasonOutcome === "RETURNED" ? (
                    <Undo2 />
                  ) : (
                    <XCircle />
                  )}
                  {mutation.isPending
                    ? "Saving…"
                    : reasonOutcome === "RETURNED"
                      ? "Confirm return"
                      : "Confirm failed"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="tap-target h-12"
                  onClick={() => setStep("choose")}
                >
                  <ChevronLeft />
                  Back
                </Button>
              </div>
            </form>
          </Form>
        ) : null}

        {step === "done" && outcome ? (
          <div className="grid gap-4 px-4 pt-2">
            <Alert variant={DONE_TONES[outcome]}>
              {outcome === "DELIVERED" ? (
                <CheckCircle2 />
              ) : outcome === "RETURNED" ? (
                <Undo2 />
              ) : (
                <XCircle />
              )}
              <AlertTitle>{DELIVERY_STATUS_LABELS[outcome]}</AlertTitle>
              <AlertDescription>
                <p>{DONE_COPY[outcome]}</p>
              </AlertDescription>
            </Alert>
            <Button size="lg" className="tap-target h-14 text-base" onClick={() => close(false)}>
              Done
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
