"use client"

import { useState } from "react"
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
import { TxLink, ObjectLink } from "@/components/common/TxLink"

function LoanCard({ loan, datasetName, onRepay, onDownload }: {
  loan: LoanRecord
  datasetName?: string
  onRepay: (loan: LoanRecord) => void
  onDownload: (loan: LoanRecord) => void
}) {
  const interestOwed = parseFloat(loan.principalAmount) * (loan.interestRate / 10000)
  const totalPaid = (loan.payments ?? []).reduce((sum, p) => sum + parseFloat(p.amount), 0)
  const isActive = loan.status === "ACTIVE" || loan.status === "REPAYING"

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface/50 p-5">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          {datasetName && <span className="text-sm font-medium text-foreground">{datasetName}</span>}
          <TxLink hash={loan.loanId} label={`Loan ${truncateAddress(loan.loanId, 4)}`} />
        </div>
        <LoanStatusBadge status={loan.status} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted">Principal</span>
          <span className="text-sm text-foreground">{loan.principalAmount} MPT</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted">Interest Rate</span>
          <span className="text-sm text-foreground">{(loan.interestRate / 100).toFixed(1)}%</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted">Provider</span>
          <span className="text-sm text-foreground">{truncateAddress(loan.provider)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-wider text-muted">Duration</span>
          <span className="text-sm text-foreground">{Math.round(loan.paymentInterval / 86400)}d</span>
        </div>
      </div>

      <RepaymentProgress totalOwed={interestOwed} totalPaid={totalPaid} />

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
            Repay
          </button>
        </div>
      )}
    </div>
  )
}

function RepayModal({ loan, open, onClose }: { loan: LoanRecord | null; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("")
  const repay = useRepayLoan()
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" } | null>(null)

  if (!loan) return null

  const handleRepay = async () => {
    if (!amount) return
    try {
      await repay.mutateAsync({ loanId: loan.loanId, amountXrp: amount })
      setToast({ msg: "Payment sent", variant: "success" })
      setAmount("")
      onClose()
    } catch {
      setToast({ msg: "Payment failed", variant: "error" })
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Repay Loan">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-background px-4 py-3">
            <span className="text-sm text-muted">Loan</span>
            <span className="text-sm text-foreground">{truncateAddress(loan.loanId, 8)}</span>
          </div>
          <input
            type="number"
            placeholder="Amount (XRP)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0"
            step="0.01"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground placeholder-muted outline-none focus:border-white/30"
          />
          <button
            onClick={handleRepay}
            disabled={!amount || repay.isPending}
            className="rounded-full border border-positive/60 bg-positive/10 px-6 py-2.5 text-sm uppercase tracking-widest text-positive transition-all duration-200 disabled:opacity-30 cursor-pointer hover:bg-positive/20"
          >
            {repay.isPending ? "Sending..." : "Send Payment"}
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
  if (!data || !data.rows.length) return null

  const columns = Object.keys(data.rows[0])

  return (
    <Modal open={open} onClose={onClose} title={dataset?.description.name ?? "Dataset Viewer"}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          <span>Showing {data.returned} of {data.totalRows} rows</span>
          {data.watermark && (
            <span className="rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-accent">
              Watermarked ({data.watermark.modifiedRows} rows)
            </span>
          )}
        </div>

        <div className="max-h-[400px] overflow-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface">
              <tr className="border-b border-border">
                {columns.map((col) => (
                  <th key={col} className="px-3 py-2 font-medium text-muted whitespace-nowrap">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, i) => (
                <tr key={i} className="border-b border-border/30 hover:bg-white/[0.02]">
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-1.5 text-foreground whitespace-nowrap max-w-[200px] truncate">
                      {String(row[col] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  )
}

export default function BorrowerPage() {
  const allowed = useRouteGuard("/borrower")
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
        limit: 50,
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
            <a href="/marketplace" className="rounded-full border border-accent/60 bg-accent/10 px-5 py-2 text-xs uppercase tracking-wider text-accent transition-colors hover:bg-accent/20">
              Browse Marketplace
            </a>
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
