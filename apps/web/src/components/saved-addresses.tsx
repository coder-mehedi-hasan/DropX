"use client"

import { Button, EmptyState, Skeleton, useConfirmation } from "@dropx/ui"
import { MapPinIcon, PlusIcon } from "lucide-react"
import * as React from "react"
import { toast } from "sonner"

import { AddressFormSheet } from "@/components/address/address-form-sheet"
import { SavedAddressCard } from "@/components/address/saved-address-card"
import { PageHeader } from "@/components/page-header"
import { useCities, useDeleteAddress, useSavedAddresses } from "@/lib/queries"
import type { CustomerAddress } from "@/lib/types"

/**
 * The customer's saved-address book.
 *
 * A saved address is structured like one end of a booking — the same city/zone/
 * area cascade plus an address line — so it can prefill the booking form. The
 * screen is a list of cards plus a sheet for the create/edit form, because the
 * cascade needs the room a side panel gives and a booking already knows how to
 * read the result. The card and the sheet are shared with the booking wizard's
 * address step, so a saved place looks and edits the same in both places.
 */

export function SavedAddresses() {
  const addresses = useSavedAddresses()
  const cities = useCities()
  const deleteAddress = useDeleteAddress()
  const { confirm, confirmationDialog } = useConfirmation()

  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<CustomerAddress | null>(null)

  const cityOptions = cities.data ?? []

  function openNew() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(address: CustomerAddress) {
    setEditing(address)
    setSheetOpen(true)
  }

  async function onDelete(address: CustomerAddress) {
    const ok = await confirm({
      title: "Delete this saved address?",
      description: `"${address.label || address.addressLine}" will be removed from your address book.`,
      confirmLabel: "Delete address",
      destructive: true,
    })
    if (!ok) return
    try {
      await deleteAddress.mutateAsync(address.id)
      toast.success("Address deleted")
    } catch {
      toast.error("Could not delete that address. Please try again.")
    }
  }

  return (
    <div className="grid w-full gap-7">
      {confirmationDialog}
      <PageHeader
        eyebrow="Account"
        title="Saved addresses"
        description="Reuse the places you send and receive from. Pick one while booking to fill the address in one tap."
        actions={
          <Button onClick={openNew}>
            <PlusIcon />
            Add address
          </Button>
        }
      />

      {addresses.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : null}

      {addresses.isError ? (
        <EmptyState
          icon={MapPinIcon}
          title="Could not load your addresses"
          description="The saved-address list did not load. Pull to refresh and try again."
        />
      ) : null}

      {addresses.isSuccess && addresses.data.length === 0 ? (
        <EmptyState
          icon={MapPinIcon}
          title="No saved addresses yet"
          description="Save the places you send and receive from to skip typing them every time."
          action={
            <Button onClick={openNew}>
              <PlusIcon />
              Add your first address
            </Button>
          }
        />
      ) : null}

      {addresses.isSuccess && addresses.data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.data.map((address) => (
            <SavedAddressCard
              key={address.id}
              address={address}
              onEdit={() => openEdit(address)}
              onDelete={() => onDelete(address)}
            />
          ))}
        </div>
      ) : null}

      <AddressFormSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editing={editing}
        cityOptions={cityOptions}
      />
    </div>
  )
}
