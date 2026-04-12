"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useRouteGuard } from "@/hooks/use-route-guard"
import { useDatasets } from "@/hooks/use-datasets"
import { useCreateLoan } from "@/hooks/use-loans"
import { useWalletStore } from "@/stores/wallet"
import { DatasetCard } from "@/components/dataset/DatasetCard"
import { Modal } from "@/components/common/Modal"
import { LoadingSpinner } from "@/components/common/LoadingSpinner"
import { EmptyState } from "@/components/common/EmptyState"
import { Toast } from "@/components/common/Toast"
import { apiPost } from "@/lib/api-client"
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
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" } | null>(null)

  if (!dataset) return null

  const handleRequest = async () => {
    if (!dataset.mptIssuanceId || !dataset.vaultId) return

    try {
      setStep("creating-loan")
      const result = await createLoan.mutateAsync({
        vaultId: dataset.vaultId,
        mptIssuanceId: dataset.mptIssuanceId,
        principalAmount: "1",
        interestRate: 500,
      }) as { loanId: string }

      setStep("activating-key")
      await apiPost("/api/sirius/activate", {
        action: "activate",
        loanId: result.loanId,
      })

      setStep("done")
      setTimeout(() => {
        onClose()
        setStep("idle")
        onComplete()
      }, 1000)
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
          {dataset.vaultId && (
            <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
              <span className="text-sm text-muted">Vault</span>
              <span className="text-sm text-foreground font-mono">{dataset.vaultId.slice(0, 8)}...{dataset.vaultId.slice(-4)}</span>
            </div>
          )}

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

function VaultSection({ vaultId, datasets, onBorrow }: {
  vaultId: string
  datasets: Dataset[]
  onBorrow: (d: Dataset) => void
}) {
  const { connected } = useWalletStore()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs uppercase tracking-widest text-muted">
          Vault {vaultId.slice(0, 8)}...{vaultId.slice(-4)}
        </span>
        <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] text-muted">
          {datasets.length} dataset{datasets.length > 1 ? "s" : ""}
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {datasets.map((d) => (
          <DatasetCard
            key={d.datasetId}
            dataset={d}
            action={
              connected ? (
                <button
                  onClick={() => onBorrow(d)}
                  className="rounded-full border border-accent/60 bg-accent/10 px-4 py-1.5 text-xs uppercase tracking-wider text-accent transition-colors hover:bg-accent/20 cursor-pointer"
                >
                  Borrow
                </button>
              ) : null
            }
          />
        ))}
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  const allowed = useRouteGuard("/marketplace")
  const router = useRouter()
  const { data: datasets, isLoading } = useDatasets()
  const [selected, setSelected] = useState<Dataset | null>(null)

  if (!allowed) return null

  const available = datasets?.filter((d) => d.mptIssuanceId) ?? []

  const vaultGroups = new Map<string, Dataset[]>()
  const noVault: Dataset[] = []
  for (const d of available) {
    if (d.vaultId) {
      const group = vaultGroups.get(d.vaultId) ?? []
      group.push(d)
      vaultGroups.set(d.vaultId, group)
    } else {
      noVault.push(d)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wider">Marketplace</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted">{vaultGroups.size} pool{vaultGroups.size > 1 ? "s" : ""}</span>
          <span className="text-sm text-muted">{available.length} dataset{available.length > 1 ? "s" : ""}</span>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : available.length === 0 ? (
        <EmptyState title="No datasets available" description="Check back later or deposit a dataset as a provider." />
      ) : (
        <div className="flex flex-col gap-10">
          {[...vaultGroups.entries()].map(([vaultId, group]) => (
            <VaultSection
              key={vaultId}
              vaultId={vaultId}
              datasets={group}
              onBorrow={setSelected}
            />
          ))}
          {noVault.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-widest text-muted">Unassigned</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {noVault.map((d) => (
                  <DatasetCard key={d.datasetId} dataset={d} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <LoanRequestModal
        dataset={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onComplete={() => router.push("/borrower")}
      />
    </div>
  )
}
