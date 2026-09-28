import { useNavigate } from "@tanstack/react-router"
import { KeyRound, LogOut, Moon, Sun } from "lucide-react"
import {
  Alert,
  AlertDescription,
  AlertTitle,
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
  Separator,
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

      <main className="flex-1 space-y-3 px-3 py-4">
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <Avatar className="size-14">
              <AvatarFallback className="text-lg">
                {initials(rider?.name ?? "Rider")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold">{rider?.name}</p>
              <p className="text-muted-foreground truncate text-sm">{rider?.email}</p>
              <Badge variant="secondary" className="mt-2">
                Home hub {rider?.hubId}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">What you can do</CardTitle>
            <CardDescription>
              Granted by the RIDER role in role_permissions. The API checks these keys on every
              request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {RIDER_PERMISSION_KEYS.map((key) => (
                <li key={key} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{PERMISSION_LABELS[key]}</p>
                    <p className="text-muted-foreground font-mono text-xs">{key}</p>
                  </div>
                  <Badge variant={can(key) ? "success" : "outline"}>
                    {can(key) ? "Granted" : "Not granted"}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>
              Dark is the default for daylight legibility. Light follows your phone's setting until
              you pick one here.
            </CardDescription>
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

        <Separator />

        <Alert>
          <KeyRound />
          <AlertTitle>Rider sign-in</AlertTitle>
          <AlertDescription>
            <p>
              This app only talks to the riders audience. Admin and customer sessions cannot be used
              here.
            </p>
          </AlertDescription>
        </Alert>

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
