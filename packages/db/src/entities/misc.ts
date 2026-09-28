import type { Id } from "../port/database"
import type { CreatedAt, EntityBase, Nullable, Timestamped } from "./base"
import type { EntityName } from "./base"

export const NOTIFICATION_CHANNELS = ["SMS", "EMAIL", "PUSH"] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export const NOTIFICATION_STATUSES = ["PENDING", "SENT", "FAILED"] as const
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number]

/**
 * Outbound log. The row is written as part of the domain write so the audit
 * trail is durable, then handed to the provider **after** commit — a provider
 * outage must never roll back the business transaction.
 */
export type Notification = EntityBase &
  CreatedAt & {
    userId: Nullable<Id>
    customerId: Nullable<Id>
    parcelId: Nullable<Id>
    channel: NotificationChannel
    eventType: string
    recipient: string
    message: string
    status: NotificationStatus
    sentAt: Nullable<Date>
  }

export const TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export type SupportTicket = EntityBase &
  Timestamped & {
    customerId: Id
    parcelId: Nullable<Id>
    assignedTo: Nullable<Id>
    subject: string
    description: string
    priority: TicketPriority
    status: TicketStatus
  }

export type SupportTicketDetail = SupportTicket & {
  customerName: string
  customerPhone: string
  assigneeName: Nullable<string>
}

/** Written for every privileged staff mutation. `oldData`/`newData` are JSON. */
export type AuditLog = EntityBase &
  CreatedAt & {
    userId: Nullable<Id>
    action: string
    entityType: EntityName | (string & {})
    entityId: Nullable<Id>
    oldData: Nullable<unknown>
    newData: Nullable<unknown>
    ipAddress: Nullable<string>
  }
