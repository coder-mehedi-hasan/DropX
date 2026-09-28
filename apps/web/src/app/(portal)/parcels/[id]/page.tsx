import { notFound } from "next/navigation"

import { ParcelDetail } from "@/components/parcel-detail"

export default async function ParcelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) notFound()

  return <ParcelDetail parcelId={id} />
}
