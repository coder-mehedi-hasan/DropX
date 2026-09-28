import { CameraOff, FileSignature } from "lucide-react"
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

/**
 * Proof of delivery placeholder.
 *
 * `rider.proof.submit` is a real permission key and `deliveries` has a proof
 * concept, but `apps/api` exposes no delivery-proof route yet. The control is
 * rendered disabled and labelled rather than hidden or faked, so the rider and
 * whoever reviews this screen can both see exactly what is missing.
 */
export function ProofPlaceholder() {
  const canSubmitProof = usePermission(RIDER_PERMISSIONS.PROOF_SUBMIT)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Proof of delivery</CardTitle>
        <CardDescription>
          Signature, photo and receiver OTP are recorded against the delivery attempt.
        </CardDescription>
        <Badge variant="warning" className="mt-1 w-fit">
          Not implemented
        </Badge>
      </CardHeader>
      <CardContent>
        <EmptyState
          icon={CameraOff}
          title="No proof endpoint yet"
          description="The API has no delivery-proof route, so nothing can be captured or uploaded from here. Marking the parcel delivered does not record proof."
          action={
            <div className="flex flex-col items-center gap-2">
              <Button variant="outline" size="lg" className="tap-target" disabled>
                <FileSignature />
                Capture signature
              </Button>
              <p className="text-muted-foreground text-xs">
                {canSubmitProof
                  ? "You hold rider.proof.submit — it becomes active once the API route ships."
                  : "You do not hold rider.proof.submit."}
              </p>
            </div>
          }
        />
      </CardContent>
    </Card>
  )
}
