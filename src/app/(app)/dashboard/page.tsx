"use client"

import { useWalletStore } from "@/stores/wallet"
import { useDatasets } from "@/hooks/use-datasets"
import { useLoans } from "@/hooks/use-loans"
import { DatasetCard } from "@/components/dataset/DatasetCard"
import { LoanStatusBadge } from "@/components/loan/LoanStatusBadge"
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
  const { data: datasets, isLoading: datasetsLoading } = useDatasets()
  const { data: loans, isLoading: loansLoading } = useLoans()

  if (!connected) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <h1 className="text-3xl font-bold tracking-wider">Sirius Protocol</h1>
        <p className="text-sm text-muted">Connect your wallet to get started.</p>
      </div>
    )
  }

  const isLoading = datasetsLoading || loansLoading

  const myDatasets = datasets?.filter((d) => d.providerAddress === address) ?? []
  const myLoans = loans?.filter((l) => l.borrower === address) ?? []
  const activeLoans = myLoans.filter((l) => l.status === "ACTIVE" || l.status === "REPAYING")
  const recentDatasets = (datasets ?? []).slice(0, 3)

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
            <StatCard label="Total Datasets" value={datasets?.length ?? 0} />
            <StatCard label="My Datasets" value={myDatasets.length} color="text-accent" />
            <StatCard label="Active Loans" value={activeLoans.length} color="text-positive" />
            <StatCard label="Total Loans" value={loans?.length ?? 0} />
          </div>

          {myLoans.length > 0 && (
            <div>
              <h2 className="mb-4 text-base font-medium tracking-wider">My Active Loans</h2>
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-muted">
                      <th className="px-4 py-3">Loan ID</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Principal</th>
                      <th className="px-4 py-3">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myLoans.slice(0, 5).map((loan) => (
                      <tr key={loan.loanId} className="border-b border-border/50">
                        <td className="px-4 py-3 font-mono text-foreground">{truncateAddress(loan.loanId, 6)}</td>
                        <td className="px-4 py-3"><LoanStatusBadge status={loan.status} /></td>
                        <td className="px-4 py-3 text-foreground">{loan.principalAmount} MPT</td>
                        <td className="px-4 py-3 text-foreground">{(loan.interestRate / 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-4 text-base font-medium tracking-wider">Recent Datasets</h2>
            {recentDatasets.length === 0 ? (
              <EmptyState title="No datasets yet" description="Be the first to upload a dataset." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recentDatasets.map((d) => (
                  <DatasetCard key={d.datasetId} dataset={d} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
