"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useWalletStore } from "@/stores/wallet"
import { useRouteGuard } from "@/hooks/use-route-guard"
import { useLoans, useRepayLoan, type LoanRecord } from "@/hooks/use-loans"
import { useDatasets, type Dataset } from "@/hooks/use-datasets"
import { LoanStatusBadge } from "@/components/loan/LoanStatusBadge"
import { RepaymentProgress } from "@/components/loan/RepaymentProgress"
import { EmptyState } from "@/components/common/EmptyState"
import { LoadingSpinner } from "@/components/common/LoadingSpinner"
import { Modal } from "@/components/common/Modal"
import { Toast } from "@/components/common/Toast"
import { truncateAddress } from "@/lib/utils"
import { apiPost } from "@/lib/api-client"
import { signAndSubmitPayment, isOtsuInstalled } from "@/lib/wallet/otsu"

function LoanCard({ loan, datasetName, onRepay, onDownload }: {
  loan: LoanRecord
  datasetName?: string
  onRepay: (loan: LoanRecord) => void
  onDownload: (loan: LoanRecord) => void
}) {
  const interestOwed = parseFloat(loan.principalAmount) * (loan.interestRate / 10000)
  const totalPaid = (loan.payments ?? []).reduce((sum, p) => sum + parseFloat(p.amount), 0)
  const isActive = loan.status === "ACTIVE" || loan.status === "REPAYING" || loan.status === "COMPLETED"

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface/50 p-5">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          {datasetName && <span className="text-sm font-medium text-foreground">{datasetName}</span>}
        </div>
        <LoanStatusBadge status={loan.status} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted">Price</span>
          <span className="text-sm text-foreground">{loan.pricePerDay ?? loan.principalAmount} XRP/day</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted">Duration</span>
          <span className="text-sm text-foreground">
            {loan.durationDays
              ? `${loan.durationDays} day${loan.durationDays > 1 ? "s" : ""}`
              : loan.paymentInterval >= 86400
                ? `${Math.round(loan.paymentInterval / 86400)} day${Math.round(loan.paymentInterval / 86400) > 1 ? "s" : ""}`
                : `${Math.round(loan.paymentInterval / 3600)} hour${Math.round(loan.paymentInterval / 3600) > 1 ? "s" : ""}`
            }
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted">Provider</span>
          <span className="text-sm text-foreground">{truncateAddress(loan.provider)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted">Expires</span>
          <span className="text-sm text-foreground">
            {loan.expiresAt
              ? new Date(loan.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
              : "N/A"
            }
          </span>
        </div>
      </div>

      <RepaymentProgress totalOwed={parseFloat(loan.principalAmount)} totalPaid={totalPaid} />

      {isActive && (
        <div className="flex gap-3">
          <button
            onClick={() => onDownload(loan)}
            className="flex-1 rounded-full border border-white/20 bg-white/5 py-2 text-xs uppercase tracking-wider text-foreground transition-colors hover:bg-white/10 cursor-pointer"
          >
            Access Data
          </button>
          <button
            onClick={() => onRepay(loan)}
            className="flex-1 rounded-full border border-positive/40 bg-positive/10 py-2 text-xs uppercase tracking-wider text-positive transition-colors hover:bg-positive/20 cursor-pointer"
          >
            Extend
          </button>
        </div>
      )}
    </div>
  )
}

function RepayModal({ loan, open, onClose }: { loan: LoanRecord | null; open: boolean; onClose: () => void }) {
  const [days, setDays] = useState("1")
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" } | null>(null)
  const qc = useQueryClient()
  const { address } = useWalletStore()

  if (!loan) return null

  const pricePerDay = parseFloat(loan.pricePerDay ?? loan.principalAmount ?? "0.5")
  const daysNum = parseInt(days || "0", 10)
  const totalXrp = pricePerDay * daysNum

  const handleExtend = async () => {
    if (daysNum <= 0 || !address) return
    if (!isOtsuInstalled()) {
      setToast({ msg: "Otsu Wallet not detected", variant: "error" })
      return
    }
    setLoading(true)
    try {
      const totalDrops = Math.round(totalXrp * 1_000_000).toString()
      const { hash } = await signAndSubmitPayment({
        from: address,
        to: loan.provider,
        amountDrops: totalDrops,
        memo: `sirius-extend:${loan.loanId}`,
      })

      await apiPost("/api/xrpl/extend-access", {
        txHash: hash,
        loanId: loan.loanId,
        additionalDays: daysNum,
      })
      setToast({ msg: `+${daysNum} day${daysNum > 1 ? "s" : ""} added`, variant: "success" })
      setDays("1")
      qc.invalidateQueries({ queryKey: ["loans"] })
      onClose()
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : "Failed", variant: "error" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Extend Access">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted">Additional days</label>
            <input
              type="number"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              min="1"
              max="365"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground outline-none focus:border-white/30"
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-accent/20 bg-accent/5 px-4 py-3">
            <span className="text-sm text-muted">Total</span>
            <span className="text-sm text-accent font-medium">
              {totalXrp.toFixed(2)} XRP
              <span className="ml-2 text-xs text-muted">({pricePerDay} XRP/day x {daysNum}d)</span>
            </span>
          </div>
          <button
            onClick={handleExtend}
            disabled={daysNum <= 0 || loading}
            className="rounded-full border border-positive/60 bg-positive/10 px-6 py-2.5 text-sm uppercase tracking-widest text-positive transition-all duration-200 disabled:opacity-30 cursor-pointer hover:bg-positive/20"
          >
            {loading ? "Extending..." : `Extend +${daysNum}d (${totalXrp.toFixed(2)} XRP)`}
          </button>
        </div>
      </Modal>
      {toast && <Toast message={toast.msg} variant={toast.variant} onClose={() => setToast(null)} />}
    </>
  )
}

interface DownloadResult {
  datasetId: string
  loanId: string
  rows: Record<string, unknown>[]
  totalRows: number
  returned: number
  watermark: { seed: string; modifiedRows: number; method: string } | null
}

function DataViewerModal({ data, dataset, open, onClose }: {
  data: DownloadResult | null
  dataset?: Dataset
  open: boolean
  onClose: () => void
}) {
  if (!data || !data.rows.length || !open) return null

  const columns = Object.keys(data.rows[0])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm pt-20 pb-4 pl-20 pr-4" onClick={onClose}>
      <div
        className="relative flex flex-col w-full h-full rounded-2xl border border-border bg-surface shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <h2 className="text-sm font-medium text-foreground truncate">{dataset?.description.name ?? "Dataset Viewer"}</h2>
            <span className="text-xs text-muted shrink-0">{data.returned} / {data.totalRows} rows</span>
            {data.watermark && (
              <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
                Watermarked ({data.watermark.modifiedRows} rows)
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-muted hover:text-foreground cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="text-left text-xs border-collapse">
            <thead className="sticky top-0 bg-surface z-10">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium text-muted whitespace-nowrap w-10">#</th>
                {columns.map((col) => (
                  <th key={col} className="px-3 py-2 font-medium text-muted whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} className="border-b border-border/30 hover:bg-white/[0.02]">
                  <td className="px-3 py-1.5 text-muted tabular-nums whitespace-nowrap">{i + 1}</td>
                  {columns.map((col) => {
                    const val = row[col]
                    const str = typeof val === "number" ? (Number.isInteger(val) ? String(val) : val.toFixed(3)) : String(val ?? "")
                    const short = str.length > 60 ? str.slice(0, 57) + "..." : str
                    return (
                      <td key={col} className="px-3 py-1.5 text-foreground whitespace-nowrap max-w-[400px]">
                        {short}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function BorrowerPage() {
  const allowed = useRouteGuard("/borrower")
  const router = useRouter()
  const { address } = useWalletStore()
  const { data: loans, isLoading } = useLoans()
  const { data: datasets } = useDatasets()
  const [repayLoan, setRepayLoan] = useState<LoanRecord | null>(null)
  const [downloadData, setDownloadData] = useState<DownloadResult | null>(null)
  const [downloadDataset, setDownloadDataset] = useState<Dataset | undefined>()
  const [downloading, setDownloading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" | "info" } | null>(null)

  if (!allowed) return null

  const addressLoans = loans?.filter((l) => l.borrower === address) ?? []
  // Show all loans if none match connected address (demo mode with .env wallets)
  const myLoans = addressLoans.length > 0 ? addressLoans : (loans ?? [])
  const activeLoans = myLoans.filter((l) => l.status === "ACTIVE" || l.status === "REPAYING")

  const handleDownload = async (loan: LoanRecord) => {
    const dataset = datasets?.find((d) => d.mptIssuanceId === loan.mptIssuanceId)
    if (!dataset) {
      setToast({ msg: "Dataset not found", variant: "error" })
      return
    }

    setDownloading(loan.loanId)
    try {
      const result = await apiPost<DownloadResult>("/api/sirius/download", {
        datasetId: dataset.datasetId,
        loanId: loan.loanId,
        limit: 10000,
        applyWatermark: true,
      })
      setDownloadData(result)
      setDownloadDataset(dataset)
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Download failed", variant: "error" })
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-wider">Borrower Dashboard</h1>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted">Active Loans</span>
            <span className="text-lg font-bold text-accent">{activeLoans.length}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-xs text-muted">Total Loans</span>
            <span className="text-lg font-bold text-foreground">{myLoans.length}</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : myLoans.length === 0 ? (
        <EmptyState
          title="No loans yet"
          description="Browse the marketplace to find datasets and request access."
          action={
            <button onClick={() => router.push("/marketplace")} className="rounded-full border border-accent/60 bg-accent/10 px-5 py-2 text-xs uppercase tracking-wider text-accent transition-colors hover:bg-accent/20 cursor-pointer">
              Browse Marketplace
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {myLoans.map((loan) => {
            const dataset = datasets?.find((d) => d.mptIssuanceId === loan.mptIssuanceId)
            return (
              <LoanCard
                key={loan.loanId}
                loan={loan}
                datasetName={dataset?.description.name}
                onRepay={setRepayLoan}
                onDownload={handleDownload}
              />
            )
          })}
        </div>
      )}

      {downloading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-6 py-4">
            <div className="h-4 w-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <span className="text-sm text-foreground">Decrypting & watermarking dataset...</span>
          </div>
        </div>
      )}

      <RepayModal loan={repayLoan} open={!!repayLoan} onClose={() => setRepayLoan(null)} />
      <DataViewerModal
        data={downloadData}
        dataset={downloadDataset}
        open={!!downloadData}
        onClose={() => { setDownloadData(null); setDownloadDataset(undefined) }}
      />
      {toast && <Toast message={toast.msg} variant={toast.variant} onClose={() => setToast(null)} />}
    </div>
  )
}
