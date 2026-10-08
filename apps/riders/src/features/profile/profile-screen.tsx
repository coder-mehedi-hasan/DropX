import { useNavigate } from "@tanstack/react-router"
import { Check, IdCard, LogOut, Moon, ShieldCheck, Sun } from "lucide-react"
import {
  Avatar,
  AvatarFallback,
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
} from "@dropx/ui"

import { AppHeader, AppShell } from "../../components/layout/app-shell"
import { useAuth } from "../../lib/auth"
import { initials } from "../../lib/format"
import { RIDER_PERMISSION_KEYS, type RiderPermission } from "../../lib/permissions"
import { useTheme } from "../../lib/use-theme"

const PERMISSION_LABELS: Record<RiderPermission, string> = {
  "rider.jobs.view": "View assigned jobs",
  "rider.jobs.update": "Update job status",
  "rider.location.update": "Push live location",
  "rider.proof.submit": "Submit proof of delivery",
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
        <Card className="bg-foreground text-background relative overflow-hidden rounded-[1.35rem] border-0">
          <div className="bg-primary/20 absolute -top-12 -right-8 size-36 rounded-full blur-2xl" />
          <CardContent className="relative flex items-center gap-4 py-1">
            <Avatar className="size-16 rounded-2xl ring-2 ring-white/15">
              <AvatarFallback className="bg-primary text-primary-foreground rounded-2xl text-lg font-extrabold">
                {initials(rider?.name ?? "Rider")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-xl font-extrabold tracking-tight">{rider?.name}</p>
              <p className="text-background/60 truncate text-sm">{rider?.email}</p>
              <Badge variant="secondary" className="mt-2 border-0 bg-white/10 text-white">
                <IdCard aria-hidden />
                Hub {rider?.hubId}
              </Badge>
            </div>
          </CardContent>
        </Card>

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
