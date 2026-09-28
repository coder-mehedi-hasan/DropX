import type { Metadata } from "next"

import { BookParcel } from "@/components/book-parcel"

export const metadata: Metadata = {
  title: "Book a parcel",
  description:
    "Book a parcel: receiver, route, weight and payment, with a delivery fee quoted up front.",
}

export default function BookPage() {
  return <BookParcel />
}
