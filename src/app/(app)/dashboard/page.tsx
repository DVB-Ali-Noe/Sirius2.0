"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useWalletStore } from "@/stores/wallet"
import { useMyDatasets } from "@/hooks/use-my-datasets"
import { LoadingSpinner } from "@/components/common/LoadingSpinner"
import { EmptyState } from "@/components/common/EmptyState"
import { Toast } from "@/components/common/Toast"
import { truncateAddress } from "@/lib/utils"
import { apiPost } from "@/lib/api-client"
import { signAndSubmitCredentialAccept, isOtsuInstalled } from "@/lib/wallet/otsu"

function StatCard({ label, value, color = "text-foreground" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface/50 p-5">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
    </div>
  )
}

function OnboardingPanel({ address }: { address: string }) {
  const [step, setStep] = useState<"idle" | "issuing" | "signing" | "done" | "funding">("idle")
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" } | null>(null)
  const qc = useQueryClient()

  const loanBrokerAddress = process.env.NEXT_PUBLIC_LOANBROKER_ADDRESS

  const fundMe = async () => {
    try {
      setStep("funding")
      const res = await apiPost<{ funded: boolean; balance?: string }>("/api/xrpl/fund", { address })
      setToast({ msg: `Funded ${address.slice(0, 8)}… with ${res.balance ?? "?"} XRP`, variant: "success" })
      setStep("idle")
    } catch (err) {
      setToast({ msg: err instanceof Error ? err.message : "Fund failed", variant: "error" })
      setStep("idle")
    }
  }

  const onboard = async (credentialType: "BorrowerKYB" | "DataProviderCertified") => {
    if (!isOtsuInstalled()) {
      setToast({ msg: "Otsu Wallet not detected", variant: "error" })
      return
    }
    if (!loanBrokerAddress) {
      setToast({ msg: "LoanBroker address missing in config", variant: "error" })
      return
    }
    try {
      setStep("issuing")
      await apiPost("/api/xrpl/credentials", {
        action: "issue",
        credentialType,
        address,
      })

      setStep("signing")
      await signAndSubmitCredentialAccept({
        subject: address,
        issuer: loanBrokerAddress,
        credentialType,
      })

      setStep("done")
      setToast({ msg: `${credentialType} activated`, variant: "success" })
      qc.invalidateQueries({ queryKey: ["wallet-credentials"] })
      setTimeout(() => setStep("idle"), 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed"
      setToast({ msg, variant: "error" })
      setStep("idle")
    }
  }

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-6">
      <h2 className="text-base font-medium tracking-wider text-foreground">Get a Role</h2>
      <p className="mt-1 text-sm text-muted">
        Your wallet has no on-chain credential yet. Pick a role to unlock the protocol.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          onClick={fundMe}
          disabled={step !== "idle"}
          className="cursor-pointer rounded-full border border-accent/80 bg-accent/10 px-5 py-2 text-sm text-accent transition hover:bg-accent/20 disabled:cursor-wait disabled:opacity-50"
        >
          Fund me (wasm devnet)
        </button>
        <button
          onClick={() => onboard("BorrowerKYB")}
          disabled={step !== "idle"}
          className="cursor-pointer rounded-full border border-white/80 bg-white/5 px-5 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-wait disabled:opacity-50"
        >
          Become Borrower
        </button>
        <button
          onClick={() => onboard("DataProviderCertified")}
          disabled={step !== "idle"}
          className="cursor-pointer rounded-full border border-white/30 bg-transparent px-5 py-2 text-sm text-white transition hover:bg-white/5 disabled:cursor-wait disabled:opacity-50"
        >
          Become Provider
        </button>
      </div>
      {step !== "idle" && (
        <p className="mt-3 text-xs text-muted">
          {step === "funding" && "Requesting XRP from wasm-devnet faucet…"}
          {step === "issuing" && "LoanBroker is issuing the credential on-chain…"}
          {step === "signing" && "Confirm the CredentialAccept in your Otsu wallet…"}
          {step === "done" && "Role activated. Refreshing…"}
        </p>
      )}
      {toast && <Toast message={toast.msg} variant={toast.variant} onClose={() => setToast(null)} />}
    </div>
  )
}

export default function DashboardPage() {
  const { connected, address, role } = useWalletStore()
  const { data: myDatasetsData, isLoading: datasetsLoading } = useMyDatasets()

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <h1 className="text-3xl font-bold tracking-wider">Sirius Protocol</h1>
        <p className="text-sm text-muted">Connect your wallet to get started.</p>
      </div>
    )
  }

  const isLoading = datasetsLoading
  const myDatasets = myDatasetsData?.datasets ?? []

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-wider">Dashboard</h1>
        <p className="text-sm text-muted mt-1">
          {role ? <span className="capitalize">{role}</span> : "Welcome"} — {truncateAddress(address ?? "")}
        </p>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="My Datasets" value={myDatasets.length} color="text-accent" />
            <StatCard label="Total Rows" value={myDatasets.reduce((s, d) => s + d.entryCount, 0)} />
            <StatCard label="Avg Score" value={myDatasets.length > 0 ? `${Math.round(myDatasets.reduce((s, d) => s + d.qualityScore, 0) / myDatasets.length)}/100` : "—"} color="text-positive" />
            <StatCard label="Role" value={role ?? "none"} />
          </div>

          {role === null && address && <OnboardingPanel address={address} />}

          <div>
            <h2 className="mb-4 text-base font-medium tracking-wider">My Datasets (on-chain)</h2>
            {myDatasets.length === 0 ? (
              <EmptyState title="No datasets yet" description="Be the first to upload a dataset." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {myDatasets.map((d) => (
                  <div key={d.mptIssuanceId} className="flex flex-col gap-2 rounded-2xl border border-border bg-surface/50 p-5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground truncate">{d.name}</span>
                      <span className="text-xs font-bold" style={{ color: d.qualityScore >= 80 ? "#34D399" : d.qualityScore >= 50 ? "#FF4D00" : "#F87171" }}>
                        {d.qualityScore}/100
                      </span>
                    </div>
                    <div className="flex gap-2 text-[10px] text-muted">
                      <span>{d.entryCount} rows</span>
                      <span>{d.category}</span>
                      <span>{d.duplicateRate} dups</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
