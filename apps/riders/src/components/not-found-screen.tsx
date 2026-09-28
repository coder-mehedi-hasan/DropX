import { Link } from "@tanstack/react-router"
import { Compass } from "lucide-react"
import { Button, EmptyState } from "@dropx/ui"

export function NotFoundScreen() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4">
      <EmptyState
        icon={Compass}
        title="That screen does not exist"
        description="The link may be from an older build of the rider app."
        action={
          <Button asChild size="lg" className="tap-target">
            <Link to="/jobs">Go to my jobs</Link>
          </Button>
        }
      />
    </main>
  )
}
