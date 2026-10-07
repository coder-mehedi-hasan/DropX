"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { addressesApi, parcelsApi, pricingApi, trackingApi } from "@/lib/api"
import { listCities, listCityZones, listZoneAreas } from "@/lib/reference-data"
import type {
  CreateCustomerAddressInput,
  CreateParcelRequest,
  ListQueryParams,
  QuoteRequest,
  UpdateCustomerAddressInput,
} from "@/lib/types"

/**
 * Query keys, centralised so an invalidation after a booking cannot drift from
 * the key the list actually reads.
 */
export const queryKeys = {
  myParcels: (params: ListQueryParams) => ["parcels", "mine", params] as const,
  myParcel: (id: string) => ["parcels", "mine", id] as const,
  tracking: (trackingNumber: string) => ["tracking", trackingNumber] as const,
  quote: (request: QuoteRequest) => ["pricing", "quote", request] as const,
  pricingPlans: () => ["pricing", "plans"] as const,
  cities: () => ["reference", "cities"] as const,
  cityZones: (cityId: string) => ["reference", "cities", cityId, "zones"] as const,
  zoneAreas: (zoneId: string) => ["reference", "zones", zoneId, "areas"] as const,
  savedAddresses: () => ["addresses", "mine"] as const,
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
        pickupCityId: "",
        pickupZoneId: "",
        deliveryCityId: "",
        deliveryZoneId: "",
        weightGrams: 0,
        codAmount: 0,
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

/** The published price list. Rarely changes, so it is cached hard. */
export function usePricingPlans() {
  return useQuery({
    queryKey: queryKeys.pricingPlans(),
    queryFn: () => pricingApi.listPlans(),
    staleTime: 10 * 60_000,
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

export function useSavedAddresses() {
  return useQuery({
    queryKey: queryKeys.savedAddresses(),
    queryFn: () => addressesApi.list(),
    staleTime: 30_000,
  })
}

export function useCreateAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateCustomerAddressInput) => addressesApi.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["addresses"] })
    },
  })
}

export function useUpdateAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateCustomerAddressInput }) =>
      addressesApi.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["addresses"] })
    },
  })
}

export function useDeleteAddress() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => addressesApi.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["addresses"] })
    },
  })
}

export function useCities() {
  return useQuery({ queryKey: queryKeys.cities(), queryFn: listCities, staleTime: Infinity })
}

/** `cityId` empty keeps the query disabled — no request until a city is picked. */
export function useCityZones(cityId: string) {
  return useQuery({
    queryKey: queryKeys.cityZones(cityId),
    queryFn: () => listCityZones(cityId),
    enabled: cityId.length > 0,
    staleTime: Infinity,
  })
}

export function useZoneAreas(zoneId: string) {
  return useQuery({
    queryKey: queryKeys.zoneAreas(zoneId),
    queryFn: () => listZoneAreas(zoneId),
    enabled: zoneId.length > 0,
    staleTime: Infinity,
  })
}
