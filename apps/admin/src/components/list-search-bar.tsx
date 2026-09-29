import { Search, X } from "lucide-react"
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dropx/ui"

/**
 * Toolbar controls for a list.
 *
 * Both write straight to the URL and hold no state of their own, so a control
 * can never disagree with the address bar — and a copied link always reproduces
 * the view on screen.
 */

/** Search box. The clear button exists because a long query with no exit is a trap. */
export function ListSearchBar({
  value,
  onChange,
  placeholder = "Search",
  label,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label: string
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute top-1/2 right-1 size-8 -translate-y-1/2"
          onClick={() => onChange("")}
          aria-label="Clear search"
        >
          <X />
        </Button>
      ) : null}
    </div>
  )
}

/**
 * Select for one list filter.
 *
 * `""` is a real option rather than an absent one: a filter that cannot be
 * cleared is a filter the user is stuck with.
 */
export function ListFilterSelect<TValue extends string>({
  value,
  onChange,
  options,
  allLabel,
  label,
  className,
}: {
  value: TValue
  onChange: (value: TValue) => void
  options: readonly { value: TValue; label: string }[]
  allLabel: string
  label: string
  className?: string
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as TValue)}>
      <SelectTrigger size="sm" className={className ?? "w-full"} aria-label={label}>
        <SelectValue placeholder={allLabel} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="">{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
