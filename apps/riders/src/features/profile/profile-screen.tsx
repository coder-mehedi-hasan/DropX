import { zodResolver } from "@hookform/resolvers/zod"
import { useNavigate } from "@tanstack/react-router"
import { Check, IdCard, LogOut, Moon, ShieldCheck, Sun, Upload, X } from "lucide-react"
import { useEffect, useRef, useState, type ChangeEvent } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Form,
  FormInput,
  LoadingButton,
} from "@dropx/ui"

import { describeApiError } from "../../components/feedback"
import { AppHeader, AppShell } from "../../components/layout/app-shell"
import { useAuth } from "../../lib/auth"
import { initials } from "../../lib/format"
import { RIDER_PERMISSION_KEYS, type RiderPermission } from "../../lib/permissions"
import { useTheme } from "../../lib/use-theme"
import { useUpdateUserProfile, useUpload, useUserProfile } from "./profile-queries"

const PERMISSION_LABELS: Record<RiderPermission, string> = {
  "rider.jobs.view": "View assigned jobs",
  "rider.jobs.update": "Update job status",
  "rider.location.update": "Push live location",
  "rider.proof.submit": "Submit proof of delivery",
}

/** Mirrors the API's `avatar` purpose rules so a wrong file fails before it leaves. */
const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"]
const AVATAR_MAX_BYTES = 2 * 1024 * 1024

const profileSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(150, "That name is too long"),
})

type ProfileValues = z.infer<typeof profileSchema>

function ProfileEditCard() {
  const { rider, updateRider } = useAuth()
  const profileQuery = useUserProfile()
  const updateProfile = useUpdateUserProfile()
  const upload = useUpload()

  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    mode: "onBlur",
    defaultValues: { name: rider?.name || profileQuery.data?.name || "" },
  })

  /** `undefined` = not touched, so a name-only save never wipes the picture. */
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(profileQuery.data?.avatarUrl)
  const [fileError, setFileError] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Seed from the real profile row once it arrives (fresher than the cached
  // session, e.g. an avatar set on another device).
  useEffect(() => {
    if (!profileQuery.data) return
    form.reset({ name: profileQuery.data.name })
    setAvatarUrl(profileQuery.data.avatarUrl)
  }, [profileQuery.data, form])

  const pendingAvatar = avatarUrl ?? rider?.avatarUrl ?? null

  const uploadError =
    fileError ??
    (upload.error
      ? describeApiError(upload.error).message
      : null)

  function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
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
          setServerError(null)
          setSaved(false)
        },
      },
    )
  }

  function onSubmit(values: ProfileValues) {
    setServerError(null)
    setSaved(false)
    const payload: { name: string; avatarUrl?: string | null } = { name: values.name }
    // Sent only when it actually changed, so a name-only save cannot wipe a
    // picture that was never touched.
    if (avatarUrl !== undefined) payload.avatarUrl = avatarUrl

    updateProfile.mutate(payload, {
      onSuccess: (savedProfile) => {
        updateRider({ name: savedProfile.name, avatarUrl: savedProfile.avatarUrl })
        setAvatarUrl(savedProfile.avatarUrl)
        setSaved(true)
      },
      onError: (error) => setServerError(describeApiError(error).message),
    })
  }

  return (
    <Card className="rounded-[1.25rem] border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Edit profile</CardTitle>
        <CardDescription>Your name and photo appear across the rider app.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="flex items-center gap-4">
          <Avatar className="size-20 rounded-2xl">
            {pendingAvatar ? <AvatarImage src={pendingAvatar} alt="Your photo" /> : null}
            <AvatarFallback className="bg-primary/10 text-primary rounded-2xl text-xl font-bold">
              {initials(rider?.name ?? "Rider")}
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
          <div className="flex flex-col items-start gap-2">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={upload.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {upload.isPending ? "Uploading…" : "Upload photo"}
                {upload.isPending ? null : <Upload aria-hidden />}
              </Button>
              {pendingAvatar ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={upload.isPending || updateProfile.isPending}
                  onClick={() => {
                    setAvatarUrl(null)
                    setSaved(false)
                  }}
                >
                  Remove
                  <X aria-hidden />
                </Button>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs leading-5">
              JPG, PNG, or WebP, up to 2&nbsp;MB. Saved when you press save.
            </p>
          </div>
        </div>

        {uploadError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not upload photo</AlertTitle>
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        ) : null}
        {serverError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not save profile</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-5" noValidate>
            <FormInput<ProfileValues> name="name" label="Full name" autoComplete="name" />
            <div className="flex items-center gap-3">
              <LoadingButton
                type="submit"
                loading={updateProfile.isPending}
                className="tap-target"
              >
                Save changes
              </LoadingButton>
              {saved ? (
                <p className="text-primary flex items-center gap-1.5 text-sm font-medium">
                  <Check className="size-4" aria-hidden />
                  Saved
                </p>
              ) : null}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

export function ProfileScreen() {
  const { rider, can, logout } = useAuth()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

  const onSignOut = async () => {
    await logout()
    await navigate({ to: "/login" })
  }

  return (
    <AppShell>
      <AppHeader title="Profile" subtitle={rider?.email} />

      <main className="flex-1 space-y-4 px-4 py-5">
        <Card className="relative overflow-hidden rounded-[1.35rem] border-0 bg-[#17191f] text-white shadow-lg dark:bg-[#1a1d24]">
          <div className="bg-primary/20 absolute -top-12 -right-8 size-36 rounded-full blur-2xl" />
          <CardContent className="relative flex items-center gap-4 py-1">
            <Avatar className="size-16 rounded-2xl ring-2 ring-white/15">
              {rider?.avatarUrl ? <AvatarImage src={rider.avatarUrl} alt="Your photo" /> : null}
              <AvatarFallback className="bg-primary text-primary-foreground rounded-2xl text-lg font-extrabold">
                {initials(rider?.name ?? "Rider")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-xl font-extrabold tracking-tight">{rider?.name}</p>
              <p className="truncate text-sm text-white/60">{rider?.email}</p>
              <Badge variant="secondary" className="mt-2 border-0 bg-white/10 text-white">
                <IdCard aria-hidden />
                {rider?.hubId ? `Hub ${rider.hubId}` : "Hub not assigned"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <ProfileEditCard />

        <Card className="rounded-[1.25rem] border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="text-primary size-5" aria-hidden />
              Rider access
            </CardTitle>
            <CardDescription>What your rider account is allowed to do in this app.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {RIDER_PERMISSION_KEYS.map((key) => (
                <li key={key} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{PERMISSION_LABELS[key]}</p>
                  </div>
                  {can(key) ? (
                    <Badge variant="secondary">
                      <Check aria-hidden />
                      Granted
                    </Badge>
                  ) : (
                    <Badge variant="outline">Not granted</Badge>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="rounded-[1.25rem] border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Choose what is easiest to read on your route.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="lg"
              className="tap-target w-full"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
              Switch to {theme === "dark" ? "light" : "dark"}
            </Button>
          </CardContent>
        </Card>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="lg" className="tap-target w-full">
              <LogOut />
              Sign out
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sign out of DropX Rider?</DialogTitle>
              <DialogDescription>
                Any job you were looking at will be closed. Unsent status changes are lost.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" size="lg" className="tap-target">
                  Stay signed in
                </Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="destructive" size="lg" className="tap-target" onClick={onSignOut}>
                  Sign out
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </AppShell>
  )
}