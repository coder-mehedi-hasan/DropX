import { useNavigate } from "@tanstack/react-router"
import { LogOut, Moon, Sun } from "lucide-react"
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  SidebarTrigger,
  useConfirmation,
} from "@dropx/ui"

import { useAuth } from "@/lib/auth"
import { initialsOf } from "@/lib/format"
import { useTheme } from "@/lib/theme"

export function Header() {
  const { displayName, user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const { confirm, confirmationDialog } = useConfirmation()

  async function onSignOut() {
    const ok = await confirm({
      title: "Sign out?",
      description: "You will need your email and password to sign back in.",
      confirmLabel: "Sign out",
    })
    if (ok) await logout().then(() => navigate({ to: "/login" }))
  }

  return (
    <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
      <SidebarTrigger className="-ml-1" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">Operations</p>
      </div>

      <Separator orientation="vertical" className="hidden h-6 sm:block" />

      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      >
        {theme === "dark" ? <Sun /> : <Moon />}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-9 gap-2 px-2">
            <Avatar className="size-6">
              <AvatarFallback>{initialsOf(displayName || user?.email || "?")}</AvatarFallback>
            </Avatar>
            <span className="hidden max-w-40 truncate text-sm sm:inline">
              {displayName || user?.email}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="flex flex-col items-start gap-1">
            <span className="truncate">{displayName || user?.email}</span>
            <span className="text-muted-foreground truncate text-xs font-normal">
              {user?.email}
            </span>
          </DropdownMenuLabel>
          <Separator className="my-1" />
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {user?.roles.length ? (
              user.roles.map((role) => (
                <Badge key={role} variant="secondary">
                  {role}
                </Badge>
              ))
            ) : (
              <span className="text-muted-foreground px-2 text-xs">No roles assigned</span>
            )}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => void onSignOut()}>
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {confirmationDialog}
    </header>
  )
}
