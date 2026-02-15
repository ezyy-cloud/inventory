import { useEffect, useState } from 'react'

/**
 * Returns a value that updates after `delayMs` of no changes to `value`.
 * Useful for search inputs to avoid hitting the API on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(value)
    }, delayMs)
    return () => window.clearTimeout(id)
  }, [value, delayMs])

  return debounced
}
