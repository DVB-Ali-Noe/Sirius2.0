"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { useRouteGuard } from "@/hooks/use-route-guard"
import { useDatasets } from "@/hooks/use-datasets"
import { useCreateLoan } from "@/hooks/use-loans"
import { useWalletStore } from "@/stores/wallet"
import { DatasetCard } from "@/components/dataset/DatasetCard"
import { DatasetDetail } from "@/components/dataset/DatasetDetail"
import { Modal } from "@/components/common/Modal"
import { LoadingSpinner } from "@/components/common/LoadingSpinner"
import { EmptyState } from "@/components/common/EmptyState"
import { Toast } from "@/components/common/Toast"
import { apiPost, apiGet } from "@/lib/api-client"

interface OnChainPool {
  vaultId: string
  mptIssuanceId: string
  loanBrokerId: string | null
  dataset: {
    name: string
    ipfs: string
    category: string
    qualityCertificate: Record<string, unknown>
    qualityScore: number
    zkProof: string
    schema: string
  } | null
  issuer: string
}

function useOnChainPools() {
  return useQuery({
    queryKey: ["onchain-pools"],
    queryFn: () => apiGet<{ pools: OnChainPool[]; count: number }>("/api/xrpl/pools"),
    refetchInterval: 15_000,
  })
}
import { TxLink } from "@/components/common/TxLink"
import type { Dataset } from "@/hooks/use-datasets"

type FlowStep = "idle" | "creating-loan" | "activating-key" | "done"

function LoanRequestModal({ dataset, open, onClose, onComplete }: {
  dataset: Dataset | null
  open: boolean
  onClose: () => void
  onComplete: () => void
}) {
  const [duration, setDuration] = useState("30")
  const createLoan = useCreateLoan()
  const [step, setStep] = useState<FlowStep>("idle")
  const [txHash, setTxHash] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" } | null>(null)

  if (!dataset) return null

  const handleRequest = async () => {
    if (!dataset.mptIssuanceId || !dataset.vaultId) return

    try {
      setStep("creating-loan")
      const result = await createLoan.mutateAsync({
        vaultId: dataset.vaultId,
        mptIssuanceId: dataset.mptIssuanceId,
        loanBrokerId: dataset.loanBrokerId,
        principalAmount: "1",
        interestRate: 500,
      }) as { loanId: string }

      setTxHash(result.loanId)

      setStep("activating-key")
      await apiPost("/api/sirius/activate", {
        action: "activate",
        loanId: result.loanId,
      })

      setStep("done")
      setTimeout(() => {
        onClose()
        setStep("idle")
        setTxHash(null)
        onComplete()
      }, 1500)
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Failed", variant: "error" })
      setStep("idle")
    }
  }

  const stepLabels: Record<FlowStep, string> = {
    "idle": "Request Access",
    "creating-loan": "Creating loan on XRPL...",
    "activating-key": "Activating decryption key...",
    "done": "Access granted!",
  }

  return (
    <>
      <Modal open={open} onClose={step === "idle" ? onClose : () => {}} title="Request Dataset Access">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
            <span className="text-sm text-muted">Dataset</span>
            <span className="text-sm text-foreground">{dataset.description.name}</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
            <span className="text-sm text-muted">Quality Score</span>
            <span className="text-sm text-positive font-medium">{dataset.boundlessProof.assertions.qualityScore}/100</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
            <span className="text-sm text-muted">Entries</span>
            <span className="text-sm text-foreground">{dataset.entryCount.toLocaleString()}</span>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted">Loan Duration (days)</label>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              min="1"
              max="365"
              disabled={step !== "idle"}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground outline-none focus:border-white/30 disabled:opacity-50"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
            <span className="text-sm text-muted">Estimated Cost</span>
            <span className="text-sm text-accent font-medium">
              {(parseFloat(duration || "0") / 365 * 500 / 100).toFixed(2)} XRP
            </span>
          </div>

          {step !== "idle" && step !== "done" && (
            <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span className="text-sm text-muted">{stepLabels[step]}</span>
            </div>
          )}

          {step !== "idle" && txHash && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
              <span className="text-xs text-muted">Tx Hash</span>
              <TxLink hash={txHash} />
            </div>
          )}

          {step === "done" && (
            <div className="flex items-center gap-3 rounded-lg border border-positive/20 bg-positive/5 px-4 py-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-positive">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-sm text-positive">Access granted — redirecting to your loans...</span>
            </div>
          )}

          <button
            onClick={handleRequest}
            disabled={step !== "idle"}
            className="rounded-full border border-white/80 bg-white/5 px-6 py-2.5 text-sm uppercase tracking-widest text-white backdrop-blur-sm transition-all duration-200 disabled:opacity-30 cursor-pointer hover:bg-white/10"
          >
            {stepLabels[step]}
          </button>
        </div>
      </Modal>
      {toast && <Toast message={toast.msg} variant={toast.variant} onClose={() => setToast(null)} />}
    </>
  )
}

function PoolCard({ vaultId, datasets, onSelect }: {
  vaultId: string
  datasets: Dataset[]
  onSelect: () => void
}) {
  const avgScore = datasets.reduce((s, d) => s + (d.boundlessProof.assertions.qualityScore ?? 0), 0) / datasets.length
  const totalRows = datasets.reduce((s, d) => s + d.entryCount, 0)
  const categories = [...new Set(datasets.map((d) => d.description.category))]

  return (
    <button
      onClick={onSelect}
      className="group flex flex-col gap-4 rounded-2xl border border-border bg-surface/50 p-6 text-left backdrop-blur-sm transition-all hover:border-white/20 cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Lending Pool</span>
          <span className="text-sm font-mono text-foreground">{vaultId.slice(0, 10)}...{vaultId.slice(-6)}</span>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted transition-colors group-hover:border-accent/40 group-hover:text-accent">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted">Datasets</span>
          <span className="text-lg font-bold text-foreground">{datasets.length}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted">Avg Score</span>
          <span className="text-lg font-bold text-positive">{avgScore.toFixed(0)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted">Total Rows</span>
          <span className="text-lg font-bold text-foreground">{totalRows.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <span key={cat} className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-muted">
            {cat}
          </span>
        ))}
      </div>
    </button>
  )
}

