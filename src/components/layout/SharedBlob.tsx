"use client"

import dynamic from "next/dynamic"

const Blob = dynamic(() => import("@/components/landing/Blob"), { ssr: false })

export default function SharedBlob() {
  return <Blob />
}
