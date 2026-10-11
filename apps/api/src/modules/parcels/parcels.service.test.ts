import { describe, expect, test } from "bun:test"

import { pickRoutingHub } from "./parcels.service"
import type { RoutingHub } from "./parcels.repository"

const hubs: RoutingHub[] = [
  {
    id: "1",
    services: ["PICKUP", "SORTING", "DELIVERY"],
    district: "Dhaka",
    latitude: 23.8,
    longitude: 90.4,
  },
  {
    id: "4",
    services: ["PICKUP", "SORTING", "DELIVERY"],
    district: "Chattogram",
    latitude: 22.35,
    longitude: 91.82,
  },
]

describe("pickRoutingHub", () => {
  test("uses the city district when an address has no map pin", () => {
    expect(pickRoutingHub(hubs, "PICKUP", { cityName: "Dhaka" })?.id).toBe("1")
  })

  test("normalizes Chittagong to the Chattogram hub district", () => {
    expect(pickRoutingHub(hubs, "DELIVERY", { cityName: "Chittagong" })?.id).toBe("4")
  })

  test("uses distance among hubs with the required operational role", () => {
    expect(
      pickRoutingHub(hubs, "PICKUP", {
        cityName: "Dhaka",
        latitude: 22.34,
        longitude: 91.81,
      })?.id,
    ).toBe("4")
  })

  test("does not silently use an unrelated hub", () => {
    expect(pickRoutingHub(hubs, "DELIVERY", { cityName: "Rajshahi" })).toBeUndefined()
  })

  test("allows one multi-service hub to own both ends of a local journey", () => {
    const origin = pickRoutingHub(hubs, "PICKUP", { cityName: "Dhaka" })
    const destination = pickRoutingHub(hubs, "DELIVERY", { cityName: "Dhaka" })
    expect(origin?.id).toBe("1")
    expect(destination?.id).toBe("1")
  })
})
