import { describe, expect, test } from "bun:test"

import { pickRoutingHub } from "./parcels.service"
import type { RoutingHub } from "./parcels.repository"

const hubs: RoutingHub[] = [
  { id: "1", type: "SORTING", district: "Dhaka", latitude: 23.8, longitude: 90.4 },
  { id: "2", type: "ORIGIN", district: "Dhaka", latitude: 23.81, longitude: 90.41 },
  { id: "3", type: "DESTINATION", district: "Dhaka", latitude: 23.82, longitude: 90.42 },
  {
    id: "5",
    type: "ORIGIN",
    district: "Chattogram",
    latitude: 22.35,
    longitude: 91.82,
  },
  {
    id: "6",
    type: "DESTINATION",
    district: "Chattogram",
    latitude: 22.36,
    longitude: 91.83,
  },
]

describe("pickRoutingHub", () => {
  test("uses the city district when an address has no map pin", () => {
    expect(pickRoutingHub(hubs, "ORIGIN", { cityName: "Dhaka" })?.id).toBe("2")
  })

  test("normalizes Chittagong to the Chattogram hub district", () => {
    expect(pickRoutingHub(hubs, "DESTINATION", { cityName: "Chittagong" })?.id).toBe("6")
  })

  test("uses distance among hubs with the required operational role", () => {
    expect(
      pickRoutingHub(hubs, "ORIGIN", {
        cityName: "Dhaka",
        latitude: 22.34,
        longitude: 91.81,
      })?.id,
    ).toBe("5")
  })

  test("does not silently use an unrelated hub", () => {
    expect(pickRoutingHub(hubs, "DESTINATION", { cityName: "Rajshahi" })).toBeUndefined()
  })
})
