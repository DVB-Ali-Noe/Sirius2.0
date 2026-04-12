"use client"

import { Modal } from "@/components/common/Modal"
import type { Dataset } from "@/hooks/use-datasets"

interface QualityCertificateProps {
  dataset: Dataset
  open: boolean
  onClose: () => void
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm text-foreground font-medium">{value}</span>
    </div>
  )
}

export function QualityCertificate({ dataset, open, onClose }: QualityCertificateProps) {
  const { assertions } = dataset.boundlessProof

  return (
    <Modal open={open} onClose={onClose} title="ZK Quality Certificate">
      <div className="flex flex-col gap-1">
        <Row label="Dataset" value={dataset.description.name} />
        <Row label="Entry Count" value={dataset.entryCount.toLocaleString()} />
        <Row label="Duplicate Rate" value={assertions.duplicateRate} />
        <Row label="Schema Valid" value={assertions.schemaValid !== false ? "Yes" : "No"} />
        <Row label="Field Completeness" value={assertions.fieldCompleteness != null && !isNaN(assertions.fieldCompleteness) ? `${(assertions.fieldCompleteness * 100).toFixed(0)}%` : "N/A"} />
        <Row label="Quality Score" value={`${assertions.qualityScore}/100`} />
        <Row label="Proof ID" value={dataset.boundlessProof.proofId.slice(0, 16) + "..."} />
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-positive/20 bg-positive/5 px-3 py-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-positive shrink-0">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="text-xs text-positive">Verified by Boundless zkVM</span>
      </div>
    </Modal>
  )
}
