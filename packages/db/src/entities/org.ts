import type { Id } from "../port/database"
import type { EntityBase, Nullable, Timestamped } from "./base"

export const BRANCH_STATUSES = ["ACTIVE", "INACTIVE"] as const
export type BranchStatus = (typeof BRANCH_STATUSES)[number]

export type Branch = EntityBase &
  Timestamped & {
    name: string
    code: string
    phone: Nullable<string>
    address: Nullable<string>
    city: Nullable<string>
    district: Nullable<string>
    latitude: Nullable<number>
    longitude: Nullable<number>
    status: BranchStatus
  }

export const HUB_TYPES = ["ORIGIN", "SORTING", "TRANSIT", "DESTINATION"] as const
export type HubType = (typeof HUB_TYPES)[number]

export const HUB_STATUSES = ["ACTIVE", "INACTIVE", "MAINTENANCE"] as const
export type HubStatus = (typeof HUB_STATUSES)[number]

export type Hub = EntityBase &
  Timestamped & {
    branchId: Id
    name: string
    code: string
    type: HubType
    address: Nullable<string>
    district: Nullable<string>
    latitude: Nullable<number>
    longitude: Nullable<number>
    capacity: Nullable<number>
    status: HubStatus
  }

/** Branch + hub as returned by scoped selectors in the console. */
export type HubWithBranch = Hub & {
  branchName: string
  branchCode: string
}
