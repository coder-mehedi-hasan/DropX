import { AuthGuard, PortalShell } from "@/components/portal-shell"

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <PortalShell>{children}</PortalShell>
    </AuthGuard>
  )
}
