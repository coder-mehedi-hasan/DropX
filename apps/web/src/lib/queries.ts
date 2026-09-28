"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { parcelsApi, pricingApi, trackingApi } from "@/lib/api"
import { listHubs, listRecipients, listZones } from "@/lib/reference-data"
import type { CreateParcelRequest, ListQueryParams, QuoteRequest } from "@/lib/types"

/**
 * Query keys, centralised so an invalidation after a booking cannot drift from
 * the key the list actually reads.
 */
export const queryKeys = {
  myParcels: (params: ListQueryParams) => ["parcels", "mine", params] as const,
  myParcel: (id: string) => ["parcels", "mine", id] as const,
  tracking: (trackingNumber: string) => ["tracking", trackingNumber] as const,
  quote: (request: QuoteRequest) => ["pricing", "quote", request] as const,
  hubs: () => ["reference", "hubs"] as const,
  zones: () => ["reference", "zones"] as const,
  recipients: () => ["reference", "recipients"] as const,
}

export function useMyParcels(params: ListQueryParams) {
  return useQuery({
    queryKey: queryKeys.myParcels(params),
    queryFn: () => parcelsApi.listOwn(params),
    placeholderData: (previous) => previous,
  })
}

export function useMyParcel(id: string) {
  return useQuery({
    queryKey: queryKeys.myParcel(id),
    queryFn: () => parcelsApi.getOwn(id),
    enabled: id.length > 0,
  })
}

export function useTracking(trackingNumber: string) {
  const normalised = trackingNumber.trim().toUpperCase()

  return useQuery({
    queryKey: queryKeys.tracking(normalised),
    queryFn: () => trackingApi.track(normalised),
    enabled: normalised.length > 0,
    /**
     * A wrong tracking number is the expected case on this screen, not a
     */
    /**
     * transient fault, so it is not worth three attempts.
     */
    retry: false,
    staleTime: 15_000,
  })
}

export function useFeeQuote(request: QuoteRequest | null) {
  return useQuery({
    queryKey: queryKeys.quote(
      request ?? {
        originZoneId: "",
        destinationZoneId: "",
        weightKg: 0,
        codAmount: 0,
        express: false,
      },
    ),
    queryFn: () => {
      if (!request) throw new Error("quote requested without a route")
      return pricingApi.quote(request)
    },
    enabled: request !== null,
    retry: false,
  })
}

export function useCreateParcel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateParcelRequest) => parcelsApi.createOwn(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["parcels"] })
    },
  })
}

export function useHubs() {
  return useQuery({ queryKey: queryKeys.hubs(), queryFn: listHubs, staleTime: Infinity })
}

export function useZones() {
  return useQuery({ queryKey: queryKeys.zones(), queryFn: listZones, staleTime: Infinity })
}

export function useRecipients() {
  return useQuery({
    queryKey: queryKeys.recipients(),
    queryFn: listRecipients,
    staleTime: Infinity,
  })
}
