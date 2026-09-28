import { Button, EmptyState } from "@dropx/ui"
import { PackageXIcon } from "lucide-react"
import Link from "next/link"

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-24">
      <EmptyState
        icon={PackageXIcon}
        title="That page is not here"
        description="The link may be out of date, or the parcel may not be on your account."
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to my parcels</Link>
          </Button>
        }
        className="w-full"
      />
    </main>
  )
}
