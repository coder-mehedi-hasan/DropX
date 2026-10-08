import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, Plus, Search, X } from "lucide-react"
import { useState } from "react"
import {
  AppToast,
  Badge,
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@dropx/ui"

import { listParcels, replaceTransferManifest } from "@/lib/endpoints"
import { ServerError } from "@/components/server-error"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import type { Parcel, TransferWithManifest } from "@/lib/types"

/**
 * The load list.
 *
 * A transfer's manifest is the one place in this app where a human assembles a
 * *set* of parcels by hand, so it gets a dialog of its own rather than a field on
 * the transfer form. Two reasons: the set can be 500 parcels long, and it is
 * edited repeatedly — load three, notice one is damaged, take it off, load two
 * more — which a create-form cannot express without being submitted every time.
 *
 * It is a `Dialog` and not a `FormSheet` for the same reason. A `FormSheet` is a
 * validated form with one submit; this is a running list that is saved on every
 * add and remove. Wrapping it in a form would mean either submitting on every
 * click — which is what the mutation does, but through a form that implies a
 * single save — or not using the form at all and paying for its shell.
 *
 * **The API takes parcel ids, not tracking numbers.** A dispatcher reads a
 * tracking number off a parcel label; the row id is meaningless to them. So the
 * picker searches by tracking number and the dialog holds the id, showing the
 * tracking number back. The same split the pickup form makes, in the other
 * direction: there the human types and the API resolves, here the human picks and
 * the dialog resolves.
 *
 * Only parcels at the origin hub are offered. The API enforces this with a 422
 * that names the offending parcel, but a picker that offers a parcel the API will
 * reject is a control that lies, so the search is scoped to the origin hub.
 */
export function TransferManifestSheet({
  open,
  onOpenChange,
  transfer,
  onManifestChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  transfer: TransferWithManifest | null
  onManifestChange: (parcels: TransferWithManifest["parcels"]) => void
}) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebouncedValue(search.trim(), 250)

  const sealed = transfer
    ? transfer.status === "IN_TRANSIT" ||
      transfer.status === "ARRIVED" ||
      transfer.status === "CANCELLED"
    : false

  const parcelsQuery = useQuery({
    queryKey: ["transfer-manifest-picker", transfer?.fromHubId, debouncedSearch],
    queryFn: ({ signal }) =>
      listParcels(
        {
          page: 1,
          limit: 25,
          sortBy: "createdAt",
          sort: "desc",
          search: debouncedSearch || undefined,
          hubId: transfer?.fromHubId,
        },
        signal,
      ),
    enabled: open && Boolean(transfer) && !sealed,
  })

  const mutation = useMutation({
    mutationFn: (parcelIds: string[]) => replaceTransferManifest(transfer!.id, { parcelIds }),
    onSuccess: (manifest) => {
      AppToast.success("Manifest updated")
      onManifestChange(manifest)
      void queryClient.invalidateQueries({ queryKey: ["transfers"] })
    },
  })

  if (!transfer) return null

  const manifestIds = new Set(transfer.parcels.map((parcel) => parcel.parcelId))
  const candidates = (parcelsQuery.data?.nodes ?? []).filter(
    (parcel) =>
      !manifestIds.has(parcel.id) && (parcel.status === "PICKED_UP" || parcel.status === "AT_HUB"),
  )

  function add(parcel: Parcel) {
    mutation.mutate([...transfer!.parcels.map((p) => p.parcelId), parcel.id])
  }

  function remove(parcelId: string) {
    mutation.mutate(transfer!.parcels.filter((p) => p.parcelId !== parcelId).map((p) => p.parcelId))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manifest — {transfer.transferNumber}</DialogTitle>
          <DialogDescription>
            {sealed
              ? "This transfer has departed, so its manifest is a record of what was on the truck rather than a plan."
              : "Parcels at the origin hub. The API rejects any parcel that is not there, so the picker only offers those that are."}
          </DialogDescription>
        </DialogHeader>

        <ServerError error={mutation.error} title="Could not update manifest" />

        {sealed ? null : (
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">Add a parcel</div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="justify-start font-normal"
                  disabled={mutation.isPending}
                >
                  <Search className="size-4 opacity-50" />
                  Search by tracking number
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <div className="flex items-center gap-2 border-b px-3">
                    <Search className="size-4 shrink-0 opacity-50" aria-hidden="true" />
                    <CommandInput
                      value={search}
                      onValueChange={setSearch}
                      placeholder="DX-2026-000123"
                      className="h-11 border-0 focus-visible:ring-0"
                    />
                  </div>
                  <CommandList>
                    {parcelsQuery.isError ? (
                      <div className="text-destructive px-3 py-6 text-center text-sm">
                        Could not load parcels. Try again.
                      </div>
                    ) : candidates.length === 0 ? (
                      <CommandEmpty>
                        {parcelsQuery.isPending
                          ? "Searching…"
                          : `No parcel at this hub matches “${search}”`}
                      </CommandEmpty>
                    ) : (
                      <CommandGroup>
                        {candidates.map((parcel) => (
                          <CommandItem
                            key={parcel.id}
                            value={parcel.id}
                            onSelect={() => add(parcel)}
                            className="gap-2"
                          >
                            <Plus className="size-4 shrink-0 opacity-50" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-mono text-xs">
                                {parcel.trackingNumber}
                              </span>
                              <span className="text-muted-foreground block truncate text-xs">
                                {parcel.status}
                              </span>
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="text-sm font-medium">
            On this transfer{" "}
            <span className="text-muted-foreground">({transfer.parcels.length})</span>
          </div>
          {transfer.parcels.length === 0 ? (
            <div className="text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm">
              Nothing loaded yet.
            </div>
          ) : (
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {transfer.parcels.map((parcel) => (
                <li
                  key={parcel.parcelId}
                  className="flex items-center gap-2 rounded-md border px-3 py-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-xs">
                      {parcel.trackingNumber}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {parcel.status}
                      {parcel.loadedAt ? " · loaded" : ""}
                      {parcel.unloadedAt ? " · unloaded" : ""}
                    </span>
                  </span>
                  <Badge variant="secondary">{parcel.status}</Badge>
                  {sealed ? null : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${parcel.trackingNumber} from this transfer`}
                      disabled={mutation.isPending}
                      onClick={() => remove(parcel.parcelId)}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {mutation.isPending ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Saving…
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
