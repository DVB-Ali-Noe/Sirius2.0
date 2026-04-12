"use client"

import { useWalletStore } from "@/stores/wallet"
import { useMyDatasets } from "@/hooks/use-my-datasets"
import { LoadingSpinner } from "@/components/common/LoadingSpinner"
import { EmptyState } from "@/components/common/EmptyState"
import { truncateAddress } from "@/lib/utils"

function StatCard({ label, value, color = "text-foreground" }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-surface/50 p-5">
      <span className="text-xs text-muted">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
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
