"use client"

import * as React from "react"
import { MapIcon } from "lucide-react"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  EmptyState,
  Skeleton,
} from "@dropx/ui"

import { serviceTypeLabel } from "@/lib/location-labels"
import { useCities, useCityZones, useZoneAreas } from "@/lib/queries"

/**
 * Where DropX delivers: every active service city, its zones, and each zone's
 * areas. The cascade fetches lazily — a city's zones load only when it is
 * opened, and a zone's areas only when that zone is opened — so the page costs
 * one request until the reader actually drills in.
 *
 * One accordion per level, both single-open, which is what lets this component
 * keep a single zones query and a single areas query at the top level: the open
 * id *is* the fetch key.
 */
export function CoverageExplorer() {
  const cities = useCities()
  const [openCity, setOpenCity] = React.useState("")
  const [openZone, setOpenZone] = React.useState("")

  const zones = useCityZones(openCity)
  const areas = useZoneAreas(openZone)

  if (cities.isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (cities.isError) {
    return (
      <Alert variant="destructive">
        <MapIcon aria-hidden />
        <AlertTitle>We could not load the coverage list</AlertTitle>
        <AlertDescription className="flex items-center gap-3">
          <span>The locations service did not answer.</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void cities.refetch()}>
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const cityRows = cities.data ?? []

  if (cityRows.length === 0) {
    return (
      <EmptyState
        icon={MapIcon}
        title="No service cities yet"
        description="Coverage has not been published for this account."
        className="rounded-2xl bg-white py-14 ring-1 ring-black/5"
      />
    )
  }

  return (
    <Accordion
      type="single"
      collapsible
      value={openCity || undefined}
      onValueChange={(value) => {
        setOpenCity(value ?? "")
        setOpenZone("")
      }}
      variant="card"
      className="grid gap-4 lg:grid-cols-2"
    >
      {cityRows.map((city) => {
        const isOpen = openCity === city.id
        const zoneRows = isOpen ? (zones.data ?? []) : []

        return (
          <AccordionItem key={city.id} value={city.id} className="bg-white ring-1 ring-black/5">
            <AccordionTrigger className="px-5 py-4 hover:no-underline">
              <span className="grid gap-1 pr-3 text-left">
                <span className="flex items-center gap-2 text-base font-semibold">
                  {city.name ?? city.label}
                  {city.code ? (
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {city.code}
                    </Badge>
                  ) : null}
                </span>
                <span className="text-muted-foreground text-xs font-normal">
                  {city.serviceType ? serviceTypeLabel(city.serviceType) : null}
                </span>
              </span>
            </AccordionTrigger>

            <AccordionContent className="px-5 pb-5">
              {isOpen && zones.isLoading ? (
                <div className="grid gap-2">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ) : zoneRows.length === 0 ? (
                <p className="text-muted-foreground text-sm">No zones listed for this city yet.</p>
              ) : (
                <Accordion
                  type="single"
                  collapsible
                  value={openZone || undefined}
                  onValueChange={(value) => setOpenZone(value ?? "")}
                  variant="filled"
                  className="gap-2"
                >
                  {zoneRows.map((zone) => {
                    const zoneIsOpen = openZone === zone.id
                    const areaRows = zoneIsOpen ? (areas.data ?? []) : []

                    return (
                      <AccordionItem key={zone.id} value={zone.id} className="border-none">
                        <AccordionTrigger className="rounded-lg px-3 py-2.5 text-sm hover:no-underline">
                          <span className="flex items-center gap-2">
                            {zone.name ?? zone.label}
                            {zone.code ? (
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {zone.code}
                              </Badge>
                            ) : null}
                          </span>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3">
                          {zoneIsOpen && areas.isLoading ? (
                            <Skeleton className="h-7 w-2/3" />
                          ) : areaRows.length === 0 ? (
                            <p className="text-xs">
                              No named areas — book to this zone and add an address line.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {areaRows.map((area) => (
                                <Badge key={area.id} variant="secondary" className="font-normal">
                                  {area.name ?? area.label}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              )}
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
