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
  listCitiesForPicker,
  listCityZonesForPicker,
  listHubsForPicker,
  listParcels,
  listRidersForPicker,
  listRoutes,
  listVehicles,
  listZoneAreasForPicker,
  listZonesForPicker,
  searchCustomersForPicker,
} from "@/lib/endpoints"
import type {
  BranchOption,
  CustomerOption,
  HubOption,
  Parcel,
  Rider,
  Route,
  ServiceArea,
  ServiceCity,
  ServiceZone,
  Vehicle,
  ZoneOption,
} from "@/lib/types"
import { formatMoney } from "@/lib/format"
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

/**
 * `riders` is backed by the roster list rather than an `admin.reference.*`
 * endpoint, and that is deliberate: a reference endpoint exists to feed a
 * dropdown of things you *define* (hubs, zones), and riders are already a
 * first-class list with its own screen, permissions and pagination. Re-adding a
 * narrowed copy of it to the reference module would be a second source of truth
 * for the same rows.
 */
export type PickerSource =
  | "branches"
  | "hubs"
  | "zones"
  | "customers"
  | "riders"
  | "vehicles"
  | "routes"
  | "parcels"
  | "cities"
  | "city-zones"
  | "zone-areas"

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

/**
 * The booking cascade's rows are the service-* shapes, not the legacy zone
 * projection. A city carries its service type as the distinguishing tag because
 * two cities with the same name can be priced differently; zones and areas
 * only need their code below the name.
 */
function toCityRows(nodes: readonly ServiceCity[]): Row[] {
  return nodes.map((city) => ({
    id: city.id,
    label: city.name,
    hint: city.code,
    tags: [city.serviceType],
  }))
}

function toServiceZoneRows(nodes: readonly ServiceZone[]): Row[] {
  return nodes.map((zone) => ({ id: zone.id, label: zone.name, hint: zone.code }))
}

function toServiceAreaRows(nodes: readonly ServiceArea[]): Row[] {
  return nodes.map((area) => ({ id: area.id, label: area.name, hint: area.code }))
}

function toCustomerRows(nodes: readonly CustomerOption[]): Row[] {
  return nodes.map((customer) => ({
    id: customer.id,
    label: customer.name,
    hint: customer.phone,
    status: customer.status,
  }))
}

/**
 * `GET /admin/riders` returns the `riders` row and not the joined `users` row, so
 * there is no name to show — the employee code is the label. That is also what
 * dispatch already calls riders by; the roster screen shows the same column first
 * for the same reason.
 *
 * The status travels with the row because an offline rider is not worth assigning
 * to, so the picker shows the difference without a second request.
 */
function toRiderRows(nodes: readonly Rider[]): Row[] {
  return nodes.map((rider) => ({
    id: rider.id,
    label: rider.employeeCode,
    hint: rider.licenseNumber ? `Licence ${rider.licenseNumber}` : null,
    status: rider.status,
  }))
}

/**
 * `vehicles` and `routes` are backed by their own list endpoints rather than
 * `admin.reference.*`, for the same reason `riders` is: both are first-class
 * lists with their own screens, permissions and pagination. A narrowed copy in
 * the reference module would be a second source of truth for the same rows.
 *
 * The status travels with the row because a vehicle in maintenance is not worth
 * loading a truck onto, so the picker shows the difference without a second
 * request.
 */
function toVehicleRows(nodes: readonly Vehicle[]): Row[] {
  return nodes.map((vehicle) => ({
    id: vehicle.id,
    label: vehicle.registrationNumber,
    hint: vehicle.type,
    status: vehicle.status,
  }))
}

function toRouteRows(nodes: readonly Route[]): Row[] {
  return nodes.map((route) => ({
    id: route.id,
    label: route.name,
    hint: route.code,
    status: route.status,
  }))
}

/**
 * `parcels` is backed by the parcels list like `riders`/`vehicles`/`routes` are:
 * it is a first-class scoped list with its own screen, not a reference shape.
 * The remittance picker needs it because a finance clerk recognises the money
 * they are settling by tracking number — and the hint carries the COD amount so
 * the clerk does not have to open the parcel to see what they are recording.
 */
function toParcelRows(nodes: readonly Parcel[]): Row[] {
  return nodes.map((parcel) => ({
    id: parcel.id,
    label: parcel.trackingNumber,
    hint:
      parcel.paymentType === "COD"
        ? `Collects ${formatMoney(parcel.codAmount)} on delivery`
        : "Prepaid",
    status: parcel.status,
  }))
}

