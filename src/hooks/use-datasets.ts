"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"

interface DatasetDescription {
  name: string
  description?: string
  category: string
  language?: string
  format?: string
  sampleFields?: string[]
  pricePerDay?: string
}

interface BoundlessProof {
  version?: string
  proofId: string
  commitment?: string
  assertions: {
    entryCount: number
    duplicateRate: string
    schema?: string
    schemaHash?: string
    schemaValid?: boolean
    fieldCompleteness?: number
    qualityScore?: number
  }
  generatedAt?: number
  verifierUri?: string
}

export interface Dataset {
  datasetId: string
  providerAddress: string
  description: DatasetDescription
  manifestCid: string
  merkleRoot: string
  entryCount: number
  schemaHash: string
  boundlessProof: BoundlessProof
  version: string
  createdAt: number
  mptIssuanceId?: string
  vaultId?: string
  loanBrokerId?: string
}

export function useDatasets() {
  return useQuery({
    queryKey: ["datasets"],
    queryFn: () => apiGet<{ datasets: Dataset[] }>("/api/sirius/datasets").then((r) => r.datasets),
    refetchInterval: 15_000,
  })
}

export function useDataset(datasetId: string | null) {
  return useQuery({
    queryKey: ["dataset", datasetId],
    queryFn: () => apiGet<{ dataset: Dataset }>(`/api/sirius/datasets?datasetId=${datasetId}`).then((r) => r.dataset),
    enabled: !!datasetId,
  })
}

interface UploadInput {
  providerAddress: string
  description: DatasetDescription
  rows: unknown[]
  schema: string
}

export function useUploadDataset() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UploadInput) => apiPost("/api/sirius/upload", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["datasets"] }),
  })
}
