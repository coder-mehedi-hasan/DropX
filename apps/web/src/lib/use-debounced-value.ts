import { useEffect, useState } from "react"

/**
 * Debounces a value: the caller renders the latest one, but only a value that
 * has held still for `delayMs` comes back.
 *
 * Strings compare by value, so debouncing a `JSON.stringify(...)` snapshot of
 * a form is stable — an object identity would change on every render and
 * restart the timer forever.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
