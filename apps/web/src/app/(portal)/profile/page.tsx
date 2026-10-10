import type { Metadata } from "next"

import { ProfileEditor } from "@/components/profile-editor"

export const metadata: Metadata = {
  title: "My profile",
  description: "Your display name and profile photo across DropX.",
}

export default function ProfilePage() {
  return (
    <div className="grid gap-7">
      <ProfileEditor />
    </div>
  )
}