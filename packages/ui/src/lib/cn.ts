import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Class name merge.
 *
 * `clsx` handles conditionals, `tailwind-merge` resolves conflicts so a caller
 * can override a component's defaults (`<Button size="sm" className="h-10" />`)
 * without fighting specificity. This is the one place Tailwind classes are
 * combined in the whole codebase.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
