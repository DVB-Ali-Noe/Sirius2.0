"use client"

import { useState, useCallback } from "react"
import { useWalletStore } from "@/stores/wallet"
import { useRouteGuard } from "@/hooks/use-route-guard"
import { useDatasets, useUploadDataset } from "@/hooks/use-datasets"
import { useLoans } from "@/hooks/use-loans"
import { DatasetCard } from "@/components/dataset/DatasetCard"
import { EmptyState } from "@/components/common/EmptyState"
import { LoadingSpinner } from "@/components/common/LoadingSpinner"
import { Toast } from "@/components/common/Toast"

function UploadForm({ providerAddress, onSuccess, onError }: { providerAddress: string; onSuccess: () => void; onError: (msg: string) => void }) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState("instruction-tuning")
  const [schema, setSchema] = useState("openai-chat-v1")
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)

  const upload = useUploadDataset()

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !name) return

    setParsing(true)
    try {
      const text = await file.text()
      const rows = text.trim().split("\n").map((line) => JSON.parse(line))

      await upload.mutateAsync({
        providerAddress,
        description: { name, category, format: "jsonl", language: "en" },
        rows,
        schema,
      })

      setName("")
      setFile(null)
      onSuccess()
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setParsing(false)
    }
  }, [file, name, category, schema, providerAddress, upload, onSuccess])

  const isLoading = parsing || upload.isPending

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface/50 p-6">
      <h2 className="text-base font-medium text-foreground tracking-wider">Upload Dataset</h2>

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

      <button
        type="submit"
        disabled={!name || !file || isLoading}
        className="rounded-full border border-white/80 bg-white/5 px-6 py-2.5 text-sm uppercase tracking-widest text-white backdrop-blur-sm transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer hover:bg-white/10"
      >
        {isLoading ? "Processing..." : "Upload & Certify"}
      </button>
    </form>
  )
}

export default function ProviderPage() {
  const allowed = useRouteGuard("/provider")
  const { address } = useWalletStore()
  const { data: datasets, isLoading } = useDatasets()
  const { data: loans } = useLoans()
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" } | null>(null)

  if (!allowed) return null

  const myDatasets = datasets?.filter((d) => d.providerAddress === address) ?? []

  const totalRevenue = loans
    ?.filter((l) => l.provider === address && l.status === "COMPLETED")
    .reduce((sum, l) => sum + parseFloat(l.principalAmount) * (l.interestRate / 10000), 0) ?? 0

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
            <span className="text-xs text-muted">Revenue</span>
            <span className="text-lg font-bold text-positive">{totalRevenue.toFixed(2)} XRP</span>
          </div>
        </div>
      </div>

      {address && (
        <UploadForm
          providerAddress={address}
          onSuccess={() => setToast({ msg: "Dataset uploaded & ZK certified", variant: "success" })}
          onError={(msg) => setToast({ msg, variant: "error" })}
        />
      )}

      <div>
        <h2 className="mb-4 text-base font-medium tracking-wider text-foreground">My Datasets</h2>
        {isLoading ? (
          <LoadingSpinner />
        ) : myDatasets.length === 0 ? (
          <EmptyState title="No datasets yet" description="Upload your first dataset to start earning yield." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myDatasets.map((d) => (
              <DatasetCard key={d.datasetId} dataset={d} />
            ))}
          </div>
        )}
      </div>

      {toast && <Toast message={toast.msg} variant={toast.variant} onClose={() => setToast(null)} />}
    </div>
  )
}