export default function MarketplacePage() {
  const allowed = useRouteGuard("/marketplace")
  const router = useRouter()
  const { data: datasets, isLoading: datasetsLoading } = useDatasets()
  const { data: poolsData, isLoading: poolsLoading } = useOnChainPools()
  const { connected } = useWalletStore()
  const [selectedVault, setSelectedVault] = useState<string | null>(null)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [detailDataset, setDetailDataset] = useState<Dataset | null>(null)

  const isLoading = datasetsLoading || poolsLoading

  if (!allowed) return null

  // Build vault groups from on-chain data
  const vaultGroups = new Map<string, Dataset[]>()
  const onChainPools = poolsData?.pools ?? []

  for (const pool of onChainPools) {
    // Try to find matching dataset from Sirius registry
    const siriusDataset = datasets?.find((d) => d.mptIssuanceId === pool.mptIssuanceId)

    const dataset: Dataset = siriusDataset ?? {
      datasetId: pool.mptIssuanceId,
      providerAddress: pool.issuer,
      description: {
        name: pool.dataset?.name ?? "On-chain Dataset",
        category: pool.dataset?.category ?? "defi",
        format: "jsonl",
        language: "en",
      },
      manifestCid: pool.dataset?.ipfs ?? "",
      merkleRoot: "",
      entryCount: (pool.dataset?.qualityCertificate?.entryCount as number) ?? 0,
      schemaHash: pool.dataset?.schema ?? "",
      boundlessProof: {
        version: "on-chain",
        proofId: pool.dataset?.zkProof ?? "",
        assertions: {
          entryCount: (pool.dataset?.qualityCertificate?.entryCount as number) ?? 0,
          duplicateRate: String(pool.dataset?.qualityCertificate?.duplicateRate ?? "0%"),
          schema: String(pool.dataset?.qualityCertificate?.schema ?? ""),
          schemaHash: pool.dataset?.schema ?? "",
          qualityScore: pool.dataset?.qualityScore ?? 0,
        },
        commitment: "",
        generatedAt: 0,
        verifierUri: pool.dataset?.zkProof ?? "",
      },
      version: "on-chain",
      createdAt: 0,
      mptIssuanceId: pool.mptIssuanceId,
      vaultId: pool.vaultId,
      loanBrokerId: pool.loanBrokerId ?? undefined,
    }

    const group = vaultGroups.get(pool.vaultId) ?? []
    group.push(dataset)
    vaultGroups.set(pool.vaultId, group)
  }

  const selectedPoolDatasets = selectedVault ? vaultGroups.get(selectedVault) ?? [] : []

  return (
    <div className="flex flex-col gap-8">
      {!selectedVault ? (
        <>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-wider">Lending Pools</h1>
            <span className="text-sm text-muted">{vaultGroups.size} pool{vaultGroups.size !== 1 ? "s" : ""} available</span>
          </div>

          {isLoading ? (
            <LoadingSpinner />
          ) : vaultGroups.size === 0 ? (
            <EmptyState title="No pools available" description="Check back later or deposit a dataset as a provider." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...vaultGroups.entries()].map(([vaultId, group]) => (
                <PoolCard
                  key={vaultId}
                  vaultId={vaultId}
                  datasets={group}
                  onSelect={() => setSelectedVault(vaultId)}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedVault(null)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/5 text-muted transition-colors hover:text-foreground hover:border-white/40 cursor-pointer"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold tracking-wider">Pool Datasets</h1>
              <span className="text-xs text-muted font-mono">{selectedVault.slice(0, 10)}...{selectedVault.slice(-6)}</span>
            </div>
            <span className="ml-auto text-sm text-muted">{selectedPoolDatasets.length} dataset{selectedPoolDatasets.length !== 1 ? "s" : ""}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {selectedPoolDatasets.map((d) => (
              <DatasetCard
                key={d.datasetId}
                dataset={d}
                onSelect={setDetailDataset}
                action={
                  connected ? (
                    <button
                      onClick={() => setSelectedDataset(d)}
                      className="rounded-full border border-accent/60 bg-accent/10 px-4 py-1.5 text-xs uppercase tracking-wider text-accent transition-colors hover:bg-accent/20 cursor-pointer"
                    >
                      Borrow
                    </button>
                  ) : null
                }
              />
            ))}
          </div>
        </>
      )}

      <DatasetDetail
        dataset={detailDataset}
        open={!!detailDataset}
        onClose={() => setDetailDataset(null)}
        action={
          connected && detailDataset?.mptIssuanceId && detailDataset?.vaultId ? (
            <button
              onClick={() => {
                setSelectedDataset(detailDataset)
                setDetailDataset(null)
              }}
              className="rounded-full border border-accent/60 bg-accent/10 px-5 py-2 text-xs uppercase tracking-wider text-accent transition-colors hover:bg-accent/20 cursor-pointer"
            >
              Borrow this dataset
            </button>
          ) : null
        }
      />

      <LoanRequestModal
        dataset={selectedDataset}
        open={!!selectedDataset}
        onClose={() => setSelectedDataset(null)}
        onComplete={() => router.push("/borrower")}
      />
    </div>
  )
}
