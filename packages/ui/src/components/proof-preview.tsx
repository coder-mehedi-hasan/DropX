"use client"

import { ImageOff, ZoomIn } from "lucide-react"
import { useState } from "react"

import { cn } from "../lib/cn"
import { Button } from "./ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog"

/**
 * Proof of delivery image, thumbnail-first.
 *
 * A proof is a stored CDN URL (`file_url` on `delivery_proofs`); it deserves
 * a look before the office verifies it, so this renders a tap-to-zoom
 * thumbnail wherever the proof appears — admin proofs worklist and the rider
 * job screen. OTP and ID proofs have no image and never render here.
 */
export function ProofPreview({
  src,
  alt = "Proof image",
  className,
}: {
  src: string
  alt?: string
  /** Sizes the thumbnail widget. Defaults to a 40px square. */
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [broken, setBroken] = useState(false)

  if (broken) {
    return (
      <span
        title="This proof image could not be loaded"
        className={cn(
          "bg-muted flex items-center justify-center rounded-md",
          className ?? "size-10",
        )}
      >
        <ImageOff className="text-muted-foreground size-4" />
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Preview ${alt}`}
        title="Click to preview"
        className={cn(
          "bg-muted group focus-visible:ring-ring/40 relative overflow-hidden rounded-md focus-visible:ring-2 focus-visible:outline-none",
          className ?? "size-10",
        )}
        onClick={() => setOpen(true)}
      >
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" />
        <span className="bg-background/50 absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
          <ZoomIn className="size-4" />
        </span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{alt}</DialogTitle>
            <DialogDescription>
              Proof filed at the door — review it, then verify it in the office worklist.
            </DialogDescription>
          </DialogHeader>
          <img
            src={src}
            alt={alt}
            className="bg-muted max-h-[70dvh] w-full rounded-lg object-contain"
            onError={() => setBroken(true)}
          />
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
