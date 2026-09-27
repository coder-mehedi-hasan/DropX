import type { Id } from "../port/database";
import type { EntityBase, Nullable, Timestamped } from "./base";

export const VEHICLE_TYPES = ["BIKE", "VAN", "TRUCK", "COVERED_VAN"] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_STATUSES = ["AVAILABLE", "IN_USE", "MAINTENANCE", "INACTIVE"] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export type Vehicle = EntityBase & Timestamped & {
  registrationNumber: string;
  type: VehicleType;
  capacityKg: number;
  status: VehicleStatus;
};

/**
 * How the *company* pays the rider. Separate from customer COD: the customer
 * pays the rider in cash, the rider remits to the company, and the company
 * disburses via settlements.
 */
export const COMPENSATION_TYPES = ["SALARIED", "CONTRACTUAL", "COMMISSION", "MIXED"] as const;
export type CompensationType = (typeof COMPENSATION_TYPES)[number];

export const RIDER_STATUSES = ["AVAILABLE", "BUSY", "OFFLINE", "SUSPENDED"] as const;
export type RiderStatus = (typeof RIDER_STATUSES)[number];

/** Riders are `users` with an operational profile. One row per user. */
export type Rider = EntityBase & Timestamped & {
  userId: Id;
  hubId: Id;
  employeeCode: string;
  licenseNumber: Nullable<string>;
  compensationType: CompensationType;
  status: RiderStatus;
};

export type RiderLocation = EntityBase & {
  riderId: Id;
  latitude: number;
  longitude: number;
  recordedAt: Date;
};

export type RiderWithUser = Rider & {
  user: {
    id: Id;
    name: string;
    email: string;
    phone: Nullable<string>;
    branchId: Nullable<Id>;
  };
};
