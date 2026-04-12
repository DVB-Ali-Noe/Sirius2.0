"use client"

import { useState } from "react"
import type { Dataset } from "@/hooks/use-datasets"
import { QualityCertificate } from "./QualityCertificate"

interface DatasetCardProps {
  dataset: Dataset
  action?: React.ReactNode
}

const CATEGORY_COLORS: Record<string, string> = {
  "instruction-tuning": "border-accent/40 text-accent",
  "medical": "border-blue-400/40 text-blue-400",
  "financial": "border-positive/40 text-positive",
  "code": "border-purple-400/40 text-purple-400",
}

function ScoreRing({ score }: { score: number }) {
  const r = 18
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = score >= 80 ? "#34D399" : score >= 50 ? "#FF4D00" : "#F87171"

  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <circle
          cx="24" cy="24" r={r} fill="none"
          stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute text-xs font-bold text-foreground">{score}</span>
    </div>
  )
}

export function DatasetCard({ dataset, action }: DatasetCardProps) {
  const [certOpen, setCertOpen] = useState(false)
  const catStyle = CATEGORY_COLORS[dataset.description.category] ?? "border-white/20 text-muted"
  const score = dataset.boundlessProof.assertions.qualityScore

  return (
    <>
      <div className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface/50 p-5 backdrop-blur-sm transition-colors hover:border-white/20">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <h3 className="text-sm font-medium text-foreground truncate">{dataset.description.name}</h3>
            {dataset.description.description && (
              <p className="text-xs text-muted line-clamp-2">{dataset.description.description}</p>
            )}
          </div>
          <ScoreRing score={score} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] uppercase tracking-wider ${catStyle}`}>
            {dataset.description.category}
          </span>
          <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] text-muted">
            {dataset.entryCount.toLocaleString()} rows
          </span>
          {dataset.description.language && (
            <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] text-muted uppercase">
              {dataset.description.language}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setCertOpen(true)}
            className="flex items-center gap-1.5 text-xs text-positive hover:underline cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            ZK Verified
          </button>
          {action}
        </div>
      </div>

      <QualityCertificate dataset={dataset} open={certOpen} onClose={() => setCertOpen(false)} />
    </>
  )
}
