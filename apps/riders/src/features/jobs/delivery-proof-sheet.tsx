import { zodResolver } from "@hookform/resolvers/zod"
import { Camera, CheckCircle2, ChevronLeft, IdCard, KeyRound, PenLine, XCircle } from "lucide-react"
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
  Input,
  LoadingButton,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@dropx/ui"

import { describeApiError } from "../../components/feedback"
import { isApiError } from "../../lib/api-client"
import { useSubmitProof } from "./job-queries"
import type { ProofType } from "./jobs.api"

const PROOF_TYPES = ["SIGNATURE", "PHOTO", "OTP", "IDENTITY"] as const

const PROOF_TYPE_LABELS: Record<ProofType, string> = {
  SIGNATURE: "Signature",
  PHOTO: "Photo of the handover",
  OTP: "Receiver OTP",
  IDENTITY: "ID check",
}

/**
 * What each proof needs from the rider, mirrored at the boundary. `OTP` and
 * `IDENTITY` take a code; `SIGNATURE` and `PHOTO` take a file reference. The
 * API rejects the wrong pairing, so the form requires it too.
 */
function schemaFor() {
  return z.object({
    value: z.string().trim().max(500),
    fileUrl: z.string().trim().max(500),
  })
}

type Step = "choose" | "capture" | "done"

type DeliveryProofSheetProps = {
  parcelId: string
  trackingNumber: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Filed from the job screen; the API resolves the attempt from the rider's
 * own parcel, so the sheet only ever sends `parcelId` plus the artefact.
 */
export function DeliveryProofSheet({
  parcelId,
  trackingNumber,
  open,
  onOpenChange,
}: DeliveryProofSheetProps) {
  const [step, setStep] = useState<Step>("choose")
  const [type, setType] = useState<ProofType | null>(null)
  const [failure, setFailure] = useState<unknown>(null)
  const mutation = useSubmitProof()

  const needsFile = type === "SIGNATURE" || type === "PHOTO"
  const form = useForm<z.infer<ReturnType<typeof schemaFor>>>({
    resolver: zodResolver(schemaFor()),
    defaultValues: { value: "", fileUrl: "" },
  })

  const close = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("choose")
      setType(null)
      setFailure(null)
      form.reset()
    }
    onOpenChange(isOpen)
  }

  const pick = (next: ProofType) => {
    setType(next)
    setFailure(null)
    form.reset()
    setStep("capture")
  }

  const run = (values: z.infer<ReturnType<typeof schemaFor>>) => {
    if (!type) return
    setFailure(null)
    mutation.mutate(
      {
        parcelId,
        type,
        ...(values.value ? { value: values.value } : {}),
        ...(values.fileUrl ? { fileUrl: values.fileUrl } : {}),
      },
      {
        onSuccess: () => setStep("done"),
        onError: (error) => {
          const fieldMessage = isApiError(error)
            ? error.fieldMessage(needsFile ? "fileUrl" : "value")
            : undefined
          if (fieldMessage) {
            form.setError(needsFile ? "fileUrl" : "value", { message: fieldMessage })
          } else {
            setFailure(error)
          }
        },
      },
    )
  }

  const title =
    step === "choose"
      ? "Proof of delivery"
      : step === "capture" && type
        ? PROOF_TYPE_LABELS[type]
        : "Proof recorded"

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent side="bottom" className="max-h-[90dvh] gap-0 overflow-y-auto p-0">
        <SheetHeader>
          <SheetTitle className="text-lg">{title}</SheetTitle>
          <SheetDescription className="font-mono">{trackingNumber}</SheetDescription>
        </SheetHeader>

        {step === "choose" ? (
          <div className="grid gap-3 px-4 pt-2 pb-4">
            {PROOF_TYPES.map((proofType) => (
              <Button
                key={proofType}
                variant="outline"
                size="lg"
                className="tap-target h-14 text-base"
                onClick={() => pick(proofType)}
              >
                {proofType === "SIGNATURE" ? (
                  <PenLine className="size-5" />
                ) : proofType === "PHOTO" ? (
                  <Camera className="size-5" />
                ) : proofType === "OTP" ? (
                  <KeyRound className="size-5" />
                ) : (
                  <IdCard className="size-5" />
                )}
                {PROOF_TYPE_LABELS[proofType]}
              </Button>
            ))}
          </div>
        ) : null}

        {step === "capture" && type ? (
          <Form {...form}>
            <form
              className="grid gap-4 px-4 pt-2 pb-6"
              noValidate
              onSubmit={form.handleSubmit((values) => {
                const wrong = needsFile ? !values.fileUrl.trim() : !values.value.trim()
                if (wrong) {
                  form.setError(needsFile ? "fileUrl" : "value", {
                    message: needsFile ? "A file is required" : "A code is required",
                  })
                  return
                }
                run(values)
              })}
            >
              <Alert>
                <CheckCircle2 />
                <AlertTitle>Only record what you actually captured</AlertTitle>
                <AlertDescription>
                  <p>This proof is reviewed at the office before it counts as evidence.</p>
                </AlertDescription>
              </Alert>

              {needsFile ? (
                <FormField
                  control={form.control}
                  name="fileUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">File URL *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="text-base"
                          placeholder="The uploaded image or signature file"
                        />
                      </FormControl>
                      <FormDescription>Capture, upload, then paste the link here.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">
                        {type === "OTP" ? "OTP code *" : "ID number *"}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} className="text-base" placeholder="6-digit code" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

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
                <LoadingButton
                  type="submit"
                  size="lg"
                  className="tap-target h-14 text-base"
                  loading={mutation.isPending}
                >
                  <CheckCircle2 />
                  Save proof
                </LoadingButton>
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

        {step === "done" ? (
          <div className="grid gap-4 px-4 pt-2 pb-6">
            <Alert variant="success">
              <CheckCircle2 />
              <AlertTitle>Proof recorded</AlertTitle>
              <AlertDescription>
                <p>It is attached to the attempt and awaiting office verification.</p>
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
