"use client"

import { useState, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useWalletStore } from "@/stores/wallet"
import { useRouteGuard } from "@/hooks/use-route-guard"
import { useMyDatasets } from "@/hooks/use-my-datasets"
import { EmptyState } from "@/components/common/EmptyState"
import { LoadingSpinner } from "@/components/common/LoadingSpinner"
import { Toast } from "@/components/common/Toast"
import { apiPost } from "@/lib/api-client"
import { XRPL_EXPLORER_URL } from "@/lib/xrpl-constants"

interface FullUploadResult {
  success: boolean
  datasetId: string
  mptIssuanceId: string
  vaultId: string
  domainId?: string
  manifestCid: string
  merkleRoot?: string
  entryCount: number
  qualityScore?: number
  steps: Array<{ step: string; detail: string }>
}

function UploadForm({ providerAddress, onSuccess, onError }: { providerAddress: string; onSuccess: (result: FullUploadResult) => void; onError: (msg: string) => void }) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState("instruction-tuning")
  const [schema, setSchema] = useState("openai-chat-v1")
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState("")
  const qc = useQueryClient()

  const loadDemo = async () => {
    try {
      const res = await fetch("/demo-dataset.json")
      const blob = await res.blob()
      const demoFile = new File([blob], "instruction-tuning-1000.json", { type: "application/json" })
      setFile(demoFile)
      setName("GPT-4 Instruction Tuning Dataset")
      setCategory("instruction-tuning")
      setSchema("openai-chat-v1")
    } catch {
      onError("Failed to load demo dataset")
    }
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !name) return

    setLoading(true)
    try {
      setCurrentStep("Parsing file...")
      const text = await file.text()
      const trimmed = text.trim()
      let rows: Record<string, unknown>[]
      if (trimmed.startsWith("[")) {
        rows = JSON.parse(trimmed)
      } else {
        rows = trimmed.split("\n").filter(Boolean).map((line) => JSON.parse(line))
      }

      setCurrentStep(`Uploading ${rows.length} rows — encrypt, IPFS, ZK proof, mint MPT, create vault...`)

      const result = await apiPost<FullUploadResult>("/api/provider/upload", {
        providerAddress,
        description: { name, category, format: "jsonl", language: "en" },
        rows,
        schema,
      })

      setName("")
      setFile(null)
      setCurrentStep("")
      qc.invalidateQueries({ queryKey: ["datasets"] })
      qc.invalidateQueries({ queryKey: ["onchain-pools"] })
      onSuccess(result)
    } catch (err) {
      setCurrentStep("")
      onError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setLoading(false)
    }
  }, [file, name, category, schema, providerAddress, qc, onSuccess, onError])

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface/50 p-6">
      <h2 className="text-base font-medium text-foreground tracking-wider">Upload Dataset</h2>

      {currentStep && (
        <div className="flex items-center gap-3 rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
          <LoadingSpinner size="sm" />
          <span className="text-sm text-accent">{currentStep}</span>
        </div>
      )}

      <input
        type="text"
        placeholder="Dataset name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground placeholder-muted outline-none focus:border-white/30"
      />

      <div className="flex gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground outline-none"
        >
          <option value="instruction-tuning">Instruction Tuning</option>
          <option value="code">Code</option>
          <option value="medical">Medical</option>
          <option value="financial">Financial</option>
        </select>

        <input
          type="text"
          placeholder="Schema"
          value={schema}
          onChange={(e) => setSchema(e.target.value)}
          className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground placeholder-muted outline-none focus:border-white/30"
        />
      </div>

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-sm text-muted transition-colors hover:border-white/20 hover:text-foreground">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {file ? file.name : "Drop a JSONL file or click to browse"}
        <input
          type="file"
          accept=".jsonl,.json"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={!name || !file || loading}
          className="flex-1 rounded-full border border-white/80 bg-white/5 px-6 py-2.5 text-sm uppercase tracking-widest text-white backdrop-blur-sm transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-white/10"
        >
          {loading ? "Processing..." : "Upload & Certify"}
        </button>
        <button
          type="button"
          onClick={loadDemo}
          disabled={loading}
          className="rounded-full border border-accent/40 bg-accent/10 px-4 py-2.5 text-xs uppercase tracking-widest text-accent transition-colors hover:bg-accent/20 disabled:opacity-30 cursor-pointer"
        >
          Load Demo
        </button>
      </div>
    </form>
  )
}

