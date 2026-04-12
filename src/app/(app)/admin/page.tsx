"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useRouteGuard } from "@/hooks/use-route-guard"
import { useLoans, type LoanRecord } from "@/hooks/use-loans"
import { useDatasets } from "@/hooks/use-datasets"
import { useWalletStore } from "@/stores/wallet"
import { LoanStatusBadge } from "@/components/loan/LoanStatusBadge"
import { LoadingSpinner } from "@/components/common/LoadingSpinner"
import { Toast } from "@/components/common/Toast"
import { apiPost } from "@/lib/api-client"
import { truncateAddress } from "@/lib/utils"

function ActionButton({ label, loading, onClick, variant = "default" }: {
  label: string
  loading: boolean
  onClick: () => void
  variant?: "default" | "positive" | "negative"
}) {
  const styles = {
    default: "border-white/20 bg-white/5 text-foreground hover:bg-white/10",
    positive: "border-positive/40 bg-positive/10 text-positive hover:bg-positive/20",
    negative: "border-negative/40 bg-negative/10 text-negative hover:bg-negative/20",
  }

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`rounded-full border px-5 py-2 text-xs uppercase tracking-widest transition-all duration-200 disabled:opacity-30 cursor-pointer ${styles[variant]}`}
    >
      {loading ? "Processing..." : label}
    </button>
  )
}

