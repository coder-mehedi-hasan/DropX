import type { Id } from "@dropx/db";

/**
 * In-process domain events.
 *
 * Emitted **after** the durable write commits, never before: a notification
 * provider outage must not roll back a delivery that already happened. Handlers
 * are responsible for their own failure isolation.
 *
 * Swap for Redis pub/sub or a queue when the API runs as more than one process.
 */

export type DomainEventMap = {
  "parcel.created": { parcelId: Id; trackingNumber: string; customerId: Id };
  "parcel.status_changed": {
    parcelId: Id;
    trackingNumber: string;
    from: string;
    to: string;
  };
  "parcel.picked_up": { parcelId: Id; trackingNumber: string; riderId: Id };
  "parcel.delivered": { parcelId: Id; trackingNumber: string; deliveryId: Id };
  "parcel.failed": { parcelId: Id; trackingNumber: string; reason: string };
  "pickup.assigned": { pickupId: Id; riderId: Id };
  "delivery.assigned": { deliveryId: Id; riderId: Id; attemptNo: number };
  "customer.activated": { customerId: Id };
};

export type DomainEventName = keyof DomainEventMap;

export type DomainEventHandler<K extends DomainEventName> = (
  payload: DomainEventMap[K],
) => void | Promise<void>;

const handlers = new Map<DomainEventName, Set<DomainEventHandler<never>>>();

export function on<K extends DomainEventName>(event: K, handler: DomainEventHandler<K>): void {
  let bucket = handlers.get(event);
  if (!bucket) {
    bucket = new Set();
    handlers.set(event, bucket);
  }
  bucket.add(handler as DomainEventHandler<never>);
}

/**
 * Fire-and-forget emit. A throwing listener is logged and swallowed — the
 * caller has already committed its write.
 */
export function emit<K extends DomainEventName>(event: K, payload: DomainEventMap[K]): void {
  const bucket = handlers.get(event);
  if (!bucket) return;

  for (const handler of bucket) {
    try {
      const result = (handler as DomainEventHandler<K>)(payload);
      if (result instanceof Promise) {
        result.catch((error: unknown) => {
          console.error(`[events] handler for "${event}" failed`, error);
        });
      }
    } catch (error) {
      console.error(`[events] handler for "${event}" threw`, error);
    }
  }
}

/** Test seam. */
export function clearEventHandlers(): void {
  handlers.clear();
}
