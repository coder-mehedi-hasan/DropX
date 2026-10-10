"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  Alert,
  AlertDescription,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  LoadingButton,
  ServerFormError,
  Skeleton,
  useServerErrors,
} from "@dropx/ui"
import { LoaderCircleIcon, UploadIcon, XIcon } from "lucide-react"
import * as React from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

import { isApiError } from "@/lib/api-client"
import { useAuth } from "@/lib/auth"
import { useCustomerProfile, useUpdateCustomerProfile, useUpload } from "@/lib/queries"
import type { UpdateCustomerProfileInput } from "@/lib/types"

/**
 * The profile editor.
 *
 * One screen, two concerns: the avatar (bytes go to `POST /uploads`, only the
 * returned URL ever reaches the customer row) and the display name. Both are
 * saved together by a single button so the customer never half-updates — and
 * because the avatar is staged locally first, a failed save loses no picture
 * and a removed one waits for an explicit save rather than vanishing on
 * selection.
 */

/** Mirrors the API's per-purpose rules so a wrong file fails before it leaves. */
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"]
const AVATAR_MAX_BYTES = 2 * 1024 * 1024

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(150, "That name is too long"),
})

type ProfileValues = z.infer<typeof profileSchema>

export function ProfileEditor() {
  const { customer, updateCustomer } = useAuth()
  const profile = useCustomerProfile()
  const updateProfile = useUpdateCustomerProfile()
  const busy = updateProfile.isPending

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    mode: "onBlur",
    defaultValues: { name: customer?.name || profile.data?.name || "" },
  })
  const { setError } = form

  const { error: serverError, capture: captureServerError, clear: clearServerError } =
    useServerErrors(setError)

  /** The staged avatar. `undefined` = not touched, so a name-only save keeps it. */
  const [avatarUrl, setAvatarUrl] = React.useState<string | null | undefined>(profile.data?.avatarUrl)
  const [fileError, setFileError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const upload = useUpload()

  const pendingAvatar = avatarUrl ?? customer?.avatarUrl ?? null

  const uploadError =
    fileError ??
    (upload.error
      ? isApiError(upload.error)
        ? upload.error.message
        : "We could not upload that image. Please try again."
      : null)

  // Seed from the real profile row once it arrives (fresher than the cached
  // session, e.g. an avatar set in a previous browser).
  React.useEffect(() => {
    if (!profile.data) return
    form.reset({ name: profile.data.name })
    setAvatarUrl(profile.data.avatarUrl)
  }, [profile.data, form])

  function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    setFileError(null)

    if (!AVATAR_TYPES.includes(file.type)) {
      setFileError("Choose a JPG, PNG, or WebP image.")
      return
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setFileError("That image is over 2 MB. Pick a smaller one.")
      return
    }

    upload.mutate(
      { purpose: "avatar", file },
      {
        onSuccess: (stored) => {
          setAvatarUrl(stored.url)
          clearServerError()
        },
      },
    )
  }

  function onSubmit(values: ProfileValues) {
    clearServerError()
    const payload: UpdateCustomerProfileInput = { name: values.name }
    // The avatar is sent only when it actually changed, so a name-only save can
    // never wipe an existing picture.
    if (avatarUrl !== undefined) payload.avatarUrl = avatarUrl

    updateProfile.mutate(payload, {
      onSuccess: (saved) => {
        updateCustomer({ name: saved.name, avatarUrl: saved.avatarUrl })
        setAvatarUrl(saved.avatarUrl)
        toast.success("Profile updated")
      },
      onError: (error) => captureServerError(error),
    })
  }

  return (
    <Card className="max-w-page mx-auto w-full">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          How you appear across DropX — the header, your parcels, and the book later.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="grid gap-4 self-start">
          <Avatar className="size-28 rounded-2xl text-2xl font-bold">
            {pendingAvatar ? <AvatarImage src={pendingAvatar} alt="Your photo" /> : null}
            <AvatarFallback className="bg-primary/10 text-2xl rounded-2xl">
              {(customer?.name || customer?.phone || "D").trim().charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <input
            ref={fileInputRef}
            type="file"
            accept={AVATAR_TYPES.join(",")}
            className="sr-only"
            onChange={onFileChosen}
            aria-label="Choose a profile photo"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={upload.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {upload.isPending ? (
                <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
              ) : (
                <UploadIcon aria-hidden />
              )}
              {upload.isPending ? "Uploading…" : "Upload photo"}
            </Button>
            {pendingAvatar ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={upload.isPending || busy}
                onClick={() => setAvatarUrl(null)}
              >
                <XIcon aria-hidden />
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground max-w-[30ch] text-xs leading-5">
            JPG, PNG, or WebP, up to 2&nbsp;MB. Saved when you press the save button.
          </p>

          {uploadError ? (
            <Alert variant="destructive">
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid max-w-xl gap-5">
            <ServerFormError error={serverError} title="We could not save your profile" />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your name" autoComplete="name" {...field} />
                  </FormControl>
                  <FormDescription>
                    Shown in the portal header and on parcels you send and receive.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <LoadingButton type="submit" loading={busy} className="w-fit">
              Save changes
            </LoadingButton>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

/** The page-level skeleton while the profile row loads. */
export function ProfileEditorSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-live="polite">
      <Skeleton className="h-8 w-40" />
      <Card className="max-w-page mx-auto w-full">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[auto_minmax(0,1fr)]">
          <Skeleton className="h-28 w-28 rounded-2xl" />
          <div className="grid gap-3 pt-2">
            <Skeleton className="h-10 w-full max-w-xl" />
            <Skeleton className="h-6 w-56" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}