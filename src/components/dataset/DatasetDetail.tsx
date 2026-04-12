"use client"

import { useState } from "react"
import { Modal } from "@/components/common/Modal"
import { QualityCertificate } from "./QualityCertificate"
import { ObjectLink } from "@/components/common/TxLink"
import type { Dataset } from "@/hooks/use-datasets"

function Pill({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-xs text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  )
}

interface DatasetDetailProps {
  dataset: Dataset | null
  open: boolean
  onClose: () => void
  action?: React.ReactNode
}

export function DatasetDetail({ dataset, open, onClose, action }: DatasetDetailProps) {
  const [certOpen, setCertOpen] = useState(false)

  if (!dataset) return null

  const { assertions } = dataset.boundlessProof
  const score = assertions.qualityScore ?? 0
  const completeness = assertions.fieldCompleteness
  const completenessStr = completeness != null && !isNaN(completeness) ? `${(completeness * 100).toFixed(0)}%` : "N/A"
  const scoreColor = score >= 80 ? "text-positive" : score >= 50 ? "text-accent" : "text-negative"

  return (
    <>
      <Modal open={open} onClose={onClose} title={dataset.description.name}>
        <div className="flex flex-col gap-3">
          {dataset.description.description && (
            <p className="text-xs text-muted leading-relaxed">{dataset.description.description}</p>
          )}

          <div className="grid grid-cols-4 gap-3">
            <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-background p-3">
              <span className={`text-xl font-bold ${scoreColor}`}>{score}</span>
              <span className="text-[9px] uppercase tracking-wider text-muted">Score</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-background p-3">
              <span className="text-xl font-bold text-foreground">{dataset.entryCount.toLocaleString()}</span>
              <span className="text-[9px] uppercase tracking-wider text-muted">Rows</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-background p-3">
              <span className="text-xl font-bold text-foreground">{assertions.duplicateRate}</span>
              <span className="text-[9px] uppercase tracking-wider text-muted">Dupes</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-lg border border-border bg-background p-3">
              <span className="text-xl font-bold text-foreground">{completenessStr}</span>
              <span className="text-[9px] uppercase tracking-wider text-muted">Complete</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 rounded-lg border border-border bg-background px-4 py-2">
            <Pill label="Category" value={dataset.description.category} />
            <Pill label="Format" value={dataset.description.format?.toUpperCase() ?? "—"} />
            <Pill label="Language" value={dataset.description.language?.toUpperCase() ?? "—"} />
            <Pill label="Version" value={dataset.version} />
            {dataset.mptIssuanceId && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-muted">MPT</span>
                <ObjectLink id={dataset.mptIssuanceId} />
              </div>
            )}
            {dataset.vaultId && (
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-muted">Pool</span>
                <ObjectLink id={dataset.vaultId} />
              </div>
            )}
          </div>

          {dataset.description.sampleFields && dataset.description.sampleFields.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {dataset.description.sampleFields.map((f) => (
                <span key={f} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] text-foreground">{f}</span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCertOpen(true)}
              className="flex items-center gap-1.5 rounded-full border border-positive/40 bg-positive/10 px-4 py-2 text-xs uppercase tracking-wider text-positive transition-colors hover:bg-positive/20 cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              ZK Certificate
            </button>
            {action && <div className="ml-auto">{action}</div>}
          </div>
        </div>
      </Modal>

      <QualityCertificate dataset={dataset} open={certOpen} onClose={() => setCertOpen(false)} />
    </>
  )
}
