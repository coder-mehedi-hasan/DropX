import { useEffect, useState } from "react"

/**
 * Debounces a value without delaying the URL write.
 *
 * Search text goes into the address bar on every keystroke so the view stays
 * shareable, but only the debounced value drives the request — otherwise each
 * character in a tracking number is a round trip.
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
