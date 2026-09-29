import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react"
import * as React from "react"

import {
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@dropx/ui"

import {
  listBranchesForPicker,
  listHubsForPicker,
  listZonesForPicker,
  searchCustomersForPicker,
} from "@/lib/endpoints"
import type { BranchOption, CustomerOption, HubOption, ZoneOption } from "@/lib/types"
import { useDebouncedValue } from "@/lib/use-debounced-value"

/**
 * The reference picker.
 *
 * One control for the three `admin.reference.*` endpoints, because the six
 * fields it replaces in the parcel dialog all want the same thing: search a
 * narrow projection, pick one, get an id back. What differs is only which
 * endpoint and how a row reads, so that is what a call site supplies.
 *
 * **The id is never displayed.** The old fields were `<Input placeholder="12">`
 * — the user had to already know the row number, which is the failure this
 * exists to remove. A row shows its name and whatever distinguishes it
 * (a customer's phone, a hub's code); the id stays behind the control.
 *
 * Search is debounced *before* it reaches the query key, so typing a phone
 * number is one request rather than eleven. The endpoint clamps its own `limit`,
 * so the page size here is a display concern rather than a safety one.
 */

export type PickerSource = "branches" | "hubs" | "zones" | "customers"

type Row = {
  id: string
  /** Primary line — what the user recognises. */
  label: string
  /** Secondary line — what distinguishes two rows with the same name. */
  hint?: string | null
  status?: string
  /** Extra badges, e.g. a hub's type. */
  tags?: string[]
}

const PAGE_SIZE = 25

/**
 * One mapper per source, each taking its own option type.
 *
 * Deliberately not a single mapper over a `HubOption | ZoneOption | CustomerOption`
 * union: the three shapes have nothing in common beyond `id`, so a union forces
 * casts, and a cast here would compile while quietly reading `code` off a
 * customer. Narrowing on `source` is what makes these type-safe.
 */
function toBranchRows(nodes: readonly BranchOption[]): Row[] {
  return nodes.map((branch) => ({
    id: branch.id,
    label: branch.name,
    hint: branch.code,
    status: branch.status,
  }))
}

function toHubRows(nodes: readonly HubOption[]): Row[] {
  return nodes.map((hub) => ({
    id: hub.id,
    label: hub.name,
    hint: hub.district ?? hub.code,
    tags: [hub.code, hub.type],
  }))
}

function toZoneRows(nodes: readonly ZoneOption[]): Row[] {
  return nodes.map((zone) => ({ id: zone.id, label: zone.name, hint: zone.code }))
}

function toCustomerRows(nodes: readonly CustomerOption[]): Row[] {
  return nodes.map((customer) => ({
    id: customer.id,
    label: customer.name,
    hint: customer.phone,
    status: customer.status,
  }))
}

function useReferenceRows(
  source: PickerSource,
  search: string,
  enabled: boolean,
): { rows: Row[]; isFetching: boolean; isError: boolean } {
  const params = { page: 1, limit: PAGE_SIZE, search: search || undefined }

  const branches = useQuery({
    queryKey: ["reference", "branches", params],
    queryFn: ({ signal }) => listBranchesForPicker(params, signal),
    enabled: enabled && source === "branches",
    staleTime: 60_000,
  })

  const hubs = useQuery({
    queryKey: ["reference", "hubs", params],
    queryFn: ({ signal }) => listHubsForPicker(params, signal),
    enabled: enabled && source === "hubs",
    staleTime: 60_000,
  })

  const zones = useQuery({
    queryKey: ["reference", "zones", params],
    queryFn: ({ signal }) => listZonesForPicker(params, signal),
    enabled: enabled && source === "zones",
    staleTime: 60_000,
  })

  const customers = useQuery({
    queryKey: ["reference", "customers", params],
    queryFn: ({ signal }) => searchCustomersForPicker(params, signal),
    enabled: enabled && source === "customers",
    staleTime: 60_000,
  })

  // Only the matching query is enabled, so the other three never hold data.
  // Their pending flags are read anyway: an unused query is
  // `isFetching === false`, which is exactly the answer wanted for a source
  // that is not in play.
  const isFetching =
    source === "branches"
      ? branches.isFetching
      : source === "hubs"
        ? hubs.isFetching
        : source === "zones"
          ? zones.isFetching
          : customers.isFetching
  const isError =
    source === "branches"
      ? branches.isError
      : source === "hubs"
        ? hubs.isError
        : source === "zones"
          ? zones.isError
          : customers.isError

  const rows = React.useMemo(() => {
    if (source === "branches") return toBranchRows(branches.data?.nodes ?? [])
    if (source === "hubs") return toHubRows(hubs.data?.nodes ?? [])
    if (source === "zones") return toZoneRows(zones.data?.nodes ?? [])
    return toCustomerRows(customers.data?.nodes ?? [])
  }, [source, branches.data, hubs.data, zones.data, customers.data])

  return { rows, isFetching, isError }
}

export function ReferenceCombobox({
  value,
  onChange,
  source,
  placeholder,
  disabled,
  id,
  invalid,
}: {
  /** Selected id, or `""` for nothing. */
  value: string
  onChange: (id: string) => void
  source: PickerSource
  placeholder: string
  disabled?: boolean
  id?: string
  /** Paints the red border; the message itself belongs to the form field. */
  invalid?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebouncedValue(search.trim(), 250)

  const { rows, isFetching, isError } = useReferenceRows(source, debouncedSearch, open)

  const selected = React.useMemo(() => rows.find((row) => row.id === value) ?? null, [rows, value])

  // The chosen row can fall out of `rows` the moment a search narrows the list,
  // or before the picker has ever been opened. Rather than blank the trigger, the
  // last known label is kept — a control that empties itself mid-edit looks like
  // data loss.
  //
  // Written in an effect rather than during render: assigning a ref while
  // rendering is a side effect, and React's double-render in StrictMode would
  // make it depend on render order.
  const [lastLabel, setLastLabel] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (selected) setLastLabel(selected.label)
  }, [selected])

  // Cleared when the selection itself is emptied, or the stale name would
  // linger on a picker that is meant to be showing its placeholder.
  React.useEffect(() => {
    if (!value) setLastLabel(null)
  }, [value])

  const label = selected?.label ?? (value ? lastLabel : null)

  function select(id: string) {
    onChange(id)
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          variant="outline"
          disabled={disabled}
          className={`w-full justify-between font-normal ${
            invalid ? "border-destructive focus-visible:ring-destructive/40" : ""
          }`}
        >
          <span className={label ? "truncate" : "text-muted-foreground truncate"}>
            {label ?? placeholder}
          </span>
          {isFetching ? (
            <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
          ) : (
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 opacity-50" aria-hidden="true" />
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={placeholder}
              className="h-11 border-0 focus-visible:ring-0"
            />
          </div>

          <CommandList>
            {/* Server already filtered, so cmdx's own matcher is off — a second
                pass would make the list look empty for any query it scores low. */}
            {isError ? (
              <div className="text-destructive px-3 py-6 text-center text-sm">
                Could not load options. Try again.
              </div>
            ) : rows.length === 0 ? (
              <CommandEmpty>{isFetching ? "Searching…" : `No match for “${search}”`}</CommandEmpty>
            ) : (
              <CommandGroup>
                {rows.map((row) => (
                  <CommandItem
                    key={row.id}
                    value={row.id}
                    onSelect={() => select(row.id)}
                    className="gap-2"
                  >
                    <Check
                      className={`size-4 shrink-0 ${row.id === value ? "opacity-100" : "opacity-0"}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{row.label}</span>
                      {row.hint ? (
                        <span className="text-muted-foreground block truncate text-xs">
                          {row.hint}
                        </span>
                      ) : null}
                    </span>
                    {row.tags?.map((tag) => (
                      <Badge key={tag} variant="secondary" className="shrink-0">
                        {tag}
                      </Badge>
                    ))}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
