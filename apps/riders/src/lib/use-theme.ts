import { useSyncExternalStore } from "react"

import { getTheme, setTheme, type Theme } from "./theme"

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
  return () => observer.disconnect()
}

/**
 * Reads the theme from the `dark` class on `<html>` rather than from a second
 * store, so nothing mounted late can disagree with the class the tokens actually
 * respond to.
 */
function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => true,
  )
}

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void } {
  const isDark = useIsDark()
  return { theme: isDark ? "dark" : "light", setTheme }
}

export { getTheme, setTheme, type Theme }
