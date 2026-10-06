import { useState } from "react"
import { FileSignature, Plus } from "lucide-react"
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@dropx/ui"

import { RIDER_PERMISSIONS } from "../../lib/permissions"
import { usePermission } from "../../lib/auth"
import { useJobProofs } from "../jobs/job-queries"
import { DeliveryProofSheet } from "../jobs/delivery-proof-sheet"

const TYPE_LABELS: Record<string, string> = {
  SIGNATURE: "Signature",
  PHOTO: "Photo",
  OTP: "Receiver OTP",
  IDENTITY: "ID check",
}

/**
 * Proof of delivery, recorded. Listed from `GET /jobs/:id/proofs`; filed
 * through the sheet the rider gates on `rider.proof.submit`.
 */
export function DeliveryProofsCard({
  parcelId,
  trackingNumber,
}: {
  parcelId: string
  trackingNumber: string
}) {
  const canSubmitProof = usePermission(RIDER_PERMISSIONS.PROOF_SUBMIT)
  const proofs = useJobProofs(parcelId)
  const [sheetOpen, setSheetOpen] = useState(false)

  const rows = proofs.data ?? []

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Proof of delivery</CardTitle>
            <CardDescription>Signature, photo, OTP, or ID recorded at the door.</CardDescription>
          </div>
          {canSubmitProof ? (
            <Button variant="outline" size="sm" onClick={() => setSheetOpen(true)}>
              <Plus />
              Add
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            icon={FileSignature}
            title="No proof filed yet"
            description="File a signature, photo, OTP, or ID check when you hand over the parcel."
          />
        ) : (
          <ul className="divide-y">
            {rows.map((proof) => (
              <li key={proof.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-sm">
                  {TYPE_LABELS[proof.type] ?? proof.type}
                  {proof.value ? (
                    <span className="text-muted-foreground font-mono text-xs">
                      {" "}
                      · {proof.value}
                    </span>
                  ) : null}
                </span>
                <Badge variant={proof.verifiedAt ? "success" : "warning"}>
                  {proof.verifiedAt ? "Verified" : "Awaiting review"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <DeliveryProofSheet
        parcelId={parcelId}
        trackingNumber={trackingNumber}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </Card>
  )
}
