import type { FieldErrors, FieldValues, Path, UseFormSetError } from "react-hook-form"
import { ClipboardList } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@dropx/ui"

import { ApiError } from "@/lib/api-client"

/**
 * Field name → label.
 *
 * Only used by the summary line: each individual field still renders its own
 * message under itself, so this exists for the errors that no visible input
 * owns — an array-level problem, or a field the API names differently.
 */
const FIELD_LABELS: Record<string, string> = {
  senderCustomerId: "Sender customer id",
  receiverCustomerId: "Receiver customer id",
  receiverName: "Receiver name",
  receiverPhone: "Receiver phone",
  originHubId: "Origin hub id",
  destinationHubId: "Destination hub id",
  originZoneId: "Origin zone id",
  destinationZoneId: "Destination zone id",
  weight: "Weight",
  length: "Length",
  width: "Width",
  height: "Height",
  parcelType: "Parcel type",
  paymentType: "Payment type",
  codAmount: "Amount to collect",
  items: "Items",
  status: "Status",
  reason: "Reason",
  hubId: "Hub",
}

function labelFor(field: string): string {
  const base = field.split(".")[0] ?? field
  return FIELD_LABELS[base] ?? base
}

/**
 * Maps the API's `error.details[]` back onto the form.
 *
 * `details` is the only machine-readable channel back from a rejected booking,
 * and a bare banner saying "senderCustomerId is required" while the user stares
 * at an empty dialog is the worst possible outcome — so each entry becomes a
 * real message on the input it names.
 */
export function mapDetailsToFields<TFieldValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TFieldValues>,
): void {
  if (!(error instanceof ApiError)) return

  for (const detail of error.details) {
    if (!detail.field) continue
    setError(detail.field as Path<TFieldValues>, { message: detail.message, type: "server" })
  }
}

type ErrorLeaf = { message?: string; type?: string }
type ErrorNode = ErrorLeaf | ErrorNode[] | { [key: string]: ErrorNode | undefined } | undefined

function isLeaf(node: ErrorNode): node is ErrorLeaf {
  return typeof node === "object" && node !== null && !Array.isArray(node) && "type" in node
}

function collect(field: string, node: ErrorNode, out: { field: string; message: string }[]): void {
  if (!node) return

  if (isLeaf(node)) {
    if (typeof node.message === "string" && node.message.length > 0)
      out.push({ field, message: node.message })
    return
  }

  if (Array.isArray(node)) {
    node.forEach((entry, index) => collect(`${field}.${index}`, entry, out))
    return
  }

  for (const [key, entry] of Object.entries(node)) collect(`${field}.${key}`, entry, out)
}

/**
 * Roll-up of validation failures.
 *
 * `FormMessage` already renders an error under the input that owns it; this
 * exists for what is left over, so a rejected booking never fails silently in
 * a corner of a long form.
 */
export function FieldErrorSummary<TFieldValues extends FieldValues>({
  errors,
}: {
  errors: FieldErrors<TFieldValues>
}) {
  const entries: { field: string; message: string }[] = []
  for (const [field, value] of Object.entries(errors as Record<string, ErrorNode>)) {
    collect(field, value, entries)
  }

  if (entries.length === 0) return null

  return (
    <Alert variant="warning">
      <ClipboardList />
      <AlertTitle>Fix these before booking</AlertTitle>
      <AlertDescription>
        <ul className="ml-4 list-disc space-y-0.5">
          {entries.map((entry) => (
            <li key={`${entry.field}:${entry.message}`}>
              <span className="font-medium">{labelFor(entry.field)}: </span>
              {entry.message}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}