function useReferenceRows(
  source: PickerSource,
  search: string,
  enabled: boolean,
  dependsOn: string,
): { rows: Row[]; isFetching: boolean; isError: boolean } {
  const params = { page: 1, limit: PAGE_SIZE, search: search || undefined }

  const cities = useQuery({
    queryKey: ["reference", "service-cities", params],
    queryFn: ({ signal }) => listCitiesForPicker(params, signal),
    enabled: enabled && source === "cities",
    staleTime: 60_000,
  })

  // The zone and area pickers are children of a chosen row, so the parent id is
  // part of both the query key and the request — a changed parent refetches
  // rather than reusing the previous city's zones.
  const cityZones = useQuery({
    queryKey: ["reference", "service-zones", dependsOn, params],
    queryFn: ({ signal }) => listCityZonesForPicker(params, dependsOn, signal),
    enabled: enabled && source === "city-zones" && dependsOn.length > 0,
    staleTime: 60_000,
  })

  const zoneAreas = useQuery({
    queryKey: ["reference", "service-areas", dependsOn, params],
    queryFn: ({ signal }) => listZoneAreasForPicker(params, dependsOn, signal),
    enabled: enabled && source === "zone-areas" && dependsOn.length > 0,
    staleTime: 60_000,
  })

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

  const riderList = useQuery({
    queryKey: ["reference", "riders", params],
    queryFn: ({ signal }) => listRidersForPicker(params, signal),
    enabled: enabled && source === "riders",
    staleTime: 60_000,
  })

  // `listVehicles`/`listRoutes` take the full list query, so they get the sort
  // keys their table screens sort by — `search` is `string | undefined` here and
  // the two expect `string`, hence the `?? ""`. No signal is threaded: the list
  // helpers do not accept one, and dropping the request's abort signal here would
  // mean a superseded search still renders.
  const vehicleList = useQuery({
    queryKey: ["reference", "vehicles", params],
    queryFn: () =>
      listVehicles({
        page: params.page,
        limit: params.limit,
        search: params.search ?? "",
        sortBy: "createdAt",
        sort: "desc",
      }),
    enabled: enabled && source === "vehicles",
    staleTime: 60_000,
  })

  const routeList = useQuery({
    queryKey: ["reference", "routes", params],
    queryFn: () =>
      listRoutes({
        page: params.page,
        limit: params.limit,
        search: params.search ?? "",
        sortBy: "createdAt",
        sort: "desc",
      }),
    enabled: enabled && source === "routes",
    staleTime: 60_000,
  })

  const parcelList = useQuery({
    queryKey: ["reference", "parcels", params],
    queryFn: ({ signal }) =>
      listParcels(
        {
          page: params.page,
          limit: params.limit,
          search: params.search ?? "",
          sortBy: "createdAt",
          sort: "desc",
        },
        signal,
      ),
    enabled: enabled && source === "parcels",
    staleTime: 60_000,
  })

  // Only the matching query is enabled, so the others never hold data.
  // Their pending flags are read anyway: an unused query is
  // `isFetching === false`, which is exactly the answer wanted for a source
  // that is not in play.
  const sources = {
    branches,
    hubs,
    zones,
    customers,
    riderList,
    vehicleList,
    routeList,
    parcelList,
    cities,
    cityZones,
    zoneAreas,
  }
  const active =
    source === "riders"
      ? riderList
      : source === "vehicles"
        ? vehicleList
        : source === "routes"
          ? routeList
          : source === "parcels"
            ? parcelList
            : source === "city-zones"
              ? cityZones
              : source === "zone-areas"
                ? zoneAreas
                : sources[source]
  const isFetching = active.isFetching
  const isError = active.isError

  const rows = React.useMemo(() => {
    if (source === "branches") return toBranchRows(branches.data?.nodes ?? [])
    if (source === "hubs") return toHubRows(hubs.data?.nodes ?? [])
    if (source === "zones") return toZoneRows(zones.data?.nodes ?? [])
    if (source === "riders") return toRiderRows(riderList.data?.nodes ?? [])
    if (source === "vehicles") return toVehicleRows(vehicleList.data?.nodes ?? [])
    if (source === "routes") return toRouteRows(routeList.data?.nodes ?? [])
    if (source === "parcels") return toParcelRows(parcelList.data?.nodes ?? [])
    if (source === "cities") return toCityRows(cities.data?.nodes ?? [])
    if (source === "city-zones") return toServiceZoneRows(cityZones.data?.nodes ?? [])
    if (source === "zone-areas") return toServiceAreaRows(zoneAreas.data?.nodes ?? [])
    return toCustomerRows(customers.data?.nodes ?? [])
  }, [
    source,
    branches.data,
    hubs.data,
    zones.data,
    customers.data,
    riderList.data,
    vehicleList.data,
    routeList.data,
    parcelList.data,
    cities.data,
    cityZones.data,
    zoneAreas.data,
  ])

  return { rows, isFetching, isError }
}

export function ReferenceCombobox({
  value,
  onChange,
  source,
  placeholder,
  disabled,
  dependsOn,
  id,
  invalid,
}: {
  /** Selected id, or `""` for nothing. */
  value: string
  onChange: (id: string) => void
  source: PickerSource
  placeholder: string
  disabled?: boolean
  /**
   * Parent id the picker must wait for. Empty means the control is disabled
   * (the cascade's parent has not been chosen yet), and a changed value
   * refetches the rows under the new parent.
   */
  dependsOn?: string
  id?: string
  /** Paints the red border; the message itself belongs to the form field. */
  invalid?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebouncedValue(search.trim(), 250)

  const blocked = disabled || (dependsOn !== undefined && dependsOn.length === 0)

  const { rows, isFetching, isError } = useReferenceRows(
    source,
    debouncedSearch,
    open && !blocked,
    dependsOn ?? "",
  )

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
          disabled={blocked}
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
