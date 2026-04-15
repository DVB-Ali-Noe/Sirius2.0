"use client"

import { useState, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useWalletStore } from "@/stores/wallet"
import { useRouteGuard } from "@/hooks/use-route-guard"
import { useMyDatasets, type OnChainDataset } from "@/hooks/use-my-datasets"
import { EmptyState } from "@/components/common/EmptyState"
import { LoadingSpinner } from "@/components/common/LoadingSpinner"
import { Toast } from "@/components/common/Toast"
import { apiPost, apiGet } from "@/lib/api-client"
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
  pricePerDay?: string
  steps: Array<{ step: string; detail: string }>
}

function UploadForm({ providerAddress, onSuccess, onError }: { providerAddress: string; onSuccess: (result: FullUploadResult) => void; onError: (msg: string) => void }) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState("")
  const [schema, setSchema] = useState("")
  const [pricePerDay, setPricePerDay] = useState("0.5")
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
      setPricePerDay("0.5")
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

      const cm = (window as unknown as {
        crossmark?: {
          signAndSubmitAndWait: (tx: Record<string, unknown>) => Promise<{ response: { data: { txHash: string; resp?: { result?: { meta?: { mpt_issuance_id?: string } } } } } }>
        }
      }).crossmark

      // Step 1 — Sirius: encrypt, IPFS, ZK proof + prepare unsigned mint tx
      setCurrentStep(`Encrypting & uploading ${rows.length} rows to IPFS...`)
      const prepared = await apiPost<{
        datasetId: string
        manifestCid: string
        merkleRoot: string
        entryCount: number
        qualityScore: number
        transaction: Record<string, unknown>
      }>("/api/provider/upload/prepare", {
        providerAddress,
        description: { name, category, format: "jsonl", language: "en" },
        rows,
        schema,
        pricePerDay,
      })

      // Step 2 — Sign MPT mint with wallet
      setCurrentStep("Sign MPT mint in your wallet...")
      if (!cm) throw new Error("Wallet not connected — install Crossmark/Otsu")

      const mintRes = await cm.signAndSubmitAndWait(prepared.transaction)
      const txHash = mintRes?.response?.data?.txHash
      if (!txHash) throw new Error("MPT mint failed: no tx hash returned")

      // Step 2b — Get mpt_issuance_id from ledger via tx hash (retry up to 10s)
      setCurrentStep("Confirming mint on-chain...")
      let mptIssuanceId: string | null = null
      for (let i = 0; i < 10; i++) {
        const txResult = await apiGet<{ mptIssuanceId: string | null; validated: boolean }>(`/api/xrpl/tx?hash=${txHash}`)
        if (txResult.mptIssuanceId && txResult.validated) {
          mptIssuanceId = txResult.mptIssuanceId
          break
        }
        await new Promise((r) => setTimeout(r, 1000))
      }
      if (!mptIssuanceId) throw new Error("MPT mint failed: no issuance ID found on-chain")

      // Step 3 — Register MPT: create vault + get authorize/deposit tx to sign
      setCurrentStep("Creating vault on-chain...")
      const registered = await apiPost<{
        domainId: string
        vaultId: string
        transactions: {
          mptAuthorize: Record<string, unknown>
          vaultDeposit: Record<string, unknown>
        }
      }>("/api/provider/upload/register-mpt", {
        providerAddress,
        datasetId: prepared.datasetId,
        mptIssuanceId,
      })

      // Step 4 — Sign authorize tx with wallet
      setCurrentStep("Sign MPT authorization in your wallet...")
      await cm.signAndSubmitAndWait(registered.transactions.mptAuthorize)

      // Step 5 — Sign deposit tx with wallet
      setCurrentStep("Sign vault deposit in your wallet...")
      await cm.signAndSubmitAndWait(registered.transactions.vaultDeposit)

      // Step 6 — Finalize
      setCurrentStep("Finalizing...")
      await apiPost("/api/provider/upload/finalize", {
        datasetId: prepared.datasetId,
        mptIssuanceId,
        vaultId: registered.vaultId,
      })

      const result: FullUploadResult = {
        success: true,
        datasetId: prepared.datasetId,
        mptIssuanceId,
        vaultId: registered.vaultId,
        manifestCid: prepared.manifestCid,
        merkleRoot: prepared.merkleRoot,
        entryCount: prepared.entryCount,
        qualityScore: prepared.qualityScore,
        pricePerDay,
        steps: [
          { step: "sirius_ingested", detail: `${prepared.entryCount} rows, CID: ${prepared.manifestCid}` },
          { step: "mpt_minted", detail: mptIssuanceId },
          { step: "vault_created", detail: registered.vaultId },
          { step: "mpt_authorized", detail: "OK" },
          { step: "mpt_deposited", detail: "1 MPT" },
        ],
      }

      setName("")
      setCategory("")
      setSchema("")
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
  }, [file, name, category, schema, pricePerDay, providerAddress, qc, onSuccess, onError])

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
          required
          className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground outline-none"
        >
          <option value="" disabled>Category</option>
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

        <div className="relative flex-1">
          <input
            type="number"
            step="0.1"
            min="0.1"
            placeholder="Price/day"
            value={pricePerDay}
            onChange={(e) => setPricePerDay(e.target.value)}
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2.5 pr-14 text-sm text-foreground placeholder-muted outline-none focus:border-white/30"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">XRP/24h</span>
        </div>
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
          disabled={!name || !file || !category || loading}
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

