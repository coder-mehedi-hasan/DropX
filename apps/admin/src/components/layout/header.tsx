import { Link, useNavigate } from "@tanstack/react-router"
import { LogOut, Menu, Moon, Sun } from "lucide-react"
import { useState } from "react"
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropXLogo,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Separator,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@dropx/ui"

import { NAV_ITEMS } from "@/components/layout/sidebar"
import { useAuth } from "@/lib/auth"
import { initialsOf } from "@/lib/format"
import { useTheme } from "@/lib/theme"

export function Header() {
  const { displayName, user, logout, hasPermission } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const items = NAV_ITEMS.filter(
    (item) => item.permission === null || hasPermission(item.permission),
  )

  return (
    <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 backdrop-blur">
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
            <Menu />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle className="flex items-center">
              <DropXLogo size="sm" />
            </SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 px-4" aria-label="Main">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                search={item.search}
                onClick={() => setMobileNavOpen(false)}
                className="hover:bg-accent hover:text-accent-foreground flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors duration-150 ease-brand"
              >
                <item.icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>

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
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              void logout().then(() => navigate({ to: "/login" }))
            }}
          >
            <LogOut />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
