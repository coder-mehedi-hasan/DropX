import type { Id } from "../port/database";
import type { CreatedAt, EntityBase, Nullable, Timestamped } from "./base";

/**
 * Money is stored as `DECIMAL` and decoded to `number` at the edge. Amounts are
 * 2-decimal taka amounts; do not run float arithmetic on them — round once at
 * the calculation site (see `docs/overview.md` on pricing).
 */

export const PAYMENT_KINDS = ["DELIVERY_FEE", "COD", "REFUND", "OTHER"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

export const PAYMENT_METHODS = ["CASH", "BKASH", "NAGAD", "CARD", "BANK", "ONLINE"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export type Payment = EntityBase & CreatedAt & {
  parcelId: Id;
  type: PaymentKind;
  amount: number;
  method: PaymentMethod;
  status: PaymentState;
  paidAt: Nullable<Date>;
};

export const SETTLEMENT_STATUSES = ["PENDING", "PROCESSING", "PAID", "FAILED"] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

/** Period payout to a customer, chiefly for business COD. */
export type Settlement = EntityBase & Timestamped & {
  customerId: Id;
  periodStart: string;
  periodEnd: string;
  totalCod: number;
  deliveryCharges: number;
  otherCharges: number;
  netAmount: number;
  status: SettlementStatus;
  paidAt: Nullable<Date>;
};

/** `periodStart`/`periodEnd` are DATE columns, so they stay `YYYY-MM-DD` strings. */
export type SettlementPeriod = {
  periodStart: string;
  periodEnd: string;
};
