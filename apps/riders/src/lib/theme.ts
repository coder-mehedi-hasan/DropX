export type Theme = "dark" | "light"

const STORAGE_KEY = "dropx.riders.theme"

const listeners = new Set<() => void>()

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" && !window.matchMedia("(prefers-color-scheme: light)").matches
  )
}

function readStored(): Theme | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw === "dark" || raw === "light" ? raw : null
  } catch {
    return null
  }
}

let current: Theme = readStored() ?? (prefersDark() ? "dark" : "light")

function apply(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark")
}

export function getTheme(): Theme {
  return current
}

export function setTheme(theme: Theme): void {
  current = theme
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // A refused write only costs the rider their preference, not their session.
  }
  apply(theme)
  for (const listener of listeners) listener()
}

/**
 * Follows the OS until the rider picks a side.
 *
 * The rider app is used outdoors on someone else's phone, where the system
 * appearance changes with the time of day; only an explicit choice in the
 * profile screen stops tracking it.
 */
function watchSystemPreference(): void {
  const query = window.matchMedia("(prefers-color-scheme: light)")
  const onChange = () => {
    if (readStored()) return
    current = prefersDark() ? "dark" : "light"
    apply(current)
    for (const listener of listeners) listener()
  }
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", onChange)
  }
}

export function startThemeSync(): void {
  apply(current)
  watchSystemPreference()
}