function Row({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted shrink-0">{label}</span>
      <span
        className={`truncate font-mono ${copy ? "cursor-pointer hover:text-accent" : ""}`}
        onClick={() => {
          if (!copy) return
          navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        title={copy ? "Click to copy" : undefined}
      >
        {copied ? "Copied!" : value.length > 32 ? `${value.slice(0, 16)}...${value.slice(-8)}` : value}
      </span>
    </div>
  )
}

export default function ProviderPage() {
  const allowed = useRouteGuard("/provider")
  const { address } = useWalletStore()
  const { data: myDatasetsData, isLoading: datasetsLoading } = useMyDatasets()
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" } | null>(null)
  const [uploadResult, setUploadResult] = useState<FullUploadResult | null>(null)

  if (!allowed) return null

  const myDatasets = myDatasetsData?.datasets ?? []

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wider">Provider Dashboard</h1>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted">Datasets</span>
            <span className="text-lg font-bold text-foreground">{myDatasets.length}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted">Avg Score</span>
            <span className="text-lg font-bold text-positive">
              {myDatasets.length > 0 ? Math.round(myDatasets.reduce((s, d) => s + d.qualityScore, 0) / myDatasets.length) : 0}/100
            </span>
          </div>
        </div>
      </div>

      {address && (
        <>
          <UploadForm
            providerAddress={address}
            onSuccess={(result) => {
              setUploadResult(result)
              setToast({ msg: "Dataset uploaded, certified & deposited in vault", variant: "success" })
            }}
            onError={(msg) => setToast({ msg, variant: "error" })}
          />
          {uploadResult && (
            <div className="flex flex-col gap-3 rounded-2xl border border-positive/20 bg-positive/5 p-6 mb-16 overflow-y-auto max-h-[60vh]">
              <h3 className="text-sm font-medium text-positive tracking-wider">Last Upload Result</h3>
              <div className="grid gap-2 text-xs text-foreground">
                <Row label="Dataset ID" value={uploadResult.datasetId} copy />
                <Row label="MPT Issuance" value={uploadResult.mptIssuanceId} copy />
                <Row label="Vault ID" value={uploadResult.vaultId} copy />
                <Row label="IPFS CID" value={uploadResult.manifestCid} copy />
                {uploadResult.merkleRoot && <Row label="Merkle Root" value={uploadResult.merkleRoot} copy />}
                <Row label="Entries" value={String(uploadResult.entryCount)} />
                <Row label="Quality Score" value={`${uploadResult.qualityScore}/100`} />
              </div>
              <a
                href={`${XRPL_EXPLORER_URL}/${uploadResult.mptIssuanceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs uppercase tracking-widest text-accent transition-colors hover:bg-accent/20 w-fit"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                View on XRPL Explorer
              </a>
              <div className="mt-2 flex flex-col gap-1">
                <span className="text-xs text-muted">Steps:</span>
                {uploadResult.steps.map((s, i) => (
                  <span key={i} className="text-xs text-muted">
                    {i + 1}. {typeof s === "string" ? s : `${s.step} — ${s.detail}`}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div>
        <h2 className="mb-4 text-base font-medium tracking-wider text-foreground">My Datasets</h2>
        {datasetsLoading ? (
          <LoadingSpinner />
        ) : myDatasets.length === 0 ? (
          <EmptyState title="No datasets yet" description="Upload your first dataset to start earning yield." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myDatasets.map((d) => (
              <div key={d.mptIssuanceId} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/50 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-foreground truncate">{d.name}</h3>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 text-xs font-bold"
                    style={{ borderColor: d.qualityScore >= 80 ? "#34D399" : d.qualityScore >= 50 ? "#FF4D00" : "#F87171", color: d.qualityScore >= 80 ? "#34D399" : d.qualityScore >= 50 ? "#FF4D00" : "#F87171" }}>
                    {d.qualityScore}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-accent/30 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-accent">{d.category}</span>
                  <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] text-muted">{d.entryCount} rows</span>
                  <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] text-muted">{d.duplicateRate} dups</span>
                </div>
                {d.ipfs && (
                  <span className="text-[10px] text-muted font-mono truncate">IPFS: {d.ipfs}</span>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-positive">ZK Verified</span>
                  <a href={`${XRPL_EXPLORER_URL}/${d.mptIssuanceId}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline">Explorer</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.msg} variant={toast.variant} onClose={() => setToast(null)} />}
    </div>
  )
}