function DatasetModal({
  dataset,
  providerAddress,
  onClose,
  onDeleted,
}: {
  dataset: OnChainDataset
  providerAddress: string
  onClose: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [currentStep, setCurrentStep] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [steps, setSteps] = useState<Array<{ step: string; status: string; error?: string }>>([])
  const [done, setDone] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    setSteps([])

    const cm = (window as unknown as {
      crossmark?: {
        signAndSubmitAndWait: (tx: Record<string, unknown>) => Promise<unknown>
      }
    }).crossmark

    if (!cm) {
      setError("Wallet not connected — install Crossmark/Otsu")
      setDeleting(false)
      return
    }

    try {
      // Phase 1: Get unsigned transactions
      setCurrentStep("Preparing deletion...")
      const prepared = await apiPost<{
        phase: string
        vaultId: string | null
        loanBrokerId: string | null
        transactions: Array<{ name: string; tx: Record<string, unknown> }>
      }>("/api/provider/datasets/delete", {
        action: "prepare",
        mptIssuanceId: dataset.mptIssuanceId,
        providerAddress,
      })

      // Phase 2: Sign each transaction with wallet
      const clientSteps: typeof steps = []
      for (const { name, tx } of prepared.transactions) {
        setCurrentStep(`Sign "${name}" in your wallet...`)
        try {
          await cm.signAndSubmitAndWait(tx)
          clientSteps.push({ step: name, status: "ok" })
        } catch (e) {
          const msg = (e as Error).message ?? "rejected"
          if (msg.includes("tecNO_ENTRY") || msg.includes("tecEMPTY")) {
            clientSteps.push({ step: name, status: "skipped", error: "already done" })
          } else {
            clientSteps.push({ step: name, status: "failed", error: msg })
          }
        }
        setSteps([...clientSteps])
      }

      // Phase 3: Server finalizes (vault delete, loanBroker cleanup)
      setCurrentStep("Server cleanup...")
      const finalized = await apiPost<{
        phase: string
        status: string
        steps: Array<{ step: string; status: string; error?: string }>
      }>("/api/provider/datasets/delete", {
        action: "finalize",
        mptIssuanceId: dataset.mptIssuanceId,
        ipfsCid: dataset.ipfs || undefined,
      })

      const allSteps = [...clientSteps, ...finalized.steps]
      setSteps(allSteps)
      setCurrentStep("")

      const hasFailed = allSteps.some((s) => s.status === "failed")
      setDone(true)
      if (!hasFailed) {
        setTimeout(() => onDeleted(), 1500)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Delete failed"
      if (msg.includes("active loans")) {
        setError("Ce dataset a des emprunts actifs — suppression impossible.")
      } else {
        setError(msg)
      }
      setCurrentStep("")
    } finally {
      setDeleting(false)
    }
  }

  const hasFailed = steps.some((s) => s.status === "failed")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-muted hover:text-foreground cursor-pointer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 className="text-lg font-medium text-foreground mb-4 pr-8 truncate">{dataset.name}</h2>

        <div className="grid gap-2 text-xs text-foreground mb-4">
          <div className="flex justify-between"><span className="text-muted">MPT ID</span><a href={`${XRPL_EXPLORER_URL}/mpt/${dataset.mptIssuanceId}`} target="_blank" rel="noopener noreferrer" className="font-mono truncate ml-4 text-accent hover:underline">{dataset.mptIssuanceId.slice(0, 16)}...{dataset.mptIssuanceId.slice(-8)}</a></div>
          <div className="flex justify-between"><span className="text-muted">Category</span><span>{dataset.category}</span></div>
          <div className="flex justify-between"><span className="text-muted">Entries</span><span>{dataset.entryCount} rows</span></div>
          <div className="flex justify-between"><span className="text-muted">Quality Score</span><span className="text-positive font-bold">{dataset.qualityScore}/100</span></div>
          <div className="flex justify-between"><span className="text-muted">Duplicates</span><span>{dataset.duplicateRate}</span></div>
          {dataset.schema && <div className="flex justify-between"><span className="text-muted">Schema</span><span>{dataset.schema}</span></div>}
          {dataset.ipfs && <div className="flex justify-between"><span className="text-muted">IPFS</span><a href={`https://gateway.pinata.cloud/ipfs/${dataset.ipfs}`} target="_blank" rel="noopener noreferrer" className="font-mono truncate ml-4 text-accent hover:underline">{dataset.ipfs.slice(0, 20)}...</a></div>}
        </div>

        <a
          href={`${XRPL_EXPLORER_URL}/mpt/${dataset.mptIssuanceId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2 text-xs uppercase tracking-widest text-accent transition-colors hover:bg-accent/20 w-fit"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          View on Explorer
        </a>

        {error && (
          <div className="mb-4 rounded-lg border border-negative/30 bg-negative/5 px-4 py-3 text-xs text-negative">
            {error}
          </div>
        )}

        {deleting && (
          <div className="mb-4 rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs">
            {steps.length > 0 && steps.map((s, i) => (
              <p key={i} className="text-muted">
                {s.status === "ok" ? "✓" : s.status === "skipped" ? "–" : "✗"} {s.step}
              </p>
            ))}
            {currentStep && (
              <p className="flex items-center gap-2 text-accent mt-1">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                {currentStep}
              </p>
            )}
          </div>
        )}

        {done && (
          <div className={`mb-4 rounded-lg border p-3 text-xs ${!hasFailed ? "border-positive/30 bg-positive/5" : "border-warning/30 bg-warning/5"}`}>
            <p className="font-medium mb-1 text-foreground">{hasFailed ? "Suppression partielle" : "Dataset supprime"}</p>
            {steps.map((s, i) => (
              <p key={i} className="text-muted">
                {s.status === "ok" ? "✓" : s.status === "skipped" ? "–" : "✗"} {s.step} {s.error ? `(${s.error})` : ""}
              </p>
            ))}
          </div>
        )}

        {!done && !deleting && !error && (
          <button
            onClick={handleDelete}
            className="w-full rounded-full border border-negative/50 bg-negative/10 px-6 py-2.5 text-sm uppercase tracking-widest text-negative transition-colors hover:bg-negative/20 cursor-pointer"
          >
            Supprimer le dataset
          </button>
        )}
      </div>
    </div>
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
  const [selectedDataset, setSelectedDataset] = useState<OnChainDataset | null>(null)
  const qc = useQueryClient()

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
                <Row label="Price" value={`${uploadResult.pricePerDay ?? "0.5"} XRP /24h`} />
                <Row label="Quality Score" value={`${uploadResult.qualityScore}/100`} />
              </div>
              <a
                href={`${XRPL_EXPLORER_URL}/mpt/${uploadResult.mptIssuanceId}`}
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
              <div
                key={d.mptIssuanceId}
                onClick={() => setSelectedDataset(d)}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface/50 p-5 cursor-pointer transition-colors hover:border-white/20 hover:bg-surface/80"
              >
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
                  <a
                    href={`${XRPL_EXPLORER_URL}/mpt/${d.mptIssuanceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-accent hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Explorer
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDataset && address && (
        <DatasetModal
          dataset={selectedDataset}
          providerAddress={address}
          onClose={() => setSelectedDataset(null)}
          onDeleted={() => {
            setSelectedDataset(null)
            setToast({ msg: "Dataset supprime on-chain", variant: "success" })
            qc.invalidateQueries({ queryKey: ["my-datasets"] })
            qc.invalidateQueries({ queryKey: ["onchain-pools"] })
          }}
        />
      )}

      {toast && <Toast message={toast.msg} variant={toast.variant} onClose={() => setToast(null)} />}
    </div>
  )
}