function CredentialPanel() {
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" } | null>(null)

  const issueAndAccept = async (target: "provider" | "borrower", credentialType: string) => {
    const key = `${target}-${credentialType}`
    setLoading(key)
    try {
      await apiPost("/api/xrpl/credentials", { action: "issue", credentialType, target })
      await apiPost("/api/xrpl/credentials", { action: "accept", credentialType, target })
      setToast({ msg: `${credentialType} issued to ${target}`, variant: "success" })
    } catch {
      setToast({ msg: `Failed to issue ${credentialType}`, variant: "error" })
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface/50 p-5">
      <h2 className="text-base font-medium tracking-wider text-foreground">Credentials</h2>
      <div className="grid grid-cols-2 gap-3">
        <ActionButton
          label="Certify Provider"
          loading={loading === "provider-DataProviderCertified"}
          onClick={() => issueAndAccept("provider", "DataProviderCertified")}
          variant="positive"
        />
        <ActionButton
          label="KYB Borrower"
          loading={loading === "borrower-BorrowerKYB"}
          onClick={() => issueAndAccept("borrower", "BorrowerKYB")}
          variant="positive"
        />
      </div>
      {toast && <Toast message={toast.msg} variant={toast.variant} onClose={() => setToast(null)} />}
    </div>
  )
}

function VaultPanel() {
  const [mptId, setMptId] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ vaultId: string; domainId: string } | null>(null)
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" } | null>(null)

  const handleCreate = async () => {
    if (!mptId) return
    setLoading(true)
    try {
      const res = await apiPost<{ vaultId: string; domainId: string }>("/api/xrpl/vault", {
        action: "create",
        mptIssuanceId: mptId,
      })
      setResult(res)
      setToast({ msg: "Vault created", variant: "success" })
    } catch {
      setToast({ msg: "Failed to create vault", variant: "error" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface/50 p-5">
      <h2 className="text-base font-medium tracking-wider text-foreground">Create Vault</h2>
      <input
        type="text"
        placeholder="MPT Issuance ID"
        value={mptId}
        onChange={(e) => setMptId(e.target.value)}
        className="rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground placeholder-muted outline-none focus:border-white/30"
      />
      <ActionButton label="Create Vault + Domain" loading={loading} onClick={handleCreate} variant="positive" />
      {result && (
        <div className="flex flex-col gap-1 text-xs text-muted">
          <span>Vault: {truncateAddress(result.vaultId, 10)}</span>
          <span>Domain: {truncateAddress(result.domainId, 10)}</span>
        </div>
      )}
      {toast && <Toast message={toast.msg} variant={toast.variant} onClose={() => setToast(null)} />}
    </div>
  )
}

function DemoPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Record<string, string> | null>(null)
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" } | null>(null)

  const runDemo = async () => {
    setLoading(true)
    try {
      const res = await apiPost<{ summary: Record<string, string> }>("/api/xrpl/demo", {})
      setResult(res.summary)
      setToast({ msg: "Demo flow completed", variant: "success" })
    } catch {
      setToast({ msg: "Demo flow failed", variant: "error" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-accent/20 bg-accent/5 p-5">
      <h2 className="text-base font-medium tracking-wider text-accent">Full Demo Flow</h2>
      <p className="text-xs text-muted">Run the complete end-to-end flow: credentials, upload, ZK proof, MPT mint, vault, loan, Sirius key.</p>
      <ActionButton label="Run Full Demo" loading={loading} onClick={runDemo} />
      {result && (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-3 text-xs text-muted">
          {Object.entries(result).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span>{k}</span>
              <span className="text-foreground font-mono">{typeof v === "string" && v.length > 20 ? truncateAddress(v, 8) : String(v)}</span>
            </div>
          ))}
        </div>
      )}
      {toast && <Toast message={toast.msg} variant={toast.variant} onClose={() => setToast(null)} />}
    </div>
  )
}

function LoansTable({ loans }: { loans: LoanRecord[] }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" } | null>(null)
  const qc = useQueryClient()

  const triggerDefault = async (loanId: string) => {
    setLoading(`default-${loanId}`)
    try {
      await apiPost("/api/xrpl/loan/default", { loanId })
      setToast({ msg: "Loan defaulted", variant: "success" })
      qc.invalidateQueries({ queryKey: ["loans"] })
    } catch {
      setToast({ msg: "Failed to trigger default", variant: "error" })
    } finally {
      setLoading(null)
    }
  }

  const distribute = async (loanId: string) => {
    setLoading(`dist-${loanId}`)
    try {
      await apiPost("/api/xrpl/distribute", { loanId })
      setToast({ msg: "Interests distributed", variant: "success" })
    } catch {
      setToast({ msg: "Failed to distribute", variant: "error" })
    } finally {
      setLoading(null)
    }
  }

  if (loans.length === 0) return <p className="text-sm text-muted">No loans recorded.</p>

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Loan ID</th>
              <th className="px-4 py-3">Borrower</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Principal</th>
              <th className="px-4 py-3">Rate</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => {
              const isActive = loan.status === "ACTIVE" || loan.status === "REPAYING"
              const isCompleted = loan.status === "COMPLETED"

              return (
                <tr key={loan.loanId} className="border-b border-border/50 transition-colors hover:bg-white/[0.02]">
                  <td className="px-4 py-3 font-mono text-foreground">{truncateAddress(loan.loanId, 6)}</td>
                  <td className="px-4 py-3 text-muted">{truncateAddress(loan.borrower)}</td>
                  <td className="px-4 py-3"><LoanStatusBadge status={loan.status} /></td>
                  <td className="px-4 py-3 text-foreground">{loan.principalAmount} MPT</td>
                  <td className="px-4 py-3 text-foreground">{(loan.interestRate / 100).toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {isActive && (
                        <button
                          onClick={() => triggerDefault(loan.loanId)}
                          disabled={loading === `default-${loan.loanId}`}
                          className="rounded-full border border-negative/40 bg-negative/10 px-3 py-1 text-[10px] uppercase tracking-wider text-negative transition-colors hover:bg-negative/20 disabled:opacity-30 cursor-pointer"
                        >
                          {loading === `default-${loan.loanId}` ? "..." : "Default"}
                        </button>
                      )}
                      {isCompleted && (
                        <button
                          onClick={() => distribute(loan.loanId)}
                          disabled={loading === `dist-${loan.loanId}`}
                          className="rounded-full border border-positive/40 bg-positive/10 px-3 py-1 text-[10px] uppercase tracking-wider text-positive transition-colors hover:bg-positive/20 disabled:opacity-30 cursor-pointer"
                        >
                          {loading === `dist-${loan.loanId}` ? "..." : "Distribute"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {toast && <Toast message={toast.msg} variant={toast.variant} onClose={() => setToast(null)} />}
    </>
  )
}

export default function AdminPage() {
  const allowed = useRouteGuard("/admin")
  const { role } = useWalletStore()
  const { data: loans, isLoading: loansLoading } = useLoans()
  const { data: datasets, isLoading: datasetsLoading } = useDatasets()

  if (!allowed) return null

  if (role !== "loanbroker") {
    return (
      <div className="flex flex-col gap-4 py-20 text-center">
        <h1 className="text-2xl font-bold tracking-wider">Admin Panel</h1>
        <p className="text-sm text-muted">Connect with the LoanBroker wallet to access this page.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold tracking-wider">Admin Panel</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface/50 p-5">
          <span className="text-xs text-muted">Datasets</span>
          <span className="text-2xl font-bold text-foreground">{datasets?.length ?? 0}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface/50 p-5">
          <span className="text-xs text-muted">Active Loans</span>
          <span className="text-2xl font-bold text-accent">{loans?.filter((l) => l.status === "ACTIVE" || l.status === "REPAYING").length ?? 0}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface/50 p-5">
          <span className="text-xs text-muted">Total Loans</span>
          <span className="text-2xl font-bold text-foreground">{loans?.length ?? 0}</span>
        </div>
      </div>

      <DemoPanel />

      <div className="grid gap-4 sm:grid-cols-2">
        <CredentialPanel />
        <VaultPanel />
      </div>

      <div>
        <h2 className="mb-4 text-base font-medium tracking-wider text-foreground">All Loans</h2>
        {loansLoading ? <LoadingSpinner /> : <LoansTable loans={loans ?? []} />}
      </div>
    </div>
  )
}
