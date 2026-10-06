import { useQuery } from "@tanstack/react-query"
import { listServiceCities, listServiceZones } from "@/lib/endpoints"

/**
 * Options queries for the location filters and form pickers.
 *
 * Territory is small reference data — page one covers every row in practice —
 * so these are a cheap fetch with a long stale time, not URL-driven lists. They
 * are split from the CRUD pages because a filter Select and a form sheet both
 * need the same rows under the same key, and two screens querying the same key
 * share one cache entry instead of issuing two requests.
 */
export function useCityOptions() {
  return useQuery({
    queryKey: ["location", "cities", "options"],
    queryFn: () =>
      listServiceCities({ page: 1, limit: 100, sortBy: "name", sort: "asc", search: "" }),
    staleTime: 5 * 60_000,
  })
}

export function useServiceZoneOptions(cityId?: string) {
  return useQuery({
    queryKey: ["location", "zones", "options", cityId ?? "all"],
    queryFn: () =>
      listServiceZones({
        page: 1,
        limit: 100,
        sortBy: "name",
        sort: "asc",
        search: "",
        ...(cityId ? { cityId } : {}),
      }),
    staleTime: 60_000,
  })
}
