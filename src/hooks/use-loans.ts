"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiGet, apiPost } from "@/lib/api-client"

export type LoanStatus = "PENDING" | "ACTIVE" | "REPAYING" | "COMPLETED" | "DEFAULTED" | "DISPUTED"

export interface LoanRecord {
  loanId: string
  borrower: string
  provider: string
  loanBroker: string
  vaultId: string
  mptIssuanceId: string
  datasetId?: string
  principalAmount: string
  pricePerDay?: string
  interestRate: number
  paymentTotal: number
  durationDays?: number
  paymentInterval: number
  gracePeriod: number
  status: LoanStatus
  createdAt: number
  expiresAt?: number
  completedAt?: number
  payments: Array<{ amount: string; timestamp: number; txHash: string }>
  pricePerDay?: string
  durationDays?: number
  expiresAt?: number
  activatedAt?: number
}

export interface RepaymentInfo {
  totalOwed: number
  totalPaid: number
  remaining: number
  payments: Array<{ amount: string; paidAt: number; txHash?: string }>
}

export function useLoans() {
  return useQuery({
    queryKey: ["loans"],
    queryFn: () => apiGet<{ loans: LoanRecord[] }>("/api/xrpl/loan/status").then((r) => r.loans),
    refetchInterval: 10_000,
  })
}

export function useLoan(loanId: string | null) {
  return useQuery({
    queryKey: ["loan", loanId],
    queryFn: () =>
      apiGet<{ loan: LoanRecord; repayment: RepaymentInfo }>(`/api/xrpl/loan/status?loanId=${loanId}`),
    enabled: !!loanId,
    refetchInterval: 10_000,
  })
}

export function useCreateLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      vaultId: string
      mptIssuanceId: string
      loanBrokerId?: string
      borrowerAddress?: string
      principalAmount?: string
      interestRate?: number
    }) => apiPost("/api/xrpl/loan", { action: "create", ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans"] }),
  })
}

export function useRepayLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { loanId: string; amountXrp: string }) =>
      apiPost("/api/xrpl/loan/repay", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["loans"] }),
  })
}
