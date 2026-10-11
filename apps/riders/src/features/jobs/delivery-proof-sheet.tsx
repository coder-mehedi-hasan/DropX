import { zodResolver } from "@hookform/resolvers/zod"
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  IdCard,
  ImagePlus,
  KeyRound,
  Loader2,
  PenLine,
  XCircle,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
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
import { useSubmitProof, useUploadProof } from "./job-queries"
import type { ProofType } from "./jobs.api"

const PROOF_TYPES = ["SIGNATURE", "PHOTO", "OTP", "IDENTITY"] as const

const PROOF_TYPE_LABELS: Record<ProofType, string> = {
  SIGNATURE: "Signature",
  PHOTO: "Photo of the handover",
  OTP: "Receiver OTP",
  IDENTITY: "ID check",
}

/** Mirrors the API's `proof` purpose rules so a wrong image fails before it leaves. */
const ACCEPTED_PROOF_TYPES = ["image/jpeg", "image/png", "image/webp"] as const
const MAX_PROOF_BYTES = 5 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  const [selected, setSelected] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mutation = useSubmitProof()
  const upload = useUploadProof()

  const needsFile = type === "SIGNATURE" || type === "PHOTO"

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const resetFile = () => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setSelected(null)
    setUploadError(null)
    upload.reset()
  }

  const form = useForm<z.infer<ReturnType<typeof schemaFor>>>({
    resolver: zodResolver(schemaFor()),
    defaultValues: { value: "", fileUrl: "" },
  })

  const close = (isOpen: boolean) => {
    if (!isOpen) {
      setStep("choose")
      setType(null)
      setFailure(null)
      resetFile()
      form.reset()
    }
    onOpenChange(isOpen)
  }

  const pick = (next: ProofType) => {
    setType(next)
    setFailure(null)
    resetFile()
    form.reset()
    setStep("capture")
  }

  const chooseFile = (file: File) => {
    if (!ACCEPTED_PROOF_TYPES.includes(file.type as (typeof ACCEPTED_PROOF_TYPES)[number])) {
      setUploadError("Use a JPG, PNG, or WebP image.")
      return
    }
    if (file.size > MAX_PROOF_BYTES) {
      setUploadError("The image is larger than 5 MB.")
      return
    }
    setSelected(file)
    setUploadError(null)
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(file)
    })
    form.setValue("fileUrl", "", { shouldValidate: false })
    upload.mutate(file, {
      onSuccess: (result) => form.setValue("fileUrl", result.url, { shouldValidate: false }),
      onError: (error) =>
        setUploadError(
          isApiError(error) ? error.message : "We could not upload that image. Please try again.",
        ),
    })
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
                  render={() => (
                    <FormItem>
                      <FormLabel className="text-base">
                        {type === "SIGNATURE" ? "Signature photo" : "Handover photo"} *
                      </FormLabel>
                      <FormControl>
                        <div className="grid gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            capture="environment"
                            className="sr-only"
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              event.target.value = ""
                              if (file) chooseFile(file)
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            className="tap-target h-14 text-base"
                            disabled={upload.isPending}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {upload.isPending ? (
                              <Loader2 className="size-5 animate-spin" />
                            ) : selected ? (
                              <ImagePlus className="size-5" />
                            ) : (
                              <Camera className="size-5" />
                            )}
                            {upload.isPending
                              ? "Uploading…"
                              : selected
                                ? "Replace photo"
                                : "Take or pick a photo"}
                          </Button>

                          {selected ? (
                            <div className="flex items-center gap-3 rounded-lg border p-2">
                              {preview ? (
                                <img
                                  src={preview}
                                  alt=""
                                  className="size-14 rounded-md object-cover"
                                />
                              ) : (
                                <div className="bg-muted size-14 rounded-md" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm">{selected.name}</p>
                                <p className="text-muted-foreground text-xs">
                                  {formatBytes(selected.size)}
                                </p>
                              </div>
                              {form.getValues("fileUrl") ? (
                                <Badge variant="success">Attached</Badge>
                              ) : upload.isPending ? (
                                <Badge variant="outline">Uploading</Badge>
                              ) : null}
                            </div>
                          ) : null}

                          {uploadError ? (
                            <p className="text-destructive text-sm">{uploadError}</p>
                          ) : null}
                        </div>
                      </FormControl>
                      <FormDescription>
                        {type === "SIGNATURE"
                          ? "Photo of the signed handover, uploaded automatically."
                          : "Opens your camera or photo library and attaches it automatically."}
                      </FormDescription>
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
                  disabled={needsFile && (upload.isPending || !form.getValues("fileUrl"))}
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
